import { useEffect, useRef, useState } from 'react';
import { Pills, Slider } from '../../music/Controls';
import { analyzeVibrato, detectPitch, type TracePoint } from '../../../lib/pitch';
import { formantsOf, hzToMidi, midiToHz, noteName, renderVoice } from '../../../lib/voice';
import { playVoice, stopVoice } from './voiceAudio';

// A mirror for the pitch of your own voice. It listens with the microphone (nothing is recorded or sent anywhere: the sound is analysed
// in the page and thrown away), finds the pitch about 30 times a second, and draws the last few seconds. Use headphones if you play the
// reference note, or the microphone will hear it too. Davids and LaTour chapter 10 explain why this matters: what a singer hears of
// their own voice is not what the audience hears (bone conduction, direction of the sound), so a second opinion helps.

const FRAME = 2048;
const SPAN = 8; // seconds shown
const W = 560;
const H = 240;

type Mode = 'free' | 'target';

export default function PitchMirror({ lang = 'th' }: { lang?: 'th' | 'en' }) {
  const L = (th: string, en: string) => (lang === 'en' ? en : th);
  const [state, setState] = useState<'off' | 'starting' | 'on' | 'error'>('off');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<Mode>('target');
  const [target, setTarget] = useState(57);
  const [now, setNow] = useState<{ midi: number; clarity: number } | null>(null);
  const [trace, setTrace] = useState<{ t: number; midi: number | null }[]>([]);
  const [vib, setVib] = useState<{ rate: number; extent: number } | null>(null);
  const [onTarget, setOnTarget] = useState<number | null>(null);
  const live = useRef<{ ctx: AudioContext; stream: MediaStream; raf: number } | null>(null);
  const modeRef = useRef({ mode, target });
  modeRef.current = { mode, target };

  const stop = () => {
    const l = live.current;
    if (l) {
      cancelAnimationFrame(l.raf);
      l.stream.getTracks().forEach((t) => t.stop());
      void l.ctx.close();
      live.current = null;
    }
    setState('off');
    setNow(null);
  };
  useEffect(() => () => {
    stop();
    stopVoice();
  }, []);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('error');
      setError(L('เบราว์เซอร์นี้ไม่รองรับการใช้ไมโครโฟน หรือไม่ก็หน้านี้ไม่ได้เปิดผ่าน https','This browser does not support the microphone, or the page was not opened over https'));
      return;
    }
    setState('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = FRAME;
      src.connect(an);
      const buf = new Float32Array(FRAME);
      const pts: TracePoint[] = [];
      const rows: { t: number; midi: number | null }[] = [];
      const t0 = performance.now();
      let n = 0;
      const loop = () => {
        n++;
        if (n % 2 === 0) {
          an.getFloatTimeDomainData(buf);
          const t = (performance.now() - t0) / 1000;
          const p = detectPitch(buf, ctx.sampleRate, 70, 1100, 0.01);
          const ok = p.freq && p.clarity > 0.85;
          const midi = ok ? hzToMidi(p.freq!) : null;
          rows.push({ t, midi });
          while (rows.length && rows[0].t < t - SPAN) rows.shift();
          if (midi !== null) {
            pts.push({ t, cents: midi * 100 });
            while (pts.length && pts[0].t < t - 2.5) pts.shift();
          }
          setNow(midi !== null ? { midi, clarity: p.clarity } : null);
          setTrace([...rows]);
          setVib(pts.length > 20 ? analyzeVibrato(pts, FRAME / ctx.sampleRate) : null);
          const m = modeRef.current;
          if (m.mode === 'target') {
            const recent = rows.filter((r) => r.t > t - 3 && r.midi !== null);
            setOnTarget(recent.length >= 10 ? Math.round((100 * recent.filter((r) => Math.abs((r.midi! - m.target) * 100) <= 25).length) / recent.length) : null);
          }
        }
        if (live.current) live.current.raf = requestAnimationFrame(loop);
      };
      live.current = { ctx, stream, raf: 0 };
      live.current.raf = requestAnimationFrame(loop);
      setState('on');
    } catch (e) {
      setState('error');
      setError(e instanceof Error && e.name === 'NotAllowedError' ? L('เบราว์เซอร์ยังไม่ได้อนุญาตให้ใช้ไมโครโฟน ลองเปิดสิทธิ์ในเบราว์เซอร์ แล้วกดอีกครั้งนะ','Permission to use the microphone was refused. Allow it in the browser and press again.') : L('เปิดไมโครโฟนไม่สำเร็จ', 'Could not open the microphone'));
    }
  };

  const hear = () => {
    const male = target < 57;
    playVoice(renderVoice({ seconds: 2, f0: midiToHz(target), formants: formantsOf('ɑ', male ? 'male' : 'female'), closure: 4, rms: 0.1 }));
  };

  const last = trace.length ? trace[trace.length - 1].t : 0;
  const center = mode === 'target' ? target : now ? Math.round(now.midi) : trace.filter((r) => r.midi !== null).slice(-1)[0]?.midi ? Math.round(trace.filter((r) => r.midi !== null).slice(-1)[0].midi!) : 57;
  const RANGE = 3;
  const x = (t: number) => 40 + ((t - (last - SPAN)) / SPAN) * (W - 56);
  const y = (m: number) => 12 + (1 - (m - (center - RANGE)) / (2 * RANGE)) * (H - 40);
  const path = trace.reduce((d, r, i) => {
    if (r.midi === null) return d + ' ';
    const prev = trace[i - 1];
    return d + `${prev && prev.midi !== null ? 'L' : 'M'}${x(r.t).toFixed(1)},${y(r.midi).toFixed(1)}`;
  }, '');
  const cents = now ? (now.midi - Math.round(mode === 'target' ? target : now.midi)) * 100 : 0;

  return (
    <figure className="viz">
      <div className="viz-title">{L('กระจกเงาของระดับเสียง (ใช้ไมโครโฟน)', 'The pitch mirror (uses the microphone)')}</div>
      <div className="viz-controls" style={{ gap: 18 }}>
        <Pills<Mode> label={L('โหมด', 'Mode')} value={mode} onChange={setMode} options={[{ value: 'target', text: L('ร้องให้ตรงโน้ต', 'Sing on the note') }, { value: 'free', text: L('ดูเสียงของตัวเอง', 'Look at my own voice') }]} />
      </div>
      {mode === 'target' && <Slider label={`${L('โน้ต', 'Note')} ${noteName(target)}`} value={target} min={43} max={79} onChange={setTarget} />}
      <div className="viz-controls">
        {state !== 'on' ? (
          <button type="button" className="btn sm primary" onClick={start} disabled={state === 'starting'}>{state === 'starting' ? L('กำลังเปิดไมโครโฟน...', 'Opening the microphone...') : L('เปิดไมโครโฟน', 'Turn on the microphone')}</button>
        ) : (
          <button type="button" className="btn sm" onClick={stop}>{L('ปิดไมโครโฟน', 'Turn off the microphone')}</button>
        )}
        {mode === 'target' && <button type="button" className="btn sm" onClick={hear}>{L('ฟังโน้ตอ้างอิง (ใช้หูฟัง)', 'Hear the reference note (use headphones)')}</button>}
      </div>
      {state === 'error' && <p role="alert" style={{ color: 'var(--wrong)', margin: 0 }}>{error}</p>}
      <div className="viz-box" style={{ overflowX: 'visible' }}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={L('เส้นระดับเสียงของคุณใน 8 วินาทีล่าสุด', 'Your pitch line over the last 8 seconds')} style={{ width: '100%', minWidth: 0 }}>
          <rect x="40" y="12" width={W - 56} height={H - 40} fill="var(--surface)" stroke="var(--line-strong)" rx="6" />
          {Array.from({ length: 2 * RANGE + 1 }, (_, i) => center - RANGE + i).map((m) => (
            <g key={m}>
              <line x1="40" x2={W - 16} y1={y(m)} y2={y(m)} stroke={m === center && mode === 'target' ? 'var(--brand)' : 'var(--line)'} strokeWidth={m === center && mode === 'target' ? 2.5 : 1} />
              <text className="s" x="36" y={y(m) + 4} textAnchor="end">{noteName(m)}</text>
            </g>
          ))}
          {mode === 'target' && <rect x="40" y={y(target + 0.25)} width={W - 56} height={y(target - 0.25) - y(target + 0.25)} fill="color-mix(in srgb, var(--brand) 18%, transparent)" />}
          <path d={path} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" />
          {state !== 'on' && <text x={W / 2} y={H / 2} textAnchor="middle" fill="var(--muted)">{L('กดเปิดไมโครโฟน แล้วลองร้องเสียงยาว ๆ ดู','Turn on the microphone and sing a long note')}</text>}
        </svg>
      </div>
      <div className="viz-now" aria-live="polite">
        <strong>
          {now ? `${noteName(now.midi)} ${cents >= 0 ? '+' : ''}${Math.round(cents)} cents (${Math.round(midiToHz(now.midi))} Hz)` : state === 'on' ? L('ยังไม่ได้ยินเสียงที่ชัดพอ','I cannot hear a clear enough sound yet') : L('ยังไม่ได้เริ่ม', 'Not started')}
        </strong>
        {mode === 'target' && onTarget !== null && <span style={{ display: 'block' }}>{L(`ใน 3 วินาทีล่าสุด เสียงของเราอยู่ในช่วง ±25 cents ของโน้ตเป้า ${onTarget}% ของเวลา`, `In the last 3 seconds you were within ±25 cents of the target note ${onTarget}% of the time`)}</span>}
        <span style={{ display: 'block' }}>
          {vib ? L(`ตรวจพบ Vibrato ประมาณ ${vib.rate.toFixed(1)} ครั้ง/วินาที กว้างประมาณ ${Math.round(vib.extent)} cents (เป็นค่าประมาณ อาจคลาดเคลื่อนราว 10%)`, `Vibrato detected: about ${vib.rate.toFixed(1)} per second, about ${Math.round(vib.extent)} cents wide (an estimate that may be off by about 10%)`) : L('ถ้าเราร้องโน้ตยาวสองวินาทีขึ้นไปและมี Vibrato ด้วย ความเร็วและความกว้างจะแสดงตรงนี้','If you sing a note of two seconds or more with vibrato, its rate and extent are shown here')}
        </span>
      </div>
      <p className="viz-caption">{L('หน้านี้ไม่ได้บันทึกเสียงและไม่ได้ส่งเสียงออกไปที่ไหนเลย ตัวตรวจจับเหมาะกับเสียงร้องที่ชัดทีละโน้ตในห้องเงียบ ถ้ามีเสียงดนตรีหรือเสียงพูดคุยอยู่รอบตัว ผลที่ได้จะเพี้ยนไป ตัวตรวจจับนี้ผ่านการทดสอบกับเสียงสังเคราะห์แล้ว (คลาดไม่เกินหนึ่ง cent) แต่ยังไม่ได้ทดสอบกับไมโครโฟนและเสียงคนจริง ๆ','Nothing is recorded or sent out of this page. The detector suits a clear voice singing one note at a time in a quiet room, and music or talking around you will spoil the result. It was tested with synthesized sound (off by no more than one cent) but has not been tested with a real microphone and real voices.')}</p>
    </figure>
  );
}
