import { useEffect, useMemo, useState } from 'react';
import { Pills, Slider } from '../../music/Controls';
import { formantsOf, midiToHz, noteName, renderVoice, vibratoCents } from '../../../lib/voice';
import { playVoice, stopVoice } from './voiceAudio';

// Vibrato has a rate (waves per second) and an extent (how far the pitch swings, top to bottom, in cents; 100 cents is a half step).
// Davids and LaTour, chapter 7: rates fall between 5 and 8 per second, a pleasing extent is about 100 cents in total (a quarter step above and
// below), 200 cents is too much, and terminal vibrato (a straight tone that opens into vibrato at the end of the note) is common in
// contemporary styles. The curve is the pitch the synthesized note really has; the sound is the same note.

const DUR = 3;
const PRESETS: { key: string; text: string; rate: number; extent: number; terminal: boolean; note: string }[] = [
  { key: 'classical', text: 'คลาสสิก', rate: 6, extent: 100, terminal: false, note: 'สม่ำเสมอ ขนาดปานกลาง' },
  { key: 'opera', text: 'โอเปร่าเดี่ยว', rate: 5.5, extent: 150, terminal: false, note: 'ช้าลงและกว้างขึ้น (เฉลี่ยราว 150 cents ในงานวิจัยหนึ่ง)' },
  { key: 'belt', text: 'Belt / ร็อก', rate: 6, extent: 100, terminal: true, note: 'แทบไม่มีจนถึงปลายโน้ต (terminal vibrato)' },
  { key: 'jazz', text: 'แจ๊ส', rate: 6, extent: 60, terminal: false, note: 'แคบกว่าคลาสสิก' },
  { key: 'straight', text: 'เกือบไม่มี (minimal)', rate: 6, extent: 20, terminal: false, note: 'ไม่มี "straight tone" จริง มีแค่ vibrato ที่เล็กมาก' },
];

const PRESETS_EN: Record<string, { text: string; note: string }> = {
  classical: { text: 'Classical', note: 'Regular, a moderate size' },
  opera: { text: 'Solo opera', note: 'Slower and wider (about 150 cents on average in one study)' },
  belt: { text: 'Belt / rock', note: 'Hardly any until the end of the note (terminal vibrato)' },
  jazz: { text: 'Jazz', note: 'Narrower than classical' },
  straight: { text: 'Almost none (minimal)', note: 'There is no true "straight tone," only a very small vibrato' },
};

const W = 540;
const H = 190;

export default function VibratoLab({ lang = 'th' }: { lang?: 'th' | 'en' }) {
  const L = (th: string, en: string) => (lang === 'en' ? en : th);
  const [rate, setRate] = useState(6);
  const [extent, setExtent] = useState(100);
  const [terminal, setTerminal] = useState(false);
  const [midi, setMidi] = useState(57);
  const [playing, setPlaying] = useState<'vib' | 'plain' | null>(null);

  const curve = useMemo(() => {
    const pts: string[] = [];
    for (let i = 0; i <= 600; i++) {
      const t = (i / 600) * DUR;
      const c = vibratoCents(t, DUR, { rate, extent, terminal });
      pts.push(`${i ? 'L' : 'M'}${(40 + (i / 600) * (W - 56)).toFixed(1)},${(H / 2 - (c / 150) * (H / 2 - 16)).toFixed(1)}`);
    }
    return pts.join(' ');
  }, [rate, extent, terminal]);

  useEffect(() => {
    if (!playing) {
      stopVoice();
      return;
    }
    const x = renderVoice({
      seconds: DUR,
      f0: midiToHz(midi),
      formants: formantsOf('ɑ', midi >= 60 ? 'female' : 'male'),
      closure: 4,
      rms: 0.1,
      vibrato: playing === 'vib' ? { rate, extent, terminal } : undefined,
      jitter: 0.001,
    });
    playVoice(x);
    const id = setTimeout(() => setPlaying(null), DUR * 1000 + 100);
    return () => clearTimeout(id);
  }, [playing]);
  useEffect(() => () => stopVoice(), []);

  const rateNote = rate < 5 ? L('ช้ากว่า 5 ต่อวินาที เริ่มได้ยินเป็นการโยกของโน้ตแต่ละครั้ง (wobble)', 'Slower than 5 per second, you begin to hear each swing of the note (a wobble)') : rate < 6 ? L('ช้าเล็กน้อย ยังอยู่ในช่วง 5 ถึง 8 ที่พบในนักร้อง', 'A little slow, but still within the 5 to 8 found in singers') : rate <= 8 ? L('อยู่ในช่วง 6 ถึง 8 ที่ Miller เรียกว่าน่าฟัง', 'Within the 6 to 8 that Miller calls pleasing') : L('เร็วเกิน 8 ต่อวินาที ได้ยินเป็นการสั่น (tremulous)', 'Faster than 8 per second, it sounds like a shake (tremulous)');
  const extNote = extent < 40 ? L('น้อยจนผู้ฟังแทบไม่รู้ว่ามี vibrato แต่ยังมีผลต่อสีเสียง', 'So small that the listener hardly knows there is vibrato, but it still affects the tone color') : extent <= 110 ? L('ราว 100 cents คือขนาดที่ผู้ฟังรับรู้เป็นสีเสียงที่สมบูรณ์ ไม่ได้ยินเป็นสองโน้ตสลับกัน', 'About 100 cents is the size at which the listener perceives a full tone color and does not hear two alternating notes') : extent <= 160 ? L('กว้างพอที่ผู้ฟังหลายคนได้ยินว่าเป็น vibrato (นักร้องโอเปร่าเดี่ยวใช้ขนาดนี้)', 'Wide enough that many listeners hear it as vibrato (solo opera singers use this size)') : L('กว้างเกิน 150 cents หนังสือเห็นว่า 200 cents มากเกินไปแม้ในโอเปร่า', 'Wider than 150 cents. The book considers 200 cents too much, even in opera');

  return (
    <figure className="viz">
      <div className="viz-title">{L('Vibrato: ความเร็วและความกว้าง', 'Vibrato: rate and extent')}</div>
      <Pills<string>
        label={L('ตัวอย่างตามสไตล์', 'Examples by style')}
        value={PRESETS.find((p) => p.rate === rate && p.extent === extent && p.terminal === terminal)?.key ?? ''}
        onChange={(k) => {
          const p = PRESETS.find((q) => q.key === k)!;
          setRate(p.rate);
          setExtent(p.extent);
          setTerminal(p.terminal);
        }}
        options={PRESETS.map((p) => ({ value: p.key, text: lang === 'en' ? PRESETS_EN[p.key].text : p.text }))}
      />
      <div className="viz-box" style={{ overflowX: 'visible' }}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={L('เส้นระดับเสียงของโน้ตที่มี vibrato ในสามวินาที', 'The pitch line of a note with vibrato over three seconds')} style={{ width: '100%', minWidth: 0 }}>
          <rect x="40" y="8" width={W - 56} height={H - 28} fill="var(--surface)" stroke="var(--line-strong)" rx="6" />
          <rect x="40" y={H / 2 - (50 / 150) * (H / 2 - 16)} width={W - 56} height={(100 / 150) * (H / 2 - 16)} fill="var(--accent-soft)" />
          <line x1="40" x2={W - 16} y1={H / 2} y2={H / 2} stroke="var(--line-strong)" strokeDasharray="4 4" />
          {[-100, -50, 50, 100].map((c) => (
            <text key={c} className="s" x="36" y={H / 2 - (c / 150) * (H / 2 - 16) + 4} textAnchor="end">{c > 0 ? `+${c}` : c}</text>
          ))}
          <text className="s" x="36" y={H / 2 + 4} textAnchor="end">0</text>
          <path d={curve} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" />
          <text className="s" x={W - 20} y="22" textAnchor="end">{L('แถบสีคือ ±50 cents (รวม 100 cents)', 'The colored band is ±50 cents (100 cents in total)')}</text>
          <text className="s" x={W - 16} y={H - 4} textAnchor="end">{DUR} {L('วินาที', 's')}</text>
          <text className="s" x="44" y={H - 4}>{L('cents จากโน้ตกลาง', 'cents from the center note')}</text>
        </svg>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <Slider label={L('ความเร็ว', 'Rate')} value={rate} min={3} max={10} step={0.5} unit={L(' ครั้ง/วินาที', ' per second')} onChange={setRate} />
        <Slider label={L('ความกว้าง', 'Extent')} value={extent} min={0} max={250} step={10} unit=" cents" onChange={setExtent} />
        <Slider label={`${L('โน้ต', 'Note')} ${noteName(midi)}`} value={midi} min={45} max={72} onChange={setMidi} />
        <Pills<string> label={L('รูปแบบ', 'Shape')} value={terminal ? 'terminal' : 'steady'} onChange={(v) => setTerminal(v === 'terminal')} options={[{ value: 'steady', text: L('สม่ำเสมอตลอดโน้ต', 'Steady through the note') }, { value: 'terminal', text: L('Terminal (เริ่มช้าและบานตอนท้าย)', 'Terminal (starts straight and blooms at the end)') }]} />
      </div>
      <div className="viz-now" aria-live="polite">
        <strong>{rate} {L('ครั้ง/วินาที', 'per second')}, {extent} cents</strong>
        <span style={{ display: 'block' }}>{rateNote}</span>
        <span style={{ display: 'block' }}>{extNote}</span>
        <div className="viz-controls" style={{ marginTop: 8 }}>
          <button type="button" className="btn sm primary" onClick={() => setPlaying('vib')}>{L('ฟังโน้ตที่มี vibrato นี้', 'Hear the note with this vibrato')}</button>
          <button type="button" className="btn sm" onClick={() => setPlaying('plain')}>{L('ฟังโน้ตเดียวกันไม่มี vibrato', 'Hear the same note without vibrato')}</button>
        </div>
      </div>
      <p className="viz-caption">{L('ช่วง 5 ถึง 8 ครั้งต่อวินาที และความกว้าง 100 cents มาจาก Davids และ LaTour บทที่ 7 (อ้าง Miller, Seashore และงานอื่น) ส่วน Titze รายงานว่านักร้องคนหนึ่งมี vibrato เฉลี่ย 5.6 ครั้งต่อวินาที ซึ่งใกล้ความถี่ธรรมชาติของกล้ามเนื้อ CT ที่วัดได้ราว 5 Hz โน้ตในแล็บนี้เป็นเสียงสังเคราะห์ที่เปลี่ยน pitch ตามเส้นโค้งจริงๆ', 'The range of 5 to 8 per second and the extent of 100 cents come from Davids and LaTour, chapter 7 (citing Miller, Seashore and others). Titze reports a singer with an average vibrato of 5.6 per second, close to the natural frequency of the CT muscle that was measured at about 5 Hz. The note in this lab is a synthesized sound whose pitch really follows the curve.')}</p>
    </figure>
  );
}
