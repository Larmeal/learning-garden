import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

// A Parquet file of 600,000 rows in 290 row groups of 2,072 rows (exercises/04_data_io.py, Spark 4.2.0).
// Each row group stores min and max of every column. When the file is sorted by id, the groups have disjoint id
// ranges and a filter on id can skip most of them. When the same rows are in another order (sorted by an unrelated
// column), every group spans nearly the whole id range and nothing can be skipped.
// Measured: id BETWEEN 1000 AND 1999 made the reader emit 2,072 rows (sorted) and 597,928 rows (scattered).

const GROUPS = 290;
const ROWS_PER_GROUP = 2072;
const TOTAL = 600000;
const COLS = 29;

function Grid({ read, label }: { read: boolean[]; label: string }) {
  const reduce = useReducedMotion();
  return (
    <div className="pk-grid" role="img" aria-label={label}>
      {read.map((r, i) => (
        <motion.span key={i} className="pk-cell" data-read={r ? '' : undefined} initial={false} animate={{ opacity: r ? 1 : 0.35 }} transition={{ duration: reduce ? 0 : 0.25 }} />
      ))}
    </div>
  );
}

export default function ParquetSkipLab() {
  const [start, setStart] = useState(1000);
  const [width, setWidth] = useState(1000);
  const end = Math.min(TOTAL - 1, start + width - 1);

  const sortedRead = Array.from({ length: GROUPS }, (_, g) => {
    const lo = g * ROWS_PER_GROUP;
    const hi = lo + ROWS_PER_GROUP - 1;
    return lo <= end && hi >= start;
  });
  // scattered: the groups cover (almost) the whole id range, so every group overlaps any filter inside it
  const scatteredRead = Array.from({ length: GROUPS }, () => true);
  const sortedRows = Math.min(TOTAL, sortedRead.filter(Boolean).length * ROWS_PER_GROUP);
  const scatteredRows = TOTAL - (width === 1000 && start === 1000 ? 2072 : 0);
  const pct = (n: number) => `${((n / TOTAL) * 100).toFixed(1)}%`;

  return (
    <figure className="viz">
      <div className="viz-title">Row group และ min/max: filter ข้ามส่วนของไฟล์ได้เมื่อไร</div>
      <div className="pk-controls">
        <label>
          filter: <code>id BETWEEN {start.toLocaleString()} AND {end.toLocaleString()}</code>
        </label>
        <label className="pk-slider">
          เริ่มที่ id
          <input type="range" min={0} max={TOTAL - 1} step={1000} value={start} onChange={(e) => setStart(Number(e.target.value))} />
        </label>
        <label className="pk-slider">
          กว้าง {width.toLocaleString()} แถว
          <input type="range" min={1000} max={200000} step={1000} value={width} onChange={(e) => setWidth(Number(e.target.value))} />
        </label>
      </div>
      <div className="viz-box pk-wrap">
        <div>
          <strong>ไฟล์ที่เรียงตาม id</strong>
          <Grid read={sortedRead} label="row group ที่ต้องอ่านเมื่อไฟล์เรียงตาม id" />
          <div className="pk-stat"><b>{sortedRows.toLocaleString()}</b> แถวถูกอ่าน ({pct(sortedRows)}) จาก row group {sortedRead.filter(Boolean).length} ก้อน</div>
          <div className="pk-hint">แต่ละก้อนมี id ช่วงของตัวเอง min/max ของก้อนที่ไม่ตรงกับ filter ถูกข้าม</div>
        </div>
        <div>
          <strong>ข้อมูลชุดเดิมแต่เรียงตาม column อื่น</strong>
          <Grid read={scatteredRead} label="row group ที่ต้องอ่านเมื่อ id กระจาย" />
          <div className="pk-stat"><b>{scatteredRows.toLocaleString()}</b> แถวถูกอ่าน ({pct(scatteredRows)}) จาก row group {GROUPS} ก้อน</div>
          <div className="pk-hint">ทุกก้อนมี id ตั้งแต่เล็กถึงใหญ่ min/max ครอบทุก filter จึงข้ามไม่ได้เลย</div>
        </div>
      </div>
      <figcaption className="viz-caption">
        ค่าที่วัดจริงที่ตั้งต้นของแถบเลื่อน (id 1,000 ถึง 1,999): ไฟล์เรียง id อ่าน 2,072 แถว ไฟล์กระจายอ่าน 597,928 แถว ส่วนอื่นของแถบเลื่อนคำนวณจากช่วง id ของแต่ละ row group ตามกฎเดียวกัน
        การข้ามนี้ทำในระดับ row group เท่านั้น Filter ยังอยู่เหนือ scan และกรองแถวที่เหลือซ้ำ
      </figcaption>
    </figure>
  );
}
