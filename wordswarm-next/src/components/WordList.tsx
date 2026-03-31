'use client';

import { WordObject } from '@/lib/gameEngine';

interface WordListProps {
  wordList: WordObject[];
  revealedWords: boolean[][];
}

export default function WordList({ wordList, revealedWords }: WordListProps) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 162,
        right: 55,
        width: 160,
        height: 176,
      }}
    >
      {wordList.map((wordObj, i) => (
        <div key={i}>
          {wordObj.word.split('').map((char, j) => {
            const revealed = revealedWords[i]?.[j] || false;
            const isFirst = j === 0;
            return (
              <div
                key={j}
                style={{
                  position: 'absolute',
                  fontFamily: '"Lato Black", sans-serif',
                  width: 18,
                  marginRight: 1,
                  textAlign: 'center',
                  fontSize: '12pt',
                  color: '#ffffff',
                  borderBottom: '3px ridge #aeaeae',
                  top: i * 27,
                  left: j * 25 + 5,
                }}
              >
                {isFirst || revealed ? char : '\u2003'}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
