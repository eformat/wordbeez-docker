"""
Honeycomb graph adjacency and path utilities.
Mirrors the adjacency from randompath.ts exactly.

Board layout (0-indexed cell numbers):
     3    10
  0     7    14
     4    11
  1     8    15
     5    12
  2     9    16
     6    13
"""

ADJ: list[list[int]] = [
    [1, 4, 3],              # 0
    [0, 4, 5, 2],           # 1
    [1, 5, 6],              # 2
    [0, 4, 7],              # 3
    [0, 3, 7, 8, 5, 1],     # 4
    [1, 4, 8, 9, 6, 2],     # 5
    [2, 5, 9],              # 6
    [3, 10, 11, 8, 4],      # 7
    [4, 7, 11, 12, 9, 5],   # 8
    [5, 8, 12, 13, 6],      # 9
    [7, 11, 14],            # 10
    [7, 10, 14, 15, 12, 8], # 11
    [8, 11, 15, 16, 13, 9], # 12
    [9, 12, 16],            # 13
    [10, 11, 15],           # 14
    [14, 11, 12, 16],       # 15
    [13, 12, 15],           # 16
]


def are_adjacent(a: int, b: int) -> bool:
    """Check if two cells (0-indexed) are adjacent."""
    return b in ADJ[a]


def is_valid_path(cells: list[int]) -> bool:
    """Check if a sequence of 0-indexed cells forms a valid adjacency path."""
    for i in range(len(cells) - 1):
        if not are_adjacent(cells[i], cells[i + 1]):
            return False
    return True


def find_adjacency_order(cells: list[int]) -> list[int] | None:
    """
    Given a set of cells, find an ordering that forms a valid adjacency path.
    Uses backtracking DFS. Returns None if no valid ordering exists.
    """
    if len(cells) <= 1:
        return list(cells)

    cell_set = set(cells)

    def backtrack(path: list[int], remaining: set[int]) -> list[int] | None:
        if not remaining:
            return path
        last = path[-1]
        for neighbor in ADJ[last]:
            if neighbor in remaining:
                new_remaining = remaining - {neighbor}
                result = backtrack(path + [neighbor], new_remaining)
                if result is not None:
                    return result
        return None

    # Try starting from each cell
    for start in cells:
        result = backtrack([start], cell_set - {start})
        if result is not None:
            return result

    return None
