import { useEffect, useMemo, useRef, useState } from 'react';
import { Pills, Slider } from '../../music/Controls';
import { Coronal, TopView } from './folds';
import { Axes, Stems } from './plots';
import { FullBody } from './art';
import { NEUTRAL, type Pose } from '../../../lib/tract';
import { formantsOf, midiToHz, noteName, pulseAt, pulseHarmonics, pulseShape, renderVoice } from '../../../lib/voice';
import { playVoice, stopVoice } from './voiceAudio';

// The vocal folds opening and closing, in slow motion: seen from above, in cross-section, as the airflow pulse that they let through,
// and as the harmonics that this pulse contains. Firmer closure keeps the folds together longer and makes the pulse sharper, which
// makes more strong harmonics (Davids and LaTour, chapter 3, Table 3.1; Titze, chapter 5). Press a button to hear the sound of the
// pulse train alone (a buzz, before the vocal tract has shaped it) or after the vocal tract has turned it into [ɑ].

type Reg = 'chest' | 'mix' | 'head' | 'falsetto';
const REG: Record<Reg, { text: string; register: number; falsetto: boolean; thick: number }> = {
  chest: { text: 'Chest', register: 0, falsetto: false, thick: 1 },
  mix: { text: 'Mix', register: 0.5, falsetto: false, thick: 0.55 },
  head: { text: 'Head', register: 1, falsetto: false, thick: 0.28 },
  falsetto: { text: 'Falsetto', register: 1, falsetto: true, thick: 0.1 },
};

const LEVEL_NAME = (l: number, en = false) =>
  en
    ? l < 1.5 ? 'very loose (breathy)' : l < 2.5 ? 'loose' : l < 3.5 ? 'fairly loose (airy)' : l < 4.5 ? 'medium (classical / legit)' : l < 5.5 ? 'fairly firm (mix belt)' : l < 6.5 ? 'firm' : 'very firm (heavy belt)'
    : l < 1.5 ? 'หลวมมาก (breathy)' : l < 2.5 ? 'หลวม' : l < 3.5 ? 'ค่อนข้างหลวม (airy)' : l < 4.5 ? 'ปานกลาง (classical / legit)' : l < 5.5 ? 'ค่อนข้างแน่น (mix belt)' : l < 6.5 ? 'แน่น' : 'แน่นมาก (heavy belt)';

const W = 440;
const WF = { x: 6, y: 34, w: 428, h: 86 };
const HF = { x: 6, y: 178, w: 428, h: 96 };

export default function VocalFoldLab({ lang = 'th' }: { lang?: 'th' | 'en' }) {
  const L = (th: string, en: string) => (lang === 'en' ? en : th);
  const [midi, setMidi] = useState(55);
  const [level, setLevel] = useState(4);
  const [reg, setReg] = useState<Reg>('chest');
  const [phase, setPhase] = useState(0);
  const [clock, setClock] = useState(0);
  const [slow, setSlow] = useState(true);
  const [playing, setPlaying] = useState<'raw' | 'vowel' | null>(null);
  const raf = useRef(0);

  const f0 = midiToHz(midi);
  const r = REG[reg];
  const shape = useMemo(() => pulseShape(level, r.register, r.falsetto), [level, r.register, r.falsetto]);
  const harm = useMemo(() => pulseHarmonics(shape, 24), [shape]);

  // slow motion: one cycle of the folds takes about a second on the screen
  useEffect(() => {
    if (!slow || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t0 = performance.now();
    const loop = (now: number) => {
      setPhase(((now - t0) / 1000) % 1);
      setClock((now - t0) / 1000);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [slow]);

  useEffect(() => {
    if (!playing) {
      stopVoice();
      return;
    }
    const id = setTimeout(() => {
      const x = renderVoice({
        seconds: 1.2,
        f0,
        formants: playing === 'raw' ? [] : formantsOf('ɑ'),
        closure: level,
        register: r.register,
        falsetto: r.falsetto,
        rms: playing === 'raw' ? 0.06 : 0.1,
        loop: true,
      });
      playVoice(x, { loop: true });
    }, 100);
    return () => clearTimeout(id);
  }, [playing, f0, level, r.register, r.falsetto]);
  useEffect(() => () => stopVoice(), []);

  const open = pulseAt(phase, shape);
  const openTop = pulseAt((phase + 1 - 0.1) % 1, shape);
  const chink = level < 2.5 ? (2.5 - level) / 1.5 : 0;
  const leak = r.falsetto ? 6 : level < 1.5 ? 4 : 0;

  // the pulse over three cycles
  const wave = useMemo(() => {
    const pts: string[] = [];
    for (let i = 0; i <= 300; i++) {
      const p = (i / 300) * 3;
      const y = WF.y + WF.h - 10 - pulseAt(p % 1, shape) * (WF.h - 24);
      pts.push(`${i ? 'L' : 'M'}${(WF.x + (i / 300) * WF.w).toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(' ');
  }, [shape]);
  const cursorX = WF.x + (((phase % 1) + 0) / 3) * WF.w;
  const stems = harm.map((a, i) => ({ hz: (i + 1) * 200, db: 20 * Math.log10(Math.max(a / harm[0], 1e-6)) }));
  const closedPct = Math.round((1 - shape.oq) * 100);

  // how hard each muscle works, a sketch: CT grows with pitch, TA is large for chest voice and falls with the register
  const ct = Math.min(1, Math.max(0.08, (midi - 38) / 44) * (r.falsetto ? 1.1 : 1));
  const ta = Math.min(1, Math.max(0.05, (1 - r.register) * (1 - 0.4 * (midi - 38) / 44) + 0.12));

  // The body's side of the same sound (a sketch of the trends the books describe, not measurements): a firmer closure and a higher note both
  // ask for more air pressure under the folds, a loose closure lets more air through, and an untrained larynx climbs with the pitch.
  const hi = Math.min(1, Math.max(0, (midi - 36) / 48));
  const firm = (level - 1) / 6;
  const pressure = Math.min(1, 0.12 + 0.5 * firm + 0.38 * hi);
  const airflow = Math.min(1, Math.max(0.1, 0.95 - 0.8 * firm + (r.falsetto ? 0.15 : 0)));
  const climb = Math.min(1, Math.max(0, hi * 1.05 - 0.1 + (level > 5.5 ? 0.1 : 0)));
  const cyc = clock % 9;
  const breath = slow ? (cyc < 7.5 ? 0.8 - 0.5 * (cyc / 7.5) : 0.3 + 0.5 * ((cyc - 7.5) / 1.5)) : 0.55;
  const bodyPose: Pose = { ...NEUTRAL, jaw: 0.3 + 0.25 * hi, height: 0.3, front: 0.4, larynx: -0.5 + 0.9 * climb };

  return (
    <figure className="viz">
      <div className="viz-title">{L('เส้นเสียงเปิดปิดช้าๆ และเสียงที่เกิดขึ้น', 'The vocal folds opening and closing slowly, and the sound they make')}</div>
      <div className="viz-box" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', overflowX: 'visible' }}>
        <div style={{ flex: '0 0 auto', display: 'grid', gap: 10, justifyItems: 'center', maxWidth: '100%' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>{L('มองจากด้านบน', 'Seen from above')}</div>
          <TopView open={open} chink={chink} leak={leak} width={250} lang={lang} />
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>{L('ภาพตัดขวาง (ลมขึ้นจากด้านล่าง)', 'Cross-section (the air rises from below)')}</div>
          <Coronal open={open} openTop={openTop} thick={r.thick} width={250} lang={lang} />
        </div>
        <div style={{ flex: '1 1 340px', minWidth: 0 }}>
          <svg viewBox={`0 0 ${W} 314`} role="img" aria-label={L('กราฟลมที่ไหลผ่านเส้นเสียงในสามรอบ และ harmonics ของลมนี้', 'A graph of the air flowing through the vocal folds over three cycles, and the harmonics of this air')} style={{ width: '100%', minWidth: 0 }}>
            <text className="b" x={WF.x} y={WF.y - 12}>{L('ลมที่ไหลผ่านเส้นเสียง (3 รอบ)', 'Air flowing through the vocal folds (3 cycles)')}</text>
            <Axes fr={WF} fMax={3} ticks={false}>
              <path d={wave} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" />
              <line x1={cursorX} x2={cursorX} y1={WF.y + 4} y2={WF.y + WF.h - 4} stroke="var(--fg)" strokeWidth="1.5" strokeDasharray="3 3" />
            </Axes>
            <text className="s" x={WF.x + WF.w} y={WF.y + WF.h + 15} textAnchor="end">{L(`เส้นเสียงปิดสนิทประมาณ ${closedPct}% ของแต่ละรอบ`, `The vocal folds are fully closed for about ${closedPct}% of each cycle`)}</text>
            <text className="b" x={HF.x} y={HF.y - 12}>{L('harmonics ของลมนี้ (เทียบกับตัวแรก, dB)', 'Harmonics of this air (relative to the first, dB)')}</text>
            <rect x={HF.x} y={HF.y} width={HF.w} height={HF.h} fill="var(--surface)" stroke="var(--line-strong)" strokeWidth="1.5" rx="6" />
            {/* the harmonic number replaces frequency on this axis; stems stay inside the frame (-66 dB at the bottom, +6 dB at the top) */}
            <Stems fr={{ x: HF.x + 4, y: HF.y, w: HF.w - 8, h: HF.h }} fMax={24 * 200 + 100} lo={-66} hi={6} points={stems.map((p) => ({ hz: p.hz, db: Math.max(-60, p.db) }))} width={8} />
            {[1, 2, 3, 4, 6, 8, 12, 16, 20, 24].map((k) => (
              <text key={k} className="s" x={HF.x + 4 + ((k * 200) / (24 * 200 + 100)) * (HF.w - 8)} y={HF.y + HF.h + 15} textAnchor="middle">{k}</text>
            ))}
            <text className="s" x={HF.x + HF.w} y={HF.y + HF.h + 31} textAnchor="end">{L('หมายเลข harmonic (1 คือความถี่ของโน้ต)', 'Harmonic number (1 is the frequency of the note)')}</text>
          </svg>
        </div>
      </div>

      <div className="viz-box" style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center', overflowX: 'visible' }}>
        <svg viewBox="0 0 520 760" role="img" aria-label={L('ร่างกายร้องเพลงตามค่าที่ตั้งไว้ ซี่โครงและหน้าท้องเคลื่อนตามลมหายใจ และกล่องเสียงสูงขึ้นตามโน้ต', 'The body singing with the chosen settings: the ribs and abdomen move with the breath and the larynx rises with the note')} style={{ flex: '0 0 190px', width: 190, maxWidth: '100%', minWidth: 0 }}>
          <FullBody pose={bodyPose} breath={breath} folds="closed" />
        </svg>
        <div style={{ flex: '1 1 300px', minWidth: 0, display: 'grid', gap: 10 }}>
          <strong style={{ fontFamily: 'var(--display)' }}>{L('ร่างกายตอบสนองอย่างไรกับเสียงนี้', 'How the body responds to this sound')}</strong>
          {[
            [L('แรงดันลมใต้เส้นเสียง', 'Air pressure under the vocal folds'), pressure, L('ปิดแน่นขึ้นและโน้ตสูงขึ้น ต้องดันลมแรงขึ้น หน้าท้องและซี่โครงต้านลมไว้มากขึ้น', 'A firmer closure and a higher note need stronger air pressure, so the abdomen and ribs resist the air more.')],
            [L('ปริมาณลมที่รั่วผ่าน', 'Amount of air that leaks through'), airflow, L('ปิดหลวมลมรั่วมาก ปอดหมดเร็ว ปิดแน่นลมผ่านน้อย ร้องได้นานกว่า', 'A loose closure leaks a lot of air and the lungs empty fast. A firm closure lets little air through and you can sing longer.')],
            [L('กล่องเสียงยกขึ้น', 'Larynx raised'), climb, L('คนที่ไม่ได้ฝึกมักยกกล่องเสียงตามโน้ต นักร้องที่ฝึกมาจะพยายามรักษาให้ต่ำและผ่อน', 'Untrained people often raise the larynx with the note. Trained singers try to keep it low and relaxed.')],
          ].map(([name, v, why]) => (
            <div key={name as string} style={{ display: 'grid', gap: 2 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
                <span>{name}</span>
                <span style={{ height: 9, borderRadius: 99, background: 'var(--line)', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${Math.round((v as number) * 100)}%`, background: 'var(--accent)', transition: 'width .25s' }} />
                </span>
              </div>
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{why as string}</span>
            </div>
          ))}
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{L('ลำตัวหายใจออกช้าๆ ทุกเก้าวินาทีในภาพ (กล่องเสียงขยับตามโน้ตที่เลือก) แท่งเป็นแนวโน้มที่หนังสือบรรยาย ไม่ใช่ค่าที่วัด (Davids และ LaTour บทที่ 2 หน้า 25 และบทที่ 4 หน้า 78)', 'The torso breathes out slowly over nine seconds in the picture (the larynx moves with the note you chose). The bars are trends that the book describes, not measured values (Davids and LaTour, chapter 2, page 25, and chapter 4, page 78).')}</span>
        </div>
      </div>

      <div className="viz-now" aria-live="polite">
        <strong>
          {L(`${noteName(midi)} (${Math.round(f0)} Hz) หมายถึงเส้นเสียงเปิดปิด ${Math.round(f0)} รอบต่อวินาที ภาพนี้ช้าลงประมาณ ${Math.round(f0)} เท่า`, `${noteName(midi)} (${Math.round(f0)} Hz) means the vocal folds open and close ${Math.round(f0)} times per second. This picture is slowed down by about ${Math.round(f0)} times.`)}
        </strong>
        <span style={{ display: 'block' }}>
          {L(`harmonic ที่ 2 แรงกว่า harmonic แรกอยู่ ${Math.max(-99, Math.round(20 * Math.log10(harm[1] / harm[0])))} dB และ harmonic ที่ 4 อยู่ที่ ${Math.round(20 * Math.log10(harm[3] / harm[0]))} dB ยิ่งปิดแน่นและปิดเร็ว harmonic สูงยิ่งแรง`, `Harmonic 2 is at ${Math.max(-99, Math.round(20 * Math.log10(harm[1] / harm[0])))} dB relative to harmonic 1, and harmonic 4 is at ${Math.round(20 * Math.log10(harm[3] / harm[0]))} dB. The firmer and faster the closure, the stronger the high harmonics.`)}
        </span>
        <div style={{ display: 'grid', gap: 6, marginTop: 10, maxWidth: 360 }}>
          {[
            [L('CT (ยืดและทำให้เส้นเสียงบาง)', 'CT (stretches and thins the vocal folds)'), ct],
            [L('TA (ทำให้เส้นเสียงหนาและแน่น)', 'TA (thickens and firms the vocal folds)'), ta],
          ].map(([name, v]) => (
            <div key={name as string} style={{ display: 'grid', gridTemplateColumns: '170px 1fr', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span>{name}</span>
              <span style={{ height: 8, borderRadius: 99, background: 'var(--line)', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${Math.round((v as number) * 100)}%`, background: 'var(--accent)' }} />
              </span>
            </div>
          ))}
        </div>
        <div className="viz-controls" style={{ marginTop: 10 }}>
          <button type="button" className="btn sm primary" onClick={() => setPlaying((p) => (p === 'raw' ? null : 'raw'))}>{playing === 'raw' ? L('หยุดเสียง', 'Stop the sound') : L('ฟังเสียงจากเส้นเสียงอย่างเดียว (บัซ)', 'Hear the vocal folds alone (the buzz)')}</button>
          <button type="button" className="btn sm" onClick={() => setPlaying((p) => (p === 'vowel' ? null : 'vowel'))}>{playing === 'vowel' ? L('หยุดเสียง', 'Stop the sound') : L('ฟังหลังผ่านช่องเสียง [ɑ]', 'Hear it after the vocal tract [ɑ]')}</button>
          <button type="button" className="btn sm" onClick={() => setSlow((s) => !s)}>{slow ? L('หยุดภาพเคลื่อนไหว', 'Pause the animation') : L('เล่นภาพเคลื่อนไหว', 'Play the animation')}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <Slider label={`${L('โน้ต', 'Note')} ${noteName(midi)}`} value={midi} min={36} max={84} onChange={setMidi} />
        <Slider label={L('ความแน่นของการปิด', 'Firmness of closure')} value={level} min={1} max={7} step={0.5} onChange={setLevel} />
        <div className="gx-detail" style={{ marginLeft: 66 }}>{L('ระดับ', 'Level')} {level}: {LEVEL_NAME(level, lang === 'en')}</div>
        <Pills<Reg> label="Register" value={reg} onChange={setReg} options={(Object.keys(REG) as Reg[]).map((k) => ({ value: k, text: REG[k].text }))} />
      </div>
      <p className="viz-caption">
        {L('รูปร่างของลมเป็นแบบจำลองสำหรับสอน (pulse แบบ Rosenberg) ไม่ใช่การวัดจากเส้นเสียงจริง ค่าความหนาและการทำงานของ CT กับ TA เป็นภาพร่างที่แสดงแนวโน้มตามหนังสือ ไม่ใช่ตัวเลขจากการวัด เสียง "บัซ" คือสิ่งที่เส้นเสียงสร้างก่อนผ่านปากและคอ ฟังแล้วยังไม่เป็นสระ', 'The shape of the airflow is a teaching model (a Rosenberg-type pulse) and not a measurement of real vocal folds. The thickness and the action of the CT and TA are sketches that show the trends in the book, not measured numbers. The "buzz" is what the vocal folds make before the sound passes through the mouth and throat, and it does not yet sound like a vowel.')}
      </p>
    </figure>
  );
}
