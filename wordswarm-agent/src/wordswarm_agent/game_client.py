"""
HTTP client for the WordSwarm game API.
Communicates with the Next.js game server via REST endpoints.
"""

import httpx
from pydantic import BaseModel

from .config import GAME_URL, SESSION_ID


class GameState(BaseModel):
    """Current game state from the API."""
    phase: str
    level: int
    score: int
    honeyLevel: int  # noqa: N815
    timeLeft: int  # noqa: N815
    letters: list[str]
    wordList: list[dict]  # noqa: N815
    revealedWords: list[list[bool]]  # noqa: N815
    honeycombVisible: list[bool]  # noqa: N815
    mode: str
    playerId: int  # noqa: N815
    player1Score: int  # noqa: N815


class BlindGameState(BaseModel):
    """Blind game state — only what a human player can see."""
    phase: str
    level: int
    score: int
    honeyLevel: int  # noqa: N815
    timeLeft: int  # noqa: N815
    letters: list[str]
    honeycombVisible: list[bool]  # noqa: N815
    hints: list[dict]
    mode: str


class GameClient:
    """Synchronous HTTP client for the WordSwarm game API."""

    def __init__(self, base_url: str = GAME_URL, session_id: str = SESSION_ID):
        self.base_url = base_url.rstrip("/")
        self.client = httpx.Client(
            timeout=10.0,
            headers={"X-Session-Id": session_id},
        )

    def get_state(self) -> GameState:
        """Get current game state (full — used for non-blind mode)."""
        resp = self.client.get(f"{self.base_url}/api/game")
        resp.raise_for_status()
        return GameState(**resp.json())

    def get_blind_state(self) -> BlindGameState:
        """Get blind game state — only what a human can see."""
        resp = self.client.get(f"{self.base_url}/api/game/blind")
        resp.raise_for_status()
        return BlindGameState(**resp.json())

    def start_game(self, mode: str = "1player") -> dict:
        """Queue a start game action."""
        resp = self.client.post(
            f"{self.base_url}/api/game",
            json={"action": "start", "mode": mode},
        )
        resp.raise_for_status()
        return resp.json()

    def submit_word(self, cells: list[int]) -> dict:
        """
        Queue a word submission.

        Args:
            cells: 1-indexed cell numbers in drag order
        """
        resp = self.client.post(
            f"{self.base_url}/api/game",
            json={"action": "submit_word", "cells": cells},
        )
        resp.raise_for_status()
        return resp.json()

    def close(self):
        self.client.close()
