import { StepControls, useStepper, type Lang } from '../spark/stepper';
import { Legend } from '../iceberg/ib';
import { Card, Row, mono } from './ds';
import data from './securecomp.json';

// Shows:      two companies that want to know which customers they share, without handing over their lists. Each encrypts every item with a secret exponent; encryption commutes, so
//             (x to the a) to the b equals (x to the b) to the a. After four steps both can compare double encrypted values and see that two of them are equal.
// Because:    "match without revealing" is a trick of algebra that only makes sense when the numbers are in front of you, and one step at a time.
// Control:    the step player.
// Conclusion: a customer in both lists gives the same double encrypted number from both directions. A customer in only one list gives a number the other side cannot interpret.
//
// The small example (p = 1019, keys 3 and 7, four hash values) is computed by exercises/09_secure_computation.py --write (securecomp.json). The same exercise runs it with a 127 bit prime on 300
// e-mails each, 120 in common, and checks the intersection is exact.

const P = data.psi;

const TEXT: Record<Lang, { title: string; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; steps: { name: string; title: string; text: string }[]; a: string; b: string; set: string; hash: string; common: string; secret: string; caption: string; sees: string }> = {
  th: {
    title: 'ไล่ดูสี่ขั้นที่สองบริษัทหาลูกค้าที่มีร่วมกัน โดยไม่ส่งรายชื่อให้กัน',
    legend: [{ kind: 'new', text: 'ค่าที่เกิดใหม่ในขั้นนี้' }, { kind: 'use', text: 'ค่าเดิม' }],
    a: 'บริษัท A', b: 'บริษัท B', set: 'ลูกค้า', hash: 'Hash', common: 'ลูกค้าที่ตรงกัน', secret: 'Key ลับ', sees: 'สิ่งที่อีกฝ่ายเห็น',
    steps: [
      { name: 'A เข้ารหัส', title: '1. A ยกกำลัง Key ของตัวเองกับ Hash ของลูกค้าทุกคน แล้วส่งให้ B', text: 'B เห็นแค่ตัวเลขที่ยกกำลังแล้ว คิดย้อนกลับเป็นชื่อไม่ได้เพราะไม่รู้ Key ของ A' },
      { name: 'B เข้ารหัสซ้ำ', title: '2. B ยกกำลัง Key ของตัวเองกับค่าที่ได้รับ แล้วส่งกลับให้ A', text: 'ตอนนี้ค่าของ A ถูกยกกำลังสองชั้น (a แล้ว b)' },
      { name: 'B ส่งของตัวเอง', title: '3. B ยกกำลัง Key ของตัวเองกับ Hash ของลูกค้าของ B แล้วส่งให้ A', text: 'A เห็นแค่ตัวเลขที่ยกกำลังด้วย Key ของ B' },
      { name: 'A เทียบ', title: '4. A ยกกำลัง Key ของตัวเองกับค่าของ B แล้วเทียบกับที่ได้จากขั้น 2', text: 'ค่าที่เท่ากันคือลูกค้าที่ทั้งสองมี เพราะ (x ยกกำลัง a) ยกกำลัง b เท่ากับ (x ยกกำลัง b) ยกกำลัง a' },
    ],
    caption: 'ตัวอย่างเล็ก (p เท่ากับ 1019, Key 3 กับ 7) คำนวณในแบบฝึก 09 ซึ่งทำจริงด้วยจำนวนเฉพาะ 127 บิตกับอีเมล 300 รายการต่อฝั่ง ได้ลูกค้าร่วมกัน 120 รายถูกต้องพอดี และแสดงว่าแต่ละฝั่งรู้ขนาดรายชื่อของอีกฝั่งและขนาดของส่วนร่วม',
  },
  en: {
    title: 'Walk the four steps in which two companies find the customers they share without handing over their lists',
    legend: [{ kind: 'new', text: 'a value that is new in this step' }, { kind: 'use', text: 'an earlier value' }],
    a: 'Company A', b: 'Company B', set: 'customers', hash: 'hash', common: 'customers in common', secret: 'secret key', sees: 'what the other side sees',
    steps: [
      { name: 'A encrypts', title: '1. A raises the hash of every customer to its own key and sends the results to B', text: 'B sees only numbers that were raised to a power. It cannot turn them back into names, because it does not know the key of A.' },
      { name: 'B encrypts again', title: '2. B raises what it received to its own key and sends it back to A', text: 'Now the values of A are raised to a power twice (a and then b).' },
      { name: 'B sends its own', title: '3. B raises the hash of its own customers to its key and sends them to A', text: 'A sees only numbers raised with the key of B.' },
      { name: 'A compares', title: '4. A raises B\'s values to its own key and compares them with what came from step 2', text: 'Values that are equal are customers both have, because (x to the a) to the b equals (x to the b) to the a.' },
    ],
    caption: 'A small example (p is 1019, keys 3 and 7) computed in exercise 09, which does it for real with a 127 bit prime and 300 e-mails on each side, finds exactly the 120 customers in common, and shows that each side learns the size of the other\'s list and the size of the overlap.',
  },
};

export default function PsiLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const st = useStepper(T.steps.length, 4200);
  const s = st.step;
  const aNames = P.A as string[];
  const bNames = P.B as string[];
  const cell = (name: string, shown: number | null, strong?: boolean, match?: boolean) => (
    <tr key={name}>
      <td style={{ fontWeight: 700 }}>{name}</td>
      <td style={mono}>{(P.hash as Record<string, number>)[name]}</td>
      <td style={{ ...mono, fontWeight: 700, ...(strong ? { background: 'var(--accent-soft)' } : {}), ...(match ? { color: 'var(--accent)', outline: '2px solid var(--accent)' } : {}) }}>{shown === null ? '' : shown}</td>
    </tr>
  );
  const s1 = P.step1 as Record<string, number>, s2 = P.step2 as Record<string, number>, s3 = P.step3 as Record<string, number>, s4 = P.step4 as Record<string, number>;
  const bVals = new Set(Object.values(s4));
  const aVals = new Set(Object.values(s2));
  const column = (who: 'A' | 'B') => {
    const names = who === 'A' ? aNames : bNames;
    return names.map((n) => {
      if (who === 'A') {
        const v = s >= 1 ? s2[n] : s >= 0 ? s1[n] : null;
        return cell(n, s === 0 ? s1[n] : s >= 1 ? s2[n] : null, s <= 1, s === 3 && bVals.has(s2[n]));
      }
      const v = s === 2 ? s3[n] : s >= 3 ? s4[n] : null;
      return cell(n, s >= 2 ? (s === 2 ? s3[n] : s4[n]) : null, s >= 2, s === 3 && aVals.has(s4[n]));
    });
  };
  const common = (P.common as string[]);
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <Row>
        <Card style={{ flex: '1 1 300px' }}>
          <div style={{ fontWeight: 700 }}>{`${T.a}  ·  ${T.secret}: ${P.ka}`}</div>
          <table className="mini-tbl" style={{ fontSize: 14 }}><thead><tr><th>{T.set}</th><th>{T.hash}</th><th>{s === 0 ? `h^${P.ka} mod ${P.p}` : `h^${P.ka}${'·'}${P.kb} mod ${P.p}`}</th></tr></thead><tbody>{column('A')}</tbody></table>
        </Card>
        <Card style={{ flex: '1 1 300px' }}>
          <div style={{ fontWeight: 700 }}>{`${T.b}  ·  ${T.secret}: ${P.kb}`}</div>
          <table className="mini-tbl" style={{ fontSize: 14 }}><thead><tr><th>{T.set}</th><th>{T.hash}</th><th>{s === 2 ? `h^${P.kb} mod ${P.p}` : `h^${P.kb}${'·'}${P.ka} mod ${P.p}`}</th></tr></thead><tbody>{column('B')}</tbody></table>
        </Card>
      </Row>
      {s === 3 && (
        <Card good style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 700 }}>{`✓ ${T.common}: ${common.join(', ')}`}</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>{`${common.map((n) => `${n}: ${s2[n]} = ${s4[n]}`).join('   ·   ')}`}</div>
        </Card>
      )}
      <StepControls steps={T.steps} step={st.step} playing={st.playing} go={st.go} toggle={st.toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
