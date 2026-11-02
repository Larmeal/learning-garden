import { useState } from 'react';
import { Pills, Slider, rootOptions } from '../../music/Controls';
import { chord, click } from '../../music/audio';
import { useSequencer } from '../../music/useSequencer';
import { SCALES, build, chordName, diatonicChord, mod12, nameOf, parseNote, pcOf, roman } from '../../../lib/music';

// A progression is a list of scale degrees. Pick a key and a progression, choose triads or seventh chords, and hear it.
// The chord names are worked out from the key (the same stacking of thirds as the lesson), not looked up.

const PRESETS: { name: string; degrees: number[]; note: string }[] = [
  { name: 'I–V–vi–IV', degrees: [0, 4, 5, 3], note: 'ชุดที่ใช้มากที่สุดในเพลงป๊อป' },
  { name: 'vi–IV–I–V', degrees: [5, 3, 0, 4], note: 'ชุดเดียวกันแต่เริ่มที่ vi ทำให้อารมณ์เศร้ากว่า' },
  { name: 'I–vi–IV–V', degrees: [0, 5, 3, 4], note: 'แบบ 50s ที่ได้ยินในเพลงรุ่นเก่า' },
  { name: 'ii–V–I', degrees: [1, 4, 0], note: 'การเดินคอร์ดพื้นฐานของแจ๊ส ลองเปลี่ยนเป็นคอร์ด 7' },
  { name: 'I–IV–V–IV', degrees: [0, 3, 4, 3], note: 'โครงของร็อกแอนด์โรลและบลูส์ยุคแรก' },
  { name: 'I–IV–I–V', degrees: [0, 3, 0, 4], note: 'ฟังจบแล้วอยากวนต่อ เพราะจบที่ V' },
];

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

export default function ProgressionLab() {
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
      <div className="viz-title">เดินคอร์ดในคีย์ที่เลือก</div>
      <Pills label="คีย์" value={key} onChange={setKey} options={rootOptions} />
      <Pills<number> label="ชุดคอร์ด" value={pi} onChange={setPi} options={PRESETS.map((p, i) => ({ value: i, text: p.name }))} />
      <Pills<3 | 4> label="ชนิด" value={size} onChange={setSize} options={[{ value: 3, text: 'ไตรแอด' }, { value: 4, text: 'คอร์ด 7' }]} />
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
      <Slider label="ความเร็ว" value={bpm} min={50} max={150} unit=" bpm" onChange={setBpm} />
      <div className="viz-controls">
        <button type="button" className="btn primary sm" onClick={seq.toggle}>{seq.playing ? 'หยุด' : 'เล่นวนซ้ำ'}</button>
        <span className="gx-detail">คอร์ดละ 2 จังหวะ · {PRESETS[pi].note}</span>
      </div>
      <p className="viz-caption">เปลี่ยนคีย์แล้วดู: ตัวเลขโรมันไม่เปลี่ยน ชื่อคอร์ดเปลี่ยน และเสียงสัมพันธ์ระหว่างคอร์ดก็เหมือนเดิม นี่คือเหตุผลที่นักดนตรีคุยกันด้วยตัวเลข</p>
    </figure>
  );
}
