import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

const FOLDERS = ['jp', 'sg', 'th'];

type Q = 'all' | 'th' | 'jpsg' | 'sales';
const QUERIES: Record<Q, { label: string; code: string; read: string[]; note: string }> = {
  all: {
    label: 'ไม่กรอง',
    code: 'spark.read.parquet(path)',
    read: FOLDERS,
    note: 'ไม่มีเงื่อนไข ต้องอ่านทุกโฟลเดอร์',
  },
  th: {
    label: "country = 'th'",
    code: 'spark.read.parquet(path).filter("country = \'th\'")',
    read: ['th'],
    note: 'เงื่อนไขตรงกับคอลัมน์ที่ใช้ partitionBy Spark เลือกอ่านโฟลเดอร์ country=th โฟลเดอร์อื่นไม่ถูกเปิดเลย ใน explain() ดูบรรทัด PartitionFilters',
  },
  jpsg: {
    label: "country IN ('jp','sg')",
    code: 'spark.read.parquet(path).filter("country IN (\'jp\', \'sg\')")',
    read: ['jp', 'sg'],
    note: 'ข้ามได้เฉพาะโฟลเดอร์ที่เงื่อนไขตัดออก เหลืออ่านสองในสามโฟลเดอร์',
  },
  sales: {
    label: 'sales > 100',
    code: 'spark.read.parquet(path).filter("sales > 100")',
    read: FOLDERS,
    note: 'sales ไม่ได้อยู่ในชื่อโฟลเดอร์ จึงตัดโฟลเดอร์ไม่ได้ ต้องเปิดทุกไฟล์ Parquet อาจข้ามบางส่วนภายในไฟล์ได้จากสถิติ min/max (ดู PushedFilters ใน explain())',
  },
};

export default function PruneLab() {
  const [q, setQ] = useState<Q>('th');
  const reduce = useReducedMotion();
  const cur = QUERIES[q];

  return (
    <figure className="viz">
      <div className="viz-title">เลือกเงื่อนไข แล้วดูว่า Spark เปิดโฟลเดอร์ไหนบ้าง</div>
      <div className="lab-controls">
        <div className="seg" role="group" aria-label="เงื่อนไขกรอง">
          {(Object.keys(QUERIES) as Q[]).map((k) => (
            <button key={k} type="button" aria-pressed={q === k} onClick={() => setQ(k)}>{QUERIES[k].label}</button>
          ))}
        </div>
      </div>

      <div className="viz-box" style={{ padding: 16 }}>
        <div className="tree" role="tree" aria-label="โครงสร้างโฟลเดอร์ที่ partitionBy สร้าง">
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
                <span className="tree-tag">{read ? 'เปิดอ่าน' : 'ข้าม'}</span>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="readout" aria-live="polite">
        <span>เปิดอ่าน <b>{cur.read.length}</b> จาก {FOLDERS.length} โฟลเดอร์</span>
      </div>
      <pre className="codeline">{cur.code}</pre>
      <p className="viz-caption">{cur.note}</p>
    </figure>
  );
}
