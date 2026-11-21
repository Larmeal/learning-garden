import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import { hashOf, partitionOf } from './murmur';

// Shows:      twelve customers (keys) sitting in the partitions of a topic, placed by the real hash rule of the Java producer, for 3, 6 or 12 partitions, and any key that you type.
// Because:    "the same key always goes to the same partition, but the partition changes when the count changes" is about where each chip lands, and a table of hashes would hide it.
// Control:    the number of partitions (the keys that moved are filled), and a text box for a key of your own.
// Conclusion: key to partition is hash(key) % partitions: stable while the count stays, different when it changes, and not evenly spread.
//
// The hash is computed here with the same code as Utils.murmur2; exercise 02 sent these keys to a real broker with partitioner=murmur2_random and the partitions matched (for 3 partitions, and 6 after the topic was altered).

const SAMPLE = Array.from({ length: 12 }, (_, i) => `c${i + 1}`);
const COUNTS = [3, 6, 12];

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; count: string; yours: string; partition: string;
  readout: (key: string, hash: number, n: number, p: number, p3: number) => string; caption: string;
}> = {
  th: {
    title: 'เลือกจำนวน Partition แล้วดูว่าลูกค้าแต่ละคน (Key) ตกลงไปอยู่ Partition ไหน ลองเปลี่ยนจำนวนแล้วดูว่า Key ตัวไหนย้ายที่',
    legend: [{ kind: 'new', text: 'Key ที่อยู่คนละ Partition กับตอนมี 3 Partition' }, { kind: 'use', text: 'Key ที่เราพิมพ์เอง' }],
    count: 'จำนวน Partition', yours: 'Key ของเราเอง', partition: 'Partition',
    readout: (key, hash, n, p, p3) => `murmur2("${key}") = ${hash} แล้วเอามาตัดบิตหน้าสุดทิ้ง (ให้เป็นบวก) หารเอาเศษด้วย ${n} ได้ ${p}${n !== 3 && p !== p3 ? ` (ตอนมี 3 Partition ตกที่ ${p3})` : ''}`,
    caption: 'Hash คำนวณในหน้านี้ด้วยโค้ดเดียวกับ Utils.murmur2 ของ Kafka (อ่านจาก source 4.4.0) และแบบฝึก 02 ส่ง Key เหล่านี้ไปที่ Broker จริงด้วย partitioner=murmur2_random ได้ Partition ตรงกันทุกตัว ทั้งตอนมี 3 Partition และหลังเพิ่มเป็น 6',
  },
  en: {
    title: 'Choose the number of partitions and see which partition each customer (key) lands in. Change the number and watch which keys move',
    legend: [{ kind: 'new', text: 'key in another partition than with 3 partitions' }, { kind: 'use', text: 'a key that you typed' }],
    count: 'number of partitions', yours: 'a key of your own', partition: 'partition',
    readout: (key, hash, n, p, p3) => `murmur2("${key}") = ${hash}; drop the sign bit and take the remainder by ${n}: ${p}${n !== 3 && p !== p3 ? ` (with 3 partitions it landed in ${p3})` : ''}`,
    caption: 'The hash is computed on this page with the same code as Kafka\'s Utils.murmur2 (read from the 4.4.0 source). Exercise 02 sent these keys to a real broker with partitioner=murmur2_random and every partition matched, with 3 partitions and after the topic was altered to 6.',
  },
};

export default function PartitionLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [n, setN] = useState(3);
  const [typed, setTyped] = useState('c1');
  const key = typed === '' ? 'c1' : typed;
  const own = !SAMPLE.includes(key);
  const keys = own ? [...SAMPLE, key] : SAMPLE;
  const laneW = 836 / n;
  const lanes: string[][] = Array.from({ length: n }, () => []);
  keys.forEach((k) => lanes[partitionOf(k, n)].push(k));
  const p = partitionOf(key, n);
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.count}</span>
        <span className="seg" role="group" aria-label={T.count}>
          {COUNTS.map((c) => (
            <button key={c} type="button" aria-pressed={n === c} onClick={() => setN(c)}>{c}</button>
          ))}
        </span>
        <label className="ib-lbl">{T.yours}{' '}
          <input value={typed} maxLength={12} onChange={(e) => setTyped(e.target.value)} style={{ width: 110, padding: '4px 8px', border: '1px solid var(--line-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--fg)', font: 'inherit' }} />
        </label>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 360" role="img" aria-label={T.title}>
          {lanes.map((ks, i) => (
            <g key={i}>
              <rect className="ib-skip" x={22 + i * laneW + 3} y={20} width={laneW - 6} height={320} rx={10} />
              <text x={22 + i * laneW + laneW / 2} y={46} textAnchor="middle" className="ib-n">{`${T.partition} ${i}`}</text>
              {ks.map((k, j) => {
                const moved = k !== key && partitionOf(k, 3) !== i;
                const mine = k === key && own;
                const w = Math.min(laneW - 16, 72);
                return (
                  <g key={k}>
                    <rect className={mine ? 'ib-use' : moved ? 'ib-new' : 'ib-node'} x={22 + i * laneW + (laneW - w) / 2} y={62 + j * 34} width={w} height={28} rx={7} style={k === key ? { strokeWidth: 4 } : undefined} />
                    <text x={22 + i * laneW + laneW / 2} y={82 + j * 34} textAnchor="middle" className="ib-m" style={{ fill: 'var(--fg)', fontSize: 15 }}>{k}</text>
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      </div>
      <div className="readout" aria-live="polite"><div>{T.readout(key, hashOf(key), n, p, partitionOf(key, 3))}</div></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
