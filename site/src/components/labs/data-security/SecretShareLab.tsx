import { useState } from 'react';
import { Legend } from '../iceberg/ib';
import type { Lang } from '../spark/stepper';
import { Card, Row, mono, num } from './ds';

// Shows:      three people who want the total of their salaries without telling each other. Each splits their salary into three random looking shares that add up to it, gives one share to each
//             person, each person adds up the shares they hold and the three sums add up to the total. Move a salary and every share changes, and the total still comes out right.
// Because:    "nobody sees anybody's salary, yet the total is exact" is easy to doubt until you watch what each person actually holds.
// Control:    the three salaries (sliders), and whose view to look at (party 1, 2, 3, or all three together).
// Conclusion: one share, or two of three, is a number that tells nothing about the salary. Only all three together give it back, and adding shares gives the total.
//
// Modulus 100,003 and the random parts are small example numbers so that a person can follow them. Exercise 09 does the same with a modulus of 2^61 - 1 and checks that a share is uniformly
// random for any secret (the last digit of share 1 is spread within 9% to 11%), that two of three shares are too, and that the partial sums add up to 161,000.

const M = 100_003;
const R: [number, number][] = [[73_211, 18_452], [9_137, 66_029], [40_411, 85_703]]; // the two random shares of each owner
const mod = (x: number) => ((x % M) + M) % M;
const NAMES = ['Ann', 'Bob', 'Cat'];

const TEXT: Record<Lang, { title: string; salary: string; view: string; views: string[]; all: string; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; share: string; of: string; sums: string; total: string; real: string; hidden: string; reveal: string; mod: string; sees: (p: number) => string; caption: string; rowTitle: string }> = {
  th: {
    title: 'เลื่อนเงินเดือนของทั้งสามคน แล้วดูว่าแต่ละคนถือ Share อะไร และผลรวมยังออกมาถูกโดยไม่มีใครเห็นเงินเดือนของคนอื่น',
    salary: 'เงินเดือนของ', view: 'ดูจากมุมของ', views: ['คนที่ 1', 'คนที่ 2', 'คนที่ 3'], all: 'ทั้งสามคนรวมกัน', legend: [{ kind: 'new', text: 'สิ่งที่คนที่เลือกเห็น' }, { kind: 'use', text: 'สิ่งที่ซ่อนอยู่' }],
    share: 'Share', of: 'ของ', sums: 'ผลรวมที่แต่ละคนถืออยู่', total: 'ผลรวมของสามผลรวม', real: 'ผลรวมเงินเดือนจริง', hidden: 'มองไม่เห็น', reveal: 'รวมสามคนแล้วได้เงินเดือนเดิมกลับมา', mod: 'ทุกอย่างคิดแบบเหลือเศษหาร 100,003',
    sees: (p) => `คนที่ ${p} เห็นแค่คอลัมน์ของตัวเอง เป็นตัวเลขสุ่มที่ไม่บอกอะไรเกี่ยวกับเงินเดือน`, rowTitle: 'เจ้าของ',
    caption: 'ตัวเลขในภาพเป็นตัวอย่างเล็ก ๆ (หารเอาเศษด้วย 100,003) เพื่อให้ตามได้ แบบฝึก 09 ทำแบบเดียวกันด้วยเลขใหญ่ (2 ยกกำลัง 61 ลบ 1) และตรวจว่า Share ของใครก็กระจายสม่ำเสมอไม่ว่าความลับจะเป็นเท่าไร และผลรวมคือ 161,000',
  },
  en: {
    title: 'Move the salaries of the three people and see what each one holds, and how the total still comes out right although nobody sees another\'s salary',
    salary: 'salary of', view: 'look from the side of', views: ['person 1', 'person 2', 'person 3'], all: 'all three together', legend: [{ kind: 'new', text: 'what the chosen person sees' }, { kind: 'use', text: 'what is hidden' }],
    share: 'share', of: 'of', sums: 'the sum each person holds', total: 'the three sums added', real: 'real total of the salaries', hidden: 'cannot see', reveal: 'the three together give the original salary back', mod: 'everything is worked out modulo 100,003',
    sees: (p) => `Person ${p} sees only their own column, random numbers that say nothing about any salary.`, rowTitle: 'owner',
    caption: 'The numbers are a small example (modulo 100,003) so they can be followed. Exercise 09 does the same with a large modulus (2^61 - 1), checks that a share is spread evenly whatever the secret is, and that the total is 161,000.',
  },
};

export default function SecretShareLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [sal, setSal] = useState([52_000, 48_000, 61_000]);
  const [view, setView] = useState(0); // 0..2 one person, 3 all
  const shares = sal.map((s, i) => [R[i][0], R[i][1], mod(s - R[i][0] - R[i][1])]);
  const partial = [0, 1, 2].map((j) => mod(shares[0][j] + shares[1][j] + shares[2][j]));
  const total = mod(partial[0] + partial[1] + partial[2]);
  const real = sal.reduce((a, b) => a + b, 0);
  const visible = (j: number) => view === 3 || view === j;
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        {NAMES.map((n, i) => (
          <label key={n} className="ib-lbl">{`${T.salary} ${n}: ${num(sal[i])}`}{' '}
            <input type="range" min={10_000} max={90_000} step={1000} value={sal[i]} onChange={(e) => setSal(sal.map((x, k) => (k === i ? Number(e.target.value) : x)))} aria-label={`${T.salary} ${n}`} style={{ width: 150 }} />
          </label>
        ))}
      </div>
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <span className="ib-lbl">{T.view}</span>
        <span className="seg" role="group" aria-label={T.view}>
          {[...T.views, T.all].map((l, k) => <button key={l} type="button" aria-pressed={view === k} onClick={() => setView(k)}>{l}</button>)}
        </span>
      </div>
      <Row>
        <Card style={{ flex: '3 1 420px', overflowX: 'auto' }}>
          <table className="mini-tbl" style={{ fontSize: 14 }}>
            <thead><tr><th>{T.rowTitle}</th>{[0, 1, 2].map((j) => <th key={j}>{`${T.views[j]}`}</th>)}<th>{T.reveal.length ? '=' : ''}</th></tr></thead>
            <tbody>
              {NAMES.map((n, i) => (
                <tr key={n}>
                  <td style={{ fontWeight: 700 }}>{`${n} (${view === 3 ? num(sal[i]) : T.hidden})`}</td>
                  {[0, 1, 2].map((j) => <td key={j} style={{ ...mono, ...(visible(j) ? { background: 'var(--accent-soft)', fontWeight: 700 } : { opacity: 0.35 }) }}>{visible(j) ? num(shares[i][j]) : '?'}</td>)}
                  <td style={mono}>{view === 3 ? `${shares[i].map(num).join(' + ')} → ${num(mod(shares[i][0] + shares[i][1] + shares[i][2]))}` : ''}</td>
                </tr>
              ))}
              <tr>
                <td style={{ fontWeight: 700 }}>{T.sums}</td>
                {[0, 1, 2].map((j) => <td key={j} style={{ ...mono, fontWeight: 700, ...(visible(j) ? {} : { opacity: 0.35 }) }}>{visible(j) ? num(partial[j]) : '?'}</td>)}
                <td></td>
              </tr>
            </tbody>
          </table>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>{T.mod}</div>
        </Card>
        <Card good style={{ flex: '1 1 240px' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>{T.total}</div>
          <div style={{ fontWeight: 700, fontSize: 26 }}>{num(total)}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>{T.real}</div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{`${num(real)} mod ${num(M)} = ${num(real % M)} ${total === real % M ? '✓' : '✗'}`}</div>
          <div style={{ fontSize: 14, marginTop: 8 }}>{view === 3 ? T.reveal : T.sees(view + 1)}</div>
        </Card>
      </Row>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
