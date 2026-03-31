'use client';

interface HoneyMeterProps {
  honeyLevel: number;
  visible: boolean;
}

export default function HoneyMeter({ honeyLevel, visible }: HoneyMeterProps) {
  if (!visible) return null;

  let radius = 0;
  if (honeyLevel > 185) {
    radius = 15 - (200 - honeyLevel);
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 182,
        left: 66,
        width: 69,
        height: honeyLevel,
        background: 'linear-gradient(to top, #ffc220, #ffffff)',
        borderTopLeftRadius: radius,
        borderTopRightRadius: radius,
        borderBottomLeftRadius: 15,
        borderBottomRightRadius: 15,
      }}
    />
  );
}
