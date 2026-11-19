import type { ReactNode } from 'react';

// Small drawing pieces shared by the Application Security labs that are not sequence diagrams (those use seq.tsx).
// Every piece draws inside an SVG and takes plain numbers, so a lab only decides where things go.

export type Tone = 'plain' | 'bad' | 'ok' | 'acc';
export const toneStroke = (t: Tone) => (t === 'bad' ? 'var(--ib-bad)' : t === 'ok' || t === 'acc' ? 'var(--accent)' : 'var(--line-strong)');
export const toneFill = (t: Tone) => (t === 'bad' ? 'color-mix(in srgb, var(--ib-bad) 10%, var(--surface))' : t === 'ok' ? 'var(--accent-soft)' : 'var(--surface)');

// Wrap on spaces, and cut a word that is longer than the line (a payload such as <script>send(document.cookie)</script> has no spaces).
export function wrapAny(text: string, max: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const raw of text.split(' ')) {
    let w = raw;
    while (w.length > max) {
      if (cur) { out.push(cur); cur = ''; }
      out.push(w.slice(0, max));
      w = w.slice(max);
    }
    if (cur && (cur + ' ' + w).length > max) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) out.push(cur);
  return out;
}

// A card with a small title and a wrapped body. `max` is the character budget of one line.
export function Paper({ x, y, w, h, title, text, max, mono, tone = 'plain', size = 15, op = 1, strike, children }: {
  x: number; y: number; w: number; h: number; title?: string; text?: string; max: number; mono?: boolean; tone?: Tone; size?: number; op?: number; strike?: boolean; children?: ReactNode;
}) {
  const lines = text ? wrapAny(text, max) : [];
  const top = title ? 48 : 28;
  return (
    <g opacity={op}>
      <rect x={x} y={y} width={w} height={h} rx={12} fill={toneFill(tone)} stroke={toneStroke(tone)} strokeWidth={tone === 'plain' ? 2 : 3} />
      {title ? <text x={x + 14} y={y + 24} className="ib-s" style={{ fontSize: 13.5 }}>{title}</text> : null}
      <text x={x + 14} y={y + top} style={{ fontSize: size, fontWeight: tone === 'plain' ? 400 : 700, fontFamily: mono ? 'var(--mono, monospace)' : undefined, fill: tone === 'bad' ? 'var(--ib-bad)' : 'var(--fg)' }}>
        {lines.map((l, i) => <tspan key={i} x={x + 14} dy={i === 0 ? 0 : size * 1.38}>{l}</tspan>)}
      </text>
      {strike ? <line x1={x + 10} y1={y + h - 10} x2={x + w - 10} y2={y + 10} stroke="var(--ib-bad)" strokeWidth={4} opacity={0.8} /> : null}
      {children}
    </g>
  );
}

// A seal: eight coloured cells taken from the first bytes of a hex string. Two equal hex strings give two equal seals, so that "do they match" can be seen.
export function Seal({ x, y, hex, cell = 11, dim }: { x: number; y: number; hex: string; cell?: number; dim?: boolean }) {
  const clean = (hex || '').replace(/[^0-9a-f]/gi, '');
  return (
    <g opacity={dim ? 0.35 : 1}>
      {Array.from({ length: 8 }, (_, i) => {
        const b = clean.length >= 2 * (i + 1) ? parseInt(clean.slice(2 * i, 2 * i + 2), 16) : -1;
        const fill = b < 0 ? 'var(--accent-soft)' : `hsl(${Math.round((b / 255) * 360)} 62% ${i % 2 ? 46 : 58}%)`;
        return <rect key={i} x={x + (i % 4) * cell} y={y + Math.floor(i / 4) * cell} width={cell - 1.5} height={cell - 1.5} rx={2} fill={fill} stroke="var(--line-strong)" strokeWidth={0.8} />;
      })}
    </g>
  );
}

// A person as a head and shoulders (the same shape as the Data Security labs).
export function Figure({ cx, cy, r = 14, fill = 'var(--accent)', op = 1 }: { cx: number; cy: number; r?: number; fill?: string; op?: number }) {
  return (
    <g opacity={op}>
      <path d={`M ${cx - r * 1.5} ${cy + r * 2.5} Q ${cx - r * 1.5} ${cy + r * 0.9} ${cx} ${cy + r * 0.9} Q ${cx + r * 1.5} ${cy + r * 0.9} ${cx + r * 1.5} ${cy + r * 2.5} Z`} fill={fill} stroke="var(--line-strong)" strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={r * 0.75} fill={fill} stroke="var(--line-strong)" strokeWidth={1.5} />
    </g>
  );
}

// A shield, centred on (cx, cy).
export function Shield({ cx, cy, s = 1, color = 'var(--accent)', op = 1 }: { cx: number; cy: number; s?: number; color?: string; op?: number }) {
  return (
    <g opacity={op} transform={`translate(${cx} ${cy}) scale(${s})`}>
      <path d="M0,-22 L18,-15 L18,2 Q18,16 0,24 Q-18,16 -18,2 L-18,-15 Z" fill={color} stroke="var(--line-strong)" strokeWidth={1.5} />
      <path d="M-8,0 L-2,7 L9,-8" fill="none" stroke="var(--on-key, #fff)" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

// An envelope (a request, a message) with its flap, centred on (cx, cy).
export function Envelope({ cx, cy, w = 56, color = 'var(--accent)', op = 1 }: { cx: number; cy: number; w?: number; color?: string; op?: number }) {
  const h = w * 0.66;
  return (
    <g opacity={op}>
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={5} fill="var(--surface)" stroke={color} strokeWidth={3} />
      <path d={`M${cx - w / 2},${cy - h / 2} L${cx},${cy + 2} L${cx + w / 2},${cy - h / 2}`} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" />
    </g>
  );
}
