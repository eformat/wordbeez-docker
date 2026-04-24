"""
LLM call statistics tracker.

Captures TTFT, token usage, latency, and call counts.
Emits [STATS] JSON lines to stdout for the dashboard to parse.
"""

import json
import sys
import time
from dataclasses import dataclass, field

from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.outputs import LLMResult


@dataclass
class AgentStats:
    """Cumulative stats for the agent session."""
    llm_calls: int = 0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_reasoning_tokens: int = 0
    total_latency_ms: int = 0
    words_submitted: int = 0
    words_correct: int = 0
    puzzles_solved: int = 0
    solver_calls: int = 0
    solver_candidates: int = 0
    last_ttft_ms: int = 0
    last_latency_ms: int = 0
    last_input_tokens: int = 0
    last_output_tokens: int = 0
    last_reasoning_tokens: int = 0

    def emit(self):
        """Print a [STATS] line for the dashboard to parse."""
        data = {
            "llm_calls": self.llm_calls,
            "total_input_tokens": self.total_input_tokens,
            "total_output_tokens": self.total_output_tokens,
            "total_reasoning_tokens": self.total_reasoning_tokens,
            "total_latency_ms": self.total_latency_ms,
            "words_submitted": self.words_submitted,
            "words_correct": self.words_correct,
            "puzzles_solved": self.puzzles_solved,
            "solver_calls": self.solver_calls,
            "solver_candidates": self.solver_candidates,
            "last_ttft_ms": self.last_ttft_ms,
            "last_latency_ms": self.last_latency_ms,
            "last_input_tokens": self.last_input_tokens,
            "last_output_tokens": self.last_output_tokens,
            "last_reasoning_tokens": self.last_reasoning_tokens,
            "avg_latency_ms": round(self.total_latency_ms / self.llm_calls) if self.llm_calls else 0,
        }
        print(f"[STATS] {json.dumps(data)}", flush=True)


# Module-level singleton
_stats = AgentStats()


def get_stats() -> AgentStats:
    return _stats


def reset_stats():
    global _stats
    _stats = AgentStats()


class StatsCallbackHandler(BaseCallbackHandler):
    """LangChain callback handler that tracks LLM call stats."""

    def __init__(self):
        super().__init__()
        self._call_start: float = 0
        self._first_token_time: float | None = None
        self._streamed_tokens: int = 0

    def on_llm_start(self, serialized, prompts, **kwargs):
        self._call_start = time.time()
        self._first_token_time = None
        self._streamed_tokens = 0

    def on_chat_model_start(self, serialized, messages, **kwargs):
        self._call_start = time.time()
        self._first_token_time = None
        self._streamed_tokens = 0

    def on_llm_new_token(self, token, **kwargs):
        self._streamed_tokens += 1
        if self._first_token_time is None:
            self._first_token_time = time.time()
            ttft_ms = int((self._first_token_time - self._call_start) * 1000)
            _stats.last_ttft_ms = ttft_ms

    def on_llm_end(self, response: LLMResult, **kwargs):
        elapsed_ms = int((time.time() - self._call_start) * 1000)

        # If we never got a streaming token callback, estimate TTFT = full latency
        if self._first_token_time is None:
            _stats.last_ttft_ms = elapsed_ms

        _stats.llm_calls += 1
        _stats.last_latency_ms = elapsed_ms
        _stats.total_latency_ms += elapsed_ms

        # Try multiple places where token usage might be reported
        usage: dict = {}

        # 1. llm_output (non-streaming path)
        if response.llm_output:
            usage = response.llm_output.get("token_usage", {})
            if not usage:
                usage = response.llm_output.get("usage", {})

        # 2. Generation response_metadata (streaming path — usage lands here)
        if not usage and response.generations:
            for gen_list in response.generations:
                for gen in gen_list:
                    msg = getattr(gen, "message", None)
                    meta = getattr(gen, "generation_info", {}) or {}
                    if not meta and msg:
                        meta = getattr(msg, "response_metadata", {}) or {}
                    if "token_usage" in meta:
                        usage = meta["token_usage"]
                        break
                    if "usage" in meta:
                        usage = meta["usage"]
                        break
                    # OpenAI-compatible: usage_metadata on the message
                    if msg:
                        usage_meta = getattr(msg, "usage_metadata", {}) or {}
                        if usage_meta:
                            usage = {
                                "prompt_tokens": usage_meta.get("input_tokens", 0),
                                "completion_tokens": usage_meta.get("output_tokens", 0),
                            }
                            break
                if usage:
                    break

        if usage:
            input_tokens = usage.get("prompt_tokens", 0) or usage.get("input_tokens", 0)
            output_tokens = usage.get("completion_tokens", 0) or usage.get("output_tokens", 0)
            reasoning_tokens = 0

            # Try explicit reasoning token count from API
            details = usage.get("completion_tokens_details") or {}
            if details:
                reasoning_tokens = details.get("reasoning_tokens", 0)

            # Estimate reasoning tokens: completion_tokens includes reasoning for
            # kimi-k2-6, but streamed tokens are only the visible output.
            # reasoning = total_completion - visible_output
            if not reasoning_tokens and output_tokens > 0 and self._streamed_tokens > 0:
                reasoning_tokens = max(0, output_tokens - self._streamed_tokens)

            _stats.last_input_tokens = input_tokens
            _stats.last_output_tokens = output_tokens
            _stats.last_reasoning_tokens = reasoning_tokens
            _stats.total_input_tokens += input_tokens
            _stats.total_output_tokens += output_tokens
            _stats.total_reasoning_tokens += reasoning_tokens

        _stats.emit()

    def on_llm_error(self, error, **kwargs):
        elapsed_ms = int((time.time() - self._call_start) * 1000)
        _stats.llm_calls += 1
        _stats.last_latency_ms = elapsed_ms
        _stats.total_latency_ms += elapsed_ms
        _stats.emit()
