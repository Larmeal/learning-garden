import { useState } from 'react';
import { Pills, Slider, rootOptions } from '../../music/Controls';
import { chord, click } from '../../music/audio';
import { useSequencer } from '../../music/useSequencer';
import { SCALES, build, chordName, diatonicChord, mod12, nameOf, parseNote, pcOf, roman } from '../../../lib/music';

// A progression is a list of scale degrees. Pick a key and a progression, choose triads or seventh chords, and hear it.
// The chord names are worked out from the key (the same stacking of thirds as the lesson), not looked up.

type Lang = 'th' | 'en';

const PRESETS: { name: string; degrees: number[]; note: Record<Lang, string> }[] = [
  { name: 'I–V–vi–IV', degrees: [0, 4, 5, 3], note: { th: 'ชุดที่ใช้มากที่สุดในเพลงป๊อป', en: 'The most used progression in pop songs' } },
  { name: 'vi–IV–I–V', degrees: [5, 3, 0, 4], note: { th: 'ชุดเดียวกันแต่เริ่มที่ vi ทำให้อารมณ์เศร้ากว่า', en: 'The same chords, but starting on vi makes the mood sadder' } },
  { name: 'I–vi–IV–V', degrees: [0, 5, 3, 4], note: { th: 'แบบ 50s ที่ได้ยินในเพลงรุ่นเก่า', en: 'The 50s style heard in old songs' } },
  { name: 'ii–V–I', degrees: [1, 4, 0], note: { th: 'การเดินคอร์ดพื้นฐานของแจ๊ส ลองเปลี่ยนเป็นคอร์ด 7', en: 'The basic jazz progression. Try switching to seventh chords' } },
  { name: 'I–IV–V–IV', degrees: [0, 3, 4, 3], note: { th: 'โครงของร็อกแอนด์โรลและบลูส์ยุคแรก', en: 'The basic pattern of rock and roll and early blues' } },
  { name: 'I–IV–I–V', degrees: [0, 3, 0, 4], note: { th: 'ฟังจบแล้วอยากวนต่อ เพราะจบที่ V', en: 'It makes you want to loop, because it ends on V' } },
];

const TEXT: Record<Lang, {
  title: string; key: string; set: string; kind: string; triad: string; seventh: string; speed: string; stop: string; play: string;
  perChord: string; caption: string;
}> = {
  th: {
    title: 'เดินคอร์ดในคีย์ที่เลือก',
    key: 'คีย์',
    set: 'ชุดคอร์ด',
    kind: 'ชนิด',
    triad: 'ไตรแอด',
    seventh: 'คอร์ด 7',
    speed: 'ความเร็ว',
    stop: 'หยุด',
    play: 'เล่นวนซ้ำ',
    perChord: 'คอร์ดละ 2 จังหวะ',
    caption: 'เปลี่ยนคีย์แล้วดู: ตัวเลขโรมันไม่เปลี่ยน ชื่อคอร์ดเปลี่ยน และเสียงสัมพันธ์ระหว่างคอร์ดก็เหมือนเดิม นี่คือเหตุผลที่นักดนตรีคุยกันด้วยตัวเลข',
  },
  en: {
    title: 'Play a chord progression in the chosen key',
    key: 'Key',
    set: 'Progression',
    kind: 'Type',
    triad: 'Triads',
    seventh: '7th chords',
    speed: 'Speed',
    stop: 'Stop',
    play: 'Play on repeat',
    perChord: '2 beats per chord',
    caption: 'Change the key and watch: the Roman numerals stay the same, the chord names change, and the relationship between the chords sounds the same. This is why musicians talk in numbers.',
  },
};

// Close position above the bass, each note the nearest pitch above the previous one, starting near middle C.
function voice(notes: ReturnType<typeof build>): number[] {
  const bass = 36 + mod12(pcOf(notes[0]) - 36);
  const upper: number[] = [];
  let prev = 55 + mod12(pcOf(notes[0]) - 55);
  notes.forEach((n, i) => {
    if (i === 0) { upper.push(prev); return; }
    prev = prev + 1 + mod12(pcOf(n) - prev - 1);
    upper.push(prev);
  });
  return [bass, ...upper];
}

export default function ProgressionLab({ lang = 'th' }: { lang?: Lang }) {
  const t = TEXT[lang];
  const [key, setKey] = useState('C');
  const [pi, setPi] = useState(0);
  const [size, setSize] = useState<3 | 4>(3);
  const [bpm, setBpm] = useState(90);

  const scale = build(parseNote(key), SCALES.major.pattern);
  const chords = PRESETS[pi].degrees.map((d) => {
    const c = diatonicChord(scale, d, size);
    return { d, ...c, label: chordName(c.root, c.quality), rn: roman(d, c.quality), midis: voice(c.notes) };
  });

  const seq = useSequencer({
    steps: chords.length,
    bpm,
    subdivision: 0.5, // one chord per two beats
    onStep: (i, when) => {
      click(when, true, 0.12);
      click(when + 60 / bpm, false, 0.12);
      chord(chords[i].midis, { when, spread: 0.02, dur: 1.9, gain: 0.13 });
    },
  });

  return (
    <figure className="viz">
      <div className="viz-title">{t.title}</div>
      <Pills label={t.key} value={key} onChange={setKey} options={rootOptions} />
      <Pills<number> label={t.set} value={pi} onChange={setPi} options={PRESETS.map((p, i) => ({ value: i, text: p.name }))} />
      <Pills<3 | 4> label={t.kind} value={size} onChange={setSize} options={[{ value: 3, text: t.triad }, { value: 4, text: t.seventh }]} />
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${chords.length}, minmax(0, 1fr))`, gap: 8, maxWidth: 640 }}>
        {chords.map((c, i) => (
          <div
            key={i}
            style={{
              padding: '12px 6px',
              textAlign: 'center',
              borderRadius: 14,
              border: `2px solid ${seq.current === i ? 'var(--sun)' : 'var(--line)'}`,
              background: seq.current === i ? 'var(--sun)' : 'var(--surface)',
              color: seq.current === i ? '#2A1F00' : 'var(--fg)',
            }}
          >
            <div style={{ fontFamily: 'var(--display)', fontSize: 24, fontWeight: 700 }}>{c.label}</div>
            <div style={{ fontSize: 14, color: seq.current === i ? '#2A1F00' : 'var(--muted)' }}>{c.rn}</div>
            <div style={{ fontSize: 12, color: seq.current === i ? '#2A1F00' : 'var(--muted)' }}>{c.notes.map(nameOf).join(' ')}</div>
          </div>
        ))}
      </div>
      <Slider label={t.speed} value={bpm} min={50} max={150} unit=" bpm" onChange={setBpm} />
      <div className="viz-controls">
        <button type="button" className="btn primary sm" onClick={seq.toggle}>{seq.playing ? t.stop : t.play}</button>
        <span className="gx-detail">{t.perChord} · {PRESETS[pi].note[lang]}</span>
      </div>
      <p className="viz-caption">{t.caption}</p>
    </figure>
  );
}
