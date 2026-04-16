import { NextRequest, NextResponse } from 'next/server';
import { startAgent, stopAgent, getAgentState, getLogsSince } from '@/lib/agentProcess';
import { getSelectedModel } from '@/lib/gameStore';
import { getSessionId } from '@/lib/sessionId';

export const dynamic = 'force-dynamic';

// GET /api/agent — get agent state or poll logs
export async function GET(request: NextRequest) {
  const sessionId = getSessionId(request);
  const sinceParam = request.nextUrl.searchParams.get('since');

  if (sinceParam !== null) {
    // Poll for new logs since index
    const fromIndex = parseInt(sinceParam, 10) || 0;
    const result = getLogsSince(sessionId, fromIndex);
    return NextResponse.json(result);
  }

  return NextResponse.json(getAgentState(sessionId));
}

// POST /api/agent — start or stop the agent
export async function POST(request: NextRequest) {
  const sessionId = getSessionId(request);
  const body = await request.json();
  const { action } = body;

  if (action === 'start') {
    const token = process.env.MODEL_TOKEN || '';
    if (!token) {
      return NextResponse.json({ ok: false, message: 'MODEL_TOKEN env var not set' }, { status: 500 });
    }
    const gameUrl = `http://127.0.0.1:${process.env.PORT || 3000}`;
    const saved = getSelectedModel(sessionId);
    const result = startAgent(sessionId, {
      GAME_URL: gameUrl,
      MODEL_URL: body.modelUrl || saved?.url || 'https://maas.apps.ocp.cloud.rhai-tmm.dev/kimi-k25/kimi-k2-5/v1',
      MODEL_NAME: body.modelName || saved?.id || 'kimi-k2-5',
      MODEL_TOKEN: token,
    });
    return NextResponse.json(result);
  }

  if (action === 'stop') {
    const result = stopAgent(sessionId);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
