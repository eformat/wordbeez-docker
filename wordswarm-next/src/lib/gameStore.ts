/*
 * Shared game state singleton.
 * GamePage.tsx syncs React state here; API routes read/write from here.
 * This runs server-side in the Node.js process.
 */

export interface WordObj {
  word: string;
  cells: number[];
}

export interface SharedGameState {
  phase: 'intro' | 'go' | 'playing' | 'levelComplete' | 'gameOver' | 'paused';
  level: number;
  score: number;
  honeyLevel: number;
  timeLeft: number;
  letters: string[];        // 17 elements, 0-indexed
  wordList: WordObj[];
  revealedWords: boolean[][];
  honeycombVisible: boolean[];
  mode: '1player' | '2players';
  playerId: number;
  player1Score: number;
}

const defaultState: SharedGameState = {
  phase: 'intro',
  level: 0,
  score: 0,
  honeyLevel: 200,
  timeLeft: 180,
  letters: Array(17).fill(' '),
  wordList: [],
  revealedWords: [],
  honeycombVisible: Array(17).fill(false),
  mode: '1player',
  playerId: 1,
  player1Score: 0,
};

// Module-level singleton — persists across requests in the same Node process
let _state: SharedGameState = { ...defaultState };

// Pending action queue: API writes here, client polls and executes
export interface GameAction {
  id: string;
  action: 'start' | 'submit_word';
  cells?: number[];
  mode?: '1player' | '2players';
}

let _pendingActions: GameAction[] = [];
let _actionCounter = 0;

export function getGameState(): SharedGameState {
  return { ..._state };
}

export function updateGameState(partial: Partial<SharedGameState>): void {
  _state = { ..._state, ...partial };
}

export function resetGameState(): void {
  _state = { ...defaultState };
}

export function pushAction(action: Omit<GameAction, 'id'>): string {
  _actionCounter++;
  const id = `action-${_actionCounter}`;
  _pendingActions.push({ ...action, id });
  return id;
}

export function popActions(): GameAction[] {
  const actions = _pendingActions;
  _pendingActions = [];
  return actions;
}

// Selected model — set by dashboard, read by 2P auto-start
interface SelectedModel {
  id: string;
  url: string;
}

let _selectedModel: SelectedModel | null = null;

export function setSelectedModel(model: SelectedModel): void {
  _selectedModel = model;
}

export function getSelectedModel(): SelectedModel | null {
  return _selectedModel;
}
