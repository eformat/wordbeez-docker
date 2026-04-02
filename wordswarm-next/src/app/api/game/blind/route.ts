import { NextResponse } from 'next/server';
import { getGameState } from '@/lib/gameStore';

export const dynamic = 'force-dynamic';

// GET /api/game/blind — return only what a human player can see
// No wordList, no cell positions — just letters, hints, and game status
export async function GET() {
  const state = getGameState();

  // Build hints: first letter + word length for each word (what the word list UI shows)
  const hints = state.wordList.map((w, i) => {
    const revealed = state.revealedWords[i] || [];
    const allRevealed = revealed.length > 0 && revealed.every(Boolean);
    return {
      firstLetter: w.word[0],
      length: w.word.length,
      revealedLetters: w.word.split('').map((ch, j) =>
        j === 0 || revealed[j] ? ch : null
      ),
      solved: allRevealed,
    };
  });

  return NextResponse.json({
    phase: state.phase,
    level: state.level,
    score: state.score,
    honeyLevel: state.honeyLevel,
    timeLeft: state.timeLeft,
    letters: state.letters,
    honeycombVisible: state.honeycombVisible,
    hints,
    mode: state.mode,
  });
}
