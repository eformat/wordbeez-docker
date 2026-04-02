#!/bin/bash
# Run the WordSwarm AI agent
#
# Prerequisites:
#   1. Start the game:    cd ../wordswarm-next && npm run dev
#   2. Open browser to:   http://localhost:3000
#   3. Click "1 PLAYER" to get to the GO screen
#   4. Run this script:   ./run.sh

export GAME_URL="${GAME_URL:-http://localhost:3000}"
export MODEL_URL="${MODEL_URL:-https://maas.apps.ocp.cloud.rhai-tmm.dev/kimi-k25/kimi-k2-5/v1}"
export MODEL_NAME="${MODEL_NAME:-kimi-k2-5}"
if [ -z "$MODEL_TOKEN" ]; then
    echo "ERROR: MODEL_TOKEN env var is required"
    echo "  export MODEL_TOKEN='your-bearer-token'"
    exit 1
fi

source .venv/bin/activate 2>/dev/null || {
    echo "Creating virtual environment..."
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -e .
}

exec python -m wordswarm_agent.main
