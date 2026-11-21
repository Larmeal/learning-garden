import { StepControls, useStepper, type StepInfo } from '../spark/stepper';
import { Banner } from '../iceberg/ib';
import type { Lang } from './dv';

// Shows:      the same mistake (Alice renames price() to unit_price(), Bob writes new code that calls price()) on two roads: two long branches of five commits each, and small batches pushed one at a time.
//             Every commit is a circle; the ones you would have to suspect when the tests turn red are shaded.
// Because:    "git merged it without a conflict, and the tests are red" cannot be felt from a sentence. The reader has to see the red circle sit after eleven pale ones on the top road and after two on the bottom road.
// Control:    the step buttons (Next, a step name).
// Conclusion: a merge with no conflict is not a merge that works; the smaller the batch between two integrations, the fewer commits you must suspect when the tests go red.
//
// The counts (11 commits in doubt after the long branches, 3 bisect runs, 2 commits in doubt after small batches) are the results of exercises/01_small_batches.py.

type S = 'ok' | 'bad' | 'doubt' | 'new' | 'ghost';
const TEXT: Record<Lang, { title: string; caption: string; legend: [string, string, string, string]; long: string; small: string; steps: StepInfo[]; doubt: (n: number) => string; start: string; merge: string; alice: string; bob: string; trunk: string; conflict: string; bisect: string }> = {
  th: {
    title: 'กดถัดไปทีละขั้น เทียบสองวิธีทำงานที่ผิดพลาดเรื่องเดียวกัน ดูว่าเมื่อ Test เป็นสีแดง เราต้องสงสัยกี่ Commit',
    caption: 'ตัวเลข 11 Commit ที่ต้องสงสัย, Bisect 3 รอบ และ 2 Commit ที่ต้องสงสัยฝั่ง Batch เล็ก เป็นผลจริงของแบบฝึก 01 (01_small_batches.py) ชื่อ Alice กับ Bob เป็นตัวละครในแบบฝึก',
    legend: ['Test ผ่าน', 'Test ไม่ผ่าน', 'ต้องสงสัย', 'Commit ใหม่ในขั้นนี้'],
    long: 'สองสาขายาว Commit ห้าอันต่อคน แล้วค่อยรวม', small: 'Batch เล็ก Push ทีละ Commit แล้วรัน Test ก่อนทุกครั้ง',
    start: 'เริ่ม', merge: 'Merge', alice: 'Alice', bob: 'Bob', trunk: 'main', conflict: 'Git ไม่เจอ Conflict เลย', bisect: 'Bisect 3 รอบ ได้ Commit Merge',
    doubt: (n) => `${n} Commit ที่ต้องสงสัย`,
    steps: [
      { name: 'เริ่ม', title: 'ทั้งสองทีมเริ่มจาก Commit เดียวกัน', text: 'โปรเจกต์เล็ก ๆ มีฟังก์ชัน price() ที่ shop.py ใช้อยู่ และ Test ที่ผ่าน ต่อไปนี้ Alice จะเปลี่ยนชื่อฟังก์ชัน ส่วน Bob จะเขียนโค้ดใหม่ที่เรียกฟังก์ชันนี้' },
      { name: 'ต่างคนต่างทำ', title: 'ทำงานไปทีละ Commit และ Test ของแต่ละสาขาผ่านหมด', text: 'บนแถวบน Alice กับ Bob ทำงานบนสาขาของตัวเองคนละห้า Commit บนแถวล่าง Bob Push Commit แรกของเขาลง main ทันทีและ Test ผ่าน ทุกคนเห็นวงกลมสีเขียวเหมือนกัน' },
      { name: 'Alice เปลี่ยนชื่อ', title: 'Alice เปลี่ยน price() เป็น unit_price()', text: 'ในแถวบน Commit นี้อยู่ลึกในสาขาของ Alice ที่ Bob ยังไม่เห็น ส่วนในแถวล่าง Alice Push ลง main ทันที Bob จะเจอมันเร็วที่สุดตอนที่ Pull ครั้งถัดไป' },
      { name: 'Bob ใช้ชื่อเก่า', title: 'Bob เขียนโค้ดที่เรียก price() ซึ่งชื่อเก่าอยู่ในสาขาของเขา', text: 'Test ของ Bob ผ่านเพราะเขายังไม่เห็นการเปลี่ยนชื่อ ไม่มีใครผิดตรงนี้ เพราะ Commit ของทั้งสองคนถูกต้องเมื่ออยู่ตามลำพัง' },
      { name: 'ถึงเวลารวม', title: 'รวมแล้ว Test แดง', text: 'แถวบน รวมสองสาขาด้วย git merge ได้ผลว่า Git ไม่เจอ Conflict แต่ Test ล้มเหลว ต้องสงสัย 10 Commit บวกกับ Merge รวม 11 และ git bisect ต้องรัน Test 3 รอบกว่าจะชี้ไปที่ Commit Merge เอง แถวล่าง Bob Pull ตอนที่เขามี Commit ที่ยังไม่ได้ Push อยู่สองอัน Test แดงทันที ต้องสงสัยแค่สองอัน เขาจึงแก้ได้ด้วยอีกหนึ่ง Commit' },
    ],
  },
  en: {
    title: 'Press Next one step at a time to compare two ways of working that make the same mistake, and see how many commits you must suspect when the tests turn red',
    caption: 'The 11 commits in doubt, 3 bisect runs and 2 commits in doubt on the small batch road are the real results of exercise 01 (01_small_batches.py). Alice and Bob are characters of the exercise.',
    legend: ['tests pass', 'tests fail', 'in doubt', 'new commit of this step'],
    long: 'two long branches, five commits each, merged at the end', small: 'small batches, one commit pushed at a time, tests before every push',
    start: 'start', merge: 'merge', alice: 'Alice', bob: 'Bob', trunk: 'main', conflict: 'Git found no conflict', bisect: 'bisect: 3 runs, lands on the merge',
    doubt: (n) => `${n} commits in doubt`,
    steps: [
      { name: 'Start', title: 'Both teams start from the same commit', text: 'A tiny project has a function price() that shop.py uses, and passing tests. Alice is about to rename the function, and Bob is about to write new code that calls it.' },
      { name: 'Working apart', title: 'Everyone works commit by commit and the tests of each branch pass', text: 'On the top road Alice and Bob each work five commits on their own branch. On the bottom road Bob pushes his first commit to main at once and the tests pass. Everybody sees the same green circles.' },
      { name: 'Alice renames', title: 'Alice renames price() to unit_price()', text: 'On the top road this commit is deep inside Alice\'s branch, where Bob cannot see it. On the bottom road Alice pushes to main at once, and Bob will meet it at the soonest on his next pull.' },
      { name: 'Bob uses the old name', title: 'Bob writes code that calls price(), the old name that still exists on his branch', text: 'Bob\'s tests pass because he has not seen the rename. Nobody is wrong here, because each commit is correct alone.' },
      { name: 'Time to merge', title: 'After integrating, the tests are red', text: 'Top road: git merge finds no conflict at all, yet the tests fail. Ten commits plus the merge are in doubt, 11 in all, and git bisect needs 3 test runs before it points at the merge commit itself. Bottom road: Bob pulls while he has two commits not yet pushed. The tests go red at once, only two commits are in doubt, and one more commit fixes it.' },
    ],
  },
};

function C({ x, y, label, s, dim }: { x: number; y: number; label?: string; s: S; dim?: boolean }) {
  const fill = s === 'bad' ? 'color-mix(in srgb, var(--ib-bad) 35%, var(--surface))' : s === 'ok' ? 'color-mix(in srgb, var(--k2) 30%, var(--surface))' : s === 'doubt' ? 'color-mix(in srgb, var(--accent) 22%, var(--surface))' : s === 'new' ? 'var(--accent-soft)' : 'var(--surface)';
  const stroke = s === 'bad' ? 'var(--ib-bad)' : s === 'ok' ? 'var(--k2)' : s === 'ghost' ? 'var(--line)' : 'var(--accent)';
  return (
    <g style={{ opacity: s === 'ghost' ? 0.35 : dim ? 0.55 : 1 }}>
      <circle cx={x} cy={y} r={19} style={{ fill, stroke, strokeWidth: s === 'new' || s === 'bad' ? 4 : 2.5 }} />
      {s === 'bad' && <path d={`M${x - 7},${y - 7} l14,14 M${x + 7},${y - 7} l-14,14`} style={{ stroke: 'var(--ib-bad)', strokeWidth: 3.5, strokeLinecap: 'round' }} />}
      {s === 'ok' && <path d={`M${x - 7},${y} l5,6 l10,-12`} style={{ stroke: 'var(--k2)', strokeWidth: 3.5, fill: 'none', strokeLinecap: 'round' }} />}
      {label && <text x={x} y={y + 38} textAnchor="middle" className="ib-s">{label}</text>}
    </g>
  );
}
const L = ({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) => <path d={`M${x1},${y1} L${x2},${y2}`} style={{ stroke: 'var(--line-strong)', strokeWidth: 3 }} />;

export default function BatchLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const { step, go, playing, toggle } = useStepper(T.steps.length, 4800);
  const xs = [120, 190, 260, 330, 400];
  // top road: alice nodes a1..a5 at y=62, bob nodes b1..b5 at y=190, start S (40,126), merge M (520,126)
  const aS = (i: number): S => (step < 1 ? 'ghost' : step === 2 && i === 1 ? 'new' : step >= 4 ? 'doubt' : 'ok');
  const bS = (i: number): S => (step < 1 ? 'ghost' : step === 3 && i === 1 ? 'new' : step >= 4 ? 'doubt' : 'ok');
  const mS: S = step >= 4 ? 'bad' : 'ghost';
  // bottom road, one line y=360: S, B1, R (rename), B2, B3 (test), B4 (fix)
  const bx = [40, 150, 270, 390, 510, 630];
  const bottom: { l: string; s: S }[] = [
    { l: T.start, s: 'ok' },
    { l: 'Bob 1', s: step >= 1 ? 'ok' : 'ghost' },
    { l: step >= 2 ? 'Alice' : '', s: step >= 2 ? (step === 2 ? 'new' : 'ok') : 'ghost' },
    { l: step >= 3 ? 'Bob 2' : '', s: step >= 3 ? (step === 3 ? 'new' : step >= 4 ? 'doubt' : 'ok') : 'ghost' },
    { l: step >= 4 ? 'Bob 3' : '', s: step >= 4 ? 'bad' : 'ghost' },
    { l: step >= 4 ? 'Bob 4' : '', s: step >= 4 ? 'new' : 'ghost' },
  ];
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <div className="ib-legend" aria-label="legend">
        <span><i style={{ borderColor: 'var(--k2)' }} />{T.legend[0]}</span>
        <span><i style={{ borderColor: 'var(--ib-bad)' }} />{T.legend[1]}</span>
        <span><i style={{ borderColor: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 22%, var(--surface))' }} />{T.legend[2]}</span>
        <span><i className="new" />{T.legend[3]}</span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 470" role="img" aria-label={T.title}>
          <text x={16} y={26} className="ib-t">{T.long}</text>
          <L x1={40} y1={126} x2={120} y2={62} /><L x1={40} y1={126} x2={120} y2={190} />
          {[0, 1, 2, 3].map((i) => (<g key={i}><L x1={xs[i]} y1={62} x2={xs[i + 1]} y2={62} /><L x1={xs[i]} y1={190} x2={xs[i + 1]} y2={190} /></g>))}
          <L x1={400} y1={62} x2={520} y2={126} /><L x1={400} y1={190} x2={520} y2={126} />
          <C x={40} y={126} label={T.start} s="ok" />
          {xs.map((x, i) => (<g key={i}><C x={x} y={62} s={aS(i)} label={i === 0 ? T.alice : undefined} /><C x={x} y={190} s={bS(i)} label={i === 0 ? T.bob : undefined} /></g>))}
          <C x={520} y={126} s={mS} label={step >= 4 ? T.merge : undefined} />
          {step >= 4 && (
            <g>
              <text x={570} y={112} className="ib-n">{T.doubt(11)}</text>
              <text x={570} y={136} className="ib-s">{T.conflict}</text>
              <text x={570} y={158} className="ib-s">{T.bisect}</text>
            </g>
          )}
          <line className="ib-line" x1={16} y1={258} x2={864} y2={258} />
          <text x={16} y={290} className="ib-t">{T.small}</text>
          {bx.slice(0, -1).map((x, i) => (bottom[i + 1].s !== 'ghost' ? <L key={i} x1={x} y1={360} x2={bx[i + 1]} y2={360} /> : null))}
          {bottom.map((b, i) => (<C key={i} x={bx[i]} y={360} s={b.s} label={b.l} />))}
          {step >= 4 && (
            <g>
              <text x={700} y={350} className="ib-n">{T.doubt(2)}</text>
              <text x={700} y={374} className="ib-s">{T.trunk}</text>
            </g>
          )}
          <Banner y={420} text={T.steps[step].title} />
        </svg>
      </div>
      <StepControls steps={T.steps} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
