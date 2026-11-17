import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import { Commit, Link, Pill, ease, mix } from './gl';
import data from './labData.json';

// Shows:      a git reset --hard that throws two commits away, and the reflog that still remembers them. The branch label slides back, C2 and C3
//             lose their label, a new line appears in the reflog, then we read HEAD@{1} off that line and reset back to C3.
// Because:    "the commits are not gone" is a statement about a graph (nothing points at them) and about a list (the reflog still names them).
//             The two have to be on the same screen, moving together, to see why the list is the way back.
// Control:    play, scrub, speed and the jump buttons. Every moment changes both the graph and the list.
// Conclusion: reset --hard only moves a label. The reflog keeps the old position of HEAD, so HEAD@{1} (or the id on the line) brings the work back.
//
// The ids and the reflog lines are what git printed in exercises/16_lab_data.py (the scenario of exercise 09, section 2 and 3).

const D = data.reflog;
type Row = { id: string; ref: string; what: string };
const DURATION = 11;

const TEXT: Record<Lang, { title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; head: string; unlabelled: string; marks: Mark[]; caption: string; cmds: string[] }> = {
  th: {
    title: 'reset --hard ทิ้งสอง Commit แต่ Reflog ยังจำไว้ กดเล่นแล้วดูป้ายของ Branch กับรายการใน Reflog เปลี่ยนไปพร้อมกัน',
    legend: [{ kind: 'new', text: 'บรรทัดใหม่ใน Reflog' }, { kind: 'use', text: 'Commit ที่มี Branch ชี้ถึง' }, { kind: 'skip', text: 'ยังอยู่ แต่ไม่มี Branch ชี้ถึง' }],
    head: 'git reflog',
    unlabelled: 'ไม่มีป้ายชี้',
    cmds: ['', 'git reset --hard HEAD~2', 'git reset --hard HEAD~2', 'git reset --hard HEAD@{1}'],
    caption: 'ID และบรรทัดของ Reflog มาจากผลของ Git จริงในแบบฝึก 16 (สถานการณ์เดียวกับแบบฝึก 09) Commit ทั้งสามมีแค่ไฟล์ a.txt ที่เติมทีละบรรทัด',
    marks: [
      { at: 0, name: 'ก่อนพลาด', title: 'มีสาม Commit และ Reflog มีสามบรรทัด', text: 'main อยู่ที่ C3 ทุกครั้งที่เรา Commit Git จดหนึ่งบรรทัดไว้ใน Reflog ของ HEAD ใหม่สุดอยู่บนสุด' },
      { at: 2.0, name: 'reset --hard', title: 'สั่ง git reset --hard HEAD~2', text: 'ป้าย main กับ HEAD ถอยไปที่ C1 ไฟล์ในโฟลเดอร์กลับเป็นของ C1 ด้วย C2 กับ C3 ไม่ได้ถูกลบ แต่ไม่มี Branch ไหนชี้ถึงแล้ว และ Git เพิ่มบรรทัดใหม่ใน Reflog ว่าเพิ่งย้ายออกมา' },
      { at: 5.0, name: 'หาใน reflog', title: 'อ่าน HEAD@{1} จาก Reflog', text: 'บรรทัดที่สองจากบนคือที่ที่ HEAD เคยอยู่ก่อนการย้ายล่าสุด ซึ่งก็คือ C3 บรรทัดนั้นมี ID ของ C3 อยู่ข้างหน้า' },
      { at: 7.0, name: 'กู้กลับ', title: 'สั่ง git reset --hard HEAD@{1}', text: 'ป้าย main กับ HEAD กลับไปที่ C3 ไฟล์กลับมาครบ และ Reflog เพิ่มอีกหนึ่งบรรทัด เพราะการกู้ก็คือการย้ายอีกครั้ง' },
    ],
  },
  en: {
    title: 'reset --hard throws two commits away, but the reflog remembers them. Press play and watch the branch label and the reflog change together',
    legend: [{ kind: 'new', text: 'a new reflog line' }, { kind: 'use', text: 'a commit a branch points at' }, { kind: 'skip', text: 'still there, but no branch points at it' }],
    head: 'git reflog',
    unlabelled: 'no label',
    cmds: ['', 'git reset --hard HEAD~2', 'git reset --hard HEAD~2', 'git reset --hard HEAD@{1}'],
    caption: 'The ids and the reflog lines are what the real Git printed in exercise 16 (the same scenario as exercise 09). The three commits only add one line to a.txt each.',
    marks: [
      { at: 0, name: 'before', title: 'Three commits, and three lines in the reflog', text: 'main is at C3. Every time we commit, Git writes one line in the reflog of HEAD, with the newest on top.' },
      { at: 2.0, name: 'reset --hard', title: 'git reset --hard HEAD~2', text: 'The main and HEAD labels slide back to C1, and the files in the folder become those of C1. C2 and C3 are not deleted, but no branch points at them now, and Git adds a line to the reflog saying it just moved.' },
      { at: 5.0, name: 'find in reflog', title: 'Read HEAD@{1} off the reflog', text: 'The second line from the top is where HEAD was before the last move, which is C3. That line starts with the id of C3.' },
      { at: 7.0, name: 'recover', title: 'git reset --hard HEAD@{1}', text: 'The main and HEAD labels go back to C3, the files come back, and the reflog gets one more line, because recovering is also a move.' },
    ],
  },
};

const X = { C1: 70, C2: 180, C3: 290 };
const Y = 190;

export default function ReflogLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const clock = useClock(DURATION);
  const { t } = clock;
  const stage: 'before' | 'after_reset' | 'after_recover' = t < 2.6 ? 'before' : t < 7.6 ? 'after_reset' : 'after_recover';
  const rows = (D.stages as Record<string, Row[]>)[stage];
  const away = ease(t, 2.2, 3.4) * (1 - ease(t, 7.2, 8.4)); // 1 when main is back at C1
  const tipX = mix(X.C3, X.C1, away);
  const lost = away > 0.5;
  const arrow = ease(t, 5.2, 6.4) * (1 - ease(t, 7.0, 7.4));
  const newRow = stage === 'before' ? 0 : ease(t, stage === 'after_reset' ? 2.8 : 7.8, stage === 'after_reset' ? 3.6 : 8.6);
  const RY = (i: number) => 112 + i * 44;
  const TX = 430;

  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="viz-box">
        <svg viewBox="0 0 880 340" role="img" aria-label={T.title}>
          <text x={12} y={30} className="ib-t">Branch</text>
          <text x={TX} y={30} className="ib-t">{T.head}</text>
          <line x1={410} y1={14} x2={410} y2={330} className="ib-line" style={{ strokeDasharray: '4 6', opacity: 0.5 }} />

          <Link x1={X.C1} y1={Y} x2={X.C2} y2={Y} />
          <Link x1={X.C2} y1={Y} x2={X.C3} y2={Y} />
          <Commit x={X.C1} y={Y} name="C1" id={D.commits.C1} />
          <Commit x={X.C2} y={Y} name="C2" id={D.commits.C2} kind={lost ? 'skip' : 'use'} op={lost ? 0.7 : 1} />
          <Commit x={X.C3} y={Y} name="C3" id={D.commits.C3} kind={lost ? 'skip' : 'use'} op={lost ? 0.7 : 1} />
          <Pill x={tipX - 36} y={Y - 62} text="main" accent w={64} />
          <Pill x={tipX + 36} y={Y - 62} text="HEAD" w={64} />
          {lost && <text x={(X.C2 + X.C3) / 2} y={Y + 92} textAnchor="middle" className="ib-s">{T.unlabelled}</text>}
          {/* the command that is running */}
          <text x={12} y={310} className="ib-m" style={{ fill: 'var(--fg)', fontSize: 15 }}>{t < 2.2 ? '' : t < 7.0 ? `$ ${T.cmds[1]}` : `$ ${T.cmds[3]}`}</text>

          {/* the arrow from the reflog line of HEAD@{1} to C3 */}
          {arrow > 0.02 && <Link x1={TX - 6} y1={RY(1) + 17} x2={X.C3 + 34} y2={Y + 4} p={arrow} accent width={4} />}

          {rows.map((r, i) => {
            const fresh = i === 0 && stage !== 'before';
            const key = rows.length - i;
            const hl = stage === 'after_reset' && i === 1 && t >= 5.0;
            return (
              <g key={key} style={{ opacity: fresh ? newRow : 1, transform: `translateY(${RY(i)}px)`, transition: 'transform .45s' }}>
                <rect className={fresh ? 'ib-new' : hl ? 'ib-use' : 'ib-node'} x={TX} y={0} width={436} height={38} rx={9} style={hl ? { strokeWidth: 4 } : undefined} />
                <text x={TX + 12} y={25} className="ib-m" style={{ fill: 'var(--fg)', fontSize: 14 }}>
                  <tspan style={{ fontWeight: 700 }}>{r.id}</tspan>{`  ${r.ref}  ${r.what}`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
