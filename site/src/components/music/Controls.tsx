import type { ReactNode } from 'react';

// Small controls shared by the music labs. They reuse the garden's .viz-steps pills so they match the other labs.

export function Pills<T extends string | number>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { value: T; text: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
      <span className="gx-detail" style={{ minWidth: 56 }}>{label}</span>
      <div className="viz-steps">
        {options.map((o) => (
          <button key={String(o.value)} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.text}</button>
        ))}
      </div>
    </div>
  );
}

export function Slider({ label, value, min, max, step = 1, unit = '', onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span className="gx-detail" style={{ minWidth: 56 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ accentColor: 'var(--accent)', width: 'min(260px, 60vw)' }} />
      <b style={{ fontFamily: 'var(--mono)', fontSize: 14 }}>{value}{unit}</b>
    </label>
  );
}

/** The twelve roots, spelled the way a key is usually written (flats for D♭ E♭ A♭ B♭, sharp for F♯). */
export const ROOTS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
export const rootOptions = ROOTS.map((r) => ({ value: r, text: r }));
