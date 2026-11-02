import { useState } from 'react';
import { ChordDiagram } from '../../music/ChordDiagram';
import { Pills, Slider } from '../../music/Controls';
import { chord, click } from '../../music/audio';
import { useSequencer } from '../../music/useSequencer';
import { midiOfShape } from '../../../lib/music';

// Eight eighth-note steps in one bar of 4/4 ("1 & 2 & 3 & 4 &"). Each step is a down-stroke, an up-stroke or a rest.
// The right hand keeps moving down on the beats and up on the "&" whether or not it touches the strings.

type Stroke = 'D' | 'U' | '-';

const CHORDS: Record<string, { frets: number[]; fingers: number[] }> = {
  Am: { frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
  C: { frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
  G: { frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
  D: { frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
  Em: { frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
};

const PRESETS: { name: string; steps: Stroke[]; hint: string }[] = [
  { name: 'ลงทุกจังหวะ', steps: ['D', '-', 'D', '-', 'D', '-', 'D', '-'], hint: 'ง่ายที่สุด ใช้เทียบความนิ่งของมือขวา' },
  { name: 'ป๊อปพื้นฐาน', steps: ['D', '-', 'D', 'U', '-', 'U', 'D', 'U'], hint: 'ลง - ลงขึ้น - ขึ้นลงขึ้น รูปที่ได้ยินในเพลงป๊อปส่วนใหญ่' },
  { name: 'ลงขึ้นต่อเนื่อง', steps: ['D', 'U', 'D', 'U', 'D', 'U', 'D', 'U'], hint: 'มือเล่นทุกครั้ง ฝึกให้เสียงทุกจังหวะเท่ากัน' },
  { name: 'ตีจังหวะหลัง', steps: ['-', 'U', '-', 'U', '-', 'U', '-', 'U'], hint: 'เน้น "&" แบบเร็กเก้ ให้เมโทรนอมเป็นคนบอกจังหวะลง' },
];

const COUNT = ['1', '&', '2', '&', '3', '&', '4', '&'];
const NEXT: Record<Stroke, Stroke> = { D: 'U', U: '-', '-': 'D' };
const GLYPH: Record<Stroke, string> = { D: '↓', U: '↑', '-': '·' };

export default function StrumLab() {
  const [name, setName] = useState('Am');
  const [steps, setSteps] = useState<Stroke[]>(PRESETS[1].steps);
  const [bpm, setBpm] = useState(80);
  const [metro, setMetro] = useState(true);

  const shape = CHORDS[name];
  const midis = midiOfShape(shape.frets);

  const seq = useSequencer({
    steps: 8,
    bpm,
    subdivision: 2,
    onStep: (i, when) => {
      if (metro && i % 2 === 0) click(when, i === 0);
      const s = steps[i];
      if (s !== '-') chord(midis, { when, spread: 0.016, dir: s === 'D' ? 'down' : 'up', dur: 1, gain: s === 'D' ? 0.15 : 0.1 });
    },
  });

  const preset = PRESETS.find((p) => p.steps.join('') === steps.join(''));

  return (
    <figure className="viz">
      <div className="viz-title">สร้างรูปแบบสตรัมแล้วฟัง</div>
      <Pills label="คอร์ด" value={name} onChange={setName} options={Object.keys(CHORDS).map((c) => ({ value: c, text: c }))} />
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '0 0 120px' }}>
          <ChordDiagram name={name} frets={shape.frets} fingers={shape.fingers} />
        </div>
        <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="viz-steps" role="group" aria-label="รูปแบบสำเร็จรูป">
            {PRESETS.map((p) => (
              <button key={p.name} type="button" aria-pressed={p.name === preset?.name} onClick={() => setSteps(p.steps)}>{p.name}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gap: 6, maxWidth: 520 }}>
            {steps.map((s, i) => (
              <button
                key={i}
                type="button"
                aria-label={`จังหวะ ${COUNT[i]} ตอนนี้ ${s === 'D' ? 'ลง' : s === 'U' ? 'ขึ้น' : 'พัก'} กดเพื่อเปลี่ยน`}
                onClick={() => setSteps((a) => a.map((x, k) => (k === i ? NEXT[x] : x)))}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  textAlign: 'center',
                  padding: '8px 0',
                  borderRadius: 12,
                  border: `2px solid ${seq.current === i ? 'var(--sun)' : s === '-' ? 'var(--line)' : 'var(--accent)'}`,
                  background: seq.current === i ? 'var(--sun)' : s === '-' ? 'var(--surface)' : 'var(--accent-soft)',
                  color: seq.current === i ? '#2A1F00' : 'var(--fg)',
                  fontSize: 22,
                  fontWeight: 700,
                  lineHeight: 1.1,
                }}
              >
                {GLYPH[s]}
                <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: seq.current === i ? '#2A1F00' : 'var(--muted)' }}>{COUNT[i]}</span>
              </button>
            ))}
          </div>
          <span className="gx-detail">{preset ? preset.hint : 'รูปแบบของคุณเอง: กดช่องเพื่อสลับ ลง ↓ / ขึ้น ↑ / พัก ·'}</span>
          <Slider label="ความเร็ว" value={bpm} min={50} max={160} unit=" bpm" onChange={setBpm} />
          <div className="viz-controls">
            <button type="button" className="btn primary sm" onClick={seq.toggle}>{seq.playing ? 'หยุด' : 'เล่น'}</button>
            <label className="gx-detail" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={metro} onChange={(e) => setMetro(e.target.checked)} style={{ accentColor: 'var(--accent)' }} /> เสียงเมโทรนอม
            </label>
          </div>
        </div>
      </div>
      <p className="viz-caption">ลองเลือก "ป๊อปพื้นฐาน" แล้วเปลี่ยนคอร์ดระหว่างเล่น สังเกตว่าช่องที่เป็น · (พัก) ยังต้องมีมือขวาแกว่งผ่าน แค่ไม่แตะสาย</p>
    </figure>
  );
}
