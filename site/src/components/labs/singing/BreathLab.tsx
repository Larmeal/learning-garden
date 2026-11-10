import { useEffect, useRef, useState } from 'react';
import { FullBody } from './art';
import { Pills, Slider } from '../../music/Controls';
import { NEUTRAL, type Pose } from '../../../lib/tract';

// One breath for a long phrase, in four phases (Davids and LaTour, chapter 2): inhale, a very short suspension, exhale, recovery.
// The picture moves with the breath. The chart under it is a sketch of why "breath support" is needed: the air in the lungs pushes
// back by itself (elastic recoil), hard at the start of a phrase and softly at the end, so a steady tone needs the muscles to resist
// at first and push later (Titze, chapter 3: "breathing in while breathing out"). The numbers are relative, not measurements.

type Mode = 'low' | 'high';
type Exhale = 'collapse' | 'appoggio';

const T_IN = 3;
const T_HOLD = 1;
const T_REC = 1.6;
const smooth = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};

const pose: Pose = { ...NEUTRAL, jaw: 0.4, height: 0.3, front: 0.4 };

export default function BreathLab({ lang = 'th' }: { lang?: 'th' | 'en' }) {
  const L = (th: string, en: string) => (lang === 'en' ? en : th);
  const [mode, setMode] = useState<Mode>('low');
  const [exhale, setExhale] = useState<Exhale>('appoggio');
  const [phrase, setPhrase] = useState(10);
  const [running, setRunning] = useState(true);
  const [time, setTime] = useState(0);
  const clock = useRef({ last: 0, t: 0 });

  const total = T_IN + T_HOLD + phrase + T_REC;
  useEffect(() => {
    if (!running) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    clock.current.last = performance.now();
    const loop = (now: number) => {
      clock.current.t += (now - clock.current.last) / 1000;
      clock.current.last = now;
      setTime(clock.current.t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const cap = mode === 'low' ? 1 : 0.6; // upper chest breathing fills the smaller top of the lungs
  const style: Exhale = mode === 'high' ? 'collapse' : exhale; // without the lower ribs and abdomen there is little to resist with
  const t = time % total;
  let phase: 'in' | 'hold' | 'out' | 'rest' = 'in';
  let breath = 0;
  if (t < T_IN) {
    phase = 'in';
    breath = cap * smooth(t / T_IN);
  } else if (t < T_IN + T_HOLD) {
    phase = 'hold';
    breath = cap;
  } else if (t < T_IN + T_HOLD + phrase) {
    phase = 'out';
    const u = (t - T_IN - T_HOLD) / phrase;
    // the chest wall and belly give way early when they just collapse, and stay out until the end of the phrase with appoggio
    const drop = style === 'collapse' ? 1 - Math.pow(1 - u, 1.6) : Math.pow(u, 2.2);
    breath = cap * (1 - 0.88 * drop);
  } else {
    phase = 'rest';
    breath = cap * 0.12 * (1 - smooth((t - T_IN - T_HOLD - phrase) / T_REC));
  }

  const NAMES = { in: L('หายใจเข้า', 'Breathe in'), hold: L('หยุดสั้นๆ (suspension)', 'A short hold (suspension)'), out: L('หายใจออกพร้อมร้อง', 'Breathe out while singing'), rest: L('พัก (recovery)', 'Rest (recovery)') };
  const TIPS = {
    in: mode === 'low' ? L('ผ่อนหน้าท้อง ซี่โครงขยายออกด้านข้างและด้านหลัง ไหล่นิ่ง หายใจเงียบๆ', 'Relax the abdomen, let the ribs expand to the sides and the back, keep the shoulders still, and breathe quietly.') : L('ไหล่ยกและอกส่วนบนขยับ แต่ได้ลมน้อยและคอเกร็ง', 'The shoulders rise and the upper chest moves, but you get little air and the neck gets tense.'),
    hold: L('คงซี่โครงและหน้าท้องไว้ที่ตำแหน่งขยายโดยไม่ปิดเส้นเสียงแน่น', 'Keep the ribs and abdomen in the expanded position without closing the vocal folds tightly.'),
    out: style === 'appoggio' ? L('ต้านไม่ให้ซี่โครงและหน้าท้องยุบเร็ว ให้ยุบจริงตอนปลายประโยค', 'Resist the ribs and abdomen collapsing fast, so that they really collapse only at the end of the phrase.') : L('ซี่โครงและหน้าท้องยุบเร็ว แรงลมต้นประโยคมากและปลายประโยคหมดแรง', 'The ribs and abdomen collapse quickly, so the air pressure is too strong at the start of the phrase and runs out at the end.'),
    rest: L('ปล่อยกล้ามเนื้อที่ใช้หายใจให้คลายก่อนหายใจเข้าครั้งถัดไป', 'Let the muscles of breathing relax before the next breath in.'),
  };

  // pressure chart over the phrase, u from 0 to 1
  const W = 300;
  const H = 140;
  const px = (u: number) => 24 + u * (W - 34);
  const py = (v: number) => 12 + (1 - v) * (H - 34);
  const recoil = (u: number) => 1 - 0.7 * u; // the air in the lungs pushes back less as the lungs empty
  const target = 0.6;
  const curve = (fn: (u: number) => number) => Array.from({ length: 41 }, (_, i) => `${i ? 'L' : 'M'}${px(i / 40).toFixed(1)},${py(fn(i / 40)).toFixed(1)}`).join(' ');
  const cursor = phase === 'out' ? (t - T_IN - T_HOLD) / phrase : null;

  // a stopwatch for the sibilant exercise
  const [sw, setSw] = useState<{ running: boolean; start: number; shown: number }>({ running: false, start: 0, shown: 0 });
  const [best, setBest] = useState(0);
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem('garden:singing:hiss-best'));
      if (v > 0) setBest(v);
    } catch {
      /* no storage */
    }
  }, []);
  useEffect(() => {
    if (!sw.running) return;
    const id = setInterval(() => setSw((s) => ({ ...s, shown: (performance.now() - s.start) / 1000 })), 100);
    return () => clearInterval(id);
  }, [sw.running]);
  const toggleSw = () => {
    if (!sw.running) setSw({ running: true, start: performance.now(), shown: 0 });
    else {
      const secs = (performance.now() - sw.start) / 1000;
      setSw({ running: false, start: 0, shown: secs });
      if (secs > best) {
        setBest(secs);
        try {
          localStorage.setItem('garden:singing:hiss-best', String(secs));
        } catch {
          /* no storage */
        }
      }
    }
  };

  return (
    <figure className="viz">
      <div className="viz-title">{L('หนึ่งลมหายใจสำหรับหนึ่งประโยคเพลง', 'One breath for one phrase of a song')}</div>
      <div className="viz-controls" style={{ gap: 18 }}>
        <Pills<Mode> label={L('หายใจเข้า', 'Breathe in')} value={mode} onChange={setMode} options={[{ value: 'low', text: L('ท้องและซี่โครง', 'Abdomen and ribs') }, { value: 'high', text: L('อกส่วนบน (clavicular)', 'Upper chest (clavicular)') }]} />
        <Pills<Exhale> label={L('หายใจออก', 'Breathe out')} value={style} onChange={setExhale} options={[{ value: 'collapse', text: L('ปล่อยให้ยุบ', 'Let it collapse') }, { value: 'appoggio', text: L('ต้านไว้ (appoggio)', 'Resist it (appoggio)') }]} />
      </div>
      <Slider label={L('ความยาวประโยค', 'Phrase length')} value={phrase} min={5} max={16} unit={L(' วินาที', ' s')} onChange={setPhrase} />
      <div className="viz-box" style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start', overflowX: 'visible' }}>
        <svg viewBox="0 0 480 760" role="img" aria-label={L('ภาพลำตัวด้านข้าง ปอด ซี่โครง กะบังลมและหน้าท้องเคลื่อนตามลมหายใจ', 'Side view of the torso: the lungs, ribs, diaphragm and abdomen move with the breath')} style={{ flex: '0 0 270px', width: 270, maxWidth: '100%', minWidth: 0 }}>
          <FullBody pose={pose} breath={breath} mode={mode} folds={phase === 'in' ? 'open' : 'closed'} />
        </svg>
        <div style={{ flex: '1 1 320px', minWidth: 0, display: 'grid', gap: 12 }}>
          <div className="viz-now" aria-live="polite">
            <strong>{NAMES[phase]}</strong>
            <span style={{ display: 'block' }}>{TIPS[phase]}</span>
            <div style={{ height: 8, borderRadius: 99, background: 'var(--line)', marginTop: 10, overflow: 'hidden' }} aria-hidden="true">
              <div style={{ height: '100%', width: `${(t / total) * 100}%`, background: 'var(--accent)' }} />
            </div>
            <div className="viz-controls" style={{ marginTop: 10 }}>
              <button type="button" className="btn sm" onClick={() => setRunning((r) => !r)}>{running ? L('หยุดภาพเคลื่อนไหว', 'Pause the animation') : L('เล่นภาพเคลื่อนไหว', 'Play the animation')}</button>
            </div>
          </div>

          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={L('กราฟร่างของแรงดันลมระหว่างประโยค เทียบการปล่อยให้ยุบกับการต้านแบบ appoggio', 'A sketch graph of the air pressure through a phrase, comparing letting it collapse with resisting it (appoggio)')} style={{ width: '100%', minWidth: 0, maxWidth: 420 }}>
            <rect x="24" y="12" width={W - 34} height={H - 34} fill="var(--surface)" stroke="var(--line-strong)" rx="6" />
            <path d={curve(recoil)} fill="none" stroke="var(--muted)" strokeWidth="2" strokeDasharray="5 4" />
            {style === 'collapse' ? (
              <path d={curve(recoil)} fill="none" stroke="var(--wrong)" strokeWidth="3.5" />
            ) : (
              <>
                <path d={`${curve(() => target)} L${px(1)},${py(recoil(1))} ${Array.from({ length: 41 }, (_, i) => `L${px(1 - i / 40).toFixed(1)},${py(recoil(1 - i / 40)).toFixed(1)}`).join(' ')} Z`} fill="color-mix(in srgb, var(--accent) 16%, transparent)" stroke="none" />
                <path d={curve(() => target)} fill="none" stroke="var(--brand)" strokeWidth="3.5" />
              </>
            )}
            {cursor !== null && <line x1={px(cursor)} x2={px(cursor)} y1="12" y2={H - 22} stroke="var(--fg)" strokeWidth="1.5" />}
            <text className="s" x="24" y={H - 6}>{L('ต้นประโยค', 'Start of phrase')}</text>
            <text className="s" x={W - 10} y={H - 6} textAnchor="end">{L('ปลายประโยค', 'End of phrase')}</text>
            <text className="s" x="4" y="20" transform={`rotate(-90 8 ${H / 2})`} textAnchor="middle">{L('แรงดันลม', 'Air pressure')}</text>
            <text className="b" x={px(0.5)} y="26" fontSize="11" textAnchor="middle" fill={style === 'collapse' ? 'var(--wrong)' : 'var(--brand)'}>
              {style === 'collapse' ? L('แรงดันตกลงเรื่อยๆ', 'The pressure keeps falling') : L('แรงดันคงที่ (เส้นเขียว)', 'Steady pressure (green line)')}
            </text>
          </svg>
          <p className="viz-caption" style={{ margin: 0 }}>
            {L('เส้นประคือแรงที่อากาศในปอดดันกลับเอง (elastic recoil) แรงนี้สูงตอนปอดเต็มและเบาลงเมื่อลมหมด ถ้าไม่ทำอะไร แรงดันที่เส้นเสียงจะตกตาม ช่องว่างระหว่างเส้นประกับเส้นเขียวคือสิ่งที่กล้ามเนื้อต้องทำ ต้นประโยคต้านไม่ให้ลมออกแรงเกิน ปลายประโยคช่วยดันออก นี่คือ "การหายใจเข้าไปพร้อมๆ กับหายใจออก" ที่ Titze พูดถึง กราฟเป็นภาพร่างเชิงอธิบาย ไม่ใช่ข้อมูลที่วัดได้', 'The dashed line is the force with which the air in the lungs pushes back by itself (elastic recoil). It is high when the lungs are full and gets lighter as the air runs out. If you do nothing, the pressure at the vocal folds falls with it. The gap between the dashed line and the green line is what the muscles have to do: at the start of the phrase they resist so that the air does not come out too strongly, and at the end of the phrase they help push it out. This is the "breathing in at the same time as breathing out" that Titze talks about. The graph is a sketch for explanation and is not measured data.')}
          </p>
        </div>
      </div>

      <div className="viz-now">
        <strong>{L('จับเวลาแบบฝึกฟู่ [s]', 'Time the hissing [s] exercise')}</strong>
        <span style={{ display: 'block' }}>{L('สูดลมเข้าแบบที่ฝึกข้างบน กดเริ่มแล้วฟู่ให้เบาและสม่ำเสมอ ให้ซี่โครงและหน้าท้องยังอยู่ที่เดิมนานที่สุด กดหยุดเมื่อจบ', 'Breathe in the way you practiced above, press start, and hiss softly and steadily, keeping the ribs and abdomen where they are for as long as possible. Press stop when you finish.')}</span>
        <div className="viz-controls" style={{ marginTop: 8 }}>
          <button type="button" className="btn sm primary" onClick={toggleSw}>{sw.running ? L('หยุด', 'Stop') : L('เริ่มจับเวลา', 'Start the timer')}</button>
          <b style={{ fontFamily: 'var(--mono)', fontSize: 18 }}>{sw.shown.toFixed(1)} s</b>
          {best > 0 && <span className="gx-detail">{L('ดีที่สุดบนเครื่องนี้', 'Best on this device')} {best.toFixed(1)} s</span>}
        </div>
      </div>
    </figure>
  );
}
