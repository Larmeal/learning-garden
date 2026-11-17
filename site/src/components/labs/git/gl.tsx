import type { ReactNode } from 'react';
import { prog, smooth, mix } from '../spark/timeline';

// Small drawing pieces shared by the animated Git labs: a commit circle, a line that grows, a branch label.
// Every piece takes plain numbers (position, opacity, progress), so a lab can draw itself as a pure function of the clock time.
// Colour classes are the ib- ones of the Iceberg labs (ib-new, ib-use, ib-skip, ib-line), so the legend of every lab reads the same.

export const ease = (t: number, a: number, b: number) => smooth(prog(t, a, b));
export { mix, prog, smooth };

export type CommitKind = 'new' | 'use' | 'skip' | 'bad' | 'plain';

const KIND_CLASS: Record<CommitKind, string> = { new: 'ib-new', use: 'ib-use', skip: 'ib-skip', bad: 'ib-use', plain: 'ib-node' };

export function Commit({
  x, y, name, id, kind = 'use', op = 1, r = 23, idDy, mark, idSide = 'below',
}: { x: number; y: number; name: string; id?: string; kind?: CommitKind; op?: number; r?: number; idDy?: number; mark?: 'ok' | 'bad'; idSide?: 'below' | 'left' | 'right' }) {
  if (op <= 0.01) return null;
  return (
    <g style={{ opacity: op }}>
      <circle className={KIND_CLASS[kind]} cx={x} cy={y} r={r} style={kind === 'bad' ? { stroke: 'var(--ib-bad)', fill: 'var(--surface)' } : undefined} />
      <text x={x} y={y + 6} textAnchor="middle" className="ib-n">{name}</text>
      {id && idSide === 'below' && <text x={x} y={y + (idDy ?? r + 20)} textAnchor="middle" className="ib-m">{id}</text>}
      {id && idSide === 'left' && <text x={x - r - 7} y={y + 5} textAnchor="end" className="ib-m">{id}</text>}
      {id && idSide === 'right' && <text x={x + r + 7} y={y + 5} textAnchor="start" className="ib-m">{id}</text>}
      {mark && <text x={x + r - 2} y={y - r + 6} textAnchor="middle" className={mark === 'ok' ? 'ib-ok ib-n' : 'ib-bad ib-n'}>{mark === 'ok' ? '✓' : '✗'}</text>}
    </g>
  );
}

// A straight line from (x1,y1) that has grown to the fraction p of the way to (x2,y2).
export function Link({
  x1, y1, x2, y2, p = 1, dashed, op = 1, accent, width = 3,
}: { x1: number; y1: number; x2: number; y2: number; p?: number; dashed?: boolean; op?: number; accent?: boolean; width?: number }) {
  if (p <= 0.001 || op <= 0.01) return null;
  return (
    <path
      className="ib-line"
      d={`M${x1},${y1} L${mix(x1, x2, p)},${mix(y1, y2, p)}`}
      style={{ strokeWidth: width, opacity: op, strokeDasharray: dashed ? '6 5' : undefined, stroke: accent ? 'var(--accent)' : undefined }}
    />
  );
}

// A label for a branch name or a pointer. The first style is filled with the accent colour, the second is plain.
export function Pill({
  x, y, text, accent, op = 1, w, width,
}: { x: number; y: number; text: string; accent?: boolean; op?: number; w?: number; width?: number }) {
  if (op <= 0.01) return null;
  const pw = w ?? width ?? Math.max(54, text.length * 9 + 22);
  return (
    <g style={{ opacity: op }}>
      <rect className={accent ? 'ib-new' : 'ib-node'} x={x - pw / 2} y={y - 15} width={pw} height={30} rx={9} style={accent ? { strokeWidth: 2.5 } : undefined} />
      <text x={x} y={y + 5} textAnchor="middle" className="ib-m" style={{ fill: 'var(--fg)', fontWeight: 700 }}>{text}</text>
    </g>
  );
}

// A small stat row: a label on the left, a value on the right.
export function Row({ x, y, w, label, value, good, bad, op = 1 }: { x: number; y: number; w: number; label: ReactNode; value: ReactNode; good?: boolean; bad?: boolean; op?: number }) {
  if (op <= 0.01) return null;
  return (
    <g style={{ opacity: op }}>
      <text x={x} y={y} className="ib-s">{label}</text>
      <text x={x + w} y={y} textAnchor="end" className={good ? 'ib-ok ib-n' : bad ? 'ib-bad ib-n' : 'ib-n'}>{value}</text>
    </g>
  );
}
