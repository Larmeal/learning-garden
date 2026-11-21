import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import data from './batching.json';

// Shows:      records arriving at a producer on a time line, and the batches (requests to the broker) that the producer cuts from them for a chosen linger.ms.
// Because:    batching is about time: a producer waits for a few milliseconds so that more records can ride in one request. On a time line the wait and the request count are both visible.
// Control:    linger.ms (0, 5, 20, 50) and how often a record arrives (every 2 ms or every 10 ms).
// Conclusion: a longer linger.ms means fewer, bigger requests, and the first record of each batch waits that long; when records arrive slowly, lingering buys little.
//
// The picture is a model with fixed arrival times (40 records). The real counts come from exercise 03: 600 orders, one every 2 ms, read from the broker's log with kafka-dump-log.sh.

const LINGERS = [0, 5, 20, 50];
const GAPS = [2, 10];
const N = 40;

function batchesFor(linger: number, gap: number): { start: number; end: number; count: number }[] {
  const arrivals = Array.from({ length: N }, (_, i) => i * gap);
  const out: { start: number; end: number; count: number }[] = [];
  let i = 0;
  while (i < N) {
    const start = arrivals[i];
    let j = i;
    while (j + 1 < N && arrivals[j + 1] <= start + linger) j++;
    out.push({ start, end: start + linger, count: j - i + 1 });
    i = j + 1;
  }
  return out;
}

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; linger: string; gap: string; gaps: Record<number, string>;
  requests: string; wait: string; perReq: string; ms: string; record: string; axis: string; real: (a: number, b: number) => string; caption: string;
}> = {
  th: {
    title: 'เลือก linger.ms แล้วดูว่า Producer รวม Record ที่ทยอยเข้ามา 40 ตัวเป็นกี่ Request ลองเปลี่ยนความถี่ที่ Record เข้ามาด้วย',
    legend: [{ kind: 'use', text: 'Record ที่เข้ามา' }, { kind: 'new', text: 'Batch ที่ส่งเป็น 1 Request' }],
    linger: 'linger.ms', gap: 'Record เข้ามาทุก', gaps: { 2: 'ทุก 2 ms', 10: 'ทุก 10 ms' }, requests: 'Request ที่ส่งให้ Broker', wait: 'Record แรกของ Batch รอ', perReq: 'Record ต่อ Request (เฉลี่ย)', ms: 'ms', record: 'Record', axis: 'เวลา (ms)',
    real: (a, b) => `ของจริงจากแบบฝึก 03: Order 600 ตัว ตัวละ 1 ครั้งทุก 2 ms ได้ ${a} Batch ใน Log เมื่อ linger.ms=0 และ ${b} Batch เมื่อ linger.ms=50`,
    caption: 'รูปนี้เป็นแบบจำลองที่เวลาที่ Record เข้ามาเป็นเลขกลม ๆ ส่วนตัวเลขของจริงอยู่ในบรรทัดข้างบน (นับจากบรรทัด baseOffset ของ kafka-dump-log.sh) และ librdkafka รวม Record บางตัวเข้าด้วยกันเองถึงแม้ linger.ms=0',
  },
  en: {
    title: 'Choose linger.ms and see how many requests the producer cuts 40 arriving records into. Also change how often a record arrives',
    legend: [{ kind: 'use', text: 'a record arriving' }, { kind: 'new', text: 'a batch, sent as one request' }],
    linger: 'linger.ms', gap: 'records arrive', gaps: { 2: 'every 2 ms', 10: 'every 10 ms' }, requests: 'requests to the broker', wait: 'the first record of a batch waits', perReq: 'records per request (average)', ms: 'ms', record: 'record', axis: 'time (ms)',
    real: (a, b) => `The real run of exercise 03: 600 orders, one every 2 ms, gave ${a} batches in the log with linger.ms=0 and ${b} batches with linger.ms=50`,
    caption: 'The picture is a model with round arrival times. The real numbers are in the line above (counted from the baseOffset lines of kafka-dump-log.sh), and librdkafka merges some records by itself even with linger.ms=0.',
  },
};

export default function BatchLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [linger, setLinger] = useState(0);
  const [gap, setGap] = useState(2);
  const bs = batchesFor(linger, gap);
  const span = (N - 1) * gap + 50;
  const sx = (t: number) => 30 + (t / span) * 820;
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.linger}</span>
        <span className="seg" role="group" aria-label={T.linger}>
          {LINGERS.map((l) => (<button key={l} type="button" aria-pressed={linger === l} onClick={() => setLinger(l)}>{l}</button>))}
        </span>
        <span className="ib-lbl">{T.gap}</span>
        <span className="seg" role="group" aria-label={T.gap}>
          {GAPS.map((g) => (<button key={g} type="button" aria-pressed={gap === g} onClick={() => setGap(g)}>{T.gaps[g]}</button>))}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 250" role="img" aria-label={T.title}>
          <text x={30} y={26} className="ib-s">{T.record}</text>
          {Array.from({ length: N }, (_, i) => (<circle key={i} cx={sx(i * gap)} cy={48} r={6} className="ib-use" style={{ fill: 'var(--accent)' }} />))}
          <line className="ib-line" x1={30} y1={150} x2={850} y2={150} />
          {bs.map((b, i) => {
            const x = sx(b.start);
            const w = Math.max(5, sx(b.end) - sx(b.start));
            return (
              <g key={i}>
                <rect className="ib-new" x={x - 2} y={84 + (i % 2) * 34} width={w + 4} height={26} rx={6} />
                {w > 26 && <text x={x + w / 2} y={103 + (i % 2) * 34} textAnchor="middle" className="ib-n" style={{ fontSize: 14 }}>{b.count}</text>}
                <line className="ib-line" x1={x + w + 2} y1={84 + (i % 2) * 34 + 13} x2={x + w + 2} y2={150} style={{ strokeDasharray: '3 4' }} />
              </g>
            );
          })}
          {[0, 25, 50, 75, 100, 150, 200, 250, 300, 350, 400].filter((t) => t <= span).map((t) => (
            <text key={t} x={sx(t)} y={172} textAnchor="middle" className="ib-s">{t}</text>
          ))}
          <text x={850} y={196} textAnchor="end" className="ib-s">{T.axis}</text>
          <text x={30} y={226} className="ib-big" style={{ fontSize: 30 }}>{bs.length}</text>
          <text x={86} y={226} className="ib-s">{T.requests}</text>
          <text x={380} y={226} className="ib-big" style={{ fontSize: 30 }}>{linger}</text>
          <text x={420} y={226} className="ib-s">{`${T.ms} ${T.wait}`}</text>
        </svg>
      </div>
      <div className="readout" aria-live="polite"><div>{`${bs.length} ${T.requests} · ${(N / bs.length).toFixed(1)} ${T.perReq}`}</div><div>{T.real(data['trickle-l0'].batches, data['trickle-l50'].batches)}</div></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
