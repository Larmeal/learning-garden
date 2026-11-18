import { useState } from 'react';
import { Legend } from '../iceberg/ib';
import type { Lang } from '../spark/stepper';

// Shows:      what an install picks and whether it notices a swapped file, for three ways to ask for a dependency (^1.2.0, ~1.2.0, an exact version), with or
//             without a lock file that holds a hash, today or next week (when a new 1.9.10 appears), and with or without the attacker having swapped the file.
// Because:    "the same build twice" is only true when something pins it, and a hash is the one thing that notices a changed file. Four switches, one picture, make that visible.
// Control:    the range (3), the lock file with a hash (off, on), the week (today, next week) and the swap (no, yes). Each changes the version installed or the verdict.
// Conclusion: a range lets the installed version move by itself, a lock file stops that, and only a hash stops a file that was changed after it was published.
//
// The versions (1.2.0, 1.2.3, 1.3.0, 1.9.9, 2.0.0, then 1.9.10), the results of ^ and ~, and the hash check on a file with one line added are those of
// exercises/11_supply_chain_secrets.py. The package is a toy, and nothing was downloaded.

type Spec = 'caret' | 'tilde' | 'exact';
const BASE = ['1.2.0', '1.2.3', '1.3.0', '1.9.9', '2.0.0'];
const v = (s: string) => s.split('.').map(Number);
const cmp = (a: string, b: string) => { const x = v(a), y = v(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };

const TEXT: Record<Lang, {
  title: string; spec: string; specs: Record<Spec, string>; lock: string; off: string; on: string; week: string; weeks: [string, string]; swap: string; swaps: [string, string];
  legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; avail: string; picked: string; fromLock: string; fromRange: string; hash: string; hashOk: string; hashBad: string; noHash: string;
  verdictBad: string; verdictOk: string; verdictStop: string; sameBuild: string; differs: (a: string, b: string) => string; caption: string;
}> = {
  th: {
    title: 'เลือกวิธีขอ Dependency มี Lock File ที่มี Hash หรือไม่ ผ่านไปหนึ่งสัปดาห์ และมีใครสลับไฟล์ไหม แล้วดูว่าติดตั้งเวอร์ชันไหน และจับได้หรือเปล่า',
    spec: 'วิธีขอ', specs: { caret: '^1.2.0', tilde: '~1.2.0', exact: '==1.2.3' }, lock: 'Lock File + Hash', off: 'ไม่มี', on: 'มี', week: 'เวลา', weeks: ['วันนี้', 'สัปดาห์หน้า (มี 1.9.10)'], swap: 'ไฟล์ของเวอร์ชันนั้น', swaps: ['เหมือนเดิม', 'ถูกสลับ'],
    legend: [{ kind: 'new', text: 'เวอร์ชันที่ติดตั้ง' }, { kind: 'use', text: 'เวอร์ชันที่มีให้เลือก' }],
    avail: 'เวอร์ชันที่มีใน Registry', picked: 'ติดตั้งเวอร์ชัน', fromLock: 'ตาม Lock File (ไม่ดูวิธีขอ)', fromRange: 'ตามวิธีขอ เลือกเวอร์ชันใหม่สุดที่เข้าเงื่อนไข', hash: 'ตรวจ Hash ของไฟล์', hashOk: 'Hash ตรงกับที่ล็อกไว้', hashBad: 'Hash ไม่ตรง ตัวติดตั้งหยุด', noHash: 'ไม่มี Hash ให้เทียบ จึงไม่ได้ตรวจ',
    verdictBad: 'ติดตั้งไฟล์ที่ถูกสลับเข้ามา และไม่มีใครรู้', verdictOk: 'ติดตั้งไฟล์ที่ถูกต้อง', verdictStop: 'ติดตั้งไม่สำเร็จ ซึ่งเป็นผลที่ดี', sameBuild: 'Build ครั้งนี้เหมือนกับตอนวันนี้', differs: (a, b) => `Build ต่างจากวันนี้ (${a} กลายเป็น ${b}) โดยไม่มีใครแก้โค้ดเรา`,
    caption: 'เวอร์ชันและผลของ ^ กับ ~ มาจากแบบฝึก 11 ซึ่งแพ็กเกจเป็นของจำลอง ไม่ได้ดาวน์โหลดอะไรจาก Registry จริง ข้อความในไฟล์ที่ถูกสลับคือการเติมหนึ่งบรรทัด ซึ่ง Hash ต่างจากที่ล็อกไว้',
  },
  en: {
    title: 'Pick how a dependency is asked for, whether there is a lock file with a hash, a week passing, and whether someone swapped the file, and see which version is installed and whether it is noticed',
    spec: 'asked for as', specs: { caret: '^1.2.0', tilde: '~1.2.0', exact: '==1.2.3' }, lock: 'Lock file + hash', off: 'none', on: 'yes', week: 'when', weeks: ['today', 'next week (1.9.10 exists)'], swap: 'the file of that version', swaps: ['unchanged', 'swapped'],
    legend: [{ kind: 'new', text: 'the version installed' }, { kind: 'use', text: 'a version on offer' }],
    avail: 'versions in the registry', picked: 'installs version', fromLock: 'from the lock file (the range is not looked at)', fromRange: 'from the range: the newest version that fits', hash: 'check the hash of the file', hashOk: 'the hash matches the one locked', hashBad: 'the hash differs, so the installer stops', noHash: 'there is no hash to compare, so nothing is checked',
    verdictBad: 'the swapped file is installed, and nobody knows', verdictOk: 'the right file is installed', verdictStop: 'the install fails, which is the good result', sameBuild: 'this build is the same as today\'s', differs: (a, b) => `this build differs from today's (${a} became ${b}) with nobody changing our code`,
    caption: 'The versions and the results of ^ and ~ come from exercise 11, where the package is a toy and nothing was downloaded from a real registry. The swapped file is the original with one line added, whose hash differs from the locked one.',
  },
};

export default function DependencyLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [spec, setSpec] = useState<Spec>('caret');
  const [lock, setLock] = useState(false);
  const [next, setNext] = useState(false);
  const [swapped, setSwapped] = useState(false);
  const avail = next ? [...BASE, '1.9.10'] : BASE;
  const pick = (a: string[]) => {
    if (lock || spec === 'exact') return '1.2.3';
    if (spec === 'caret') return a.filter((x) => v(x)[0] === 1 && cmp(x, '1.2.0') >= 0).sort(cmp).pop()!;
    return a.filter((x) => v(x)[0] === 1 && v(x)[1] === 2 && cmp(x, '1.2.0') >= 0).sort(cmp).pop()!;
  };
  const chosen = pick(avail);
  const today = pick(BASE);
  const hasHash = lock;
  const hashOk = !swapped;
  const stopped = hasHash && swapped;
  const bad = swapped && !hasHash;
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      {[
        [T.spec, <span className="seg" role="group" aria-label={T.spec} key="s">{(['caret', 'tilde', 'exact'] as Spec[]).map((k) => <button key={k} type="button" aria-pressed={spec === k} onClick={() => setSpec(k)}>{T.specs[k]}</button>)}</span>],
        [T.lock, <span className="seg" role="group" aria-label={T.lock} key="l"><button type="button" aria-pressed={!lock} onClick={() => setLock(false)}>{T.off}</button><button type="button" aria-pressed={lock} onClick={() => setLock(true)}>{T.on}</button></span>],
        [T.week, <span className="seg" role="group" aria-label={T.week} key="w"><button type="button" aria-pressed={!next} onClick={() => setNext(false)}>{T.weeks[0]}</button><button type="button" aria-pressed={next} onClick={() => setNext(true)}>{T.weeks[1]}</button></span>],
        [T.swap, <span className="seg" role="group" aria-label={T.swap} key="x"><button type="button" aria-pressed={!swapped} onClick={() => setSwapped(false)}>{T.swaps[0]}</button><button type="button" aria-pressed={swapped} onClick={() => setSwapped(true)}>{T.swaps[1]}</button></span>],
      ].map(([label, ctl], i) => (
        <div className="ib-controls" key={i} style={{ flexWrap: 'wrap' }}><span className="ib-lbl">{label as string}</span>{ctl}</div>
      ))}
      <div style={{ display: 'grid', gap: 12, marginBottom: 6 }}>
        <div style={{ border: '2px solid var(--line-strong)', borderRadius: 12, padding: 12, background: 'var(--surface)' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>{T.avail}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {avail.map((x) => (
              <span key={x} className={x === chosen ? 'ib-new' : 'ib-use'} style={{ padding: '4px 12px', borderRadius: 9, border: `2px solid ${x === chosen ? 'var(--accent)' : 'var(--line-strong)'}`, fontFamily: 'var(--mono, monospace)', fontWeight: x === chosen ? 700 : 400 }}>{x}</span>
            ))}
          </div>
        </div>
        <div style={{ border: '2px solid var(--line-strong)', borderRadius: 12, padding: 12, background: 'var(--surface)' }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{`${T.picked} ${chosen}`}</div>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>{lock || spec === 'exact' ? T.fromLock : T.fromRange}</div>
          <div style={{ marginTop: 8, fontSize: 14 }}>{chosen === today ? T.sameBuild : T.differs(today, chosen)}</div>
        </div>
        <div style={{ border: `3px solid ${bad ? 'var(--ib-bad)' : 'var(--line-strong)'}`, borderRadius: 12, padding: 12, background: 'var(--surface)' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>{T.hash}</div>
          <div style={{ fontWeight: 700 }}>{hasHash ? (hashOk ? `✓ ${T.hashOk}` : `✗ ${T.hashBad}`) : T.noHash}</div>
          <div style={{ marginTop: 8, fontWeight: 700, color: bad ? 'var(--ib-bad)' : undefined }}>{bad ? `✗ ${T.verdictBad}` : stopped ? `✓ ${T.verdictStop}` : `✓ ${T.verdictOk}`}</div>
        </div>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
