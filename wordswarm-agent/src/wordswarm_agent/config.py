"""Configuration for the WordSwarm agent."""

import os

# Game server
GAME_URL = os.environ.get("GAME_URL", "http://localhost:3000")

# Session ID — ties this agent to a specific browser tab's game session
SESSION_ID = os.environ.get("SESSION_ID", "default")

# LLM endpoint (OpenAI-compatible, common MaaS base url)
# Chat completions: {MODEL_URL}/chat/completions
# Model ids are full publisher paths, e.g. publishers/prelude-maas/models/glm-53-flash
MODEL_URL = os.environ.get(
    "MODEL_URL",
    "https://maas.apps.ocp.cloud.rhai-tmm.dev/v1",
)
MODEL_NAME = os.environ.get("MODEL_NAME", "publishers/prelude-maas/models/glm-53-flash")
MODEL_TOKEN = os.environ.get("MODEL_TOKEN", "")

# Some chat templates (e.g. GLM) enable thinking by default — disable for low latency
ENABLE_THINKING = os.environ.get("ENABLE_THINKING", "false").lower() in ("1", "true", "yes")

# Agent settings
POLL_INTERVAL = float(os.environ.get("POLL_INTERVAL", "0.3"))  # seconds
MAX_RETRIES = int(os.environ.get("MAX_RETRIES", "3"))
