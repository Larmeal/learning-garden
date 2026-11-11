import { useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { Lang } from './stepper';

type Row = { country: string; city: string; sales: number | null };
const ROWS: Row[] = [
  { country: 'th', city: 'bkk', sales: 120 },
  { country: 'th', city: 'cnx', sales: 80 },
  { country: 'jp', city: 'tyo', sales: 200 },
  { country: 'jp', city: 'osa', sales: null },
  { country: 'sg', city: 'sin', sales: 90 },
];

type Filter = 'none' | 'gt' | 'notnull';
type Agg = 'none' | 'sum' | 'count_col' | 'count_star';

const FILTERS: Record<Filter, { label: string; test: (r: Row) => boolean; df: string; sql: string }> = {
  none: { label: 'ไม่กรอง', test: () => true, df: '', sql: '' },
  gt: { label: 'sales > 100', test: (r) => r.sales !== null && r.sales > 100, df: '.filter(F.col("sales") > 100)', sql: 'WHERE sales > 100' },
  notnull: { label: 'sales IS NOT NULL', test: (r) => r.sales !== null, df: '.filter(F.col("sales").isNotNull())', sql: 'WHERE sales IS NOT NULL' },
};
const AGGS: Record<Agg, { label: string; name: string; df: string; sql: string }> = {
  none: { label: 'ไม่รวม', name: '', df: '', sql: '' },
  sum: { label: 'sum(sales)', name: 'total', df: 'F.sum("sales")', sql: 'SUM(sales)' },
  count_col: { label: 'count(sales)', name: 'n_sales', df: 'F.count("sales")', sql: 'COUNT(sales)' },
  count_star: { label: 'count(*)', name: 'n_rows', df: 'F.count("*")', sql: 'COUNT(*)' },
};

function metric(rows: Row[], agg: Agg): number | null {
  if (agg === 'count_star') return rows.length;
  const vals = rows.map((r) => r.sales).filter((v): v is number => v !== null);
  if (agg === 'count_col') return vals.length;
  return vals.length === 0 ? null : vals.reduce((a, b) => a + b, 0); // sum of nothing is NULL
}

const TEXT = {
  th: {
    noFilter: 'ไม่กรอง',
    noAgg: 'ไม่รวม',
    title: 'ลองประกอบคำสั่ง แล้วดูผลลัพธ์กับโค้ดทั้งสองแบบ',
    filterAria: 'เงื่อนไขกรอง',
    aggAria: 'ฟังก์ชันรวมค่า',
    source: 'ตารางต้นทาง (df)',
    result: 'ผลลัพธ์',
    noRows: 'ไม่มีแถว',
    sqlLabel: 'Spark SQL (หลัง createOrReplaceTempView("t"))',
    caption: 'ลองเทียบ count(sales) กับ count(*) โดยไม่กรอง เราจะได้ 4 กับ 5 เพราะแถว osa มี sales เป็น NULL ส่วน sum จะข้าม NULL ไปเฉย ๆ จึงได้ 490 และเงื่อนไข sales > 100 ก็ตัดแถว NULL ทิ้งด้วย เพราะเมื่อเอา NULL ไปเทียบกับตัวเลข ผลที่ได้เป็น NULL ไม่ได้เป็น true',
  },
  en: {
    noFilter: 'No filter',
    noAgg: 'No aggregate',
    title: 'Build a query and see the result and the code in both styles',
    filterAria: 'Filter condition',
    aggAria: 'Aggregate function',
    source: 'Source table (df)',
    result: 'Result',
    noRows: 'No rows',
    sqlLabel: 'Spark SQL (after createOrReplaceTempView("t"))',
    caption: 'Try count(sales) against count(*) with no filter. You get 4 and 5, because the osa row has NULL in sales. sum simply skips NULL, so it gives 490. The condition sales > 100 also drops the NULL row, because comparing NULL with a number gives NULL, not true.',
  },
};

export default function QueryLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const labelOf = (kind: 'f' | 'a', k: string) =>
    kind === 'f' ? (k === 'none' ? T.noFilter : FILTERS[k as Filter].label) : k === 'none' ? T.noAgg : AGGS[k as Agg].label;
  const [filter, setFilter] = useState<Filter>('none');
  const [agg, setAgg] = useState<Agg>('sum');
  const [group, setGroup] = useState(true);
  const reduce = useReducedMotion();
  const gid = useId();

  const grouped = group && agg !== 'none';
  const rows = ROWS.filter(FILTERS[filter].test);
  const a = AGGS[agg];

  let head: string[];
  let body: { key: string; cells: (string | number | null)[] }[];
  if (agg === 'none') {
    head = ['country', 'city', 'sales'];
    body = rows.map((r) => ({ key: r.city, cells: [r.country, r.city, r.sales] }));
  } else if (grouped) {
    head = ['country', a.name];
    const countries = [...new Set(rows.map((r) => r.country))].sort();
    body = countries.map((c) => ({ key: c, cells: [c, metric(rows.filter((r) => r.country === c), agg)] }));
  } else {
    head = [a.name];
    body = [{ key: 'all', cells: [metric(rows, agg)] }];
  }

  const dfCode = ['df', FILTERS[filter].df && `  ${FILTERS[filter].df}`, grouped && '  .groupBy("country")', agg !== 'none' && `  .agg(${a.df}.alias("${a.name}"))`, grouped && '  .orderBy("country")']
    .filter(Boolean)
    .join('\n');
  const select = agg === 'none' ? '*' : grouped ? `country, ${a.sql} AS ${a.name}` : `${a.sql} AS ${a.name}`;
  const sqlCode = [`SELECT ${select}`, 'FROM t', FILTERS[filter].sql, grouped && 'GROUP BY country', grouped && 'ORDER BY country'].filter(Boolean).join('\n');

  return (
    <figure className="viz">
      <div className="viz-title">{T.title}</div>

      <div className="lab-controls">
        <div className="seg" role="group" aria-label={T.filterAria}>
          {(Object.keys(FILTERS) as Filter[]).map((k) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{labelOf('f', k)}</button>
          ))}
        </div>
        <div className="seg" role="group" aria-label={T.aggAria}>
          {(Object.keys(AGGS) as Agg[]).map((k) => (
            <button key={k} type="button" aria-pressed={agg === k} onClick={() => setAgg(k)}>{labelOf('a', k)}</button>
          ))}
        </div>
        <label className="check" htmlFor={gid}>
          <input id={gid} type="checkbox" checked={group} disabled={agg === 'none'} onChange={(e) => setGroup(e.target.checked)} />
          groupBy country
        </label>
      </div>

      <div className="query-grid">
        <div>
          <div className="lab-label">{T.source}</div>
          <div className="tbl-wrap">
            <table className="mini-tbl">
              <thead><tr><th>country</th><th>city</th><th>sales</th></tr></thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.city} className={FILTERS[filter].test(r) ? undefined : 'dim'}>
                    <td>{r.country}</td>
                    <td>{r.city}</td>
                    <td className={r.sales === null ? 'is-null' : undefined}>{r.sales === null ? 'NULL' : r.sales}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <div className="lab-label">{T.result}</div>
          <div className="tbl-wrap">
            <table className="mini-tbl result">
              <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                <AnimatePresence initial={false} mode="popLayout">
                  {body.length === 0 && (
                    <tr><td colSpan={head.length} className="is-null">{T.noRows}</td></tr>
                  )}
                  {body.map((r) => (
                    <motion.tr key={r.key} layout={!reduce} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduce ? undefined : { opacity: 0 }}>
                      {r.cells.map((v, i) => (
                        <td key={i} className={v === null ? 'is-null' : undefined}>{v === null ? 'NULL' : v}</td>
                      ))}
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="code-pair">
        <div>
          <div className="lab-label">DataFrame API</div>
          <pre className="codeline">{dfCode}</pre>
        </div>
        <div>
          <div className="lab-label">{T.sqlLabel}</div>
          <pre className="codeline">{sqlCode}</pre>
        </div>
      </div>
      <p className="viz-caption">
        {T.caption}
      </p>
    </figure>
  );
}
