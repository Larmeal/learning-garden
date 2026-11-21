import type { ReactNode } from 'react';

// Drawing pieces shared by the DevOps labs. They sit on the classes of the Iceberg and Networking labs (ib-, nw-), so the colour language is the same:
// accent = the thing that is new or active, green = fine, orange (--ib-bad) = failed or refused, dashed and faded = skipped or not yet.
export type Lang = 'th' | 'en';
export type TileState = 'plain' | 'on' | 'ok' | 'bad' | 'skip';

export function Seg<T extends string>({ label, options, value, onChange }: { label: string; options: { id: T; text: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="ib-controls">
      <span className="ib-lbl">{label}</span>
      <span className="seg" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.text}</button>
        ))}
      </span>
    </div>
  );
}

// A box with a plain name on top and a technical line under it.
export function Tile({ x, y, w, h = 56, title, sub, state = 'plain', op = 1, big }: { x: number; y: number; w: number; h?: number; title: ReactNode; sub?: ReactNode; state?: TileState; op?: number; big?: boolean }) {
  if (op <= 0.01) return null;
  const cls = state === 'on' ? 'nw-cell on' : state === 'ok' ? 'nw-cell ok' : state === 'bad' ? 'nw-cell bad' : 'nw-cell';
  return (
    <g style={{ opacity: state === 'skip' ? Math.min(op, 0.5) : op }}>
      <rect className={cls} x={x} y={y} width={w} height={h} rx={10} style={state === 'skip' ? { strokeDasharray: '7 5' } : undefined} />
      <text x={x + w / 2} y={sub ? y + h / 2 - 3 : y + h / 2 + 6} textAnchor="middle" className="ib-n" style={big ? { fontSize: 20 } : undefined}>{title}</text>
      {sub && <text x={x + w / 2} y={y + h / 2 + 19} textAnchor="middle" className="ib-m">{sub}</text>}
    </g>
  );
}

export function Arrow({ x1, y1, x2, y2, bad, dashed, op = 1, w = 4 }: { x1: number; y1: number; x2: number; y2: number; bad?: boolean; dashed?: boolean; op?: number; w?: number }) {
  if (op <= 0.01) return null;
  const a = Math.atan2(y2 - y1, x2 - x1);
  const col = bad ? 'var(--ib-bad)' : 'var(--accent)';
  const h = 11;
  return (
    <g style={{ opacity: op }}>
      <path d={`M${x1},${y1} L${x2},${y2}`} style={{ stroke: col, strokeWidth: w, fill: 'none', strokeLinecap: 'round', strokeDasharray: dashed ? '9 6' : undefined }} />
      <path d={`M${x2},${y2} l${-h * Math.cos(a - 0.45)},${-h * Math.sin(a - 0.45)} M${x2},${y2} l${-h * Math.cos(a + 0.45)},${-h * Math.sin(a + 0.45)}`} style={{ stroke: col, strokeWidth: w, fill: 'none', strokeLinecap: 'round' }} />
    </g>
  );
}

// A request, a commit or a change as a small dot. ok = green, bad = orange with a cross, none = accent.
export function Dot({ x, y, r = 7, kind = 'none', op = 1 }: { x: number; y: number; r?: number; kind?: 'none' | 'ok' | 'bad' | 'old'; op?: number }) {
  if (op <= 0.01) return null;
  const fill = kind === 'ok' ? 'var(--k2)' : kind === 'bad' ? 'var(--ib-bad)' : kind === 'old' ? 'var(--line-strong)' : 'var(--accent)';
  return (
    <g style={{ opacity: op }}>
      <circle cx={x} cy={y} r={r} style={{ fill }} />
      {kind === 'bad' && <path d={`M${x - r * 0.45},${y - r * 0.45} l${r * 0.9},${r * 0.9} M${x + r * 0.45},${y - r * 0.45} l${-r * 0.9},${r * 0.9}`} style={{ stroke: '#fff', strokeWidth: 1.6, fill: 'none' }} />}
    </g>
  );
}

// A jar that holds an amount between 0 and 1 (the error budget): it drains from the top.
export function Jar({ x, y, w, h, left, label, bad }: { x: number; y: number; w: number; h: number; left: number; label?: string; bad?: boolean }) {
  const l = Math.max(0, Math.min(1, left));
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={12} className="ib-node" />
      <rect x={x + 4} y={y + 4 + (h - 8) * (1 - l)} width={w - 8} height={(h - 8) * l} rx={8} style={{ fill: bad ? 'color-mix(in srgb, var(--ib-bad) 35%, var(--surface))' : 'color-mix(in srgb, var(--k2) 35%, var(--surface))' }} />
      {label && <text x={x + w / 2} y={y + h / 2 + 8} textAnchor="middle" className="ib-big" style={{ fontSize: 30 }}>{label}</text>}
    </g>
  );
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;
