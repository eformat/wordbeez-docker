import { NextRequest, NextResponse } from 'next/server';
import { getGameState, pushAction, popActions } from '@/lib/gameStore';

// GET /api/game — return current game state
export async function GET() {
  const state = getGameState();
  return NextResponse.json(state);
}

// POST /api/game — submit an action or poll pending actions
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  if (action === 'get_pending') {
    // Client polls this to get actions queued by the agent
    const actions = popActions();
    return NextResponse.json({ actions });
  }

  if (action === 'start') {
    const mode = body.mode || '1player';
    const id = pushAction({ action: 'start', mode });
    return NextResponse.json({ ok: true, actionId: id, message: `Queued start game (${mode})` });
  }

  if (action === 'submit_word') {
    const { cells } = body;
    if (!cells || !Array.isArray(cells)) {
      return NextResponse.json({ error: 'cells array required' }, { status: 400 });
    }
    const id = pushAction({ action: 'submit_word', cells });
    return NextResponse.json({ ok: true, actionId: id, message: `Queued word submission: cells ${cells}` });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
