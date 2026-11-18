import { StepControls, useStepper, type Lang } from '../spark/stepper';
import { Legend, Lines } from '../iceberg/ib';

// Shows:      a key committed in the first commit and "removed" in the second. Five steps: the key is added, the file is changed, the folder looks clean,
//             a clone still holds the key in the first commit, and the only fix that works (revoke the key).
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
  const has1 = true;
  const has2 = s >= 1;
  const keyNow = s < 1 ? true : false;
  const revoked = s >= 4;
  const box = (x: number, y: number, w: number, h: number, title: string, line1: string, hasKey: boolean, dim?: boolean) => (
    <g style={{ opacity: dim ? 0.35 : 1 }}>
      <rect className={hasKey && !revoked ? 'ib-new' : 'ib-use'} x={x} y={y} width={w} height={h} rx={10} style={hasKey && !revoked ? { stroke: 'var(--ib-bad)', strokeWidth: 3, fill: 'var(--surface)' } : undefined} />
      <text x={x + 14} y={y + 28} className="ib-n" style={{ fontWeight: 700 }}>{title}</text>
      <text x={x + 14} y={y + 56} className="ib-m" style={{ fontSize: 14 }}>{line1}</text>
    </g>
  );
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="viz-box">
        <svg viewBox="0 0 880 420" role="img" aria-label={T.title}>
          {/* the chain */}
          {box(20, 30, 380, 82, T.c1, `AWS_KEY = "${KEY.slice(0, 12)}…"`, true, !has1)}
          {box(480, 30, 380, 82, T.c2, 'AWS_KEY = os.environ["AWS_KEY"]', false, !has2)}
          <line x1={400} y1={71} x2={480} y2={71} className="ib-line" style={{ strokeWidth: 3, opacity: has2 ? 1 : 0.2 }} />
          {/* the folder and the clone */}
          <text x={20} y={156} className="ib-s">{T.folder}</text>
          {box(20, 166, 380, 74, 'config.py', has2 ? 'AWS_KEY = os.environ[...]' : `AWS_KEY = "${KEY.slice(0, 12)}…"`, keyNow)}
          <text x={480} y={156} className="ib-s">{T.clone}</text>
          {box(480, 166, 380, 74, 'git show <commit 1>:config.py', `AWS_KEY = "${KEY.slice(0, 12)}…"`, true, s < 3)}
          <text x={20} y={274} className={s >= 2 && s < 4 ? 'ib-ok ib-n' : 'ib-n'} style={{ opacity: s >= 2 ? 1 : 0.25 }}>{s >= 2 ? `✓ ${T.clean}` : ''}</text>
          <text x={480} y={274} className="ib-bad ib-n" style={{ fontWeight: 700, opacity: s >= 3 && !revoked ? 1 : 0 }}>{`✗ ${T.leaked}`}</text>
          <g style={{ opacity: revoked ? 1 : 0 }}>
            <rect className="ib-new" x={20} y={300} width={840} height={52} rx={10} />
            <Lines x={36} y={332} text={T.revoked} max={lang === 'th' ? 80 : 96} className="ib-n" />
          </g>
        </svg>
      </div>
      <StepControls steps={T.steps} step={st.step} playing={st.playing} go={st.go} toggle={st.toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
