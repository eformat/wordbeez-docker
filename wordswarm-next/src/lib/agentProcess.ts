/*
 * Manages the Python WordSwarm agent as a child process.
 * Singleton — one agent process at a time.
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

let _process: ChildProcess | null = null;
let _logs: string[] = [];
let _startedAt: string | null = null;
let _logCounter = 0;
let _stats: AgentStats = { ...EMPTY_STATS };
let _modelName: string = '';
let _scoreSaved = false;

const MAX_LOGS = 500;

function addLog(line: string) {
  // Parse [STATS] lines — update stats but don't add to visible logs
  if (line.startsWith('[STATS] ')) {
    try {
      const payload = JSON.parse(line.slice(8));
      _stats = { ...EMPTY_STATS, ...payload };
    } catch {}
    return;
  }

  _logCounter++;
  const timestamp = new Date().toISOString().slice(11, 19);
  _logs.push(`[${timestamp}] ${line}`);
  if (_logs.length > MAX_LOGS) {
    _logs = _logs.slice(-MAX_LOGS);
  }
}

export function getAgentState(): AgentState {
  return {
    running: _process !== null && _process.exitCode === null,
    logs: [..._logs],
    startedAt: _startedAt,
    pid: _process?.pid ?? null,
    stats: { ..._stats },
  };
}

export function getLogsSince(fromIndex: number): { logs: string[]; nextIndex: number; stats: AgentStats; running: boolean } {
  // _logCounter is the total logs ever added (monotonically increasing).
  // _logs is a rolling buffer of the last MAX_LOGS entries.
  // Convert the absolute cursor (fromIndex) to an array offset.
  const oldestAbsolute = _logCounter - _logs.length; // absolute index of _logs[0]
  let arrayOffset: number;
  if (fromIndex <= oldestAbsolute) {
    // Client is behind the buffer — send everything we have
    arrayOffset = 0;
  } else {
    arrayOffset = fromIndex - oldestAbsolute;
  }
  const newLogs = _logs.slice(arrayOffset);
  return {
    logs: newLogs,
    nextIndex: _logCounter, // absolute cursor for next poll
    stats: { ..._stats },
    running: _process !== null && _process.exitCode === null,
  };
}

export function startAgent(env: Record<string, string>): { ok: boolean; message: string } {
  if (_process !== null && _process.exitCode === null) {
    // Verify the process is actually alive
    try {
      process.kill(_process.pid!, 0); // signal 0 = check if alive
      return { ok: false, message: 'Agent is already running' };
    } catch {
      // Process is dead but wasn't cleaned up — reset
      _process = null;
    }
  }
  // Clean up stale reference
  if (_process !== null && _process.exitCode !== null) {
    _process = null;
  }

  _logs = [];
  _logCounter = 0;
  _stats = { ...EMPTY_STATS };
  _startedAt = new Date().toISOString();
  _modelName = env.MODEL_NAME || '';
  _scoreSaved = false;

  addLog('Starting WordSwarm agent...');

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
    addLog('Python agent not available in this container.');
    addLog('The agent runs as a sidecar container — check agent container logs.');
    return { ok: false, message: 'Agent runs as a sidecar container. Use "podman logs" or "oc logs" to view agent output.' };
  }

  let spawnCmd: string;
  let spawnArgs: string[];
  let spawnCwd: string;

  if (hasVenv) {
    // Local dev: use venv Python
    spawnCmd = venvPython;
    spawnArgs = ['-m', 'wordswarm_agent.main'];
    spawnCwd = agentDir;
  } else {
    // Container with agent pip-installed
    spawnCmd = systemPython;
    spawnArgs = ['-m', 'wordswarm_agent.main'];
    spawnCwd = process.cwd();
  }

  _process = spawn(spawnCmd, spawnArgs, {
    cwd: spawnCwd,
    env: {
      ...process.env,
      ...env,
      PYTHONUNBUFFERED: '1',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  addLog(`Agent process started (PID: ${_process.pid})`);

  _process.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter((l: string) => l.trim());
    for (const line of lines) {
      addLog(line);
    }
  });

  _process.stderr?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter((l: string) => l.trim());
    for (const line of lines) {
      // Filter out noisy Python warnings
      if (line.includes('UserWarning') || line.includes('deprecation')) continue;
      addLog(`[stderr] ${line}`);
    }
  });

  _process.on('close', (code: number | null) => {
    addLog(`Agent process exited (code: ${code})`);

    // Auto-submit agent score to leaderboard (once per run)
    try {
      const gameState = getGameState();
      if (gameState.score > 0 && !_scoreSaved) {
        _scoreSaved = true;
        const totalTokens = _stats.total_input_tokens + _stats.total_output_tokens;
        const tokensPerSec = _stats.total_latency_ms > 0
          ? ((_stats.total_output_tokens / _stats.total_latency_ms) * 1000)
          : 0;
        const entry = addEntry({
          name: _modelName || 'AI Agent',
          score: gameState.score,
          level: gameState.level,
          date: new Date().toISOString(),
          type: 'agent',
          modelName: _modelName || 'unknown',
          totalTokens,
          inputTokens: _stats.total_input_tokens,
          outputTokens: _stats.total_output_tokens,
          llmCalls: _stats.llm_calls,
          avgLatencyMs: _stats.avg_latency_ms,
          lastTtftMs: _stats.last_ttft_ms,
          tokensPerSec: Math.round(tokensPerSec * 10) / 10,
          wordsSubmitted: _stats.words_submitted,
          wordsCorrect: _stats.words_correct,
          solverCalls: _stats.solver_calls,
          solverCandidates: _stats.solver_candidates,
          totalLatencyMs: _stats.total_latency_ms,
        });
        addLog(`Leaderboard: saved agent score ${gameState.score} (level ${gameState.level}) as "${entry.name}"`);
      }
    } catch (e) {
      addLog(`Leaderboard: failed to save agent score: ${e}`);
    }

    _process = null;
  });

  _process.on('error', (err: Error) => {
    addLog(`Agent process error: ${err.message}`);
    _process = null;
  });

  return { ok: true, message: `Agent started (PID: ${_process.pid})` };
}

export function stopAgent(): { ok: boolean; message: string } {
  if (!_process || _process.exitCode !== null) {
    return { ok: false, message: 'Agent is not running' };
  }

  addLog('Stopping agent...');
  _process.kill('SIGTERM');

  // Force kill after 3 seconds
  setTimeout(() => {
    if (_process && _process.exitCode === null) {
      _process.kill('SIGKILL');
      addLog('Agent force-killed');
    }
  }, 3000);

  return { ok: true, message: 'Agent stop signal sent' };
}
