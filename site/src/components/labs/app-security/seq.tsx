import type { ReactNode } from 'react';
import { prog, smooth, mix } from '../spark/timeline';
import { wrapText } from '../iceberg/ib';

// A small sequence diagram that draws itself as a function of the clock time t: boxes at the top with a dashed line down, numbered arrows that grow
// from one line to another, a label above each arrow, and notes (boxes) that appear at a time. Used by the labs that follow a request between parties.
// Every size is in the 880 unit wide SVG of the labs (text 14 units or more).

export type Party = { x: number; title: string; sub?: string; bad?: boolean };
export type Msg = { from: number; to: number; y: number; at: number; dur?: number; label: string; kind?: 'normal' | 'bad' | 'blocked'; n?: number; max?: number };
export type Note = { x: number; y: number; w: number; h: number; at: number; text: string; kind?: 'ok' | 'bad' | 'plain'; max?: number };

export const BOTTOM = 0;

export function SeqHeader({ parties, bottom }: { parties: Party[]; bottom: number }) {
  return (
    <g>
      {parties.map((p) => (
        <g key={p.title}>
          <rect className={p.bad ? 'ib-node' : 'ib-use'} x={p.x - 70} y={8} width={140} height={p.sub ? 54 : 40} rx={10} style={p.bad ? { stroke: 'var(--ib-bad)', strokeWidth: 3 } : undefined} />
          <text x={p.x} y={p.sub ? 31 : 34} textAnchor="middle" className="ib-n" style={{ fontWeight: 700, fontSize: 17 }}>{p.title}</text>
          {p.sub && <text x={p.x} y={53} textAnchor="middle" className="ib-s">{p.sub}</text>}
          <line x1={p.x} y1={p.sub ? 62 : 48} x2={p.x} y2={bottom} className="ib-line" style={{ strokeDasharray: '6 6' }} />
        </g>
      ))}
    </g>
  );
}

export function SeqMsg({ m, parties, t }: { m: Msg; parties: Party[]; t: number }) {
  const dur = m.dur ?? 1.3;
  if (t < m.at - 0.05) return null;
  const x1 = parties[m.from].x, x2 = parties[m.to].x;
  const dir = x2 > x1 ? 1 : -1;
  const p = smooth(prog(t, m.at, m.at + dur));
  const reach = m.kind === 'blocked' ? 0.62 : 1;
  const xe = mix(x1, x2, p * reach);
  const color = m.kind === 'bad' ? 'var(--ib-bad)' : m.kind === 'blocked' ? 'var(--ib-bad)' : 'var(--accent)';
  const mid = (x1 + x2) / 2;
  const span = Math.abs(x2 - x1);
  const max = Math.max(m.max ?? 0, Math.floor((span + 120) / 8), 30);
  const lines = wrapText(m.label, max);
  const lh = 19;
  const labelOn = p > 0.55;
  return (
    <g>
      <line x1={x1} y1={m.y} x2={xe} y2={m.y} stroke={color} strokeWidth={3.5} />
      <path d={`M${xe},${m.y} l${-9 * dir},-6 l0,12 z`} fill={color} />
      {m.n != null && (
        <g>
          <circle cx={x1 + dir * 26} cy={m.y} r={14} style={{ fill: color }} />
          <text x={x1 + dir * 26} y={m.y + 5} textAnchor="middle" className="ib-white" style={{ fontSize: 14 }}>{m.n}</text>
        </g>
      )}
      {m.kind === 'blocked' && p >= 0.99 && (
        <text x={xe} y={m.y + 7} textAnchor="middle" style={{ fill: 'var(--ib-bad)', fontSize: 26, fontWeight: 700 }}>✗</text>
      )}
      <text x={mid} y={m.y - 20 - (lines.length - 1) * lh} textAnchor="middle" className="ib-n" style={{ opacity: labelOn ? 1 : 0 }}>
        {lines.map((l, i) => <tspan key={i} x={mid} dy={i === 0 ? 0 : lh}>{l}</tspan>)}
      </text>
    </g>
  );
}

export function SeqNote({ n, t }: { n: Note; t: number }) {
  const a = smooth(prog(t, n.at, n.at + 0.6));
  if (a <= 0.01) return null;
  const cls = n.kind === 'ok' ? 'ib-new' : 'ib-node';
  const lines = wrapText(n.text, n.max ?? Math.max(16, Math.floor((n.w - 24) / 9)));
  return (
    <g style={{ opacity: a }}>
      <rect className={cls} x={n.x} y={n.y} width={n.w} height={n.h} rx={10} style={n.kind === 'bad' ? { stroke: 'var(--ib-bad)', strokeWidth: 3, fill: 'var(--surface)' } : undefined} />
      <text x={n.x + 12} y={n.y + 26} className={n.kind === 'bad' ? 'ib-bad ib-n' : 'ib-n'}>
        {lines.map((l, i) => <tspan key={i} x={n.x + 12} dy={i === 0 ? 0 : 19}>{l}</tspan>)}
      </text>
    </g>
  );
}

export function Seq({ parties, msgs, notes, t, bottom, extra }: { parties: Party[]; msgs: Msg[]; notes?: Note[]; t: number; bottom: number; extra?: ReactNode }) {
  return (
    <g>
      <SeqHeader parties={parties} bottom={bottom} />
      {msgs.map((m, i) => <SeqMsg key={i} m={m} parties={parties} t={t} />)}
      {notes?.map((n, i) => <SeqNote key={i} n={n} t={t} />)}
      {extra}
    </g>
  );
}
