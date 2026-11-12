import type { ReactNode } from 'react';

// Small pieces shared by the Iceberg labs, so that every lab speaks the same visual language:
//   new = filled with the accent colour and a "new" tag, in use = accent border, skipped = dashed and faded, other = plain.
export type NodeState = 'node' | 'new' | 'use' | 'skip';

export function Legend({ items }: { items: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[] }) {
  return (
    <div className="ib-legend" aria-label="legend">
      {items.map((it) => (
        <span key={it.text}><i className={it.kind === 'node' ? '' : it.kind} />{it.text}</span>
      ))}
    </div>
  );
}

// A box with a plain-language title on top and the technical name underneath.
export function Node({
  x, y, w, h, title, sub, state = 'node', tag, dim, mono = true,
}: { x: number; y: number; w: number; h: number; title: string; sub?: string; state?: NodeState; tag?: string; dim?: boolean; mono?: boolean }) {
  const cls = state === 'new' ? 'ib-new' : state === 'use' ? 'ib-use' : state === 'skip' ? 'ib-skip' : 'ib-node';
  const tw = tag ? Math.max(38, tag.length * 8 + 16) : 0;
  return (
    <g className={dim ? 'ib-dim' : undefined} style={state === 'skip' ? { opacity: 0.6 } : undefined}>
      <rect className={cls} x={x} y={y} width={w} height={h} rx={9} />
      <text x={x + 12} y={sub ? y + h / 2 - 3 : y + h / 2 + 6} className="ib-n">{title}</text>
      {sub && <text x={x + 12} y={y + h / 2 + 18} className={mono ? 'ib-m' : 'ib-s'}>{sub}</text>}
      {tag && (
        <g>
          <rect className="ib-badge" x={x + w - tw - 6} y={y - 13} width={tw} height={20} rx={10} />
          <text x={x + w - tw / 2 - 6} y={y + 1} className="ib-white">{tag}</text>
        </g>
      )}
    </g>
  );
}

// A numbered round badge that sits on an arrow.
export function Num({ x, y, n, color = 'var(--accent)' }: { x: number; y: number; n: number | string; color?: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={15} style={{ fill: color }} />
      <text x={x} y={y + 5} className="ib-white" style={{ fontSize: 15 }}>{n}</text>
    </g>
  );
}

// The one-sentence banner at the bottom of a picture: what is happening in this step.
export function Banner({ y, text, w = 856 }: { y: number; text: ReactNode; w?: number }) {
  return (
    <g>
      <rect className="ib-banner" x={12} y={y} width={w} height={44} rx={10} />
      <text x={26} y={y + 28} className="ib-n">{text}</text>
    </g>
  );
}

// Greedy word wrap for SVG text (an approximate character budget per line; Thai has spaces between phrases).
export function wrapText(text: string, max: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > max) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? cur + ' ' + w : w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export function Lines({ x, y, text, max, lh = 20, className, anchor }: { x: number; y: number; text: string; max: number; lh?: number; className?: string; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <text x={x} y={y} className={className} textAnchor={anchor}>
      {wrapText(text, max).map((l, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : lh}>{l}</tspan>
      ))}
    </text>
  );
}
