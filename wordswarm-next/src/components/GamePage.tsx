'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Honeycomb from './Honeycomb';
import Bees from './Bees';
import WordList from './WordList';
import HoneyMeter from './HoneyMeter';
import {
  buildPuzzle,
  validateMove,
  validateSelectedWord,
  formatTime,
  WordObject,
} from '@/lib/gameEngine';
import { sounds } from '@/lib/sounds';

// Sync game state to the server-side store via API
async function syncState(state: Record<string, unknown>) {
  try {
    await fetch('/api/game/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
  } catch {}
}

interface GamePageProps {
  mode: '1player' | '2players';
  soundEffectsOn: boolean;
  themeMusicOn: boolean;
  onSoundToggle: (on: boolean) => void;
  onMusicToggle: (on: boolean) => void;
  onMainMenu: () => void;
  onScoreSubmitted?: (entryId: string) => void;
}

export default function GamePage({ mode, soundEffectsOn, themeMusicOn, onSoundToggle, onMusicToggle, onMainMenu, onScoreSubmitted }: GamePageProps) {
  const [phase, setPhase] = useState<'intro' | 'go' | 'playing' | 'levelComplete' | 'gameOver' | 'paused' | 'p1done'>('intro');
  const [showSettings, setShowSettings] = useState(false);
  const [showNameEntry, setShowNameEntry] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [scoreSaved, setScoreSaved] = useState(false);
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [honeyLevel, setHoneyLevel] = useState(200);
  const [timeLeft, setTimeLeft] = useState(180);
  const [letters, setLetters] = useState<string[]>(Array(17).fill(' '));
  const [wordList, setWordList] = useState<WordObject[]>([]);
  const [revealedWords, setRevealedWords] = useState<boolean[][]>([]);
  const [honeycombVisible, setHoneycombVisible] = useState<boolean[]>(Array(17).fill(false));
  const [honeycombSelected, setHoneycombSelected] = useState<boolean[]>(Array(17).fill(false));
  const [showWrongGuess, setShowWrongGuess] = useState(false);
  const [showBees, setShowBees] = useState(false);
  const [puzzlesCompleted, setPuzzlesCompleted] = useState(0);
  const [showLevelMsg, setShowLevelMsg] = useState(false);

  // 2-player state
  const [playerId, setPlayerId] = useState(1);
  const [player1Score, setPlayer1Score] = useState(0);
  const [showP1Score, setShowP1Score] = useState(false);

  const wordsDataRef = useRef<string[]>([]);
  const wordsUsedRef = useRef<Set<number>>(new Set());
  const movesRef = useRef<number[]>([]);
  const wordBeginRef = useRef(false);
  const lettersFoundRef = useRef(0);
  const honeyLevelRef = useRef(200);
  const honeyDrainRateRef = useRef(1);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const phaseRef = useRef(phase);
  const scoreRef = useRef(0);
  const puzzleTransitionRef = useRef(false);
  const levelTransitionRef = useRef(false);

  phaseRef.current = phase;

  // Sync state to server for agent API access
  useEffect(() => {
    syncState({
      phase, level, score, honeyLevel, timeLeft,
      letters, wordList, revealedWords, honeycombVisible,
      mode, playerId, player1Score,
    });
  }, [phase, level, score, honeyLevel, timeLeft, letters, wordList, revealedWords, honeycombVisible, mode, playerId, player1Score]);

  // Load word list
  useEffect(() => {
    fetch('/data/words.json')
      .then((r) => r.json())
      .then((data) => {
        wordsDataRef.current = data;
      });
  }, []);

  // Intro animation
  useEffect(() => {
    if (soundEffectsOn) sounds.beesAppear.play();
    const t1 = setTimeout(() => setShowBees(true), 500);
    const t2 = setTimeout(() => {
      setShowBees(false);
      setPhase('go');
    }, 2000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [soundEffectsOn]);

  const startNewPuzzle = useCallback((lvl: number) => {
    if (wordsDataRef.current.length === 0) return;
    wordsUsedRef.current = new Set();
    const puzzle = buildPuzzle(wordsDataRef.current, wordsUsedRef.current);
    setLetters(puzzle.letters);
    setWordList(puzzle.wordList);
    setHoneycombVisible(puzzle.honeycombVisible);
    setHoneycombSelected(Array(17).fill(false));
    setRevealedWords(puzzle.wordList.map(() => []));
    lettersFoundRef.current = 0;
    puzzleTransitionRef.current = false;
    levelTransitionRef.current = false;
  }, []);

  const startGame = useCallback(() => {
    const lvl = 1;
    setLevel(lvl);
    setScore(0);
    scoreRef.current = 0;
    setHoneyLevel(200);
    honeyLevelRef.current = 200;
    honeyDrainRateRef.current = 1;
    setTimeLeft(180);
    setPuzzlesCompleted(0);
    setPhase('playing');
    startNewPuzzle(lvl);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (phaseRef.current !== 'playing') return;

      setTimeLeft((t) => {
        if (t <= 0) {
          clearInterval(timerRef.current);
          setPhase('gameOver');
          return 0;
        }
        return t - 1;
      });

      // Drain honey
      honeyLevelRef.current -= honeyDrainRateRef.current;
      if (honeyLevelRef.current < 0) honeyLevelRef.current = 0;
      setHoneyLevel(honeyLevelRef.current);
      if (honeyLevelRef.current <= 0) {
        clearInterval(timerRef.current);
        setPhase('gameOver');
      }
    }, 1000);
  }, [startNewPuzzle]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const nextLevel = useCallback(() => {
    setLevel((prev) => {
      const newLevel = prev + 1;
      honeyDrainRateRef.current = Math.min(newLevel, 20);
      startNewPuzzle(newLevel);
      setHoneyLevel(200);
      honeyLevelRef.current = 200;
      setTimeLeft(180);
      setPuzzlesCompleted(0);
      setPhase('playing');

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        if (phaseRef.current !== 'playing') return;
        setTimeLeft((t) => {
          if (t <= 0) {
            clearInterval(timerRef.current);
            setPhase('gameOver');
            return 0;
          }
          return t - 1;
        });
        honeyLevelRef.current -= honeyDrainRateRef.current;
        if (honeyLevelRef.current < 0) honeyLevelRef.current = 0;
        setHoneyLevel(honeyLevelRef.current);
        if (honeyLevelRef.current <= 0) {
          clearInterval(timerRef.current);
          setPhase('gameOver');
        }
      }, 1000);

      return newLevel;
    });
  }, [startNewPuzzle]);

  const handleMouseDown = useCallback((cellNum: number) => {
    if (phaseRef.current !== 'playing') return;
    wordBeginRef.current = true;
    movesRef.current = [];
    const result = validateMove([], cellNum);
    if (result.valid) {
      movesRef.current = result.newMoves;
      setHoneycombSelected((prev) => {
        const next = [...prev];
        next[cellNum - 1] = true;
        return next;
      });
      if (soundEffectsOn) sounds.chooseWord.play();
    }
  }, [soundEffectsOn]);

  const handleMouseOver = useCallback((cellNum: number) => {
    if (!wordBeginRef.current || phaseRef.current !== 'playing') return;
    const result = validateMove(movesRef.current, cellNum);
    if (result.valid) {
      // Unselect any backtracked cells
      for (const c of result.unselect) {
        setHoneycombSelected((prev) => {
          const next = [...prev];
          next[c - 1] = false;
          return next;
        });
      }
      movesRef.current = result.newMoves;
      setHoneycombSelected((prev) => {
        const next = [...prev];
        next[cellNum - 1] = true;
        return next;
      });
      if (soundEffectsOn) sounds.chooseWord.play();
    }
  }, [soundEffectsOn]);

  const handleMouseUp = useCallback(() => {
    wordBeginRef.current = false;
    const moves = movesRef.current;
    if (moves.length === 0) return;

    setLetters((currentLetters) => {
      setWordList((currentWordList) => {
        const result = validateSelectedWord(moves, currentLetters, currentWordList);
        if (result.matched) {
          // Remove matched cells
          const matchedCells = currentWordList[result.wordIndex].cells;
          setHoneycombVisible((prev) => {
            const next = [...prev];
            for (const c of matchedCells) next[c] = false;
            return next;
          });

          // Reveal word
          setRevealedWords((prev) => {
            const next = [...prev];
            next[result.wordIndex] = currentWordList[result.wordIndex].word.split('').map(() => true);
            return next;
          });

          // Update score
          const newScore = scoreRef.current + result.score;
          scoreRef.current = newScore;
          setScore(newScore);

          // Restore honey
          honeyLevelRef.current = Math.min(200, honeyLevelRef.current + result.score * honeyDrainRateRef.current);
          setHoneyLevel(honeyLevelRef.current);

          lettersFoundRef.current += result.score;

          if (lettersFoundRef.current >= 17 && !puzzleTransitionRef.current) {
            puzzleTransitionRef.current = true;
            setPuzzlesCompleted((prev) => {
              const newCompleted = prev + 1;
              if (newCompleted >= 3 && !levelTransitionRef.current) {
                // Level completed
                levelTransitionRef.current = true;
                setShowLevelMsg(true);
                setPhase('levelComplete');
                if (timerRef.current) clearInterval(timerRef.current);
                setTimeout(() => {
                  setShowLevelMsg(false);
                  nextLevel();
                }, 3000);
              } else {
                // Next puzzle
                setTimeout(() => {
                  if (wordsDataRef.current.length > 0) {
                    wordsUsedRef.current = new Set();
                    const puzzle = buildPuzzle(wordsDataRef.current, wordsUsedRef.current);
                    setLetters(puzzle.letters);
                    setWordList(puzzle.wordList);
                    setHoneycombVisible(puzzle.honeycombVisible);
                    setHoneycombSelected(Array(17).fill(false));
                    setRevealedWords(puzzle.wordList.map(() => []));
                    lettersFoundRef.current = 0;
                    puzzleTransitionRef.current = false;
                  }
                }, 1000);
              }
              return newCompleted;
            });
          }
        } else {
          // Wrong guess
          setShowWrongGuess(true);
          if (soundEffectsOn) sounds.negativeBuzzer.play();
          setTimeout(() => setShowWrongGuess(false), 1000);
        }

        // Clear selection
        setHoneycombSelected(Array(17).fill(false));
        return currentWordList;
      });
      return currentLetters;
    });

    movesRef.current = [];
  }, [nextLevel, soundEffectsOn]);

  const handlePause = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('paused');
  }, []);

  const handleResume = useCallback(() => {
    setPhase('playing');
    timerRef.current = setInterval(() => {
      if (phaseRef.current !== 'playing') return;
      setTimeLeft((t) => {
        if (t <= 0) {
          clearInterval(timerRef.current);
          setPhase('gameOver');
          return 0;
        }
        return t - 1;
      });
      honeyLevelRef.current -= honeyDrainRateRef.current;
      if (honeyLevelRef.current < 0) honeyLevelRef.current = 0;
      setHoneyLevel(honeyLevelRef.current);
      if (honeyLevelRef.current <= 0) {
        clearInterval(timerRef.current);
        setPhase('gameOver');
      }
    }, 1000);
  }, []);

  const handleGameOverAction = useCallback((action: 'playAgain' | 'mainMenu') => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (action === 'mainMenu') {
      onMainMenu();
    } else {
      if (mode === '2players') {
        if (playerId === 1) {
          setPlayer1Score(scoreRef.current);
          setShowP1Score(true);
          setTimeout(() => {
            setShowP1Score(false);
            setPlayerId(2);
            setPhase('go');
          }, 3000);
        } else {
          setPlayerId(1);
          setPhase('go');
        }
      } else {
        setPhase('go');
      }
    }
  }, [mode, onMainMenu, playerId]);

  // 2-player game over handling
  useEffect(() => {
    if (phase === 'gameOver' && mode === '2players') {
      if (playerId === 1) {
        setPlayer1Score(scoreRef.current);
        setShowP1Score(true);
        setTimeout(() => {
          setShowP1Score(false);
          setPlayerId(2);
          setPhase('go');
        }, 3000);
      }
    }
  }, [phase, mode, playerId]);

  const get2PlayerWinner = () => {
    if (scoreRef.current > player1Score) return 2;
    if (scoreRef.current < player1Score) return 1;
    return 0;
  };

  // Poll for agent actions (must be after all handler definitions)
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/game', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_pending' }),
        });
        const data = await res.json();
        if (data.actions && data.actions.length > 0) {
          // Process actions sequentially with delays to let React state settle
          let delay = 0;
          for (const act of data.actions) {
            if (act.action === 'start') {
              if (delay === 0) { startGame(); } else { setTimeout(() => startGame(), delay); }
            } else if (act.action === 'submit_word' && act.cells) {
              const cells: number[] = act.cells;
              if (cells.length > 0) {
                const d = delay;
                setTimeout(() => {
                  handleMouseDown(cells[0]);
                  for (let i = 1; i < cells.length; i++) {
                    handleMouseOver(cells[i]);
                  }
                  setTimeout(() => handleMouseUp(), 50);
                }, d);
                delay += 150;
              }
            }
          }
        }
      } catch {}
    }, 200);
    return () => clearInterval(pollInterval);
  }, [startGame, handleMouseDown, handleMouseOver, handleMouseUp]);

  return (
    <div
      style={{
        width: 1024,
        height: 600,
        backgroundImage: 'url(/images/GameBoard-background.png)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Clock */}
      {phase === 'playing' && (
        <div
          style={{
            position: 'absolute',
            top: 48,
            right: 146,
            fontFamily: 'courier, monospace',
            fontSize: 28,
            color: '#ffc220',
          }}
        >
          {formatTime(timeLeft)}
        </div>
      )}

      {/* Score */}
      {phase === 'playing' && (
        <>
          <div
            style={{
              position: 'absolute',
              bottom: 392,
              right: 95,
              fontFamily: 'Oswald, sans-serif',
              fontSize: '44pt',
              color: '#393739',
            }}
          >
            {score}
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: 411,
              right: 50,
              fontFamily: '"Lato Black", sans-serif',
              fontSize: '15pt',
              color: '#393739',
            }}
          >
            PTS.
          </div>
        </>
      )}

      {/* Labels */}
      <div style={{ position: 'absolute', bottom: 370, right: 184, width: 27, height: 1, background: '#ffc220' }} />
      <div style={{ position: 'absolute', bottom: 360, right: 72, fontFamily: '"Lato Black"', fontSize: 18, color: '#929497' }}>
        IN THE HIVE
      </div>
      <div style={{ position: 'absolute', bottom: 370, right: 37, width: 27, height: 1, background: '#ffc220' }} />
      <div style={{ position: 'absolute', bottom: 136, left: 72, fontFamily: '"Lato Black"', fontSize: '21pt', color: '#393739' }}>
        LIFE
      </div>

      {/* Level label */}
      {phase === 'playing' && (
        <div
          style={{
            position: 'absolute',
            bottom: 90,
            right: 75,
            font: '20pt "Lato Black"',
            color: '#393739',
          }}
        >
          LEVEL {level}
        </div>
      )}

      {/* Honeycomb backgrounds */}
      <div
        style={{
          position: 'absolute',
          top: 61,
          left: 218,
          width: 553,
          height: 478,
          backgroundImage: 'url(/images/HoneycombMatrix-DarkBrown.png)',
          display: phase === 'playing' || phase === 'paused' ? 'block' : 'none',
        }}
      />

      {/* Grey honeycomb (shown during go screen) */}
      {phase === 'go' && (
        <div
          style={{
            position: 'absolute',
            top: 61,
            left: 218,
            width: 553,
            height: 478,
            backgroundImage: 'url(/images/HoneycombMatrix-Grey.png)',
          }}
        />
      )}

      {/* Honeycombs */}
      {phase === 'playing' && (
        <Honeycomb
          letters={letters}
          visible={honeycombVisible}
          selected={honeycombSelected}
          onMouseDown={handleMouseDown}
          onMouseOver={handleMouseOver}
          onMouseUp={handleMouseUp}
        />
      )}

      {/* Bees intro animation */}
      <Bees show={showBees} />

      {/* Honey meter */}
      <HoneyMeter honeyLevel={honeyLevel} visible={phase === 'playing'} />

      {/* Word list */}
      {phase === 'playing' && <WordList wordList={wordList} revealedWords={revealedWords} />}

      {/* Wrong guess X */}
      {showWrongGuess && (
        <div
          style={{
            position: 'absolute',
            top: 208,
            left: 407,
            width: 177,
            height: 183,
            backgroundImage: 'url(/images/X-wrongword.png)',
            animation: 'fadeInOut 1s',
          }}
        />
      )}

      {/* Level completed message */}
      {showLevelMsg && (
        <div
          style={{
            position: 'absolute',
            top: '40%',
            width: '100%',
            textAlign: 'center',
            font: '50pt "Lato Black"',
            color: 'white',
            animation: 'blink 2s linear infinite',
          }}
        >
          Level {level} Completed!
        </div>
      )}

      {/* Settings button */}
      {phase === 'playing' && (
        <div
          onClick={() => setShowSettings(true)}
          style={{
            position: 'absolute',
            right: 0,
            bottom: 13,
            width: 65,
            height: 42,
            backgroundImage: 'url(/images/Settings-button.png)',
            cursor: 'pointer',
          }}
        />
      )}

      {/* Pause button */}
      {phase === 'playing' && (
        <div
          onClick={handlePause}
          style={{
            position: 'absolute',
            bottom: 22,
            left: 447,
            width: 95,
            height: 80,
            backgroundImage: 'url(/images/Pause-button.png)',
            cursor: 'pointer',
          }}
        />
      )}

      {/* GO window - 1 player */}
      {phase === 'go' && mode === '1player' && (
        <div
          style={{
            position: 'absolute',
            top: 184,
            left: 360,
            width: 269,
            height: 232,
            backgroundImage: 'url(/images/GoWindow-1player.png)',
          }}
        >
          <div style={{ position: 'absolute', top: 30, left: 98, fontFamily: '"Lato Black"', fontSize: '14pt', color: '#ffc220' }}>
            LEVEL {level}
          </div>
          <div style={{ position: 'absolute', top: 60, left: 60, fontFamily: 'Oswald', fontSize: 35, color: '#e0e0e1' }}>
            BRING ON
          </div>
          <div style={{ position: 'absolute', top: 105, left: 60, fontFamily: 'Oswald', fontSize: 35, color: '#ffc220' }}>
            THE BEES!
          </div>
          <div
            onClick={startGame}
            style={{
              position: 'absolute',
              top: 170,
              left: 100,
              fontFamily: '"Lato Black"',
              fontSize: '29pt',
              color: '#393739',
              cursor: 'pointer',
            }}
          >
            GO
          </div>
        </div>
      )}

      {/* GO window - 2 players */}
      {phase === 'go' && mode === '2players' && (
        <div
          style={{
            position: 'absolute',
            top: 184,
            left: 360,
            width: 269,
            height: 232,
            backgroundImage: 'url(/images/GoWindow-BuzzOff.png)',
          }}
        >
          <div style={{ position: 'absolute', marginTop: 30, width: '100%', textAlign: 'center', font: '14pt "Lato Black"', color: '#ffc220' }}>
            LEVEL 1
          </div>
          <div style={{ position: 'absolute', marginTop: 52, width: '100%', textAlign: 'center', font: '34pt Oswald', color: '#e0e0e1' }}>
            BUZZ-OFF
          </div>
          <div style={{ position: 'absolute', marginTop: 105, width: '100%', textAlign: 'center', font: '24pt Oswald', color: '#ffc220' }}>
            GET READY!
          </div>
          <div style={{ position: 'absolute', marginTop: 160, width: '100%', textAlign: 'center', font: '14pt "Lato Black"', color: '#393739' }}>
            PLAYER {playerId}
          </div>
          <div
            onClick={startGame}
            style={{
              position: 'absolute',
              marginTop: 180,
              width: '100%',
              textAlign: 'center',
              font: '29pt "Lato Black"',
              color: '#393739',
              cursor: 'pointer',
            }}
          >
            GO
          </div>
        </div>
      )}

      {/* Pause dialog */}
      {phase === 'paused' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 1024,
            height: 600,
            backgroundColor: 'rgba(0,0,0,0.33)',
            zIndex: 99,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 184,
              left: 360,
              width: 269,
              height: 232,
              backgroundImage: 'url(/images/PauseWindow.png)',
            }}
          >
            <div style={{ position: 'relative', top: 34, left: 98, fontFamily: '"Lato Black"', fontSize: '14pt', color: '#ffc220' }}>
              Level {level}
            </div>
            <div style={{ position: 'absolute', top: 62, left: 80, fontFamily: 'Oswald', fontSize: 35, color: '#e0e0e1' }}>
              PAUSE
            </div>
            <div
              onClick={handleResume}
              style={{ position: 'absolute', top: 125, left: 60, fontFamily: '"Lato Black"', fontSize: '16.5pt', color: '#393739', cursor: 'pointer' }}
            >
              RESUME GAME
            </div>
            <div
              onClick={() => {
                if (timerRef.current) clearInterval(timerRef.current);
                onMainMenu();
              }}
              style={{ position: 'absolute', top: 180, left: 70, fontFamily: '"Lato Black"', fontSize: '16.5pt', color: '#393739', cursor: 'pointer' }}
            >
              MAIN MENU
            </div>
          </div>
        </div>
      )}

      {/* Settings dialog — positions match original CSS exactly */}
      {showSettings && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 1024,
            height: 600,
            backgroundColor: 'rgba(0,0,0,0.33)',
            zIndex: 99,
          }}
        >
          {/* Background panel */}
          <div style={{
            position: 'absolute', top: 191, left: 291,
            width: 409, height: 218,
            backgroundImage: 'url(/images/SettingsWindow.png)',
          }} />

          {/* Sound Effects label */}
          <div style={{
            position: 'absolute', top: 237, left: 331,
            fontFamily: '"Lato Black"', fontSize: '18pt', color: '#393739',
          }}>
            SOUND EFFECTS
          </div>

          {/* Sound Effects slider */}
          <div
            onClick={() => onSoundToggle(!soundEffectsOn)}
            style={{
              position: 'absolute', top: 226,
              left: soundEffectsOn ? 536 : 595,
              width: 62, height: 52,
              backgroundImage: 'url(/images/Settings-Slider.png)',
              cursor: 'pointer',
              transition: 'left 0.15s',
            }}
          />

          {/* Sound ON label */}
          <div
            onClick={() => onSoundToggle(true)}
            style={{
              position: 'absolute', top: 241, left: 550,
              fontFamily: '"Lato Black"', fontSize: '14pt',
              color: soundEffectsOn ? '#393739' : '#575758',
              cursor: 'pointer',
            }}
          >
            ON
          </div>

          {/* Sound OFF label */}
          <div
            onClick={() => onSoundToggle(false)}
            style={{
              position: 'absolute', top: 241, left: 608,
              fontFamily: '"Lato Black"', fontSize: '14pt',
              color: !soundEffectsOn ? '#393739' : '#575758',
              cursor: 'pointer',
            }}
          >
            OFF
          </div>

          {/* Theme Music label */}
          <div style={{
            position: 'absolute', top: 330, left: 341,
            fontFamily: '"Lato Black"', fontSize: '18pt', color: '#393739',
          }}>
            THEME MUSIC
          </div>

          {/* Theme Music slider */}
          <div
            onClick={() => onMusicToggle(!themeMusicOn)}
            style={{
              position: 'absolute', top: 320,
              left: themeMusicOn ? 536 : 595,
              width: 62, height: 52,
              backgroundImage: 'url(/images/Settings-Slider.png)',
              cursor: 'pointer',
              transition: 'left 0.15s',
            }}
          />

          {/* Music ON label */}
          <div
            onClick={() => onMusicToggle(true)}
            style={{
              position: 'absolute', top: 332, left: 550,
              fontFamily: '"Lato Black"', fontSize: '14pt',
              color: themeMusicOn ? '#393739' : '#575758',
              cursor: 'pointer',
            }}
          >
            ON
          </div>

          {/* Music OFF label */}
          <div
            onClick={() => onMusicToggle(false)}
            style={{
              position: 'absolute', top: 332, left: 608,
              fontFamily: '"Lato Black"', fontSize: '14pt',
              color: !themeMusicOn ? '#393739' : '#575758',
              cursor: 'pointer',
            }}
          >
            OFF
          </div>

          {/* Done button */}
          <div style={{ position: 'absolute', left: 400, top: 410, width: 45, height: 60, backgroundImage: 'url(/images/SilverButton-leftcurve.png)' }} />
          <div
            onClick={() => setShowSettings(false)}
            style={{
              position: 'absolute', left: 444, top: 430, width: 100, height: 40,
              backgroundImage: 'url(/images/SilverButton-centervertical.png)',
              backgroundRepeat: 'repeat-x',
              fontFamily: '"Lato Black"', fontSize: '16.5pt', color: '#393739',
              textAlign: 'center', lineHeight: '160%',
              cursor: 'pointer',
            }}
          >
            DONE
          </div>
          <div style={{ position: 'absolute', left: 544, top: 410, width: 45, height: 60, backgroundImage: 'url(/images/SilverButton-rightcurve.png)' }} />
        </div>
      )}

      {/* Game Over - 1 player */}
      {phase === 'gameOver' && mode === '1player' && !showNameEntry && (
        <div
          style={{
            position: 'absolute',
            top: 184,
            left: 360,
            width: 269,
            height: 232,
            backgroundImage: 'url(/images/PauseWindow.png)',
          }}
        >
          <div style={{ position: 'absolute', top: 25, right: 120, font: '35pt Oswald', color: '#e0e0e1' }}>
            {score}
          </div>
          <div style={{ position: 'absolute', top: 60, left: 160, font: '15pt "Lato Black"', color: '#e0e0e1' }}>
            PTS.
          </div>
          <div style={{ position: 'absolute', top: 85, left: 45, font: '15pt "Lato Black"', color: '#ffc220' }}>
            LEVEL REACHED: {level}
          </div>
          {!scoreSaved && (
            <div
              onClick={() => setShowNameEntry(true)}
              style={{ position: 'absolute', top: 125, left: 70, font: '14pt "Lato Black"', color: '#ffc220', cursor: 'pointer' }}
            >
              SAVE SCORE
            </div>
          )}
          <div
            onClick={() => { setScoreSaved(false); handleGameOverAction('playAgain'); }}
            style={{ position: 'absolute', top: scoreSaved ? 125 : 155, left: 70, font: '14pt "Lato Black"', color: '#393739', cursor: 'pointer' }}
          >
            PLAY AGAIN
          </div>
          <div
            onClick={() => { setScoreSaved(false); handleGameOverAction('mainMenu'); }}
            style={{ position: 'absolute', top: scoreSaved ? 155 : 185, left: 70, font: '14pt "Lato Black"', color: '#393739', cursor: 'pointer' }}
          >
            MAIN MENU
          </div>
        </div>
      )}

      {/* Name Entry Dialog */}
      {phase === 'gameOver' && showNameEntry && (
        <div
          style={{
            position: 'absolute',
            top: 150,
            left: 312,
            width: 400,
            height: 280,
            background: 'rgba(0, 0, 0, 0.92)',
            border: '2px solid #ffc220',
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div style={{ font: '22pt Oswald', color: '#ffc220', textAlign: 'center', marginBottom: 10 }}>
            SAVE YOUR SCORE
          </div>
          <div style={{ font: '30pt Oswald', color: '#e0e0e1', textAlign: 'center' }}>
            {score} <span style={{ font: '14pt "Lato Black"', color: '#929497' }}>PTS</span>
            <span style={{ font: '14pt "Lato Black"', color: '#929497', marginLeft: 20 }}>LEVEL {level}</span>
          </div>
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value.slice(0, 20))}
              placeholder="ENTER YOUR NAME"
              maxLength={20}
              autoFocus
              style={{
                width: 280,
                padding: '10px 16px',
                font: '14pt Oswald',
                color: '#e0e0e1',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid #ffc220',
                borderRadius: 6,
                outline: 'none',
                textAlign: 'center',
                letterSpacing: '0.05em',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && playerName.trim()) {
                  const name = playerName.trim();
                  fetch('/api/leaderboard', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, score, level, type: 'human' }),
                  })
                    .then(res => res.json())
                    .then(data => {
                      if (data.ok && data.entry) {
                        setShowNameEntry(false);
                        setScoreSaved(true);
                        onScoreSubmitted?.(data.entry.id);
                      }
                    })
                    .catch(() => {});
                }
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 30, marginTop: 20 }}>
            <div
              onClick={() => {
                const name = playerName.trim() || 'PLAYER';
                fetch('/api/leaderboard', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name, score, level, type: 'human' }),
                })
                  .then(res => res.json())
                  .then(data => {
                    if (data.ok && data.entry) {
                      setShowNameEntry(false);
                      setScoreSaved(true);
                      onScoreSubmitted?.(data.entry.id);
                    }
                  })
                  .catch(() => {});
              }}
              style={{ font: '16pt "Lato Black"', color: '#ffc220', cursor: 'pointer' }}
            >
              SUBMIT
            </div>
            <div
              onClick={() => setShowNameEntry(false)}
              style={{ font: '16pt "Lato Black"', color: '#929497', cursor: 'pointer' }}
            >
              CANCEL
            </div>
          </div>
        </div>
      )}

      {/* Game Over - 2 players (player 2 done) */}
      {phase === 'gameOver' && mode === '2players' && playerId === 2 && (
        <div
          style={{
            position: 'absolute',
            top: 184,
            left: 360,
            width: 269,
            height: 232,
            backgroundImage: 'url(/images/PauseWindow.png)',
          }}
        >
          {(() => {
            const winner = get2PlayerWinner();
            return (
              <>
                <div style={{ position: 'absolute', marginTop: 28, width: '100%', textAlign: 'center', font: '24pt Oswald', color: '#e0e0e1' }}>
                  {winner === 0 ? 'GAME' : `PLAYER ${winner}`}
                </div>
                <div style={{ position: 'absolute', marginTop: 60, width: '100%', textAlign: 'center', font: '30pt Oswald', color: '#ffc220' }}>
                  {winner === 0 ? 'TIES!' : 'WINS!'}
                </div>
                <div
                  onClick={() => {
                    setPlayerId(1);
                    setPhase('go');
                  }}
                  style={{ position: 'absolute', top: 130, left: 70, font: '16.5pt "Lato Black"', color: '#393739', cursor: 'pointer' }}
                >
                  PLAY AGAIN
                </div>
                <div
                  onClick={() => handleGameOverAction('mainMenu')}
                  style={{ position: 'absolute', top: 180, left: 70, font: '16.5pt "Lato Black"', color: '#393739', cursor: 'pointer' }}
                >
                  MAIN MENU
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Player 1 score flash (2-player) */}
      {showP1Score && (
        <div
          style={{
            position: 'absolute',
            top: 184,
            left: 360,
            width: 269,
            height: 232,
            backgroundImage: 'url(/images/PlayerOneScoreWindow.png)',
          }}
        >
          <div style={{ position: 'absolute', top: 60, width: '100%', textAlign: 'center', font: '28pt Oswald', color: '#e0e0e1' }}>
            {player1Score}
          </div>
          <div style={{ position: 'absolute', top: 110, width: '100%', textAlign: 'center', font: '30pt Oswald', color: '#e0e0e1' }}>
            PLAYER 1
          </div>
        </div>
      )}

      {/* 2-player labels */}
      {mode === '2players' && phase === 'playing' && (
        <>
          <div style={{ position: 'absolute', top: 20, width: 130, left: 200, font: '20pt "Lato Black"' }}>
            PLAYER 1
          </div>
          {playerId === 2 && (
            <>
              <div style={{ position: 'absolute', top: 50, width: 130, left: 200, font: '20pt "Lato Black"', textAlign: 'center' }}>
                {player1Score}
              </div>
              <div style={{ position: 'absolute', top: 20, width: 130, left: 665, font: '20pt "Lato Black"' }}>
                PLAYER 2
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
