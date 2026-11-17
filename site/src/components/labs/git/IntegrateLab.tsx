import type { ReactNode } from 'react';
import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import { Commit, Link, Pill, Row, ease, mix } from './gl';
import data from './labData.json';

// Shows:      the same four commits (M1, M2 on main; C1, C2 on a topic branch) taken into main three ways at the same time: a merge commit,
//             a squash and a rebase followed by a fast-forward. The commits move, appear and fade, and four numbers appear underneath.
// Because:    the difference between the three is what main's history looks like afterwards and which ids it holds. That is a shape and a
//             set of ids, which a table of numbers hides and a picture that moves shows (who is new, who is copied, who is left behind).
// Control:    play, the scrub bar, the speed and the jump buttons of the clock. Every moment of the clock changes the picture.
// Conclusion: all three give the same files; merge keeps the topic's commits and adds one, squash keeps none of them and adds one new,
//             rebase keeps none of the old ones and adds copies with new ids. The choice is the history you want to read later.
//
// Every id and number comes from exercises/16_lab_data.py (labData.json): the same start, run three times with the real git.

type Strategy = 'merge' | 'squash' | 'rebase';
const D = data.integrate;
const DURATION = 12;
const COLW = 293;

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[];
  head: Record<Strategy, { name: string; cmd: string }>;
  rows: { n: string; z: string; old: string; merged: string; yes: string; no: string };
  same: string; caption: string; marks: Mark[];
}> = {
  th: {
    title: 'Topic Branch เดียวกัน เรารวมเข้า main สามแบบพร้อมกัน ลองกดเล่นแล้วดูว่า Commit ไหนเกิดใหม่ ไหนถูกคัดลอก และไหนถูกทิ้งไว้',
    legend: [{ kind: 'new', text: 'Commit ที่เกิดใหม่' }, { kind: 'use', text: 'Commit เดิม' }, { kind: 'skip', text: 'ยังอยู่ใน Repository แต่ไม่อยู่ในประวัติของ main' }],
    head: {
      merge: { name: 'Merge Commit', cmd: 'git merge --no-ff' },
      squash: { name: 'Squash', cmd: 'git merge --squash' },
      rebase: { name: 'Rebase', cmd: 'git rebase แล้ว --ff-only' },
    },
    rows: { n: 'Commit ใน main', z: 'Merge Commit', old: 'C1 C2 เดิมอยู่ใน main', merged: 'Git ถือว่ารวมแล้ว', yes: 'ใช่', no: 'ไม่' },
    same: 'ทั้งสามแบบได้ไฟล์เหมือนกัน (Tree เดียวกัน',
    caption: 'ID และตัวเลขทั้งหมดมาจากแบบฝึก 16 ซึ่งรันทั้งสามแบบจากจุดเริ่มเดียวกันด้วย Git จริง ส่วนข้อ "Git ถือว่ารวมแล้ว" คือผลของคำสั่ง git branch -r --merged main',
    marks: [
      { at: 0, name: 'จุดเริ่ม', title: 'ทั้งสามแบบเริ่มจากประวัติเดียวกัน', text: 'main มี M1 กับ M2 ส่วน topic แยกจาก M1 ออกไปและมี C1 กับ C2 ตอนนี้ผู้ดูแลกำลังจะรวม topic เข้า main' },
      { at: 1.3, name: 'รวมงาน', title: 'ทั้งสามแบบเริ่มรวมพร้อมกัน', text: 'Merge จะสร้าง Commit ใหม่ที่ต่อจากทั้งสองฝั่ง Squash จะอัดการเปลี่ยนแปลงของ C1 กับ C2 ให้เป็น Commit เดียวต่อจาก M2 ส่วน Rebase จะเล่นสำเนาของ C1 กับ C2 ซ้ำต่อท้าย M2 แล้วค่อยขยับ main ตามไป' },
      { at: 4.6, name: 'ประวัติ main', title: 'ประวัติของ main หลังรวมเสร็จ', text: 'จะเห็นว่า Merge เก็บ C1 กับ C2 ไว้ด้วย ID เดิม Squash ไม่เก็บทั้งสองอัน ส่วน Rebase ไม่ได้เก็บของเดิม แต่มีสำเนาที่ ID ใหม่ และต้นฉบับถูกทิ้งไว้เฉย ๆ' },
      { at: 5.6, name: 'ตัวเลข', title: 'เทียบกันสี่ข้อ', text: 'main มี Commit กี่อัน มี Merge Commit กี่อัน Commit เดิมของ topic ยังเป็นบรรพบุรุษของ main อยู่ไหม และ Git ถือว่ารวมแล้วหรือยัง ข้อสุดท้ายน่าสนใจตรงที่ Squash ตอบว่า "ไม่" ทั้งที่ไฟล์เข้าไปครบแล้ว' },
      { at: 9.4, name: 'ไฟล์เหมือนกัน', title: 'สามแบบ แต่ไฟล์เดียวกัน', text: 'Tree ของ Commit ปลายสุดมี ID เดียวกันทั้งสามแบบ แปลว่าไฟล์ในโฟลเดอร์เหมือนกันทุกไบต์ สิ่งที่ต่างกันมีเพียงรูปร่างของประวัติ' },
    ],
  },
  en: {
    title: 'The same topic branch, taken into main three ways at once. Press play and watch which commits are new, which are copied and which are left behind',
    legend: [{ kind: 'new', text: 'a new commit' }, { kind: 'use', text: 'an existing commit' }, { kind: 'skip', text: 'still in the repository, but not in main\'s history' }],
    head: {
      merge: { name: 'Merge commit', cmd: 'git merge --no-ff' },
      squash: { name: 'Squash', cmd: 'git merge --squash' },
      rebase: { name: 'Rebase', cmd: 'git rebase, then --ff-only' },
    },
    rows: { n: 'Commits on main', z: 'Merge commits', old: 'Old C1 C2 in main', merged: 'Git says topic merged', yes: 'yes', no: 'no' },
    same: 'All three give the same files (same tree',
    caption: 'Every id and number comes from exercise 16, which runs the three ways from the same start with the real Git. "Git says topic merged" is the result of git branch -r --merged main.',
    marks: [
      { at: 0, name: 'start', title: 'The three start from the same history', text: 'main has M1 and M2. topic split off M1 and has C1 and C2. The maintainer is about to take topic into main.' },
      { at: 1.3, name: 'integrate', title: 'All three run at once', text: 'Merge makes a new commit that follows both sides. Squash packs the change of C1 and C2 into one commit after M2. Rebase replays copies of C1 and C2 after M2, then moves main forward.' },
      { at: 4.6, name: 'main history', title: 'The history of main afterwards', text: 'Merge keeps C1 and C2 with their old ids. Squash keeps neither. Rebase keeps no old one, but has copies with new ids, and the originals are just left lying there.' },
      { at: 5.6, name: 'numbers', title: 'Four things to compare', text: 'How many commits main has, how many merge commits, whether topic\'s own commits are still ancestors of main, and whether Git counts topic as merged (on the last one squash says "no" although every file went in).' },
      { at: 9.4, name: 'same files', title: 'Three ways, the same files', text: 'The tree of the last commit has the same id in all three: the folder holds the same bytes. Only the shape of the history differs.' },
    ],
  },
};

function Column({ c, s, t, T }: { c: number; s: Strategy; t: number; T: (typeof TEXT)['th'] }) {
  const ox = c * COLW;
  const mx = ox + 92;
  const tx = ox + 200;
  const Y = { M1: 405, M2: 310, C1: 345, C2: 245 };
  const info = D[s];
  const startIds = D.start;
  const h = info.history;

  // where the main tip and its pill are
  let tipY = Y.M2;
  // opacity of the originals C1, C2 (dashed and faded once they are left behind)
  let leftBehind = 0;
  const nodes: ReactNode[] = [];
  const links: ReactNode[] = [];

  links.push(<Link key="m1m2" x1={mx} y1={Y.M1} x2={mx} y2={Y.M2} />);
  links.push(<Link key="m1c1" x1={mx} y1={Y.M1} x2={tx} y2={Y.C1} op={1 - 0.5 * leftBehind} dashed={leftBehind > 0.5} />);
  links.push(<Link key="c1c2" x1={tx} y1={Y.C1} x2={tx} y2={Y.C2} op={1 - 0.5 * leftBehind} dashed={leftBehind > 0.5} />);

  if (s === 'merge') {
    const a = ease(t, 1.3, 2.3);
    const e = ease(t, 1.6, 2.8);
    tipY = mix(Y.M2, 150, ease(t, 2.6, 3.6));
    links.push(<Link key="e1" x1={mx} y1={Y.M2} x2={mx} y2={150} p={e} accent />);
    links.push(<Link key="e2" x1={tx} y1={Y.C2} x2={mx} y2={150} p={e} accent />);
    nodes.push(<Commit key="M" x={mx} y={150} name="M" id={h[0].id} kind="new" idSide="left" op={a} />);
  } else if (s === 'squash') {
    const fly = (from: number) => {
      const p = ease(t, 1.3 + from, 2.6 + from);
      return { x: mix(tx, mx, p), y: mix(from === 0 ? Y.C1 : Y.C2, 215, p), p };
    };
    const f1 = fly(0);
    const f2 = fly(0.3);
    const a = ease(t, 2.6, 3.4);
    tipY = mix(Y.M2, 215, ease(t, 3.0, 3.9));
    leftBehind = ease(t, 2.8, 3.6);
    links.push(<Link key="e1" x1={mx} y1={Y.M2} x2={mx} y2={215} p={a} accent />);
    for (const [k, f] of [['f1', f1], ['f2', f2]] as const) {
      if (f.p > 0 && f.p < 1) nodes.push(<circle key={k} cx={f.x} cy={f.y} r={8} style={{ fill: 'var(--accent)', opacity: 0.9 }} />);
    }
    nodes.push(<Commit key="S" x={mx} y={215} name="S" id={h[0].id} kind="new" idSide="left" op={a} />);
  } else {
    const p1 = ease(t, 1.3, 2.6);
    const p2 = ease(t, 2.1, 3.4);
    tipY = mix(Y.M2, 125, ease(t, 3.3, 4.2));
    leftBehind = ease(t, 3.3, 4.2);
    const c1x = mix(tx, mx, p1), c1y = mix(Y.C1, 215, p1);
    const c2x = mix(tx, mx, p2), c2y = mix(Y.C2, 125, p2);
    links.push(<Link key="e1" x1={mx} y1={Y.M2} x2={mx} y2={215} p={ease(t, 2.4, 3.0)} accent />);
    links.push(<Link key="e2" x1={mx} y1={215} x2={mx} y2={125} p={ease(t, 3.2, 3.8)} accent />);
    nodes.push(<Commit key="C1n" x={c1x} y={c1y} name="C1′" id={p1 > 0.95 ? h[1].id : undefined} kind="new" idSide="left" op={p1 > 0 ? 1 : 0} />);
    nodes.push(<Commit key="C2n" x={c2x} y={c2y} name="C2′" id={p2 > 0.95 ? h[0].id : undefined} kind="new" idSide="left" op={p2 > 0 ? 1 : 0} />);
  }

  const orig = leftBehind > 0.5 ? 'skip' : 'use';
  const origOp = 1 - 0.45 * leftBehind;
  const show = ease(t, 5.5, 6.2);
  const rowY = (i: number) => 480 + i * 27;
  const reveal = (i: number) => ease(t, 5.5 + i * 0.9, 6.2 + i * 0.9);
  const yn = (b: boolean) => (b ? T.rows.yes : T.rows.no);
  const kept = info.old_topic_ids_in_main.length > 0;

  return (
    <g>
      <text x={ox + 12} y={28} className="ib-t">{T.head[s].name}</text>
      <text x={ox + 12} y={50} className="ib-m">{T.head[s].cmd}</text>
      {c > 0 && <line x1={ox} y1={14} x2={ox} y2={462} className="ib-line" style={{ strokeDasharray: '4 6', opacity: 0.5 }} />}
      {links}
      <Commit x={mx} y={Y.M1} name="M1" id={startIds.M1} idSide="left" />
      <Commit x={mx} y={Y.M2} name="M2" id={startIds.M2} idSide="left" />
      <Commit x={tx} y={Y.C1} name="C1" id={startIds.C1} idSide="right" kind={orig} op={origOp} />
      <Commit x={tx} y={Y.C2} name="C2" id={startIds.C2} idSide="right" kind={orig} op={origOp} />
      {nodes}
      <Pill x={mx} y={tipY - 50} text="main" accent w={64} />
      <Pill x={s === 'rebase' ? mix(tx, mx + 82, leftBehind) : tx} y={s === 'rebase' ? mix(Y.C2 - 50, 125, leftBehind) : Y.C2 - 50} text="topic" w={60} />
      <g style={{ opacity: show }}>
        <line x1={ox + 12} y1={rowY(0) - 22} x2={ox + COLW - 12} y2={rowY(0) - 22} className="ib-line" />
      </g>
      <Row x={ox + 12} y={rowY(0)} w={COLW - 24} label={T.rows.n} value={info.commits_on_main} op={reveal(0)} />
      <Row x={ox + 12} y={rowY(1)} w={COLW - 24} label={T.rows.z} value={info.merge_commits} op={reveal(1)} />
      <Row x={ox + 12} y={rowY(2)} w={COLW - 24} label={T.rows.old} value={yn(kept)} op={reveal(2)} />
      <Row x={ox + 12} y={rowY(3)} w={COLW - 24} label={T.rows.merged} value={yn(info.topic_reported_merged)} op={reveal(3)} />
    </g>
  );
}

export default function IntegrateLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const clock = useClock(DURATION);
  const { t } = clock;
  const same = ease(t, 9.4, 10.2);
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="viz-box">
        <svg viewBox="0 0 880 640" role="img" aria-label={T.title}>
          {(['merge', 'squash', 'rebase'] as Strategy[]).map((s, i) => (
            <Column key={s} c={i} s={s} t={t} T={T} />
          ))}
          <g style={{ opacity: same }}>
            <rect className="ib-banner" x={12} y={580} width={856} height={44} rx={10} />
            <text x={26} y={608} className="ib-n">{`${T.same} ${D.merge.tree.slice(0, 7)})`}</text>
          </g>
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
