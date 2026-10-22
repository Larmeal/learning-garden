// Shared "living garden" behaviour for any SVG scene: layers shift with the pointer by depth, plants lean away from the cursor
// and spring back, a click can squash a plant (nudge), and an optional butterfly (firefly at night) follows the cursor or wanders.
// The scene only has to give refs to its plants (body), layers (layer) and the butterfly group (flyRef).
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

export interface Body {
  x: number;
  base: number;
}
interface Options {
  w: number;
  h: number;
  bodies: Body[];
  reach?: number; // how far from a plant the cursor still bends it
  lean?: number; // strongest bend in degrees
  minY?: number; // the cursor must be below this y to bend plants
  depths?: Record<string, number>; // layer name to parallax distance in px (bigger = nearer)
  fly?: { y: number; ry: number; maxY: number; rx?: number } | false;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const put = (el: SVGElement | null | undefined, v: string) => {
  if (el && el.dataset.t !== v) {
    el.setAttribute('transform', v);
    el.dataset.t = v;
  }
};

export function useGarden(opts: Options) {
  const o = useRef(opts);
  o.current = opts;

  const svgRef = useRef<SVGSVGElement>(null);
  const flyRef = useRef<SVGGElement>(null);
  const bodyEls = useRef<(SVGGElement | null)[]>([]);
  const layerEls = useRef<Record<string, SVGGElement | null>>({});
  const sim = useRef({
    px: 0, py: 0, inside: false, nx: 0, ny: 0,
    plants: [] as { a: number; va: number; s: number; vs: number }[],
    fly: { x: opts.w / 2, y: opts.fly ? opts.fly.y : 0 },
  });

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const s = sim.current;

    const point = (e: PointerEvent) => {
      const r = svg.getBoundingClientRect();
      s.px = ((e.clientX - r.left) / r.width) * o.current.w;
      s.py = ((e.clientY - r.top) / r.height) * o.current.h;
      s.inside = true;
    };
    const leave = () => { s.inside = false; };
    svg.addEventListener('pointermove', point);
    svg.addEventListener('pointerdown', point);
    svg.addEventListener('pointerleave', leave);
    svg.addEventListener('pointercancel', leave);

    let raf = 0;
    let last = 0;
    let visible = true;

    const tick = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      const { w, h, bodies, reach = 170, lean = 16, minY = h * 0.4, depths = {}, fly } = o.current;
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      const t = now / 1000;

      const ease = 1 - Math.exp(-5 * dt);
      s.nx += ((s.inside ? (s.px / w) * 2 - 1 : 0) - s.nx) * ease;
      s.ny += ((s.inside ? (s.py / h) * 2 - 1 : 0) - s.ny) * ease;
      for (const [name, d] of Object.entries(depths)) {
        put(layerEls.current[name], `translate(${(-s.nx * d).toFixed(2)} ${(-s.ny * d * 0.6).toFixed(2)})`);
      }

      bodies.forEach((b, i) => {
        const st = (s.plants[i] ??= { a: 0, va: 0, s: 0, vs: 0 });
        const dx = b.x - s.px;
        const near = s.inside && s.py > minY && Math.abs(dx) < reach;
        const target = near ? Math.sign(dx || 1) * (1 - Math.abs(dx) / reach) * lean : 0;
        st.va += (130 * (target - st.a) - 9 * st.va) * dt;
        st.a += st.va * dt;
        st.vs += (240 * (0 - st.s) - 9 * st.vs) * dt;
        st.s += st.vs * dt;
        put(
          bodyEls.current[i],
          `translate(${b.x} ${b.base}) rotate(${st.a.toFixed(2)}) scale(${(1 + st.s * 0.55).toFixed(3)} ${(1 - st.s).toFixed(3)}) translate(${-b.x} ${-b.base})`,
        );
      });

      if (fly) {
        const f = s.fly;
        const tx = s.inside ? s.px + 26 : w / 2 + (fly.rx ?? w * 0.34) * Math.sin(t * 0.35);
        const ty = s.inside ? s.py - 22 : fly.y + fly.ry * Math.sin(t * 0.52 + 1);
        const k = 1 - Math.exp(-(s.inside ? 3.2 : 1.1) * dt);
        const vx = ((tx - f.x) * k) / dt;
        f.x = clamp(f.x + (tx - f.x) * k, 14, w - 14);
        f.y = clamp(f.y + (ty - f.y) * k, 14, fly.maxY);
        put(flyRef.current, `translate(${f.x.toFixed(1)} ${(f.y + Math.sin(t * 9) * 2.5).toFixed(1)}) rotate(${clamp(vx * 0.05, -28, 28).toFixed(1)})`);
      }

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
      svg.removeEventListener('pointermove', point);
      svg.removeEventListener('pointerdown', point);
      svg.removeEventListener('pointerleave', leave);
      svg.removeEventListener('pointercancel', leave);
    };
  }, []);

  // Squash plant i for a moment; the spring makes it bounce back (0.38 is a clear pop, 0.16 a small hop).
  const nudge = useCallback((i: number, amount = 0.38) => {
    const st = (sim.current.plants[i] ??= { a: 0, va: 0, s: 0, vs: 0 });
    st.s = amount;
  }, []);
  const body = useCallback((i: number) => (el: SVGGElement | null) => { bodyEls.current[i] = el; }, []);
  const layer = useCallback((name: string) => (el: SVGGElement | null) => { layerEls.current[name] = el; }, []);

  return { svgRef, flyRef, body, layer, nudge };
}

// Leaves that burst out of a point, for "this just grew" moments.
export interface Burst {
  id: number;
  x: number;
  y: number;
  parts: { dx: number; dy: number; r: number; c: string }[];
}
const SPARKS = ['var(--leaf)', 'var(--leaf-2)', 'var(--sun)'];

export function useBursts() {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const ids = useRef(0);
  const spawn = useCallback((x: number, y: number, count = 8) => {
    const id = ++ids.current;
    const parts = Array.from({ length: count }, (_, n) => {
      const ang = (n / count) * Math.PI * 2 + Math.random() * 0.6;
      const r = 26 + Math.random() * 30;
      return { dx: Math.cos(ang) * r, dy: Math.sin(ang) * r - 12, r: (Math.random() - 0.5) * 360, c: SPARKS[n % SPARKS.length] };
    });
    setBursts((b) => [...b, { id, x, y, parts }]);
    setTimeout(() => setBursts((b) => b.filter((v) => v.id !== id)), 1000);
  }, []);
  return { bursts, spawn };
}

export function BurstLayer({ bursts }: { bursts: Burst[] }) {
  return (
    <>
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
    </>
  );
}

// Butterfly by day, firefly at night (the theme decides through --night). Pass the flyRef from useGarden.
export function Critter({ flyRef, x, y }: { flyRef: React.Ref<SVGGElement>; x: number; y: number }) {
  return (
    <g ref={flyRef} className="fly" transform={`translate(${x} ${y})`} aria-hidden="true" pointerEvents="none">
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
  );
}

export function onActivate(act: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      act();
    }
  };
}
