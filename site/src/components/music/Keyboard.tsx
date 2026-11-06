import { SHARP_NAMES } from '../../lib/music';

// A piano keyboard of whole octaves starting on a C. Lights keys by MIDI number; clicking reports the MIDI number.

export interface KeyMark {
  midi: number;
  label?: string;
  kind?: 'root' | 'tone' | 'target';
}
interface Props {
  marks?: KeyMark[];
  from?: number; // MIDI of the first C, default 60 (middle C)
  octaves?: number;
  onPick?: (midi: number) => void;
  label?: string;
  lang?: 'th' | 'en';
}

const WHITE = [0, 2, 4, 5, 7, 9, 11];
const KW = 40;
const KH = 130;

const fill = (m?: KeyMark, black?: boolean) =>
  !m ? (black ? '#1B221E' : '#F4F6F2') : m.kind === 'root' ? 'var(--accent)' : m.kind === 'target' ? 'var(--sun)' : 'color-mix(in srgb, var(--accent) 38%, #F4F6F2)';
// The keys keep one fixed palette in both themes (white keys light, black keys dark), so only marked keys take theme colors.
const ink = (m?: KeyMark) => (m?.kind === 'root' ? 'var(--on-accent)' : m?.kind === 'target' ? '#2A1F00' : '#12241A');

export default function Keyboard({ marks = [], from = 60, octaves = 2, onPick, label, lang = 'th' }: Props) {
  const whites: number[] = [];
  const blacks: { midi: number; x: number }[] = [];
  for (let o = 0; o < octaves; o++) {
    WHITE.forEach((pc, i) => {
      const midi = from + o * 12 + pc;
      whites.push(midi);
      if ([0, 1, 3, 4, 5].includes(i)) blacks.push({ midi: midi + 1, x: (o * 7 + i + 1) * KW - 12 });
    });
  }
  whites.push(from + octaves * 12);
  const mark = (midi: number) => marks.find((m) => m.midi === midi);
  const cursor = onPick ? { cursor: 'pointer' } : undefined;

  return (
    <svg viewBox={`0 0 ${whites.length * KW + 2} ${KH + 4}`} role="img" aria-label={label ?? (lang === 'en' ? 'Piano keyboard' : 'คีย์เปียโน')} style={{ minWidth: whites.length * 26 }}>
      {whites.map((midi, i) => {
        const m = mark(midi);
        return (
          <g key={midi} onClick={() => onPick?.(midi)} style={cursor}>
            <rect x={i * KW + 1} y="1" width={KW - 2} height={KH} rx="4" fill={fill(m)} stroke="#9AA89E" strokeWidth="1.5" />
            <text x={i * KW + KW / 2} y={KH - 10} textAnchor="middle" style={{ fill: m ? ink(m) : '#6B7A70', fontSize: 11, fontWeight: m ? 700 : 400 }}>
              {m?.label ?? (midi % 12 === 0 ? `C${Math.floor(midi / 12) - 1}` : '')}
            </text>
          </g>
        );
      })}
      {blacks.map(({ midi, x }) => {
        const m = mark(midi);
        return (
          <g key={midi} onClick={() => onPick?.(midi)} style={cursor}>
            <rect x={x} y="1" width="24" height={KH * 0.6} rx="3" fill={fill(m, true)} stroke="#0B0F0D" strokeWidth="1.5" />
            {m && (
              <text x={x + 12} y={KH * 0.6 - 8} textAnchor="middle" style={{ fill: ink(m), fontSize: 9, fontWeight: 700 }}>
                {m.label ?? SHARP_NAMES[midi % 12]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
