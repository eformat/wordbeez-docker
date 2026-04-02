/*
 * Leaderboard persistence layer.
 * Stores high scores for human players and AI agent runs in a JSON file.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  level: number;
  date: string;
  type: 'human' | 'agent';
  // Agent-specific stats (optional)
  modelName?: string;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  llmCalls?: number;
  avgLatencyMs?: number;
  lastTtftMs?: number;
  tokensPerSec?: number;
  wordsSubmitted?: number;
  wordsCorrect?: number;
  solverCalls?: number;
  solverCandidates?: number;
  totalLatencyMs?: number;
}

function getFilePath(): string {
  if (process.env.LEADERBOARD_PATH) {
    return process.env.LEADERBOARD_PATH;
  }
  if (process.env.NODE_ENV === 'production') {
    return '/data/leaderboard.json';
  }
  return path.join(process.cwd(), 'data', 'leaderboard.json');
}

export function loadLeaderboard(): LeaderboardEntry[] {
  const filePath = getFilePath();
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLeaderboard(entries: LeaderboardEntry[]): void {
  const filePath = getFilePath();
  const dir = path.dirname(filePath);
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(entries, null, 2));
  } catch (e) {
    console.error('Failed to save leaderboard:', e);
  }
}

export function addEntry(entry: Omit<LeaderboardEntry, 'id'>): LeaderboardEntry {
  const entries = loadLeaderboard();
  const newEntry: LeaderboardEntry = {
    ...entry,
    id: crypto.randomUUID(),
  };
  entries.push(newEntry);
  entries.sort((a, b) => b.score - a.score);
  const trimmed = entries.slice(0, 1000);
  saveLeaderboard(trimmed);
  return newEntry;
}

export function getTopEntries(limit: number = 50): LeaderboardEntry[] {
  const entries = loadLeaderboard();
  entries.sort((a, b) => b.score - a.score);
  return entries.slice(0, limit);
}
