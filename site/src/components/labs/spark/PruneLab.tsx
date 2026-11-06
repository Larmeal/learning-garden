import { useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

const FOLDERS = ['jp', 'sg', 'th'];

type Q = 'all' | 'th' | 'jpsg' | 'sales';
type Lang = 'th' | 'en';

const QUERIES: Record<Q, { label: Record<Lang, string>; code: string; read: string[]; note: Record<Lang, string> }> = {
  all: {
    label: { th: 'ไม่กรอง', en: 'No filter' },
    code: 'spark.read.parquet(path)',
    read: FOLDERS,
    note: { th: 'ไม่มีเงื่อนไข ต้องอ่านทุกโฟลเดอร์', en: 'There is no condition, so every folder must be read' },
  },
  th: {
    label: { th: "country = 'th'", en: "country = 'th'" },
    code: 'spark.read.parquet(path).filter("country = \'th\'")',
    read: ['th'],
    note: {
      th: 'เงื่อนไขตรงกับคอลัมน์ที่ใช้ partitionBy Spark เลือกอ่านโฟลเดอร์ country=th โฟลเดอร์อื่นไม่ถูกเปิดเลย ใน explain() ดูบรรทัด PartitionFilters',
      en: 'The condition matches the column used in partitionBy. Spark reads only the folder country=th and never opens the other folders. In explain(), look at the PartitionFilters line.',
    },
  },
  jpsg: {
    label: { th: "country IN ('jp','sg')", en: "country IN ('jp','sg')" },
    code: 'spark.read.parquet(path).filter("country IN (\'jp\', \'sg\')")',
    read: ['jp', 'sg'],
    note: {
      th: 'ข้ามได้เฉพาะโฟลเดอร์ที่เงื่อนไขตัดออก เหลืออ่านสองในสามโฟลเดอร์',
      en: 'Only the folders that the condition rules out can be skipped. Two of the three folders are still read.',
    },
  },
  sales: {
    label: { th: 'sales > 100', en: 'sales > 100' },
    code: 'spark.read.parquet(path).filter("sales > 100")',
    read: FOLDERS,
    note: {
      th: 'sales ไม่ได้อยู่ในชื่อโฟลเดอร์ จึงตัดโฟลเดอร์ไม่ได้ ต้องเปิดทุกไฟล์ Parquet อาจข้ามบางส่วนภายในไฟล์ได้จากสถิติ min/max (ดู PushedFilters ใน explain())',
      en: 'sales is not in the folder name, so no folder can be ruled out and every file must be opened. Parquet may still skip some parts inside a file by using the min/max statistics (see PushedFilters in explain()).',
    },
  },
};

const TEXT: Record<Lang, { title: string; group: string; tree: string; open: string; skip: string; readout: (n: number, total: number) => ReactNode }> = {
  th: {
    title: 'เลือกเงื่อนไข แล้วดูว่า Spark เปิดโฟลเดอร์ไหนบ้าง',
    group: 'เงื่อนไขกรอง',
    tree: 'โครงสร้างโฟลเดอร์ที่ partitionBy สร้าง',
    open: 'เปิดอ่าน',
    skip: 'ข้าม',
    readout: (n, total) => <>เปิดอ่าน <b>{n}</b> จาก {total} โฟลเดอร์</>,
  },
  en: {
    title: 'Choose a condition and see which folders Spark opens',
    group: 'Filter condition',
    tree: 'Folder structure created by partitionBy',
    open: 'read',
    skip: 'skipped',
    readout: (n, total) => <>Read <b>{n}</b> of {total} folders</>,
  },
};

export default function PruneLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [q, setQ] = useState<Q>('th');
  const reduce = useReducedMotion();
  const cur = QUERIES[q];

  return (
    <figure className="viz">
      <div className="viz-title">{T.title}</div>
      <div className="lab-controls">
        <div className="seg" role="group" aria-label={T.group}>
          {(Object.keys(QUERIES) as Q[]).map((k) => (
            <button key={k} type="button" aria-pressed={q === k} onClick={() => setQ(k)}>{QUERIES[k].label[lang]}</button>
          ))}
        </div>
      </div>

      <div className="viz-box" style={{ padding: 16 }}>
        <div className="tree" role="tree" aria-label={T.tree}>
          <div className="tree-root mono">sales_parquet/</div>
          {FOLDERS.map((f) => {
            const read = cur.read.includes(f);
            return (
              <motion.div
                key={f}
                role="treeitem"
                aria-selected={read}
                className="tree-folder"
                animate={{ opacity: read ? 1 : 0.3 }}
                transition={{ duration: reduce ? 0 : 0.3 }}
                data-read={read || undefined}
              >
                <span className="mono">country={f}/</span>
                <span className="tree-file mono">part-00000.parquet</span>
                <span className="tree-tag">{read ? T.open : T.skip}</span>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="readout" aria-live="polite">
        <span>{T.readout(cur.read.length, FOLDERS.length)}</span>
      </div>
      <pre className="codeline">{cur.code}</pre>
      <p className="viz-caption">{cur.note[lang]}</p>
    </figure>
  );
}
