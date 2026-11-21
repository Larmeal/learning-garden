import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import { Cell, Flag, tintOf } from './kf';

// Shows:      a topic as a strip of numbered cells that only grows on the right, and two groups of readers, each with its own bookmark.
// Because:    "reading does not remove anything" and "every group has its own place" are about where things sit relative to the strip: the cells stay, the bookmarks move.
// Control:    add an order (the producer), read one record with group A or B, read to the end, and send B back to offset 0.
// Conclusion: a Kafka topic is a log that readers walk along; the log is not changed by reading, and a bookmark (offset) belongs to the reader.
//
// The run that the picture follows is exercise 01 (five orders, two groups, both read all five, the end offset stayed 5).

const KEYS = ['c1', 'c2', 'c1', 'c3', 'c2', 'c1', 'c3', 'c2', 'c1', 'c3', 'c2', 'c1', 'c3', 'c1'];
const MAX = KEYS.length;

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; add: string; readA: string; readB: string; allA: string; allB: string; rewind: string; reset: string;
  producer: string; next: string; readers: [string, string]; readout: (n: number, a: number, b: number) => string; caption: string; dotA: string; dotB: string;
}> = {
  th: {
    title: 'กดเพิ่ม Order แล้วให้กลุ่ม A กับกลุ่ม B อ่านทีละ Record ดูว่า Log ไม่ลดลงเลย ส่วนที่คั่นหนังสือของแต่ละกลุ่มเดินไปคนละที่',
    legend: [{ kind: 'new', text: 'Record ที่เพิ่งต่อท้าย' }, { kind: 'use', text: 'Record ที่กลุ่มใดกลุ่มหนึ่งอ่านแล้ว' }, { kind: 'skip', text: 'ที่ที่ Record ถัดไปจะมาต่อ' }],
    add: 'Producer ส่ง Order ใหม่', readA: 'A อ่านต่อ 1 Record', readB: 'B อ่านต่อ 1 Record', allA: 'A อ่านจนหมด', allB: 'B อ่านจนหมด', rewind: 'ให้ B ย้อนไปอ่านใหม่ตั้งแต่ offset 0', reset: 'เริ่มใหม่',
    producer: 'Producer ต่อท้ายทางขวาเท่านั้น', next: 'ถัดไป', readers: ['กลุ่ม A (billing)', 'กลุ่ม B (shipping)'], dotA: 'A', dotB: 'B',
    readout: (n, a, b) => `Log มี ${n} Record ครบเหมือนเดิม กลุ่ม A อ่านไปแล้ว ${a} ตัว (ค้างอีก ${n - a}) กลุ่ม B อ่านไปแล้ว ${b} ตัว (ค้างอีก ${n - b})`,
    caption: 'ตัวเลขในรูปเป็นตัวอย่างที่วาดตามแบบฝึก 01: Order 5 ตัว ส่งด้วย kafka-console-producer, กลุ่ม billing กับ shipping อ่านครบทั้ง 5 ตัวทั้งคู่ และ end offset ยังเป็น 5 หลังอ่าน สีแถบบนแต่ละช่องคือ Key ของลูกค้า (c1 ถึง c3)',
  },
  en: {
    title: 'Add orders and let group A and group B read one record at a time. The log never shrinks, and each group moves its own bookmark',
    legend: [{ kind: 'new', text: 'record just appended' }, { kind: 'use', text: 'record that a group has read' }, { kind: 'skip', text: 'where the next record will land' }],
    add: 'Producer sends a new order', readA: 'A reads 1 record', readB: 'B reads 1 record', allA: 'A reads to the end', allB: 'B reads to the end', rewind: 'send B back to offset 0', reset: 'start over',
    producer: 'the producer only appends on the right', next: 'next', readers: ['group A (billing)', 'group B (shipping)'], dotA: 'A', dotB: 'B',
    readout: (n, a, b) => `The log still holds all ${n} records. Group A has read ${a} (${n - a} left), group B has read ${b} (${n - b} left)`,
    caption: 'The picture is drawn after exercise 01: five orders sent with kafka-console-producer, the groups billing and shipping each read all five, and the end offset was still 5 afterwards. The colour bar on a cell is the customer key (c1 to c3).',
  },
};

export default function LogLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [n, setN] = useState(5);
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const [fresh, setFresh] = useState(-1);
  const X = (i: number) => 22 + i * 60;
  const Y = 96;
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="viz-box">
        <svg viewBox="0 0 880 300" role="img" aria-label={T.title}>
          <text x={X(Math.min(n, MAX - 1)) + 26} y={30} textAnchor={n > 9 ? 'end' : 'start'} className="ib-n">{n < MAX ? T.producer : ''}</text>
          {n < MAX && <path className="ib-arrow" d={`M${X(n) + 26},38 L${X(n) + 26},${Y - 22}`} />}
          {KEYS.slice(0, n).map((k, i) => (
            <Cell key={i} x={X(i)} y={Y} offset={i} text={k} tint={tintOf(k)} state={i === fresh ? 'new' : i < Math.max(a, b) ? 'use' : 'plain'} />
          ))}
          {n < MAX && <Cell x={X(n)} y={Y} offset={n} text={'+'} state="skip" />}
          {KEYS.slice(0, n).map((_, i) => (
            <g key={'d' + i}>
              <circle cx={X(i) + 18} cy={Y + 70} r={7} className={i < a ? 'ib-new' : 'ib-skip'} />
              <circle cx={X(i) + 36} cy={Y + 70} r={7} className={i < b ? 'ib-new' : 'ib-skip'} style={i < b ? { fill: 'var(--k3)', stroke: 'var(--k3)' } : undefined} />
            </g>
          ))}
          <text x={X(0) + 18} y={Y + 96} textAnchor="middle" className="ib-s">{T.dotA}</text>
          <text x={X(0) + 36} y={Y + 96} textAnchor="middle" className="ib-s">{T.dotB}</text>
          <Flag x={X(a) + 26} y={Y + 118} label={`${T.readers[0]}: ${T.next} ${a}`} anchor={a > 8 ? 'end' : 'start'} />
          <Flag x={X(b) + 26} y={Y + 168} label={`${T.readers[1]}: ${T.next} ${b}`} color="var(--k3)" anchor={b > 8 ? 'end' : 'start'} />
        </svg>
      </div>
      <div className="lab-controls">
        <button type="button" className="btn sm" disabled={n >= MAX} onClick={() => { setN(n + 1); setFresh(n); }}>{T.add}</button>
        <button type="button" className="btn sm" disabled={a >= n} onClick={() => { setA(a + 1); setFresh(-1); }}>{T.readA}</button>
        <button type="button" className="btn sm" disabled={b >= n} onClick={() => { setB(b + 1); setFresh(-1); }}>{T.readB}</button>
        <button type="button" className="btn sm" disabled={a >= n} onClick={() => { setA(n); setFresh(-1); }}>{T.allA}</button>
        <button type="button" className="btn sm" disabled={b >= n} onClick={() => { setB(n); setFresh(-1); }}>{T.allB}</button>
        <button type="button" className="btn sm" disabled={b === 0} onClick={() => setB(0)}>{T.rewind}</button>
        <button type="button" className="btn sm" onClick={() => { setN(5); setA(0); setB(0); setFresh(-1); }}>{T.reset}</button>
      </div>
      <div className="readout" aria-live="polite"><div>{T.readout(n, a, b)}</div></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
