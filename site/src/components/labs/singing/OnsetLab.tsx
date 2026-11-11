import { useEffect, useState } from 'react';
import { Pills } from '../../music/Controls';
import { SR, formantsOf, midiToHz, noteName, renderVoice, type OnsetKind } from '../../../lib/voice';
import { detectPitch } from '../../../lib/pitch';
import { playVoice, stopVoice } from './voiceAudio';

// The three ways to start a note (Davids and LaTour, chapter 3, "Method of initiating sound affects glottal tension"):
// a breathy onset (air first, folds close late), a coordinated onset (air and closure together), a glottal onset (folds shut and pressed,
// then burst open). Each row is the waveform of a synthesized note and, under it, the pitch that a pitch detector hears in that sound.

interface Row {
  kind: OnsetKind;
  title: string;
  what: string;
  sing: string;
  hear: string;
}

const ROWS: Row[] = [
  { kind: 'breathy', title: 'Breathy onset', what: 'หายใจออกก่อน แล้วเส้นเสียงถึงค่อยปิด', sing: 'Ha, ha, ha: ค้างที่ "h" ไว้สักครู่ จะรู้สึกได้ว่าลมออกไปก่อน', hear: 'เราจะได้ยินเสียงลมนำหน้ามาก่อน โน้ตเข้าช้า และลมก็เปลืองจนร้องประโยคยาว ๆ ไม่ไหว' },
  { kind: 'coordinated', title: 'Coordinated onset (แนะนำ)', what: 'ลมกับการปิดเส้นเสียงเริ่มพร้อมกัน', sing: 'Ah, ah, ah: ลองนึกภาพว่าเรากำลังดึงผ้าเช็ดหน้าออกจากกล่องอย่างนุ่มนวล', hear: 'โน้ตเข้าตรงและนุ่ม โดยไม่มีเสียงอะไรนำหน้ามาก่อน' },
  { kind: 'glottal', title: 'Glottal onset (กระแทก)', what: 'ปิดเส้นเสียงให้แน่นก่อน แล้วค่อยดันลมให้ระเบิดออกมา', sing: 'Uh, uh, uh: เหมือนกับไอเบา ๆ ตอนเริ่มเสียง', hear: 'เราจะได้ยินเสียงปะทุตอนเริ่ม และเสียงจะเริ่มต่ำกว่าโน้ตก่อนแล้วค่อยไต่ขึ้นไป' },
];

const ROWS_EN: Record<OnsetKind, { title: string; what: string; sing: string; hear: string }> = {
  breathy: { title: 'Breathy onset', what: 'The air starts first and the vocal folds close later', sing: 'Ha, ha, ha: linger on the "h" to feel the air come out first', hear: 'You hear the air before the note. The note arrives late and the air is wasted, so you cannot sing a long phrase.' },
  coordinated: { title: 'Coordinated onset (recommended)', what: 'The air and the closing of the vocal folds start together', sing: 'Ah, ah, ah: picture pulling a handkerchief smoothly out of a box', hear: 'The note arrives on pitch and soft, with no sound before it.' },
  glottal: { title: 'Glottal onset (hit)', what: 'The vocal folds close firmly first and then the air bursts them open', sing: 'Uh, uh, uh: like a light cough at the start of the sound', hear: 'You hear a pop at the start, and the sound begins below the note and climbs up.' },
};

const DUR = 0.9;
const MIDI = 55; // G3

export default function OnsetLab({ lang = 'th' }: { lang?: 'th' | 'en' }) {
  const L = (th: string, en: string) => (lang === 'en' ? en : th);
  const rows: Row[] = lang === 'en' ? ROWS.map((r) => ({ ...r, ...ROWS_EN[r.kind] })) : ROWS;
  const [midi, setMidi] = useState(MIDI);
  const f0 = midiToHz(midi);
  const [playing, setPlaying] = useState<OnsetKind | null>(null);

  // the notes are made in the browser after the page has loaded (the server draws only the empty frames)
  const [data, setData] = useState<{ x: Float32Array; env: [number, number][]; trace: { t: number; c: number | null }[] }[] | null>(null);
  useEffect(() => {
    setData(
      ROWS.map((r) => {
      const x = renderVoice({ seconds: DUR, f0, formants: formantsOf('ɑ'), closure: 4, onset: r.kind, rms: 0.12, seed: 3, jitter: 0.001 });
      // loudness envelope (min and max in 3 ms slices) and pitch trace in cents from the note
      const slice = Math.round(0.003 * SR);
      const env: [number, number][] = [];
      for (let s = 0; s + slice <= x.length; s += slice) {
        let lo = 1;
        let hi = -1;
        for (let i = s; i < s + slice; i++) {
          lo = Math.min(lo, x[i]);
          hi = Math.max(hi, x[i]);
        }
        env.push([lo, hi]);
      }
      const trace: { t: number; c: number | null }[] = [];
      const frame = 1024;
      for (let s = 0; s + frame < x.length; s += 320) {
        const p = detectPitch(x.subarray(s, s + frame), SR, 70, 600, 0.01);
        trace.push({ t: (s + frame / 2) / SR, c: p.freq && p.clarity > 0.8 ? 1200 * Math.log2(p.freq / f0) : null });
      }
      return { x, env, trace };
      }),
    );
  }, [f0]);

  useEffect(() => {
    if (!playing) {
      stopVoice();
      return;
    }
    const i = ROWS.findIndex((r) => r.kind === playing);
    if (!data) return;
    playVoice(data[i].x);
    const id = setTimeout(() => setPlaying(null), DUR * 1000 + 100);
    return () => clearTimeout(id);
  }, [playing, data]);
  useEffect(() => () => stopVoice(), []);

  const W = 520;
  const H = 70;
  const PH = 46;
  return (
    <figure className="viz">
      <div className="viz-title">{L('สามวิธีเริ่มเสียงเดียวกัน', 'Three ways to start the same note')}</div>
      <div className="viz-box" style={{ overflowX: 'visible' }}>
        <div style={{ display: 'grid', gap: 18 }}>
          {rows.map((r, ri) => {
            const d = data?.[ri] ?? { x: new Float32Array(0), env: [] as [number, number][], trace: [] as { t: number; c: number | null }[] };
            const path = d.env.map(([lo, hi], i) => `M${((i / d.env.length) * W).toFixed(1)},${(H / 2 - hi * (H / 2 - 2) * 2.2).toFixed(1)} L${((i / d.env.length) * W).toFixed(1)},${(H / 2 - lo * (H / 2 - 2) * 2.2).toFixed(1)}`).join(' ');
            const tracePts = d.trace.filter((p) => p.c !== null);
            const tp = tracePts.map((p, i) => `${i ? 'L' : 'M'}${((p.t / DUR) * W).toFixed(1)},${(PH / 2 - Math.max(-150, Math.min(150, p.c!)) * (PH / 2 - 3) / 150).toFixed(1)}`).join(' ');
            return (
              <div key={r.kind} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 220px) 1fr', gap: 14, alignItems: 'center' }}>
                <div>
                  <strong>{r.title}</strong>
                  <div style={{ fontSize: 14, color: 'var(--muted)' }}>{r.what}</div>
                  <button type="button" className="btn sm primary" style={{ marginTop: 8 }} onClick={() => setPlaying(playing === r.kind ? null : r.kind)}>
                    {playing === r.kind ? L('กำลังเล่น', 'Playing') : L('ฟัง', 'Listen')}
                  </button>
                </div>
                <svg viewBox={`0 0 ${W} ${H + PH + 18}`} role="img" aria-label={L(`รูปคลื่นเสียงและเส้นระดับเสียงของ ${r.title}`, `Waveform and pitch line of the ${r.title}`)} style={{ width: '100%', minWidth: 0, background: 'var(--surface)', border: '1.5px solid var(--line)', borderRadius: 8 }}>
                  <path d={path} stroke="var(--accent)" strokeWidth="1.2" fill="none" />
                  <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="var(--line)" />
                  <g transform={`translate(0 ${H + 6})`}>
                    <line x1="0" x2={W} y1={PH / 2} y2={PH / 2} stroke="var(--line-strong)" strokeDasharray="4 4" />
                    <path d={tp} stroke="var(--k1)" strokeWidth="2.5" fill="none" />
                    <text className="s" x="4" y="10">{L('ระดับเสียงที่ตรวจพบ (เส้นประคือโน้ตที่ตั้งใจ, ±150 cents)', 'Pitch that was detected (the dashed line is the intended note, ±150 cents)')}</text>
                  </g>
                  <text className="s" x={W - 4} y={H + PH + 14} textAnchor="end">{DUR} {L('วินาที', 's')}</text>
                </svg>
              </div>
            );
          })}
        </div>
      </div>
      <Pills<number> label={L('โน้ต', 'Note')} value={midi} onChange={setMidi} options={[43, 48, 55, 60, 67].map((m) => ({ value: m, text: noteName(m) }))} />
      <div className="viz-now">
        {rows.map((r) => (
          <span key={r.kind} style={{ display: 'block', marginBottom: 6 }}><b style={{ color: 'var(--fg)' }}>{r.title.replace(/ \(.*\)/, '')}</b> {r.hear} {L('ลองร้อง:', 'Try singing:')} {r.sing}</span>
        ))}
      </div>
      <p className="viz-caption">{L('เสียงในแล็บนี้สังเคราะห์ขึ้นมาเพื่อแสดงลักษณะของแต่ละวิธี จึงไม่ได้เป็นเสียงที่บันทึกมาจากคนจริง ๆ นะ การเริ่มเสียงแบบ Glottal ในแบบจำลองจะมีเสียงปะทุและเริ่มต่ำกว่าโน้ตเล็กน้อย ซึ่งตรงกับที่หนังสือบอกว่าเกิดขึ้นได้ แต่ก็ไม่ได้หมายความว่าทุกคนที่เริ่มเสียงแบบนี้จะออกมาเหมือนกันหมด','The sounds in this lab are synthesized to show the character of each method. They are not recordings of real people. The glottal onset in the model has a pop and starts a little below the note, which matches what the book says can happen. It does not mean that everyone who starts a sound this way will sound the same.')}</p>
    </figure>
  );
}
