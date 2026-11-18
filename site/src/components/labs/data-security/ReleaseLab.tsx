import { useState } from 'react';
import { Legend } from '../iceberg/ib';
import type { Lang } from '../spark/stepper';
import { Bar, Card, Cells, Row, num } from './ds';
import data from './release.json';

// Shows:      the same table of 2,000 people released in four stages (raw, without direct identifiers, k-anonymous, noisy aggregates). For each stage it shows how many people an attacker
//             names with a public voter list, how often a difference attack guesses right (is Ann in the table), and how far the published salary means are from the truth.
// Because:    a release is a set of trade-offs, and only the four stages side by side with the same three measures show what each control buys and what it costs.
// Control:    the stage (4). Every stage changes the squares (people named), the bar of the difference attack and the bar of the utility error.
// Conclusion: removing names changes nothing, generalizing stops the linkage, and only noise stops the difference attack. Each step costs a little accuracy.
//
// Every number is a value printed by exercises/11_capstone.py (release.json): 1,409 named in stages 0 and 1 and none after, 100% for the difference attack until the noisy stage (69.7% at epsilon 1),
// and the relative error of the mean salary per zip area.

type S = { name: string; named: number; diff: number; salaryErr: number; dxErr: number; suppressed?: number };
const STAGES = data.stages as S[];
const N = data.n;
const SAFES = data.safes as Record<string, string>;

const TEXT: Record<Lang, { title: string; stage: string; stages: string[]; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; named: string; diff: string; diffNote: string; util: string; dx: string; safes: string; safeNames: Record<string, string>; covers: Record<string, number>; caption: string; coin: string; supp: (n: number) => string }> = {
  th: {
    title: 'เลือกขั้นของการปล่อยตาราง แล้วดูว่าผู้โจมตีระบุตัวได้กี่คน เดาว่า Ann อยู่ในตารางไหมได้แม่นแค่ไหน และตัวเลขที่ปล่อยยังใกล้ความจริงแค่ไหน',
    stage: 'ขั้น', stages: ['0 ตารางดิบ', '1 ตัดตัวระบุตรง ๆ', '2 k-anonymous', '3 Aggregate ที่มี Noise'],
    legend: [{ kind: 'new', text: 'สิ่งที่ผู้โจมตีได้' }, { kind: 'use', text: 'สิ่งที่ยังเหลือ' }],
    named: 'คนที่ถูก Join แล้วระบุชื่อถูกต้อง', diff: 'ความแม่นของการเดาว่า Ann อยู่ในตารางไหม', diffNote: '(50% คือเดาสุ่ม)', util: 'ความคลาดเคลื่อนเฉลี่ยของเงินเดือนเฉลี่ยต่อ Zip Area', dx: 'ความคลาดเคลื่อนของจำนวนต่อผลวินิจฉัย', coin: 'เท่าเดาสุ่ม',
    safes: 'Five Safes ที่ชั้นนี้คุมอยู่', safeNames: { projects: 'Safe Projects', people: 'Safe People', settings: 'Safe Settings', data: 'Safe Data', outputs: 'Safe Outputs' }, covers: { projects: 0, people: 0, settings: 0, data: 1, outputs: 3 },
    supp: (n) => `ตัดทิ้ง ${n} แถว`, caption: 'ตัวเลขของทั้งสี่ขั้นมาจากแบบฝึก 11 การเดาว่า Ann อยู่ในตารางไหมให้ผู้โจมตีรู้ตารางที่ไม่มี Ann ครบทุกคนและเปรียบเทียบจำนวนในกลุ่มของเธอ หนึ่งช่องของภาพแทน 20 คน',
  },
  en: {
    title: 'Choose a stage of the release and see how many people an attacker names, how well he can guess whether Ann is in the table, and how close the published numbers still are to the truth',
    stage: 'Stage', stages: ['0 raw table', '1 no direct identifiers', '2 k-anonymous', '3 noisy aggregates'],
    legend: [{ kind: 'new', text: 'what the attacker gets' }, { kind: 'use', text: 'what is left' }],
    named: 'people named correctly by the join', diff: 'accuracy of guessing whether Ann is in the table', diffNote: '(50% is a coin flip)', util: 'average error of the mean salary per zip area', dx: 'error of the count per diagnosis', coin: 'a coin flip',
    safes: 'The Five Safes this stage enforces', safeNames: { projects: 'Safe projects', people: 'Safe people', settings: 'Safe settings', data: 'Safe data', outputs: 'Safe outputs' }, covers: { projects: 0, people: 0, settings: 0, data: 1, outputs: 3 },
    supp: (n) => `${n} rows suppressed`, caption: 'The numbers of the four stages come from exercise 11. In the difference attack the attacker knows the table without Ann entirely and compares the count in her group. One square stands for 20 people.',
  },
};

export default function ReleaseLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [i, setI] = useState(2);
  const s = STAGES[i];
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <span className="ib-lbl">{T.stage}</span>
        <span className="seg" role="group" aria-label={T.stage} style={{ flexWrap: 'wrap' }}>
          {T.stages.map((l, k) => <button key={l} type="button" aria-pressed={i === k} onClick={() => setI(k)}>{l}</button>)}
        </span>
      </div>
      <Row>
        <Card bad={s.named > 100} style={{ flex: '2 1 360px' }}>
          <Cells filled={(s.named / N) * 100} bad label={T.named} />
          <div style={{ marginTop: 8, fontWeight: 700, fontSize: 18 }}>{`${T.named}: ${num(s.named)}`}</div>
          <Bar label={`${T.diff} ${T.diffNote}`} value={s.diff - 0.5} max={0.5} text={`${(s.diff * 100).toFixed(1)}%${s.diff < 0.6 ? ` (${T.coin})` : ''}`} bad={s.diff > 0.9} />
        </Card>
        <Card style={{ flex: '1 1 260px' }}>
          <Bar label={T.util} value={s.salaryErr} max={0.02} text={`${(s.salaryErr * 100).toFixed(2)}%`} />
          <Bar label={T.dx} value={s.dxErr} max={0.02} text={`${(s.dxErr * 100).toFixed(2)}%`} />
          {s.suppressed ? <div style={{ fontSize: 14, color: 'var(--muted)' }}>{T.supp(s.suppressed)}</div> : null}
        </Card>
      </Row>
      <Card style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{T.safes}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.keys(SAFES).map((k) => {
            const on = i >= T.covers[k];
            return <span key={k} className={on ? 'ib-new' : 'ib-node'} style={{ padding: '3px 10px', borderRadius: 9, border: '2px solid var(--line-strong)', fontSize: 14, fontWeight: on ? 700 : 400, opacity: on ? 1 : 0.5 }}>{`${on ? '✓' : '·'} ${T.safeNames[k]}`}</span>;
          })}
        </div>
      </Card>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
