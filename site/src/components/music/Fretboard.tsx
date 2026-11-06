import type { Mark } from '../../lib/music';
import { STRING_NAMES } from '../../lib/music';

// A guitar neck drawn the way a player sees it from above: high e on top, low E at the bottom, nut on the left.
// The component only draws what it is told (`marks`); labs decide which notes to light up.

interface Props {
  marks?: Mark[];
  frets?: number;
  /** Fires with (string, fret) when a cell is clicked. Strings count from the low E = 0. */
  onPick?: (string: number, fret: number) => void;
  label?: string;
  lang?: 'th' | 'en';
}

const X0 = 46; // nut
const W = 840; // nut to the last fret line
const TOP = 26;
const GAP = 28;
const H = TOP * 2 + GAP * 5 + 14;

// Frets get narrower up the neck, like a real one (twelfth root of two).
const edge = (f: number, frets: number) => X0 + (W * (1 - 2 ** (-f / 12))) / (1 - 2 ** (-frets / 12));
const rowY = (s: number) => TOP + (5 - s) * GAP;

type Kind = NonNullable<Mark['kind']>;
const paint = (k: Kind) =>
  k === 'root'
    ? { fill: 'var(--accent)', stroke: 'var(--accent)', text: 'var(--on-accent)' }
    : k === 'target'
      ? { fill: 'var(--sun)', stroke: 'var(--sun)', text: '#2A1F00' }
      : k === 'faint'
        ? { fill: 'var(--surface-2)', stroke: 'var(--line-strong)', text: 'var(--muted)' }
        : { fill: 'var(--accent-soft)', stroke: 'var(--accent)', text: 'var(--fg)' };

export default function Fretboard({ marks = [], frets = 15, onPick, label, lang = 'th' }: Props) {
  const mid = (f: number) => (edge(f - 1, frets) + edge(f, frets)) / 2;
  const single = [3, 5, 7, 9, 15, 17, 19, 21].filter((f) => f <= frets);

  return (
    <svg viewBox={`0 0 ${X0 + W + 24} ${H}`} role="img" aria-label={label ?? (lang === 'en' ? 'Guitar fretboard' : 'คอกีต้าร์')}>
      <rect x={X0} y={TOP - 12} width={W} height={GAP * 5 + 24} rx="4" fill="var(--surface-2)" />
      {single.map((f) => (
        <circle key={f} cx={mid(f)} cy={TOP + GAP * 2.5} r="5" fill="var(--line-strong)" />
      ))}
      {frets >= 12 && (
        <>
          <circle cx={mid(12)} cy={TOP + GAP * 1.5} r="5" fill="var(--line-strong)" />
          <circle cx={mid(12)} cy={TOP + GAP * 3.5} r="5" fill="var(--line-strong)" />
        </>
      )}
      {Array.from({ length: frets + 1 }, (_, f) => (
        <line key={f} x1={edge(f, frets)} x2={edge(f, frets)} y1={TOP - 8} y2={TOP + GAP * 5 + 8} stroke={f === 0 ? 'var(--fg)' : 'var(--line-strong)'} strokeWidth={f === 0 ? 5 : 2} />
      ))}
      {[1, 3, 5, 7, 9, 12, 15, 17].filter((f) => f <= frets).map((f) => (
        <text key={f} className="s" x={mid(f)} y={H - 4} textAnchor="middle">{f}</text>
      ))}
      {STRING_NAMES.map((n, s) => (
        <g key={s}>
          <line x1={X0} x2={X0 + W} y1={rowY(s)} y2={rowY(s)} stroke="var(--muted)" strokeWidth={0.8 + (5 - s) * 0.35} />
          <text className="s b" x={X0 - 32} y={rowY(s) + 4} textAnchor="middle">{n}</text>
        </g>
      ))}
      {onPick &&
        STRING_NAMES.flatMap((_, s) =>
          Array.from({ length: frets + 1 }, (_, f) => {
            const x1 = f === 0 ? X0 - 28 : edge(f - 1, frets);
            const x2 = f === 0 ? X0 : edge(f, frets);
            return (
              <rect key={`${s}-${f}`} x={x1} y={rowY(s) - GAP / 2} width={x2 - x1} height={GAP} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => onPick(s, f)}>
                <title>{lang === 'en' ? `String ${STRING_NAMES[s]} fret ${f}` : `สาย ${STRING_NAMES[s]} เฟร็ต ${f}`}</title>
              </rect>
            );
          }),
        )}
      {marks.map((m) => {
        const st = paint(m.kind ?? 'tone');
        const cx = m.fret === 0 ? X0 - 14 : mid(m.fret);
        return (
          <g key={`${m.string}-${m.fret}`} pointerEvents="none">
            <circle cx={cx} cy={rowY(m.string)} r="11.5" fill={st.fill} stroke={st.stroke} strokeWidth="1.5" />
            {m.label && (
              <text x={cx} y={rowY(m.string) + 4} textAnchor="middle" style={{ fill: st.text, fontSize: m.label.length > 2 ? 9 : 11, fontWeight: 600 }}>
                {m.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
