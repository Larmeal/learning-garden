import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import { Commit, Link, Pill, ease, mix } from './gl';
import data from './labData.json';

// Shows:      a main repository whose commit holds a pointer (a gitlink, mode 160000) to one commit of a library repository. The library gets a new
//             commit, and the pointer does NOT follow. Only after we update the submodule, add it and commit does a new main commit point at the new one.
// Because:    "a submodule is a pinned commit, not a live link" is about two repositories and an arrow that stays where it is. A paragraph says it;
//             watching the library move on while the arrow stays put is what makes it stick.
// Control:    play, scrub, speed and the jump buttons.
// Conclusion: the main repository stores a commit id of the library, and it changes only when we commit a change to that id.
//
// Ids and outputs come from exercises/16_lab_data.py (the scenario of exercise 14, section 5).

const D = data.submodule;
const DURATION = 12;
const MAIN = { x: 130, s2: 330, s3: 150 };
const LIB = { x: 720, l1: 330, l2: 150 };

const TEXT: Record<Lang, { title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; repoMain: string; repoLib: string; pointer: string; stat: string; empty: string; marks: Mark[]; caption: string; notFollow: string; clone: string }> = {
  th: {
    title: 'Submodule คือ Repository หนึ่งที่ถูกปักหมุดไว้ที่ Commit เดียวของอีก Repository กดเล่นแล้วดูว่าเมื่อไลบรารีเดินไปข้างหน้า ลูกศรของ Repository หลักไปตามด้วยไหม',
    legend: [{ kind: 'new', text: 'ที่เกิดใหม่' }, { kind: 'use', text: 'ที่มีอยู่แล้ว' }, { kind: 'skip', text: 'ลูกศรเก่า (ยังอยู่ในประวัติ)' }],
    repoMain: 'Repository หลัก', repoLib: 'Repository ของไลบรารี', pointer: 'vendor/lib (160000)', stat: 'git status', empty: 'โฟลเดอร์ vendor/lib ว่างเปล่า',
    notFollow: 'Repository หลักยังชี้ที่เดิม',
    clone: 'git clone ธรรมดาได้โฟลเดอร์ว่าง ต้องสั่ง git submodule update --init อีกที',
    caption: 'ID ทุกตัวและผลของ git status มาจากแบบฝึก 16 (สถานการณ์เดียวกับแบบฝึก 14) ส่วนบรรทัด 160000 คือสิ่งที่ git ls-tree แสดง',
    marks: [
      { at: 0, name: 'ปักหมุด', title: 'Repository หลักจดไว้ว่าไลบรารีอยู่ที่ Commit ไหน', text: 'ใน Tree ของ Commit S2 มีรายการ vendor/lib ที่เป็นโหมด 160000 ซึ่งเก็บ ID ของ Commit ในไลบรารี ไม่ได้เก็บไฟล์ของไลบรารีเลย ตอนนี้ชี้ที่ L1' },
      { at: 2.2, name: 'ไลบรารีเดินต่อ', title: 'ไลบรารีมี Commit ใหม่ L2', text: 'ลูกศรของ Repository หลักไม่ขยับ เพราะสิ่งที่จดไว้คือ ID ของ L1 ซึ่งไม่มีอะไรเปลี่ยน ถ้าสั่ง git submodule status ตอนนี้ก็ยังเห็น L1' },
      { at: 5.0, name: 'อัปเดต', title: 'ดึง L2 เข้ามาในโฟลเดอร์ของ Submodule', text: 'พอเราไปดึง L2 มาในโฟลเดอร์ vendor/lib Repository หลักก็เห็นว่าที่ที่ชี้ไว้กับที่ที่โฟลเดอร์อยู่ไม่ตรงกัน git status จึงขึ้นว่าแก้ไข (M) ที่ vendor/lib แต่ลูกศรที่บันทึกไว้ยังเป็น L1' },
      { at: 7.4, name: 'Commit ตัวชี้', title: 'git add แล้ว git commit ย้ายลูกศร', text: 'Commit ใหม่ S3 บันทึกลูกศรตัวใหม่ที่ชี้ L2 ลูกศรของ S2 ยังชี้ L1 อยู่เหมือนเดิม ย้อนไปที่ S2 เมื่อไรก็ได้ไลบรารีเวอร์ชันเก่า เลยทำให้ Build ซ้ำได้' },
      { at: 10.0, name: 'Clone', title: 'คนที่ Clone มาต้องสั่งดึงเอง', text: 'git clone ธรรมดาสร้างโฟลเดอร์ vendor/lib ให้แต่ปล่อยว่างไว้ ต้องสั่ง git submodule update --init ถึงจะดึงไลบรารีมาที่ Commit ที่ปักหมุดไว้' },
    ],
  },
  en: {
    title: 'A submodule is one repository pinned to one commit of another. Press play and see whether the main repository\'s arrow follows when the library moves on',
    legend: [{ kind: 'new', text: 'new' }, { kind: 'use', text: 'already there' }, { kind: 'skip', text: 'the old arrow (still in history)' }],
    repoMain: 'main repository', repoLib: 'library repository', pointer: 'vendor/lib (160000)', stat: 'git status', empty: 'the vendor/lib folder is empty',
    notFollow: 'the main repository still points at the old one',
    clone: 'a plain git clone gives an empty folder, and git submodule update --init fills it',
    caption: 'Every id and the git status line come from exercise 16 (the scenario of exercise 14). The 160000 line is what git ls-tree prints.',
    marks: [
      { at: 0, name: 'pinned', title: 'The main repository notes which commit the library is at', text: 'The tree of commit S2 has an entry vendor/lib with mode 160000, which holds the id of a commit in the library. It does not hold the library\'s files at all. It points at L1.' },
      { at: 2.2, name: 'library moves on', title: 'The library gets a new commit, L2', text: 'The arrow of the main repository does not move, because what it recorded is the id of L1, and nothing changed about that. git submodule status would still show L1.' },
      { at: 5.0, name: 'update', title: 'Pull L2 into the submodule folder', text: 'Once we pull L2 into vendor/lib, the main repository sees that where it points and where the folder is no longer match, so git status says modified (M) for vendor/lib. The arrow it recorded is still L1.' },
      { at: 7.4, name: 'commit the pointer', title: 'git add, then git commit, moves the arrow', text: 'The new commit S3 records a new arrow to L2. The arrow of S2 still points at L1. Go back to S2 at any time and the old library version comes with it, which makes a build repeatable.' },
      { at: 10.0, name: 'clone', title: 'Whoever clones has to pull it in', text: 'A plain git clone makes the vendor/lib folder but leaves it empty. git submodule update --init is what fetches the library at the pinned commit.' },
    ],
  },
};

export default function SubmoduleLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const clock = useClock(DURATION);
  const { t } = clock;
  const l2 = ease(t, 2.2, 3.4);
  const s3 = ease(t, 7.6, 8.6);
  const edge = ease(t, 8.0, 9.0);
  const checked = ease(t, 5.0, 6.0); // the submodule folder is at L2
  const libTip = mix(LIB.l1, LIB.l2, l2);
  const clone = ease(t, 10.0, 10.8);
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="viz-box">
        <svg viewBox="0 0 880 470" role="img" aria-label={T.title}>
          <rect className="ib-zone" x={12} y={44} width={300} height={344} rx={14} style={{ opacity: 0.55 }} />
          <rect className="ib-zone" x={568} y={44} width={300} height={344} rx={14} style={{ opacity: 0.55 }} />
          <text x={24} y={32} className="ib-t">{T.repoMain}</text>
          <text x={580} y={32} className="ib-t">{T.repoLib}</text>

          {/* library history */}
          <Link x1={LIB.x} y1={LIB.l1} x2={LIB.x} y2={LIB.l2} p={l2} />
          <Commit x={LIB.x} y={LIB.l1} name="L1" id={D.lib[0]} idSide="below" />
          <Commit x={LIB.x} y={LIB.l2} name="L2" id={D.lib[1]} kind="new" op={l2} idSide="below" />
          <Pill x={LIB.x + 78} y={libTip} text="main" accent w={64} />

          {/* main history */}
          <Link x1={MAIN.x} y1={MAIN.s2} x2={MAIN.x} y2={MAIN.s3} p={s3} />
          <Commit x={MAIN.x} y={MAIN.s2} name="S2" id={D.main[0]} idSide="below" />
          <Commit x={MAIN.x} y={MAIN.s3} name="S3" id={D.main[1]} kind="new" op={s3} idSide="below" />
          <Pill x={MAIN.x - 78} y={mix(MAIN.s2, MAIN.s3, s3)} text="main" accent w={64} />

          {/* the pointers (gitlinks) */}
          <Link x1={MAIN.x + 24} y1={MAIN.s2} x2={LIB.x - 24} y2={LIB.l1} accent={edge < 0.5 && true} op={edge > 0.5 ? 0.55 : 1} dashed={edge > 0.5} width={4} />
          <Link x1={MAIN.x + 24} y1={MAIN.s3} x2={LIB.x - 24} y2={LIB.l2} p={edge} accent width={4} />
          <text x={(MAIN.x + LIB.x) / 2 + 20} y={MAIN.s2 - 22} textAnchor="middle" className="ib-m" style={{ fill: 'var(--fg)' }}>{`${T.pointer} → ${D.lib[0]}`}</text>
          {edge > 0.2 && (
            <text x={(MAIN.x + LIB.x) / 2 + 20} y={MAIN.s3 - 22} textAnchor="middle" className="ib-m" style={{ fill: 'var(--fg)', opacity: edge }}>{`${T.pointer} → ${D.lib[1]}`}</text>
          )}
          {l2 > 0.9 && edge < 0.5 && (
            <text x={(MAIN.x + LIB.x) / 2 + 20} y={(MAIN.s2 + MAIN.s3) / 2} textAnchor="middle" className="ib-n" style={{ opacity: l2 }}>{T.notFollow}</text>
          )}
          {checked > 0.3 && edge < 0.5 && (
            <g style={{ opacity: checked }}>
              <rect className="ib-new" x={MAIN.x + 90} y={MAIN.s2 + 26} width={250} height={34} rx={9} />
              <text x={MAIN.x + 102} y={MAIN.s2 + 49} className="ib-m" style={{ fill: 'var(--fg)', fontSize: 15 }}>{`${T.stat}: ${D.status_after_pull.replace(' ', ' ')}`}</text>
            </g>
          )}
          {clone > 0.05 && (
            <g style={{ opacity: clone }}>
              <rect className="ib-banner" x={12} y={402} width={856} height={56} rx={10} />
              <text x={26} y={426} className="ib-n">{T.empty}</text>
              <text x={26} y={448} className="ib-s">{T.clone}</text>
            </g>
          )}
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
