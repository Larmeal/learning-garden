import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import { Commit, Link, Pill } from './gl';
import data from './labData.json';

// Shows:      one history with a merge in it, and which commits each revision selector names: HEAD~2, M^2, main..topic, main...topic, ^B main,
//             --first-parent. Pressing a selector lights up exactly the commits that git rev-list printed for it, one after another.
// Because:    ".." and "..." and "^" are rules about reachability, and a reader cannot tell what they select without a picture of the graph.
// Control:    the selector buttons. Each one changes which commits are lit and the line that explains it.
// Conclusion: a revision selector is a set of commits defined by what can be reached from where; two dots is "this side only", three dots is "each side only".
//
// The sets come from exercises/16_lab_data.py (git rev-list in a real repository), the positions are the author's.

type Sel = keyof typeof data.ranges.selectors;
const D = data.ranges;
const ORDER: Sel[] = ['HEAD~2', 'HEAD~3', 'M^2', 'main..topic', 'topic..main', 'main...topic', '^B main', 'main --first-parent', 'feature'];
const CMD: Record<Sel, string> = {
  'HEAD~2': 'git rev-parse HEAD~2', 'HEAD~3': 'git rev-parse HEAD~3', 'M^2': 'git rev-parse M^2',
  'main..topic': 'git rev-list main..topic', 'topic..main': 'git rev-list topic..main', 'main...topic': 'git rev-list main...topic',
  '^B main': 'git rev-list ^B main', 'main --first-parent': 'git rev-list --first-parent main', feature: 'git rev-list feature',
};
const POS: Record<string, [number, number]> = {
  A: [50, 170], B: [150, 170], C: [250, 170], M: [440, 170], D: [540, 170], E: [640, 170],
  F1: [250, 265], F2: [345, 265], T1: [700, 75], T2: [800, 75],
};

const TEXT: Record<Lang, { title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; pick: string; means: Record<Sel, string>; count: (n: number) => string; caption: string; reading: string }> = {
  th: {
    title: 'ประวัติเดียวกันที่มี Merge อยู่ข้างใน เลือก Selector ทีละตัวแล้วดูว่า Git เลือก Commit ไหนมาให้',
    legend: [{ kind: 'new', text: 'Commit ที่ Selector นี้เลือก' }, { kind: 'use', text: 'Commit ที่ไม่ถูกเลือก' }],
    pick: 'เลือก Selector',
    means: {
      'HEAD~2': 'ถอยจาก HEAD ไปตามพ่อแม่ตัวแรกสองก้าว ได้ Commit เดียว',
      'HEAD~3': 'ถอยสามก้าวตามพ่อแม่ตัวแรก จึงข้ามไปที่ C โดยไม่ผ่าน F1 กับ F2',
      'M^2': 'พ่อแม่ตัวที่สองของ Merge Commit คือปลายของ feature',
      'main..topic': 'สิ่งที่ topic มี แต่ main ไม่มี (ใช้ดูงานที่รอรวม)',
      'topic..main': 'สิ่งที่ main มี แต่ topic ไม่มี',
      'main...topic': 'สิ่งที่แต่ละฝั่งมีเอง อีกฝั่งไม่มี รวมกันทั้งสองข้าง',
      '^B main': 'ทุกอย่างที่ไปถึง main ได้ ยกเว้นสิ่งที่ B ไปถึงได้ จึงได้ทั้งสองฝั่งของ Merge',
      'main --first-parent': 'เดินตามพ่อแม่ตัวแรกอย่างเดียว ข้าม F1 กับ F2 ที่เป็นของ Branch ที่ถูก Merge เข้ามา',
      feature: 'ทุกอย่างที่ไปถึงได้จาก feature',
    },
    count: (n) => `Git ตอบ ${n} Commit`,
    reading: 'ผลจาก',
    caption: 'ชุด Commit ของทุก Selector มาจากผลของ git rev-list ในแบบฝึก 16 ที่รันกับ Repository จริง ตำแหน่งของวงกลมในภาพผู้เขียนวางเอง',
  },
  en: {
    title: 'One history with a merge in it. Pick a selector and see which commits Git hands back',
    legend: [{ kind: 'new', text: 'a commit this selector picks' }, { kind: 'use', text: 'a commit it does not pick' }],
    pick: 'Pick a selector',
    means: {
      'HEAD~2': 'two steps back from HEAD along the first parents, one commit',
      'HEAD~3': 'three steps back along the first parents, so it jumps to C without passing F1 and F2',
      'M^2': 'the second parent of the merge commit is the tip of feature',
      'main..topic': 'what topic has and main has not (the work waiting to be merged)',
      'topic..main': 'what main has and topic has not',
      'main...topic': 'what each side has by itself, both sides together',
      '^B main': 'everything reachable from main except what B reaches, so both sides of the merge',
      'main --first-parent': 'follow only the first parent, which skips F1 and F2 of the branch that was merged in',
      feature: 'everything reachable from feature',
    },
    count: (n) => `Git answers ${n} commit${n === 1 ? '' : 's'}`,
    reading: 'output of',
    caption: 'Each set of commits is the output of git rev-list in exercise 16, run on a real repository. The positions of the circles are the author\'s.',
  },
};

export default function RangesLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [sel, setSel] = useState<Sel>('main..topic');
  const lit = D.selectors[sel] as string[];
  const names = D.commits.map((c) => c.name);
  const tip = D.branches;
  const edges = D.commits.flatMap((c) => c.parents.map((p) => [p, c.name] as const));
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.pick}</span>
        <div className="seg" role="group" aria-label={T.pick} style={{ flexWrap: 'wrap' }}>
          {ORDER.map((k) => (
            <button key={k} type="button" aria-pressed={sel === k} onClick={() => setSel(k)} style={{ fontFamily: 'var(--mono)' }}>{k}</button>
          ))}
        </div>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 380" role="img" aria-label={T.title}>
          {edges.map(([p, c]) => {
            const a = POS[p], b = POS[c];
            const both = lit.includes(p) && lit.includes(c);
            return <Link key={p + c} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} accent={both} op={both ? 1 : 0.8} />;
          })}
          {names.map((n) => {
            const on = lit.includes(n);
            const order = lit.indexOf(n);
            return (
              <g key={`${sel}-${n}`} className="gl-pop" style={{ opacity: on ? 1 : 0.55, animation: on ? `gitlight 0.5s ease ${order * 0.18}s both` : undefined }}>
                <Commit x={POS[n][0]} y={POS[n][1]} name={n} kind={on ? 'new' : 'use'} id={D.commits.find((c) => c.name === n)?.id} />
              </g>
            );
          })}
          <Pill x={POS[tip.main][0] - 36} y={POS[tip.main][1] + 70} text="main" accent w={64} />
          <Pill x={POS[tip.main][0] + 36} y={POS[tip.main][1] + 70} text="HEAD" w={64} />
          <Pill x={POS[tip.feature][0] + 82} y={POS[tip.feature][1] + 4} text="feature" w={76} />
          <Pill x={POS[tip.topic][0]} y={POS[tip.topic][1] - 50} text="topic" w={62} />
          <g>
            <rect className="ib-banner" x={12} y={338} width={856} height={36} rx={10} />
            <text x={26} y={362} className="ib-n">{`${T.means[sel]}`}</text>
          </g>
        </svg>
      </div>
      <div className="readout">
        <span>{T.reading} <b style={{ fontFamily: 'var(--mono)' }}>{CMD[sel]}</b>: <span style={{ fontFamily: 'var(--mono)' }}>{lit.join(' ') || '-'}</span> ({T.count(lit.length)})</span>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
