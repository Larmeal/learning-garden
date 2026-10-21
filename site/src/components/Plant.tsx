// One plant per lesson maturity: a seed in the soil, a sprout, a small tree. Pass x/y to place it inside another SVG.
export type PlantStage = 'seed' | 'sprout' | 'evergreen';

interface Props {
  stage: PlantStage;
  size?: number;
  x?: number;
  y?: number;
  sway?: boolean;
}

export default function Plant({ stage, size = 48, x, y, sway = false }: Props) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} x={x} y={y} aria-hidden="true" focusable="false" overflow="visible">
      <ellipse cx="24" cy="41" rx="16" ry="5" fill="var(--soil)" />
      <g className={sway ? 'sway' : undefined}>
        {stage === 'seed' && (
          <>
            <ellipse cx="24" cy="37.5" rx="4.2" ry="2.8" fill="var(--soil-dark)" />
            <path d="M24 36 C24 32 26 30 29 29.5" stroke="var(--leaf)" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          </>
        )}
        {stage === 'sprout' && (
          <>
            <path d="M24 40 V23" stroke="var(--leaf-2)" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M24 29 C16 29.5 12.5 23.5 13.5 18.5 C20 18.5 24 22 24 29 Z" fill="var(--leaf)" />
            <path d="M24 24 C32 24.5 35.5 18.5 34.5 13.5 C28 13.5 24 17 24 24 Z" fill="var(--leaf-2)" />
          </>
        )}
        {stage === 'evergreen' && (
          <>
            <path d="M24 40 V22" stroke="var(--soil-dark)" strokeWidth="4" strokeLinecap="round" fill="none" />
            <circle cx="15.5" cy="22" r="8" fill="var(--leaf-2)" />
            <circle cx="32.5" cy="22" r="8" fill="var(--leaf-2)" />
            <circle cx="24" cy="15" r="11" fill="var(--leaf)" />
            <circle cx="19.5" cy="13.5" r="2.2" fill="var(--sun)" />
            <circle cx="29.5" cy="19" r="2.2" fill="var(--sun)" />
          </>
        )}
      </g>
    </svg>
  );
}
