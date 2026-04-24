"""
Entry point for the WordSwarm agent.

Usage:
    # Set environment variables first:
    export MODEL_TOKEN="your-token-here"
    export MODEL_URL="https://maas.apps.ocp.cloud.rhai-tmm.dev/prelude-maas/kimi-k2-6/v1"
    export MODEL_NAME="kimi-k2-6"
    export GAME_URL="http://localhost:3000"

    # Run the agent:
    wordswarm-agent
    # or:
    python -m wordswarm_agent.main
"""

import sys

import httpx

from .agent import create_agent


def main():
    # Load config
    from . import config as cfg

    print("=" * 60)
    print("  WordSwarm AI Agent")
    print(f"  Using LangChain + {cfg.MODEL_NAME} via OpenAI-compatible API")
    print("=" * 60)
    print()

    if not cfg.MODEL_TOKEN:
        print("ERROR: MODEL_TOKEN environment variable is required")
        print("  export MODEL_TOKEN='your-bearer-token'")
        sys.exit(1)

    print(f"  Game server:  {cfg.GAME_URL}")
    print(f"  LLM endpoint: {cfg.MODEL_URL}")
    print(f"  Model:        {cfg.MODEL_NAME}")
    print()

    # Discover actual model name from vLLM endpoint
    # vLLM serves models with their own internal name (e.g., "RedHatAI/llama-3.2-3b-instruct")
    # which may differ from the MaaS API id (e.g., "llama-32-3b")
    try:
        resp = httpx.get(
            f"{cfg.MODEL_URL}/models",
            headers={"Authorization": f"Bearer {cfg.MODEL_TOKEN}"},
            timeout=10,
        )
        resp.raise_for_status()
        models_data = resp.json().get("data", [])
        if models_data:
            served_name = models_data[0].get("id", cfg.MODEL_NAME)
            if served_name != cfg.MODEL_NAME:
                print(f"  Discovered served model name: {served_name}")
                cfg.MODEL_NAME = served_name
    except Exception as e:
        print(f"  Warning: Could not discover model name from endpoint: {e}")
        print(f"  Using configured name: {cfg.MODEL_NAME}")
    print()

    # Wait for game server to be reachable (retries for container startup)
    import time
    from .game_client import GameClient
    max_attempts = 30
    for attempt in range(1, max_attempts + 1):
        try:
            client = GameClient()
            state = client.get_state()
            print(f"  Game state:   phase={state.phase}, level={state.level}")
            client.close()
            break
        except Exception as e:
            if attempt == max_attempts:
                print(f"ERROR: Cannot connect to game server at {cfg.GAME_URL}")
                print(f"  {e}")
                sys.exit(1)
            print(f"  Waiting for game server... (attempt {attempt}/{max_attempts})")
            time.sleep(2)

    # Check current phase to give the agent the right starting instruction
    try:
        client = GameClient()
        state = client.get_blind_state()
        current_phase = state.phase
        client.close()
    except Exception:
        current_phase = "unknown"

    print()
    print("Starting agent... (press Ctrl+C to stop)")
    print("-" * 60)

    agent = create_agent()

    if current_phase == "playing":
        initial_message = (
            "The game is already playing! Call find_words immediately to find words on the board. "
            "Then call submit_safe_words to submit certain matches. Keep looping: find_words → submit_safe_words → find_words. "
            "Do NOT call observe_game or wait_for_phase — just find and submit words as fast as possible."
        )
    elif current_phase == "go":
        initial_message = (
            "The game is ready to start. Call start_game now, then immediately call find_words. "
            "Keep looping: find_words → submit_safe_words → find_words. Act fast, honey is draining."
        )
    else:
        initial_message = (
            "Observe the game state with observe_game. If phase is 'go', call start_game. "
            "If phase is 'playing', call find_words immediately. "
            "Keep looping: find_words → submit_safe_words → find_words."
        )

    continue_message = (
        "Continue playing! Call find_words immediately and keep solving. "
        "Do not observe or wait — just find and submit words as fast as possible."
    )

    messages = [{"role": "user", "content": initial_message}]
    round_num = 0

    try:
        while True:
            round_num += 1
            if round_num > 1:
                print()
                print(f"--- Agent round {round_num} (continuing) ---")

            last_ai_content = ""

            for event in agent.stream(
                {"messages": messages},
                config={"recursion_limit": 200},
                stream_mode="updates",
            ):
                for node_name, node_output in event.items():
                    msgs = node_output.get("messages", [])
                    for msg in msgs:
                        msg_type = getattr(msg, "type", "")

                        if msg_type == "ai":
                            # AI message — may contain text and/or tool calls
                            if msg.content:
                                # Filter out thinking/reasoning blocks
                                content = msg.content
                                if isinstance(content, list):
                                    # Some models return list of content blocks
                                    text_parts = []
                                    for block in content:
                                        if isinstance(block, dict) and block.get("type") == "text":
                                            text_parts.append(block["text"])
                                        elif isinstance(block, str):
                                            text_parts.append(block)
                                    content = "\n".join(text_parts)
                                if content.strip():
                                    print(f"[ai] {content}", flush=True)
                                    last_ai_content = content.lower()

                            # Log tool calls
                            tool_calls = getattr(msg, "tool_calls", None)
                            if tool_calls:
                                for tc in tool_calls:
                                    args_str = ", ".join(f"{k}={v}" for k, v in tc["args"].items()) if tc["args"] else ""
                                    print(f"[tool] {tc['name']}({args_str})", flush=True)

                        elif msg_type == "tool":
                            # Tool result — print a summary (truncated if long)
                            content = msg.content if isinstance(msg.content, str) else str(msg.content)
                            tool_name = getattr(msg, "name", "tool")
                            if len(content) > 300:
                                print(f"[{tool_name}] {content[:300]}...", flush=True)
                            else:
                                print(f"[{tool_name}] {content}", flush=True)

            # Check if game is over
            if "game over" in last_ai_content or "gameover" in last_ai_content:
                print()
                print("=" * 60)
                print("  Game Over — Agent finished")
                print("=" * 60)
                break

            # Agent ran out of steps but game isn't over — restart with fresh context
            print("Agent reached step limit, restarting with fresh context...")
            messages = [{"role": "user", "content": continue_message}]

    except KeyboardInterrupt:
        print("\n\nAgent stopped by user.")
    except Exception as e:
        print(f"\nAgent error: {e}")
        raise


if __name__ == "__main__":
    main()
