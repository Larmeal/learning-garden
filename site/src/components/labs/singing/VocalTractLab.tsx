import { useEffect, useMemo, useRef, useState } from 'react';
import { Pills, Slider } from '../../music/Controls';
import { SagittalHead } from './art';
import { Axes, Clip, Curve, Markers, Stems, xOf } from './plots';
import { SOUND_SPEED, filterDb, harmonicLevels, midiToHz, noteName, renderVoice, type Sex } from '../../../lib/voice';
import { NEUTRAL, POSE_OF, tractFormants, tractLength, tractRing, type Pose } from '../../../lib/tract';
import { playVoice, stopVoice } from './voiceAudio';

// The side view of the head and neck next to the three steps of the source-filter picture: the SOURCE (harmonics from the vocal
// folds), the FILTER (resonances of the vocal tract, drawn from the pose) and the OUTPUT (the product). Move the tongue, jaw, lips,
// larynx and soft palate and watch the formants move; press play to hear the same settings.

const FMAX = 5000;
const FR = { x: 30, w: 416 };
const VOWEL_BUTTONS: { key: string; text: string }[] = [
  { key: 'i', text: 'อี [i]' },
  { key: 'e', text: 'เอ [e]' },
  { key: 'ɑ', text: 'อา [ɑ]' },
  { key: 'o', text: 'โอ [o]' },
  { key: 'u', text: 'อู [u]' },
];

const VOWEL_EN: Record<string, string> = { i: '[i] "need"', e: '[e] "gate"', ɑ: '[ɑ] "father"', o: '[o] "go"', u: '[u] "choose"' };
const SLIDERS_EN: Record<string, { label: string; hint: string }> = {
  jaw: { label: 'Jaw', hint: 'Opening more raises F1' },
  height: { label: 'Tongue height', hint: 'The highest point of the tongue near the palate' },
  front: { label: 'Tongue forward', hint: 'Tongue forward raises F2' },
  lip: { label: 'Lips', hint: 'Left is a wide smile, right is rounded' },
  larynx: { label: 'Larynx', hint: 'Left is low (yawn), right is high (swallow)' },
  velum: { label: 'Soft palate', hint: '0 is raised to close off the nose, 1 is lowered to let sound through the nose' },
  epi: { label: 'Narrow epilarynx', hint: 'Narrower makes a bright, ringing sound (ring) near 3 kHz' },
};

const SLIDERS: { key: keyof Pose; label: string; min: number; max: number; hint: string }[] = [
  { key: 'jaw', label: 'กราม', min: 0, max: 1, hint: 'ยิ่งเปิดมาก F1 ยิ่งสูงขึ้น' },
  { key: 'height', label: 'ลิ้นสูง', min: 0, max: 1, hint: 'จุดสูงสุดของลิ้นอยู่ใกล้เพดานปาก' },
  { key: 'front', label: 'ลิ้นไปหน้า', min: 0, max: 1, hint: 'ยิ่งลิ้นไปข้างหน้า F2 ยิ่งสูงขึ้น' },
  { key: 'lip', label: 'ริมฝีปาก', min: -1, max: 1, hint: 'ซ้ายคือยิ้มกว้าง ส่วนขวาคือจู๋ปาก' },
  { key: 'larynx', label: 'กล่องเสียง', min: -1, max: 1, hint: 'ซ้ายคือต่ำ (เหมือนตอนหาว) ส่วนขวาคือสูง (เหมือนตอนกลืน)' },
  { key: 'velum', label: 'เพดานอ่อน', min: 0, max: 1, hint: '0 คือยกขึ้นปิดจมูก ส่วน 1 คือปล่อยลงให้เสียงผ่านจมูกได้' },
  { key: 'epi', label: 'epilarynx แคบ', min: 0, max: 1, hint: 'ถ้าแคบลงจะเกิดเสียงแหลมใส (Ring) ที่ใกล้ 3 kHz' },
];

export default function VocalTractLab({ start = 'ɑ', lang = 'th' }: { start?: string; lang?: 'th' | 'en' }) {
  const L = (th: string, en: string) => (lang === 'en' ? en : th);
  const [pose, setPose] = useState<Pose>({ ...(POSE_OF[start] ?? NEUTRAL) });
  const [sex, setSex] = useState<Sex>('male');
  const [midi, setMidi] = useState(48);
  const [level, setLevel] = useState(4);
  const [playing, setPlaying] = useState(false);

  // the drawings glide to a new pose (a vowel button moves the tongue over about a third of a second); sound and numbers use the target
  const [shown, setShown] = useState<Pose>(pose);
  const cur = useRef<Pose>(pose);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      cur.current = pose;
      setShown(pose);
      return;
    }
    let raf = 0;
    let last = performance.now();
    const keys = Object.keys(pose) as (keyof Pose)[];
    const step = (now: number) => {
      const k = 1 - Math.exp(-Math.min(0.05, (now - last) / 1000) * 11);
      last = now;
      let moving = false;
      const next = { ...cur.current };
      for (const key of keys) {
        const d = pose[key] - next[key];
        if (Math.abs(d) > 0.003) {
          next[key] = next[key] + d * k;
          moving = true;
        } else next[key] = pose[key];
      }
      cur.current = next;
      setShown(next);
      if (moving) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [pose]);

  const f0 = midiToHz(midi);
  const formants = useMemo(() => tractFormants(pose, sex), [pose, sex]);
  const ring = tractRing(pose, sex);
  const shownFormants = useMemo(() => tractFormants(shown, sex), [shown, sex]);
  const shownRing = tractRing(shown, sex);
  const filter = useMemo(() => ({ formants: shownFormants, nasal: shown.velum, ring: shownRing }), [shownFormants, shown.velum, shownRing?.db, shownRing?.hz]);
  const harmonics = useMemo(() => harmonicLevels(f0, level, 0.5, false, filter, FMAX), [f0, level, filter]);

  // the filter curve is drawn between its own lowest and highest value so that the peaks are easy to see
  const curve = useMemo(() => {
    let hi = -Infinity;
    for (let hz = 100; hz < FMAX; hz += 25) hi = Math.max(hi, filterDb(hz, filter));
    return { hi: hi + 3, lo: hi - 57 };
  }, [filter]);
  const outHi = Math.max(...harmonics.map((h) => h.out));

  // sound: render again whenever something changes while it is playing
  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => {
      const x = renderVoice({ seconds: 1.2, f0, formants, closure: level, register: 0.5, nasal: pose.velum, ring, rms: 0.1, loop: true });
      playVoice(x, { loop: true });
    }, 120);
    return () => clearTimeout(id);
  }, [playing, f0, formants, level, pose.velum, ring?.db, ring?.hz]);
  useEffect(() => () => stopVoice(), []);
  useEffect(() => {
    if (!playing) stopVoice();
  }, [playing]);

  const set = (k: keyof Pose, v: number) => setPose((p) => ({ ...p, [k]: v }));
  const classical = () => setPose((p) => ({ ...p, larynx: -0.6, velum: 0, epi: 0.7, jaw: Math.min(1, p.jaw + 0.15), lip: Math.max(p.lip, 0.25) }));
  const bright = () => setPose((p) => ({ ...p, larynx: 0.5, velum: 0.25, epi: 0.35, lip: -0.8 }));
  const len = tractLength(pose, sex);

  const stack = [
    { y: 34, h: 82, title: L('ต้นกำเนิด (Source): Harmonics จากเส้นเสียง', 'Source: harmonics from the vocal folds') },
    { y: 152, h: 82, title: L('ตัวกรอง (Filter): ช่องเสียงและริมฝีปาก', 'Filter: the vocal tract and lips') },
    { y: 270, h: 92, title: L('เสียงที่ได้ (Output)', 'Output: the resulting sound') },
  ];
  const marks = shownFormants.slice(0, 5).map((hz, i) => ({ hz, text: `F${i + 1}` }));
  if (shownRing) marks.push({ hz: shownRing.hz, text: 'ring' });
  const BAND_COLORS = ['var(--k1)', 'var(--accent)', 'var(--sun)', 'var(--muted)', 'var(--muted)'];

  return (
    <figure className="viz">
      <div className="viz-title">{L('ปรับท่าปากและลำคอ แล้วดู Formant เคลื่อนที่', 'Adjust the mouth and throat and watch the formants move')}</div>
      <Pills<string>
        label={L('สระ', 'Vowel')}
        value={VOWEL_BUTTONS.find((v) => JSON.stringify(POSE_OF[v.key]) === JSON.stringify(pose))?.key ?? ''}
        onChange={(k) => setPose({ ...POSE_OF[k] })}
        options={VOWEL_BUTTONS.map((v) => ({ value: v.key, text: lang === 'en' ? VOWEL_EN[v.key] : v.text }))}
      />
      <div className="viz-box" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', overflowX: 'visible' }}>
        <svg viewBox="0 0 400 440" role="img" aria-label={L('ภาพตัดขวางศีรษะและลำคอ ลิ้น กราม ริมฝีปาก เพดานอ่อน และกล่องเสียงเคลื่อนตามค่าที่ปรับ', 'Cross-section of the head and neck: the tongue, jaw, lips, soft palate and larynx move with the values you set')} style={{ flex: '0 0 250px', width: 250, minWidth: 0, maxWidth: '100%' }}>
          <SagittalHead pose={shown} folds="closed" />
        </svg>
        <svg viewBox="0 0 460 392" role="img" aria-label={L('กราฟ Source, Filter และ Output', 'Graphs of the source, the filter and the output')} style={{ flex: '1 1 400px', minWidth: 0 }}>
          {stack.map((s, i) => {
            const fr = { x: FR.x, y: s.y, w: FR.w, h: s.h };
            return (
              <g key={s.title}>
                <circle cx={FR.x + 9} cy={s.y - 15} r="9" fill="var(--accent)" />
                <text x={FR.x + 9} y={s.y - 10.5} textAnchor="middle" fontSize="12" fontWeight="700" style={{ fill: 'var(--on-key, #fff)' }}>{i + 1}</text>
                <text className="b" x={FR.x + 24} y={s.y - 10} style={{ fontSize: 14 }}>{s.title}</text>
                <Axes fr={fr} fMax={FMAX} ticks={i === 2}>
                  {i >= 1 && (
                    <Clip id={`vt-band-${i}`} fr={fr}>
                      {shownFormants.slice(0, 5).map((hz, k) => hz < FMAX && (
                        <rect key={k} x={xOf(hz - 140, fr, FMAX)} y={fr.y} width={xOf(280, fr, FMAX) - xOf(0, fr, FMAX)} height={fr.h} fill={BAND_COLORS[k]} opacity="0.13" />
                      ))}
                    </Clip>
                  )}
                  <Clip id={`vt-plot-${i}`} fr={fr}>
                    {i === 0 && <Stems fr={fr} fMax={FMAX} lo={-66} hi={3} points={harmonics.map((h) => ({ hz: h.hz, db: Math.max(-60, h.source) }))} color="var(--muted)" width={2.5} />}
                    {i === 1 && (
                      <>
                        <Curve fr={fr} fMax={FMAX} lo={curve.lo - 4} hi={curve.hi + 4} fn={(hz) => filterDb(hz, filter)} area />
                        <Markers fr={fr} fMax={FMAX} at={marks} />
                      </>
                    )}
                    {i === 2 && (
                      <>
                        <Stems fr={fr} fMax={FMAX} lo={outHi - 66} hi={outHi + 6} points={harmonics.map((h) => ({ hz: h.hz, db: Math.max(outHi - 60, h.out) }))} />
                        <Markers fr={fr} fMax={FMAX} at={marks} />
                      </>
                    )}
                  </Clip>
                </Axes>
              </g>
            );
          })}
          <text x={FR.x + FR.w / 2} y="143" textAnchor="middle" fontSize="20" fontWeight="700" style={{ fill: 'var(--muted)' }}>×</text>
          <text x={FR.x + FR.w / 2} y="261" textAnchor="middle" fontSize="20" fontWeight="700" style={{ fill: 'var(--muted)' }}>=</text>
          <text className="s" x={FR.x + FR.w} y="388" textAnchor="end">{L('ความถี่ (Hz)', 'Frequency (Hz)')}</text>
        </svg>
      </div>

      <ol style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 13.5, color: 'var(--muted)', display: 'grid', gap: 2 }}>
        <li>{L('กราฟบนแสดงว่าเส้นเสียงสร้าง Harmonic ชุดเดียวกันทุกครั้ง ที่ความถี่ f0, 2 f0, 3 f0 ไปเรื่อย ๆ โดยแต่ละตัวจะเบาลงตามลำดับ', 'Top graph: the vocal folds always make the same set of harmonics, at the frequencies f0, 2 f0, 3 f0 and so on, getting softer and softer.')}</li>
        <li>{L('กราฟกลางแสดงว่าช่องปากและลำคอเลือกขยายบางย่านความถี่ โดยยอดแต่ละยอดคือหนึ่ง Formant (แถบสีจางคือย่านที่ถูกขยาย)', 'Middle graph: the mouth and throat choose to amplify some ranges of frequency. Each peak is one formant (the pale bands are the ranges that are amplified).')}</li>
        <li>{L('กราฟล่างได้จากการเอากราฟบนมาคูณกับกราฟกลาง Harmonic ที่อยู่ในแถบสีจะดังขึ้น ส่วนที่เหลือจะเบาลง เราจึงได้ยินเป็นสระที่ต่างกัน', 'Bottom graph: multiply the top graph by the middle graph. The harmonics that lie in the colored bands get louder and the rest get softer, so you hear different vowels.')}</li>
      </ol>
      <div className="viz-now" aria-live="polite">
        <strong>
          F1 {Math.round(formants[0])} Hz, F2 {Math.round(formants[1])} Hz, F3 {Math.round(formants[2])} Hz
          {ring ? `, ring ${Math.round(ring.hz)} Hz` : ''}
        </strong>
        <span style={{ display: 'block' }}>
          {L(`ท่อเสียงยาวประมาณ ${len.toFixed(1)} cm (ถ้าเป็นท่อเปิดปิดแบบง่ายหนึ่งท่อ จะได้ F1 ที่ ${Math.round(SOUND_SPEED / (4 * len))} Hz) เมื่อร้องที่ ${noteName(midi)} (${Math.round(f0)} Hz) Harmonic ที่อยู่ใกล้ Formant และต่ำกว่าจะดังขึ้น`, `The vocal tract is about ${len.toFixed(1)} cm long (a simple tube closed at one end gives F1 at ${Math.round(SOUND_SPEED / (4 * len))} Hz). Singing at ${noteName(midi)} (${Math.round(f0)} Hz), the harmonics that are close to a formant, and below it, get louder.`)}
        </span>
        <div className="viz-controls" style={{ marginTop: 8 }}>
          <button type="button" className="btn sm primary" onClick={() => setPlaying((v) => !v)}>{playing ? L('หยุดเสียง', 'Stop the sound') : L('ฟังเสียงสังเคราะห์', 'Hear the synthesized sound')}</button>
          <button type="button" className="btn sm" onClick={classical}>{L('ทรงคลาสสิก (ท่อยาว ลึก)', 'Classical shape (long, deep tube)')}</button>
          <button type="button" className="btn sm" onClick={bright}>{L('ทรงสว่าง (ท่อสั้น แบบ Belt / Pop)', 'Bright shape (short tube, belt / pop)')}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        {SLIDERS.map((s) => (
          <div key={s.key} title={lang === 'en' ? SLIDERS_EN[s.key].hint : s.hint}>
            <Slider label={lang === 'en' ? SLIDERS_EN[s.key].label : s.label} value={Math.round(pose[s.key] * 100) / 100} min={s.min} max={s.max} step={0.05} onChange={(v) => set(s.key, v)} />
          </div>
        ))}
        <Slider label={`${L('โน้ต', 'Note')} ${noteName(midi)}`} value={midi} min={36} max={84} onChange={setMidi} />
        <Slider label={L('ความแน่นของการปิด', 'Firmness of closure')} value={level} min={1} max={7} step={0.5} onChange={setLevel} />
        <Pills<Sex> label={L('เสียง', 'Voice')} value={sex} onChange={(s) => { setSex(s); setMidi((m) => (s === 'female' && m < 52 ? m + 12 : s === 'male' && m >= 60 ? m - 12 : m)); }} options={[{ value: 'male', text: L('ผู้ชาย (ท่อ 17.5 cm)', 'Man (17.5 cm tube)') }, { value: 'female', text: L('ผู้หญิง (ท่อสั้นกว่า)', 'Woman (a shorter tube)') }]} />
      </div>
      <p className="viz-caption">
        {L('นี่เป็นแบบจำลองเพื่อการสอน ซึ่งไม่ได้วัดมาจากคนจริง สระและค่า Formant มาจากตารางค่าเฉลี่ยของ Peterson และ Barney ส่วนท่าปากแต่ละแบบคำนวณด้วยสูตรง่าย ๆ ที่ทำให้ผลตรงกับสิ่งที่หนังสือบอก (กรามเปิด F1 สูง ลิ้นไปหน้า F2 สูง ท่อสั้นทำให้ Formant สูงทุกตัว) และเสียงที่ได้ยินก็สร้างจากตัวกรองชุดเดียวกับกราฟ', 'This is a model for teaching, not a measurement of a real person. The vowels and formant values come from the average table of Peterson and Barney. Each mouth shape is computed with a simple formula that makes the result agree with what the book says (jaw open, high F1; tongue forward, high F2; a short tube makes every formant high). The sound you hear is built from the same filter as the graphs.')}
      </p>
    </figure>
  );
}
