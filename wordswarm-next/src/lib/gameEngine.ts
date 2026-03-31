/*
 * Core game engine - ported from game.js
 * Manages word puzzles, scoring, honey level, and game state
 */

import { generatePath, ADJ } from './randompath';

export interface WordObject {
  word: string;
  cells: number[];
}

export interface GameState {
  level: number;
  score: number;
  honeyLevel: number;
  timeLeft: number;
  letters: string[];
  wordList: WordObject[];
  revealedWords: boolean[][];
  honeycombVisible: boolean[];
  honeycombSelected: boolean[];
  showWrongGuess: boolean;
  showLevelCompleted: boolean;
  showBees: boolean;
  puzzlesCompleted: number;
  phase: 'go' | 'playing' | 'levelComplete' | 'gameOver';
}

const NUM_CHARS = 17;
const TIME_LIMIT = 180;
const MAX_HONEY = 200;

export function createInitialState(): GameState {
  return {
    level: 0,
    score: 0,
    honeyLevel: MAX_HONEY,
    timeLeft: TIME_LIMIT,
    letters: Array(NUM_CHARS).fill(' '),
    wordList: [],
    revealedWords: [],
    honeycombVisible: Array(NUM_CHARS).fill(false),
    honeycombSelected: Array(NUM_CHARS).fill(false),
    showWrongGuess: false,
    showLevelCompleted: false,
    showBees: false,
    puzzlesCompleted: 0,
    phase: 'go',
  };
}

function nextWord(wordsDataList: string[], wordsUsed: Set<number>): string {
  let attempts = 0;
  while (attempts < 10000) {
    const i = Math.floor(Math.random() * wordsDataList.length);
    if (!wordsUsed.has(i) && wordsDataList[i].length <= 6) {
      wordsUsed.add(i);
      return wordsDataList[i];
    }
    attempts++;
  }
  return 'bee';
}

export function buildPuzzle(wordsDataList: string[], wordsUsed: Set<number>): {
  letters: string[];
  wordList: WordObject[];
  honeycombVisible: boolean[];
  randomPath: number[];
} {
  const randomPath = generatePath();
  let nChars = NUM_CHARS;
  const wordList: WordObject[] = [];
  let allChars = '';
  let n = 0;

  while (nChars !== 0) {
    const word = nextWord(wordsDataList, wordsUsed).toUpperCase();
    const len = word.length;
    if (len === nChars || len < nChars - 2) {
      allChars += word;
      const cells: number[] = [];
      for (let i = 0; i < len; i++) {
        cells.push(randomPath[n]);
        n++;
      }
      wordList.push({ word, cells });
      nChars -= len;
    }
  }

  const letters: string[] = Array(NUM_CHARS).fill(' ');
  const honeycombVisible: boolean[] = Array(NUM_CHARS).fill(false);
  for (let i = 0; i < randomPath.length; i++) {
    letters[randomPath[i]] = allChars.charAt(i);
    honeycombVisible[randomPath[i]] = true;
  }

  return { letters, wordList, honeycombVisible, randomPath };
}

export function validateMove(
  moves: number[],
  element: number
): { valid: boolean; newMoves: number[]; unselect: number[] } {
  const unselect: number[] = [];

  if (moves.length > 0) {
    const lastMove = moves[moves.length - 1];
    const adj = ADJ[lastMove - 1];
    if (adj.indexOf(element - 1) === -1) {
      return { valid: false, newMoves: moves, unselect };
    }
  }

  const newMoves = [...moves];
  for (let i = 0; i < newMoves.length; i++) {
    if (element === newMoves[i]) {
      if (i + 1 < newMoves.length) {
        const removed = newMoves.splice(i + 1);
        return { valid: true, newMoves, unselect: removed };
      }
    }
  }
  newMoves.push(element);
  return { valid: true, newMoves, unselect };
}

export function isPathValid(wordCells: number[], selectedCells: number[]): boolean {
  if (wordCells.length !== selectedCells.length) return false;
  for (let i = 0; i < selectedCells.length; i++) {
    let match = false;
    for (let j = 0; j < wordCells.length; j++) {
      if (selectedCells[i] - 1 === wordCells[j]) {
        match = true;
        break;
      }
    }
    if (!match) return false;
  }
  return true;
}

export function validateSelectedWord(
  cells: number[],
  letters: string[],
  wordList: WordObject[]
): { matched: boolean; wordIndex: number; score: number } {
  let w = '';
  for (let i = 0; i < cells.length; i++) {
    w += letters[cells[i] - 1];
  }

  for (let i = 0; i < wordList.length; i++) {
    if (w === wordList[i].word) {
      if (!isPathValid(wordList[i].cells, cells)) {
        return { matched: false, wordIndex: -1, score: 0 };
      }
      return { matched: true, wordIndex: i, score: w.length };
    }
  }
  return { matched: false, wordIndex: -1, score: 0 };
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Honeycomb grid layout: maps cell index to (row, col) for CSS positioning
// row 1-7 (odd columns), col 1-5
export function getCellPosition(cellIndex: number): { row: number; col: number } {
  const positions: { row: number; col: number }[] = [
    { row: 1, col: 1 }, // 0
    { row: 3, col: 1 }, // 1
    { row: 5, col: 1 }, // 2
    { row: 2, col: 2 }, // 3
    { row: 4, col: 2 }, // 4  (was row 2, should be row 4? Let me check original)
    { row: 6, col: 2 }, // 5
    { row: 8, col: 2 }, // 6 (this doesn't exist - let me re-derive)
  ];
  // Actually let me re-derive from the original code.
  // The original creates cells in a double loop:
  // for j=1..5, for i=1..7:
  //   if (i%2!=0 && j%2==0) || (i%2==0 && j%2!=0) => create cell
  // So cell h gets row=i, col=j

  // Let me enumerate:
  const cells: { row: number; col: number }[] = [];
  for (let j = 1; j < 6; j++) {
    for (let i = 1; i < 8; i++) {
      if ((i % 2 !== 0 && j % 2 === 0) || (i % 2 === 0 && j % 2 !== 0)) {
        cells.push({ row: i, col: j });
      }
    }
  }
  return cells[cellIndex] || { row: 1, col: 1 };
}

// Generate all 17 cell positions
export function getAllCellPositions(): { row: number; col: number }[] {
  const cells: { row: number; col: number }[] = [];
  for (let j = 1; j < 6; j++) {
    for (let i = 1; i < 8; i++) {
      if ((i % 2 !== 0 && j % 2 === 0) || (i % 2 === 0 && j % 2 !== 0)) {
        cells.push({ row: i, col: j });
      }
    }
  }
  return cells;
}
