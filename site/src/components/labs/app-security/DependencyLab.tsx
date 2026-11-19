import { useState } from 'react';
import { Key } from '../data-security/ds';
import type { Lang } from '../spark/stepper';
import { Paper, Seal, wrapAny } from './bits';
import { hex, sha256, utf8 } from './sha256';

// Shows:      a registry shelf with one box per published version of a toy package (1.2.0, 1.2.3, 1.3.0, 1.9.9, 2.0.0, and next week also 1.9.10). Above the shelf a bracket covers the versions
//             that the way of asking allows (^1.2.0, ~1.2.0 or an exact version). The box the installer picks lifts into "your build", and under it sits the seal (hash) of the file that really
//             arrived. A lock file, when there is one, holds the version it chose before and the seal that file had; the installer puts the two seals side by side.
// Because:    "the same build twice" is only true when something pins it, and a hash is the one thing that notices a file that was changed after it was published. A bracket that moves, a box that
//             changes, and two seals that stop matching make that visible.
// Control:    the range (3), the lock file with a hash (off, on), the week (today, next week) and the swap (no, yes). Each changes the box that is picked or the verdict.
// Conclusion: a range lets the installed version move by itself, a lock file stops that, and only a hash stops a file that was changed after it was published.
//
// The versions (1.2.0, 1.2.3, 1.3.0, 1.9.9, 2.0.0, then 1.9.10), the results of ^ and ~, and the hash check on a file with one line added are those of exercises/11_supply_chain_secrets.py. The package
// is a toy and nothing was downloaded. The hashes drawn here are a real SHA-256 of a made-up file text, so they differ when one line is added.

type Spec = 'caret' | 'tilde' | 'exact';
const BASE = ['1.2.0', '1.2.3', '1.3.0', '1.9.9', '2.0.0'];
const v = (s: string) => s.split('.').map(Number);
const cmp = (a: string, b: string) => { const x = v(a), y = v(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
const fileText = (ver: string, swapped?: boolean) => `toy-pkg ${ver}\ndef run(): ...\n${swapped ? 'send(os.environ)  # added later\n' : ''}`;
const fileHash = (ver: string, swapped?: boolean) => hex(sha256(utf8(fileText(ver, swapped))));

const TEXT: Record<Lang, {
  title: string; spec: string; specs: Record<Spec, string>; lock: string; off: string; on: string; week: string; weeks: [string, string]; swap: string; swaps: [string, string];
  legend: { color: string; text: string; ring?: boolean }[]; avail: string; picked: string; fromLock: string; fromRange: string; hash: string; hashOk: string; hashBad: string; noHash: string;
  verdictBad: string; verdictOk: string; verdictStop: string; sameBuild: string; differs: (a: string, b: string) => string; caption: string; allowed: Record<Spec, string>; lockCard: string; noLock: string;
  yourBuild: string; arrived: string; locked: string; changed: string;
}> = {
  th: {
    title: 'เลือกวิธีขอ Dependency มี Lock File ที่มี Hash หรือไม่ ผ่านไปหนึ่งสัปดาห์ และมีใครสลับไฟล์ไหม แล้วดูว่ากล่องไหนถูกหยิบมาติดตั้ง และตราของไฟล์ที่มาถึงตรงกับที่ล็อกไว้หรือเปล่า',
    spec: 'วิธีขอ', specs: { caret: '^1.2.0', tilde: '~1.2.0', exact: '==1.2.3' }, lock: 'Lock File + Hash', off: 'ไม่มี', on: 'มี', week: 'เวลา', weeks: ['วันนี้', 'สัปดาห์หน้า (มี 1.9.10)'], swap: 'ไฟล์ของเวอร์ชันนั้น', swaps: ['เหมือนเดิม', 'ถูกสลับ'],
    legend: [{ color: 'var(--accent)', text: 'เวอร์ชันที่ถูกหยิบมาติดตั้ง' }, { color: 'var(--ib-bad)', text: 'ไฟล์ที่ถูกสลับ หรือ Build ที่เปลี่ยนไปเอง' }],
    avail: 'ชั้นวางเวอร์ชันใน Registry', picked: 'ติดตั้งเวอร์ชัน', fromLock: 'ตาม Lock File (ไม่ดูวิธีขอ)', fromRange: 'ตามวิธีขอ เลือกเวอร์ชันใหม่สุดที่เข้าเงื่อนไข', hash: 'ตราของไฟล์ (Hash)', hashOk: 'ตรงกับที่ล็อกไว้ ติดตั้งต่อได้', hashBad: 'ไม่ตรงกับที่ล็อกไว้ ตัวติดตั้งหยุด', noHash: 'ไม่มีตราให้เทียบ จึงไม่ได้ตรวจ',
    verdictBad: 'ติดตั้งไฟล์ที่ถูกสลับเข้ามา และไม่มีใครรู้', verdictOk: 'ติดตั้งไฟล์ที่ถูกต้อง', verdictStop: 'ติดตั้งไม่สำเร็จ ซึ่งเป็นผลที่ดี', sameBuild: 'Build ครั้งนี้เหมือนกับตอนวันนี้', differs: (a, b) => `Build ต่างจากวันนี้ (${a} กลายเป็น ${b}) โดยไม่มีใครแก้โค้ดเรา`,
    allowed: { caret: '^1.2.0 รับ 1.x ทุกตัวที่ไม่ต่ำกว่า 1.2.0', tilde: '~1.2.0 รับเฉพาะ 1.2.x', exact: '==1.2.3 รับตัวเดียว' }, lockCard: 'Lock File', noLock: 'ไม่มี Lock File', yourBuild: 'Build ของเรา', arrived: 'ตราของไฟล์ที่ดาวน์โหลดมา', locked: 'ตราที่ล็อกไว้', changed: 'เปลี่ยนไปแล้ว',
    caption: 'เวอร์ชันและผลของ ^ กับ ~ มาจากแบบฝึก 11 ซึ่งแพ็กเกจเป็นของจำลอง ไม่ได้ดาวน์โหลดอะไรจาก Registry จริง ตราที่เห็นเป็น SHA-256 จริงของข้อความไฟล์สมมติ ไฟล์ที่ถูกสลับคือการเติมหนึ่งบรรทัด ซึ่ง Hash จึงต่างจากที่ล็อกไว้',
  },
  en: {
    title: 'Pick how a dependency is asked for, whether there is a lock file with a hash, a week passing, and whether someone swapped the file, and see which box is picked and whether the seal of the file that arrived matches the locked one',
    spec: 'asked for as', specs: { caret: '^1.2.0', tilde: '~1.2.0', exact: '==1.2.3' }, lock: 'Lock file + hash', off: 'none', on: 'yes', week: 'when', weeks: ['today', 'next week (1.9.10 exists)'], swap: 'the file of that version', swaps: ['unchanged', 'swapped'],
    legend: [{ color: 'var(--accent)', text: 'the version that was picked' }, { color: 'var(--ib-bad)', text: 'a swapped file, or a build that changed by itself' }],
    avail: 'the registry shelf of versions', picked: 'installs version', fromLock: 'from the lock file (the range is not looked at)', fromRange: 'from the range: the newest version that fits', hash: 'the seal of the file (hash)', hashOk: 'matches the locked one, the install goes on', hashBad: 'differs from the locked one, so the installer stops', noHash: 'there is no seal to compare, so nothing is checked',
    verdictBad: 'the swapped file is installed, and nobody knows', verdictOk: 'the right file is installed', verdictStop: 'the install fails, which is the good result', sameBuild: "this build is the same as today's", differs: (a, b) => `this build differs from today's (${a} became ${b}) with nobody changing our code`,
    allowed: { caret: '^1.2.0 allows every 1.x from 1.2.0 up', tilde: '~1.2.0 allows only 1.2.x', exact: '==1.2.3 allows exactly one' }, lockCard: 'Lock file', noLock: 'no lock file', yourBuild: 'our build', arrived: 'seal of the file downloaded', locked: 'the locked seal', changed: 'changed',
    caption: 'The versions and the results of ^ and ~ come from exercise 11, where the package is a toy and nothing was downloaded from a real registry. The seals are a real SHA-256 of a made-up file text. The swapped file is the original with one line added, so its hash differs from the locked one.',
  },
};

const allows = (spec: Spec, ver: string) => (spec === 'exact' ? ver === '1.2.3' : spec === 'caret' ? v(ver)[0] === 1 && cmp(ver, '1.2.0') >= 0 : v(ver)[0] === 1 && v(ver)[1] === 2 && cmp(ver, '1.2.0') >= 0);

export default function DependencyLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [spec, setSpec] = useState<Spec>('caret');
  const [lock, setLock] = useState(false);
  const [next, setNext] = useState(false);
  const [swapped, setSwapped] = useState(false);
  const avail = next ? [...BASE, '1.9.10'].sort(cmp) : BASE;
  const pick = (a: string[]) => {
    if (lock || spec === 'exact') return '1.2.3';
    return a.filter((x) => allows(spec, x)).sort(cmp).pop()!;
  };
  const chosen = pick(avail);
  const today = pick(BASE);
  const hasHash = lock;
  const stopped = hasHash && swapped;
  const bad = swapped && !hasHash;
  const lockedSeal = fileHash('1.2.3');
  const arrivedSeal = fileHash(chosen, swapped);
  const B = 'var(--ib-bad)', A = 'var(--accent)';
  const BOXW = 124, GAP = 8;
  const boxX = (k: number) => 14 + k * (BOXW + GAP);
  const chosenIdx = avail.indexOf(chosen);
  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <Key items={T.legend} />
      {[
        [T.spec, <span className="seg" role="group" aria-label={T.spec} key="s">{(['caret', 'tilde', 'exact'] as Spec[]).map((k) => <button key={k} type="button" aria-pressed={spec === k} onClick={() => setSpec(k)}>{T.specs[k]}</button>)}</span>],
        [T.lock, <span className="seg" role="group" aria-label={T.lock} key="l"><button type="button" aria-pressed={!lock} onClick={() => setLock(false)}>{T.off}</button><button type="button" aria-pressed={lock} onClick={() => setLock(true)}>{T.on}</button></span>],
        [T.week, <span className="seg" role="group" aria-label={T.week} key="w"><button type="button" aria-pressed={!next} onClick={() => setNext(false)}>{T.weeks[0]}</button><button type="button" aria-pressed={next} onClick={() => setNext(true)}>{T.weeks[1]}</button></span>],
        [T.swap, <span className="seg" role="group" aria-label={T.swap} key="x"><button type="button" aria-pressed={!swapped} onClick={() => setSwapped(false)}>{T.swaps[0]}</button><button type="button" aria-pressed={swapped} onClick={() => setSwapped(true)}>{T.swaps[1]}</button></span>],
      ].map(([label, ctl], i) => (
        <div className="ib-controls" key={i} style={{ flexWrap: 'wrap' }}><span className="ib-lbl">{label as string}</span>{ctl}</div>
      ))}
      <div className="viz-box">
        <svg viewBox="0 0 880 560" role="img" aria-label={T.title}>
          <text x={14} y={24} className="ib-n" style={{ fontWeight: 700, fontSize: 16 }}>{`📦 ${T.avail}`}</text>
          {/* the bracket of the versions the way of asking allows */}
          {(() => {
            const idxs = avail.map((x, k) => (allows(spec, x) ? k : -1)).filter((k) => k >= 0);
            if (!idxs.length) return null;
            const x1 = boxX(idxs[0]), x2 = boxX(idxs[idxs.length - 1]) + BOXW;
            return (
              <g>
                <path d={`M${x1},${62} v-10 h${x2 - x1} v10`} fill="none" stroke={lock ? 'var(--line)' : A} strokeWidth={3.5} strokeDasharray={lock ? '6 5' : undefined} />
                <text x={x1} y={44} className="ib-s" style={{ fontSize: 13.5 }}>{T.allowed[spec]}</text>
              </g>
            );
          })()}
          {avail.map((ver, k) => {
            const sel = ver === chosen;
            const isNew = ver === '1.9.10';
            return (
              <g key={ver} opacity={allows(spec, ver) || lock ? 1 : 0.4}>
                <rect x={boxX(k)} y={66} width={BOXW} height={74} rx={10} fill={sel ? 'var(--accent-soft)' : 'var(--surface)'} stroke={sel ? (swapped ? B : A) : 'var(--line-strong)'} strokeWidth={sel ? 4 : 2} />
                <text x={boxX(k) + BOXW / 2} y={100} textAnchor="middle" className="ib-m" style={{ fontSize: 19, fontWeight: 700 }}>{ver}</text>
                {isNew ? <text x={boxX(k) + BOXW / 2} y={126} textAnchor="middle" className="ib-s" style={{ fontSize: 13, fill: A }}>★ {lang === 'th' ? 'ใหม่' : 'new'}</text> : null}
              </g>
            );
          })}
          {/* the picked box travels into our build */}
          <path d={`M${boxX(chosenIdx) + BOXW / 2},${142} V ${176}`} stroke={swapped ? B : A} strokeWidth={4} />
          <rect x={14} y={176} width={400} height={170} rx={12} fill="var(--surface)" stroke={swapped ? B : A} strokeWidth={3.5} />
          <text x={30} y={204} className="ib-s" style={{ fontSize: 13.5 }}>{`🛠️ ${T.yourBuild}`}</text>
          <text x={30} y={236} className="ib-n" style={{ fontWeight: 700, fontSize: 20 }}>{`${T.picked} ${chosen}`}</text>
          <text x={30} y={262} className="ib-s" style={{ fontSize: 13.5 }}>{lock || spec === 'exact' ? T.fromLock : T.fromRange}</text>
          <text x={30} y={296} style={{ fontSize: 15, fontWeight: 700, fill: chosen === today ? 'var(--fg)' : B }}>{wrapAny(chosen === today ? T.sameBuild : T.differs(today, chosen), lang === 'th' ? 40 : 44).map((l, k) => <tspan key={k} x={30} dy={k === 0 ? 0 : 20}>{l}</tspan>)}</text>
          {/* the seals */}
          <rect x={436} y={176} width={430} height={170} rx={12} fill="var(--surface)" stroke={bad ? B : stopped ? A : 'var(--line-strong)'} strokeWidth={bad || stopped ? 3.5 : 2} />
          <text x={452} y={204} className="ib-s" style={{ fontSize: 13.5 }}>{T.hash}</text>
          <text x={452} y={240} className="ib-s" style={{ fontSize: 13 }}>{T.arrived}</text>
          <Seal x={452} y={250} hex={arrivedSeal} cell={20} />
          <text x={452} y={308} className="ib-m" style={{ fontSize: 13 }}>{`${arrivedSeal.slice(0, 10)}…`}</text>
          {hasHash ? (
            <g>
              <text x={636} y={296} textAnchor="middle" style={{ fontSize: 40, fontWeight: 700, fill: swapped ? B : A }}>{swapped ? '≠' : '='}</text>
              <text x={680} y={240} className="ib-s" style={{ fontSize: 13 }}>{T.locked}</text>
              <Seal x={680} y={250} hex={lockedSeal} cell={20} />
              <text x={680} y={308} className="ib-m" style={{ fontSize: 13 }}>{`${lockedSeal.slice(0, 10)}…`}</text>
              <text x={452} y={334} className="ib-n" style={{ fontSize: 14, fontWeight: 700, fill: swapped ? B : A }}>{swapped ? `✗ ${T.hashBad}` : `✓ ${T.hashOk}`}</text>
            </g>
          ) : (
            <g>
              <rect x={680} y={236} width={168} height={74} rx={10} fill="none" stroke="var(--muted)" strokeWidth={2} strokeDasharray="7 5" />
              <text x={694} y={278} className="ib-s" style={{ fontSize: 14 }}>{T.noLock}</text>
              <text x={452} y={334} className="ib-n" style={{ fontSize: 14, fill: 'var(--muted)' }}>{T.noHash}</text>
            </g>
          )}
          {/* the verdict */}
          <rect x={14} y={366} width={852} height={74} rx={12} fill={bad ? 'color-mix(in srgb, var(--ib-bad) 10%, var(--surface))' : 'color-mix(in srgb, var(--accent) 8%, var(--surface))'} stroke={bad ? B : A} strokeWidth={3.5} />
          <text x={32} y={410} style={{ fontSize: 20, fontWeight: 700, fill: bad ? B : A }}>{bad ? `✗ ${T.verdictBad}` : stopped ? `✓ ${T.verdictStop}` : `✓ ${T.verdictOk}`}</text>
          <Paper x={14} y={458} w={852} h={90} title={`${T.lockCard}`} text={lock ? `toy-pkg==1.2.3  sha256:${lockedSeal.slice(0, 24)}…` : T.noLock} max={80} mono size={15} op={lock ? 1 : 0.5} />
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
