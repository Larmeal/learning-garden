// Strip of grass above the footer on every page. Tufts lean away from the cursor, a few carry flowers, and a butterfly wanders over them.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Critter, useGarden } from './useGarden';

const H = 96;
const BASE = 90;
const GAP = 30;

// Cheap deterministic pseudo-random so server and client draw the same tufts. Rounded because Math.sin differs
// in the last digits between Node and browsers, which would break hydration.
const rnd = (i: number, k: number) => {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return Math.round((v - Math.floor(v)) * 1000) / 1000;
};

export default function FooterGarden() {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(1200);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setW(Math.max(280, Math.round(el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tufts = useMemo(() => {
    const n = Math.floor(w / GAP);
    return Array.from({ length: n }, (_, i) => ({
      x: Math.round((GAP / 2 + (i + (rnd(i, 1) - 0.5) * 0.5) * (w / n)) * 10) / 10,
      h: Math.round(22 + rnd(i, 2) * 26),
      lean: Math.round((rnd(i, 3) - 0.5) * 100) / 10,
      flower: rnd(i, 4) > 0.8,
      hue: rnd(i, 5) > 0.5,
    }));
  }, [w]);
  const bodies = useMemo(() => tufts.map((t) => ({ x: t.x, base: BASE })), [tufts]);
  const g = useGarden({ w, h: H, bodies, reach: 90, lean: 24, minY: 0, depths: { hill: 6 }, fly: { y: 44, ry: 14, maxY: 70 } });

  return (
    <div ref={box} className="footer-garden" aria-hidden="true">
      <svg ref={g.svgRef} className="garden" viewBox={`0 0 ${w} ${H}`} width={w} height={H}>
        <g ref={g.layer('hill')}>
          <path
            d={`M-20 ${H} L-20 66 ${Array.from({ length: Math.ceil(w / 60) + 2 }, (_, i) => `Q ${i * 60 - 10} ${56 + (i % 2) * 12}, ${i * 60 + 20} ${64 + ((i + 1) % 2) * 6}`).join(' ')} L${w + 40} ${H}Z`}
            fill="var(--hill-far)"
          />
        </g>
        <rect x="-10" y={BASE - 4} width={w + 20} height={H - BASE + 8} fill="var(--hill-near)" />
        {tufts.map((t, i) => (
          <g key={i} ref={g.body(i)}>
            <g className="sway tuft" style={{ '--sway-delay': `${-rnd(i, 6) * 5}s`, '--sway-dur': `${3.6 + rnd(i, 7) * 2.4}s` } as CSSProperties}>
              <path d={`M${t.x - 5} ${BASE} Q ${t.x - 6 + t.lean} ${BASE - t.h * 0.6} ${t.x - 9 + t.lean} ${BASE - t.h * 0.8}`} className="blade" />
              <path d={`M${t.x} ${BASE} Q ${t.x + t.lean} ${BASE - t.h * 0.7} ${t.x + t.lean * 1.2} ${BASE - t.h}`} className={`blade${t.hue ? ' b' : ''}`} />
              <path d={`M${t.x + 5} ${BASE} Q ${t.x + 7 + t.lean} ${BASE - t.h * 0.5} ${t.x + 11 + t.lean} ${BASE - t.h * 0.7}`} className="blade" />
              {t.flower && <circle cx={t.x + t.lean * 1.2} cy={BASE - t.h - 3} r="4" className={t.hue ? 'bloom b' : 'bloom'} />}
            </g>
          </g>
        ))}
        <Critter flyRef={g.flyRef} x={w / 2} y={44} />
      </svg>
    </div>
  );
}
