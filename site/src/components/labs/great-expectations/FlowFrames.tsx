import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

// A generic diagram that plays in frames. The lesson passes boxes, arrows and frames as props, so one component
// serves every "what happens first, what happens next" picture. Nothing here is computed: each frame text is
// written by hand from a script run or from source that the lesson cites.

export interface Box {
  id: string;
  label: string;
  sub?: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  kind?: 'data' | 'code' | 'store' | 'out';
}
export interface Arrow {
  from: string;
  to: string;
  label?: string;
}
export interface Frame {
  title: string;
  text: string;
  on: string[];
  arrows?: number[];
  tag?: string;
}
interface Props {
  title: string;
  boxes: Box[];
  arrows: Arrow[];
  frames: Frame[];
  width?: number;
  height?: number;
  caption?: string;
}

const BW = 150;
const BH = 54;

function edge(a: Box, b: Box) {
  // Straight line between the two box centres, clipped to the rectangles.
  const aw = a.w ?? BW, ah = a.h ?? BH, bw = b.w ?? BW, bh = b.h ?? BH;
  const ax = a.x + aw / 2, ay = a.y + ah / 2, bx = b.x + bw / 2, by = b.y + bh / 2;
  const dx = bx - ax, dy = by - ay;
  const clip = (w: number, h: number) => {
    const sx = dx === 0 ? Infinity : w / 2 / Math.abs(dx);
    const sy = dy === 0 ? Infinity : h / 2 / Math.abs(dy);
    return Math.min(sx, sy);
  };
  const t1 = clip(aw, ah) + 0.02, t2 = clip(bw, bh) + 0.02;
  return { x1: ax + dx * t1, y1: ay + dy * t1, x2: bx - dx * t2, y2: by - dy * t2 };
}

export default function FlowFrames({ title, boxes, arrows, frames, width = 760, height = 260, caption }: Props) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!playing) return;
    if (i >= frames.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setI((n) => n + 1), reduce ? 0 : 1800);
    return () => clearTimeout(t);
  }, [playing, i, reduce, frames.length]);

  const f = frames[i];
  const byId = new Map(boxes.map((b) => [b.id, b]));
  const lit = new Set(f.on);
  const litArrows = new Set(f.arrows ?? []);

  return (
    <figure className="viz">
      <div className="viz-title">{title}</div>
      <div className="viz-controls">
        <button type="button" className="btn primary sm" onClick={() => { if (i >= frames.length - 1) setI(0); setPlaying((p) => !p); }}>
          {playing ? 'หยุด' : 'เล่น'}
        </button>
        <button type="button" className="btn sm" onClick={() => { setPlaying(false); setI((n) => Math.max(0, n - 1)); }}>ก่อนหน้า</button>
        <button type="button" className="btn sm" onClick={() => { setPlaying(false); setI((n) => Math.min(frames.length - 1, n + 1)); }}>ถัดไป</button>
        <span className="gx-tag">{i + 1} / {frames.length}</span>
      </div>

      <div className="viz-box">
        <svg viewBox={`-8 -8 ${width + 16} ${height + 16}`} role="img" aria-label={title} style={{ minWidth: Math.min(width, 640) }}>
          <defs>
            <marker id="gxfArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" className="mk" />
            </marker>
          </defs>
          {arrows.map((a, n) => {
            const from = byId.get(a.from), to = byId.get(a.to);
            if (!from || !to) return null;
            const e = edge(from, to);
            const on = litArrows.has(n);
            return (
              <g key={n}>
                <motion.line
                  x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                  className="ln"
                  markerEnd="url(#gxfArrow)"
                  animate={{ opacity: on ? 1 : 0.3, strokeWidth: on ? 2.6 : 1.6 }}
                  transition={{ duration: reduce ? 0 : 0.3 }}
                  style={{ stroke: on ? 'var(--accent)' : undefined }}
                />
                {a.label && (
                  <text className="s" x={(e.x1 + e.x2) / 2} y={(e.y1 + e.y2) / 2 - 6} textAnchor="middle">{a.label}</text>
                )}
              </g>
            );
          })}
          {boxes.map((b) => {
            const w = b.w ?? BW, h = b.h ?? BH, on = lit.has(b.id);
            return (
              <motion.g key={b.id} animate={{ scale: on && !reduce ? 1.03 : 1 }} transition={{ duration: 0.25 }} style={{ transformOrigin: `${b.x + w / 2}px ${b.y + h / 2}px` }}>
                <rect className={`box${on ? ' on' : ''}`} x={b.x} y={b.y} width={w} height={h} rx={b.kind === 'store' ? 4 : 12}
                  strokeDasharray={b.kind === 'data' ? '5 4' : undefined}
                  style={{ opacity: on ? 1 : 0.55 }} />
                <text className="b" x={b.x + w / 2} y={b.y + (b.sub ? h / 2 - 3 : h / 2 + 4)} textAnchor="middle" style={{ opacity: on ? 1 : 0.6 }}>{b.label}</text>
                {b.sub && <text className="s m" x={b.x + w / 2} y={b.y + h / 2 + 14} textAnchor="middle" style={{ opacity: on ? 1 : 0.6 }}>{b.sub}</text>}
              </motion.g>
            );
          })}
        </svg>
      </div>

      <div className="viz-now" aria-live="polite">
        <strong>{f.title}</strong>
        <span>{f.text}</span>
        {f.tag && <code className="gx-where">{f.tag}</code>}
      </div>
      {caption && <p className="viz-caption">{caption}</p>}
    </figure>
  );
}
