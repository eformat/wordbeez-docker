/*
 * Manages Python WordSwarm agent processes — one per session.
 * Each browser tab (session) gets its own agent subprocess.
 */

import { spawn, ChildProcess, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { addEntry } from './leaderboard';
import { getGameState } from './gameStore';

interface AgentStats {
  llm_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_reasoning_tokens: number;
  total_latency_ms: number;
  words_submitted: number;
  words_correct: number;
  puzzles_solved: number;
  solver_calls: number;
  solver_candidates: number;
  last_ttft_ms: number;
  last_latency_ms: number;
  last_input_tokens: number;
  last_output_tokens: number;
  last_reasoning_tokens: number;
  avg_latency_ms: number;
}

interface AgentState {
  running: boolean;
  logs: string[];
  startedAt: string | null;
  pid: number | null;
  stats: AgentStats;
}

const EMPTY_STATS: AgentStats = {
  llm_calls: 0,
  total_input_tokens: 0,
  total_output_tokens: 0,
  total_reasoning_tokens: 0,
  total_latency_ms: 0,
  words_submitted: 0,
  words_correct: 0,
  puzzles_solved: 0,
  solver_calls: 0,
  solver_candidates: 0,
  last_ttft_ms: 0,
  last_latency_ms: 0,
  last_input_tokens: 0,
  last_output_tokens: 0,
  last_reasoning_tokens: 0,
  avg_latency_ms: 0,
};

const MAX_LOGS = 500;

// Per-session agent data
interface AgentSession {
  process: ChildProcess | null;
  logs: string[];
  logCounter: number;
  startedAt: string | null;
  stats: AgentStats;
  modelName: string;
  scoreSaved: boolean;
}

// Session map — keyed by session ID
const _sessions = new Map<string, AgentSession>();

function getOrCreateSession(sessionId: string): AgentSession {
  let session = _sessions.get(sessionId);
  if (!session) {
    session = {
      process: null,
      logs: [],
      logCounter: 0,
      startedAt: null,
      stats: { ...EMPTY_STATS },
      modelName: '',
      scoreSaved: false,
    };
    _sessions.set(sessionId, session);
  }
  return session;
}

function addLog(session: AgentSession, line: string) {
  // Parse [STATS] lines — update stats but don't add to visible logs
  if (line.startsWith('[STATS] ')) {
    try {
      const payload = JSON.parse(line.slice(8));
      session.stats = { ...EMPTY_STATS, ...payload };
    } catch {}
    return;
  }

  session.logCounter++;
  const timestamp = new Date().toISOString().slice(11, 19);
  session.logs.push(`[${timestamp}] ${line}`);
  if (session.logs.length > MAX_LOGS) {
    session.logs = session.logs.slice(-MAX_LOGS);
  }
}

export function getAgentState(sessionId: string): AgentState {
  const session = getOrCreateSession(sessionId);
  return {
    running: session.process !== null && session.process.exitCode === null,
    logs: [...session.logs],
    startedAt: session.startedAt,
    pid: session.process?.pid ?? null,
    stats: { ...session.stats },
  };
}

export function getLogsSince(sessionId: string, fromIndex: number): { logs: string[]; nextIndex: number; stats: AgentStats; running: boolean } {
  const session = getOrCreateSession(sessionId);
  const oldestAbsolute = session.logCounter - session.logs.length;
  let arrayOffset: number;
  if (fromIndex <= oldestAbsolute) {
    arrayOffset = 0;
  } else {
    arrayOffset = fromIndex - oldestAbsolute;
  }
  const newLogs = session.logs.slice(arrayOffset);
  return {
    logs: newLogs,
    nextIndex: session.logCounter,
    stats: { ...session.stats },
    running: session.process !== null && session.process.exitCode === null,
  };
}

export function startAgent(sessionId: string, env: Record<string, string>): { ok: boolean; message: string } {
  const session = getOrCreateSession(sessionId);

  if (session.process !== null && session.process.exitCode === null) {
    // Verify the process is actually alive
    try {
      process.kill(session.process.pid!, 0);
      return { ok: false, message: 'Agent is already running' };
    } catch {
      session.process = null;
    }
  }
  // Clean up stale reference
  if (session.process !== null && session.process.exitCode !== null) {
    session.process = null;
  }

  session.logs = [];
  session.logCounter = 0;
  session.stats = { ...EMPTY_STATS };
  session.startedAt = new Date().toISOString();
  session.modelName = env.MODEL_NAME || '';
  session.scoreSaved = false;

  addLog(session, 'Starting WordSwarm agent...');

  // Detect environment: local dev (.venv) vs container (pip-installed wordswarm-agent)
  const agentDir = path.resolve(process.cwd(), '..', 'wordswarm-agent');
  const venvPython = path.join(agentDir, '.venv', 'bin', 'python');
  const hasVenv = fs.existsSync(venvPython);

  // Find a working Python with wordswarm_agent installed
  let systemPython = '';
  if (!hasVenv) {
    for (const py of ['python3.12', 'python3', 'python']) {
      try {
        execSync(`${py} -c "import wordswarm_agent"`, { stdio: 'ignore' });
        systemPython = py;
        break;
      } catch {}
    }
  }

  if (!hasVenv && !systemPython) {
    addLog(session, 'Python agent not available in this container.');
    addLog(session, 'The agent runs as a sidecar container — check agent container logs.');
    return { ok: false, message: 'Agent runs as a sidecar container. Use "podman logs" or "oc logs" to view agent output.' };
  }

  let spawnCmd: string;
  let spawnArgs: string[];
  let spawnCwd: string;

  if (hasVenv) {
    spawnCmd = venvPython;
    spawnArgs = ['-m', 'wordswarm_agent.main'];
    spawnCwd = agentDir;
  } else {
    spawnCmd = systemPython;
    spawnArgs = ['-m', 'wordswarm_agent.main'];
    spawnCwd = process.cwd();
  }

  session.process = spawn(spawnCmd, spawnArgs, {
    cwd: spawnCwd,
    env: {
      ...process.env,
      ...env,
      SESSION_ID: sessionId,
      PYTHONUNBUFFERED: '1',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  addLog(session, `Agent process started (PID: ${session.process.pid})`);

  session.process.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter((l: string) => l.trim());
    for (const line of lines) {
      addLog(session, line);
    }
  });

  session.process.stderr?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter((l: string) => l.trim());
    for (const line of lines) {
      if (line.includes('UserWarning') || line.includes('deprecation')) continue;
      addLog(session, `[stderr] ${line}`);
    }
  });

  session.process.on('close', (code: number | null) => {
    addLog(session, `Agent process exited (code: ${code})`);

    // Auto-submit agent score to leaderboard (once per run)
    try {
      const gameState = getGameState(sessionId);
      if (gameState.score > 0 && !session.scoreSaved) {
        session.scoreSaved = true;
        const totalTokens = session.stats.total_input_tokens + session.stats.total_output_tokens;
        const tokensPerSec = session.stats.total_latency_ms > 0
          ? ((session.stats.total_output_tokens / session.stats.total_latency_ms) * 1000)
          : 0;
        const entry = addEntry({
          name: session.modelName || 'AI Agent',
          score: gameState.score,
          level: gameState.level,
          date: new Date().toISOString(),
          type: 'agent',
          modelName: session.modelName || 'unknown',
          totalTokens,
          inputTokens: session.stats.total_input_tokens,
          outputTokens: session.stats.total_output_tokens,
          llmCalls: session.stats.llm_calls,
          avgLatencyMs: session.stats.avg_latency_ms,
          lastTtftMs: session.stats.last_ttft_ms,
          tokensPerSec: Math.round(tokensPerSec * 10) / 10,
          wordsSubmitted: session.stats.words_submitted,
          wordsCorrect: session.stats.words_correct,
          solverCalls: session.stats.solver_calls,
          solverCandidates: session.stats.solver_candidates,
          totalLatencyMs: session.stats.total_latency_ms,
        });
        addLog(session, `Leaderboard: saved agent score ${gameState.score} (level ${gameState.level}) as "${entry.name}"`);
      }
    } catch (e) {
      addLog(session, `Leaderboard: failed to save agent score: ${e}`);
    }

    session.process = null;
  });

  session.process.on('error', (err: Error) => {
    addLog(session, `Agent process error: ${err.message}`);
    session.process = null;
  });

  return { ok: true, message: `Agent started (PID: ${session.process.pid})` };
}

export function stopAgent(sessionId: string): { ok: boolean; message: string } {
  const session = getOrCreateSession(sessionId);

  if (!session.process || session.process.exitCode !== null) {
    return { ok: false, message: 'Agent is not running' };
  }

  addLog(session, 'Stopping agent...');
  session.process.kill('SIGTERM');

  // Force kill after 3 seconds
  const proc = session.process;
  setTimeout(() => {
    if (proc && proc.exitCode === null) {
      proc.kill('SIGKILL');
      addLog(session, 'Agent force-killed');
    }
  }, 3000);

  return { ok: true, message: 'Agent stop signal sent' };
}

// Clean up a specific session's agent (called during session TTL cleanup)
export function cleanupAgentSession(sessionId: string): void {
  const session = _sessions.get(sessionId);
  if (session?.process && session.process.exitCode === null) {
    session.process.kill('SIGTERM');
    setTimeout(() => {
      if (session.process && session.process.exitCode === null) {
        session.process.kill('SIGKILL');
      }
    }, 3000);
  }
  _sessions.delete(sessionId);
}
