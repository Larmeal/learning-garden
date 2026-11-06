import type { ReactNode } from 'react';
import { prog, smooth } from './timeline';

// A small drawing engine for the Spark labs that show "who talks to whom": boxes that appear at a time, and messages
// drawn as a colored line with a dot that travels along it. Like the other clock labs it is a pure function of t.

export type Tone = 'k1' | 'k2' | 'k3' | 'acc' | 'mute';
export const toneVar = (t: Tone) => (t === 'acc' ? 'var(--accent)' : t === 'mute' ? 'var(--line-strong)' : `var(--${t})`);

export interface SNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub?: string;
  lines?: string[];
  at: number;
  until?: number; // fades away at this time
  crossAt?: number; // a red cross appears (the process died)
  dimAt?: number; // from here on it is drawn faded (it has nothing more to do)
  tone: Tone;
  group?: boolean; // a machine / cluster outline that other boxes sit inside
  status?: { at: number; text: string; tone?: Tone }[]; // small text under the title that changes over time
}

export interface SMsg {
  id: string;
  from: string;
  to: string;
  at: number;
  dur?: number;
  n?: number; // the number in the little circle at the start
  label?: string;
  lx?: number; // where the label sits (default: the middle of the line)
  ly?: number;
  anchor?: 'start' | 'middle' | 'end';
  tone: Tone;
  dashed?: boolean;
  offset?: number; // shift the line sideways so two lines between the same boxes can both be seen
  p0?: [number, number]; // explicit end points, otherwise the line joins the two boxes
  p1?: [number, number];
}

const clipTo = (n: SNode, dx: number, dy: number, pad = 3): [number, number] => {
  const cx = n.x + n.w / 2;
  const cy = n.y + n.h / 2;
  const sx = dx === 0 ? Infinity : n.w / 2 / Math.abs(dx);
  const sy = dy === 0 ? Infinity : n.h / 2 / Math.abs(dy);
  const s = Math.min(sx, sy);
  const len = Math.hypot(dx, dy) || 1;
  return [cx + dx * s + (dx / len) * pad, cy + dy * s + (dy / len) * pad];
};

export function endpoints(m: SMsg, by: Map<string, SNode>): [[number, number], [number, number]] {
  const a = by.get(m.from)!;
  const b = by.get(m.to)!;
  let p0: [number, number];
  let p1: [number, number];
  if (m.p0 && m.p1) {
    p0 = m.p0;
    p1 = m.p1;
  } else {
    const dx = b.x + b.w / 2 - (a.x + a.w / 2);
    const dy = b.y + b.h / 2 - (a.y + a.h / 2);
    p0 = m.p0 ?? clipTo(a, dx, dy);
    p1 = m.p1 ?? clipTo(b, -dx, -dy);
  }
  if (m.offset) {
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const len = Math.hypot(dx, dy) || 1;
    const ox = (-dy / len) * m.offset;
    const oy = (dx / len) * m.offset;
    p0 = [p0[0] + ox, p0[1] + oy];
    p1 = [p1[0] + ox, p1[1] + oy];
  }
  return [p0, p1];
}

const HOLD = 1.8; // how long a message stays bright after it arrived

export function SceneSvg({
  nodes,
  msgs,
  t,
  height,
  label,
  extra,
  under,
}: {
  nodes: SNode[];
  msgs: SMsg[];
  t: number;
  height: number;
  label: string;
  extra?: ReactNode;
  under?: ReactNode;
}) {
  const by = new Map(nodes.map((n) => [n.id, n]));
  const ordered = [...nodes.filter((n) => n.group), ...nodes.filter((n) => !n.group)];
  const halo = { paintOrder: 'stroke' as const, stroke: 'var(--surface-2)', strokeWidth: 4, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox={`0 0 880 ${height}`} role="img" aria-label={label}>
      <rect className="band" x="10" y="10" width="860" height={height - 20} rx="12" />
      {under}
      {ordered.map((n) => {
        const a = smooth(prog(t, n.at, n.at + 0.5));
        const gone = n.until !== undefined ? 1 - smooth(prog(t, n.until, n.until + 0.6)) : 1;
        const dim = n.dimAt !== undefined && t >= n.dimAt ? 0.5 : 1;
        const op = a * gone * dim;
        if (op <= 0.01) return null;
        const col = toneVar(n.tone);
        const status = n.status ? [...n.status].reverse().find((s) => t >= s.at) : undefined;
        if (n.group) {
          return (
            <g key={n.id} opacity={op}>
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="12" fill="var(--surface)" fillOpacity="0.55" stroke="var(--line-strong)" strokeWidth="1.8" strokeDasharray="7 5" />
              <text className="b" x={n.x + 14} y={n.y + 22} style={{ fontSize: 13.5 }}>{n.title}</text>
              {n.sub && <text className="s" x={n.x + 14} y={n.y + 40}>{n.sub}</text>}
            </g>
          );
        }
        return (
          <g key={n.id} opacity={op} transform={`translate(${n.x} ${n.y + (1 - a) * 8})`}>
            <rect width={n.w} height={n.h} rx="10" fill={`color-mix(in srgb, ${col} 11%, var(--surface))`} stroke={col} strokeWidth="2.5" />
            <text className="b" x="14" y="25" style={{ fontSize: 14.5 }}>{n.title}</text>
            {n.sub && <text className="s m" x="14" y="44">{n.sub}</text>}
            {n.lines?.map((l, i) => (
              <text key={i} className="s" x="14" y={(n.sub ? 64 : 46) + i * 18}>{l}</text>
            ))}
            {status && (
              <text className="s b" x="14" y={n.h - 12} style={{ fill: status.tone ? toneVar(status.tone) : 'var(--accent)' }}>{status.text}</text>
            )}
            {n.crossAt !== undefined && t >= n.crossAt && (
              <g opacity={smooth(prog(t, n.crossAt, n.crossAt + 0.4))}>
                <rect width={n.w} height={n.h} rx="10" fill="var(--accent)" fillOpacity="0.14" stroke="var(--accent)" strokeWidth="3" />
                <line x1={n.w / 2 - 16} y1={n.h / 2 - 16} x2={n.w / 2 + 16} y2={n.h / 2 + 16} stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" />
                <line x1={n.w / 2 - 16} y1={n.h / 2 + 16} x2={n.w / 2 + 16} y2={n.h / 2 - 16} stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" />
              </g>
            )}
          </g>
        );
      })}

      {msgs.map((m) => {
        const dur = m.dur ?? 0.9;
        const p = smooth(prog(t, m.at, m.at + dur));
        if (p <= 0) return null;
        const [p0, p1] = endpoints(m, by);
        const x = p0[0] + (p1[0] - p0[0]) * p;
        const y = p0[1] + (p1[1] - p0[1]) * p;
        const col = toneVar(m.tone);
        const done = t >= m.at + dur;
        const fresh = t < m.at + dur + HOLD;
        const op = fresh ? 1 : 0.38;
        const lx = m.lx ?? (p0[0] + p1[0]) / 2;
        const ly = m.ly ?? (p0[1] + p1[1]) / 2 - 7;
        return (
          <g key={m.id} opacity={op} style={{ transition: 'opacity .4s' }}>
            <line x1={p0[0]} y1={p0[1]} x2={x} y2={y} stroke={col} strokeWidth="3.2" strokeLinecap="round" strokeDasharray={m.dashed ? '8 6' : undefined} />
            {done && <circle cx={p1[0]} cy={p1[1]} r="4.5" fill={col} />}
            {!done && <circle cx={x} cy={y} r="7" fill={col} stroke="var(--surface)" strokeWidth="2" />}
            {m.n !== undefined && (
              <g transform={`translate(${p0[0]} ${p0[1]})`}>
                <circle r="10.5" fill={col} stroke="var(--surface)" strokeWidth="2" />
                <text x="0" y="4" textAnchor="middle" style={{ fontSize: 12, fontWeight: 700, fill: 'var(--on-key, #fff)', fontFamily: 'var(--mono)' }}>{m.n}</text>
              </g>
            )}
            {m.label && p > 0.35 && (
              <text className="s b" x={lx} y={ly} textAnchor={m.anchor ?? 'middle'} style={{ ...halo, fill: col, fontSize: 12 }}>{m.label}</text>
            )}
          </g>
        );
      })}
      {extra}
    </svg>
  );
}
