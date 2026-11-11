import { useEffect, useRef, useState } from 'react';
import { Pills } from '../../music/Controls';
import { VOWELS, formantsOf, midiToHz, noteName, renderVoice, rmsOf, type Sex } from '../../../lib/voice';
import { playVoice, stopVoice } from './voiceAudio';

// Two views of the same idea. mode "map": the vowel chart (F1 against F2, drawn the way the book draws its Vowel Spectrum: bright vowels
// on the left, the jaw more open lower down). Press a vowel, or press anywhere, to hear it. mode "modify": why a soprano must change the
// vowel as the pitch rises (the note should stay just below F1, not cross it) and what that does to the loudness of the synthesized note.

const F2_LO = 700;
const F2_HI = 2900;
const F1_LO = 200;
const F1_HI = 950;
const W = 560;
const H = 380;
const X0 = 50;
const Y0 = 20;
const PW = W - X0 - 16;
const PH = H - Y0 - 40;
const px = (f2: number) => X0 + ((F2_HI - f2) / (F2_HI - F2_LO)) * PW;
const py = (f1: number) => Y0 + ((f1 - F1_LO) / (F1_HI - F1_LO)) * PH;
const fromX = (x: number) => F2_HI - ((x - X0) / PW) * (F2_HI - F2_LO);
const fromY = (y: number) => F1_LO + ((y - Y0) / PH) * (F1_HI - F1_LO);

const MAP_KEYS = ['i', 'ɪ', 'e', 'ɛ', 'æ', 'ɑ', 'ɔ', 'o', 'ʊ', 'u', 'ʌ', 'ə'];

function speak(f: number[], sex: Sex) {
  const x = renderVoice({ seconds: 0.9, f0: midiToHz(sex === 'male' ? 50 : 62), formants: f, closure: 4, rms: 0.1 });
  playVoice(x);
}

export function VowelMap({ lang = 'th' }: { lang?: 'th' | 'en' }) {
  const L = (th: string, en: string) => (lang === 'en' ? en : th);
  const [sex, setSex] = useState<Sex>('male');
  const [pick, setPick] = useState<string>('ɑ');
  const [free, setFree] = useState<[number, number] | null>(null);
  const drag = useRef(false);
  const formants = free
    ? (() => {
        // F3 of a free point: the F3 of the nearest vowels, weighted by distance in the F1 and F2 plane
        let num = 0;
        let den = 0;
        for (const k of MAP_KEYS) {
          const v = VOWELS[k][sex];
          const d = Math.hypot((v[0] - free[1]) / 300, (v[1] - free[0]) / 700) + 0.05;
          num += v[2] / d / d;
          den += 1 / d / d;
        }
        return [free[1], free[0], num / den, ...formantsOf('ɑ', sex).slice(3)];
      })()
    : formantsOf(pick, sex);
  const at = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    const sy = ((e.clientY - r.top) / r.height) * H;
    const f2 = Math.min(F2_HI, Math.max(F2_LO, fromX(sx)));
    const f1 = Math.min(F1_HI, Math.max(F1_LO, fromY(sy)));
    return [Math.round(f2), Math.round(f1)] as [number, number];
  };
  useEffect(() => () => stopVoice(), []);

  return (
    <figure className="viz">
      <div className="viz-title">{L('แผนที่สระ: F1 กับ F2', 'The vowel map: F1 and F2')}</div>
      <Pills<Sex> label={L('เสียง', 'Voice')} value={sex} onChange={setSex} options={[{ value: 'male', text: L('ผู้ชาย', 'Man') }, { value: 'female', text: L('ผู้หญิง', 'Woman') }]} />
      <div className="viz-box" style={{ overflowX: 'visible' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={L('แผนที่สระ แกนนอนคือ F2 กลับด้าน แกนตั้งคือ F1 กดจุดใดก็ได้เพื่อฟังสระที่ค่า formant นั้น', 'The vowel map. The horizontal axis is F2, reversed, and the vertical axis is F1. Press any point to hear the vowel at those formant values.')}
          style={{ width: '100%', minWidth: 0, touchAction: 'none', cursor: 'crosshair' }}
          onPointerDown={(e) => {
            drag.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            setFree(at(e));
          }}
          onPointerMove={(e) => drag.current && setFree(at(e))}
          onPointerUp={(e) => {
            drag.current = false;
            const p = at(e);
            setFree(p);
            speak([p[1], p[0], formants[2], ...formantsOf('ɑ', sex).slice(3)], sex);
          }}
        >
          <rect x={X0} y={Y0} width={PW} height={PH} fill="var(--surface)" stroke="var(--line-strong)" rx="6" />
          {[1000, 1500, 2000, 2500].map((f) => (
            <g key={f}>
              <line x1={px(f)} x2={px(f)} y1={Y0} y2={Y0 + PH} stroke="var(--line)" />
              <text className="s" x={px(f)} y={Y0 + PH + 14} textAnchor="middle">{f}</text>
            </g>
          ))}
          {[300, 500, 700, 900].map((f) => (
            <g key={f}>
              <line x1={X0} x2={X0 + PW} y1={py(f)} y2={py(f)} stroke="var(--line)" />
              <text className="s" x={X0 - 6} y={py(f) + 4} textAnchor="end">{f}</text>
            </g>
          ))}
          <text className="s" x={X0 + PW} y={H - 4} textAnchor="end">{L('F2 (Hz) ← ลิ้นไปหน้า | ลิ้นไปหลัง →', 'F2 (Hz) ← tongue forward | tongue back →')}</text>
          <text className="s" x={6} y={Y0 + 6}>{L('F1 ↑ กรามปิด', 'F1 ↑ jaw closed')}</text>
          <text className="s" x={6} y={Y0 + PH}>{L('↓ กรามเปิด', '↓ jaw open')}</text>
          {MAP_KEYS.map((k) => {
            const v = VOWELS[k][sex];
            return (
              <g
                key={k}
                style={{ cursor: 'pointer' }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setFree(null);
                  setPick(k);
                  speak(formantsOf(k, sex), sex);
                }}
              >
                <circle cx={px(v[1])} cy={py(v[0])} r={pick === k && !free ? 17 : 14} fill={pick === k && !free ? 'var(--accent)' : 'var(--accent-soft)'} stroke="var(--accent)" strokeWidth="2" />
                <text x={px(v[1])} y={py(v[0]) + 5} textAnchor="middle" fontSize="15" style={{ fill: pick === k && !free ? 'var(--on-accent)' : 'var(--fg)', fontWeight: 600 }}>{k}</text>
              </g>
            );
          })}
          {free && <circle cx={px(free[0])} cy={py(free[1])} r="6" fill="none" stroke="var(--fg)" strokeWidth="2" />}
        </svg>
      </div>
      <div className="viz-now" aria-live="polite">
        <strong>
          {free ? L('จุดที่เลือกเอง', 'A point you chose') : L(`[${pick}] ${VOWELS[pick].thai} (เหมือนในคำว่า ${VOWELS[pick].word})`, `[${pick}] (as in "${VOWELS[pick].word}")`)}: F1 {Math.round(formants[0])} Hz, F2 {Math.round(formants[1])} Hz, F3 {Math.round(formants[2])} Hz
        </strong>
        <span style={{ display: 'block' }}>
          {L('F1 ต่ำหมายถึงกรามค่อนข้างปิดและลิ้นสูง ส่วน F2 สูงหมายถึงลิ้นเคลื่อนไปข้างหน้า [i] จึงอยู่ซ้ายบน [ɑ] อยู่ขวาล่าง และ [u] อยู่ขวาบน คุณสามารถลาก (หรือกด) บนแผนภาพเพื่อฟังสระที่อยู่ระหว่างกลางได้', 'A low F1 means the jaw is fairly closed and the tongue is high, and a high F2 means the tongue has moved forward. So [i] is at the upper left, [ɑ] at the lower right, and [u] at the upper right. Drag (or press) on the chart to hear the vowels in between.')}
        </span>
        <div className="viz-controls" style={{ marginTop: 8 }}>
          <button type="button" className="btn sm primary" onClick={() => speak(formants, sex)}>{L('ฟังอีกครั้ง', 'Listen again')}</button>
        </div>
      </div>
      <p className="viz-caption">{L('ค่า F1 ถึง F3 ของ i ɪ ɛ æ ɑ ɔ ʊ u ʌ เป็นค่าเฉลี่ยของ Peterson และ Barney (1952) ส่วน e o ə เป็นค่าที่ผู้เขียนบทเรียนกำหนดจากสระข้างเคียงและท่อเสียงมาตรฐาน เสียงที่ได้ยินเป็นเสียงสังเคราะห์ที่ Pitch คงที่', 'The F1 to F3 values of i ɪ ɛ æ ɑ ɔ ʊ u ʌ are the averages of Peterson and Barney (1952). The values for e o ə were set by the author of the lesson from the neighboring vowels and the standard vocal tract. The sound is synthesized at a fixed pitch.')}</p>
    </figure>
  );
}

// ---------------------------------------------------------------------------------------------------------------

const NOTES = [70, 74, 77, 81, 84]; // B♭4, D5, F5, A5, C6

export function VowelModify({ lang = 'th' }: { lang?: 'th' | 'en' }) {
  const L = (th: string, en: string) => (lang === 'en' ? en : th);
  const [vowel, setVowel] = useState('e');
  const [playing, setPlaying] = useState<'fixed' | 'tuned' | null>(null);
  const [result, setResult] = useState<{ fixed: number[]; tuned: number[]; f1Fixed: number; xs: Float32Array[]; ys: Float32Array[] } | null>(null);

  const base = formantsOf(vowel, 'female');
  const f1Of = (m: number, tuned: boolean) => (tuned ? Math.min(1500, Math.max(base[0], 1.18 * midiToHz(m))) : base[0]);

  useEffect(() => {
    const make = (tuned: boolean) =>
      NOTES.map((m) => {
        const f = [...base];
        f[0] = f1Of(m, tuned);
        return renderVoice({ seconds: 0.55, f0: midiToHz(m), formants: f, closure: 4, register: 1, level: 1, seed: 2 });
      });
    const xs = make(false);
    const ys = make(true);
    const db = (a: Float32Array[]) => a.map((s) => 20 * Math.log10(rmsOf(s.subarray(2000, 14000))));
    const fx = db(xs);
    const ty = db(ys);
    const ref = fx[0];
    setResult({ fixed: fx.map((v) => v - ref), tuned: ty.map((v) => v - ref), f1Fixed: base[0], xs, ys });
  }, [vowel]);
  useEffect(() => {
    if (!playing || !result) {
      stopVoice();
      return;
    }
    const parts = playing === 'fixed' ? result.xs : result.ys;
    const all = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0;
    parts.forEach((p) => {
      all.set(p, o);
      o += p.length;
    });
    let peak = 0;
    for (let i = 0; i < all.length; i += 7) peak = Math.max(peak, Math.abs(all[i]));
    for (let i = 0; i < all.length; i++) all[i] *= 0.25 / Math.max(peak, 1e-6);
    playVoice(all);
    const id = setTimeout(() => setPlaying(null), all.length / 32 + 150);
    return () => clearTimeout(id);
  }, [playing, result]);
  useEffect(() => () => stopVoice(), []);

  const CW = 520;
  const CH = 230;
  const cx = (i: number) => 60 + (i / (NOTES.length - 1)) * (CW - 100);
  const cy = (f: number) => 14 + (1 - f / 1500) * (CH - 50);

  return (
    <figure className="viz">
      <div className="viz-title">{L('Soprano ขึ้นสูง ให้โน้ตอยู่ใต้ F1 อย่าข้ามมัน', 'A soprano going high: the note should stay under F1, not cross it')}</div>
      <Pills<string> label={L('สระ', 'Vowel')} value={vowel} onChange={setVowel} options={['e', 'ɑ', 'i', 'u'].map((k) => ({ value: k, text: L(`[${k}] ${VOWELS[k].thai}`, `[${k}] "${VOWELS[k].word}"`) }))} />
      <div className="viz-box" style={{ overflowX: 'visible' }}>
        <svg viewBox={`0 0 ${CW} ${CH}`} role="img" aria-label={L('ความถี่ของโน้ตเทียบกับ F1 แบบไม่ปรับและแบบปรับตามโน้ต', 'The frequency of the note compared with F1, left unchanged and tuned with the note')} style={{ width: '100%', minWidth: 0 }}>
          <rect x="40" y="14" width={CW - 56} height={CH - 50} fill="var(--surface)" stroke="var(--line-strong)" rx="6" />
          {[0, 500, 1000, 1500].map((f) => (
            <g key={f}>
              <line x1="40" x2={CW - 16} y1={cy(f)} y2={cy(f)} stroke="var(--line)" />
              <text className="s" x="36" y={cy(f) + 4} textAnchor="end">{f}</text>
            </g>
          ))}
          <polyline points={NOTES.map((m, i) => `${cx(i)},${cy(midiToHz(m))}`).join(' ')} fill="none" stroke="var(--fg)" strokeWidth="3" />
          <polyline points={NOTES.map((m, i) => `${cx(i)},${cy(f1Of(m, false))}`).join(' ')} fill="none" stroke="var(--wrong)" strokeWidth="3" strokeDasharray="6 4" />
          <polyline points={NOTES.map((m, i) => `${cx(i)},${cy(f1Of(m, true))}`).join(' ')} fill="none" stroke="var(--brand)" strokeWidth="3" />
          {NOTES.map((m, i) => (
            <g key={m}>
              <circle cx={cx(i)} cy={cy(midiToHz(m))} r="5" fill="var(--fg)" />
              <text className="s" x={cx(i)} y={CH - 20} textAnchor="middle">{noteName(m)}</text>
              {midiToHz(m) > base[0] && <text x={cx(i)} y={cy(midiToHz(m)) - 10} textAnchor="middle" fontSize="11" fill="var(--wrong)">{L('ข้าม F1', 'crosses F1')}</text>}
            </g>
          ))}
          <text className="s" x="44" y="28">{L('เส้นดำ: โน้ต (f0)  เส้นประแดง: F1 ของสระปกติ  เส้นเขียว: F1 ที่ปรับให้อยู่เหนือโน้ตเล็กน้อย', 'Black line: the note (f0)  Red dashed line: F1 of the normal vowel  Green line: F1 tuned to sit a little above the note')}</text>
        </svg>
      </div>
      {result && (
        <div className="viz-now">
          <strong>{L('ความดังของเสียงสังเคราะห์ (dB เทียบกับโน้ตแรก)', 'Loudness of the synthesized sound (dB relative to the first note)')}</strong>
          <table style={{ borderCollapse: 'collapse', margin: '6px 0', fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '2px 10px 2px 0' }}></th>
                {NOTES.map((m) => <th key={m} style={{ padding: '2px 10px' }}>{noteName(m)}</th>)}
              </tr>
            </thead>
            <tbody>
              {([[L('ไม่ปรับสระ', 'Vowel not adjusted'), result.fixed], [L('ปรับสระ (F1 เหนือโน้ต)', 'Vowel adjusted (F1 above the note)'), result.tuned]] as [string, number[]][]).map(([n, v]) => (
                <tr key={n}>
                  <td style={{ padding: '2px 10px 2px 0' }}>{n}</td>
                  {v.map((d, i) => <td key={i} style={{ padding: '2px 10px', textAlign: 'center', fontFamily: 'var(--mono)' }}>{d >= 0 ? '+' : ''}{d.toFixed(1)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="viz-controls">
            <button type="button" className="btn sm" onClick={() => setPlaying('fixed')}>{L('ฟังแบบไม่ปรับสระ', 'Hear it without adjusting the vowel')}</button>
            <button type="button" className="btn sm primary" onClick={() => setPlaying('tuned')}>{L('ฟังแบบปรับสระ', 'Hear it with the vowel adjusted')}</button>
          </div>
        </div>
      )}
      <p className="viz-caption">
        {L('เมื่อโน้ตสูงกว่า F1 ของสระ ตัวกรองของช่องเสียงจะไม่ขยาย Harmonic แรกอีกต่อไป เสียงจึงเบาลง และ (ในคนจริง) เสียงอาจแตกหรือเปลี่ยนสีได้ การปรับสระคือการลดกรามด้านหลังเพื่อให้ F1 ขึ้นไปอยู่เหนือโน้ตเล็กน้อย ตามที่ Davids และ LaTour บทที่ 4 อธิบายไว้ ส่วนตัวเลขความดังมาจากแบบจำลองเสียงสังเคราะห์ ซึ่งไม่ได้วัดจากนักร้องจริง และค่า F1 ที่ปรับเป็น 1.18 เท่าของโน้ต (สูงสุด 1500 Hz) ก็เป็นค่าที่ผู้เขียนบทเรียนเลือกเอง เพื่อใช้แสดงแนวคิด', 'When the note is higher than the F1 of the vowel, the filter of the vocal tract no longer amplifies the first harmonic, the sound gets softer, and (in a real person) the voice may break or change color. Adjusting the vowel means lowering the back of the jaw so that F1 sits a little above the note, as Davids and LaTour describe in chapter 4. The loudness numbers come from a synthesized-sound model and are not measured from real singers. The tuned F1 of 1.18 times the note (at most 1500 Hz) is a value the author of the lesson chose to show the idea.')}
      </p>
    </figure>
  );
}

export default VowelMap;
