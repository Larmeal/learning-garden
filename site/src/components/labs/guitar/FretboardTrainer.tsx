import { useEffect, useState } from 'react';
import Fretboard from '../../music/Fretboard';
import { Pills } from '../../music/Controls';
import { pluck } from '../../music/audio';
import { SHARP_NAMES, STRING_NAMES, mod12, noteNameOfMidi, pitchAt, type Mark } from '../../../lib/music';

// Three ways to look at the neck: where one note lives, every natural note, and a drill that asks for a note on a string.

type Mode = 'one' | 'naturals' | 'drill';
const NATURAL_PCS = [0, 2, 4, 5, 7, 9, 11];
const FRETS = 12;

interface Target { string: number; pc: number }
const newTarget = (): Target => ({ string: Math.floor(Math.random() * 6), pc: NATURAL_PCS[Math.floor(Math.random() * 7)] });

export default function FretboardTrainer() {
  const [mode, setMode] = useState<Mode>('one');
  const [pc, setPc] = useState(0);
  const [target, setTarget] = useState<Target | null>(null);
  const [answer, setAnswer] = useState<{ string: number; fret: number; right: boolean } | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });

  // Random only after mount so the server render and the first client render agree.
  useEffect(() => setTarget(newTarget()), []);

  const marks: Mark[] = [];
  if (mode === 'one') {
    for (let s = 0; s < 6; s++) for (let f = 0; f <= FRETS; f++) if (mod12(pitchAt(s, f)) === pc) marks.push({ string: s, fret: f, label: SHARP_NAMES[pc], kind: 'root' });
  } else if (mode === 'naturals') {
    for (let s = 0; s < 6; s++)
      for (let f = 0; f <= FRETS; f++) {
        const p = mod12(pitchAt(s, f));
        if (NATURAL_PCS.includes(p)) marks.push({ string: s, fret: f, label: SHARP_NAMES[p], kind: p === 0 ? 'root' : 'tone' });
      }
  } else if (answer && target) {
    marks.push({ string: answer.string, fret: answer.fret, label: noteNameOfMidi(pitchAt(answer.string, answer.fret)), kind: answer.right ? 'root' : 'faint' });
  }

  const pick = (s: number, f: number) => {
    pluck(pitchAt(s, f));
    if (mode !== 'drill' || !target || answer) return;
    const right = s === target.string && mod12(pitchAt(s, f)) === target.pc;
    setAnswer({ string: s, fret: f, right });
    setScore((x) => ({ right: x.right + (right ? 1 : 0), total: x.total + 1 }));
  };

  const next = () => {
    setAnswer(null);
    setTarget(newTarget());
  };

  return (
    <figure className="viz">
      <div className="viz-title">แผนที่คอกีต้าร์: ดู เทียบ และฝึกจำ</div>
      <Pills<Mode>
        label="โหมด"
        value={mode}
        onChange={(m) => { setMode(m); setAnswer(null); }}
        options={[{ value: 'one', text: 'หาโน้ตหนึ่งตัวทั้งคอ' }, { value: 'naturals', text: 'โน้ตธรรมชาติทั้งหมด' }, { value: 'drill', text: 'ฝึกจำ' }]}
      />
      {mode === 'one' && (
        <Pills<number> label="โน้ต" value={pc} onChange={setPc} options={SHARP_NAMES.map((n, i) => ({ value: i, text: n }))} />
      )}
      {mode === 'drill' && target && (
        <div className="viz-now" aria-live="polite">
          <strong>
            หาโน้ต {SHARP_NAMES[target.pc]} บนสาย {STRING_NAMES[target.string]} (กดตำแหน่งบนคอ)
          </strong>
          <span>
            {answer
              ? answer.right
                ? `ถูก เฟร็ต ${answer.fret}`
                : `ยังไม่ใช่ ที่กดคือโน้ต ${noteNameOfMidi(pitchAt(answer.string, answer.fret))} ลองดูคำตอบด้านล่าง`
              : 'ได้เสียงเมื่อกด ลองฟังเทียบกับสายเปล่า'}{' '}
            · ถูก {score.right} จาก {score.total}
          </span>
          {answer && (
            <div className="viz-controls" style={{ marginTop: 8 }}>
              {!answer.right && (
                <span className="gx-detail">
                  คำตอบ: เฟร็ต {Array.from({ length: FRETS + 1 }, (_, f) => f).filter((f) => mod12(pitchAt(target.string, f)) === target.pc).join(' หรือ ')}
                </span>
              )}
              <button type="button" className="btn sm primary" onClick={next}>ข้อต่อไป</button>
            </div>
          )}
        </div>
      )}
      <div className="viz-box">
        <Fretboard marks={marks} frets={FRETS} onPick={pick} label="คอกีต้าร์ 12 เฟร็ต" />
      </div>
      <p className="viz-caption">
        {mode === 'one' && 'กดตำแหน่งบนคอเพื่อฟังเสียง สังเกตว่าโน้ตเดียวกันอยู่หลายที่ และเฟร็ต 12 ซ้ำกับสายเปล่าที่สูงขึ้นหนึ่งอ็อกเทฟ'}
        {mode === 'naturals' && 'ไม่มีโน้ตธรรมชาติคั่นระหว่าง E กับ F และระหว่าง B กับ C เลยห่างกันครึ่งเสียง (หนึ่งเฟร็ต) ส่วนคู่อื่นห่างกันหนึ่งเสียง (สองเฟร็ต)'}
        {mode === 'drill' && 'เริ่มจากสาย 6 และสาย 5 ก่อน เพราะทุกบทที่เกี่ยวกับคอร์ดบาร์และสเกลใช้สองสายนี้เป็นฐาน'}
      </p>
    </figure>
  );
}
