"""Configuration for the WordSwarm agent."""

import os

# Game server
GAME_URL = os.environ.get("GAME_URL", "http://localhost:3000")

# LLM endpoint (OpenAI-compatible, e.g. vLLM serving kimi-k2-5)
MODEL_URL = os.environ.get(
    "MODEL_URL",
    "https://maas.apps.ocp.cloud.rhai-tmm.dev/kimi-k25/kimi-k2-5/v1",
)
MODEL_NAME = os.environ.get("MODEL_NAME", "kimi-k2-5")
MODEL_TOKEN = os.environ.get("MODEL_TOKEN", "")

# Agent settings
POLL_INTERVAL = float(os.environ.get("POLL_INTERVAL", "0.3"))  # seconds
MAX_RETRIES = int(os.environ.get("MAX_RETRIES", "3"))
