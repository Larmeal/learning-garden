import { useState } from 'react';
import { ChordDiagram } from '../../music/ChordDiagram';
import { Pills, Slider } from '../../music/Controls';
import { chord, click } from '../../music/audio';
import { useSequencer } from '../../music/useSequencer';
import { midiOfShape } from '../../../lib/music';

// Eight eighth-note steps in one bar of 4/4 ("1 & 2 & 3 & 4 &"). Each step is a down-stroke, an up-stroke or a rest.
// The right hand keeps moving down on the beats and up on the "&" whether or not it touches the strings.

type Stroke = 'D' | 'U' | '-';
type Lang = 'th' | 'en';

const CHORDS: Record<string, { frets: number[]; fingers: number[] }> = {
  Am: { frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
  C: { frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
  G: { frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
  D: { frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
  Em: { frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
};

const PRESETS: { steps: Stroke[] }[] = [
  { steps: ['D', '-', 'D', '-', 'D', '-', 'D', '-'] },
  { steps: ['D', '-', 'D', 'U', '-', 'U', 'D', 'U'] },
  { steps: ['D', 'U', 'D', 'U', 'D', 'U', 'D', 'U'] },
  { steps: ['-', 'U', '-', 'U', '-', 'U', '-', 'U'] },
];

// Same order as PRESETS.
const TEXT: Record<Lang, {
  presets: { name: string; hint: string }[];
  title: string;
  chordLabel: string;
  presetsLabel: string;
  stepLabel: (count: string, stroke: Stroke) => string;
  custom: string;
  speed: string;
  stop: string;
  play: string;
  metro: string;
  caption: string;
}> = {
  th: {
    presets: [
      { name: 'ลงทุกจังหวะ', hint: 'ง่ายที่สุด ใช้เทียบความนิ่งของมือขวา' },
      { name: 'ป๊อปพื้นฐาน', hint: 'ลง - ลงขึ้น - ขึ้นลงขึ้น รูปที่ได้ยินในเพลงป๊อปส่วนใหญ่' },
      { name: 'ลงขึ้นต่อเนื่อง', hint: 'มือเล่นทุกครั้ง ฝึกให้เสียงทุกจังหวะเท่ากัน' },
      { name: 'ตีจังหวะหลัง', hint: 'เน้น "&" แบบเร็กเก้ ให้เมโทรนอมเป็นคนบอกจังหวะลง' },
    ],
    title: 'สร้างรูปแบบสตรัมแล้วฟัง',
    chordLabel: 'คอร์ด',
    presetsLabel: 'รูปแบบสำเร็จรูป',
    stepLabel: (count, s) => `จังหวะ ${count} ตอนนี้ ${s === 'D' ? 'ลง' : s === 'U' ? 'ขึ้น' : 'พัก'} กดเพื่อเปลี่ยน`,
    custom: 'รูปแบบของคุณเอง: กดช่องเพื่อสลับ ลง ↓ / ขึ้น ↑ / พัก ·',
    speed: 'ความเร็ว',
    stop: 'หยุด',
    play: 'เล่น',
    metro: 'เสียงเมโทรนอม',
    caption: 'ลองเลือก "ป๊อปพื้นฐาน" แล้วเปลี่ยนคอร์ดระหว่างเล่น สังเกตว่าช่องที่เป็น · (พัก) ยังต้องมีมือขวาแกว่งผ่าน แค่ไม่แตะสาย',
  },
  en: {
    presets: [
      { name: 'Down on every beat', hint: 'The easiest one. Use it to check how steady your right hand is.' },
      { name: 'Basic pop', hint: 'Down - down up - up down up. The pattern you hear in most pop songs.' },
      { name: 'Constant down-up', hint: 'The hand moves every time. Practice making every stroke sound equal.' },
      { name: 'Off-beat', hint: 'Stress the "&" like reggae. Let the metronome tell you where the down-strokes are.' },
    ],
    title: 'Build a strum pattern and listen',
    chordLabel: 'Chord',
    presetsLabel: 'Ready-made patterns',
    stepLabel: (count, s) => `Beat ${count} is now ${s === 'D' ? 'down' : s === 'U' ? 'up' : 'a rest'}. Click to change.`,
    custom: 'Your own pattern: click a box to switch between down ↓ / up ↑ / rest ·',
    speed: 'Speed',
    stop: 'Stop',
    play: 'Play',
    metro: 'Metronome click',
    caption: 'Try "Basic pop" and change the chord while it plays. Notice that a box with · (rest) still needs the right hand to swing past, it just does not touch the strings.',
  },
};

const COUNT = ['1', '&', '2', '&', '3', '&', '4', '&'];
const NEXT: Record<Stroke, Stroke> = { D: 'U', U: '-', '-': 'D' };
const GLYPH: Record<Stroke, string> = { D: '↓', U: '↑', '-': '·' };

export default function StrumLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
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

  const presetIdx = PRESETS.findIndex((p) => p.steps.join('') === steps.join(''));
  const preset = presetIdx >= 0 ? T.presets[presetIdx] : undefined;

  return (
    <figure className="viz">
      <div className="viz-title">{T.title}</div>
      <Pills label={T.chordLabel} value={name} onChange={setName} options={Object.keys(CHORDS).map((c) => ({ value: c, text: c }))} />
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '0 0 120px' }}>
          <ChordDiagram name={name} frets={shape.frets} fingers={shape.fingers} lang={lang} />
        </div>
        <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="viz-steps" role="group" aria-label={T.presetsLabel}>
            {PRESETS.map((p, pi) => (
              <button key={T.presets[pi].name} type="button" aria-pressed={pi === presetIdx} onClick={() => setSteps(p.steps)}>{T.presets[pi].name}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gap: 6, maxWidth: 520 }}>
            {steps.map((s, i) => (
              <button
                key={i}
                type="button"
                aria-label={T.stepLabel(COUNT[i], s)}
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
          <span className="gx-detail">{preset ? preset.hint : T.custom}</span>
          <Slider label={T.speed} value={bpm} min={50} max={160} unit=" bpm" onChange={setBpm} />
          <div className="viz-controls">
            <button type="button" className="btn primary sm" onClick={seq.toggle}>{seq.playing ? T.stop : T.play}</button>
            <label className="gx-detail" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={metro} onChange={(e) => setMetro(e.target.checked)} style={{ accentColor: 'var(--accent)' }} /> {T.metro}
            </label>
          </div>
        </div>
      </div>
      <p className="viz-caption">{T.caption}</p>
    </figure>
  );
}
