'use client';

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: 18,
      fontWeight: 700,
      color: '#ffc220',
      marginTop: 28,
      marginBottom: 12,
      paddingBottom: 6,
      borderBottom: '1px solid #2a2a4a',
    }}>
      {children}
    </h2>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontSize: 14,
      fontWeight: 700,
      color: '#e0e0e1',
      marginTop: 18,
      marginBottom: 8,
    }}>
      {children}
    </h3>
  );
}

function Concept({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#16213e',
      border: '1px solid #2a2a4a',
      borderRadius: 8,
      padding: '14px 16px',
      marginBottom: 12,
    }}>
      <div style={{
        fontSize: 13,
        fontWeight: 700,
        color: '#ffc220',
        marginBottom: 6,
      }}>
        {title}
      </div>
      <div style={{
        fontSize: 13,
        color: '#c9d1d9',
        lineHeight: 1.6,
      }}>
        {children}
      </div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li style={{
      fontSize: 13,
      color: '#c9d1d9',
      lineHeight: 1.7,
      marginBottom: 4,
    }}>
      {children}
    </li>
  );
}

export default function Guide() {
  return (
    <div style={{
      padding: '20px 24px',
      overflowY: 'auto',
      height: '100%',
      lineHeight: 1.6,
      fontSize: 13,
      color: '#c9d1d9',
    }}>
      {/* Intro */}
      <div style={{
        background: 'linear-gradient(135deg, #16213e 0%, #1a1a3e 100%)',
        border: '1px solid #ffc220',
        borderRadius: 10,
        padding: '18px 20px',
        marginBottom: 20,
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#ffc220', marginBottom: 6 }}>
          WordSwarm AI Demo
        </div>
        <div style={{ color: '#c9d1d9' }}>
          Watch an AI agent play a honeycomb word game in real time.
          This guide explains what you are seeing, how the game works,
          and the AI concepts at play.
        </div>
      </div>

      {/* What You're Seeing */}
      <SectionHeading>What You&apos;re Seeing</SectionHeading>
      <p style={{ marginBottom: 12 }}>
        The screen is split into two panels:
      </p>
      <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
        <Bullet>
          <b style={{ color: '#ffc220' }}>Left &mdash; The Game.</b> A live
          honeycomb word puzzle. Letters sit on 17 hexagonal cells. Words are
          formed by dragging across adjacent cells.
        </Bullet>
        <Bullet>
          <b style={{ color: '#e0e0e1' }}>Right &mdash; The Agent.</b> Controls,
          live stats, and a scrolling log of the AI agent&apos;s actions and
          reasoning as it plays the game autonomously.
        </Bullet>
      </ul>
      <p>
        When you press <b style={{ color: '#4ade80' }}>START AGENT</b>, a
        Python process launches on the server. It observes the board, searches
        for words, and submits them &mdash; all without ever seeing the answer
        key.
      </p>

      {/* Game Mechanics */}
      <SectionHeading>Game Mechanics</SectionHeading>
      <SubHeading>Objective</SubHeading>
      <p style={{ marginBottom: 10 }}>
        Find hidden words on the honeycomb before time runs out. Each correct
        word raises the <b style={{ color: '#ffc220' }}>honey level</b>. If the
        honey drops to zero, the round ends.
      </p>

      <SubHeading>How Words Work</SubHeading>
      <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
        <Bullet>Words are 3&ndash;6 letters long, laid across adjacent cells.</Bullet>
        <Bullet>Each cell can only be used once per word.</Bullet>
        <Bullet>The <b>word list</b> shows hints: the first letter is always
          visible; remaining letters are revealed as words are solved.</Bullet>
        <Bullet>A correct word lights up green; an incorrect guess shows a red X
          and drains honey.</Bullet>
      </ul>

      <SubHeading>Scoring &amp; Levels</SubHeading>
      <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
        <Bullet>Solve enough words to advance to the next level.</Bullet>
        <Bullet>Each level generates a new puzzle with a fresh set of words.</Bullet>
        <Bullet>Your score accumulates across levels.</Bullet>
        <Bullet>The timer and honey meter add pressure &mdash; speed matters.</Bullet>
      </ul>

      {/* What to Observe */}
      <SectionHeading>What to Observe</SectionHeading>
      <p style={{ marginBottom: 12 }}>
        As the agent plays, pay attention to the stats panel and log output.
        Here is what each metric tells you:
      </p>

      <SubHeading>Speed Metrics</SubHeading>
      <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
        <Bullet>
          <b style={{ color: '#38bdf8' }}>TTFT</b> (Time to First Token) &mdash;
          How long before the model starts responding. Lower is better.
          This is bounded by network latency and model load.
        </Bullet>
        <Bullet>
          <b style={{ color: '#818cf8' }}>Latency</b> &mdash; Total wall-clock
          time for each LLM call, including all token generation.
        </Bullet>
        <Bullet>
          <b style={{ color: '#c084fc' }}>Tokens/sec</b> &mdash; Output
          throughput. Higher means the model generates text faster.
        </Bullet>
      </ul>

      <SubHeading>Cost Metrics</SubHeading>
      <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
        <Bullet>
          <b style={{ color: '#fb923c' }}>Tokens In</b> &mdash; Prompt tokens
          sent to the model (context, instructions, game state).
        </Bullet>
        <Bullet>
          <b style={{ color: '#f472b6' }}>Tokens Out</b> &mdash; Completion
          tokens generated by the model (reasoning, tool calls).
        </Bullet>
        <Bullet>
          <b style={{ color: '#e0e0e1' }}>Total Tokens</b> &mdash; Combined
          usage. In production, this drives cost.
        </Bullet>
      </ul>

      <SubHeading>Effectiveness Metrics</SubHeading>
      <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
        <Bullet>
          <b style={{ color: '#4ade80' }}>Words Found</b> &mdash; How many
          words the agent successfully submitted.
        </Bullet>
        <Bullet>
          <b style={{ color: '#fbbf24' }}>Solver Runs</b> &mdash; How many
          times the path-enumeration solver scanned the board.
        </Bullet>
        <Bullet>
          <b style={{ color: '#a78bfa' }}>LLM Calls</b> &mdash; Total
          invocations. More calls means more reasoning steps. Watch
          for the ratio of calls to words found.
        </Bullet>
      </ul>

      {/* Key Concepts */}
      <SectionHeading>Key Concepts</SectionHeading>

      <Concept title="Agentic AI">
        <p style={{ marginBottom: 8 }}>
          Traditional AI answers questions. <b>Agentic AI</b> takes actions
          in a loop: observe, reason, act, repeat.
        </p>
        <p style={{ marginBottom: 8 }}>
          This agent uses the <b>ReAct</b> (Reason + Act) pattern powered by
          LangGraph. At each step it decides which tool to call &mdash;
          observe the board, run the solver, or submit a word &mdash; based
          on the current game state and its own prior reasoning.
        </p>
        <p>
          Unlike a script, the agent adapts. If the solver returns ambiguous
          matches, the LLM reasons about which word fits best. If the board
          changes mid-turn, it re-observes and re-plans.
        </p>
      </Concept>

      <Concept title="Reasoning Models">
        <p style={{ marginBottom: 8 }}>
          Some models (like <b>kimi-k2-5</b>) use internal &ldquo;chain of
          thought&rdquo; before producing a visible answer. This shows up as
          <b style={{ color: '#fb923c' }}> reasoning tokens</b> &mdash;
          tokens the model generates for itself, not shown to the user.
        </p>
        <p style={{ marginBottom: 8 }}>
          Reasoning models often produce better decisions (fewer wrong
          guesses) but consume more tokens and take longer per call.
          Watch the <b>Tokens Out</b> counter &mdash; a reasoning model may
          show high output even when the visible response is short.
        </p>
        <p>
          The trade-off: <b>accuracy vs. speed</b>. A reasoning model
          may solve the puzzle in fewer attempts but take longer per
          move. A faster model may guess more but act quickly.
        </p>
      </Concept>

      <Concept title="Performance &amp; Efficiency">
        <p style={{ marginBottom: 8 }}>
          The demo measures what matters in production AI systems:
        </p>
        <ul style={{ paddingLeft: 18, marginBottom: 0 }}>
          <Bullet>
            <b>Latency</b> &mdash; Can the agent act fast enough to keep
            the honey level from dropping? This mirrors real-time
            requirements in production (chat, automation, monitoring).
          </Bullet>
          <Bullet>
            <b>Token efficiency</b> &mdash; How many tokens does it take
            to find each word? Fewer tokens per result = lower cost at
            scale.
          </Bullet>
          <Bullet>
            <b>Tool use</b> &mdash; The agent has specialized tools
            (solver, observer). Good agents call the right tool at the
            right time instead of reasoning from scratch every step.
          </Bullet>
          <Bullet>
            <b>Blind mode</b> &mdash; The agent never sees the answer
            key. It must discover words through graph traversal and
            dictionary lookup, just like a human player. This
            demonstrates real-world constraints where AI operates with
            incomplete information.
          </Bullet>
        </ul>
      </Concept>

      <div style={{
        marginTop: 24,
        padding: '12px 16px',
        background: '#0f1629',
        borderRadius: 8,
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
      }}>
        Switch to the <b style={{ color: '#929497' }}>Agent</b> tab to watch
        the AI in action.
      </div>
    </div>
  );
}
