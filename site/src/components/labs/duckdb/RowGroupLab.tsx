import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend, Node } from '../iceberg/ib';
import data from './storage.json';

// Shows:      a table of one million rows cut into nine row groups, each with the time range of its rows, and which groups the scan has to read for the filter we pick.
// Because:    skipping a row group depends on whether its min-to-max range overlaps the filter, and the way to see that is to put the nine ranges in a row.
// Control:    the filter (six choices). Each one lights a different set of groups and changes the number of rows looked at.
// Conclusion: a filter on a column whose ranges do not overlap (order_ts, order_id) reads one or two groups, and a filter on a column whose range is the same in every group
//             (customer_id, status) reads all nine, although it may match very few rows.
//
// Groups, ranges, rows looked at and rows matched come from exercises/07_storage.py --write (storage.json): pragma_storage_info and the engine's profile. The exercise
// asserted that the groups drawn as read hold exactly the rows that the scan looked at.

const TEXT: Record<Lang, { title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; pick: string; labels: Record<string, string>; looked: string; matched: string; group: string; read: string; skipped: string; of: string; readout: (n: number, scanned: number, passed: number) => string; caption: string }> = {
  th: {
    title: 'เลือก Filter แล้วดูว่า Row group ไหนถูกอ่าน ดูจากช่วงเวลาของแต่ละกลุ่ม',
    legend: [{ kind: 'new', text: 'Row group ที่ต้องอ่าน' }, { kind: 'skip', text: 'Row group ที่ข้ามได้' }],
    pick: 'Filter',
    labels: {
      "order_ts >= '2025-12-26' (the last days)": 'order_ts ท้ายปี', 'order_ts in March': 'order_ts เดือนมีนาคม', 'order_id = 777': 'order_id = 777', 'customer_id = 5': 'customer_id = 5', "status = 'refunded'": "status = 'refunded'", 'no filter': 'ไม่มี Filter',
    },
    looked: 'แถวที่ Scan ดู', matched: 'แถวที่ตรง', group: 'กลุ่ม', read: 'อ่าน', skipped: 'ข้าม', of: 'จาก',
    readout: (n, scanned, passed) => (n === 9
      ? `ต้องอ่านครบทั้ง 9 กลุ่ม (${scanned.toLocaleString()} แถว) เพราะช่วง min ถึง max ของคอลัมน์นี้ครอบค่าที่เราหาไว้ในทุกกลุ่ม ทั้งที่มีแถวตรงเพียง ${passed.toLocaleString()} แถว`
      : `อ่านแค่ ${n} กลุ่ม (${scanned.toLocaleString()} แถว) ข้ามอีก ${9 - n} กลุ่มได้โดยไม่ต้องเปิดข้อมูล เพราะช่วง min ถึง max ของกลุ่มเหล่านั้นไม่ทับ Filter มีแถวตรง ${passed.toLocaleString()} แถว`),
    caption: 'ช่วงเวลาของแต่ละกลุ่ม จำนวนแถวที่ Scan ดู และจำนวนแถวที่ตรงมาจากแบบฝึก 07 (pragma_storage_info กับ Profile ของ Engine) ในแบบฝึก แถวของกลุ่มที่ถูกอ่านรวมกันเท่ากับแถวที่ Scan ดูทุก Filter',
  },
  en: {
    title: 'Pick a filter and see which row groups are read, judging by the time range of each group',
    legend: [{ kind: 'new', text: 'row group that must be read' }, { kind: 'skip', text: 'row group that can be skipped' }],
    pick: 'filter',
    labels: {
      "order_ts >= '2025-12-26' (the last days)": 'order_ts at year end', 'order_ts in March': 'order_ts in March', 'order_id = 777': 'order_id = 777', 'customer_id = 5': 'customer_id = 5', "status = 'refunded'": "status = 'refunded'", 'no filter': 'no filter',
    },
    looked: 'rows the scan looked at', matched: 'rows that matched', group: 'group', read: 'read', skipped: 'skipped', of: 'of',
    readout: (n, scanned, passed) => (n === 9
      ? `All 9 groups must be read (${scanned.toLocaleString()} rows), because the min-to-max range of this column covers the value we look for in every group, although only ${passed.toLocaleString()} rows match.`
      : `Only ${n} group${n > 1 ? 's' : ''} read (${scanned.toLocaleString()} rows). The other ${9 - n} can be skipped without opening their data, because their min-to-max range does not overlap the filter. ${passed.toLocaleString()} rows match.`),
    caption: 'The time range of each group, the rows the scan looked at and the rows that matched come from exercise 07 (pragma_storage_info and the profile of the engine). In the exercise the rows of the groups that are read add up to the rows the scan looked at, for every filter.',
  },
};

export default function RowGroupLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [k, setK] = useState(0);
  const f = data.filters[k];
  const keep = f.groups;
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.pick}</span>
        <span className="seg" role="group" aria-label={T.pick}>
          {data.filters.map((x, i) => (
            <button key={x.filter} type="button" aria-pressed={k === i} onClick={() => setK(i)}>{T.labels[x.filter]}</button>
          ))}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 330" role="img" aria-label={T.title}>
          {data.groups.map((g, i) => {
            const col = i % 5;
            const row = Math.floor(i / 5);
            const x = 14 + col * 172;
            const y = 14 + row * 104;
            const on = keep.includes(g.id);
            return (
              <g key={g.id}>
                <Node x={x} y={y} w={160} h={90} title={`${T.group} ${g.id}`} sub={`${g.min.slice(5, 10)} → ${g.max.slice(5, 10)}`} state={on ? 'new' : 'skip'} tag={on ? T.read : T.skipped} mono />
                <text x={x + 12} y={y + 80} className="ib-s">{`${g.rows.toLocaleString()}`}</text>
              </g>
            );
          })}
          <text x={14 + 4 * 172} y={14 + 104 + 30} className="ib-s">{T.looked}</text>
          <text x={14 + 4 * 172} y={14 + 104 + 70} className="ib-big" style={{ fontSize: 30 }}>{f.scanned.toLocaleString()}</text>
          <text x={14} y={256} className="ib-n">{`${T.looked}: ${f.scanned.toLocaleString()} ${T.of} 1,000,000`}</text>
          <text x={14} y={284} className="ib-n">{`${T.matched}: ${f.passed.toLocaleString()}`}</text>
          <rect className="ib-skip" x={14} y={298} width={852} height={16} rx={8} />
          <rect className="ib-new" x={14} y={298} width={Math.max(6, (852 * f.scanned) / 1_000_000)} height={16} rx={8} />
        </svg>
      </div>
      <div className="readout" aria-live="polite"><div>{T.readout(keep.length, f.scanned, f.passed)}</div></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
