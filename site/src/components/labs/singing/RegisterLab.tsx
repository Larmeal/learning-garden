import { useEffect, useMemo, useRef, useState } from 'react';
import { Pills, Slider } from '../../music/Controls';
import { Coronal } from './folds';
import { formantsOf, midiToHz, noteName, pulseAt, pulseHarmonics, pulseShape, renderVoice, type PulseShape } from '../../../lib/voice';
import { playVoice, stopVoice } from './voiceAudio';

// Registers along the pitch axis for each voice type, and the ranges of the four choral voice parts.
// Numbers: Davids and LaTour, chapter 8, Tables 8.1 and 8.2 (register transitions) and chapter 9, Table 9.1 (ranges).
// Each transition is an area (from a note to a note), not a single note, and varies from singer to singer.

interface VoiceType {
  key: string;
  text: string;
  sex: 'male' | 'female';
  t1: [number, number];
  t2: [number, number];
}
// midi numbers: C4 = 60
const TYPES: VoiceType[] = [
  { key: 'soprano', text: 'Soprano', sex: 'female', t1: [62, 63], t2: [76, 78] },
  { key: 'mezzo', text: 'Mezzo-soprano', sex: 'female', t1: [60, 61], t2: [73, 75] },
  { key: 'alto', text: 'Contralto', sex: 'female', t1: [58, 59], t2: [72, 74] },
  { key: 'tenor', text: 'Tenor', sex: 'male', t1: [60, 62], t2: [65, 67] },
  { key: 'baritone', text: 'Baritone', sex: 'male', t1: [58, 59], t2: [62, 63] },
  { key: 'bass', text: 'Bass', sex: 'male', t1: [56, 57], t2: [60, 61] },
];

// comfortable, maximum for an average choir singer, maximum for a trained professional (Table 9.1)
const RANGES: { key: string; text: string; comfy: [number, number]; amateur: [number, number]; pro: [number, number] }[] = [
  { key: 'S', text: 'Soprano', comfy: [62, 79], amateur: [57, 83], pro: [55, 86] },
  { key: 'A', text: 'Alto', comfy: [57, 72], amateur: [55, 77], pro: [52, 81] },
  { key: 'T', text: 'Tenor', comfy: [52, 66], amateur: [48, 69], pro: [48, 72] },
  { key: 'B', text: 'Bass', comfy: [45, 62], amateur: [41, 65], pro: [40, 65] },
];

const LO = 36;
const HI = 90;
const W = 560;
const x = (m: number) => 16 + ((m - LO) / (HI - LO)) * (W - 32);

export default function RegisterLab({ view = 'registers', lang = 'th' }: { view?: 'registers' | 'ranges'; lang?: 'th' | 'en' }) {
  const L = (th: string, en: string) => (lang === 'en' ? en : th);
  const [typeKey, setTypeKey] = useState('tenor');
  const [midi, setMidi] = useState(57);
  const [belt, setBelt] = useState(false);
  const [playing, setPlaying] = useState(false);
  const vt = TYPES.find((t) => t.key === typeKey)!;

  // which register this pitch falls in for this voice type (the transition areas are shared out half and half)
  const zone = midi < vt.t1[0] ? 'chest' : midi <= vt.t1[1] ? 'passaggio1' : midi < vt.t2[0] ? 'mix' : midi <= vt.t2[1] ? 'passaggio2' : 'head';
  const register = belt ? 0 : zone === 'chest' ? 0 : zone === 'passaggio1' ? 0.25 : zone === 'mix' ? 0.5 : zone === 'passaggio2' ? 0.8 : 1;
  const level = belt ? 6.5 : zone === 'chest' ? 4.5 : zone === 'head' ? 3.5 : 4;
  const label = { chest: L('Chest (TA เด่น)', 'Chest (TA dominant)'), passaggio1: L('ช่วงเปลี่ยนแรก (passaggio)', 'First transition (passaggio)'), mix: L('Mix (TA และ CT ผสม)', 'Mix (TA and CT blended)'), passaggio2: L('ช่วงเปลี่ยนที่สอง (passaggio)', 'Second transition (passaggio)'), head: L('Head (CT เด่น)', 'Head (CT dominant)') }[zone];

  // the pictures run in slow motion: `speed` is how many cycles of the folds are drawn per second
  const [phase, setPhase] = useState(0.3);
  const [speed, setSpeed] = useState(0.5);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let last = performance.now();
    let ph = 0.3;
    const loop = (now: number) => {
      ph = (ph + ((now - last) / 1000) * speedRef.current) % 1;
      last = now;
      setPhase(ph);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // which of the four cards describes the sound at this note
  const activeCard = belt ? 'belt' : zone === 'chest' ? 'chest' : zone === 'head' ? 'head' : 'mix';
  const pick = (k: string) => {
    setBelt(k === 'belt');
    const [a1, a2] = vt.t1;
    const [b1, b2] = vt.t2;
    setMidi(k === 'chest' ? Math.max(43, a1 - 3) : k === 'head' ? Math.min(84, b2 + 3) : k === 'mix' ? Math.round((a2 + b1) / 2) : Math.min(72, a2 + 5));
  };

  useEffect(() => {
    if (!playing) {
      stopVoice();
      return;
    }
    const id = setTimeout(() => {
      const f = formantsOf('ɑ', vt.sex);
      playVoice(renderVoice({ seconds: 1.2, f0: midiToHz(midi), formants: f, closure: level, register, rms: 0.1, loop: true }), { loop: true });
    }, 100);
    return () => clearTimeout(id);
  }, [playing, midi, level, register, vt.sex]);
  useEffect(() => () => stopVoice(), []);

  const rangeKey = { soprano: 'S', alto: 'A', tenor: 'T', bass: 'B' }[typeKey] ?? '';
  const ticks = [36, 48, 60, 72, 84];

  return (
    <figure className="viz">
      <div className="viz-title">{view === 'registers' ? L('Register ตามโน้ต และการเปลี่ยนผ่าน', 'Register by note, and the transitions') : L('ช่วงเสียงของแต่ละประเภท', 'The range of each voice type')}</div>
      {view === 'registers' ? (
        <>
          <Pills<string> label={L('ประเภทเสียง', 'Voice type')} value={typeKey} onChange={setTypeKey} options={TYPES.map((t) => ({ value: t.key, text: t.text }))} />
          <div className="viz-box" style={{ overflowX: 'visible' }}>
            <svg viewBox={`0 0 ${W} 110`} role="img" aria-label={L('แถบ register ตามระดับเสียงของประเภทเสียงที่เลือก', 'A bar of the registers by pitch for the chosen voice type')} style={{ width: '100%', minWidth: 0 }}>
              <rect x={x(LO)} y="30" width={x(vt.t1[0]) - x(LO)} height="26" fill="color-mix(in srgb, var(--accent) 55%, var(--surface))" />
              <rect x={x(vt.t1[0])} y="30" width={x(vt.t1[1] + 1) - x(vt.t1[0])} height="26" fill="var(--sun)" />
              <rect x={x(vt.t1[1] + 1)} y="30" width={x(vt.t2[0]) - x(vt.t1[1] + 1)} height="26" fill="color-mix(in srgb, var(--accent) 30%, var(--surface))" />
              <rect x={x(vt.t2[0])} y="30" width={x(vt.t2[1] + 1) - x(vt.t2[0])} height="26" fill="var(--sun)" />
              <rect x={x(vt.t2[1] + 1)} y="30" width={x(HI) - x(vt.t2[1] + 1)} height="26" fill="color-mix(in srgb, var(--k1) 30%, var(--surface))" />
              <text className="s" x={(x(LO) + x(vt.t1[0])) / 2} y="47" textAnchor="middle" style={{ fill: 'var(--fg)' }}>Chest</text>
              <text className="s" x={(x(vt.t1[1] + 1) + x(vt.t2[0])) / 2} y="47" textAnchor="middle" style={{ fill: 'var(--fg)' }}>Mix</text>
              <text className="s" x={(x(vt.t2[1] + 1) + x(HI)) / 2} y="47" textAnchor="middle" style={{ fill: 'var(--fg)' }}>Head</text>
              <text className="s" x={(x(vt.t1[0]) + x(vt.t1[1] + 1)) / 2} y="22" textAnchor="middle">{noteName(vt.t1[0])} {L('ถึง', 'to')} {noteName(vt.t1[1])}</text>
              <text className="s" x={(x(vt.t2[0]) + x(vt.t2[1] + 1)) / 2} y="22" textAnchor="middle">{noteName(vt.t2[0])} {L('ถึง', 'to')} {noteName(vt.t2[1])}</text>
              {ticks.map((m) => (
                <g key={m}>
                  <line x1={x(m)} x2={x(m)} y1="58" y2="64" stroke="var(--muted)" />
                  <text className="s" x={x(m)} y="76" textAnchor="middle">{noteName(m)}</text>
                </g>
              ))}
              <path d={`M${x(midi)},58 l-7,-14 l14,0 z`} fill="var(--fg)" />
              <line x1={x(midi)} x2={x(midi)} y1="58" y2="66" stroke="var(--fg)" strokeWidth="2" />
              <text className="b" x={x(midi)} y="94" textAnchor="middle">{noteName(midi)}</text>
              <text className="s" x={W - 6} y="106" textAnchor="end">{L('ช่วงเหลืองคือพื้นที่เปลี่ยน (ต่างกันเล็กน้อยในแต่ละคน)', 'The yellow parts are the transition areas (they differ a little from person to person)')}</text>
            </svg>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', marginTop: 8 }}>
            <button type="button" className="btn sm primary" onClick={() => setPlaying((p) => !p)}>{playing ? L('หยุดเสียง', 'Stop the sound') : L(`ฟังโน้ต ${noteName(midi)} (สังเคราะห์)`, `Hear the note ${noteName(midi)} (synthesized)`)}</button>
            <button type="button" className="btn sm" aria-pressed={belt} onClick={() => setBelt((b) => !b)}>{belt ? L('กลับไปใช้ register ตามโน้ต', 'Go back to the register by note') : L('ลองแบก chest ขึ้นสูง', 'Try carrying chest up high')}</button>
          </div>
          <Pills<number> label={L('ความเร็วภาพ', 'Picture speed')} value={speed} onChange={setSpeed} options={[{ value: 0, text: L('หยุด', 'Stop') }, { value: 0.2, text: L('ช้ามาก', 'Very slow') }, { value: 0.5, text: L('ช้า', 'Slow') }, { value: 1, text: L('เร็วขึ้น', 'Faster') }]} />
          <div className="viz-now" style={{ marginTop: 8 }} aria-live="polite">
            <strong>{noteName(midi)}: {belt ? L('ร้องด้วยเสียง chest ขึ้นมาสูง (raw chest belt)', 'Singing chest voice up high (raw chest belt)') : label}</strong>
            <span style={{ display: 'block' }}>
              {belt
                ? L('เส้นเสียงหนาและปิดแน่นต่อไปแม้โน้ตสูงขึ้น แรงดันลมต้องสูงมาก (ใน chest belt สูงกว่าการร้องแบบคลาสสิกราว 50% ตามงานวิจัยที่หนังสือรายงาน) ถึงช่วงหนึ่งเสียงจะแตกหรือฝืนมาก', 'The vocal folds stay thick and firmly closed even as the note rises, and the air pressure has to be very high (in chest belt about 50% higher than in classical singing, according to the research the book reports). At some point the voice breaks or becomes very strained.')
                : zone === 'chest'
                  ? L('เส้นเสียงหนา สัมผัสกันเป็นบริเวณกว้าง harmonic ที่สองเด่น เสียงดังและอุ่น', 'The vocal folds are thick and touch over a wide area, the second harmonic is strong, and the sound is loud and warm.')
                  : zone === 'head'
                    ? L('เส้นเสียงบางและยืด สัมผัสกันน้อยลง harmonic แรกเด่น เสียงเบากว่าแต่ขึ้นสูงได้', 'The vocal folds are thin and stretched and touch less, the first harmonic is strong, and the sound is softer but can go high.')
                    : zone === 'mix'
                      ? L('ผสม TA กับ CT ได้เสียงที่ซับซ้อนกว่า head แต่ไม่หนักเท่า chest ผู้หญิงมีช่วง mix กว้างกว่าผู้ชายมาก', 'Blending the TA and CT gives a sound more complex than head but not as heavy as chest. Women have a much wider mix range than men.')
                      : L('นี่คือบริเวณที่เสียงมักเปลี่ยนสีหรือแตก ลดแรงดันลมและความแน่นของการปิดลงเล็กน้อยแล้วปรับสระ จะผ่านได้ง่ายขึ้น', 'This is the area where the voice often changes color or breaks. Reduce the air pressure and the firmness of closure a little and adjust the vowel, and it gets easier to pass through.')}
            </span>
          </div>
          <p className="viz-caption" style={{ margin: '10px 0 6px' }}>
            {L('สี่ช่องข้างล่างใช้จังหวะเดียวกัน (ภาพนี้ช้ากว่าของจริงหลายร้อยเท่า) ดูที่แถวบนก่อน เส้นเสียงของ chest แตะกันนานและแน่น ส่วนของ head แตะกันแค่ชั่วครู่ แล้วดูแถวล่างว่าความต่างนั้นทำให้ harmonic ต่างกันอย่างไร', 'The four boxes below run on the same clock (this picture is hundreds of times slower than real life). Look at the top row first: the vocal folds of chest touch for a long time and firmly, while those of head touch only briefly. Then look at the bottom row to see how that difference makes the harmonics differ.')}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
            {CARDS.map((c) => (
              <RegisterCard key={c.key} card={c} phase={phase} on={c.key === activeCard} onPick={() => pick(c.key)} lang={lang} />
            ))}
          </div>
          <Slider label={`${L('โน้ต', 'Note')} ${noteName(midi)}`} value={midi} min={43} max={84} onChange={setMidi} />
          <p className="viz-caption">{L('ช่วงเปลี่ยนมาจากตาราง 8.1 และ 8.2 ของ Davids และ LaTour ซึ่งเป็นค่าโดยประมาณ ตาราง 8.2 ของผู้หญิงมาจากประสบการณ์ของผู้เขียน ผู้เขียนบอกเองว่างานอื่นรายงานความต่างระหว่างประเภทเสียงของผู้หญิงที่น้อยกว่านี้ รูปเส้นเสียงเป็นภาพร่างและเสียงเป็นเสียงสังเคราะห์ที่แสดงแนวโน้ม ไม่ใช่การวัด', 'The transition areas come from Tables 8.1 and 8.2 of Davids and LaTour and are approximate. The table for women (8.2) comes from the authors\' own experience, and they say themselves that other work reports a smaller difference between the voice types of women. The picture of the vocal folds is a sketch and the sound is a synthesized sound that shows the trend. Neither is a measurement.')}</p>
        </>
      ) : (
        <>
          <Pills<string> label={L('ส่วนร้อง', 'Voice part')} value={rangeKey || 'S'} onChange={(k) => setTypeKey({ S: 'soprano', A: 'alto', T: 'tenor', B: 'bass' }[k]!)} options={RANGES.map((r) => ({ value: r.key, text: r.text }))} />
          <div className="viz-box" style={{ overflowX: 'visible' }}>
            {(() => {
              const r = RANGES.find((q) => q.key === (rangeKey || 'S'))!;
              const rows: [string, [number, number], string][] = [
                [L('สบายที่สุด (comfortable)', 'Most comfortable'), r.comfy, 'var(--accent)'],
                [L('กว้างสุดของคนร้องประสานเสียงทั่วไป', 'Widest for an average choir singer'), r.amateur, 'color-mix(in srgb, var(--accent) 55%, var(--surface))'],
                [L('กว้างสุดของคนที่ผ่านการฝึกมาก', 'Widest for someone who has trained a lot'), r.pro, 'color-mix(in srgb, var(--accent) 28%, var(--surface))'],
              ];
              return (
                <svg viewBox={`0 0 ${W} 150`} role="img" aria-label={L(`ช่วงเสียงของ ${r.text}`, `The range of ${r.text}`)} style={{ width: '100%', minWidth: 0 }}>
                  {rows.map(([name, [a, b], fill], i) => (
                    <g key={name}>
                      <text className="s" x={x(LO)} y={18 + i * 40}>{name}: {noteName(a)} {L('ถึง', 'to')} {noteName(b)}</text>
                      <rect x={x(a)} y={22 + i * 40} width={x(b) - x(a)} height="16" rx="5" fill={fill} />
                    </g>
                  ))}
                  {ticks.map((m) => (
                    <g key={m}>
                      <line x1={x(m)} x2={x(m)} y1="130" y2="136" stroke="var(--muted)" />
                      <text className="s" x={x(m)} y="148" textAnchor="middle">{noteName(m)}</text>
                    </g>
                  ))}
                </svg>
              );
            })()}
          </div>
          <p className="viz-caption">{L('ตัวเลขจากตาราง 9.1 ของ Davids และ LaTour (ช่วงสูงสุดของผู้ฝึกมากอ้างจาก Titze 2000) ในดนตรีร่วมสมัยไม่ค่อยแบ่งประเภทเสียงอย่างเป็นทางการ ช่วงที่ร้องได้จริงขึ้นกับสไตล์ด้วย เช่น belt ผู้หญิงขึ้นได้ถึงราว G5 เท่านั้น', 'The numbers come from Table 9.1 of Davids and LaTour (the widest range for the highly trained is cited from Titze 2000). In contemporary music voice types are seldom formally classified. The range you can really sing also depends on the style, for example a woman can belt only up to about G5.')}</p>
        </>
      )}
    </figure>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// The four cards that are drawn side by side: the folds, one cycle of the airflow through the glottis, and the harmonics that result.
// ---------------------------------------------------------------------------------------------------------------

const CARD_EN: Record<string, string> = {
  chest: 'The vocal folds are thick and short and touch for a long time',
  mix: 'Medium thickness, touching for a shorter time',
  head: 'Thin and stretched, touching only briefly',
  belt: 'Thick and very firmly closed, on a high note',
};

interface CardSpec {
  key: 'chest' | 'mix' | 'head' | 'belt';
  title: string;
  sub: string;
  register: number;
  level: number;
  thick: number;
}
const CARDS: CardSpec[] = [
  { key: 'chest', title: 'Chest', sub: 'เส้นเสียงหนาและสั้น แตะกันนาน', register: 0, level: 4.5, thick: 1 },
  { key: 'mix', title: 'Mix', sub: 'หนาปานกลาง แตะกันสั้นลง', register: 0.5, level: 4, thick: 0.55 },
  { key: 'head', title: 'Head', sub: 'บางและยืด แตะกันแค่ชั่วครู่', register: 1, level: 3.5, thick: 0.25 },
  { key: 'belt', title: 'Chest belt', sub: 'หนา ปิดแน่นมาก ที่โน้ตสูง', register: 0, level: 6.5, thick: 1 },
];

const NH = 10;
const FLOOR = -40;
const r1 = (v: number) => Math.round(v * 10) / 10;

function RegisterCard({ card, phase, on, onPick, lang = 'th' }: { card: CardSpec; phase: number; on: boolean; onPick: () => void; lang?: 'th' | 'en' }) {
  const L = (th: string, en: string) => (lang === 'en' ? en : th);
  const shape: PulseShape = useMemo(() => pulseShape(card.level, card.register), [card.level, card.register]);
  const db = useMemo(() => {
    const h = pulseHarmonics(shape, NH);
    return h.map((v) => Math.max(FLOOR, 20 * Math.log10(v / h[0])));
  }, [shape]);
  const open = pulseAt(phase, shape);
  const openTop = pulseAt((phase + 0.9) % 1, shape);
  const isClosed = open < 0.04;

  // one cycle of the flow
  const W = 220;
  const x0 = 8;
  const x1 = 212;
  const yb = 56;
  const yt = 10;
  const px = (p: number) => r1(x0 + p * (x1 - x0));
  const py = (v: number) => r1(yb - v * (yb - yt));
  const path = Array.from({ length: 61 }, (_, i) => `${i ? 'L' : 'M'}${px(i / 60)},${py(pulseAt(i / 60, shape))}`).join(' ');

  // the harmonics
  const bw = 14;
  const gap = (W - 16 - NH * bw) / (NH - 1);
  const bx = (i: number) => r1(8 + i * (bw + gap));
  const bh = (v: number) => r1(((v - FLOOR) / -FLOOR) * 56);

  return (
    <div style={{ border: `2px solid ${on ? 'var(--accent)' : 'var(--line)'}`, borderRadius: 14, padding: 10, background: on ? 'color-mix(in srgb, var(--accent) 7%, var(--surface))' : 'var(--surface)', display: 'grid', gap: 6, alignContent: 'start' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div>
          <strong>{card.title}</strong>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{lang === 'en' ? CARD_EN[card.key] : card.sub}</div>
        </div>
        <button type="button" className="btn sm" aria-pressed={on} onClick={onPick}>{on ? L('กำลังเลือก', 'Selected') : L('เลือกแบบนี้', 'Choose this one')}</button>
      </div>
      <Coronal open={open} openTop={openTop} thick={card.thick} width={230} lang={lang} />
      <div aria-hidden="true" style={{ fontSize: 12.5, textAlign: 'center', fontWeight: 600, color: isClosed ? 'var(--brand)' : 'var(--muted)' }}>
        {isClosed ? L('เส้นเสียงปิดสนิท ลมผ่านไม่ได้', 'The vocal folds are fully closed, no air passes') : L(`ช่องระหว่างเส้นเสียงเปิด ${Math.round(open * 100)}%`, `The gap between the vocal folds is ${Math.round(open * 100)}% open`)}
      </div>
      <svg viewBox={`0 0 ${W} 70`} role="img" aria-label={L(`ลมที่ผ่านเส้นเสียงในหนึ่งรอบของ ${card.title} เส้นเสียงปิดอยู่ ${Math.round((1 - shape.oq) * 100)} เปอร์เซ็นต์ของรอบ`, `The air through the vocal folds in one cycle of ${card.title}. The vocal folds are closed for ${Math.round((1 - shape.oq) * 100)} percent of the cycle`)} style={{ width: '100%', minWidth: 0 }}>
        <rect x={px(shape.oq)} y={yt - 4} width={r1(x1 - px(shape.oq))} height={yb - yt + 4} fill="color-mix(in srgb, var(--brand) 16%, transparent)" />
        <line x1={x0} x2={x1} y1={yb} y2={yb} stroke="var(--line-strong)" />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
        <line x1={px(phase)} x2={px(phase)} y1={yt - 4} y2={yb} stroke="var(--fg)" strokeWidth="1" strokeDasharray="2 3" />
        <circle cx={px(phase)} cy={py(open)} r="4.5" fill="var(--fg)" />
        <text className="s" x={x0} y="68">{L('ลมที่ผ่านเส้นเสียง ในหนึ่งรอบ', 'Air through the vocal folds in one cycle')}</text>
        <text className="s" x={x1} y="20" textAnchor="end" style={{ fill: 'var(--brand)' }}>{L('ปิด', 'closed')} {Math.round((1 - shape.oq) * 100)}%</text>
      </svg>
      <svg viewBox={`0 0 ${W} 82`} role="img" aria-label={L(`harmonic ที่ 1 ถึง ${NH} ของ ${card.title} harmonic ที่สองต่ำกว่าตัวแรก ${Math.round(-db[1])} dB`, `Harmonics 1 to ${NH} of ${card.title}. The second harmonic is ${Math.round(-db[1])} dB below the first`)} style={{ width: '100%', minWidth: 0 }}>
        <line x1="8" x2={W - 8} y1="60" y2="60" stroke="var(--line-strong)" />
        {db.map((v, i) => (
          <g key={i}>
            <rect x={bx(i)} y={r1(60 - bh(v))} width={bw} height={Math.max(1, bh(v))} rx="3" fill={i === 0 ? 'var(--k1)' : i === 1 ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 45%, var(--surface))'} />
            <text className="s" x={r1(bx(i) + bw / 2)} y="73" textAnchor="middle">{i + 1}</text>
          </g>
        ))}
        <text className="s" x={W - 8} y="12" textAnchor="end">{L('H2 ต่ำกว่า H1', 'H2 is below H1 by')} {Math.round(-db[1])} dB</text>
        <text className="s" x={W - 8} y="26" textAnchor="end">{L('H5 ต่ำกว่า H1', 'H5 is below H1 by')} {Math.round(-db[4])} dB</text>
      </svg>
    </div>
  );
}
