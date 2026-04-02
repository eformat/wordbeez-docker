'use client';

import { useState, useEffect } from 'react';

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  level: number;
  date: string;
  type: 'human' | 'agent';
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

interface LeaderboardProps {
  onMainMenu: () => void;
  highlightEntryId?: string;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  } catch {
    return '--';
  }
}

function formatNum(n: number | undefined): string {
  if (n === undefined || n === null) return '--';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return n.toString();
}

function formatMs(ms: number | undefined): string {
  if (!ms) return '--';
  if (ms >= 1000) return (ms / 1000).toFixed(1) + 's';
  return ms + 'ms';
}

export default function Leaderboard({ onMainMenu, highlightEntryId }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const res = await fetch('/api/leaderboard?limit=100');
        const data = await res.json();
        if (data.entries) setEntries(data.entries);
      } catch {}
    }
    fetchLeaderboard();
  }, []);

  const colStyle = (width: number, align: string = 'left'): React.CSSProperties => ({
    width,
    textAlign: align as 'left' | 'center' | 'right',
    flexShrink: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  });

  return (
    <div
      style={{
        backgroundImage: 'url(/images/MainMenu-background.png)',
        width: 1024,
        height: 600,
        position: 'relative',
      }}
    >
      {/* Title */}
      <div style={{
        position: 'absolute',
        top: 30,
        width: '100%',
        textAlign: 'center',
        font: '36pt Oswald',
        color: '#ffc220',
        letterSpacing: '0.1em',
      }}>
        LEADERBOARD
      </div>

      {/* Table backdrop — darkens the background behind table so text is readable */}
      <div style={{
        position: 'absolute',
        top: 92,
        left: 40,
        right: 40,
        bottom: 70,
        background: 'rgba(0, 0, 0, 0.75)',
        borderRadius: 8,
      }} />

      {/* Table header */}
      <div style={{
        position: 'absolute',
        top: 100,
        left: 60,
        right: 60,
        display: 'flex',
        font: '10pt "Lato Black"',
        color: '#ffc220',
        borderBottom: '2px solid rgba(255, 194, 32, 0.3)',
        paddingBottom: 6,
        zIndex: 1,
      }}>
        <div style={colStyle(45, 'center')}>#</div>
        <div style={colStyle(50, 'center')}>TYPE</div>
        <div style={colStyle(250)}>NAME</div>
        <div style={colStyle(90, 'right')}>SCORE</div>
        <div style={colStyle(70, 'center')}>LEVEL</div>
        <div style={colStyle(120, 'right')}>TOKENS</div>
        <div style={colStyle(100, 'right')}>DATE</div>
      </div>

      {/* Scrollable entries */}
      <div style={{
        position: 'absolute',
        top: 130,
        left: 60,
        right: 60,
        bottom: 80,
        overflowY: 'auto',
        overflowX: 'hidden',
        zIndex: 1,
      }}>
        {entries.length === 0 && (
          <div style={{
            textAlign: 'center',
            font: '14pt Oswald',
            color: 'rgba(255, 255, 255, 0.4)',
            marginTop: 100,
          }}>
            No scores yet. Play a game!
          </div>
        )}
        {entries.map((entry, i) => {
          const isHighlighted = entry.id === highlightEntryId;
          const isExpanded = expandedId === entry.id;
          const isAgent = entry.type === 'agent';

          return (
            <div key={entry.id}>
              {/* Row */}
              <div
                onClick={() => isAgent ? setExpandedId(isExpanded ? null : entry.id) : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  font: '11pt Oswald',
                  color: isHighlighted ? '#1a1a2e' : '#e0e0e1',
                  background: isHighlighted
                    ? 'rgba(255, 194, 32, 0.85)'
                    : i % 2 === 0
                      ? 'rgba(255, 255, 255, 0.03)'
                      : 'transparent',
                  padding: '6px 0',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  cursor: isAgent ? 'pointer' : 'default',
                  transition: 'background 0.15s',
                }}
              >
                {/* Rank */}
                <div style={{
                  ...colStyle(45, 'center'),
                  font: '12pt Oswald',
                  color: isHighlighted ? '#1a1a2e'
                    : i === 0 ? '#ffd700'
                    : i === 1 ? '#c0c0c0'
                    : i === 2 ? '#cd7f32'
                    : '#929497',
                }}>
                  {i + 1}
                </div>
                {/* Type icon */}
                <div style={{
                  ...colStyle(50, 'center'),
                  fontSize: 14,
                  color: isHighlighted ? '#1a1a2e' : isAgent ? '#38bdf8' : '#4ade80',
                }}>
                  {isAgent ? 'AI' : 'P1'}
                </div>
                {/* Name */}
                <div style={{
                  ...colStyle(250),
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  <span>{entry.name}</span>
                  {isAgent && entry.modelName && (
                    <span style={{
                      fontSize: 9,
                      color: isHighlighted ? 'rgba(0,0,0,0.5)' : '#666',
                      marginTop: -2,
                    }}>
                      {entry.modelName}
                    </span>
                  )}
                </div>
                {/* Score */}
                <div style={{
                  ...colStyle(90, 'right'),
                  font: '13pt Oswald',
                  color: isHighlighted ? '#1a1a2e' : '#ffc220',
                }}>
                  {entry.score}
                </div>
                {/* Level */}
                <div style={colStyle(70, 'center')}>
                  {entry.level}
                </div>
                {/* Tokens */}
                <div style={{
                  ...colStyle(120, 'right'),
                  color: isHighlighted ? '#1a1a2e' : '#e0e0e1',
                  fontSize: 10,
                }}>
                  {isAgent && entry.totalTokens ? formatNum(entry.totalTokens) : '--'}
                </div>
                {/* Date */}
                <div style={{
                  ...colStyle(100, 'right'),
                  fontSize: 10,
                  color: isHighlighted ? 'rgba(0,0,0,0.6)' : '#e0e0e1',
                }}>
                  {formatDate(entry.date)}
                </div>
              </div>

              {/* Expanded agent stats */}
              {isAgent && isExpanded && (
                <div style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  padding: '10px 20px 10px 50px',
                  borderBottom: '1px solid rgba(255, 194, 32, 0.15)',
                  display: 'flex',
                  gap: 30,
                  flexWrap: 'wrap',
                  fontSize: 10,
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                }}>
                  {/* LLM stats */}
                  <div>
                    <div style={{ color: '#ffc220', fontWeight: 700, marginBottom: 4, fontFamily: '"Lato Black"', fontSize: 9, letterSpacing: '0.05em' }}>LLM</div>
                    <div style={{ color: '#929497' }}>Calls: <span style={{ color: '#e0e0e1' }}>{entry.llmCalls ?? '--'}</span></div>
                    <div style={{ color: '#929497' }}>Avg Latency: <span style={{ color: '#e0e0e1' }}>{formatMs(entry.avgLatencyMs)}</span></div>
                    <div style={{ color: '#929497' }}>TTFT: <span style={{ color: '#e0e0e1' }}>{formatMs(entry.lastTtftMs)}</span></div>
                    <div style={{ color: '#929497' }}>Tokens/sec: <span style={{ color: '#e0e0e1' }}>{entry.tokensPerSec?.toFixed(1) ?? '--'}</span></div>
                  </div>
                  {/* Token stats */}
                  <div>
                    <div style={{ color: '#ffc220', fontWeight: 700, marginBottom: 4, fontFamily: '"Lato Black"', fontSize: 9, letterSpacing: '0.05em' }}>TOKENS</div>
                    <div style={{ color: '#929497' }}>Input: <span style={{ color: '#e0e0e1' }}>{formatNum(entry.inputTokens)}</span></div>
                    <div style={{ color: '#929497' }}>Output: <span style={{ color: '#e0e0e1' }}>{formatNum(entry.outputTokens)}</span></div>
                    <div style={{ color: '#929497' }}>Total: <span style={{ color: '#e0e0e1' }}>{formatNum(entry.totalTokens)}</span></div>
                  </div>
                  {/* Solver stats */}
                  <div>
                    <div style={{ color: '#ffc220', fontWeight: 700, marginBottom: 4, fontFamily: '"Lato Black"', fontSize: 9, letterSpacing: '0.05em' }}>SOLVER</div>
                    <div style={{ color: '#929497' }}>Runs: <span style={{ color: '#e0e0e1' }}>{entry.solverCalls ?? '--'}</span></div>
                    <div style={{ color: '#929497' }}>Candidates: <span style={{ color: '#e0e0e1' }}>{formatNum(entry.solverCandidates)}</span></div>
                    <div style={{ color: '#929497' }}>Words Found: <span style={{ color: '#e0e0e1' }}>{entry.wordsSubmitted ?? '--'}</span></div>
                    <div style={{ color: '#929497' }}>Correct: <span style={{ color: '#e0e0e1' }}>{entry.wordsCorrect ?? '--'}</span></div>
                  </div>
                  {/* Timing */}
                  <div>
                    <div style={{ color: '#ffc220', fontWeight: 700, marginBottom: 4, fontFamily: '"Lato Black"', fontSize: 9, letterSpacing: '0.05em' }}>TIMING</div>
                    <div style={{ color: '#929497' }}>Total LLM Time: <span style={{ color: '#e0e0e1' }}>{formatMs(entry.totalLatencyMs)}</span></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Main Menu button */}
      <div onClick={onMainMenu} style={{ cursor: 'pointer' }}>
        <div style={{ position: 'absolute', bottom: 12, left: 400, width: 45, height: 60, backgroundImage: 'url(/images/SilverButton-leftcurve.png)' }} />
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            left: 445,
            width: 135,
            height: 40,
            backgroundImage: 'url(/images/SilverButton-centervertical.png)',
            backgroundRepeat: 'repeat-x',
            font: '14pt "Lato Black"',
            textAlign: 'center',
            lineHeight: '160%',
            color: '#393739',
            zIndex: 2,
          }}
        >
          MAIN MENU
        </div>
        <div style={{ position: 'absolute', bottom: 12, left: 580, width: 45, height: 60, backgroundImage: 'url(/images/SilverButton-rightcurve.png)' }} />
      </div>
    </div>
  );
}
