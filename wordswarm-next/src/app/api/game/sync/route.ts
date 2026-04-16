import { NextRequest, NextResponse } from 'next/server';
import { updateGameState } from '@/lib/gameStore';
import { getSessionId } from '@/lib/sessionId';

// POST /api/game/sync — client pushes state updates here
export async function POST(request: NextRequest) {
  const sessionId = getSessionId(request);
  const body = await request.json();
  updateGameState(sessionId, body);
  return NextResponse.json({ ok: true });
}
