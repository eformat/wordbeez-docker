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

interface GamePageProps {
  mode: '1player' | '2players';
  soundEffectsOn: boolean;
  onMainMenu: () => void;
}

export default function GamePage({ mode, soundEffectsOn, onMainMenu }: GamePageProps) {
  const [phase, setPhase] = useState<'intro' | 'go' | 'playing' | 'levelComplete' | 'gameOver' | 'paused' | 'p1done'>('intro');
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

  phaseRef.current = phase;

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

          if (lettersFoundRef.current >= 17) {
            setPuzzlesCompleted((prev) => {
              const newCompleted = prev + 1;
              if (newCompleted >= 3) {
                // Level completed
                setShowLevelMsg(true);
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

      {/* Game Over - 1 player */}
      {phase === 'gameOver' && mode === '1player' && (
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
          <div
            onClick={() => handleGameOverAction('playAgain')}
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
