'use client';

import { getAllCellPositions } from '@/lib/gameEngine';

const BEE_COL: Record<number, number> = { 1: 23, 2: 126, 3: 227, 4: 328, 5: 429 };
const BEE_ROW: Record<number, number> = { 1: 5, 2: 58, 3: 120, 4: 178, 5: 236, 6: 295, 7: 352 };
const WINGS_COL: Record<number, number> = { 1: 40, 2: 143, 3: 244, 4: 345, 5: 446 };
const WINGS_ROW: Record<number, number> = { 1: 35, 2: 90, 3: 152, 4: 208, 5: 266, 6: 327, 7: 384 };

export default function Bees({ show }: { show: boolean }) {
  const positions = getAllCellPositions();

  if (!show) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 61,
        left: 218,
        width: 553,
        height: 478,
      }}
    >
      {positions.map((pos, idx) => (
        <div key={idx}>
          <div
            style={{
              position: 'absolute',
              width: 100,
              height: 116,
              left: BEE_COL[pos.col],
              top: BEE_ROW[pos.row],
              backgroundImage: 'url(/images/Bee-regularsize.png)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: 73,
              height: 63,
              left: WINGS_COL[pos.col],
              top: WINGS_ROW[pos.row],
              backgroundImage: 'url(/images/Wings-RegularSize-Static.png)',
              animation: 'showBeeWings 4.5s linear',
            }}
          />
        </div>
      ))}
    </div>
  );
}
