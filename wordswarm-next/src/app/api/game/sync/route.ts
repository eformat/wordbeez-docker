import { NextRequest, NextResponse } from 'next/server';
import { updateGameState } from '@/lib/gameStore';

// POST /api/game/sync — client pushes state updates here
export async function POST(request: NextRequest) {
  const body = await request.json();
  updateGameState(body);
  return NextResponse.json({ ok: true });
}
