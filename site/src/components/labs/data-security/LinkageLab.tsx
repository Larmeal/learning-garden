import { useState } from 'react';
import { Legend } from '../iceberg/ib';
import type { Lang } from '../spark/stepper';
import { Bar, Card, Cells, Row, num, pct } from './ds';
import data from './linkage.json';

// Shows:      a medical table with the names removed, joined with a public voter list on zip, birth date and sex. Choose how exactly the birth date and the zip are kept and see how
//             many of the 2,000 people the join names correctly (squares: one = 20 people) and how often it names the wrong one.
// Because:    "we removed the names" is the belief behind most releases, and only the grid of results for every level of detail shows how little that protects.
// Control:    the birth date detail (day, month, year) and the zip detail (5, 3, 2 digits). Every pair is a cell of the grid that exercise 03 computed.
// Conclusion: the people who are named are those whose combination of values is rare. Coarser values protect, but the exact day with any zip still names most people on the list.
//
// Every number is a cell of the grid printed by exercises/03_linkage.py (linkage.json): 'reidentified' is the rows for which exactly one voter fits, 'correct' those where that voter is right.

type G = { unique: number; reidentified: number; correct: number };
const GRID = data.grid as Record<string, G>;
const N = data.n;
const VOTERS = data.voters;

const TEXT: Record<Lang, {
  title: string; birth: string; births: Record<string, string>; zip: string; zips: Record<string, string>; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[];
  named: string; of: string; wrong: string; unique: string; onList: string; caption: string; verdict: (p: number) => string; rows: string;
}> = {
  th: {
    title: 'เลือกว่าเก็บวันเกิดและ Zip ละเอียดแค่ไหน แล้วดูว่าการ Join กับรายชื่อผู้มีสิทธิ์โหวตระบุชื่อคนได้ถูกกี่คน',
    birth: 'วันเกิด', births: { day: 'วันที่เต็ม', month: 'เดือนและปี', year: 'ปีเดียว' }, zip: 'Zip', zips: { 5: '5 หลัก', 3: '3 หลัก', 2: '2 หลัก' },
    legend: [{ kind: 'new', text: 'ถูกระบุชื่อถูกต้อง (รู้แล้วว่าใครป่วยเป็นอะไร)' }, { kind: 'use', text: 'ยังไม่ถูกระบุ' }],
    named: 'คนที่ถูกระบุชื่อถูกต้อง', of: 'จาก 2,000 คน', wrong: 'แถวที่ระบุผิดคน', unique: 'แถวที่ไม่มีใครซ้ำในตาราง', onList: 'รายชื่อโหวตมี 1,413 คน (70.5% ของทั้งหมด) จึงเป็นเพดานของสิ่งที่ผู้โจมตีระบุได้',
    verdict: (p) => (p > 0.6 ? 'เกือบทุกคนในรายชื่อโหวตถูกระบุได้' : p > 0.1 ? 'ยังมีคนจำนวนมากถูกระบุได้' : p > 0 ? 'เหลือแค่บางคน' : 'ไม่มีใครถูกระบุถูกต้อง'), rows: 'แถว',
    caption: 'ทุกตัวเลขเป็นหนึ่งช่องของตารางที่แบบฝึก 03 คำนวณ แถวที่ Join แล้วเหลือผู้โหวตคนเดียวถือว่าระบุชื่อได้ ถ้าชื่อนั้นตรงกับตัวจริงนับเป็นถูก หนึ่งช่องของภาพแทน 20 คน',
  },
  en: {
    title: 'Choose how exactly the birth date and the zip are kept, and see how many people the join with the voter list names correctly',
    birth: 'Birth date', births: { day: 'exact day', month: 'month and year', year: 'year only' }, zip: 'Zip', zips: { 5: '5 digits', 3: '3 digits', 2: '2 digits' },
    legend: [{ kind: 'new', text: 'named correctly (and so is their diagnosis)' }, { kind: 'use', text: 'not named' }],
    named: 'people named correctly', of: 'of 2,000', wrong: 'rows named wrongly', unique: 'rows nobody else shares in the table', onList: 'The voter list holds 1,413 people (70.5% of all), which is the ceiling of what the attacker can name',
    verdict: (p) => (p > 0.6 ? 'Almost everybody on the voter list is named' : p > 0.1 ? 'Many people are still named' : p > 0 ? 'Only a few are left' : 'Nobody is named correctly'), rows: 'rows',
    caption: 'Every number is a cell of the grid that exercise 03 computed. A row counts as named when exactly one voter fits it, and as correct when that voter is the real person. One square stands for 20 people.',
  },
};

export default function LinkageLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [b, setB] = useState('day');
  const [z, setZ] = useState('5');
  const g = GRID[`${b}-${z}`];
  const share = g.correct / N;
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <span className="ib-lbl">{T.birth}</span>
        <span className="seg" role="group" aria-label={T.birth}>
          {Object.keys(T.births).map((k) => <button key={k} type="button" aria-pressed={b === k} onClick={() => setB(k)}>{T.births[k]}</button>)}
        </span>
        <span className="ib-lbl">{T.zip}</span>
        <span className="seg" role="group" aria-label={T.zip}>
          {Object.keys(T.zips).map((k) => <button key={k} type="button" aria-pressed={z === k} onClick={() => setZ(k)}>{T.zips[k]}</button>)}
        </span>
      </div>
      <Row>
        <Card bad={share > 0.1} style={{ flex: '2 1 360px' }}>
          <Cells filled={share * 100} bad label={T.named} />
          <div style={{ marginTop: 10, fontWeight: 700, fontSize: 20 }}>{`${T.named}: ${num(g.correct)} ${T.of}`}</div>
          <div style={{ fontWeight: 700, color: share > 0.1 ? 'var(--ib-bad)' : 'var(--muted)' }}>{`${T.verdict(share)} (${pct(g.correct, N)})`}</div>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>{T.onList}</div>
        </Card>
        <Card style={{ flex: '1 1 240px' }}>
          <Bar label={T.unique} value={g.unique} max={N} text={num(g.unique)} />
          <Bar label={T.wrong} value={g.reidentified - g.correct} max={N} text={`${g.reidentified - g.correct} ${T.rows}`} bad />
          <Bar label={T.named} value={g.correct} max={VOTERS} text={num(g.correct)} bad />
        </Card>
      </Row>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
