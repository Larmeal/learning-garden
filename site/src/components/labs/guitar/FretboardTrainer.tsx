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

type Lang = 'th' | 'en';

const TEXT: Record<Lang, {
  title: string;
  modeLabel: string;
  modeOne: string;
  modeNaturals: string;
  modeDrill: string;
  noteLabel: string;
  ask: (note: string, string: string) => string;
  right: (fret: number) => string;
  wrong: (note: string) => string;
  hint: string;
  score: (right: number, total: number) => string;
  answer: (frets: number[]) => string;
  next: string;
  fbLabel: string;
  capOne: string;
  capNaturals: string;
  capDrill: string;
}> = {
  th: {
    title: 'แผนที่คอกีต้าร์: ดู เทียบ และฝึกจำ',
    modeLabel: 'โหมด',
    modeOne: 'หาโน้ตหนึ่งตัวทั้งคอ',
    modeNaturals: 'โน้ตธรรมชาติทั้งหมด',
    modeDrill: 'ฝึกจำ',
    noteLabel: 'โน้ต',
    ask: (note, string) => `หาโน้ต ${note} บนสาย ${string} (กดตำแหน่งบนคอ)`,
    right: (fret) => `ถูก เฟร็ต ${fret}`,
    wrong: (note) => `ยังไม่ใช่ ที่กดคือโน้ต ${note} ลองดูคำตอบด้านล่าง`,
    hint: 'ได้เสียงเมื่อกด ลองฟังเทียบกับสายเปล่า',
    score: (right, total) => `ถูก ${right} จาก ${total}`,
    answer: (frets) => `คำตอบ: เฟร็ต ${frets.join(' หรือ ')}`,
    next: 'ข้อต่อไป',
    fbLabel: 'คอกีต้าร์ 12 เฟร็ต',
    capOne: 'กดตำแหน่งบนคอเพื่อฟังเสียง สังเกตว่าโน้ตเดียวกันอยู่หลายที่ และเฟร็ต 12 ซ้ำกับสายเปล่าที่สูงขึ้นหนึ่งอ็อกเทฟ',
    capNaturals: 'ไม่มีโน้ตธรรมชาติคั่นระหว่าง E กับ F และระหว่าง B กับ C เลยห่างกันครึ่งเสียง (หนึ่งเฟร็ต) ส่วนคู่อื่นห่างกันหนึ่งเสียง (สองเฟร็ต)',
    capDrill: 'เริ่มจากสาย 6 และสาย 5 ก่อน เพราะทุกบทที่เกี่ยวกับคอร์ดบาร์และสเกลใช้สองสายนี้เป็นฐาน',
  },
  en: {
    title: 'Fretboard map: look, compare and practice',
    modeLabel: 'Mode',
    modeOne: 'Find one note on the whole neck',
    modeNaturals: 'All natural notes',
    modeDrill: 'Drill',
    noteLabel: 'Note',
    ask: (note, string) => `Find the note ${note} on string ${string} (click a spot on the neck)`,
    right: (fret) => `Correct, fret ${fret}`,
    wrong: (note) => `Not yet. You clicked the note ${note}. See the answer below.`,
    hint: 'You hear the note when you click. Compare it with the open string.',
    score: (right, total) => `${right} correct out of ${total}`,
    answer: (frets) => `Answer: fret ${frets.join(' or ')}`,
    next: 'Next question',
    fbLabel: 'Guitar neck, 12 frets',
    capOne: 'Click a spot on the neck to hear it. Notice that the same note lives in many places, and that fret 12 repeats the open string one octave higher.',
    capNaturals: 'There is no natural note between E and F, or between B and C, so these pairs are a half step apart (one fret). The other pairs are a whole step apart (two frets).',
    capDrill: 'Start with string 6 and string 5, because every lesson on barre chords and scales uses these two strings as its base.',
  },
};

export default function FretboardTrainer({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
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
      <div className="viz-title">{T.title}</div>
      <Pills<Mode>
        label={T.modeLabel}
        value={mode}
        onChange={(m) => { setMode(m); setAnswer(null); }}
        options={[{ value: 'one', text: T.modeOne }, { value: 'naturals', text: T.modeNaturals }, { value: 'drill', text: T.modeDrill }]}
      />
      {mode === 'one' && (
        <Pills<number> label={T.noteLabel} value={pc} onChange={setPc} options={SHARP_NAMES.map((n, i) => ({ value: i, text: n }))} />
      )}
      {mode === 'drill' && target && (
        <div className="viz-now" aria-live="polite">
          <strong>
            {T.ask(SHARP_NAMES[target.pc], STRING_NAMES[target.string])}
          </strong>
          <span>
            {answer
              ? answer.right
                ? T.right(answer.fret)
                : T.wrong(noteNameOfMidi(pitchAt(answer.string, answer.fret)))
              : T.hint}{' '}
            · {T.score(score.right, score.total)}
          </span>
          {answer && (
            <div className="viz-controls" style={{ marginTop: 8 }}>
              {!answer.right && (
                <span className="gx-detail">
                  {T.answer(Array.from({ length: FRETS + 1 }, (_, f) => f).filter((f) => mod12(pitchAt(target.string, f)) === target.pc))}
                </span>
              )}
              <button type="button" className="btn sm primary" onClick={next}>{T.next}</button>
            </div>
          )}
        </div>
      )}
      <div className="viz-box">
        <Fretboard marks={marks} frets={FRETS} onPick={pick} label={T.fbLabel} lang={lang} />
      </div>
      <p className="viz-caption">
        {mode === 'one' && T.capOne}
        {mode === 'naturals' && T.capNaturals}
        {mode === 'drill' && T.capDrill}
      </p>
    </figure>
  );
}
