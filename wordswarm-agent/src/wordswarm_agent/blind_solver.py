"""
Blind puzzle solver for WordSwarm.

The agent does NOT get the word list — only the 17 letters on the board
and hints (first letter + word length per word).

Algorithm:
1. DFS enumerate all valid adjacency paths of length 3..6 through visible cells
2. Form candidate words from each path's letters
3. Filter candidates against the game dictionary (words.json)
4. Match candidates to hints (first letter + length)
5. Return candidates grouped by which hint they satisfy

This is the "honest" solver — no cheating with the word list.
"""

import json
from dataclasses import dataclass, field
from pathlib import Path

from .graph import ADJ

# Load dictionary once at import time
_DICT_PATH = Path(__file__).parent / "words.json"
with open(_DICT_PATH) as f:
    _DICTIONARY: set[str] = set(word.upper() for word in json.load(f))


@dataclass
class Candidate:
    """A candidate word found by blind enumeration."""
    word: str
    cells_0indexed: list[int]
    cells_1indexed: list[int]
    hint_index: int          # which hint this matches (-1 if unmatched)
    confidence: float        # 1.0 if unique match to hint, lower if ambiguous


@dataclass
class HintMatch:
    """All candidates matching a specific hint."""
    hint_index: int
    first_letter: str
    length: int
    solved: bool
    candidates: list[Candidate] = field(default_factory=list)


def _enumerate_paths(
    letters: list[str],
    visible: list[bool],
    min_len: int = 3,
    max_len: int = 6,
) -> dict[str, list[list[int]]]:
    """
    DFS enumerate all valid adjacency paths through visible cells.
    Returns dict mapping word -> list of cell paths that spell it.
    """
    word_paths: dict[str, list[list[int]]] = {}

    def dfs(path: list[int], word_so_far: str):
        if len(path) >= min_len:
            if word_so_far in _DICTIONARY:
                if word_so_far not in word_paths:
                    word_paths[word_so_far] = []
                word_paths[word_so_far].append(list(path))

        if len(path) >= max_len:
            return

        last = path[-1]
        for neighbor in ADJ[last]:
            if neighbor not in path and visible[neighbor]:
                path.append(neighbor)
                dfs(path, word_so_far + letters[neighbor])
                path.pop()

    # Start DFS from every visible cell
    for start in range(len(letters)):
        if visible[start]:
            dfs([start], letters[start])

    return word_paths


def solve_blind(
    letters: list[str],
    hints: list[dict],
    honeycomb_visible: list[bool],
) -> list[HintMatch]:
    """
    Find candidate words without access to the word list.

    Args:
        letters: 17-element list of uppercase characters on the board
        hints: List of {"firstLetter": str, "length": int, "solved": bool, "revealedLetters": list}
        honeycomb_visible: 17-element list of whether each cell is visible

    Returns:
        List of HintMatch objects, one per unsolved hint, with candidate words
    """
    # Enumerate all dictionary words findable on the board
    word_paths = _enumerate_paths(letters, honeycomb_visible)

    # Build hint matchers
    hint_matches: list[HintMatch] = []
    for i, hint in enumerate(hints):
        if hint.get("solved", False):
            continue

        first_letter = hint["firstLetter"].upper()
        length = hint["length"]
        revealed = hint.get("revealedLetters", [])

        hm = HintMatch(
            hint_index=i,
            first_letter=first_letter,
            length=length,
            solved=False,
        )

        # Find all enumerated words matching this hint
        for word, paths in word_paths.items():
            if len(word) != length:
                continue
            if word[0] != first_letter:
                continue

            # Check against revealed letters (if any beyond the first)
            match = True
            for j, rev in enumerate(revealed):
                if rev is not None and j < len(word):
                    if word[j] != rev.upper():
                        match = False
                        break
            if not match:
                continue

            # Use the first valid path found
            cells = paths[0]
            cells_1indexed = [c + 1 for c in cells]

            hm.candidates.append(Candidate(
                word=word,
                cells_0indexed=cells,
                cells_1indexed=cells_1indexed,
                hint_index=i,
                confidence=0.0,  # will be set below
            ))

        # Set confidence based on number of candidates
        if len(hm.candidates) == 1:
            hm.candidates[0].confidence = 1.0
        elif len(hm.candidates) > 1:
            for c in hm.candidates:
                c.confidence = 1.0 / len(hm.candidates)

        hint_matches.append(hm)

    return hint_matches


def get_safe_submissions(hint_matches: list[HintMatch]) -> list[Candidate]:
    """
    Return candidates that are safe to submit (confidence == 1.0).
    These are hints with exactly one matching candidate.
    """
    safe = []
    for hm in hint_matches:
        if len(hm.candidates) == 1:
            safe.append(hm.candidates[0])
    return safe


def format_for_llm(hint_matches: list[HintMatch], honey_level: int) -> str:
    """
    Format the solver results for the LLM to make strategic decisions.
    """
    lines = [f"Honey level: {honey_level}/200"]
    lines.append("")

    safe_count = 0
    ambiguous_count = 0
    unsolvable_count = 0

    for hm in hint_matches:
        prefix = f"Hint #{hm.hint_index + 1}: {hm.first_letter}{'_' * (hm.length - 1)} ({hm.length} letters)"
        if len(hm.candidates) == 0:
            lines.append(f"{prefix} → NO CANDIDATES FOUND")
            unsolvable_count += 1
        elif len(hm.candidates) == 1:
            c = hm.candidates[0]
            lines.append(f"{prefix} → {c.word} (certain, cells: {c.cells_1indexed})")
            safe_count += 1
        else:
            words = ", ".join(c.word for c in hm.candidates)
            lines.append(f"{prefix} → AMBIGUOUS: [{words}]")
            ambiguous_count += 1

    lines.append("")
    lines.append(f"Summary: {safe_count} certain, {ambiguous_count} ambiguous, {unsolvable_count} unsolvable")

    return "\n".join(lines)
