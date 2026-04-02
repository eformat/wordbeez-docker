"""
LangChain/LangGraph agent that plays WordSwarm in BLIND mode.

Hybrid approach:
- Algorithmic solver enumerates adjacency paths, matches dictionary + hints
- LLM makes strategic decisions: which ambiguous words to try, submission order

The agent does NOT have access to the word list — it plays like a human.
"""

import time
import json

from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from langchain_core.tools import tool

from . import config as _config
from .config import POLL_INTERVAL
from .game_client import GameClient
from .blind_solver import solve_blind, get_safe_submissions, format_for_llm
from .stats import get_stats, StatsCallbackHandler

# Module-level game client (initialized in create_agent)
_client: GameClient | None = None


def _get_client() -> GameClient:
    global _client
    if _client is None:
        _client = GameClient()
    return _client


@tool
def observe_game() -> str:
    """Get the current game state. Shows board letters, hints (first letter + word length),
    score, honey level, and phase. Does NOT show the actual words — you must figure them out."""
    client = _get_client()
    state = client.get_blind_state()

    hint_display = []
    for i, h in enumerate(state.hints):
        revealed = h.get("revealedLetters", [])
        display = "".join(ch if ch else "_" for ch in revealed)
        status = "SOLVED" if h.get("solved") else f"{display} ({h['length']} letters)"
        hint_display.append(f"  #{i+1}: {status}")

    return json.dumps({
        "phase": state.phase,
        "level": state.level,
        "score": state.score,
        "honey_level": state.honeyLevel,
        "time_left": state.timeLeft,
        "letters_on_board": state.letters,
        "hints": hint_display,
        "mode": state.mode,
    })


@tool
def start_game() -> str:
    """Start a new game (press the GO button). Call this when the game phase is 'go'."""
    client = _get_client()
    result = client.start_game("1player")
    return json.dumps(result)


@tool
def find_words() -> str:
    """Search the board for words using path enumeration + dictionary lookup.
    Returns candidates matched against hints. Some hints may have exactly one candidate
    (safe to submit), others may be ambiguous (multiple possibilities), and some may
    have no candidates found. Call evaluate_and_submit to decide what to do with results."""
    client = _get_client()
    state = client.get_blind_state()

    if state.phase != "playing":
        return json.dumps({"error": f"Game is not in 'playing' phase (current: {state.phase})"})

    hint_matches = solve_blind(
        letters=state.letters,
        hints=state.hints,
        honeycomb_visible=state.honeycombVisible,
    )

    stats = get_stats()
    stats.solver_calls += 1
    total_candidates = sum(len(hm.candidates) for hm in hint_matches)
    stats.solver_candidates += total_candidates
    stats.emit()

    summary = format_for_llm(hint_matches, state.honeyLevel)
    return summary


@tool
def submit_safe_words() -> str:
    """Submit all words where the solver found exactly ONE candidate (100% certain).
    These are risk-free submissions. Returns what was submitted."""
    client = _get_client()
    state = client.get_blind_state()

    if state.phase != "playing":
        return json.dumps({"error": f"Game is not in 'playing' phase (current: {state.phase})"})

    hint_matches = solve_blind(
        letters=state.letters,
        hints=state.hints,
        honeycomb_visible=state.honeycombVisible,
    )

    safe = get_safe_submissions(hint_matches)

    if not safe:
        return json.dumps({"message": "No certain candidates to submit. Use submit_word_by_name to try ambiguous ones."})

    submitted = []
    stats = get_stats()
    for candidate in safe:
        result = client.submit_word(candidate.cells_1indexed)
        submitted.append({
            "word": candidate.word,
            "cells": candidate.cells_1indexed,
            "hint": candidate.hint_index + 1,
            "result": result.get("message", "ok"),
        })
        stats.words_submitted += 1
        stats.words_correct += 1
        time.sleep(0.3)

    stats.emit()

    return json.dumps({
        "submitted_count": len(submitted),
        "words": [s["word"] for s in submitted],
        "details": submitted,
    })


@tool
def submit_word_by_name(word: str) -> str:
    """Submit a specific word by name. Use this for ambiguous candidates where
    you've decided which word to try. The solver will find the cell path for you.
    If the word doesn't exist on the board, it will fail gracefully.

    Args:
        word: The word to submit (e.g. "BRAIN")
    """
    client = _get_client()
    state = client.get_blind_state()

    if state.phase != "playing":
        return json.dumps({"error": f"Game is not in 'playing' phase (current: {state.phase})"})

    hint_matches = solve_blind(
        letters=state.letters,
        hints=state.hints,
        honeycomb_visible=state.honeycombVisible,
    )

    # Find this word in candidates
    target = word.upper()
    stats = get_stats()
    for hm in hint_matches:
        for candidate in hm.candidates:
            if candidate.word == target:
                result = client.submit_word(candidate.cells_1indexed)
                stats.words_submitted += 1
                stats.emit()
                return json.dumps({
                    "word": candidate.word,
                    "cells": candidate.cells_1indexed,
                    "hint": candidate.hint_index + 1,
                    "result": result.get("message", "ok"),
                })

    return json.dumps({"error": f"Word '{target}' not found as a candidate on the current board"})


@tool
def wait_for_phase(target_phase: str, timeout_seconds: int = 30) -> str:
    """Wait until the game reaches a specific phase (e.g., 'playing', 'go', 'gameOver').
    Polls every 300ms. Returns the game state once the target phase is reached or timeout."""
    client = _get_client()
    start = time.time()

    while time.time() - start < timeout_seconds:
        state = client.get_blind_state()
        if state.phase == target_phase:
            return json.dumps({
                "reached": True,
                "phase": state.phase,
                "level": state.level,
                "score": state.score,
                "honey_level": state.honeyLevel,
            })
        time.sleep(POLL_INTERVAL)

    state = client.get_blind_state()
    return json.dumps({
        "reached": False,
        "current_phase": state.phase,
        "target_phase": target_phase,
        "message": f"Timeout after {timeout_seconds}s",
    })


@tool
def check_score() -> str:
    """Quick check of current score and honey level. Lightweight status check."""
    client = _get_client()
    state = client.get_blind_state()
    return json.dumps({
        "phase": state.phase,
        "level": state.level,
        "score": state.score,
        "honey_level": state.honeyLevel,
        "time_left": state.timeLeft,
    })


SYSTEM_PROMPT = """You are a WordSwarm game-playing agent operating in BLIND MODE.
You do NOT have access to the word list — you must figure out the words yourself, like a human player.

## How the game works:
- 17 hexagonal cells with letters arranged in a honeycomb
- You see hints for each word: first letter + word length (e.g., B____ = 5-letter word starting with B)
- Words are formed by tracing adjacency paths through the honeycomb
- Finding words restores honey; honey drains constantly
- Each level has 3 puzzles — solve all words in a puzzle to advance to the next puzzle
- After completing 3 puzzles, the level advances and honey drains faster
- When a puzzle is completed, the board reloads with new letters and new hints — keep solving
- Game over when honey reaches 0

## Your tools:
- **observe_game**: See board letters, hints, score, honey
- **start_game**: Press GO when phase is 'go'
- **find_words**: Run the path-enumeration solver to find candidate words matching hints
- **submit_safe_words**: Submit all candidates with 100% certainty (unique match to a hint)
- **submit_word_by_name**: Submit a specific word (for ambiguous cases where you pick one)
- **wait_for_phase**: Wait for game to reach a phase
- **check_score**: Quick status check

## Your strategy:
1. Observe the game state
2. If phase is 'go', start the game
3. If phase is 'playing', loop:
   a. Call find_words to enumerate candidates
   b. Call submit_safe_words to submit all certain matches
   c. For ambiguous hints, pick the most likely word and submit_word_by_name
   d. Call find_words again immediately — the board changes as cells vanish
   e. When all hints show SOLVED, a new puzzle loads automatically (same level, new letters) — just call find_words again
4. NEVER call wait_for_phase('levelComplete') — level transitions happen automatically and the phase returns to 'playing' within seconds. Just keep calling find_words in a loop.
5. Only use wait_for_phase when the game hasn't started yet (waiting for 'playing' after 'go')
6. Report final score on game over

## Important:
- ACT FAST — honey drains in real-time, every second counts
- Always submit safe words first for quick honey recovery
- For ambiguous hints, consider: common English words are more likely, shorter words are safer
- After each batch of submissions, immediately call find_words again — do NOT observe_game or wait_for_phase between puzzles
- When find_words shows all new hints (different letters/words), a new puzzle has loaded — just keep solving
- Do NOT wait for phase changes between puzzles — the phase stays 'playing' throughout
- Keep your reasoning brief to minimize latency
"""


def create_agent():
    """Create the LangGraph ReAct agent with blind-mode game-playing tools."""
    stats_handler = StatsCallbackHandler()

    llm = ChatOpenAI(
        base_url=_config.MODEL_URL,
        api_key=_config.MODEL_TOKEN,
        model=_config.MODEL_NAME,
        temperature=0.1,
        max_tokens=8192,
        streaming=True,
        stream_usage=True,
        callbacks=[stats_handler],
    )

    tools = [
        observe_game,
        start_game,
        find_words,
        submit_safe_words,
        submit_word_by_name,
        wait_for_phase,
        check_score,
    ]

    agent = create_react_agent(
        model=llm,
        tools=tools,
        prompt=SYSTEM_PROMPT,
    )

    return agent
