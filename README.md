# WordSwarm AI Demo

A honeycomb word game played by an AI agent. The original WordSwarm game (Intel Corp, 2012) has been migrated from Java/Tomcat to **React/Next.js**, and a **Python LangChain agent** plays it autonomously using LLMs served via vLLM on OpenShift AI.

The agent operates in **blind mode** — it does NOT have access to the word list. Like a human player, it can only see the letters on the board and hints (first letter + word length). It uses a hybrid approach: algorithmic path enumeration finds candidate words, and the LLM makes strategic decisions.

## Demo Screenshot

The dashboard shows the game on the left and the AI agent on the right with live stats:

```
+---------------------------+---------------------------+
|                           | AI Agent    [RUNNING]     |
|    WordSwarm Game         | MODEL: [kimi-k2-5     v]  |
|    (honeycomb grid)       |                           |
|                           | TTFT     Latency  LLM     |
|    17 hex cells with      | 1.1s     2.7s     Calls   |
|    letters, honey meter,  |                   11      |
|    word list hints        | Tokens   Tokens   Tokens  |
|                           | In:20.7k Out:1.2k /sec    |
|                           |                   63.9    |
|                           | Words    Solver   Total   |
|                           | Found:7  Runs:3   21.9k   |
|                           |                           |
|                           | [agent log output...]     |
+---------------------------+---------------------------+
```

## Architecture

```
Browser (dashboard)
  |
  |-- iframe: WordSwarm game (React, client-side)
  |     |
  |     |-- syncs state --> POST /api/game/sync
  |     |-- polls actions <-- POST /api/game {get_pending}
  |
  |-- Agent panel (React, client-side)
        |
        |-- POST /api/agent {start} --> spawns Python subprocess
        |-- GET /api/agent?since=N  --> polls logs + stats
        |-- GET /api/models         --> fetches available LLMs

Python Agent (subprocess)
  |
  |-- GET /api/game/blind     --> reads board state (no word list!)
  |-- POST /api/game          --> submits words via action queue
  |-- OpenAI-compatible API   --> LLM calls (vLLM / MaaS)
```

### Key Design Decisions

1. **Action queue pattern**: The agent can't directly manipulate the React DOM. Instead, it POSTs actions (start, submit_word) to a server-side queue. The game client polls every 200ms and executes actions as simulated drag sequences through the honeycomb cells.

2. **Shared state singleton**: `gameStore.ts` is a Node.js module-level singleton that bridges the React client (which syncs its state via POST) and the API routes (which the Python agent reads via GET). This avoids a database while keeping the game state accessible to both sides.

3. **Blind mode API**: `/api/game/blind` deliberately withholds the word list and cell positions. It returns only what a human player can see: the 17 letters, hints (first letter + word length + any revealed letters), score, honey level, and game phase.

4. **Token security**: The `MODEL_TOKEN` env var is read server-side only. The client never sees or sends the token — all LLM and MaaS API calls are proxied through Next.js API routes.

## The Solving Algorithm

The agent uses a **hybrid approach** that separates deterministic computation from LLM reasoning:

### Step 1: Path Enumeration (Deterministic)

The honeycomb is a fixed 17-node graph with known adjacency:

```
     3    10
  0     7    14
     4    11
  1     8    15
     5    12
  2     9    16
     6    13
```

Each cell connects to 3-6 neighbors. The adjacency list is hardcoded:

```python
ADJ = [
    [1, 4, 3],              # cell 0 connects to cells 1, 4, 3
    [0, 4, 5, 2],           # cell 1 connects to cells 0, 4, 5, 2
    [1, 5, 6],              # cell 2 ...
    [0, 4, 7],              # cell 3
    [0, 3, 7, 8, 5, 1],     # cell 4 (center-left, 6 neighbors)
    [1, 4, 8, 9, 6, 2],     # cell 5 (center, 6 neighbors)
    [2, 5, 9],              # cell 6
    [3, 10, 11, 8, 4],      # cell 7
    [4, 7, 11, 12, 9, 5],   # cell 8 (center, 6 neighbors)
    [5, 8, 12, 13, 6],      # cell 9
    [7, 11, 14],            # cell 10
    [7, 10, 14, 15, 12, 8], # cell 11 (center-right, 6 neighbors)
    [8, 11, 15, 16, 13, 9], # cell 12 (center, 6 neighbors)
    [9, 12, 16],            # cell 13
    [10, 11, 15],           # cell 14
    [14, 11, 12, 16],       # cell 15
    [13, 12, 15],           # cell 16
]
```

The solver runs a **DFS (depth-first search)** from every visible cell, exploring all valid adjacency paths of length 3 to 6 (the game's word length range). Each path visits each cell at most once. At each path length >= 3, it concatenates the letters along the path and checks if the resulting string exists in the dictionary.

```
For each visible cell as start:
    DFS(path=[start], word=letters[start]):
        if len(path) >= 3 and word in DICTIONARY:
            record word -> path
        if len(path) >= 6:
            return
        for neighbor in ADJ[last_cell]:
            if neighbor not visited and neighbor visible:
                DFS(path + [neighbor], word + letters[neighbor])
```

The dictionary is the same 1,677-word list used by the game engine (`words.json`). The solver loads it once at startup into a hash set for O(1) lookups.

**Performance**: ~4ms per board on commodity hardware. The 17-cell graph with max path length 6 produces a bounded search space — roughly 50,000-100,000 paths explored per board.

### Step 2: Hint Matching (Deterministic)

The game shows hints for each word: the first letter and the word length (e.g., `B____` means a 5-letter word starting with B). As letters are revealed by solving other words, more hint letters become visible.

The solver filters enumerated words against each unsolved hint:
- Word length must match
- First letter must match
- Any revealed letters must match at their positions

Results are classified:
- **Certain** (1 candidate matches a hint) — safe to submit
- **Ambiguous** (multiple candidates match) — needs LLM judgment
- **Unsolvable** (0 candidates) — no dictionary word found for this hint

### Step 3: LLM Strategy (kimi-k2-5 / selectable model)

The LLM receives the board state and solver results via tool calls:

```
Honey level: 150/200

Hint #1: T__ (3 letters) -> THE (certain, cells: [3, 7, 4])
Hint #2: B____ (5 letters) -> AMBIGUOUS: [BRAIN, BRINE]
Hint #3: R___ (4 letters) -> NO CANDIDATES FOUND

Summary: 1 certain, 1 ambiguous, 1 unsolvable
```

The LLM's role:
1. **Submit safe words first** — calls `submit_safe_words` for all certain matches (fast honey recovery)
2. **Resolve ambiguity** — for hints with multiple candidates, picks the most likely word based on commonality, letter patterns, and context
3. **Manage risk** — when honey is low, prioritizes shorter/safer words; when honey is high, may attempt riskier guesses
4. **React to board changes** — after submitting words, cells disappear from the board, changing adjacency paths. The solver re-runs to find new candidates
5. **Orchestrate game flow** — handles phase transitions (intro -> go -> playing -> levelComplete), waits between puzzles, continues across levels

### Why Hybrid?

| Approach | Pros | Cons |
|----------|------|------|
| **LLM only** | Simple | Too slow, can't trace hex paths, hallucinates words |
| **Algorithm only** | Fast, accurate | Can't handle ambiguity, no strategy |
| **Hybrid (this)** | Best of both — fast enumeration + intelligent decisions | More complex architecture |

The LLM never needs to understand hex adjacency or trace paths — that's handled by the O(ms) DFS solver. The LLM focuses on what it's good at: language understanding, word likelihood, and strategic decision-making.

## Project Structure

```
wordbeez-docker/
├── wordswarm-next/          # Next.js game + dashboard + API
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx              # Game page with viewport scaling
│   │   │   ├── layout.tsx            # Root layout
│   │   │   ├── globals.css           # Fonts (Oswald, Lato Black), animations
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx          # Split-screen dashboard SPA
│   │   │   │   └── layout.tsx        # Dashboard viewport lock
│   │   │   └── api/
│   │   │       ├── game/
│   │   │       │   ├── route.ts      # GET state, POST actions
│   │   │       │   ├── blind/route.ts # GET blind state (no word list)
│   │   │       │   └── sync/route.ts  # POST state sync from client
│   │   │       ├── agent/route.ts    # Start/stop agent, poll logs
│   │   │       └── models/route.ts   # Fetch available LLMs from MaaS
│   │   ├── components/
│   │   │   ├── GamePage.tsx          # Main game component (state, timer, input)
│   │   │   ├── Honeycomb.tsx         # Interactive hex grid
│   │   │   ├── MainMenu.tsx          # Start screen with animated bee
│   │   │   ├── WordList.tsx          # Word hints display
│   │   │   ├── HoneyMeter.tsx        # Honey level gauge
│   │   │   ├── Bees.tsx              # Animated bee rewards
│   │   │   └── HowToPlay.tsx         # Instructions screen
│   │   └── lib/
│   │       ├── gameEngine.ts         # Core game logic (puzzles, scoring, validation)
│   │       ├── randompath.ts         # Adjacency graph + Hamiltonian path generation
│   │       ├── gameStore.ts          # Server-side state singleton + action queue
│   │       ├── agentProcess.ts       # Python subprocess manager + stats parser
│   │       └── sounds.ts            # Audio manager
│   ├── Dockerfile                    # Multi-stage build (UBI9 Node.js images)
│   └── next.config.ts               # standalone output, devIndicators off
│
├── wordswarm-agent/          # Python LangChain agent
│   ├── src/wordswarm_agent/
│   │   ├── agent.py              # LangGraph ReAct agent + tool definitions
│   │   ├── blind_solver.py       # DFS path enumeration + dictionary matching
│   │   ├── graph.py              # Honeycomb adjacency matrix + path utilities
│   │   ├── solver.py             # Original (non-blind) solver (kept for reference)
│   │   ├── game_client.py        # HTTP client (full + blind game state)
│   │   ├── stats.py              # LLM call stats (TTFT, tokens, latency)
│   │   ├── config.py             # Environment variable config
│   │   ├── main.py               # Entry point with auto-restart loop
│   │   └── words.json            # Game dictionary (1,677 words)
│   ├── pyproject.toml
│   └── run.sh                    # Convenience launcher
│
└── wbee-1.0/                 # Original game (Intel Corp, 2012)
    ├── js/                       # jQuery game engine
    ├── css/                      # Original CSS with absolute positioning
    ├── images/                   # All game assets
    ├── data/words.json           # Dictionary
    └── index.html                # Original HTML
```

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.11+
- Access to an OpenAI-compatible LLM endpoint (vLLM, MaaS, etc.)

### 1. Set up the game

```bash
cd wordswarm-next
npm install
```

### 2. Set up the agent

```bash
cd wordswarm-agent
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

### 3. Run

```bash
# Set your LLM token
export MODEL_TOKEN="your-bearer-token-here"

# Start the game + dashboard
cd wordswarm-next
npm run dev
```

Open the dashboard at **http://localhost:3000/dashboard**

Select a model from the dropdown and click **START AGENT**.

### Playing the game manually

Open **http://localhost:3000** to play the game yourself. Click "1 PLAYER", then drag through adjacent honeycomb cells to form words.

## Docker Build

Uses Red Hat UBI9 Node.js images:

```bash
cd wordswarm-next
docker build -t wordswarm .
docker run -p 8080:8080 -e MODEL_TOKEN="your-token" wordswarm
```

- Build stage: `registry.access.redhat.com/ubi9/nodejs-20`
- Production stage: `registry.access.redhat.com/ubi9/nodejs-20-minimal`
- Runs as non-root user (UID 1001)
- Standalone output for minimal image size

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MODEL_TOKEN` | (required) | Bearer token for MaaS / vLLM API authentication |
| `MODEL_URL` | `https://maas.apps.ocp.cloud.rhai-tmm.dev/kimi-k25/kimi-k2-5/v1` | OpenAI-compatible LLM endpoint |
| `MODEL_NAME` | `kimi-k2-5` | Model identifier |
| `GAME_URL` | `http://localhost:3000` | Game server URL (for agent) |
| `PORT` | `3000` (dev) / `8080` (Docker) | Server port |
| `POLL_INTERVAL` | `0.3` | Agent polling interval in seconds |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/game` | GET | Full game state (letters, words, scores) |
| `/api/game` | POST | Submit actions: `start`, `submit_word`, `get_pending` |
| `/api/game/sync` | POST | Client syncs React state to server |
| `/api/game/blind` | GET | Blind state: letters + hints only (no word list) |
| `/api/agent` | GET | Agent status + logs (with `?since=N` for polling) |
| `/api/agent` | POST | Start/stop agent subprocess |
| `/api/models` | GET | Available LLMs from MaaS API |

## Dashboard Stats

The dashboard shows live metrics updated every 300ms:

| Stat | Description |
|------|-------------|
| **TTFT** | Time to first token from the LLM (measures inference startup latency) |
| **Latency** | Total LLM call duration (includes reasoning + generation) |
| **LLM Calls** | Number of LLM invocations since agent start |
| **Tokens In** | Total prompt tokens sent to the LLM |
| **Tokens Out** | Total completion tokens received |
| **Tokens/sec** | Output throughput (completion tokens / total latency) |
| **Words Found** | Words successfully submitted to the game |
| **Solver Runs** | Number of DFS path enumerations performed |
| **Total Tokens** | Combined input + output token count |

## Tech Stack

- **Frontend**: React 19, Next.js (App Router), TypeScript
- **Agent**: Python 3.11+, LangChain, LangGraph (ReAct pattern)
- **LLM**: Any OpenAI-compatible API (vLLM, MaaS, OpenAI)
- **Container**: Red Hat UBI9 Node.js images
- **Original game**: Intel Corp (2012), Apache License 2.0

## How the Game Works

WordSwarm is a timed word-finding game on a 17-cell honeycomb grid:

1. The game generates a **Hamiltonian path** through all 17 cells
2. Words from the dictionary are laid along consecutive segments of this path
3. Letters are placed on cells and the grid is revealed
4. Players drag through adjacent cells to spell words
5. Finding words restores honey; honey drains constantly over time
6. Complete 3 puzzles per level to advance
7. Each level increases the honey drain rate
8. Game over when honey reaches 0

The Hamiltonian path generation ensures every word can be traced through adjacent cells, and every cell is used by at least one word.

## License

Original WordSwarm game: Copyright (c) 2012, Intel Corporation. Apache License 2.0.
See `wbee-1.0/README.txt` for full license details.
