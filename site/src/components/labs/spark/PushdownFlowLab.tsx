import { ClockControls, mix, prog, smooth, useClock, type Lang, type Mark } from './timeline';

// What the optimizer buys: the same query before and after two rules, drawn as rows flowing up a plan tree.
//   SELECT c.name, o.total FROM orders o JOIN customers c ON o.cid = c.id WHERE o.status = 'paid'
// Rules: PushDownPredicates (Filter moves under the Join), data source filter pushdown (Parquet row groups can be
// skipped, lesson 4) and ColumnPruning (Optimizer.scala, lesson 6). The row counts are made up for the picture
// (1,000,000 orders, 20% paid, 10,000 customers); the shape of the plan change is what Catalyst does.

const DURATION = 15;
type P = [number, number];

const ORIG = { project: [440, 44] as P, filter: [440, 124] as P, join: [440, 204] as P, scanO: [270, 300] as P, scanC: [610, 300] as P };
const OPT = { project: [440, 44] as P, filter: [270, 212] as P, join: [440, 124] as P, scanO: [270, 300] as P, scanC: [610, 300] as P };
const COLS = ['id', 'cid', 'total', 'status', 'address', 'notes'];
const KEEP = [false, true, true, true, false, false];

interface Edge {
  a: P;
  b: P;
  n: number;
  cls: string;
  label: string;
}

function Flow({ e, t, opacity }: { e: Edge; t: number; opacity: number }) {
  if (opacity <= 0.01) return null;
  const x0 = e.a[0];
  const y0 = e.a[1] - 21;
  const x1 = e.b[0];
  const y1 = e.b[1] + 21;
  return (
    <g opacity={opacity}>
      <line x1={x0} y1={y0} x2={x1} y2={y1} className="ln" opacity="0.5" />
      {Array.from({ length: e.n }, (_, i) => {
        const f = (t * 0.45 + i / e.n) % 1;
        return <circle key={i} cx={mix(x0, x1, f)} cy={mix(y0, y1, f)} r="4.5" className={e.cls} />;
      })}
      <text className="s m" x={(x0 + x1) / 2 + (x1 === x0 ? 12 : x1 > x0 ? 10 : -10)} y={(y0 + y1) / 2 + 4} textAnchor={x1 === x0 || x1 > x0 ? 'start' : 'end'} stroke="var(--surface-2)" strokeWidth="4" paintOrder="stroke">{e.label}</text>
    </g>
  );
}

function Node({ at, label, sub, hot, w = 160 }: { at: P; label: string; sub?: string; hot?: boolean; w?: number }) {
  return (
    <g transform={`translate(${at[0]} ${at[1]})`}>
      <rect x={-w / 2} y={-21} width={w} height={42} rx="8" className={hot ? 'fx-hot' : 'box'} />
      <text className="b m" y={sub ? -3 : 5} textAnchor="middle" style={{ fontSize: 12.5 }}>{label}</text>
      {sub && <text className="s m" y={13} textAnchor="middle">{sub}</text>}
    </g>
  );
}

const MARKS: Record<Lang, Mark[]> = {
  th: [
    { at: 0, name: 'แผนตั้งต้น', title: 'แผนตามที่เขียน คือ Join ก่อนแล้วค่อย Filter', text: 'ตารางใหญ่ทั้ง 1,000,000 แถวต้องเข้า Join ก่อน แล้วค่อยถูกกรองทิ้งไป 80% ทีหลัง จุดทุกจุดที่วิ่งขึ้นไปคือแถวที่ต้องถูกส่ง จับคู่ และเก็บไว้ในหน่วยความจำ' },
    { at: 3, name: 'ย้าย Filter ลง', title: 'PushDownPredicates: Filter ย้ายลงไปใต้ Join', text: 'เงื่อนไข status = \'paid\' ใช้แค่ Column ของตาราง orders จึงทำก่อน Join ได้และผลลัพธ์เท่าเดิม แต่ Join จะรับแถวน้อยลงเหลือ 200,000 (ของ orders)' },
    { at: 6.5, name: 'ลงถึง Scan', title: 'Scan รับเงื่อนไขไปใช้ตอนอ่านไฟล์', text: 'กับ Parquet ตัว Scan จะใช้สถิติของแต่ละ Row Group เพื่อข้ามก้อนที่ไม่มีทางตรงเงื่อนไข (บทที่ 4 วัดได้ว่าอ่านเหลือ 2,072 จาก 600,000 แถว เมื่อข้อมูลเรียงตาม Column ที่กรอง) ส่วน Filter ยังอยู่เหนือ Scan เพื่อกรองแถวที่หลุดมา' },
    { at: 9, name: 'ตัด Column', title: 'ColumnPruning: อ่านเฉพาะ Column ที่มีคนใช้', text: 'คำสั่งนี้ใช้แค่ cid, total และ status ส่วน id, address, notes จะไม่ถูกอ่านจากไฟล์ เพราะ Parquet เก็บข้อมูลเป็น Column จึงข้ามไปได้จริง' },
    { at: 10.5, name: 'ผลลัพธ์', title: 'คำสั่งเดิม คำตอบเดิม แต่งานน้อยลงมาก', text: 'แถวที่เข้า Join ลดจาก 1,010,000 เป็น 210,000 และอ่าน Column แค่ 3 จาก 6 ผลลัพธ์ไม่เปลี่ยน เพราะ Catalyst ย้ายได้เฉพาะสิ่งที่ไม่ทำให้ความหมายเปลี่ยน' },
  ],
  en: [
    { at: 0, name: 'Original plan', title: 'The plan as written: join first, then filter', text: 'The big table with all 1,000,000 rows must enter the Join, and then 80% of it is thrown away by the filter. Every dot moving up is a row that must be sent, matched and kept in memory.' },
    { at: 3, name: 'Move Filter down', title: 'PushDownPredicates: the Filter moves below the Join', text: 'The condition status = \'paid\' uses only columns of the orders table, so it can run before the join with the same result. But the Join now receives fewer rows: 200,000 (from orders).' },
    { at: 6.5, name: 'Down to Scan', title: 'The Scan takes the condition and uses it while reading files', text: 'With Parquet, the Scan uses the statistics of each row group to skip the chunks that cannot match (lesson 4 measured that only 2,072 of 600,000 rows were read when the data was sorted by the filtered column). The Filter stays above the Scan to remove rows that slip through.' },
    { at: 9, name: 'Prune columns', title: 'ColumnPruning: read only the columns that someone uses', text: 'The query uses only cid, total and status. The columns id, address and notes are not read from the file (Parquet stores data by column, so it can really skip them).' },
    { at: 10.5, name: 'Result', title: 'The same query, the same answer, much less work', text: 'The rows entering the Join drop from 1,010,000 to 210,000, and 3 of 6 columns are read. The result does not change because Catalyst can only move things that keep the meaning.' },
  ],
};

const TEXT = {
  th: {
    title: 'Optimizer ทำให้งานน้อยลงได้อย่างไร ดูแถวไหลขึ้นตาม Plan',
    aria: 'แผนของ Query ที่ Filter ถูกย้ายลงไปใต้ Join แล้ว Scan ตัด Column',
    fewer: 'น้อยลง',
    colsRead: 'Column ของ orders ที่ถูกอ่าน:',
    rowsIn: 'แถวที่เข้า Join',
    colsFrom: 'Column ที่อ่านจาก orders',
    of: (a: number, b: number) => `${a} จาก ${b}`,
    note: 'ตัวเลขจำนวนแถวเป็นสัดส่วนสมมติเพื่อให้เห็นภาพ ส่วนการย้าย Node เป็นสิ่งที่ Catalyst ทำจริง',
    capBefore: 'จุดที่วิ่งขึ้นไปคือกลุ่มของแถว (1 จุด = 100,000 แถว) ชื่อ Rule มาจาก Optimizer.scala ใน Spark 4.2.0 ส่วนถ้าอยากดูแผนจริงของ Query ของคุณ ให้ใช้ ',
  },
  en: {
    title: 'How the optimizer cuts the work: watch rows flow up the plan',
    aria: 'Query plan where the Filter moves below the Join and the Scan prunes columns',
    fewer: 'fewer',
    colsRead: 'Columns of orders that are read:',
    rowsIn: 'Rows entering Join',
    colsFrom: 'Columns read',
    of: (a: number, b: number) => `${a} of ${b}`,
    note: 'Row counts are made-up proportions for the picture. The way the nodes move is what Catalyst really does.',
    capBefore: 'Each dot moving up is a group of rows (1 dot = 100,000 rows). The rule names come from Optimizer.scala in Spark 4.2.0. To see the real plan of your own query, use ',
  },
};

export default function PushdownFlowLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const clock = useClock(DURATION);
  const { t } = clock;
  const u1 = smooth(prog(t, 3, 5.5));
  const u2 = smooth(prog(t, 6.5, 7.5));
  const u3 = smooth(prog(t, 9, 10.2));

  // The Filter first steps aside, then it moves down while the Join moves up, so the two boxes never cross.
  const side = smooth(prog(u1, 0, 0.5));
  const down = smooth(prog(u1, 0.5, 1));
  const filter: P = [mix(ORIG.filter[0], OPT.filter[0], side), mix(ORIG.filter[1], OPT.filter[1], down)];
  const join: P = [ORIG.join[0], mix(ORIG.join[1], OPT.join[1], down)];
  const { project, scanO, scanC } = ORIG;

  const before: Edge[] = [
    { a: scanO, b: join, n: 10, cls: 'k1', label: '1,000,000' },
    { a: scanC, b: join, n: 1, cls: 'k3', label: '10,000' },
    { a: join, b: filter, n: 10, cls: 'k2', label: '1,000,000' },
    { a: filter, b: project, n: 2, cls: 'k2', label: '200,000' },
  ];
  const after: Edge[] = [
    { a: scanO, b: filter, n: u2 > 0.5 ? 4 : 10, cls: 'k1', label: u2 > 0.5 ? T.fewer : '1,000,000' },
    { a: filter, b: join, n: 2, cls: 'k1', label: '200,000' },
    { a: scanC, b: join, n: 1, cls: 'k3', label: '10,000' },
    { a: join, b: project, n: 2, cls: 'k2', label: '200,000' },
  ];

  const inJoin = Math.round(mix(1010000, 210000, u1));
  const colsRead = KEEP.filter(Boolean).length;

  return (
    <figure className="viz lg">
      <div className="viz-title">{T.title}</div>
      <div className="viz-box">
        <svg viewBox="0 0 880 440" role="img" aria-label={T.aria}>
          <rect className="band" x="10" y="10" width="860" height="420" rx="12" />
          <Flow e={before[0]} t={t} opacity={1 - u1} />
          <Flow e={before[1]} t={t} opacity={1 - u1} />
          <Flow e={before[2]} t={t} opacity={1 - u1} />
          <Flow e={before[3]} t={t} opacity={1 - u1} />
          <Flow e={after[0]} t={t} opacity={u1} />
          <Flow e={after[1]} t={t} opacity={u1} />
          <Flow e={after[2]} t={t} opacity={u1} />
          <Flow e={after[3]} t={t} opacity={u1} />

          <Node at={project} label="Project name, total" />
          <Node at={filter} label="Filter status = 'paid'" hot={u1 > 0.05 && u1 < 0.98} w={178} />
          <Node at={join} label="Join cid = id" />
          <Node at={scanO} label="Scan orders" sub={u2 > 0.5 ? 'PushedFilters: status' : 'Parquet'} hot={u2 > 0.5} w={190} />
          <Node at={scanC} label="Scan customers" sub="Parquet" w={190} />

          {/* columns read from orders */}
          <text className="s" x="60" y="352">{T.colsRead}</text>
          {COLS.map((c, i) => {
            const gone = !KEEP[i] && u3 > 0.5;
            return (
              <g key={c} transform={`translate(${60 + i * 66} 362)`}>
                <rect width="60" height="24" rx="5" className={gone ? 'box' : 'fx-file'} strokeDasharray={gone ? '3 3' : undefined} opacity={gone ? 0.45 : 1} />
                <text className="s m" x="30" y="16" textAnchor="middle" textDecoration={gone ? 'line-through' : undefined}>{c}</text>
              </g>
            );
          })}

          <g transform="translate(700 130)">
            <rect className="box" width="150" height="104" rx="8" />
            <text className="s" x="12" y="22">{T.rowsIn}</text>
            <text className="big num" x="12" y="52">{inJoin.toLocaleString('en-US')}</text>
            <text className="s" x="12" y="78">{T.colsFrom}</text>
            <text className="b num" x="12" y="96">{T.of(u3 > 0.5 ? colsRead : COLS.length, COLS.length)}</text>
          </g>
          <text className="s" x="28" y="414">{T.note}</text>
        </svg>
      </div>
      <ClockControls clock={clock} marks={MARKS[lang]} lang={lang} />
      <figcaption className="viz-caption">{T.capBefore}<code>df.explain("formatted")</code></figcaption>
    </figure>
  );
}
