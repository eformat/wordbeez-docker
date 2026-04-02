import { NextRequest, NextResponse } from 'next/server';
import { addEntry, getTopEntries } from '@/lib/leaderboard';

export const dynamic = 'force-dynamic';

// GET /api/leaderboard?limit=50
export async function GET(request: NextRequest) {
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);
  const entries = getTopEntries(limit);
  return NextResponse.json({ entries });
}

// POST /api/leaderboard — submit a score
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, score, level, type } = body;

  if (!name || typeof score !== 'number' || !type) {
    return NextResponse.json({ error: 'name, score, and type are required' }, { status: 400 });
  }
  if (type !== 'human' && type !== 'agent') {
    return NextResponse.json({ error: 'type must be "human" or "agent"' }, { status: 400 });
  }

  const entry = addEntry({
    name,
    score,
    level: level || 0,
    date: new Date().toISOString(),
    type,
    // Agent stats (optional)
    ...(type === 'agent' ? {
      modelName: body.modelName,
      totalTokens: body.totalTokens,
      inputTokens: body.inputTokens,
      outputTokens: body.outputTokens,
      llmCalls: body.llmCalls,
      avgLatencyMs: body.avgLatencyMs,
      lastTtftMs: body.lastTtftMs,
      tokensPerSec: body.tokensPerSec,
      wordsSubmitted: body.wordsSubmitted,
      wordsCorrect: body.wordsCorrect,
      solverCalls: body.solverCalls,
      solverCandidates: body.solverCandidates,
      totalLatencyMs: body.totalLatencyMs,
    } : {}),
  });

  return NextResponse.json({ ok: true, entry });
}
