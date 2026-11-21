// Drawing pieces shared by the Kafka labs. They sit on the colour language of ib.tsx (new, in use, skipped, plain) and add a cell of a log.
import type { ReactNode } from 'react';

export type CellState = 'plain' | 'new' | 'use' | 'skip' | 'bad';

// One cell of a log: the offset above, the content inside, an optional small line under it.
export function Cell({ x, y, w = 52, h = 52, offset, text, sub, state = 'plain', tint }: {
  x: number; y: number; w?: number; h?: number; offset?: number | string; text?: string; sub?: string; state?: CellState; tint?: 1 | 2 | 3;
}) {
  const cls = state === 'new' ? 'ib-new' : state === 'use' ? 'ib-use' : state === 'skip' ? 'ib-skip' : state === 'bad' ? 'ib-node' : 'ib-node';
  return (
    <g>
      <rect className={cls} x={x} y={y} width={w} height={h} rx={8} style={state === 'bad' ? { stroke: 'var(--ib-bad)', strokeWidth: 3 } : undefined} />
      {tint && <rect x={x + 3} y={y + 3} width={w - 6} height={7} rx={3} style={{ fill: `var(--k${tint})` }} />}
      {text !== undefined && <text x={x + w / 2} y={y + h / 2 + 8} textAnchor="middle" className="ib-n">{text}</text>}
      {offset !== undefined && <text x={x + w / 2} y={y - 8} textAnchor="middle" className="ib-s">{offset}</text>}
      {sub && <text x={x + w / 2} y={y + h + 20} textAnchor="middle" className="ib-s">{sub}</text>}
    </g>
  );
}

// A bookmark: a small triangle that points up at the cell it stands under, with a name next to it.
export function Flag({ x, y, label, color = 'var(--accent)', anchor = 'start' }: { x: number; y: number; label: string; color?: string; anchor?: 'start' | 'middle' | 'end' }) {
  const lx = anchor === 'start' ? x + 14 : anchor === 'end' ? x - 14 : x;
  const ly = anchor === 'middle' ? y + 36 : y + 14;
  return (
    <g>
      <polygon points={`${x},${y} ${x - 10},${y + 18} ${x + 10},${y + 18}`} style={{ fill: color }} />
      <text x={lx} y={ly} textAnchor={anchor} className="ib-n" style={{ fill: color }}>{label}</text>
    </g>
  );
}

// A broker or a node: a rounded box with a title and a line under it.
export function Box({ x, y, w, h, title, sub, state = 'node', dead }: { x: number; y: number; w: number; h: number; title: string; sub?: ReactNode; state?: 'node' | 'new' | 'use' | 'skip'; dead?: boolean }) {
  const cls = state === 'new' ? 'ib-new' : state === 'use' ? 'ib-use' : state === 'skip' ? 'ib-skip' : 'ib-node';
  return (
    <g style={dead ? { opacity: 0.45 } : undefined}>
      <rect className={dead ? 'ib-skip' : cls} x={x} y={y} width={w} height={h} rx={12} />
      <text x={x + 14} y={y + 26} className="ib-n">{title}</text>
      {sub && <text x={x + 14} y={y + 48} className="ib-s">{sub}</text>}
    </g>
  );
}

export const tintOf = (key: string): 1 | 2 | 3 => (((parseInt(key.replace(/\D/g, ''), 10) || 1) - 1) % 3 + 1) as 1 | 2 | 3;
