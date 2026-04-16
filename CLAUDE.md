# CLAUDE.md — WordSwarm AI Demo

This file provides context for AI assistants working on this codebase.

## Project Overview

WordSwarm is a honeycomb word game (originally Intel Corp, 2012) that has been:
1. Migrated from Java/Tomcat/jQuery to **React/Next.js/TypeScript**
2. Extended with a **Python LangChain agent** that plays the game autonomously
3. Wrapped in a **split-screen dashboard** showing game + agent + live stats

The agent operates in **blind mode** — it cannot see the word list. It enumerates adjacency paths through the honeycomb graph, matches them against a dictionary, and uses an LLM to handle ambiguous cases.

## Repository Structure

```
wordbeez-docker/
├── wordswarm-next/       # Next.js app (game + dashboard + API)
├── wordswarm-agent/      # Python LangChain agent
├── wbee-1.0/             # Original game (reference only, not served)
└── bin/                  # Legacy Docker/Tomcat config
```

## How to Run

```bash
export MODEL_TOKEN="your-bearer-token"
cd wordswarm-next && npm run dev
# Dashboard: http://localhost:3000/dashboard
# Game only: http://localhost:3000
```

The agent is spawned as a subprocess by the Next.js server when you click START AGENT on the dashboard. No separate process needed.

## Key Architectural Patterns

### Multi-Tenant Sessions

The game is multi-tenant — each browser tab gets its own isolated session (game state, action queue, agent process). Session isolation is implemented via:

- **Session ID**: Each dashboard tab generates a `crypto.randomUUID()` client-side on mount. This is passed to the game iframe via `?sessionId=` query param and to all API calls via `X-Session-Id` header.
- **Server stores**: `gameStore.ts` and `agentProcess.ts` use `Map<sessionId, SessionData>` instead of singletons. All exported functions take `sessionId` as their first parameter.
- **Python agent**: Receives `SESSION_ID` env var from `agentProcess.ts` on spawn, sends `X-Session-Id` header on all API calls via `httpx.Client` default headers.
- **Fallback**: If no `X-Session-Id` header is present, API routes fall back to session `"default"`.
- **Cleanup**: Stale sessions (idle > 30 min) are automatically cleaned up, including killing any running agent processes.

### Action Queue (Client <-> Agent Bridge)

The React game runs client-side. The Python agent runs server-side. They communicate through a per-session server-side action queue:

- **Client -> Server**: `POST /api/game/sync` pushes React state to `gameStore.ts` (keyed by session ID)
- **Agent -> Server**: `POST /api/game` pushes actions (`start`, `submit_word`) to the session's queue
- **Server -> Client**: Client polls `POST /api/game {get_pending}` every 200ms, executes actions as simulated drag sequences

This avoids WebSockets or direct DOM manipulation — the agent just queues cell sequences and the game client replays them.

### Blind Mode

`/api/game/blind` returns only what a human player sees:
- `letters[17]` — the characters on each cell
- `hints[]` — first letter + word length + any revealed letters per word
- `honeycombVisible[17]` — which cells are still showing
- Game metadata: phase, level, score, honeyLevel, timeLeft

It deliberately excludes `wordList` (the actual words and their cell positions).

### Stats Pipeline

1. Python `StatsCallbackHandler` (LangChain callback) captures TTFT, tokens, latency per LLM call
2. Agent tools emit `[STATS] {...}` JSON lines to stdout for solver/submission metrics
3. `agentProcess.ts` parses `[STATS]` lines, updates a stats object, filters them from visible logs
4. Dashboard polls stats alongside logs at 300ms intervals

### Token Security

`MODEL_TOKEN` is read from `process.env` in server-side API routes only:
- `/api/models` uses it to call MaaS API
- `/api/agent` POST passes it to the Python subprocess via env vars
- The client/browser never sees the token

## The Next.js App (`wordswarm-next/`)

### Pages
- `/` — Game page with viewport scaling (1024x600 scaled to fit)
- `/dashboard` — Split-screen: game iframe (left) + agent panel (right)

### API Routes
- `/api/game` — GET state, POST actions (start, submit_word, get_pending)
- `/api/game/sync` — POST state sync from React client
- `/api/game/blind` — GET blind state (no word list)
- `/api/agent` — GET status/logs, POST start/stop
- `/api/models` — GET available LLMs from MaaS API (server-side token)

### Core Libraries
- `gameEngine.ts` — Puzzle generation, word validation, scoring. Uses Hamiltonian path from `randompath.ts` to lay words across cells.
- `randompath.ts` — The 17-node adjacency graph (`ADJ` array) and `generatePath()` for Hamiltonian paths.
- `gameStore.ts` — Multi-session game state store. Uses `Map<sessionId, SessionData>` to isolate state per browser tab. Includes 30-min TTL cleanup.
- `agentProcess.ts` — Multi-session agent manager. Uses `Map<sessionId, AgentSession>` to run one Python agent per session. Passes `SESSION_ID` env var to subprocesses.
- `sessionId.ts` — Helper to extract `X-Session-Id` header from API requests (falls back to `"default"`).
- `sounds.ts` — Lazy-loading Audio wrapper for game sound effects.

### Components
- `GamePage.tsx` — Main game component. ~800 lines. Manages all game state, timer, mouse/touch input, word validation, state sync, action polling, settings dialog.
- `Honeycomb.tsx` — 17-cell hex grid with `data-cell` attributes for input.
- `MainMenu.tsx` — Animated bee wings, 1P/2P/HowTo buttons.
- `WordList.tsx` — Shows word hints: first letter always visible, other letters revealed as words are solved.

### Build
- `output: 'standalone'` in next.config.ts for Docker
- Dockerfile uses UBI9 Node.js images (build + minimal runtime)
- Runs as non-root user 1001 on port 8080

## The Python Agent (`wordswarm-agent/`)

### Entry Point
`main.py` — Loads config, verifies game server connectivity, creates the LangGraph agent, runs it in a loop. Auto-restarts with fresh context when the agent hits the step limit (200 steps per round). Only exits on game over or SIGTERM.

### Blind Solver (`blind_solver.py`)
The core algorithm:
1. DFS from every visible cell through the adjacency graph
2. Enumerate all paths of length 3-6 (no cell visited twice)
3. Concatenate letters along each path
4. Check if the string exists in the dictionary (hash set, O(1) lookup)
5. Match found words against hints (first letter + length + revealed letters)
6. Classify: certain (1 match), ambiguous (N matches), unsolvable (0 matches)

Runs in ~4ms per board. Dictionary is 1,677 words loaded from `words.json`.

### Agent (`agent.py`)
LangGraph ReAct agent with tools:
- `observe_game` — reads `/api/game/blind`
- `start_game` — queues a start action
- `find_words` — runs blind solver, returns formatted results for LLM
- `submit_safe_words` — submits all certain (1-candidate) matches
- `submit_word_by_name` — submits a specific word (for LLM ambiguity resolution)
- `wait_for_phase` — polls until game reaches target phase
- `check_score` — quick status check

### Stats (`stats.py`)
LangChain callback handler:
- `on_chat_model_start` — records start time
- `on_llm_new_token` — captures TTFT on first token
- `on_llm_end` — records latency, extracts token usage from response metadata
- Emits `[STATS]` JSON lines to stdout

### Graph (`graph.py`)
Mirrors the adjacency from `randompath.ts` exactly. Provides `are_adjacent()`, `is_valid_path()`, `find_adjacency_order()`.

### Game Client (`game_client.py`)
httpx-based HTTP client with Pydantic models:
- `GameState` — full state (for non-blind mode)
- `BlindGameState` — blind state
- `get_state()`, `get_blind_state()`, `start_game()`, `submit_word()`
- Sends `X-Session-Id` header on all requests (read from `SESSION_ID` env var via `config.py`)

## Dependencies

### Node.js (wordswarm-next)
- next, react, react-dom (App Router, React 19)
- TypeScript
- No other runtime dependencies — game engine is pure TypeScript

### Python (wordswarm-agent)
- langchain >= 0.3
- langchain-openai >= 0.3
- langgraph >= 0.3
- httpx >= 0.27
- pydantic >= 2.0

## Common Tasks

### Changing the LLM
Select from the dropdown in the dashboard. Models are fetched from the MaaS API at `/maas-api/v1/models`. The selected model's URL and ID are passed to the agent on start.

### Adding new agent tools
1. Add the `@tool` function in `agent.py`
2. Add it to the `tools` list in `create_agent()`
3. Document it in the `SYSTEM_PROMPT`

### Modifying the solver
`blind_solver.py` is self-contained. The key function is `_enumerate_paths()` which does the DFS. To change word length limits, adjust `min_len` and `max_len` parameters.

### Modifying the game
The game engine is in `gameEngine.ts`. Puzzle generation is in `buildPuzzle()`. The adjacency graph in `randompath.ts` must stay in sync with `graph.py` in the agent.

## Important Notes

- The adjacency graph in `randompath.ts` (TypeScript) and `graph.py` (Python) MUST be identical. If one changes, update the other.
- The game coordinate system is 0-indexed internally but the action queue uses 1-indexed cells (for the drag simulation).
- `gameStore.ts` and `agentProcess.ts` use in-memory Maps — they only work when the Next.js server runs in a single process (not in serverless/edge). Each browser tab gets its own session via `X-Session-Id` header.
- The agent's `recursion_limit` is 200 steps. When exceeded, `main.py` auto-restarts with a fresh context.
- kimi-k2-5 is a reasoning model — it consumes significant tokens on internal "thinking" before producing visible output. Set `max_tokens` to 8192+.
