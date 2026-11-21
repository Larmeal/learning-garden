import type { Lang } from '../spark/timeline';
import { StepControls, useStepper } from '../spark/stepper';
import { Legend, Node } from '../iceberg/ib';

// Shows:      one database file and the programs (processes) that try to open it, with a lock on the file, and what each attempt gets (let in or refused).
// Because:    "one writer process or many read-only processes" is a rule about who may hold the file at the same time, which is clearest as who is let in at each step.
// Control:    the six steps of one story: A opens to write, B tries to write, B tries read only, A closes, three processes read, two transactions in one process.
// Conclusion: a file can be held by one process that writes or by several that only read. Inside one process, several transactions can run, and two that change the same row conflict.
//
// Every outcome is what exercises/10_beyond_memory.py ran (with the Windows message of the lock). The lock message on Linux and macOS was not tried.

type Who = 'A' | 'B' | 'C' | 'D';
type Tag = 'in' | 'out' | 'idle';
const STEPS: Record<Who, Tag>[] = [
  { A: 'in', B: 'idle', C: 'idle', D: 'idle' },
  { A: 'in', B: 'out', C: 'idle', D: 'idle' },
  { A: 'in', B: 'out', C: 'idle', D: 'idle' },
  { A: 'idle', B: 'idle', C: 'idle', D: 'idle' },
  { A: 'idle', B: 'in', C: 'in', D: 'in' },
  { A: 'in', B: 'idle', C: 'idle', D: 'idle' },
];
const LOCK = ['write', 'write', 'write', 'none', 'read', 'write'] as const;

const TEXT: Record<Lang, { title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; steps: { name: string; title: string; text: string }[]; file: string; fileSub: string; lock: Record<(typeof LOCK)[number], string>; in: string; out: string; refused: string; txn: string; caption: string }> = {
  th: {
    title: 'กดถัดไปทีละขั้นของเรื่องเดียวกัน ดูว่าโปรแกรมไหนเปิดไฟล์ได้และไหนถูกปฏิเสธ',
    legend: [{ kind: 'new', text: 'เปิดไฟล์ได้' }, { kind: 'use', text: 'ถือไฟล์อยู่' }, { kind: 'skip', text: 'ไม่ได้เกี่ยวในขั้นนี้' }],
    steps: [
      { name: 'A เขียน', title: '1. โปรแกรม A เปิดไฟล์เพื่อเขียน', text: 'A ได้ล็อกไฟล์ไว้ในโหมดเขียน' },
      { name: 'B เขียน', title: '2. โปรแกรม B ลองเปิดเพื่อเขียน', text: 'ถูกปฏิเสธ ข้อความบอกว่าไฟล์ถูกเปิดอยู่ใน Process อื่นพร้อมหมายเลข PID' },
      { name: 'B อ่าน', title: '3. B ลองเปิดแบบอ่านอย่างเดียว', text: 'ยังถูกปฏิเสธ แม้ขอแค่อ่าน ตราบที่ A ยังเปิดเพื่อเขียนอยู่' },
      { name: 'A ปิด', title: '4. A ปิดไฟล์', text: 'ล็อกถูกปล่อย ไฟล์ว่าง' },
      { name: 'อ่านพร้อมกัน', title: '5. B, C และ D เปิดแบบอ่านอย่างเดียวพร้อมกัน', text: 'ทั้งสามเปิดได้และนับได้ 10 แถวเท่ากันทุกตัว ไม่มีใครเขียนได้' },
      { name: 'ใน Process เดียว', title: '6. ใน Process เดียว สอง Transaction แก้แถวเดียวกัน', text: 'Transaction ที่แก้ทีหลังล้มทันทีด้วย Conflict on update ส่วนการแก้คนละแถวสำเร็จทั้งคู่' },
    ],
    file: 'shop.duckdb', fileSub: 'ไฟล์ฐานข้อมูล', lock: { write: 'ล็อกเพื่อเขียน', read: 'เปิดอ่านอย่างเดียวหลายตัว', none: 'ไม่มีล็อก' }, in: 'เปิดได้', out: 'ถูกปฏิเสธ', refused: 'ไฟล์ถูกเปิดอยู่ใน Process อื่น', txn: 'Transaction สองตัวใน A',
    caption: 'ทุกผลมาจากแบบฝึก 10 ข้อความของ Lock เป็นของ Windows ส่วนบน Linux และ macOS ไม่ได้ลอง',
  },
  en: {
    title: 'Press next through one story and see which programs can open the file and which are refused',
    legend: [{ kind: 'new', text: 'opens the file' }, { kind: 'use', text: 'holds the file' }, { kind: 'skip', text: 'not involved in this step' }],
    steps: [
      { name: 'A writes', title: '1. Program A opens the file to write', text: 'A has locked the file in write mode.' },
      { name: 'B writes', title: '2. Program B tries to open it to write', text: 'Refused. The message says the file is open in another process, with its PID.' },
      { name: 'B reads', title: '3. B tries to open it read only', text: 'Still refused, even for reading, as long as A has it open for writing.' },
      { name: 'A closes', title: '4. A closes the file', text: 'The lock is released and the file is free.' },
      { name: 'Read together', title: '5. B, C and D open it read only at the same time', text: 'All three open it and count 10 rows each. None of them can write.' },
      { name: 'One process', title: '6. Inside one process, two transactions change the same row', text: 'The one that changes it later fails at once with Conflict on update, while changes to different rows both succeed.' },
    ],
    file: 'shop.duckdb', fileSub: 'database file', lock: { write: 'locked for writing', read: 'several read-only opens', none: 'no lock' }, in: 'opens', out: 'refused', refused: 'file is open in another process', txn: 'two transactions in A',
    caption: 'Every outcome comes from exercise 10. The lock message is from Windows, and Linux and macOS were not tried.',
  },
};

export default function WritersLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const s = useStepper(T.steps.length);
  const st = STEPS[s.step];
  const who: Who[] = ['A', 'B', 'C', 'D'];
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="viz-box">
        <svg viewBox="0 0 880 340" role="img" aria-label={T.title}>
          {who.map((w, i) => {
            const y = 20 + i * 76;
            const tag = st[w];
            return (
              <g key={w}>
                <Node x={14} y={y} w={230} h={60} title={`${lang === 'th' ? 'โปรแกรม' : 'program'} ${w}`} sub={tag === 'in' ? T.in : tag === 'out' ? T.out : ' '} state={tag === 'in' ? (LOCK[s.step] === 'write' && w === 'A' ? 'use' : 'new') : tag === 'out' ? 'node' : 'skip'} mono={false} />
                <path className={tag === 'in' ? 'ib-arrow' : tag === 'out' ? 'ib-arrow-bad' : 'ib-line'} d={`M244,${y + 30} L560,${108 + i * 24}`} />
                {tag === 'out' && <text x={330} y={y + 24} className="ib-n ib-bad">{`✗ ${T.refused}`}</text>}
                {tag === 'in' && <text x={330} y={y + 24} className="ib-n ib-ok">{`✓ ${T.in}`}</text>}
              </g>
            );
          })}
          <Node x={560} y={90} w={300} h={110} title={T.file} sub={T.fileSub} state={LOCK[s.step] === 'none' ? 'skip' : 'use'} mono={false} />
          <text x={576} y={186} className="ib-n">{T.lock[LOCK[s.step]]}</text>
          {s.step === 5 && (
            <g>
              <rect className="ib-new" x={560} y={220} width={140} height={44} rx={9} />
              <rect className="ib-new" x={720} y={220} width={140} height={44} rx={9} />
              <text x={630} y={248} textAnchor="middle" className="ib-n">UPDATE id 3</text>
              <text x={790} y={248} textAnchor="middle" className="ib-n">UPDATE id 3</text>
              <text x={560} y={296} className="ib-n ib-bad">✗ Conflict on update!</text>
              <text x={560} y={322} className="ib-s">{T.txn}</text>
            </g>
          )}
        </svg>
      </div>
      <StepControls steps={T.steps} step={s.step} playing={s.playing} go={s.go} toggle={s.toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
