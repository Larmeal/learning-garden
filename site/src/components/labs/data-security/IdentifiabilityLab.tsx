import { useState } from 'react';
import { Legend } from '../iceberg/ib';
import type { Lang } from '../spark/stepper';
import { Bar, Card, Cells, Row, num, pct } from './ds';
import data from './identifiability.json';

// Shows:      a table of 2,000 people, and how many are alone in their group as columns are added one at a time (sex, then zip, then birth year, month, the whole date).
//             100 squares stand for the 2,000 people (one square = 20 people); a square in the strong colour is a person who has nobody else with the same values.
// Because:    "no single column identifies anybody, but a few together do" is a count, and watching the squares fill up as columns are added is what makes it believable.
// Control:    the step buttons (which columns are used). Every one changes the squares, the number of groups and the smallest group.
// Conclusion: columns that look harmless alone (sex, zip, birth date) identify almost everybody once they are combined, so removing the name is not anonymization.
//
// The numbers are those of exercises/01_sensitive_data.py (identifiability.json), counted on 2,000 synthetic people.

type Step = { cols: string[]; unique: number; groups: number; smallest: number; largest: number };
const STEPS = data.steps as Step[];
const KIND = data.kind as Record<string, string>;
const DISTINCT = data.distinct as Record<string, number>;
const N = data.n;

const TEXT: Record<Lang, {
  title: string; pick: string; steps: string[]; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; groups: string; alone: string; largest: string; smallest: string; people: string;
  kinds: Record<string, string>; colsTitle: string; verdict: (p: number) => string; distinct: string; caption: string;
}> = {
  th: {
    title: 'เลือกว่าใช้คอลัมน์อะไรบ้างแล้วดูว่ามีกี่คนที่อยู่ตัวคนเดียวในกลุ่มของตัวเอง ยิ่งเพิ่มคอลัมน์ ช่องสีเข้มก็ยิ่งเต็ม',
    pick: 'คอลัมน์ที่ใช้', steps: ['เพศ', '+ zip', '+ ปีเกิด', '+ เดือนเกิด', '+ วันเกิดเต็ม'],
    legend: [{ kind: 'new', text: 'คนที่อยู่ตัวคนเดียวในกลุ่ม (ระบุตัวได้)' }, { kind: 'use', text: 'คนที่ยังมีคนอื่นหน้าตาเหมือนกัน' }],
    groups: 'จำนวนกลุ่ม', alone: 'คนที่อยู่ตัวคนเดียว', largest: 'กลุ่มที่ใหญ่สุด', smallest: 'กลุ่มที่เล็กสุด', people: 'คน', colsTitle: 'คอลัมน์ในตาราง', distinct: 'ค่าที่ต่างกัน',
    kinds: { direct: 'ระบุตัวตรง ๆ', quasi: 'ระบุตัวเมื่อรวมกัน', sensitive: 'ข้อมูลอ่อนไหว' },
    verdict: (p) => (p < 0.01 ? 'ยังไม่มีใครถูกระบุตัวได้' : p < 0.5 ? 'เริ่มมีคนถูกระบุตัวได้แล้ว' : p < 0.95 ? 'คนส่วนใหญ่ถูกระบุตัวได้' : 'แทบทุกคนถูกระบุตัวได้'),
    caption: 'ตัวเลขมาจากแบบฝึก 01 บนคนสมมติ 2,000 คน หนึ่งช่องแทน 20 คน คอลัมน์ในตารางแบ่งเป็นสามชนิด ชนิดของแต่ละคอลัมน์เป็นการจัดของผู้เขียน',
  },
  en: {
    title: 'Choose which columns are used and see how many people are alone in their group. With every column added, more dark squares fill in',
    pick: 'Columns used', steps: ['sex', '+ zip', '+ birth year', '+ birth month', '+ full birth date'],
    legend: [{ kind: 'new', text: 'a person alone in their group (can be singled out)' }, { kind: 'use', text: 'a person who still has look-alikes' }],
    groups: 'groups', alone: 'people alone', largest: 'largest group', smallest: 'smallest group', people: 'people', colsTitle: 'Columns of the table', distinct: 'distinct values',
    kinds: { direct: 'points at one person', quasi: 'identifies when combined', sensitive: 'sensitive value' },
    verdict: (p) => (p < 0.01 ? 'Nobody can be singled out yet' : p < 0.5 ? 'Some people can be singled out now' : p < 0.95 ? 'Most people can be singled out' : 'Almost everybody can be singled out'),
    caption: 'The numbers come from exercise 01, counted on 2,000 synthetic people. One square stands for 20 people. The three kinds of column are the author\'s grouping.',
  },
};

export default function IdentifiabilityLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [i, setI] = useState(0);
  const s = STEPS[i];
  const share = s.unique / N;
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <span className="ib-lbl">{T.pick}</span>
        <span className="seg" role="group" aria-label={T.pick} style={{ flexWrap: 'wrap' }}>
          {T.steps.map((l, k) => <button key={l} type="button" aria-pressed={i === k} onClick={() => setI(k)}>{l}</button>)}
        </span>
      </div>
      <Row>
        <Card bad={share > 0.5} style={{ flex: '2 1 360px' }}>
          <Cells filled={share * 100} bad label={T.alone} />
          <div style={{ marginTop: 10, fontWeight: 700, fontSize: 18 }}>{`${num(s.unique)} ${T.people} (${pct(s.unique, N)}) ${T.alone}`}</div>
          <div style={{ color: share > 0.5 ? 'var(--ib-bad)' : 'var(--muted)', fontWeight: 700 }}>{T.verdict(share)}</div>
          <Bar label={T.groups} value={s.groups} max={2000} text={num(s.groups)} />
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>{`${T.smallest}: ${s.smallest} · ${T.largest}: ${num(s.largest)}`}</div>
        </Card>
        <Card style={{ flex: '1 1 240px' }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{T.colsTitle}</div>
          {Object.keys(KIND).map((c) => (
            <div key={c} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 14, padding: '2px 0', opacity: s.cols.some((x) => x.startsWith(c)) ? 1 : 0.6, fontWeight: s.cols.some((x) => x.startsWith(c)) ? 700 : 400 }}>
              <span>{c}</span><span style={{ color: 'var(--muted)' }}>{`${T.kinds[KIND[c]]} · ${num(DISTINCT[c])} ${T.distinct}`}</span>
            </div>
          ))}
        </Card>
      </Row>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
