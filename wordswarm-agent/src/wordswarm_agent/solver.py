"""
Deterministic puzzle solver for WordSwarm.

Given the game state (letters on board, word list, visible cells),
finds all solvable words and returns the cell sequences to submit them.
No LLM needed — this is pure graph traversal.
"""

from dataclasses import dataclass

from .graph import is_valid_path, find_adjacency_order


@dataclass
class Solution:
    """A solved word ready to submit."""
    word: str
    cells_0indexed: list[int]   # 0-indexed cell positions
    cells_1indexed: list[int]   # 1-indexed (what the game API expects for drag)
    word_index: int             # index in the wordList array
    priority: float             # lower = solve first


def solve_puzzle(
    letters: list[str],
    word_list: list[dict],
    honeycomb_visible: list[bool],
    revealed_words: list[list[bool]],
) -> list[Solution]:
    """
    Find all solvable words in the current puzzle.

    Args:
        letters: 17-element list of characters on the board (0-indexed)
        word_list: List of {"word": str, "cells": list[int]} from the game API
        honeycomb_visible: 17-element list of whether each cell is still showing
        revealed_words: For each word, which letters have been revealed

    Returns:
        List of Solutions sorted by priority (solve shortest words first)
    """
    solutions: list[Solution] = []

    for i, word_obj in enumerate(word_list):
        word: str = word_obj["word"]
        cells: list[int] = word_obj["cells"]  # 0-indexed

        # Skip already-revealed words
        if i < len(revealed_words) and revealed_words[i]:
            if all(revealed_words[i]):
                continue

        # Check all cells are still visible
        if not all(honeycomb_visible[c] for c in cells):
            continue

        # Verify the letters match (sanity check)
        reconstructed = "".join(letters[c] for c in cells)
        if reconstructed != word:
            continue

        # The cells from buildPuzzle follow the Hamiltonian path order,
        # so they should already be adjacency-connected. Verify this.
        if is_valid_path(cells):
            ordered_cells = cells
        else:
            # Fallback: find a valid adjacency ordering
            ordered_cells = find_adjacency_order(cells)
            if ordered_cells is None:
                continue
            # Verify the reordered cells still spell the word
            reordered_word = "".join(letters[c] for c in ordered_cells)
            if reordered_word != word:
                # The word has repeated letters or can't be reordered — skip
                continue

        # Convert to 1-indexed for the game's mouse event system
        cells_1indexed = [c + 1 for c in ordered_cells]

        solutions.append(Solution(
            word=word,
            cells_0indexed=ordered_cells,
            cells_1indexed=cells_1indexed,
            word_index=i,
            priority=len(word),  # shorter words first = faster honey recovery
        ))

    # Sort by priority (shortest words first for quick honey recovery)
    solutions.sort(key=lambda s: s.priority)
    return solutions
