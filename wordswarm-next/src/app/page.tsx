'use client';

import { useState, useEffect, useRef } from 'react';
import MainMenu from '@/components/MainMenu';
import GamePage from '@/components/GamePage';
import HowToPlay from '@/components/HowToPlay';
import { sounds } from '@/lib/sounds';

type Screen = 'main' | 'game' | 'howto';

export default function Home() {
  const [screen, setScreen] = useState<Screen>('main');
  const [gameMode, setGameMode] = useState<'1player' | '2players'>('1player');
  const [soundEffectsOn] = useState(true);
  const [themeMusicOn] = useState(true);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Scale to fit viewport (replicating scaleBody.js)
  useEffect(() => {
    function handleResize() {
      const availW = window.innerWidth;
      const availH = window.innerHeight;
      const scaleW = availW / 1024;
      const scaleH = availH / 600;
      const s = Math.min(scaleW, scaleH);
      setScale(s);
      setOffset({
        x: (availW - 1024 * s) / 2,
        y: (availH - 600 * s) / 2,
      });
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Play intro sound on first interaction
  useEffect(() => {
    const handleClick = () => {
      sounds.wordSwarmVoice.play();
      if (themeMusicOn) sounds.themeMusic.play();
      window.removeEventListener('click', handleClick);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [themeMusicOn]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        left: offset.x,
        top: offset.y,
        width: 1024,
        height: 600,
        transform: `scale(${scale})`,
        transformOrigin: '0 0',
        overflow: 'hidden',
        boxShadow: '5px 5px 20px black',
        cursor: 'default',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {screen === 'main' && (
        <MainMenu
          onStartGame={(mode) => {
            sounds.themeMusic.stop();
            setGameMode(mode);
            setScreen('game');
          }}
          onHowToPlay={() => {
            sounds.themeMusic.stop();
            setScreen('howto');
          }}
        />
      )}

      {screen === 'game' && (
        <GamePage
          mode={gameMode}
          soundEffectsOn={soundEffectsOn}
          onMainMenu={() => {
            setScreen('main');
            if (themeMusicOn) sounds.themeMusic.play();
          }}
        />
      )}

      {screen === 'howto' && (
        <HowToPlay
          onMainMenu={() => {
            setScreen('main');
            if (themeMusicOn) sounds.themeMusic.play();
          }}
        />
      )}
    </div>
  );
}
