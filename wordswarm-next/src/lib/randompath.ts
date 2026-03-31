/*
 * Copyright (c) 2012, Intel Corporation.
 * Ported to TypeScript for Next.js
 *
 * Licensed under Apache License, version 2.0.
 */

// The wordswarm game board layout:
//     3    10
//  0     7    14
//     4    11
//  1     8    15
//     5    12
//  2     9    16
//     6    13

export const ADJ: number[][] = [
  [1, 4, 3],
  [0, 4, 5, 2],
  [1, 5, 6],
  [0, 4, 7],
  [0, 3, 7, 8, 5, 1],
  [1, 4, 8, 9, 6, 2],
  [2, 5, 9],
  [3, 10, 11, 8, 4],
  [4, 7, 11, 12, 9, 5],
  [5, 8, 12, 13, 6],
  [7, 11, 14],
  [7, 10, 14, 15, 12, 8],
  [8, 11, 15, 16, 13, 9],
  [9, 12, 16],
  [10, 11, 15],
  [14, 11, 12, 16],
  [13, 12, 15],
];

function nextMove(path: number[], idx: number): boolean {
  if (idx > 16) return true;

  const last = path[idx - 1];
  const adjfilter: number[] = [];

  for (let i = 0; i < ADJ[last].length; i++) {
    if (path.indexOf(ADJ[last][i]) < 0) {
      adjfilter.push(ADJ[last][i]);
    }
  }

  if (adjfilter.length <= 0) return false;

  const nextposs: number[] = [];
  const remaining = [...adjfilter];
  while (remaining.length > 0) {
    const n = Math.floor(Math.random() * remaining.length);
    nextposs.push(remaining.splice(n, 1)[0]);
  }

  for (let i = 0; i < nextposs.length; i++) {
    path[idx] = nextposs[i];
    if (nextMove(path, idx + 1)) return true;
  }

  path.splice(idx, 1);
  return false;
}

export function generatePath(): number[] {
  const n = Math.floor(Math.random() * 17);
  const path: number[] = [n];
  nextMove(path, 1);
  return path;
}
