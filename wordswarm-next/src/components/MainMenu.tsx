'use client';

import { useState, useEffect } from 'react';

interface MainMenuProps {
  onStartGame: (mode: '1player' | '2players') => void;
  onHowToPlay: () => void;
}

export default function MainMenu({ onStartGame, onHowToPlay }: MainMenuProps) {
  const [wingState, setWingState] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setWingState((prev) => ((prev + 1) % 3) as 0 | 1 | 2);
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const wingImages = [
    '/images/Wings-MainMenu-Static.png',
    '/images/Wings-MainMenu-midState.png',
    '/images/Wings-MainMenu-buzzing.png',
  ];

  const wingWidths = [106, 133, 133];
  const wingLefts = [462, 452, 447];

  return (
    <div
      style={{
        backgroundImage: 'url(/images/MainMenu-background.png)',
        width: 1024,
        height: 600,
        position: 'relative',
      }}
    >
      {/* License button */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          width: 30,
          height: 30,
          borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.3)',
          textAlign: 'center',
          lineHeight: '30px',
          fontFamily: 'serif',
          fontSize: 18,
          color: '#fff',
          cursor: 'pointer',
        }}
      >
        i
      </div>

      {/* Bee */}
      <div
        style={{
          position: 'absolute',
          top: 124,
          left: 446,
          width: 141,
          height: 152,
          backgroundImage: 'url(/images/Bee-MainMenu.png)',
        }}
      />

      {/* Wings animation */}
      <div
        style={{
          position: 'absolute',
          top: 169,
          left: wingLefts[wingState],
          width: wingWidths[wingState],
          height: 90,
          backgroundImage: `url(${wingImages[wingState]})`,
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* 1 Player button */}
      <div onClick={() => onStartGame('1player')} style={{ cursor: 'pointer' }}>
        <div style={{ position: 'absolute', bottom: 12, left: 250, width: 45, height: 60, backgroundImage: 'url(/images/SilverButton-leftcurve.png)' }} />
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            left: 290,
            width: 100,
            height: 40,
            backgroundImage: 'url(/images/SilverButton-centervertical.png)',
            backgroundRepeat: 'repeat-x',
            font: '14pt "Lato Black"',
            textAlign: 'center',
            lineHeight: '160%',
            color: '#393739',
            zIndex: 2,
          }}
        >
          1 PLAYER
        </div>
        <div style={{ position: 'absolute', bottom: 12, left: 385, width: 45, height: 60, backgroundImage: 'url(/images/SilverButton-rightcurve.png)' }} />
      </div>

      {/* 2 Players button */}
      <div onClick={() => onStartGame('2players')} style={{ cursor: 'pointer' }}>
        <div style={{ position: 'absolute', bottom: 12, left: 403, width: 45, height: 60, backgroundImage: 'url(/images/SilverButton-leftcurve.png)' }} />
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            left: 448,
            width: 100,
            height: 40,
            backgroundImage: 'url(/images/SilverButton-centervertical.png)',
            backgroundRepeat: 'repeat-x',
            font: '14pt "Lato Black"',
            textAlign: 'center',
            lineHeight: '160%',
            color: '#393739',
            zIndex: 2,
          }}
        >
          2 PLAYERS
        </div>
        <div style={{ position: 'absolute', bottom: 12, left: 544, width: 45, height: 60, backgroundImage: 'url(/images/SilverButton-rightcurve.png)' }} />
      </div>

      {/* How To Play button */}
      <div onClick={onHowToPlay} style={{ cursor: 'pointer' }}>
        <div style={{ position: 'absolute', bottom: 12, left: 560, width: 45, height: 60, backgroundImage: 'url(/images/SilverButton-leftcurve.png)' }} />
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            left: 605,
            width: 150,
            height: 40,
            backgroundImage: 'url(/images/SilverButton-centervertical.png)',
            backgroundRepeat: 'repeat-x',
            font: '14pt "Lato Black"',
            textAlign: 'center',
            lineHeight: '160%',
            color: '#393739',
            zIndex: 2,
          }}
        >
          HOW TO PLAY
        </div>
        <div style={{ position: 'absolute', bottom: 12, left: 755, width: 45, height: 60, backgroundImage: 'url(/images/SilverButton-rightcurve.png)' }} />
      </div>
    </div>
  );
}
