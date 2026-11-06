import { useState } from 'react';
import { Pills, Slider } from '../../music/Controls';
import { click, pluck } from '../../music/audio';
import { useSequencer } from '../../music/useSequencer';

// One bar as a row of cells. The time signature decides how many beats there are and how a beat is counted;
// the subdivision decides how many cells fit inside a beat. Clicking a cell toggles a note there.

type Lang = 'th' | 'en';

interface Meter {
  label: string;
  beats: number;
  subs: { value: number; text: Record<Lang, string>; count: string[] }[];
  note: Record<Lang, string>;
}

const METERS: Record<string, Meter> = {
  '4/4': {
    label: '4/4',
    beats: 4,
    subs: [
      { value: 1, text: { th: 'โน้ตตัวดำ', en: 'Quarter notes' }, count: ['1'] },
      { value: 2, text: { th: 'ตัวเขบ็ตหนึ่งชั้น (8th)', en: 'Eighth notes (8th)' }, count: ['1', '&'] },
      { value: 4, text: { th: 'ตัวเขบ็ตสองชั้น (16th)', en: 'Sixteenth notes (16th)' }, count: ['1', 'e', '&', 'a'] },
      { value: 3, text: { th: 'ไทรเพล็ต', en: 'Triplets' }, count: ['1', 'la', 'li'] },
    ],
    note: {
      th: 'สี่จังหวะต่อห้อง นับ 1 2 3 4 จังหวะแรกหนักที่สุด จังหวะสามหนักรองลงมา',
      en: 'Four beats per bar. Count 1 2 3 4. Beat one is the strongest, beat three is the next strongest.',
    },
  },
  '3/4': {
    label: '3/4',
    beats: 3,
    subs: [
      { value: 1, text: { th: 'โน้ตตัวดำ', en: 'Quarter notes' }, count: ['1'] },
      { value: 2, text: { th: 'ตัวเขบ็ตหนึ่งชั้น (8th)', en: 'Eighth notes (8th)' }, count: ['1', '&'] },
    ],
    note: {
      th: 'สามจังหวะต่อห้อง หนัก เบา เบา เหมือนวอลทซ์',
      en: 'Three beats per bar: strong, weak, weak, like a waltz.',
    },
  },
  '6/8': {
    label: '6/8',
    beats: 2,
    subs: [{ value: 3, text: { th: 'ตัวเขบ็ตหนึ่งชั้นสามตัวต่อจังหวะ', en: 'Three eighth notes per beat' }, count: ['1', 'la', 'li'] }],
    note: {
      th: 'หกตัวเขบ็ตต่อห้อง แต่หูได้ยินสองจังหวะ จังหวะละสามตัว (นับ 1 la li 2 la li) จึงเป็นสองจังหวะแบบสามส่วน ต่างจาก 3/4 ที่เป็นสามจังหวะแบบสองส่วน',
      en: 'Six eighth notes per bar, but the ear hears two beats of three notes each (count 1 la li 2 la li). So it is two beats divided in three, unlike 3/4, which is three beats divided in two.',
    },
  },
};

const PRESETS: Record<string, { name: Record<Lang, string>; steps: (meter: string, sub: number) => boolean[] }> = {
  all: { name: { th: 'ทุกช่อง', en: 'Every cell' }, steps: (m, s) => Array.from({ length: METERS[m].beats * s }, () => true) },
  beats: { name: { th: 'เฉพาะจังหวะลง', en: 'Downbeats only' }, steps: (m, s) => Array.from({ length: METERS[m].beats * s }, (_, i) => i % s === 0) },
  off: { name: { th: 'เฉพาะจังหวะยก (off-beat)', en: 'Off-beats only' }, steps: (m, s) => Array.from({ length: METERS[m].beats * s }, (_, i) => s > 1 && i % s === Math.floor(s / 2)) },
  sync: { name: { th: 'ซิงโคเพชัน', en: 'Syncopation' }, steps: (m, s) => Array.from({ length: METERS[m].beats * s }, (_, i) => (s === 2 ? [0, 3, 6].includes(i) : s === 4 ? [0, 3, 6, 10, 13].includes(i) : i % s === 0 || i % s === s - 1)) },
};

const TEXT: Record<Lang, {
  title: string; meter: string; subdivide: string; presets: string; cellAria: (n: number, count: string) => string;
  speed: string; perBeat: string; stop: string; play: string;
}> = {
  th: {
    title: 'ห้องเพลงหนึ่งห้อง: กดช่องเพื่อวางโน้ต',
    meter: 'ประเภท',
    subdivide: 'แบ่งจังหวะ',
    presets: 'รูปแบบสำเร็จรูป',
    cellAria: (n, count) => `ช่องที่ ${n} นับ ${count}`,
    speed: 'ความเร็ว',
    perBeat: ' (ต่อจังหวะ 3 ส่วน)',
    stop: 'หยุด',
    play: 'เล่นวนซ้ำ',
  },
  en: {
    title: 'One bar of music: click a cell to place a note',
    meter: 'Time signature',
    subdivide: 'Subdivision',
    presets: 'Ready-made patterns',
    cellAria: (n, count) => `Cell ${n}, count ${count}`,
    speed: 'Speed',
    perBeat: ' (per beat of 3 parts)',
    stop: 'Stop',
    play: 'Play on repeat',
  },
};

export default function RhythmLab({ lang = 'th' }: { lang?: Lang }) {
  const t = TEXT[lang];
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
      <div className="viz-title">{t.title}</div>
      <Pills label={t.meter} value={meter} onChange={(v) => set(v, sub)} options={Object.keys(METERS).map((k) => ({ value: k, text: k }))} />
      <Pills label={t.subdivide} value={subSpec.value} onChange={(v) => set(meter, v)} options={m.subs.map((s) => ({ value: s.value, text: s.text[lang] }))} />
      <div className="viz-steps" role="group" aria-label={t.presets}>
        {Object.entries(PRESETS).map(([k, p]) => (
          <button key={k} type="button" aria-pressed={false} onClick={() => setCells(p.steps(meter, subSpec.value))}>{p.name[lang]}</button>
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
              aria-label={t.cellAria(i + 1, String(onBeat ? Math.floor(i / subSpec.value) + 1 : subSpec.count[i % subSpec.value]))}
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
      <Slider label={t.speed} value={bpm} min={40} max={160} unit={meter === '6/8' ? t.perBeat : ' bpm'} onChange={setBpm} />
      <div className="viz-controls">
        <button type="button" className="btn primary sm" onClick={seq.toggle}>{seq.playing ? t.stop : t.play}</button>
        <span className="gx-detail">{m.note[lang]}</span>
      </div>
    </figure>
  );
}
