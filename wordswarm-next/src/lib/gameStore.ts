/*
 * Multi-session game state store.
 * Each browser tab gets its own session via X-Session-Id header.
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

// Pending action queue: API writes here, client polls and executes
export interface GameAction {
  id: string;
  action: 'start' | 'submit_word';
  cells?: number[];
  mode?: '1player' | '2players';
}

// Selected model — set by dashboard, read by 2P auto-start
interface SelectedModel {
  id: string;
  url: string;
}

// Per-session data
interface SessionData {
  state: SharedGameState;
  pendingActions: GameAction[];
  actionCounter: number;
  selectedModel: SelectedModel | null;
  lastAccess: number; // Date.now()
}

// Session map — keyed by session ID
const _sessions = new Map<string, SessionData>();

// Session TTL: 30 minutes
const SESSION_TTL_MS = 30 * 60 * 1000;
// Cleanup interval: 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

function getOrCreateSession(sessionId: string): SessionData {
  let session = _sessions.get(sessionId);
  if (!session) {
    session = {
      state: { ...defaultState },
      pendingActions: [],
      actionCounter: 0,
      selectedModel: null,
      lastAccess: Date.now(),
    };
    _sessions.set(sessionId, session);
  } else {
    session.lastAccess = Date.now();
  }
  return session;
}

export function getGameState(sessionId: string): SharedGameState {
  const session = getOrCreateSession(sessionId);
  return { ...session.state };
}

export function updateGameState(sessionId: string, partial: Partial<SharedGameState>): void {
  const session = getOrCreateSession(sessionId);
  session.state = { ...session.state, ...partial };
}

export function resetGameState(sessionId: string): void {
  const session = getOrCreateSession(sessionId);
  session.state = { ...defaultState };
}

export function pushAction(sessionId: string, action: Omit<GameAction, 'id'>): string {
  const session = getOrCreateSession(sessionId);
  session.actionCounter++;
  const id = `action-${session.actionCounter}`;
  session.pendingActions.push({ ...action, id });
  return id;
}

export function popActions(sessionId: string): GameAction[] {
  const session = getOrCreateSession(sessionId);
  const actions = session.pendingActions;
  session.pendingActions = [];
  return actions;
}

export function setSelectedModel(sessionId: string, model: SelectedModel): void {
  const session = getOrCreateSession(sessionId);
  session.selectedModel = model;
}

export function getSelectedModel(sessionId: string): SelectedModel | null {
  const session = getOrCreateSession(sessionId);
  return session.selectedModel;
}

// Periodic cleanup of stale sessions
function cleanupSessions() {
  const now = Date.now();
  for (const [id, session] of _sessions) {
    if (now - session.lastAccess > SESSION_TTL_MS) {
      _sessions.delete(id);
    }
  }
}

// Start cleanup timer (runs in the Node.js process)
const _cleanupTimer = setInterval(cleanupSessions, CLEANUP_INTERVAL_MS);
// Don't prevent Node from exiting
if (_cleanupTimer.unref) _cleanupTimer.unref();
