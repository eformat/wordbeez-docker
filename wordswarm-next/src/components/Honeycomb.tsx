'use client';

import { getAllCellPositions } from '@/lib/gameEngine';

// CSS position maps matching the original wordswarm.css
const HONEYCOMB_COL: Record<number, number> = { 1: 9, 2: 111, 3: 212, 4: 313, 5: 414 };
const HONEYCOMB_ROW: Record<number, number> = { 1: 7, 2: 64, 3: 124, 4: 182, 5: 240, 6: 298, 7: 357 };
const LETTER_COL: Record<number, number> = { 1: 45, 2: 145, 3: 246, 4: 347, 5: 448 };

interface HoneycombProps {
  letters: string[];
  visible: boolean[];
  selected: boolean[];
  onMouseDown: (cellNum: number) => void;
  onMouseOver: (cellNum: number) => void;
  onMouseUp: () => void;
}

export default function Honeycomb({ letters, visible, selected, onMouseDown, onMouseOver, onMouseUp }: HoneycombProps) {
  const positions = getAllCellPositions();

  return (
    <div
      style={{
        position: 'absolute',
        top: 61,
        left: 218,
        width: 553,
        height: 478,
      }}
      onMouseUp={onMouseUp}
      onTouchEnd={onMouseUp}
    >
      {positions.map((pos, idx) => {
        const cellNum = idx + 1;
        if (!visible[idx]) return null;

        const left = HONEYCOMB_COL[pos.col];
        const top = HONEYCOMB_ROW[pos.row];
        const letterLeft = LETTER_COL[pos.col];
        const letter = letters[idx];

        let letterMarginLeft = 0;
        let letterPaddingTop = 0;
        if (letter === 'W') {
          letterMarginLeft = -10;
          letterPaddingTop = 5;
        } else if (letter === 'M') {
          letterMarginLeft = -4;
        }

        return (
          <div key={idx}>
            {/* Honeycomb hexagon */}
            <div
              style={{
                position: 'absolute',
                width: 130,
                height: 114,
                left,
                top,
                backgroundImage: selected[idx]
                  ? 'url(/images/HoneyComb-hexagon-rollover.png)'
                  : 'url(/images/HoneyComb-hexagon.png)',
              }}
            />
            {/* Letter overlay */}
            <div
              data-cell={cellNum}
              style={{
                position: 'absolute',
                width: 66,
                height: 114,
                left: letterLeft,
                top,
                textAlign: 'center',
                fontFamily: '"Lato Black", sans-serif',
                fontSize: '57pt',
                lineHeight: '140%',
                color: '#221e1f',
                marginLeft: letterMarginLeft,
                paddingTop: letterPaddingTop,
                cursor: 'pointer',
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                onMouseDown(cellNum);
              }}
              onMouseOver={(e) => {
                e.preventDefault();
                onMouseOver(cellNum);
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                onMouseDown(cellNum);
              }}
              onTouchMove={(e) => {
                if (e.changedTouches.length !== 1) return;
                e.preventDefault();
                const touch = e.changedTouches[0];
                const elt = document.elementFromPoint(touch.clientX, touch.clientY);
                if (elt) {
                  const cn = (elt as HTMLElement).dataset.cell;
                  if (cn) onMouseOver(parseInt(cn));
                }
              }}
            >
              {letter}
            </div>
          </div>
        );
      })}
    </div>
  );
}
