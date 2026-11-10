import type { ReactNode } from 'react';

// Small SVG plots shared by the singing labs. Every plot is a <g> placed inside a larger <svg>, so a lab can stack several.

export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

// coordinates are rounded: the server and the browser can differ in the last digits of a float, and React would warn about it
const r2 = (v: number) => Math.round(v * 100) / 100;
const X = (f: number, fr: Frame, fMax: number) => r2(fr.x + (f / fMax) * fr.w);
const Y = (v: number, fr: Frame, lo: number, hi: number) => r2(fr.y + fr.h - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * fr.h);

/** keeps what is drawn inside a frame (curves and stems never cross the border); `id` must be unique in the svg */
export function Clip({ id, fr, children }: { id: string; fr: Frame; children?: ReactNode }) {
  return (
    <g>
      <clipPath id={id}>
        <rect x={fr.x + 1} y={fr.y + 1} width={fr.w - 2} height={fr.h - 2} rx="5" />
      </clipPath>
      <g clipPath={`url(#${id})`}>{children}</g>
    </g>
  );
}

/** frame, a baseline, and a frequency axis with ticks every 1 kHz */
export function Axes({ fr, fMax, label, yLabel, ticks = true, children }: { fr: Frame; fMax: number; label?: string; yLabel?: string; ticks?: boolean; children?: ReactNode }) {
  const ks = [];
  for (let k = 0; k <= fMax; k += 1000) ks.push(k);
  return (
    <g>
      <rect x={fr.x} y={fr.y} width={fr.w} height={fr.h} fill="var(--surface)" stroke="var(--line-strong)" strokeWidth="1.5" rx="6" />
      {ticks &&
        ks.map((k) => (
          <g key={k}>
            <line x1={X(k, fr, fMax)} x2={X(k, fr, fMax)} y1={fr.y} y2={fr.y + fr.h} stroke="var(--line)" strokeWidth="1" />
            <text className="s" x={X(k, fr, fMax)} y={fr.y + fr.h + 13} textAnchor="middle">{k === 0 ? '0' : `${k / 1000}k`}</text>
          </g>
        ))}
      {label && <text className="b" x={fr.x + 8} y={fr.y + 16} style={{ fontSize: 13 }}>{label}</text>}
      {yLabel && <text className="s" x={fr.x + fr.w - 8} y={fr.y + 14} textAnchor="end">{yLabel}</text>}
      {children}
    </g>
  );
}

/** vertical lines for harmonics: value in dB between lo and hi, lines drawn from lo up to the value */
export function Stems({ fr, fMax, lo, hi, points, color = 'var(--accent)', width = 3 }: { fr: Frame; fMax: number; lo: number; hi: number; points: { hz: number; db: number }[]; color?: string; width?: number }) {
  return (
    <g>
      {points.map((p) => (
        <line key={p.hz} x1={X(p.hz, fr, fMax)} x2={X(p.hz, fr, fMax)} y1={Y(lo, fr, lo, hi)} y2={Y(p.db, fr, lo, hi)} stroke={color} strokeWidth={width} strokeLinecap="round" />
      ))}
    </g>
  );
}

/** a curve of f(hz) in dB */
export function Curve({ fr, fMax, lo, hi, fn, color = 'var(--k1)', width = 2.5, area = false }: { fr: Frame; fMax: number; lo: number; hi: number; fn: (hz: number) => number; color?: string; width?: number; area?: boolean }) {
  const pts: string[] = [];
  const N = 160;
  for (let i = 0; i <= N; i++) {
    const hz = (i / N) * fMax;
    pts.push(`${i === 0 ? 'M' : 'L'}${X(hz, fr, fMax).toFixed(1)},${Y(fn(Math.max(hz, 20)), fr, lo, hi).toFixed(1)}`);
  }
  const d = pts.join(' ');
  return (
    <g>
      {area && <path d={`${d} L${X(fMax, fr, fMax)},${fr.y + fr.h} L${X(0, fr, fMax)},${fr.y + fr.h} Z`} fill={color} opacity="0.14" />}
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinejoin="round" />
    </g>
  );
}

/** dotted vertical markers (formants) with labels */
export function Markers({ fr, fMax, at, color = 'var(--k1)' }: { fr: Frame; fMax: number; at: { hz: number; text: string }[]; color?: string }) {
  return (
    <g>
      {at
        .filter((m) => m.hz < fMax)
        .map((m) => (
          <g key={m.text}>
            <line x1={X(m.hz, fr, fMax)} x2={X(m.hz, fr, fMax)} y1={fr.y} y2={fr.y + fr.h} stroke={color} strokeWidth="1.5" strokeDasharray="3 4" />
            {(() => {
              const mx = X(m.hz, fr, fMax);
              const left = mx > fr.x + fr.w - 34;
              return <text x={left ? mx - 4 : mx + 4} y={fr.y + 14} textAnchor={left ? 'end' : 'start'} fontSize="12" fill={color} style={{ fontWeight: 700 }}>{m.text}</text>;
            })()}
          </g>
        ))}
    </g>
  );
}

export { X as xOf, Y as yOf };
