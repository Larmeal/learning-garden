import { useState } from 'react';
import { Legend } from '../iceberg/ib';
import type { Lang } from '../spark/stepper';
import { Bar, Card, Row, mono, num, pct } from './ds';
import data from './kanon.json';

// Shows:      what it costs to make every group of look-alikes hold at least 5 people: a wider age band and a shorter zip give bigger groups and fewer rows to throw away,
//             and the average group size (what the data loses) grows. A last card shows a group in which everybody has the same diagnosis (homogeneity) in the 10 year / 3 digit release.
// Because:    k-anonymity is a trade between privacy and detail, and the homogeneity group shows that it is not the whole story.
// Control:    the age band (1, 5, 10, 20 years) and the number of zip digits (5, 3, 2). Every pair is a cell of the grid of exercise 04.
// Conclusion: you get k >= 5 by generalizing or by suppressing, each loses information, and a table that is k-anonymous can still tell you a person's diagnosis.
//
// The grid (k, groups, rows suppressed, homogeneous groups) is printed by exercises/04_k_anonymity.py (kanon.json).

type G = { k: number; groups: number; suppressed: number; homogeneous: number; homogeneousPeople: number; kept: number; avg: number };
const GRID = data.grid as Record<string, G>;
const N = data.n;
const EX = data.homogeneousExample as { zip: string; age: number; sex: string; diagnosis: string }[];

const TEXT: Record<Lang, {
  title: string; band: string; zip: string; years: string; digits: string; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; k: string; groups: string; supp: string; avg: string; homo: string;
  suppNote: string; homoTitle: string; homoNote: string; homoOnly: string; caption: string;
}> = {
  th: {
    title: 'เลือกความกว้างของช่วงอายุและจำนวนหลักของ Zip แล้วดูว่าต้องตัดทิ้งกี่แถวกว่าทุกกลุ่มจะมีอย่างน้อย 5 คน และข้อมูลหยาบลงแค่ไหน',
    band: 'ช่วงอายุ', zip: 'Zip', years: 'ปี', digits: 'หลัก',
    legend: [{ kind: 'new', text: 'ราคาที่ต้องจ่าย' }, { kind: 'use', text: 'สิ่งที่ยังเหลือ' }],
    k: 'กลุ่มที่เล็กสุดมี (k)', groups: 'จำนวนกลุ่ม', supp: 'แถวที่ต้องตัดทิ้งเพื่อให้ k ถึง 5', avg: 'ขนาดกลุ่มเฉลี่ย (ยิ่งใหญ่ ยิ่งหยาบ)', homo: 'กลุ่มที่ทุกคนมีผลวินิจฉัยเดียวกัน',
    suppNote: 'ตัดกลุ่มที่เล็กกว่า 5 คนออกทั้งกลุ่ม', homoTitle: 'ตัวอย่างกลุ่มที่ Release แล้วยังรั่ว', homoNote: 'ทุกคนในกลุ่มนี้มีผลวินิจฉัยเดียวกัน แค่รู้ Zip ช่วงอายุและเพศก็รู้ผลวินิจฉัยโดยไม่ต้องรู้ว่าเป็นใคร', homoOnly: 'ดูกลุ่มนี้ได้เมื่อเลือกช่วงอายุ 10 ปีและ Zip 3 หลัก',
    caption: 'ตัวเลขมาจากแบบฝึก 04 บนคนสมมติ 2,000 คน k ในตารางคือจำนวนคนในกลุ่มที่เล็กที่สุดก่อนตัดทิ้ง กลุ่มที่ทุกคนมีผลวินิจฉัยเดียวกันเกิดจากย่านที่คลินิกเฉพาะทางตั้งอยู่ ซึ่งผู้เขียนใส่ไว้ในข้อมูลจำลอง',
  },
  en: {
    title: 'Choose the width of the age band and the number of zip digits and see how many rows must be thrown away before every group holds at least 5 people, and how coarse the data gets',
    band: 'Age band', zip: 'Zip', years: 'years', digits: 'digits',
    legend: [{ kind: 'new', text: 'the price' }, { kind: 'use', text: 'what is left' }],
    k: 'smallest group (k)', groups: 'number of groups', supp: 'rows to throw away for k to reach 5', avg: 'average group size (bigger means coarser)', homo: 'groups where everybody has the same diagnosis',
    suppNote: 'every group smaller than 5 goes entirely', homoTitle: 'A group of the release that still leaks', homoNote: 'Everybody in this group has the same diagnosis. Knowing only the zip area, the age band and the sex tells the diagnosis, without knowing who the person is.', homoOnly: 'This group shows when the age band is 10 years and the zip is 3 digits',
    caption: 'The numbers come from exercise 04 on 2,000 synthetic people. k in the table is the size of the smallest group before suppression. The groups with a single diagnosis come from the area of a specialist clinic, which the author put into the synthetic data.',
  },
};

export default function KAnonLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [band, setBand] = useState(10);
  const [zip, setZip] = useState(3);
  const g = GRID[`${band}-${zip}`];
  const showEx = band === 10 && zip === 3;
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <span className="ib-lbl">{T.band}</span>
        <span className="seg" role="group" aria-label={T.band}>
          {[1, 5, 10, 20].map((b) => <button key={b} type="button" aria-pressed={band === b} onClick={() => setBand(b)}>{`${b} ${T.years}`}</button>)}
        </span>
        <span className="ib-lbl">{T.zip}</span>
        <span className="seg" role="group" aria-label={T.zip}>
          {[5, 3, 2].map((d) => <button key={d} type="button" aria-pressed={zip === d} onClick={() => setZip(d)}>{`${d} ${T.digits}`}</button>)}
        </span>
      </div>
      <Row>
        <Card style={{ flex: '2 1 360px' }}>
          <Bar label={T.supp} value={g.suppressed} max={N} text={`${num(g.suppressed)} (${pct(g.suppressed, N)})`} bad />
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: -2 }}>{T.suppNote}</div>
          <Bar label={T.avg} value={g.avg} max={170} text={String(g.avg)} />
          <Bar label={T.groups} value={g.groups} max={1100} text={num(g.groups)} />
          <div style={{ fontWeight: 700, marginTop: 6 }}>{`${T.k}: ${g.k}`}</div>
          <div style={{ fontWeight: 700, color: g.homogeneous > 0 ? 'var(--ib-bad)' : undefined }}>{`${T.homo}: ${g.homogeneous} (${g.homogeneousPeople})`}</div>
        </Card>
        <Card bad={showEx} style={{ flex: '1 1 260px' }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{T.homoTitle}</div>
          {showEx ? (
            <>
              <table className="mini-tbl" style={{ fontSize: 14 }}><thead><tr><th>zip</th><th>age</th><th>sex</th><th>diagnosis</th></tr></thead>
                <tbody>{EX.map((r, i) => <tr key={i}><td style={mono}>{r.zip}</td><td style={mono}>{`${r.age}s`}</td><td style={mono}>{r.sex}</td><td style={{ ...mono, color: 'var(--ib-bad)', fontWeight: 700 }}>{r.diagnosis}</td></tr>)}</tbody></table>
              <div style={{ fontSize: 14, marginTop: 8 }}>{T.homoNote}</div>
            </>
          ) : <div style={{ fontSize: 14, color: 'var(--muted)' }}>{T.homoOnly}</div>}
        </Card>
      </Row>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
