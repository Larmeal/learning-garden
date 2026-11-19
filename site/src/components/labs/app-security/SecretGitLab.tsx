import { StepControls, useStepper, type Lang } from '../spark/stepper';
import { Key } from '../data-security/ds';
import { Figure } from './bits';

// Shows:      the history of a repository as a chain of two commit cards, the file in the folder as it is now, and someone else's clone that holds a copy of every commit. Five steps: the key
//             is committed, the file is changed, the folder looks clean, the clone still holds the key in the first commit, and the only fix that works (revoke the key).
// Because:    "I deleted the file" is the belief behind most leaked keys, and it is only believable until you see that history is a chain of copies.
// Control:    the step player (Previous, Next, play, and the step buttons).
// Conclusion: removing a secret from the latest commit removes it from nothing else. Anyone with a clone can read it, so the key has to be revoked.
//
// The commands and the results are those of exercises/11_supply_chain_secrets.py in a throwaway Git repository, with a made-up key in the shape of an AWS key id.

const KEY = 'AKIAIOSFODNN7EXAMPLE';

const TEXT: Record<Lang, { title: string; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; steps: { name: string; title: string; text: string }[]; c1: string; c2: string; folder: string; clone: string; leaked: string; clean: string; caption: string; revoked: string }> = {
  th: {
    title: 'ไล่ดูห้าขั้นของ Key ที่เผลอ Commit แล้วลบไฟล์ แล้วดูว่าทำไมการลบถึงไม่พอ',
    legend: [{ kind: 'new', text: 'มี Key อยู่' }, { kind: 'use', text: 'ไม่มี Key' }],
    c1: 'Commit แรก: add config', c2: 'Commit สอง: ย้าย Key ไป Environment', folder: 'โฟลเดอร์ปัจจุบัน', clone: 'Clone ของคนอื่น', leaked: 'Key ยังอ่านได้', clean: 'ไฟล์ในโฟลเดอร์ไม่มี Key แล้ว', revoked: 'Key ถูกเพิกถอนแล้ว ค่าเดิมที่อยู่ใน History ใช้อะไรไม่ได้',
    steps: [
      { name: 'Commit Key', title: '1. เผลอ Commit ไฟล์ที่มี Key', text: 'config.py มีค่า AWS_KEY อยู่ตรง ๆ แล้ว git commit ไปหนึ่งครั้ง ตอนนี้ Key อยู่ใน Commit แรก' },
      { name: 'ย้ายออก', title: '2. รู้ตัว จึงแก้ไฟล์ให้อ่านจาก Environment', text: 'Commit ที่สองเปลี่ยน config.py ให้เรียก os.environ แทน Key ตรง ๆ' },
      { name: 'ดูเหมือนสะอาด', title: '3. ไฟล์ในโฟลเดอร์ไม่มี Key แล้ว', text: 'แบบฝึกเช็กว่าไฟล์ปัจจุบันไม่มีค่า Key หน้าตาเหมือนปลอดภัย' },
      { name: 'ใน History', title: '4. แต่ Commit แรกยังอยู่ และใครก็อ่านได้', text: 'git show <commit แรก>:config.py ยังเห็น Key และ git log -S บอกด้วยว่า Commit ไหนเป็นคนเติมเข้ามา Clone ของใครก็มีทั้งสอง Commit' },
      { name: 'เพิกถอน', title: '5. ทางแก้ที่ใช้ได้คือเพิกถอน Key', text: 'ไปที่ผู้ให้บริการ ยกเลิก Key นี้ แล้วออก Key ใหม่ การเขียน History ใหม่ช่วยลดคนที่เห็น แต่ใครที่ Clone ไปแล้วก็ยังมี' },
    ],
    caption: 'ผลการเช็กทั้งหมดมาจากแบบฝึก 11 ซึ่งรัน Git จริงใน Repository ชั่วคราว Key เป็นค่าตัวอย่างที่ไม่ใช่ของจริง ส่วนการเขียน History ใหม่ไม่ได้รัน',
  },
  en: {
    title: 'Walk the five steps of a key that was committed and then "removed", and see why deleting it is not enough',
    legend: [{ kind: 'new', text: 'the key is there' }, { kind: 'use', text: 'no key' }],
    c1: 'Commit 1: add config', c2: 'Commit 2: move the key to the environment', folder: 'the current folder', clone: "someone else's clone", leaked: 'the key can still be read', clean: 'the file in the folder holds no key', revoked: 'The key is revoked, so the old value in the history is worth nothing',
    steps: [
      { name: 'commit the key', title: '1. A file with a key is committed by mistake', text: 'config.py holds the AWS_KEY value in plain text and gets one git commit. Now the key is in the first commit.' },
      { name: 'move it out', title: '2. We notice, and change the file to read from the environment', text: 'The second commit changes config.py to call os.environ instead of holding the key.' },
      { name: 'looks clean', title: '3. The file in the folder has no key now', text: 'The exercise checks that the current file holds no key value. It looks safe.' },
      { name: 'in the history', title: '4. But the first commit is still there, and anyone can read it', text: 'git show <first commit>:config.py still shows the key, and git log -S tells which commit added it. Anyone\'s clone holds both commits.' },
      { name: 'revoke', title: '5. The fix that works is to revoke the key', text: 'Go to the provider, cancel this key and issue a new one. Rewriting the history reduces who sees it, but anyone who already cloned it still has it.' },
    ],
    caption: 'All the checks come from exercise 11, which ran the real Git in a throwaway repository. The key is a made up example, not a real one. Rewriting history was not run.',
  },
};

export default function SecretGitLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const st = useStepper(T.steps.length, 3200);
  const s = st.step;
  const has2 = s >= 1;
  const revoked = s >= 4;
  const R = 'var(--ib-bad)', A = 'var(--accent)';
  const th = lang === 'th';
  const L = {
    history: th ? 'ประวัติของ Repository (Commit เรียงต่อกัน)' : 'the history of the repository (commits in a chain)',
    folder: th ? 'ไฟล์ในโฟลเดอร์ตอนนี้' : 'the file in the folder now',
    clone: th ? 'Clone ของคนอื่น (มีสำเนาของทุก Commit)' : "someone else's clone (a copy of every commit)",
    key: th ? 'Key' : 'key',
    old: th ? 'ยังอยู่ใน Commit แรก' : 'still in the first commit',
    revoked: th ? 'เพิกถอนแล้ว' : 'revoked',
    reads: th ? 'อ่านได้' : 'can read it',
    nobody: th ? 'ยังไม่มีใครรู้' : 'nobody knows yet',
  };
  const keyLine = `AWS_KEY = "${KEY.slice(0, 12)}…"`;
  const envLine = 'AWS_KEY = os.environ["AWS_KEY"]';
  // a commit card: a title, the file line, and a key badge when the line holds the key
  const commit = (x: number, y: number, w: number, title: string, line: string, hasKey: boolean, op = 1) => {
    const dead = hasKey && revoked;
    return (
      <g opacity={op}>
        <rect x={x} y={y} width={w} height={96} rx={12} fill="var(--surface)" stroke={hasKey && !revoked ? R : hasKey ? 'var(--muted)' : A} strokeWidth={hasKey && !revoked ? 3.5 : 2.5} />
        <text x={x + 14} y={y + 26} className="ib-n" style={{ fontWeight: 700, fontSize: 15 }}>{title}</text>
        <text x={x + 14} y={y + 58} className="ib-m" style={{ fontSize: 14.5, fontWeight: hasKey ? 700 : 400, fill: hasKey && !revoked ? R : 'var(--fg)', textDecoration: dead ? 'line-through' : undefined }}>{line}</text>
        {hasKey ? <text x={x + w - 14} y={y + 84} textAnchor="end" className="ib-s" style={{ fontSize: 13.5, fill: dead ? 'var(--muted)' : R, fontWeight: 700 }}>{dead ? `🔑 ${L.revoked}` : `🔑 ${L.key}`}</text> : null}
      </g>
    );
  };
  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <Key items={[{ color: R, text: T.legend[0].text }, { color: A, text: T.legend[1].text }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 346" role="img" aria-label={T.title}>
          <text x={14} y={24} className="ib-s" style={{ fontSize: 14 }}>{L.history}</text>
          {commit(14, 36, 410, T.c1, keyLine, true)}
          <line x1={424} y1={84} x2={456} y2={84} stroke="var(--line-strong)" strokeWidth={4} opacity={has2 ? 1 : 0.2} />
          {commit(456, 36, 410, T.c2, envLine, false, has2 ? 1 : 0.2)}
          <text x={14} y={172} className="ib-s" style={{ fontSize: 14 }}>{L.folder}</text>
          {commit(14, 184, 410, 'config.py', has2 ? envLine : keyLine, !has2)}
          {s >= 2 ? <text x={34} y={304} className="ib-n" style={{ fontSize: 15, fontWeight: 700, fill: A }}>{`✓ ${T.clean}`}</text> : null}
          {/* someone else's clone holds every commit */}
          <text x={456} y={172} className="ib-s" style={{ fontSize: 14 }}>{L.clone}</text>
          <g opacity={s >= 3 ? 1 : 0.28}>
            <rect x={456} y={184} width={410} height={150} rx={12} fill="var(--surface)" stroke={s >= 3 && !revoked ? R : 'var(--line-strong)'} strokeWidth={s >= 3 && !revoked ? 3.5 : 2} strokeDasharray={s >= 3 ? undefined : '7 5'} />
            <Figure cx={490} cy={212} r={11} />
            <rect x={522} y={196} width={160} height={48} rx={8} fill="var(--surface)" stroke={revoked ? 'var(--muted)' : R} strokeWidth={2.5} />
            <text x={532} y={226} className="ib-m" style={{ fontSize: 13, fill: revoked ? 'var(--muted)' : R, fontWeight: 700 }}>{`${T.c1.split(':')[0]}  🔑`}</text>
            <rect x={694} y={196} width={160} height={48} rx={8} fill="var(--surface)" stroke={A} strokeWidth={2} />
            <text x={704} y={226} className="ib-m" style={{ fontSize: 13 }}>{T.c2.split(':')[0]}</text>
            <path d="M682,220 h12" stroke="var(--line-strong)" strokeWidth={3} />
            <text x={470} y={288} className="ib-n" style={{ fontSize: 14.5, fontWeight: 700, fill: revoked ? 'var(--muted)' : R }}>{revoked ? `🔑 ${L.revoked}` : `✗ ${T.leaked}`}</text>
            <text x={470} y={314} className="ib-s" style={{ fontSize: 13 }}>{`git show <commit 1>:config.py`}</text>
          </g>
          {s >= 3 && !revoked ? <path d="M520,196 C 480,150 330,150 250,140" fill="none" stroke={R} strokeWidth={3} strokeDasharray="8 6" /> : null}
        </svg>
      </div>
      <StepControls steps={T.steps} step={st.step} playing={st.playing} go={st.go} toggle={st.toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
