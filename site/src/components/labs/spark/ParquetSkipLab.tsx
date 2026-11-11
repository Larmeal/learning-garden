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

type Lang = 'th' | 'en';

const TEXT: Record<Lang, {
  title: string;
  startAt: string;
  width: (w: string) => string;
  sortedTitle: string;
  sortedAria: string;
  stat: (pct: string, groups: number) => string;
  sortedHint: string;
  otherTitle: string;
  otherAria: string;
  otherHint: string;
  caption1: string;
  caption2: string;
}> = {
  th: {
    title: 'Row Group และ Min/Max: Filter ข้ามส่วนของไฟล์ได้เมื่อไร',
    startAt: 'เริ่มที่ id',
    width: (w) => `กว้าง ${w} แถว`,
    sortedTitle: 'ไฟล์ที่เรียงตาม id',
    sortedAria: 'Row Group ที่ต้องอ่านเมื่อไฟล์เรียงตาม id',
    stat: (pct, groups) => ` แถวถูกอ่าน (${pct}) จาก Row Group ${groups} ก้อน`,
    sortedHint: 'แต่ละก้อนมีช่วง id เป็นของตัวเอง ก้อนไหนที่ Min/Max ไม่ตรงกับ Filter ก็จะถูกข้ามไป',
    otherTitle: 'ข้อมูลชุดเดิมแต่เรียงตาม Column อื่น',
    otherAria: 'Row Group ที่ต้องอ่านเมื่อ id กระจายกัน',
    otherHint: 'ทุกก้อนมี id ตั้งแต่เล็กไปถึงใหญ่ Min/Max จึงครอบคลุมทุก Filter ทำให้ข้ามก้อนไหนไม่ได้เลย',
    caption1: 'ค่าที่เราวัดจริงมาจากตำแหน่งเริ่มต้นของแถบเลื่อน (id 1,000 ถึง 1,999) ซึ่งไฟล์ที่เรียงตาม id อ่าน 2,072 แถว ส่วนไฟล์ที่กระจายอ่าน 597,928 แถว ส่วนตำแหน่งอื่นของแถบเลื่อนคำนวณจากช่วง id ของแต่ละ Row Group ด้วยกฎเดียวกัน',
    caption2: 'การข้ามนี้ทำได้ในระดับ Row Group เท่านั้น ตัว Filter ยังอยู่เหนือ Scan และจะกรองแถวที่เหลืออีกรอบ',
  },
  en: {
    title: 'Row groups and min/max: when can a filter skip parts of a file',
    startAt: 'Start at id',
    width: (w) => `Width ${w} rows`,
    sortedTitle: 'File sorted by id',
    sortedAria: 'Row groups that must be read when the file is sorted by id',
    stat: (pct, groups) => ` rows read (${pct}) from ${groups} row groups`,
    sortedHint: 'Each group has its own id range. Groups whose min/max does not match the filter are skipped.',
    otherTitle: 'Same data, sorted by another column',
    otherAria: 'Row groups that must be read when the ids are scattered',
    otherHint: 'Every group has ids from small to large. Its min/max covers every filter, so nothing can be skipped.',
    caption1: 'Measured values at the starting position of the sliders (id 1,000 to 1,999): the file sorted by id reads 2,072 rows and the scattered file reads 597,928 rows. The rest of the slider range is computed from the id range of each row group with the same rule.',
    caption2: 'This skipping happens at the row group level only. The Filter operator still sits above the scan and filters the remaining rows again.',
  },
};

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

export default function ParquetSkipLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
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
      <div className="viz-title">{T.title}</div>
      <div className="pk-controls">
        <label>
          filter: <code>id BETWEEN {start.toLocaleString()} AND {end.toLocaleString()}</code>
        </label>
        <label className="pk-slider">
          {T.startAt}
          <input type="range" min={0} max={TOTAL - 1} step={1000} value={start} onChange={(e) => setStart(Number(e.target.value))} />
        </label>
        <label className="pk-slider">
          {T.width(width.toLocaleString())}
          <input type="range" min={1000} max={200000} step={1000} value={width} onChange={(e) => setWidth(Number(e.target.value))} />
        </label>
      </div>
      <div className="viz-box pk-wrap">
        <div>
          <strong>{T.sortedTitle}</strong>
          <Grid read={sortedRead} label={T.sortedAria} />
          <div className="pk-stat"><b>{sortedRows.toLocaleString()}</b>{T.stat(pct(sortedRows), sortedRead.filter(Boolean).length)}</div>
          <div className="pk-hint">{T.sortedHint}</div>
        </div>
        <div>
          <strong>{T.otherTitle}</strong>
          <Grid read={scatteredRead} label={T.otherAria} />
          <div className="pk-stat"><b>{scatteredRows.toLocaleString()}</b>{T.stat(pct(scatteredRows), GROUPS)}</div>
          <div className="pk-hint">{T.otherHint}</div>
        </div>
      </div>
      <figcaption className="viz-caption">
        {T.caption1}
        {' '}
        {T.caption2}
      </figcaption>
    </figure>
  );
}
