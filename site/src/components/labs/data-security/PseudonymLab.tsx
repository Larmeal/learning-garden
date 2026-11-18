import { useState } from 'react';
import { Legend } from '../iceberg/ib';
import type { Lang } from '../spark/stepper';
import { Card, Row, mono } from './ds';
import data from './pseudonym.json';

// Shows:      four ways to replace an e-mail address (plain hash, salted hash, HMAC with a secret key, random token) and, for the attacker you choose, whether the
//             original comes back, and whether an analyst can still join two tables or count distinct people.
// Because:    "pseudonymized" means different things for the four methods, and the trade is always the same: what keeps joins working is what an attacker with the right
//             thing (a dictionary, or the key) can also use.
// Control:    the method (4) and what the attacker holds (nothing, a dictionary of e-mails, the key). The verdict cards change with both.
// Conclusion: a plain hash falls to a dictionary, a salt or a random token stops that and also stops joins, an HMAC keeps joins and is only as safe as its key.
//
// Whether a dictionary or the key undoes each method, and the join and count results, are those asserted in exercises/02_pseudonymization.py (pseudonym.json).

type M = 'hash' | 'salted' | 'hmac' | 'token';
type A = 'none' | 'dict' | 'key';
const METHODS = data.methods as Record<M, { dictionary: boolean; key: boolean; join: boolean; count: boolean; example: string }>;

// what each attacker undoes: a dictionary undoes the plain hash only, the key undoes the HMAC only (a leaked key also lets him test guesses)
const UNDONE: Record<M, Record<A, boolean>> = {
  hash: { none: false, dict: true, key: true },
  salted: { none: false, dict: false, key: false },
  hmac: { none: false, dict: false, key: true },
  token: { none: false, dict: false, key: false },
};

const TEXT: Record<Lang, {
  title: string; method: string; methods: Record<M, [string, string]>; attacker: string; attackers: Record<A, string>; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[];
  example: string; back: string; backYes: string; backNo: string; join: string; joinYes: string; joinNo: string; why: Record<M, string>; caption: string; table: string;
}> = {
  th: {
    title: 'เลือกวิธีแทนที่อีเมลและสิ่งที่ผู้โจมตีถืออยู่ แล้วดูว่าอีเมลเดิมกลับมาไหม และนักวิเคราะห์ยัง Join สองตารางได้ไหม',
    method: 'วิธี', methods: { hash: ['Hash ธรรมดา', 'SHA-256'], salted: ['Hash + Salt ต่อแถว', 'Salt สุ่มทุกแถว'], hmac: ['HMAC', 'มี Key ลับ'], token: ['Token สุ่ม', 'เก็บใน Vault'] },
    attacker: 'ผู้โจมตีมี', attackers: { none: 'ไม่มีอะไร', dict: 'พจนานุกรมของอีเมล', key: 'Key ลับ (หลุด)' },
    legend: [{ kind: 'new', text: 'ปลอดภัยจากผู้โจมตีคนนี้' }, { kind: 'use', text: 'ยังใช้งานได้' }],
    example: 'ตัวอย่างค่าที่เก็บ', back: 'อีเมลเดิมกลับมาไหม', backYes: 'กลับมา ผู้โจมตีรู้ว่าแถวไหนเป็นใคร', backNo: 'ไม่กลับมา', join: 'Join สองตารางและนับคนที่ต่างกันได้ไหม', joinYes: 'ได้ คนเดียวกันได้ค่าเดียวกันทุกตาราง', joinNo: 'ไม่ได้ ค่าของคนเดียวกันไม่เหมือนกัน',
    why: { hash: 'ไม่มี Key ใครก็คำนวณ Hash ของอีเมลที่เดาได้ จึงตรงกับตารางและกลับมา', salted: 'Salt ต่างกันทุกแถว พจนานุกรมใช้ไม่ได้ แต่ Join ก็ไม่ได้เหมือนกัน', hmac: 'ต้องมี Key จึงคำนวณได้ ใครมี Key ก็ทำ Token ของอีเมลที่เดาแล้วเทียบกับตารางได้', token: 'ไม่มีอะไรให้โจมตีนอกจาก Vault ที่ต้องปกป้องเอง Join ไม่ได้เพราะค่าสุ่มต่างกันทุกครั้ง' },
    table: 'สรุปแล้วแต่ละวิธีทำอะไรได้บ้าง',
    caption: 'ผลของแต่ละวิธีต่อพจนานุกรมและต่อ Key รวมถึงผล Join มาจากแบบฝึก 02 พจนานุกรม 600,000 ค่าเดาอีเมลได้ครบ ส่วนตาราง 1,000,000 ค่าของเลข 6 หลักถอด Hash ธรรมดาได้ครบใน 1.6 วินาทีบนคอมพิวเตอร์ที่รัน',
  },
  en: {
    title: 'Choose how an e-mail is replaced and what the attacker holds, and see whether the e-mail comes back and whether an analyst can still join two tables',
    method: 'Method', methods: { hash: ['Plain hash', 'SHA-256'], salted: ['Hash + salt per row', 'random salt each row'], hmac: ['HMAC', 'secret key'], token: ['Random token', 'kept in a vault'] },
    attacker: 'Attacker holds', attackers: { none: 'nothing', dict: 'a dictionary of e-mails', key: 'the secret key (leaked)' },
    legend: [{ kind: 'new', text: 'safe from this attacker' }, { kind: 'use', text: 'still works' }],
    example: 'example of the stored value', back: 'does the e-mail come back', backYes: 'it comes back, so the attacker knows who each row is', backNo: 'it does not come back', join: 'can two tables be joined and distinct people counted', joinYes: 'yes, the same person gets the same value in every table', joinNo: 'no, the same person gets a different value each time',
    why: { hash: 'There is no key, so anyone can hash an e-mail they guess and match it against the table', salted: 'The salt differs on every row, so a dictionary does not work, and neither does a join', hmac: 'It needs the key. Whoever holds the key can make the token of a guessed e-mail and match it', token: 'There is nothing to attack except the vault, which has to be protected on its own. No join, because the random values differ each time' },
    table: 'what each method can do, side by side',
    caption: 'What a dictionary or the key does to each method, and the join results, come from exercise 02. A dictionary of 600,000 guesses found every e-mail on the guessed domain, and a table of all 1,000,000 six digit numbers undid every plain hash in 1.6 seconds on the computer that ran it.',
  },
};

export default function PseudonymLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [m, setM] = useState<M>('hash');
  const [a, setA] = useState<A>('dict');
  const info = METHODS[m];
  const comesBack = UNDONE[m][a];
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <span className="ib-lbl">{T.method}</span>
        <span className="seg" role="group" aria-label={T.method} style={{ flexWrap: 'wrap' }}>
          {(Object.keys(T.methods) as M[]).map((k) => <button key={k} type="button" aria-pressed={m === k} onClick={() => setM(k)}>{T.methods[k][0]}</button>)}
        </span>
      </div>
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <span className="ib-lbl">{T.attacker}</span>
        <span className="seg" role="group" aria-label={T.attacker} style={{ flexWrap: 'wrap' }}>
          {(Object.keys(T.attackers) as A[]).map((k) => <button key={k} type="button" aria-pressed={a === k} onClick={() => setA(k)}>{T.attackers[k]}</button>)}
        </span>
      </div>
      <Card style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>{`${T.example} (${T.methods[m][1]})`}</div>
        <div style={{ ...mono, fontSize: 18, fontWeight: 700 }}>{`ann.stone1@mail.test  →  ${info.example}…`}</div>
        <div style={{ fontSize: 14, marginTop: 6 }}>{T.why[m]}</div>
      </Card>
      <Row>
        <Card bad={comesBack} good={!comesBack} style={{ flex: '1 1 280px' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>{T.back}</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: comesBack ? 'var(--ib-bad)' : undefined }}>{comesBack ? `✗ ${T.backYes}` : `✓ ${T.backNo}`}</div>
        </Card>
        <Card good={info.join} style={{ flex: '1 1 280px' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>{T.join}</div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{info.join ? `✓ ${T.joinYes}` : `✗ ${T.joinNo}`}</div>
        </Card>
      </Row>
      <div className="tbl-wrap" style={{ marginTop: 10 }}>
        <table className="mini-tbl">
          <caption style={{ textAlign: 'left', fontSize: 13, color: 'var(--muted)' }}>{T.table}</caption>
          <thead><tr><th></th><th>{T.attackers.dict}</th><th>{T.attackers.key}</th><th>join</th></tr></thead>
          <tbody>
            {(Object.keys(METHODS) as M[]).map((k) => (
              <tr key={k} style={k === m ? { fontWeight: 700 } : undefined}>
                <td>{T.methods[k][0]}</td>
                <td>{UNDONE[k].dict ? '✗' : '✓'}</td>
                <td>{UNDONE[k].key ? '✗' : '✓'}</td>
                <td>{METHODS[k].join ? '✓' : '✗'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
