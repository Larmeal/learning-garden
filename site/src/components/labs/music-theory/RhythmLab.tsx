import { useState } from 'react';
import { Pills, Slider } from '../../music/Controls';
import { click, pluck } from '../../music/audio';
import { useSequencer } from '../../music/useSequencer';

// One bar as a row of cells. The time signature decides how many beats there are and how a beat is counted;
// the subdivision decides how many cells fit inside a beat. Clicking a cell toggles a note there.

interface Meter {
  label: string;
  beats: number;
  subs: { value: number; text: string; count: string[] }[];
  note: string;
}

const METERS: Record<string, Meter> = {
  '4/4': {
    label: '4/4',
    beats: 4,
    subs: [
      { value: 1, text: 'โน้ตตัวดำ', count: ['1'] },
      { value: 2, text: 'ตัวเขบ็ตหนึ่งชั้น (8th)', count: ['1', '&'] },
      { value: 4, text: 'ตัวเขบ็ตสองชั้น (16th)', count: ['1', 'e', '&', 'a'] },
      { value: 3, text: 'ไทรเพล็ต', count: ['1', 'la', 'li'] },
    ],
    note: 'สี่จังหวะต่อห้อง นับ 1 2 3 4 จังหวะแรกหนักที่สุด จังหวะสามหนักรองลงมา',
  },
  '3/4': {
    label: '3/4',
    beats: 3,
    subs: [
      { value: 1, text: 'โน้ตตัวดำ', count: ['1'] },
      { value: 2, text: 'ตัวเขบ็ตหนึ่งชั้น (8th)', count: ['1', '&'] },
    ],
    note: 'สามจังหวะต่อห้อง หนัก เบา เบา เหมือนวอลทซ์',
  },
  '6/8': {
    label: '6/8',
    beats: 2,
    subs: [{ value: 3, text: 'ตัวเขบ็ตหนึ่งชั้นสามตัวต่อจังหวะ', count: ['1', 'la', 'li'] }],
    note: 'หกตัวเขบ็ตต่อห้อง แต่หูได้ยินสองจังหวะ จังหวะละสามตัว (นับ 1 la li 2 la li) จึงเป็นสองจังหวะแบบสามส่วน ต่างจาก 3/4 ที่เป็นสามจังหวะแบบสองส่วน',
  },
};

const PRESETS: Record<string, { name: string; steps: (meter: string, sub: number) => boolean[] }> = {
  all: { name: 'ทุกช่อง', steps: (m, s) => Array.from({ length: METERS[m].beats * s }, () => true) },
  beats: { name: 'เฉพาะจังหวะลง', steps: (m, s) => Array.from({ length: METERS[m].beats * s }, (_, i) => i % s === 0) },
  off: { name: 'เฉพาะจังหวะยก (off-beat)', steps: (m, s) => Array.from({ length: METERS[m].beats * s }, (_, i) => s > 1 && i % s === Math.floor(s / 2)) },
  sync: { name: 'ซิงโคเพชัน', steps: (m, s) => Array.from({ length: METERS[m].beats * s }, (_, i) => (s === 2 ? [0, 3, 6].includes(i) : s === 4 ? [0, 3, 6, 10, 13].includes(i) : i % s === 0 || i % s === s - 1)) },
};

export default function RhythmLab() {
  const [meter, setMeter] = useState('4/4');
  const [sub, setSub] = useState(2);
  const [bpm, setBpm] = useState(80);
  const [cells, setCells] = useState<boolean[]>(PRESETS.beats.steps('4/4', 2));

  const m = METERS[meter];
  const subSpec = m.subs.find((s) => s.value === sub) ?? m.subs[0];
  const total = m.beats * subSpec.value;

  const set = (nextMeter: string, nextSub: number, how = 'beats') => {
    const mm = METERS[nextMeter];
    const s = mm.subs.some((x) => x.value === nextSub) ? nextSub : mm.subs[0].value;
    setMeter(nextMeter);
    setSub(s);
    setCells(PRESETS[how].steps(nextMeter, s));
  };

  const seq = useSequencer({
    steps: total,
    bpm,
    subdivision: subSpec.value,
    onStep: (i, when) => {
      if (i % subSpec.value === 0) click(when, i === 0, 0.14);
      if (cells[i]) pluck(52, when, 0.35, 0.2);
    },
  });

  return (
    <figure className="viz">
      <div className="viz-title">ห้องเพลงหนึ่งห้อง: กดช่องเพื่อวางโน้ต</div>
      <Pills label="ประเภท" value={meter} onChange={(v) => set(v, sub)} options={Object.keys(METERS).map((k) => ({ value: k, text: k }))} />
      <Pills label="แบ่งจังหวะ" value={subSpec.value} onChange={(v) => set(meter, v)} options={m.subs.map((s) => ({ value: s.value, text: s.text }))} />
      <div className="viz-steps" role="group" aria-label="รูปแบบสำเร็จรูป">
        {Object.entries(PRESETS).map(([k, p]) => (
          <button key={k} type="button" aria-pressed={false} onClick={() => setCells(p.steps(meter, subSpec.value))}>{p.name}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))`, gap: 4, maxWidth: 760 }}>
        {Array.from({ length: total }, (_, i) => {
          const onBeat = i % subSpec.value === 0;
          const active = seq.current === i;
          return (
            <button
              key={i}
              type="button"
              aria-pressed={cells[i]}
              aria-label={`ช่องที่ ${i + 1} นับ ${onBeat ? Math.floor(i / subSpec.value) + 1 : subSpec.count[i % subSpec.value]}`}
              onClick={() => setCells((c) => c.map((x, k) => (k === i ? !x : x)))}
              style={{
                all: 'unset',
                cursor: 'pointer',
                textAlign: 'center',
                padding: '10px 0 6px',
                borderRadius: 10,
                border: `2px solid ${active ? 'var(--sun)' : cells[i] ? 'var(--accent)' : 'var(--line)'}`,
                background: active ? 'var(--sun)' : cells[i] ? 'var(--accent)' : onBeat ? 'var(--surface-2)' : 'var(--surface)',
                color: active ? '#2A1F00' : cells[i] ? 'var(--on-accent)' : 'var(--muted)',
                fontWeight: onBeat ? 700 : 500,
                fontSize: 14,
                minHeight: 44,
              }}
            >
              {onBeat ? Math.floor(i / subSpec.value) + 1 : subSpec.count[i % subSpec.value]}
            </button>
          );
        })}
      </div>
      <Slider label="ความเร็ว" value={bpm} min={40} max={160} unit={meter === '6/8' ? ' (ต่อจังหวะ 3 ส่วน)' : ' bpm'} onChange={setBpm} />
      <div className="viz-controls">
        <button type="button" className="btn primary sm" onClick={seq.toggle}>{seq.playing ? 'หยุด' : 'เล่นวนซ้ำ'}</button>
        <span className="gx-detail">{m.note}</span>
      </div>
    </figure>
  );
}
