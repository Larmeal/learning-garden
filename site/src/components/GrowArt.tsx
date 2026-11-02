// A little living scene with one plant, used on lesson intro and outro cards. The plant leans away from the cursor, squashes when
// pressed, and bursts into leaves whenever its stage changes (for example when the learner ticks the lesson as finished).
import { useEffect, useRef } from 'react';
import Plant, { type PlantStage } from './Plant';
import { BurstLayer, Critter, useBursts, useGarden } from './useGarden';
import { ui, type Lang } from '../i18n';

const W = 240;
const H = 150;
const BASE = 126;
const CX = 120;

export default function GrowArt({ stage, size = 108, lang = 'th' }: { stage: PlantStage; size?: number; lang?: Lang }) {
  const g = useGarden({ w: W, h: H, bodies: [{ x: CX, base: BASE }], reach: 150, lean: 14, minY: 0, fly: { y: 54, ry: 22, maxY: 100, rx: 80 } });
  const { bursts, spawn } = useBursts();
  const prev = useRef(stage);

  useEffect(() => {
    if (prev.current === stage) return;
    prev.current = stage;
    g.nudge(0);
    spawn(CX, BASE - size * 0.5);
  }, [stage]);

  const pop = () => {
    g.nudge(0, 0.3);
    spawn(CX, BASE - size * 0.5, 5);
  };

  return (
    <svg ref={g.svgRef} className="garden art-scene" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ui[lang].garden.lessonPlant} width={W} height={H}>
      <rect width={W} height={H} rx="26" fill="var(--sky)" />
      <circle className="glow" cx="196" cy="34" r="24" fill="var(--sun-moon)" />
      <circle cx="196" cy="34" r="14" fill="var(--sun-moon)" />
      <path d="M0 112 C 50 92, 100 100, 150 108 S 220 100, 240 96 V150 H0Z" fill="var(--hill-far)" />
      <path d="M0 132 C 60 118, 130 124, 240 120 V150 H0Z" fill="var(--hill-near)" />
      <ellipse cx={CX} cy={BASE + 4} rx="62" ry="11" fill="var(--soil)" />
      <g ref={g.body(0)} className="plant" onClick={pop}>
        <rect x={CX - size * 0.4} y={BASE - size * 0.9} width={size * 0.8} height={size * 0.95} fill="transparent" />
        <Plant stage={stage} size={size} x={CX - size / 2} y={BASE - size * 0.86} sway />
      </g>
      <Critter flyRef={g.flyRef} x={70} y={54} />
      <BurstLayer bursts={bursts} />
    </svg>
  );
}
