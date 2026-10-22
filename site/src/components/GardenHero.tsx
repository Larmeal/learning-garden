// Home hero. Always alive (drifting clouds, swaying plants, a wandering butterfly or, at night, fireflies) and it answers the pointer
// through useGarden. A click grows a plant one stage or makes a cloud rain.
import { useState, type CSSProperties } from 'react';
import Plant, { type PlantStage } from './Plant';
import { BurstLayer, Critter, onActivate, useBursts, useGarden } from './useGarden';

const W = 680;
const H = 400;
const BASE = 366;

const NEXT: Record<PlantStage, PlantStage> = { seed: 'sprout', sprout: 'evergreen', evergreen: 'seed' };
const NAME: Record<PlantStage, string> = { seed: 'เมล็ด', sprout: 'ต้นอ่อน', evergreen: 'ต้นโตเต็มที่' };

const PLANTS: { stage: PlantStage; x: number; size: number }[] = [
  { stage: 'seed', x: 78, size: 64 },
  { stage: 'sprout', x: 150, size: 72 },
  { stage: 'sprout', x: 226, size: 84 },
  { stage: 'evergreen', x: 312, size: 108 },
  { stage: 'sprout', x: 424, size: 80 },
  { stage: 'evergreen', x: 500, size: 92 },
  { stage: 'seed', x: 588, size: 60 },
];
const BODIES = PLANTS.map((p) => ({ x: p.x, base: BASE }));
const DEPTHS = { sun: 4, clouds: 8, far: 11, near: 18 };
const FIREFLIES = [
  { x: 96, y: 300 }, { x: 214, y: 262 }, { x: 352, y: 292 }, { x: 468, y: 258 }, { x: 560, y: 296 }, { x: 626, y: 250 },
];

interface Rain { id: number; x: number; y: number }

export default function GardenHero() {
  const [stages, setStages] = useState<PlantStage[]>(() => PLANTS.map((p) => p.stage));
  const [rain, setRain] = useState<Rain | null>(null);
  const [said, setSaid] = useState('');
  const { bursts, spawn } = useBursts();
  const g = useGarden({ w: W, h: H, bodies: BODIES, depths: DEPTHS, minY: 160, fly: { y: 150, ry: 60, maxY: 330 } });

  const grow = (i: number) => {
    const p = PLANTS[i];
    const next = NEXT[stages[i]];
    setStages((cur) => cur.map((v, j) => (j === i ? next : v)));
    setSaid(`ต้นที่ ${i + 1} เปลี่ยนเป็น${NAME[next]}`);
    g.nudge(i);
    spawn(p.x, BASE - p.size * 0.5);
  };

  const callRain = (x: number, y: number) => {
    const id = Date.now();
    setRain({ id, x, y });
    setSaid('ฝนตก');
    PLANTS.forEach((_, i) => setTimeout(() => g.nudge(i, 0.16), 250 + i * 110));
    setTimeout(() => setRain((r) => (r?.id === id ? null : r)), 2600);
  };

  return (
    <div className="scene-wrap">
      <svg ref={g.svgRef} className="scene garden" viewBox={`0 0 ${W} ${H}`} role="group" aria-label="สวนเล็กๆ ที่ขยับได้ มีต้นไม้ ก้อนเมฆ และผีเสื้อ">
        <rect width={W} height={H} fill="var(--sky)" />

        <g ref={g.layer('sun')}>
          <g className="sun-rays" style={{ transformOrigin: '548px 96px' }}>
            {Array.from({ length: 12 }, (_, n) => (
              <line key={n} x1="548" y1="40" x2="548" y2={n % 2 ? 46 : 38} transform={`rotate(${n * 30} 548 96)`} />
            ))}
          </g>
          <circle className="glow" cx="548" cy="96" r="62" fill="var(--sun-moon)" />
          <circle cx="548" cy="96" r="40" fill="var(--sun-moon)" />
        </g>

        <g ref={g.layer('clouds')}>
          <g className="cloud" role="button" tabIndex={0} aria-label="ก้อนเมฆ กดเพื่อให้ฝนตก" onClick={() => callRain(150, 98)} onKeyDown={onActivate(() => callRain(150, 98))}>
            <ellipse cx="150" cy="86" rx="46" ry="16" /><ellipse cx="184" cy="74" rx="30" ry="15" /><ellipse cx="120" cy="78" rx="26" ry="12" />
          </g>
          <g className="cloud b" role="button" tabIndex={0} aria-label="ก้อนเมฆ กดเพื่อให้ฝนตก" onClick={() => callRain(405, 152)} onKeyDown={onActivate(() => callRain(405, 152))}>
            <ellipse cx="392" cy="140" rx="38" ry="12" /><ellipse cx="420" cy="130" rx="24" ry="12" />
          </g>
        </g>

        <g className="birds">
          {[0, 1, 2].map((n) => (
            <path key={n} className="bird" style={{ '--d': `${n * 1.6}s`, '--y': `${54 + n * 12}px` } as CSSProperties} d="M0 0 q5 -6 10 0 q5 -6 10 0" />
          ))}
        </g>

        <g ref={g.layer('far')}>
          <path d="M-40 276 L0 270 C 110 205, 250 215, 360 252 S 580 250, 680 215 L720 212 V400 H-40Z" fill="var(--hill-far)" />
        </g>
        <g ref={g.layer('near')}>
          <path d="M-40 322 L0 318 C 140 276, 300 296, 430 312 S 600 306, 680 286 L720 284 V400 H-40Z" fill="var(--hill-near)" />
        </g>

        <rect x="34" y="352" width="612" height="62" rx="31" fill="var(--soil)" />
        <rect x="34" y="352" width="612" height="10" rx="5" fill="var(--soil-dark)" opacity=".35" />

        {PLANTS.map((p, i) => (
          <g
            key={i}
            ref={g.body(i)}
            className="plant"
            role="button"
            tabIndex={0}
            aria-label={`ต้นที่ ${i + 1}: ${NAME[stages[i]]} กดเพื่อให้โต`}
            onClick={() => grow(i)}
            onKeyDown={onActivate(() => grow(i))}
            style={{ '--sway-delay': `${-i * 0.9}s`, '--sway-dur': `${4.4 + (i % 3) * 0.7}s` } as CSSProperties}
          >
            <rect x={p.x - p.size * 0.42} y={BASE - p.size * 0.9} width={p.size * 0.84} height={p.size * 0.95} fill="transparent" />
            <Plant stage={stages[i]} size={p.size} x={p.x - p.size / 2} y={BASE - p.size * 0.86} sway />
          </g>
        ))}

        <g className="fireflies" aria-hidden="true">
          {FIREFLIES.map((f, i) => (
            <circle key={i} className="ff" cx={f.x} cy={f.y} r="3.2" style={{ '--d': `${-i * 1.3}s`, '--t': `${3.2 + (i % 3) * 0.8}s` } as CSSProperties} />
          ))}
        </g>

        <Critter flyRef={g.flyRef} x={340} y={150} />
        <BurstLayer bursts={bursts} />

        {rain && (
          <g key={rain.id} pointerEvents="none" className="rain">
            {Array.from({ length: 16 }, (_, n) => (
              <line
                key={n}
                className="drop"
                x1={rain.x - 54 + n * 7 + (n % 3) * 2}
                x2={rain.x - 54 + n * 7 + (n % 3) * 2}
                y1={rain.y}
                y2={rain.y + 11}
                style={{ '--delay': `${(n % 8) * 0.11}s`, '--fall': `${352 - rain.y}px` } as CSSProperties}
              />
            ))}
          </g>
        )}
      </svg>
      <p className="scene-hint" aria-hidden="true">ลองขยับเมาส์ผ่านสวน แล้วกดที่ต้นไม้หรือก้อนเมฆดู</p>
      <p className="sr-only" aria-live="polite">{said}</p>
    </div>
  );
}
