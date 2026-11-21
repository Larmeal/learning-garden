import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import { Cell } from './kf';
import data from './delivery.json';

// Shows:      the real log of exercise 08 (a1, a2, COMMIT, b1, b2, ABORT, c1, COMMIT) as a strip with the markers as their own cells, and what a reader sees with each isolation level, while the last transaction is open or committed.
// Because:    transactions are written into the log as ordinary records plus markers that take offsets. What a reader sees depends on those markers, so the strip with the markers is the explanation.
// Control:    isolation.level (read_uncommitted, read_committed) and whether the last transaction (c1) is still open or already committed.
// Conclusion: read_committed skips aborted records and stops at the first record of an open transaction (the last stable offset); read_uncommitted sees every data record, aborted or not; markers are never delivered.
//
// The log is read from delivery.json, written by exercise 08 with kafka-dump-log.sh. With c1 still open the log ends at offset 6; the COMMIT marker at offset 7 is written when it commits.

type Iso = 'read_uncommitted' | 'read_committed';
const ROWS = data.log as { offset: number; control: boolean; txn: boolean; what: string }[];

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; iso: string; last: string; lasts: { open: string; done: string }; data: string; marker: string; lso: string; delivered: string; hidden: string;
  readout: (iso: Iso, open: boolean, seen: string[]) => string; caption: string;
}> = {
  th: {
    title: 'เลือก isolation.level แล้วดูว่า Consumer เห็น Record ไหนจาก Log เดียวกัน ลองเปลี่ยนให้ Transaction สุดท้ายยังไม่จบหรือ Commit แล้วด้วย',
    legend: [{ kind: 'use', text: 'Record ที่ส่งให้ Consumer' }, { kind: 'skip', text: 'Record ที่ Consumer ไม่เห็น' }, { kind: 'new', text: 'Record ที่ Transaction ยังเปิดอยู่' }],
    iso: 'isolation.level', last: 'Transaction สุดท้าย (c1)', lasts: { open: 'ยังเปิดอยู่', done: 'Commit แล้ว' }, data: 'ข้อมูล', marker: 'ตัวคั่น (Marker)', lso: 'Last Stable Offset', delivered: 'ส่งให้อ่าน', hidden: 'ไม่ส่ง',
    readout: (iso, open, seen) => `${iso} เห็น: ${seen.length ? seen.join(', ') : 'ไม่มีอะไร'}${iso === 'read_committed' && open ? ' (หยุดที่ Last Stable Offset เพราะ c1 ยังไม่จบ)' : ''}`,
    caption: 'Log ในรูปคือ Log จริงจากแบบฝึก 08 อ่านด้วย kafka-dump-log.sh: Transaction a เขียน a1 a2 แล้ว Commit, Transaction b เขียน b1 b2 แล้ว Abort, Transaction c เขียน c1 และตอนที่ยังเปิดอยู่ Log ยังจบที่ offset 6 ตัว Marker ใช้ offset ของตัวเอง (offset 2, 5 และ 7)',
  },
  en: {
    title: 'Choose isolation.level and see which records a consumer gets from the same log. Also try the last transaction still open or already committed',
    legend: [{ kind: 'use', text: 'record delivered to the consumer' }, { kind: 'skip', text: 'record the consumer does not see' }, { kind: 'new', text: 'record of a transaction that is still open' }],
    iso: 'isolation.level', last: 'last transaction (c1)', lasts: { open: 'still open', done: 'committed' }, data: 'data', marker: 'marker', lso: 'last stable offset', delivered: 'delivered', hidden: 'not delivered',
    readout: (iso, open, seen) => `${iso} sees: ${seen.length ? seen.join(', ') : 'nothing'}${iso === 'read_committed' && open ? ' (it stops at the last stable offset because c1 is not finished)' : ''}`,
    caption: 'The log in the picture is the real log of exercise 08, read with kafka-dump-log.sh: transaction a wrote a1 a2 and committed, transaction b wrote b1 b2 and aborted, transaction c wrote c1, and while it was open the log ended at offset 6. A marker uses an offset of its own (offsets 2, 5 and 7).',
  },
};

export default function TxnLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [iso, setIso] = useState<Iso>('read_committed');
  const [open, setOpen] = useState(true);
  const rows = open ? ROWS.slice(0, 7) : ROWS;
  const aborted = new Set<number>();
  rows.forEach((r, i) => { if (r.control && r.what === 'ABORT') for (let j = i - 1; j >= 0 && !rows[j].control; j--) aborted.add(j); });
  const lso = open ? rows.findIndex((r) => r.what === 'c1') : rows.length;
  const delivered = rows.map((r, i) => {
    if (r.control) return false;
    if (iso === 'read_uncommitted') return true;
    return !aborted.has(i) && i < lso;
  });
  const seen = rows.filter((_, i) => delivered[i]).map((r) => r.what);
  const X = (i: number) => 28 + i * 106;
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.iso}</span>
        <span className="seg" role="group" aria-label={T.iso}>
          {(['read_uncommitted', 'read_committed'] as Iso[]).map((v) => (<button key={v} type="button" aria-pressed={iso === v} onClick={() => setIso(v)}>{v}</button>))}
        </span>
        <span className="ib-lbl">{T.last}</span>
        <span className="seg" role="group" aria-label={T.last}>
          <button type="button" aria-pressed={open} onClick={() => setOpen(true)}>{T.lasts.open}</button>
          <button type="button" aria-pressed={!open} onClick={() => setOpen(false)}>{T.lasts.done}</button>
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 270" role="img" aria-label={T.title}>
          {rows.map((r, i) => {
            const isOpenTxn = open && r.what === 'c1';
            return r.control ? (
              <g key={i}>
                <rect className="ib-node" x={X(i) + 12} y={86} width={70} height={52} rx={26} style={{ stroke: r.what === 'ABORT' ? 'var(--ib-bad)' : 'var(--brand)', strokeWidth: 3 }} />
                <text x={X(i) + 47} y={118} textAnchor="middle" className="ib-n" style={{ fontSize: 13, fill: r.what === 'ABORT' ? 'var(--ib-bad)' : 'var(--brand)' }}>{r.what}</text>
                <text x={X(i) + 47} y={76} textAnchor="middle" className="ib-s">{r.offset}</text>
              </g>
            ) : (
              <Cell key={i} x={X(i) + 8} y={86} w={78} h={52} offset={r.offset} text={r.what} state={isOpenTxn ? 'new' : delivered[i] ? 'use' : 'skip'} sub={delivered[i] ? T.delivered : T.hidden} />
            );
          })}
          {open && <g>
            <line className="ib-line" x1={X(lso) + 2} y1={64} x2={X(lso) + 2} y2={172} style={{ stroke: 'var(--ib-bad)', strokeDasharray: '6 4' }} />
            <text x={X(lso) + 8} y={196} className="ib-s" style={{ fill: 'var(--ib-bad)' }}>{T.lso}</text>
          </g>}
          <text x={28} y={250} className="ib-s">{`● ${T.data}   ◯ ${T.marker}`}</text>
        </svg>
      </div>
      <div className="readout" aria-live="polite"><div>{T.readout(iso, open, seen)}</div></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
