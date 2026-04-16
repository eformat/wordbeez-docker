'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Guide from '@/components/Guide';

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

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return n.toString();
}

function formatMs(ms: number): string {
  if (ms === 0) return '--';
  if (ms >= 1000) return (ms / 1000).toFixed(1) + 's';
  return ms + 'ms';
}

function StatCard({ label, value, unit, color, subtext }: {
  label: string;
  value: string;
  unit?: string;
  color: string;
  subtext?: string;
}) {
  return (
    <div style={{
      flex: '1 1 0',
      minWidth: 100,
      padding: '12px 10px',
      textAlign: 'center',
      borderRight: '1px solid #1a1a2e',
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: '#929497',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 28,
        fontWeight: 800,
        color,
        lineHeight: 1.1,
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      }}>
        {value}
        {unit && <span style={{ fontSize: 13, fontWeight: 500, color: '#666', marginLeft: 2 }}>{unit}</span>}
      </div>
      {subtext && (
        <div style={{
          fontSize: 10,
          color: '#555',
          marginTop: 2,
        }}>
          {subtext}
        </div>
      )}
    </div>
  );
}

interface ModelInfo {
  id: string;
  name: string;
  url: string;
}

export default function Dashboard() {
  // Stable session ID for this dashboard tab — shared with the game iframe.
  // Generated client-side only via useEffect to avoid SSR baking a shared UUID
  // into the static HTML (which would make all visitors share one session).
  const [sessionId, setSessionId] = useState('');
  useEffect(() => {
    setSessionId(crypto.randomUUID());
  }, []);
  const [agentRunning, setAgentRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [gameState, setGameState] = useState<Record<string, unknown>>({});
  const [stats, setStats] = useState<AgentStats>(EMPTY_STATS);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [modelsLoading, setModelsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'guide' | 'agent'>('guide');
  const logIndexRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Fetch available models once session ID is ready
  useEffect(() => {
    if (!sessionId) return;
    async function fetchModels() {
      try {
        const res = await fetch('/api/models', {
          headers: { 'X-Session-Id': sessionId },
        });
        const data = await res.json();
        if (data.models) {
          setModels(data.models);
          // Default to kimi-k2-5 if available, otherwise first model
          const kimi = data.models.find((m: ModelInfo) => m.id === 'kimi-k2-5');
          setSelectedModel(kimi ? kimi.id : data.models[0]?.id || '');
        }
      } catch {}
      setModelsLoading(false);
    }
    fetchModels();
  }, [sessionId]);

  // Sync selected model to server (for 2P auto-start)
  useEffect(() => {
    if (!sessionId || !selectedModel) return;
    const model = models.find(m => m.id === selectedModel);
    if (!model) return;
    fetch('/api/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId },
      body: JSON.stringify({ id: model.id, url: model.url }),
    }).catch(() => {});
  }, [sessionId, selectedModel, models]);

  // Poll for game state
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/game', {
          headers: { 'X-Session-Id': sessionId },
        });
        const data = await res.json();
        setGameState(data);
      } catch {}
    }, 500);
    return () => clearInterval(interval);
  }, [sessionId]);

  // Poll for agent logs when running
  const startPolling = useCallback(() => {
    if (!sessionId) return;
    if (pollRef.current) clearInterval(pollRef.current);
    logIndexRef.current = 0;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/agent?since=${logIndexRef.current}`, {
          headers: { 'X-Session-Id': sessionId },
        });
        const data = await res.json();
        if (data.logs && data.logs.length > 0) {
          setLogs((prev) => [...prev, ...data.logs]);
          logIndexRef.current = data.nextIndex;
        }
        if (data.stats) {
          setStats(data.stats);
        }
        if (data.running === false) {
          setAgentRunning(false);
        }
      } catch {}
    }, 300);
  }, [sessionId]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // Detect when agent is started externally (e.g. 2P auto-start)
  useEffect(() => {
    if (!sessionId) return;
    const detectInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/agent', {
          headers: { 'X-Session-Id': sessionId },
        });
        const data = await res.json();
        if (data.running && !agentRunning) {
          setAgentRunning(true);
          setActiveTab('agent');
          setLogs([]);
          logIndexRef.current = 0;
          startPolling();
        }
      } catch {}
    }, 1000);
    return () => clearInterval(detectInterval);
  }, [sessionId, agentRunning, startPolling]);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleStart = async () => {
    setLogs([]);
    setStats(EMPTY_STATS);
    logIndexRef.current = 0;

    const model = models.find(m => m.id === selectedModel);

    const res = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId },
      body: JSON.stringify({
        action: 'start',
        modelUrl: model?.url,
        modelName: model?.id,
      }),
    });
    const data = await res.json();

    if (data.ok) {
      setAgentRunning(true);
      setActiveTab('agent');
      startPolling();
    } else {
      setLogs((prev) => [...prev, `Error: ${data.message}`]);
    }
  };

  const handleStop = async () => {
    await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId },
      body: JSON.stringify({ action: 'stop' }),
    });
    setAgentRunning(false);
    stopPolling();
  };

  const phase = (gameState.phase as string) || '--';
  const score = (gameState.score as number) ?? 0;
  const level = (gameState.level as number) ?? 0;
  const honey = (gameState.honeyLevel as number) ?? 0;

  const totalTokens = stats.total_input_tokens + stats.total_output_tokens;

  return (
    <div style={{
      display: 'flex',
      height: '100dvh',
      width: '100vw',
      background: '#1a1a2e',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#e0e0e0',
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>
      {/* Left side - Game */}
      <div style={{
        flex: '1 1 60%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '2px solid #ffc220',
      }}>
        {/* Game header */}
        <div style={{
          padding: '12px 20px',
          background: '#16213e',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          borderBottom: '1px solid #333',
        }}>
          <div style={{
            fontSize: 20,
            fontWeight: 700,
            color: '#ffc220',
          }}>
            WordSwarm
          </div>
          <div style={{
            display: 'flex',
            gap: 16,
            fontSize: 13,
            color: '#929497',
          }}>
            <span>Phase: <b style={{ color: phase === 'playing' ? '#4ade80' : phase === 'gameOver' ? '#f87171' : '#ffc220' }}>{phase}</b></span>
            <span>Level: <b style={{ color: '#e0e0e1' }}>{level}</b></span>
            <span>Score: <b style={{ color: '#e0e0e1' }}>{score}</b></span>
            <span>Honey: <b style={{ color: honey > 100 ? '#4ade80' : honey > 50 ? '#ffc220' : '#f87171' }}>{honey}</b></span>
          </div>
        </div>

        {/* Game iframe — only render once sessionId is ready */}
        <div style={{ flex: 1, position: 'relative' }}>
          {sessionId && (
            <iframe
              src={`/?sessionId=${sessionId}`}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: '#000',
              }}
            />
          )}
        </div>
      </div>

      {/* Right side - Agent */}
      <div style={{
        flex: '1 1 40%',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 420,
      }}>
        {/* Tab header */}
        <div style={{
          background: '#16213e',
          borderBottom: '1px solid #333',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'stretch' }}>
              {(['guide', 'agent'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '12px 20px',
                    fontSize: 14,
                    fontWeight: 700,
                    border: 'none',
                    borderBottom: activeTab === tab ? '3px solid #ffc220' : '3px solid transparent',
                    background: 'none',
                    color: activeTab === tab ? '#ffc220' : '#929497',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                    transition: 'all 0.15s',
                  }}
                >
                  {tab === 'guide' ? 'Guide' : 'Agent'}
                </button>
              ))}
              {activeTab === 'agent' && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginLeft: 12,
                }}>
                  <div style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: agentRunning ? '#166534' : '#333',
                    color: agentRunning ? '#4ade80' : '#929497',
                    fontWeight: 600,
                  }}>
                    {agentRunning ? 'RUNNING' : 'STOPPED'}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={agentRunning ? handleStop : handleStart}
              style={{
                padding: '8px 24px',
                fontSize: 14,
                fontWeight: 700,
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                background: agentRunning ? '#dc2626' : '#ffc220',
                color: agentRunning ? '#fff' : '#1a1a2e',
                transition: 'all 0.15s',
              }}
            >
              {agentRunning ? 'STOP AGENT' : 'START AGENT'}
            </button>
          </div>
        </div>

        {activeTab === 'guide' ? (
          <>
            {/* Guide content */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <Guide />
            </div>

            {/* Footer */}
            <div style={{
              padding: '8px 20px',
              background: '#16213e',
              fontSize: 11,
              color: '#555',
              borderTop: '1px solid #333',
              textAlign: 'center',
            }}>
              WordSwarm AI &mdash; LangChain + {models.find(m => m.id === selectedModel)?.name || 'LLM'} + React Next.js &mdash; Blind Mode
            </div>
          </>
        ) : (
          <>
            {/* Model selector bar */}
            <div style={{
              padding: '6px 20px',
              background: '#0f1629',
              fontSize: 11,
              color: '#666',
              borderBottom: '1px solid #222',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span style={{ color: '#929497', fontWeight: 600 }}>MODEL:</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={agentRunning || modelsLoading}
                style={{
                  background: '#1a1a2e',
                  color: '#ffc220',
                  border: '1px solid #333',
                  borderRadius: 4,
                  padding: '3px 8px',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  cursor: agentRunning ? 'not-allowed' : 'pointer',
                  opacity: agentRunning ? 0.5 : 1,
                  minWidth: 180,
                }}
              >
                {modelsLoading && <option value="">Loading models...</option>}
                {models.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <span style={{ color: '#444' }}>|</span>
              <span>Blind mode: path enumeration + dictionary</span>
              <span style={{ color: '#444' }}>|</span>
              <span>LangChain + LangGraph</span>
            </div>

            {/* Stats panel - big numbers */}
            <div style={{
              background: '#111827',
              borderBottom: '2px solid #1e293b',
              display: 'flex',
              flexWrap: 'wrap',
            }}>
              {/* Top row - LLM metrics */}
              <div style={{
                display: 'flex',
                width: '100%',
                borderBottom: '1px solid #1e293b',
              }}>
                <StatCard
                  label="TTFT"
                  value={formatMs(stats.last_ttft_ms)}
                  color="#38bdf8"
                  subtext="time to first token"
                />
                <StatCard
                  label="Latency"
                  value={formatMs(stats.last_latency_ms)}
                  color="#818cf8"
                  subtext={stats.avg_latency_ms ? `avg ${formatMs(stats.avg_latency_ms)}` : 'last LLM call'}
                />
                <StatCard
                  label="LLM Calls"
                  value={stats.llm_calls.toString()}
                  color="#a78bfa"
                  subtext="total invocations"
                />
              </div>

              {/* Middle row - token metrics */}
              <div style={{
                display: 'flex',
                width: '100%',
                borderBottom: '1px solid #1e293b',
              }}>
                <StatCard
                  label="Tokens In"
                  value={formatNumber(stats.total_input_tokens)}
                  color="#fb923c"
                  subtext={stats.last_input_tokens ? `last: ${formatNumber(stats.last_input_tokens)}` : 'prompt tokens'}
                />
                <StatCard
                  label="Tokens Out"
                  value={formatNumber(stats.total_output_tokens)}
                  color="#f472b6"
                  subtext={stats.last_output_tokens ? `last: ${formatNumber(stats.last_output_tokens)}` : 'completion tokens'}
                />
                <StatCard
                  label="Tokens/sec"
                  value={stats.total_latency_ms > 0 ? ((stats.total_output_tokens / stats.total_latency_ms) * 1000).toFixed(1) : '--'}
                  color="#c084fc"
                  subtext={stats.last_latency_ms > 0 ? `last: ${((stats.last_output_tokens / stats.last_latency_ms) * 1000).toFixed(1)} t/s` : 'output throughput'}
                />
              </div>

              {/* Bottom row - game metrics */}
              <div style={{
                display: 'flex',
                width: '100%',
              }}>
                <StatCard
                  label="Words Found"
                  value={stats.words_submitted.toString()}
                  color="#4ade80"
                  subtext="submitted to game"
                />
                <StatCard
                  label="Solver Runs"
                  value={stats.solver_calls.toString()}
                  color="#fbbf24"
                  subtext={stats.solver_candidates ? `${stats.solver_candidates} candidates` : 'path enumerations'}
                />
                <StatCard
                  label="Total Tokens"
                  value={formatNumber(totalTokens)}
                  color="#e0e0e1"
                  subtext={totalTokens ? `${formatNumber(stats.total_input_tokens)} in + ${formatNumber(stats.total_output_tokens)} out` : 'all tokens used'}
                />
              </div>
            </div>

            {/* Log output */}
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '12px 16px',
              background: '#0d1117',
              fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
              fontSize: 12,
              lineHeight: 1.6,
            }}>
              {logs.length === 0 && (
                <div style={{ color: '#555', fontStyle: 'italic', padding: '20px 0' }}>
                  Press START AGENT to begin. The AI agent will observe the board,
                  enumerate valid paths through the honeycomb, match words against
                  the dictionary, and use the LLM to decide strategy for ambiguous cases.
                  Stats update live as the agent works.
                </div>
              )}
              {logs.map((line, i) => {
                let color = '#c9d1d9';
                if (line.includes('[stderr]')) color = '#f87171';
                else if (line.includes('Starting') || line.includes('started')) color = '#4ade80';
                else if (line.includes('ERROR') || line.includes('error')) color = '#f87171';
                else if (line.includes('submitted') || line.includes('Submitted')) color = '#60a5fa';
                else if (line.includes('Level') || line.includes('level')) color = '#ffc220';
                else if (line.includes('Score') || line.includes('score')) color = '#c084fc';

                return (
                  <div key={i} style={{ color, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {line}
                  </div>
                );
              })}
              <div ref={logEndRef} />
            </div>

            {/* Footer */}
            <div style={{
              padding: '8px 20px',
              background: '#16213e',
              fontSize: 11,
              color: '#555',
              borderTop: '1px solid #333',
              textAlign: 'center',
            }}>
              WordSwarm AI &mdash; LangChain + {models.find(m => m.id === selectedModel)?.name || 'LLM'} + React Next.js &mdash; Blind Mode
            </div>
          </>
        )}
      </div>
    </div>
  );
}
