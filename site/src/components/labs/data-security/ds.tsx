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
