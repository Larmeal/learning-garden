// The garden of one subject: one plant per lesson, laid out by phase. Seeds are lessons not written yet, sprouts are lessons to learn,
// full trees are lessons this learner finished. Hover shows the title, click selects the lesson on the map.
import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import Plant, { type PlantStage } from './Plant';
import { Critter, onActivate, useGarden } from './useGarden';
import { plantStage } from './useProgress';

export interface GardenLesson {
  id: string;
  slug: string;
  title: string;
  order: number;
  phase: string;
  stage: PlantStage;
}

const W = 760;
const H = 250;
const BASE = 214;
const SIZE: Record<PlantStage, number> = { seed: 46, sprout: 60, evergreen: 76 };
const NAME: Record<PlantStage, string> = { seed: 'เมล็ด ยังไม่เปิดให้เรียน', sprout: 'ต้นอ่อน', evergreen: 'โตเต็มที่' };
const pad = (n: number) => String(n).padStart(2, '0');

interface Props {
  lessons: GardenLesson[];
  done: Record<string, boolean>;
  sel: string;
  hover: string | null;
  onSelect: (slug: string) => void;
  onHover: (slug: string | null) => void;
}

export default function SubjectGarden({ lessons, done, sel, hover, onSelect, onHover }: Props) {
  // Left to right with a small gap wherever the phase changes.
  const spots = useMemo(() => {
    const gap = 18;
    const gaps = lessons.reduce((n, l, i) => n + (i > 0 && l.phase !== lessons[i - 1].phase ? 1 : 0), 0);
    const pad0 = 44;
    const step = (W - pad0 * 2 - gaps * gap) / Math.max(1, lessons.length - 1);
    let g = 0;
    return lessons.map((l, i) => {
      if (i > 0 && l.phase !== lessons[i - 1].phase) g++;
      return pad0 + i * step + g * gap;
    });
  }, [lessons]);
  const stages = lessons.map((l) => plantStage(l.stage, !!done[l.id]));
  const bodies = useMemo(() => spots.map((x) => ({ x, base: BASE })), [spots]);

  const g = useGarden({ w: W, h: H, bodies, reach: 80, lean: 18, minY: 90, depths: { sun: 4, clouds: 7, far: 9, near: 14 }, fly: { y: 100, ry: 28, maxY: 180 } });

  // Selecting or hovering a lesson (here or on a tile) gives its plant a small hop.
  const lastSel = useRef(sel);
  useEffect(() => {
    if (lastSel.current === sel) return;
    lastSel.current = sel;
    const i = lessons.findIndex((l) => l.slug === sel);
    if (i >= 0) g.nudge(i, 0.3);
  }, [sel]);
  const lastHover = useRef<string | null>(null);
  useEffect(() => {
    if (hover && hover !== lastHover.current) {
      const i = lessons.findIndex((l) => l.slug === hover);
      if (i >= 0) g.nudge(i, 0.14);
    }
    lastHover.current = hover;
  }, [hover]);

  const hoverIndex = hover ? lessons.findIndex((l) => l.slug === hover) : -1;
  const phaseStarts = lessons.map((l, i) => i === 0 || l.phase !== lessons[i - 1].phase);

  return (
    <div className="scene-wrap subject-garden">
      <svg ref={g.svgRef} className="scene garden" viewBox={`0 0 ${W} ${H}`} role="group" aria-label="สวนของเรื่องนี้ ต้นไม้หนึ่งต้นคือหนึ่งบท">
        <rect width={W} height={H} fill="var(--sky)" />
        <g ref={g.layer('sun')}>
          <circle className="glow" cx="662" cy="58" r="44" fill="var(--sun-moon)" />
          <circle cx="662" cy="58" r="28" fill="var(--sun-moon)" />
        </g>
        <g ref={g.layer('clouds')}>
          <g className="cloud still"><ellipse cx="130" cy="58" rx="40" ry="13" /><ellipse cx="158" cy="48" rx="26" ry="12" /><ellipse cx="106" cy="52" rx="22" ry="10" /></g>
          <g className="cloud still b"><ellipse cx="420" cy="86" rx="34" ry="11" /><ellipse cx="446" cy="77" rx="22" ry="10" /></g>
        </g>
        <g ref={g.layer('far')}>
          <path d="M-30 176 L0 172 C 120 130, 260 140, 380 164 S 620 160, 760 132 L790 130 V250 H-30Z" fill="var(--hill-far)" />
        </g>
        <g ref={g.layer('near')}>
          <path d="M-30 206 L0 202 C 150 176, 320 190, 470 202 S 680 196, 760 180 L790 178 V250 H-30Z" fill="var(--hill-near)" />
        </g>
        <rect x="14" y="202" width={W - 28} height="58" rx="29" fill="var(--soil)" />
        <rect x="14" y="202" width={W - 28} height="9" rx="4.5" fill="var(--soil-dark)" opacity=".35" />

        {lessons.map((l, i) => {
          const st = stages[i];
          const size = SIZE[st];
          const x = spots[i];
          return (
            <g key={l.slug}>
              {phaseStarts[i] && (
                <text x={x} y={246} className="g-phase" textAnchor="middle">{l.phase}</text>
              )}
              {l.slug === sel && <ellipse className="g-ring" cx={x} cy={BASE + 5} rx="22" ry="6.5" />}
              <g
                ref={g.body(i)}
                className={`plant${st === 'seed' ? ' dim' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={`${pad(l.order)} ${l.title}: ${NAME[st]}`}
                aria-current={l.slug === sel ? 'true' : undefined}
                onClick={() => onSelect(l.slug)}
                onKeyDown={onActivate(() => onSelect(l.slug))}
                onMouseEnter={() => onHover(l.slug)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(l.slug)}
                onBlur={() => onHover(null)}
                style={{ '--sway-delay': `${-i * 0.7}s`, '--sway-dur': `${4.2 + (i % 3) * 0.8}s` } as CSSProperties}
              >
                <rect x={x - 22} y={BASE - size * 0.9} width="44" height={size * 0.95} fill="transparent" />
                <Plant stage={st} size={size} x={x - size / 2} y={BASE - size * 0.86} sway />
              </g>
              <text x={x} y={232} className="g-num" textAnchor="middle" pointerEvents="none">{pad(l.order)}</text>
            </g>
          );
        })}

        <Critter flyRef={g.flyRef} x={380} y={100} />
      </svg>
      {hoverIndex >= 0 && (
        <div className="scene-tip" style={{ left: `${(spots[hoverIndex] / W) * 100}%`, top: `${((BASE - SIZE[stages[hoverIndex]] - 8) / H) * 100}%` }} role="presentation">
          <b>{pad(lessons[hoverIndex].order)}</b> {lessons[hoverIndex].title}
          <small>{NAME[stages[hoverIndex]]}</small>
        </div>
      )}
      <p className="scene-hint" aria-hidden="true">เอาเมาส์ไปแตะต้นไม้เพื่อดูชื่อบท กดเพื่อเลือก ต้นจะโตเมื่อคุณเรียนจบบทนั้น</p>
    </div>
  );
}
