// Hero garden. Always alive (drifting clouds, swaying plants, a wandering butterfly or, at night, fireflies) and it answers the pointer:
// layers shift with depth, plants lean away from the cursor, the butterfly follows it, a click grows a plant or makes a cloud rain.
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import Plant, { type PlantStage } from './Plant';

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
const FIREFLIES = [
  { x: 96, y: 300 }, { x: 214, y: 262 }, { x: 352, y: 292 }, { x: 468, y: 258 }, { x: 560, y: 296 }, { x: 626, y: 250 },
];
const SPARKS = ['var(--leaf)', 'var(--leaf-2)', 'var(--sun)'];

interface Burst { id: number; x: number; y: number; parts: { dx: number; dy: number; r: number; c: string }[] }
interface Rain { id: number; x: number; y: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const put = (el: SVGElement | null, v: string) => {
  if (el && el.dataset.t !== v) {
    el.setAttribute('transform', v);
    el.dataset.t = v;
  }
};

export default function GardenHero() {
  const [stages, setStages] = useState<PlantStage[]>(() => PLANTS.map((p) => p.stage));
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [rain, setRain] = useState<Rain | null>(null);
  const [said, setSaid] = useState('');

  const svgRef = useRef<SVGSVGElement>(null);
  const plantRefs = useRef<(SVGGElement | null)[]>([]);
  const sunRef = useRef<SVGGElement>(null);
  const cloudsRef = useRef<SVGGElement>(null);
  const farRef = useRef<SVGGElement>(null);
  const nearRef = useRef<SVGGElement>(null);
  const flyRef = useRef<SVGGElement>(null);
  const ids = useRef(0);
  const sim = useRef({
    px: 0, py: 0, inside: false, nx: 0, ny: 0,
    plants: PLANTS.map(() => ({ a: 0, va: 0, s: 0, vs: 0 })),
    fly: { x: 340, y: 150 },
  });

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const s = sim.current;

    const point = (e: PointerEvent) => {
      const r = svg.getBoundingClientRect();
      s.px = ((e.clientX - r.left) / r.width) * W;
      s.py = ((e.clientY - r.top) / r.height) * H;
      s.inside = true;
    };
    const onMove = (e: PointerEvent) => point(e);
    const onLeave = () => { s.inside = false; };
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerdown', onMove);
    svg.addEventListener('pointerleave', onLeave);
    svg.addEventListener('pointercancel', onLeave);

    let raf = 0;
    let last = 0;
    let visible = true;

    const tick = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      const t = now / 1000;

      // depth: far layers move less than near ones, opposite to the pointer
      const ease = 1 - Math.exp(-5 * dt);
      s.nx += ((s.inside ? (s.px / W) * 2 - 1 : 0) - s.nx) * ease;
      s.ny += ((s.inside ? (s.py / H) * 2 - 1 : 0) - s.ny) * ease;
      const shift = (d: number) => `translate(${(-s.nx * d).toFixed(2)} ${(-s.ny * d * 0.6).toFixed(2)})`;
      put(sunRef.current, shift(4));
      put(cloudsRef.current, shift(8));
      put(farRef.current, shift(11));
      put(nearRef.current, shift(18));

      // plants: wind pushes them away from the cursor, springs bring them back; a click leaves a squash that rings out
      PLANTS.forEach((p, i) => {
        const st = s.plants[i];
        const dx = p.x - s.px;
        const near = s.inside && s.py > 160 && Math.abs(dx) < 170;
        const target = near ? Math.sign(dx || 1) * (1 - Math.abs(dx) / 170) * 16 : 0;
        st.va += (130 * (target - st.a) - 9 * st.va) * dt;
        st.a += st.va * dt;
        st.vs += (240 * (0 - st.s) - 9 * st.vs) * dt;
        st.s += st.vs * dt;
        const sx = 1 + st.s * 0.55;
        const sy = 1 - st.s;
        put(
          plantRefs.current[i],
          `translate(${p.x} ${BASE}) rotate(${st.a.toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(${-p.x} ${-BASE})`,
        );
      });

      // butterfly (firefly at night): follows the cursor with lag, otherwise wanders
      const f = s.fly;
      const tx = s.inside ? s.px + 26 : 340 + 230 * Math.sin(t * 0.35);
      const ty = s.inside ? s.py - 22 : 150 + 60 * Math.sin(t * 0.52 + 1);
      const k = 1 - Math.exp(-(s.inside ? 3.2 : 1.1) * dt);
      const vx = ((tx - f.x) * k) / dt;
      f.x = clamp(f.x + (tx - f.x) * k, 14, W - 14);
      f.y = clamp(f.y + (ty - f.y) * k, 14, 330);
      const tilt = clamp(vx * 0.05, -28, 28);
      put(flyRef.current, `translate(${f.x.toFixed(1)} ${(f.y + Math.sin(t * 9) * 2.5).toFixed(1)}) rotate(${tilt.toFixed(1)})`);

      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (raf || !visible || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); });
    io.observe(svg);
    document.addEventListener('visibilitychange', start);
    start();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener('visibilitychange', start);
      svg.removeEventListener('pointermove', onMove);
      svg.removeEventListener('pointerdown', onMove);
      svg.removeEventListener('pointerleave', onLeave);
      svg.removeEventListener('pointercancel', onLeave);
    };
  }, []);

  const grow = (i: number) => {
    const p = PLANTS[i];
    const next = NEXT[stages[i]];
    setStages((cur) => cur.map((v, j) => (j === i ? next : v)));
    setSaid(`ต้นที่ ${i + 1} เปลี่ยนเป็น${NAME[next]}`);
    sim.current.plants[i].s = 0.38;
    const id = ++ids.current;
    const parts = Array.from({ length: 8 }, (_, n) => {
      const ang = (n / 8) * Math.PI * 2 + Math.random() * 0.6;
      const r = 26 + Math.random() * 30;
      return { dx: Math.cos(ang) * r, dy: Math.sin(ang) * r - 12, r: (Math.random() - 0.5) * 360, c: SPARKS[n % SPARKS.length] };
    });
    setBursts((b) => [...b, { id, x: p.x, y: BASE - p.size * 0.5, parts }]);
    setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1000);
  };
  const onKey = (act: () => void) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      act();
    }
  };

  const callRain = (x: number, y: number) => {
    const id = ++ids.current;
    setRain({ id, x, y });
    setSaid('ฝนตก');
    PLANTS.forEach((_, i) => setTimeout(() => { sim.current.plants[i].s = 0.16; }, 250 + i * 110));
    setTimeout(() => setRain((r) => (r?.id === id ? null : r)), 2600);
  };

  return (
    <div className="scene-wrap">
      <svg ref={svgRef} className="scene" viewBox={`0 0 ${W} ${H}`} role="group" aria-label="สวนเล็กๆ ที่ขยับได้ มีต้นไม้ ก้อนเมฆ และผีเสื้อ">
        <rect width={W} height={H} fill="var(--sky)" />

        <g ref={sunRef}>
          <g className="sun-rays" style={{ transformOrigin: '548px 96px' }}>
            {Array.from({ length: 12 }, (_, n) => (
              <line key={n} x1="548" y1="40" x2="548" y2={n % 2 ? 46 : 38} transform={`rotate(${n * 30} 548 96)`} />
            ))}
          </g>
          <circle className="glow" cx="548" cy="96" r="62" fill="var(--sun-moon)" />
          <circle cx="548" cy="96" r="40" fill="var(--sun-moon)" />
        </g>

        <g ref={cloudsRef}>
          <g className="cloud" role="button" tabIndex={0} aria-label="ก้อนเมฆ กดเพื่อให้ฝนตก" onClick={() => callRain(150, 98)} onKeyDown={onKey(() => callRain(150, 98))}>
            <ellipse cx="150" cy="86" rx="46" ry="16" /><ellipse cx="184" cy="74" rx="30" ry="15" /><ellipse cx="120" cy="78" rx="26" ry="12" />
          </g>
          <g className="cloud b" role="button" tabIndex={0} aria-label="ก้อนเมฆ กดเพื่อให้ฝนตก" onClick={() => callRain(405, 152)} onKeyDown={onKey(() => callRain(405, 152))}>
            <ellipse cx="392" cy="140" rx="38" ry="12" /><ellipse cx="420" cy="130" rx="24" ry="12" />
          </g>
        </g>

        <g className="birds">
          {[0, 1, 2].map((n) => (
            <path key={n} className="bird" style={{ '--d': `${n * 1.6}s`, '--y': `${54 + n * 12}px` } as CSSProperties} d="M0 0 q5 -6 10 0 q5 -6 10 0" />
          ))}
        </g>

        <g ref={farRef}>
          <path d="M-40 276 L0 270 C 110 205, 250 215, 360 252 S 580 250, 680 215 L720 212 V400 H-40Z" fill="var(--hill-far)" />
        </g>
        <g ref={nearRef}>
          <path d="M-40 322 L0 318 C 140 276, 300 296, 430 312 S 600 306, 680 286 L720 284 V400 H-40Z" fill="var(--hill-near)" />
        </g>

        <rect x="34" y="352" width="612" height="62" rx="31" fill="var(--soil)" />
        <rect x="34" y="352" width="612" height="10" rx="5" fill="var(--soil-dark)" opacity=".35" />

        {PLANTS.map((p, i) => (
          <g
            key={i}
            ref={(el) => { plantRefs.current[i] = el; }}
            className="plant"
            role="button"
            tabIndex={0}
            aria-label={`ต้นที่ ${i + 1}: ${NAME[stages[i]]} กดเพื่อให้โต`}
            onClick={() => grow(i)}
            onKeyDown={onKey(() => grow(i))}
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

        <g ref={flyRef} className="fly" transform="translate(340 150)" aria-hidden="true">
          <g className="butterfly">
            <g className="wing l"><ellipse cx="-6" cy="-3" rx="7" ry="5.5" /><ellipse cx="-5" cy="4" rx="4.5" ry="3.5" /></g>
            <g className="wing r"><ellipse cx="6" cy="-3" rx="7" ry="5.5" /><ellipse cx="5" cy="4" rx="4.5" ry="3.5" /></g>
            <rect x="-1" y="-6" width="2" height="12" rx="1" className="body" />
          </g>
          <g className="firefly">
            <circle r="11" className="halo" />
            <circle r="3.6" className="core" />
          </g>
        </g>

        {bursts.map((b) => (
          <g key={b.id} transform={`translate(${b.x} ${b.y})`} pointerEvents="none">
            {b.parts.map((q, n) => (
              <path
                key={n}
                className="spark"
                d="M0 0 C3 -5 8 -4 9 0 C6 4 2 4 0 0Z"
                fill={q.c}
                style={{ '--dx': `${q.dx}px`, '--dy': `${q.dy}px`, '--r': `${q.r}deg` } as CSSProperties}
              />
            ))}
          </g>
        ))}

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
