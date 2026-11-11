import { useState } from 'react';
import type { Lang } from '../../../i18n';

type Kind = 'breaking' | 'review' | 'safe';

// The same six differences that dqcontract.diff() finds between contracts/orders.v1.yaml and orders.v2.yaml.
// The expected answer is the same in both languages; the wording is in TEXT.
const ANSWERS: Kind[] = ['breaking', 'breaking', 'breaking', 'review', 'safe', 'safe'];

interface Change { before: string; after: string; why: string }

const TEXT: Record<Lang, {
  kinds: Record<Kind, string>;
  title: string;
  score: (right: number, total: number) => string;
  scoreNote: string;
  restart: string;
  question: (i: number, total: number) => string;
  table: string;
  v1: string;
  v2: string;
  effect: string;
  group: string;
  matches: string;
  differs: (label: string) => string;
  next: string;
  result: string;
  caption: [string, string, string, string];
  changes: Change[];
}> = {
  th: {
    kinds: { breaking: 'Breaking (ทำให้ Consumer พัง)', review: 'Review (ต้องถาม Consumer ก่อน)', safe: 'Safe (ปลอดภัย)' },
    title: 'Contract v2 เปลี่ยนจาก v1 แล้ว Consumer จะรู้สึกอย่างไร',
    score: (r, n) => `จัดถูก ${r} จาก ${n} ข้อ`,
    scoreNote: 'เกณฑ์ในที่นี้เขียนจากมุมของ Consumer ที่อ่านข้อมูล และเป็นกฎของเส้นทางนี้เท่านั้น ไม่ได้เป็นมาตรฐานกลาง ทีมของคุณควรตกลงเกณฑ์ของตัวเองและเขียนไว้ใน Contract',
    restart: 'เล่นใหม่',
    question: (i, n) => `ข้อ ${i} จาก ${n}`,
    table: 'ตาราง',
    v1: 'v1',
    v2: 'v2',
    effect: 'ผลต่อ Consumer',
    group: 'ประเภทของการเปลี่ยน',
    matches: 'ตรงกับเกณฑ์',
    differs: (l) => `ยังไม่ตรง เกณฑ์จัดเป็น "${l}"`,
    next: 'ข้อต่อไป',
    result: 'ดูผล',
    caption: ['หกข้อนี้คือความต่างระหว่าง ', ' กับ ', ' ที่ ', ' จัดประเภทด้วยโค้ด และได้ผลเดียวกัน'],
    changes: [
      { before: 'total_amount DOUBLE', after: 'amount_total DOUBLE', why: 'ชื่อ Column เปลี่ยน ทุก Query ที่เลือก total_amount จึงล้มทันที เพราะการเปลี่ยนชื่อก็คือการลบ Column เก่าและเพิ่ม Column ใหม่พร้อมกัน' },
      { before: 'customer_id BIGINT', after: 'customer_id VARCHAR', why: 'การ Join กับ customers.customer_id (BIGINT) ต้องเพิ่ม Cast และ Type ที่เปลี่ยนแล้ว ก็เรียงลำดับและเปรียบเทียบได้ผลต่างกันด้วย' },
      { before: 'order_ts TIMESTAMP, not null', after: 'order_ts TIMESTAMP, nullable', why: 'Consumer ที่ Filter จัดกลุ่ม หรือตรวจ Freshness จาก order_ts เคยพึ่งพาว่าไม่มี Null การผ่อนคำสัญญาให้เป็น Null ได้จึงกระทบ Consumer' },
      { before: 'status: PLACED, SHIPPED, CANCELLED', after: 'status: เพิ่ม RETURNED', why: 'Consumer ที่เขียน CASE ครอบ 3 ค่าอาจให้ RETURNED ตกไปสาขา else โดยไม่มีใครรู้ เราจึงต้องถาม Consumer ว่ารับค่าใหม่ได้ไหม' },
      { before: '(ไม่มี Column channel)', after: 'channel VARCHAR, nullable', why: 'การเพิ่ม Column ที่ไม่บังคับจะไม่กระทบ Query ที่เลือก Column ตามชื่อ (ข้อยกเว้นคือ Loader ที่ผูก Schema ตายตัว หรือ SELECT * ที่ส่งต่อไปยังที่ที่คาด Column ครบชุดเดิม)' },
      { before: '(ไม่มี Column currency)', after: 'currency VARCHAR, not null', why: 'Consumer ไม่ต้องทำอะไร เพราะเป็น Column ใหม่ แต่ Producer ต้องกรอกให้ครบทุก Row ซึ่งเป็นภาระของ Producer มากกว่า Consumer' },
    ],
  },
  en: {
    kinds: { breaking: 'breaking (breaks consumers)', review: 'review (ask consumers first)', safe: 'safe' },
    title: 'Contract v2 changes v1. How will consumers feel it?',
    score: (r, n) => `${r} of ${n} classified correctly`,
    scoreNote: 'These criteria are written from the point of view of a consumer that reads the data. They are this path\'s rule, not a standard. Your team should agree its own criteria and write them into the contract.',
    restart: 'Play again',
    question: (i, n) => `Question ${i} of ${n}`,
    table: 'Table',
    v1: 'v1',
    v2: 'v2',
    effect: 'Effect on consumers',
    group: 'Kind of change',
    matches: 'Matches the criteria',
    differs: (l) => `Not quite: the criteria file this as "${l}"`,
    next: 'Next',
    result: 'See the result',
    caption: ['These six items are the differences between ', ' and ', ' that ', ' classifies in code, with the same result.'],
    changes: [
      { before: 'total_amount DOUBLE', after: 'amount_total DOUBLE', why: 'The column name changed, so every query that selects total_amount fails at once. A rename is deleting the old column and adding a new one at the same time.' },
      { before: 'customer_id BIGINT', after: 'customer_id VARCHAR', why: 'Joining to customers.customer_id (BIGINT) now needs a cast, and the changed type also sorts and compares differently.' },
      { before: 'order_ts TIMESTAMP, not null', after: 'order_ts TIMESTAMP, nullable', why: 'Consumers that filter, group or check freshness on order_ts relied on it never being null. Loosening the promise to allow null affects them.' },
      { before: 'status: PLACED, SHIPPED, CANCELLED', after: 'status: adds RETURNED', why: 'A consumer with a CASE covering the 3 values may send RETURNED into the else branch without anyone noticing. Ask consumers whether they can accept the new value.' },
      { before: '(no channel column)', after: 'channel VARCHAR, nullable', why: 'Adding an optional column does not affect queries that select columns by name (exceptions: a loader bound to a fixed schema, or a SELECT * passed on to somewhere that expects exactly the old set of columns).' },
      { before: '(no currency column)', after: 'currency VARCHAR, not null', why: 'Consumers do not have to do anything because it is a new column, but the producer must fill it in on every row, which is a burden on the producer rather than the consumer.' },
    ],
  },
};

const KIND_IDS: Kind[] = ['breaking', 'review', 'safe'];

export default function ContractLab({ lang = 'th' }: { lang?: Lang }) {
  const t = TEXT[lang];
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<Kind | null>(null);
  const [right, setRight] = useState(0);
  const total = ANSWERS.length;
  const done = i >= total;
  const n = Math.min(i, total - 1);
  const c = t.changes[n];
  const answer = ANSWERS[n];

  const choose = (k: Kind) => {
    if (picked) return;
    setPicked(k);
    if (k === answer) setRight((r) => r + 1);
  };
  const next = () => {
    setPicked(null);
    setI(i + 1);
  };
  const restart = () => {
    setI(0);
    setPicked(null);
    setRight(0);
  };

  return (
    <figure className="viz">
      <div className="viz-title">{t.title}</div>
      {done ? (
        <div className="viz-now" aria-live="polite">
          <strong>{t.score(right, total)}</strong>
          <span>{t.scoreNote}</span>
          <div style={{ marginTop: 10 }}>
            <div className="seg"><button type="button" aria-pressed="false" onClick={restart}>{t.restart}</button></div>
          </div>
        </div>
      ) : (
        <>
          <div className="readout">
            <span>{t.question(i + 1, total)}</span>
            <span>{t.table} <b>orders</b></span>
          </div>
          <div className="tbl-wrap">
            <table className="mini-tbl">
              <thead><tr><th>{t.v1}</th><th>{t.v2}</th></tr></thead>
              <tbody><tr><td>{c.before}</td><td>{c.after}</td></tr></tbody>
            </table>
          </div>
          <div>
            <div className="lab-label">{t.effect}</div>
            <div className="seg" role="group" aria-label={t.group}>
              {KIND_IDS.map((k) => (
                <button key={k} type="button" aria-pressed={picked === k} disabled={picked !== null && picked !== k} onClick={() => choose(k)}>
                  {t.kinds[k]}
                </button>
              ))}
            </div>
          </div>
          {picked && (
            <div className="viz-now" aria-live="polite">
              <strong>{picked === answer ? t.matches : t.differs(t.kinds[answer])}</strong>
              <span>{c.why}</span>
              <div style={{ marginTop: 10 }}>
                <div className="seg"><button type="button" aria-pressed="false" onClick={next}>{i + 1 < total ? t.next : t.result}</button></div>
              </div>
            </div>
          )}
        </>
      )}
      <p className="viz-caption">
        {t.caption[0]}<code>contracts/orders.v1.yaml</code>{t.caption[1]}<code>orders.v2.yaml</code>{t.caption[2]}<code>06_contract.py</code>{t.caption[3]}
      </p>
    </figure>
  );
}
