"""Configuration for the WordSwarm agent."""

import os

# Game server
GAME_URL = os.environ.get("GAME_URL", "http://localhost:3000")

# Session ID — ties this agent to a specific browser tab's game session
SESSION_ID = os.environ.get("SESSION_ID", "default")

# LLM endpoint (OpenAI-compatible, e.g. vLLM serving kimi-k2-6)
MODEL_URL = os.environ.get(
    "MODEL_URL",
    "https://maas.apps.ocp.cloud.rhai-tmm.dev/prelude-maas/kimi-k2-6/v1",
)
MODEL_NAME = os.environ.get("MODEL_NAME", "kimi-k2-6")
MODEL_TOKEN = os.environ.get("MODEL_TOKEN", "")

# Agent settings
POLL_INTERVAL = float(os.environ.get("POLL_INTERVAL", "0.3"))  # seconds
MAX_RETRIES = int(os.environ.get("MAX_RETRIES", "3"))
