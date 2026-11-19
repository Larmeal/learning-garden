import type { ReactNode } from 'react';

// Small HTML pieces shared by the Data Security labs: a card, a bar with a number, and a grid of 100 cells where each cell stands for a share of the people.
// Colours are the tokens of the site (accent for the thing to look at, --ib-bad for harm). Every piece takes plain numbers.

export const mono = { fontFamily: 'var(--mono, monospace)', fontSize: 14, wordBreak: 'break-all' } as const;

export function Card({ children, bad, good, style }: { children: ReactNode; bad?: boolean; good?: boolean; style?: React.CSSProperties }) {
  return (
    <div style={{ border: `3px solid ${bad ? 'var(--ib-bad)' : good ? 'var(--accent)' : 'var(--line-strong)'}`, borderRadius: 12, padding: 12, background: 'var(--surface)', minWidth: 0, ...style }}>
      {children}
    </div>
  );
}

export function Bar({ label, value, max, text, bad }: { label: string; value: number; max: number; text: string; bad?: boolean }) {
  const w = Math.max(0, Math.min(1, value / max));
  return (
    <div style={{ margin: '6px 0' }}>
      <div style={{ fontSize: 14, color: 'var(--muted)' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 22, background: 'var(--accent-soft)', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--line-strong)' }}>
          <div style={{ width: `${w * 100}%`, height: '100%', background: bad ? 'var(--ib-bad)' : 'var(--accent)', transition: 'width .3s' }} />
        </div>
        <div style={{ minWidth: 110, fontWeight: 700, textAlign: 'right' }}>{text}</div>
      </div>
    </div>
  );
}

// 100 cells in 10 rows. `filled` of them are drawn in the strong colour.
export function Cells({ filled, bad, label }: { filled: number; bad?: boolean; label?: string }) {
  const n = Math.max(0, Math.min(100, Math.round(filled)));
  return (
    <div role="img" aria-label={label}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(20, 1fr)', gap: 3, maxWidth: 520 }}>
        {Array.from({ length: 100 }, (_, i) => (
          <div key={i} style={{ aspectRatio: '1', borderRadius: 3, background: i < n ? (bad ? 'var(--ib-bad)' : 'var(--accent)') : 'var(--accent-soft)', border: '1px solid var(--line-strong)' }} />
        ))}
      </div>
    </div>
  );
}

export function Row({ children, gap = 12 }: { children: ReactNode; gap?: number }) {
  return <div style={{ display: 'flex', gap, flexWrap: 'wrap', alignItems: 'stretch' }}>{children}</div>;
}

export const pct = (x: number, n: number) => `${((x / n) * 100).toFixed(x / n < 0.1 && x > 0 ? 1 : 0)}%`;
export const num = (x: number) => x.toLocaleString('en-US');

// A row of legend chips for the pictures that are drawn with plain colours: a dot of the colour, then what it means.
export function Key({ items }: { items: { color: string; text: string; ring?: boolean; faded?: boolean }[] }) {
  return (
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', margin: '4px 0 10px', fontSize: 15 }}>
      {items.map((it) => (
        <span key={it.text} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 16, height: 16, borderRadius: '50%', background: it.ring ? 'transparent' : it.color, border: it.ring ? `3px solid ${it.color}` : '1px solid var(--line-strong)', opacity: it.faded ? 0.35 : 1, display: 'inline-block' }} />
          {it.text}
        </span>
      ))}
    </div>
  );
}

// A person drawn as a head and shoulders, centred on (cx, cy) with the head radius r. Used wherever the lesson talks about "a person".
export function PersonGlyph({ cx, cy, r = 16, fill = 'var(--accent)', stroke = 'var(--line-strong)', op = 1, ring }: { cx: number; cy: number; r?: number; fill?: string; stroke?: string; op?: number; ring?: string }) {
  return (
    <g opacity={op}>
      {ring ? <circle cx={cx} cy={cy + r * 0.6} r={r * 2.1} fill="none" stroke={ring} strokeWidth={3} /> : null}
      <path d={`M ${cx - r * 1.5} ${cy + r * 2.5} Q ${cx - r * 1.5} ${cy + r * 0.9} ${cx} ${cy + r * 0.9} Q ${cx + r * 1.5} ${cy + r * 0.9} ${cx + r * 1.5} ${cy + r * 2.5} Z`} fill={fill} stroke={stroke} strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={r * 0.75} fill={fill} stroke={stroke} strokeWidth={1.5} />
    </g>
  );
}
