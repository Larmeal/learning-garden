import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import { Commit, Link, Pill, ease, mix } from './gl';
import data from './labData.json';

// Shows:      the two kinds of merge side by side. On the left the branch is ahead of main, so only the main pointer slides (a fast-forward,
//             no commit is made). On the right both sides have moved on, so Git makes a new commit with two parents.
// Because:    "a merge does not always make a commit" is a statement about a pointer and about an arrow count. A sentence says it; here you see
//             the pointer slide on one side and a commit with two arrows appear on the other.
// Control:    play, scrub, speed and the jump buttons. Every moment changes the picture.
// Conclusion: a fast-forward moves a pointer and makes nothing; a real merge makes one commit whose two parents are the two tips.
//
// Ids and the two outputs come from exercises/16_lab_data.py (the same repository as exercise 04).

const D = data.merge;
const DURATION = 9;

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[];
  ff: { name: string; cmd: string; made: string; files: string }; mg: { name: string; cmd: string; made: string; files: string };
  p1: string; p2: string; marks: Mark[]; caption: string;
}> = {
  th: {
    title: 'Merge สองแบบ ซ้ายคือ Fast-forward ขวาคือ Merge ที่ทั้งสองฝั่งเดินหน้าไปแล้ว กดเล่นแล้วดูว่า Commit ใหม่เกิดขึ้นเมื่อไร',
    legend: [{ kind: 'new', text: 'Commit ที่เกิดใหม่' }, { kind: 'use', text: 'Commit เดิม' }],
    ff: { name: 'Fast-forward', cmd: 'git merge dessert', made: 'Commit ใหม่: 0 (main ขยับ 1 ก้าว)', files: 'ไฟล์ใน main: menu.txt dessert.txt' },
    mg: { name: 'Merge Commit', cmd: 'git merge drinks', made: 'Commit ใหม่: 1 (มีสอง Parent)', files: 'ไฟล์ใน main: menu.txt dessert.txt drinks.txt' },
    p1: 'Parent 1', p2: 'Parent 2',
    caption: 'ID และข้อความที่ Git ตอบมาจากแบบฝึก 16 (Repository เดียวกับแบบฝึก 04) ถ้าแตก Branch จาก main ที่ไม่ได้ไปไหนเลย Git จะ Fast-forward ให้เสมอ ถ้าอยากได้ Commit รวมแม้จะ Fast-forward ได้ ให้ใช้ --no-ff',
    marks: [
      { at: 0, name: 'ก่อนรวม', title: 'สองสถานการณ์ที่ยังไม่ได้รวม', text: 'ซ้าย main ยังอยู่ที่ m1 ส่วน dessert มี d1 เพิ่มมาอีกหนึ่ง Commit ขวา main เดินต่อไปที่ m2 ส่วน drinks แยกไปมี k1 ทั้งสองฝั่งต่างก็มี Commit ที่อีกฝั่งไม่มี' },
      { at: 1.6, name: 'สั่ง merge', title: 'สั่ง git merge ทั้งสองฝั่งพร้อมกัน', text: 'ซ้ายไม่ต้องรวมอะไรเลย เพราะ main อยู่บนเส้นทางของ dessert อยู่แล้ว Git จึงแค่ย้ายป้าย main ไปที่ d1 ส่วนขวา main กับ drinks ต่างก็มี Commit ของตัวเอง Git จึงสร้าง Commit ใหม่ที่ต่อจากทั้งสองปลาย' },
      { at: 5.2, name: 'ผลลัพธ์', title: 'เทียบสิ่งที่เกิดขึ้น', text: 'ฝั่งซ้ายไม่มี Commit ใหม่เลย ได้แค่ป้ายที่ขยับ ฝั่งขวามี Commit ใหม่หนึ่งอันที่ชี้กลับไปหาสอง Parent คือ m2 กับ k1 ไฟล์ของทั้งสองฝั่งอยู่ครบใน main' },
    ],
  },
  en: {
    title: 'Two kinds of merge. A fast-forward on the left, a merge where both sides have moved on, on the right. Press play and see when a new commit appears',
    legend: [{ kind: 'new', text: 'a new commit' }, { kind: 'use', text: 'an existing commit' }],
    ff: { name: 'Fast-forward', cmd: 'git merge dessert', made: 'New commits: 0 (main moved one step)', files: 'Files in main: menu.txt dessert.txt' },
    mg: { name: 'Merge commit', cmd: 'git merge drinks', made: 'New commits: 1 (two parents)', files: 'Files in main: menu.txt dessert.txt drinks.txt' },
    p1: 'parent 1', p2: 'parent 2',
    caption: 'The ids and the messages Git printed come from exercise 16 (the same repository as exercise 04). If you branch off a main that has not moved, Git always fast-forwards. To get a merge commit even when it could fast-forward, use --no-ff.',
    marks: [
      { at: 0, name: 'before', title: 'Two situations, not merged yet', text: 'On the left main is still at m1, and dessert has one more commit, d1. On the right main moved on to m2, and drinks split off with k1. Each side has a commit the other lacks.' },
      { at: 1.6, name: 'git merge', title: 'git merge on both sides at once', text: 'On the left there is nothing to combine, because main is already on the path of dessert, so Git just moves the main label to d1. On the right main and drinks each have their own commit, so Git makes a new commit that follows both tips.' },
      { at: 5.2, name: 'result', title: 'Compare what happened', text: 'The left made no commit, only a label moved. The right made one commit that points back at two parents, m2 and k1. Every file of both sides is in main.' },
    ],
  },
};

export default function MergeKindsLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const clock = useClock(DURATION);
  const { t } = clock;
  const slide = ease(t, 1.8, 3.4);
  const born = ease(t, 2.2, 3.2);
  const edge = ease(t, 2.6, 3.8);
  const done = ease(t, 5.2, 6.0);

  // left panel: a horizontal line, m1 then d1
  const L = { y: 190, m1: 90, d1: 270 };
  // right panel: base d1, two tips above and below, and the new merge commit
  const R = { ox: 450, base: [40, 190], m2: [190, 112], k1: [190, 268], mg: [340, 190] } as const;
  const mainX = mix(L.m1, L.d1, slide);

  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="viz-box">
        <svg viewBox="0 0 880 436" role="img" aria-label={T.title}>
          <text x={12} y={30} className="ib-t">{T.ff.name}</text>
          <text x={12} y={52} className="ib-m">{T.ff.cmd}</text>
          <text x={R.ox + 12} y={30} className="ib-t">{T.mg.name}</text>
          <text x={R.ox + 12} y={52} className="ib-m">{T.mg.cmd}</text>
          <line x1={440} y1={14} x2={440} y2={420} className="ib-line" style={{ strokeDasharray: '4 6', opacity: 0.5 }} />

          {/* left: fast-forward */}
          <Link x1={L.m1} y1={L.y} x2={L.d1} y2={L.y} />
          <Commit x={L.m1} y={L.y} name="m1" id={D.ff.m1} />
          <Commit x={L.d1} y={L.y} name="d1" id={D.ff.d1} />
          <Pill x={mainX} y={L.y - 62} text="main" accent w={64} />
          <Pill x={L.d1} y={L.y + 70} text="dessert" w={78} />
          <g style={{ opacity: done }}>
            <text x={12} y={388} className="ib-n">{T.ff.made}</text>
            <text x={12} y={414} className="ib-s">{T.ff.files}</text>
          </g>

          {/* right: a real merge */}
          <Link x1={R.ox + R.base[0]} y1={R.base[1]} x2={R.ox + R.m2[0]} y2={R.m2[1]} />
          <Link x1={R.ox + R.base[0]} y1={R.base[1]} x2={R.ox + R.k1[0]} y2={R.k1[1]} />
          <Link x1={R.ox + R.m2[0]} y1={R.m2[1]} x2={R.ox + R.mg[0]} y2={R.mg[1]} p={edge} accent />
          <Link x1={R.ox + R.k1[0]} y1={R.k1[1]} x2={R.ox + R.mg[0]} y2={R.mg[1]} p={edge} accent />
          <Commit x={R.ox + R.base[0]} y={R.base[1]} name="d1" id={D.three.base} idSide="below" />
          <Commit x={R.ox + R.m2[0]} y={R.m2[1]} name="m2" id={D.three.m2} idSide="below" />
          <Commit x={R.ox + R.k1[0]} y={R.k1[1]} name="k1" id={D.three.k1} idSide="below" />
          <Commit x={R.ox + R.mg[0]} y={R.mg[1]} name="M" id={D.three.merge} kind="new" op={born} idSide="below" />
          <Pill x={mix(R.ox + R.m2[0], R.ox + R.mg[0], ease(t, 3.4, 4.6))} y={mix(R.m2[1] - 56, R.mg[1] - 56, ease(t, 3.4, 4.6))} text="main" accent w={64} />
          <Pill x={R.ox + R.k1[0]} y={R.k1[1] + 78} text="drinks" w={72} />
          {edge > 0.9 && (
            <g>
              <text x={R.ox + 250} y={R.m2[1] + 22} className="ib-s" textAnchor="middle">{T.p1}</text>
              <text x={R.ox + 250} y={R.k1[1] - 12} className="ib-s" textAnchor="middle">{T.p2}</text>
            </g>
          )}
          <g style={{ opacity: done }}>
            <text x={R.ox + 12} y={388} className="ib-n">{T.mg.made}</text>
            <text x={R.ox + 12} y={414} className="ib-s">{T.mg.files}</text>
          </g>
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
