import { useEffect, useState } from 'react';
import { Pills, Slider } from '../../music/Controls';
import { Axes, Clip, Curve, Markers } from './plots';
import { SOUND_SPEED, halfWave, midiToHz, quarterWave, renderVoice, tubeGainDb } from '../../../lib/voice';
import { playVoice, stopVoice } from './voiceAudio';

// The simplest model of a vocal tract: a straight pipe of one width. Closed at the glottis, open at the lips, it resonates where a
// quarter of a wavelength, three quarters, five quarters ... fit in its length: F(n) = (2n - 1) c / 4L (Titze, chapter 6, "The
// Quarter-Wave Resonance Tube"). With both ends open it resonates at F(n) = n c / 2L (the half-wave tube). The standing wave of
// the resonance you pick is drawn as pressure along the pipe, slowed down so that it can be seen.

type End = 'quarter' | 'half';
const FMAX = 5000;

export default function TubeLab({ lang = 'th' }: { lang?: 'th' | 'en' }) {
  const Tr = (th: string, en: string) => (lang === 'en' ? en : th);
  const [len, setLen] = useState(17.5);
  const [end, setEnd] = useState<End>('quarter');
  const [n, setN] = useState(1);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);

  const fOf = (k: number) => (end === 'quarter' ? quarterWave(len, k) : halfWave(len, k));
  const formants = [1, 2, 3, 4, 5].map(fOf);
  const loss = 0.03;

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      setT((now - t0) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!playing) {
      stopVoice();
      return;
    }
    const id = setTimeout(() => {
      playVoice(renderVoice({ seconds: 1.2, f0: midiToHz(48), formants, bandwidths: [90, 110, 150, 200, 250], closure: 4, rms: 0.1, loop: true }), { loop: true });
    }, 100);
    return () => clearTimeout(id);
  }, [playing, len, end]);
  useEffect(() => () => stopVoice(), []);

  // the tube drawn at a scale of 18 px per cm
  const px = 18;
  const L = len * px;
  const X0 = 40;
  const TOPY = 52;
  const TH = 84;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const phase = Math.cos(2 * Math.PI * 0.5 * t); // pressure swings up and down (slowed down so that it can be seen)
  const move = Math.sin(2 * Math.PI * 0.5 * t); // the air moves a quarter of a cycle later than the pressure
  // pressure and air movement along the pipe, u = 0 at the glottis and 1 at the lips
  const pressure = (u: number) => (end === 'quarter' ? Math.cos(((2 * n - 1) * Math.PI * u) / 2) : Math.sin(n * Math.PI * u));
  const sway = (u: number) => (end === 'quarter' ? Math.sin(((2 * n - 1) * Math.PI * u) / 2) : -Math.cos(n * Math.PI * u));
  const wave = Array.from({ length: 61 }, (_, i) => {
    const u = i / 60;
    const y = TOPY + TH / 2 - pressure(u) * phase * (TH / 2 - 6);
    return `${i ? 'L' : 'M'}${(X0 + u * L).toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const SL = 48;
  const slices = Array.from({ length: SL }, (_, i) => {
    const u = (i + 0.5) / SL;
    return { x: X0 + (i / SL) * L, w: L / SL + 0.6, p: pressure(u) * phase };
  });
  const COLS = 36;
  const dots = Array.from({ length: COLS }, (_, i) => {
    const u = (i + 0.5) / COLS;
    return { u, dx: sway(u) * move * 7 };
  });
  const lambda = end === 'quarter' ? (4 * len) / (2 * n - 1) : (2 * len) / n;
  const FR = { x: 36, y: 244, w: 480, h: 92 };

  return (
    <figure className="viz">
      <div className="viz-title">{Tr('ท่อเสียงแบบง่ายที่สุด: ท่อตรงหนึ่งท่อ', 'The simplest vocal tract: one straight tube')}</div>
      <Slider label={Tr('ความยาวท่อ', 'Tube length')} value={len} min={10} max={25} step={0.5} unit=" cm" onChange={setLen} />
      <div className="viz-controls" style={{ gap: 18 }}>
        <Pills<End> label={Tr('ปลายท่อ', 'Ends of the tube')} value={end} onChange={setEnd} options={[{ value: 'quarter', text: Tr('ปิดที่เส้นเสียง เปิดที่ปาก', 'Closed at the vocal folds, open at the mouth') }, { value: 'half', text: Tr('เปิดทั้งสองข้าง (เทียบ)', 'Open at both ends (for comparison)') }]} />
        <Pills<number> label={Tr('ดู resonance ที่', 'Show the resonance at')} value={n} onChange={setN} options={[1, 2, 3].map((k) => ({ value: k, text: `F${k} (${Math.round(fOf(k))} Hz)` }))} />
      </div>
      <div className="viz-box" style={{ overflowX: 'visible' }}>
        <svg viewBox="0 0 540 352" role="img" aria-label={Tr('ท่อตรงหนึ่งท่อ สีและจุดแสดงความดันและการเคลื่อนของอากาศในท่อ และกราฟการตอบสนองความถี่', 'One straight tube: color and dots show the pressure and the movement of air in the tube, and a graph of the frequency response')} style={{ width: '100%', minWidth: 0 }}>
          <clipPath id="tube-clip"><rect x={X0} y={TOPY} width={L} height={TH} /></clipPath>
          <g clipPath="url(#tube-clip)">
            <rect x={X0} y={TOPY} width={L} height={TH} fill="var(--surface)" />
            {slices.map((q, i) => (
              <rect key={i} x={r2(q.x)} y={TOPY} width={r2(q.w)} height={TH} fill={q.p >= 0 ? 'var(--accent)' : 'var(--k1)'} opacity={r2(Math.abs(q.p) * 0.55)} />
            ))}
            {[0.2, 0.5, 0.8].map((v) => dots.map((d, i) => (
              <circle key={`${v}-${i}`} cx={r2(X0 + d.u * L + d.dx)} cy={r2(TOPY + v * TH)} r="2.2" fill="var(--fg)" opacity="0.7" />
            )))}
          </g>
          <rect x={X0} y={TOPY} width={L} height={TH} fill="none" stroke="var(--fg)" strokeWidth="2" />
          <line x1={X0} x2={X0} y1={TOPY - 4} y2={TOPY + TH + 4} stroke={end === 'quarter' ? 'var(--fg)' : 'var(--line-strong)'} strokeWidth={end === 'quarter' ? 8 : 2} />
          <path d={wave} fill="none" stroke="var(--fg)" strokeWidth="2.5" strokeLinejoin="round" />
          <line x1={X0} x2={X0 + L} y1={TOPY + TH / 2} y2={TOPY + TH / 2} stroke="var(--fg)" strokeWidth="1" strokeDasharray="3 4" opacity="0.5" />
          {/* ends of the pipe */}
          <text className="b" x={X0} y={TOPY - 14}>{Tr('เส้นเสียง', 'Vocal folds')}</text>
          <text className="s" x={X0} y={TOPY + TH + 20}>{end === 'quarter' ? Tr('ปลายปิด', 'Closed end') : Tr('ปลายเปิด', 'Open end')}</text>
          <text className="b" x={X0 + L} y={TOPY - 14} textAnchor="end">{Tr('ริมฝีปาก', 'Lips')}</text>
          <text className="s" x={X0 + L} y={TOPY + TH + 20} textAnchor="end">{Tr('ปลายเปิด', 'Open end')}</text>
          {/* the length, and how much of a wave it holds */}
          <line x1={X0} x2={X0 + L} y1={TOPY + TH + 34} y2={TOPY + TH + 34} stroke="var(--muted)" strokeWidth="1.5" />
          <line x1={X0} x2={X0} y1={TOPY + TH + 29} y2={TOPY + TH + 39} stroke="var(--muted)" strokeWidth="1.5" />
          <line x1={X0 + L} x2={X0 + L} y1={TOPY + TH + 29} y2={TOPY + TH + 39} stroke="var(--muted)" strokeWidth="1.5" />
          <text className="b" x={X0 + L / 2} y={TOPY + TH + 52} textAnchor="middle">{len} cm = {end === 'quarter' ? `${2 * n - 1}/4` : `${n}/2`} {Tr('ของความยาวคลื่น', 'of the wavelength')} ({Math.round(lambda)} cm)</text>
          <Axes fr={FR} fMax={FMAX}>
            <text className="b" x={FR.x} y={FR.y - 12}>{Tr('การตอบสนองของท่อ (สูง = ขยายมาก)', 'Response of the tube (high = strongly amplified)')}</text>
            <Clip id="tube-plot" fr={FR}>
              <Curve fr={FR} fMax={FMAX} lo={-8} hi={42} area fn={(hz) => (end === 'quarter' ? tubeGainDb(hz, len, loss) : hz < 150 ? -6 : halfGain(hz, len, loss))} />
              <Markers fr={FR} fMax={FMAX} at={formants.map((hz, i) => ({ hz, text: `F${i + 1}` }))} />
            </Clip>
          </Axes>
          <text className="s" x={FR.x + FR.w} y={FR.y - 12} textAnchor="end">{Tr('ความถี่ (Hz)', 'Frequency (Hz)')}</text>
        </svg>
      </div>
      <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, color: 'var(--muted)', display: 'grid', gap: 2 }}>
        <li>{Tr('ภาพบน: ท่อที่ร้อง resonance ที่เลือก สีชมพูคืออากาศอัดแน่น สีฟ้าคืออากาศโปร่ง จุดคืออากาศที่ขยับไปมา (ช้ากว่าจริงหลายร้อยเท่า)', 'Top picture: the tube at the resonance you chose. Pink is compressed air, blue is rarefied air, and the dots are air moving back and forth (hundreds of times slower than real life).')}</li>
        <li>{Tr('เส้นขาวคือความดันของอากาศตามความยาวท่อ ที่ปลายปิดอากาศชนผนัง ความดันจึงแกว่งแรงที่สุด ที่ปลายเปิดอากาศระบายออกข้างนอกได้ ความดันเลยนิ่งอยู่ที่เส้นกลางเสมอ', 'The white line is the air pressure along the tube. At the closed end the air hits a wall, so the pressure swings the most. At the open end the air can escape outside, so the pressure always stays at the middle line.')}</li>
        <li>{Tr('ภาพล่าง: ถ้าส่งเสียงทุกความถี่เข้าไป ท่อจะขยายเฉพาะความถี่ที่คลื่นพอดีกับความยาวท่อ ยอดแต่ละยอดคือ formant', 'Bottom picture: if you send in sound of every frequency, the tube amplifies only the frequencies whose wave fits the length of the tube. Each peak is a formant.')}</li>
      </ol>
      <div className="viz-now">
        <strong>
          F1 = {Math.round(formants[0])} Hz, F2 = {Math.round(formants[1])} Hz, F3 = {Math.round(formants[2])} Hz, F4 = {Math.round(formants[3])} Hz
        </strong>
        <span style={{ display: 'block' }}>
          {end === 'quarter'
            ? Tr(`สูตร F(n) = (2n − 1) × c ÷ 4L ใช้ c = ${SOUND_SPEED.toLocaleString('en-US')} cm/s ท่อ 17.5 cm ได้ 500, 1500, 2500, 3500 Hz ห่างกันทีละ 1000 Hz ท่อยิ่งยาว formant ยิ่งต่ำและยิ่งถี่`, `The formula is F(n) = (2n − 1) × c ÷ 4L with c = ${SOUND_SPEED.toLocaleString('en-US')} cm/s. A 17.5 cm tube gives 500, 1500, 2500, 3500 Hz, 1000 Hz apart. The longer the tube, the lower and the closer together the formants are.`)
            : Tr(`สูตร F(n) = n × c ÷ 2L ที่ความยาวเท่ากัน F1 สูงเป็นสองเท่าของท่อปิดหนึ่งข้าง เหมือนท่อออร์แกน (organ pipe) ที่เปิดปลายบนให้เสียงสูงกว่าท่อที่ปิดปลายบน`, `The formula is F(n) = n × c ÷ 2L. At the same length, F1 is twice as high as in a tube closed at one end, like an organ pipe that is open at the top, which gives a higher note than a pipe that is closed at the top.`)}
        </span>
        <div className="viz-controls" style={{ marginTop: 8 }}>
          <button type="button" className="btn sm primary" onClick={() => setPlaying((p) => !p)}>{playing ? Tr('หยุดเสียง', 'Stop the sound') : Tr('ฟังเสียงบัซที่ผ่านท่อนี้', 'Hear a buzz passed through this tube')}</button>
        </div>
      </div>
      <p className="viz-caption">{Tr('ช่องเสียงจริงไม่ใช่ท่อตรง กว้างแคบไม่เท่ากัน จึงให้ formant ที่ต่างจากสูตรนี้ แต่ลำดับและแนวโน้ม (ท่อยาวทำให้ formant ต่ำ) ใช้ได้ในการอธิบาย กราฟคำนวณจากท่อที่มีการสูญเสียพลังงานเล็กน้อย จึงเป็นยอดโค้ง ไม่ใช่เส้นแหลม', 'A real vocal tract is not a straight tube. Its width varies, so it gives formants that differ from this formula, but the order and the trend (a long tube lowers the formants) are good enough for explaining. The graph is computed for a tube with a small loss of energy, so the peaks are rounded and not sharp lines.')}</p>
    </figure>
  );
}

/** an open-open tube: |1 / sin(kL)| style response, lossy */
function halfGain(f: number, lengthCm: number, loss: number): number {
  const k = (2 * Math.PI * f) / SOUND_SPEED;
  const kl = k * lengthCm;
  const re = Math.sin(kl) * Math.cosh(kl * loss);
  const im = -Math.cos(kl) * Math.sinh(kl * loss);
  return -20 * Math.log10(Math.max(Math.hypot(re, im), 1e-6));
}
