import { STRING_NAMES } from '../../lib/music';

// A chord box: six vertical strings (low E on the left), frets running down. `frets` has one number per string:
// -1 muted, 0 open, n the fret. `fingers` is optional, one number per string (1 index, 2 middle, 3 ring, 4 pinky).

export interface ChordShape {
  name: string;
  frets: number[];
  fingers?: number[];
  /** A barre across strings [from, to] (0 = low E) at `fret`. */
  barre?: { fret: number; from: number; to: number };
  note?: string;
}

const SX = 18; // string spacing
const FY = 22; // fret spacing
const L = 22;
const T = 34;
const ROWS = 5;

export function ChordDiagram({ name, frets, fingers, barre, lang = 'th' }: ChordShape & { lang?: 'th' | 'en' }) {
  const pressed = frets.filter((f) => f > 0);
  const maxF = pressed.length ? Math.max(...pressed) : 1;
  const base = maxF > ROWS ? Math.min(...pressed) : 1;
  const row = (f: number) => f - base + 1; // 1..ROWS
  const w = L * 2 + SX * 5;
  const h = T + FY * ROWS + 14;
  const x = (s: number) => L + s * SX;
  const yMid = (r: number) => T + FY * (r - 0.5);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${lang === 'en' ? 'Chord' : 'คอร์ด'} ${name}: ${frets.map((f) => (f < 0 ? 'x' : f)).join(' ')}`} style={{ width: '100%', maxWidth: 140, height: 'auto' }}>
      <text x={w / 2} y="14" textAnchor="middle" className="b" style={{ fontSize: 15 }}>{name}</text>
      {base === 1 ? (
        <line x1={x(0) - 1} x2={x(5) + 1} y1={T} y2={T} stroke="var(--fg)" strokeWidth="4" />
      ) : (
        <text x={x(0) - 8} y={yMid(1) + 4} textAnchor="end" className="s">{base}fr</text>
      )}
      {Array.from({ length: ROWS }, (_, i) => (
        <line key={i} x1={x(0)} x2={x(5)} y1={T + FY * (i + 1)} y2={T + FY * (i + 1)} stroke="var(--line-strong)" strokeWidth="1.5" />
      ))}
      {STRING_NAMES.map((_, s) => (
        <line key={s} x1={x(s)} x2={x(s)} y1={T} y2={T + FY * ROWS} stroke="var(--muted)" strokeWidth={1 + (5 - s) * 0.18} />
      ))}
      {frets.map((f, s) =>
        f < 0 ? (
          <text key={s} x={x(s)} y={T - 8} textAnchor="middle" className="s b">×</text>
        ) : f === 0 ? (
          <circle key={s} cx={x(s)} cy={T - 11} r="4" fill="none" stroke="var(--fg)" strokeWidth="1.5" />
        ) : null,
      )}
      {barre && <rect x={x(barre.from) - 7} y={yMid(row(barre.fret)) - 7} width={x(barre.to) - x(barre.from) + 14} height="14" rx="7" fill="var(--accent)" />}
      {frets.map((f, s) =>
        f > 0 && !(barre && f === barre.fret && s >= barre.from && s <= barre.to) ? (
          <g key={s}>
            <circle cx={x(s)} cy={yMid(row(f))} r="7.5" fill="var(--accent)" />
            {fingers?.[s] ? (
              <text x={x(s)} y={yMid(row(f)) + 3.5} textAnchor="middle" style={{ fill: 'var(--on-accent)', fontSize: 10, fontWeight: 700 }}>{fingers[s]}</text>
            ) : null}
          </g>
        ) : null,
      )}
    </svg>
  );
}

/** Several chord boxes in a row, for lessons. */
export default function ChordSet({ title, chords, caption, lang = 'th' }: { title?: string; chords: ChordShape[]; caption?: string; lang?: 'th' | 'en' }) {
  return (
    <figure className="viz">
      {title && <div className="viz-title">{title}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 12 }}>
        {chords.map((c) => (
          <div key={c.name} style={{ background: 'var(--surface)', border: '2px solid var(--line)', borderRadius: 'var(--radius)', padding: 8, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <ChordDiagram {...c} lang={lang} />
            </div>
            {c.note && <div className="viz-caption" style={{ fontSize: 13, marginTop: 4 }}>{c.note}</div>}
          </div>
        ))}
      </div>
      {caption && <p className="viz-caption">{caption}</p>}
    </figure>
  );
}
