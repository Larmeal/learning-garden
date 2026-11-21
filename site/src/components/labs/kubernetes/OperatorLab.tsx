import { ClockControls, useClock, prog, smooth, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Tile, Arrow, type Lang } from '../devops/dv';
import data from './operator.json';

// Shows:      on the left a custom object (a Greeter with replicas and a message), in the middle a small loop that ticks once a second (look, compare, act), on the right the Deployment and Pods that the loop keeps in
//             line with the Greeter. Three things happen on the clock: the Greeter is created, someone deletes the Deployment, someone changes the Greeter.
// Because:    an operator is not magic, it is a controller written by someone else. The reader should see that it only ever does the same three things again and again, and that is why a deleted Deployment comes back.
// Control:    play, scrub and jump (the accidents are on the clock).
// Conclusion: a CRD teaches the API a new kind of object, and an operator is a loop that makes the world match what that object says.
//
// The log lines in the caption come from a real run of exercises/12_crd_operator.py (operator.json): one create, one repair after the Deployment was deleted, one update after the spec changed. The loop there runs in Python and polls once a second.

const D = 12;
const LOG = data.operator.log;

const TEXT: Record<Lang, { title: string; caption: string; g: string; loop: string; steps: string[]; dep: string; marks: Mark[]; banner: (t: number) => string }> = {
  th: {
    title: 'กดเล่นแล้วดู Loop ของ Operator ทำสามอย่างซ้ำ ๆ: ดูว่ามีอะไร เทียบกับที่ Greeter ต้องการ แล้วแก้ให้ตรง',
    caption: `บรรทัด Log ของ Operator ตัวจริงในแบบฝึก 12: "${LOG[0]}", "${LOG[1]}", "${LOG[2]}" Operator ตัวนี้เป็นสคริปต์ Python สั้น ๆ ที่ Poll ทุกวินาที ตัวจริงมักใช้ Watch แต่หน้าตาของ Loop เหมือนกัน`,
    g: 'Greeter hello', loop: 'Loop ของ Operator', steps: ['ดู', 'เทียบ', 'ทำ'], dep: 'Deployment greeter-hello',
    marks: [
      { at: 0, name: 'สร้าง Greeter', title: 'มี Greeter ที่ขอ 2 ตัว แต่ยังไม่มีอะไรทำตาม', text: 'CRD ทำให้ API รู้จักชนิดใหม่ และเก็บออบเจ็กต์ไว้ใน etcd เท่านั้น ถ้าไม่มี Operator ก็ไม่เกิดอะไรขึ้น' },
      { at: 2.5, name: 'Loop สร้าง', title: 'Loop เห็นว่าไม่มี Deployment จึงสร้างให้ และรายงาน Status', text: 'Deployment มี ownerReference ชี้กลับไปที่ Greeter' },
      { at: 6, name: 'ถูกลบ', title: 'มีคนลบ Deployment', text: 'ไม่มีใครบอก Operator มันแค่เจอในรอบถัดไปว่าของหายไป' },
      { at: 7.3, name: 'ซ่อมเอง', title: 'Loop สร้าง Deployment ใหม่ (uid ใหม่)', text: 'นี่คือ "repair" ใน Log' },
      { at: 9, name: 'แก้ spec', title: 'ผู้ใช้เปลี่ยน replicas เป็น 4 และข้อความใหม่', text: 'Loop เห็นว่า Deployment ต่างจาก spec จึงอัปเดต' },
      { at: 11, name: 'ตรงกันอีกครั้ง', title: 'Deployment มี 4 Pod ตามที่ Greeter ขอ', text: 'ถ้าลบ Greeter ตัว GC จะลบ Deployment ให้เอง ไม่ต้องใช้ Operator' },
    ],
    banner: (t) => t < 2.5 ? 'มีออบเจ็กต์ แต่ยังไม่มีผู้ทำตาม' : t < 6 ? 'Loop ทำให้ Deployment ตรงกับ Greeter' : t < 7.3 ? 'Deployment หายไป รอ Loop รอบถัดไป' : t < 9 ? 'ซ่อมเสร็จ' : t < 10.5 ? 'spec เปลี่ยน Loop กำลังอัปเดต' : 'ตรงกันอีกครั้ง',
  },
  en: {
    title: 'Press play and watch the operator\'s loop do three things again and again: look at what exists, compare it with what the Greeter wants, and fix the difference',
    caption: `Log lines of the real operator in exercise 12: "${LOG[0]}", "${LOG[1]}", "${LOG[2]}". The operator is a short Python script that polls once a second. A real one usually uses a watch, but the shape of the loop is the same.`,
    g: 'Greeter hello', loop: 'operator loop', steps: ['look', 'compare', 'act'], dep: 'Deployment greeter-hello',
    marks: [
      { at: 0, name: 'Create Greeter', title: 'A Greeter asks for 2, but nothing acts on it yet', text: 'A CRD only teaches the API a new kind and stores objects in etcd. Without an operator nothing happens.' },
      { at: 2.5, name: 'Loop creates', title: 'The loop sees there is no Deployment, makes one and reports status', text: 'The Deployment has an ownerReference pointing back at the Greeter.' },
      { at: 6, name: 'Deleted', title: 'Someone deletes the Deployment', text: 'Nobody tells the operator. It just finds out on its next pass that something is missing.' },
      { at: 7.3, name: 'Self-repair', title: 'The loop makes a new Deployment (new uid)', text: 'This is the "repair" in the log.' },
      { at: 9, name: 'Edit spec', title: 'The user changes replicas to 4 and the message', text: 'The loop sees the Deployment differs from the spec and updates it.' },
      { at: 11, name: 'Match again', title: 'The Deployment has 4 Pods, as the Greeter asks', text: 'If the Greeter is deleted, garbage collection removes the Deployment by itself, with no operator needed.' },
    ],
    banner: (t) => t < 2.5 ? 'An object exists, but nobody acts on it' : t < 6 ? 'The loop makes the Deployment match the Greeter' : t < 7.3 ? 'The Deployment is gone; wait for the next pass' : t < 9 ? 'Repaired' : t < 10.5 ? 'The spec changed; the loop is updating' : 'Matching again',
  },
};

export default function OperatorLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const clock = useClock(D);
  const t = clock.t;
  const depOn = (t >= 3 && t < 6) || t >= 7.8;
  const pods = t < 3 ? 0 : t >= 9.8 ? 4 : t >= 7.8 ? 2 : t < 6 ? 2 : 0;
  const reps = t >= 9 ? 4 : 2;
  const tick = Math.floor(t * 3) % 3;
  const gSt = t >= 11 ? 'ok' : t >= 3 ? 'on' : 'plain';
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <div className="viz-box">
        <svg viewBox="0 0 880 360" role="img" aria-label={T.title}>
          <Tile x={20} y={90} w={210} h={96} title={T.g} sub={`replicas: ${reps}${t >= 9 ? ' · "hello again"' : ''}`} state={gSt} />
          <text x={20} y={214} className="ib-s">status: {t < 3 ? '—' : t >= 11 ? 'Ready 4/4' : 'Ready 2/2'}</text>
          <rect className="ib-node" x={290} y={40} width={250} height={200} rx={14} />
          <text x={306} y={68} className="ib-n">{T.loop}</text>
          {T.steps.map((s, i) => <Tile key={s} x={310 + (i % 3) * 74} y={96} w={66} h={44} title={s} state={tick === i && t > 1.8 ? 'on' : 'plain'} />)}
          <text x={306} y={218} className="ib-s">{lang === 'th' ? 'ทุก 1 วินาที' : 'every second'}</text>
          <Arrow x1={232} y1={138} x2={286} y2={138} />
          <Arrow x1={542} y1={138} x2={598} y2={138} op={smooth(prog(t, 2.2, 3))} />
          <Tile x={600} y={90} w={260} h={96} title={T.dep} sub={depOn ? `replicas ${reps}` : (t >= 6 && t < 7.8 ? (lang === 'th' ? 'ถูกลบ' : 'deleted') : '—')} state={depOn ? 'ok' : t >= 6 && t < 7.8 ? 'bad' : 'skip'} op={depOn || (t >= 6 && t < 7.8) ? 1 : 0.5} />
          {Array.from({ length: 4 }, (_, i) => <Tile key={i} x={600 + i * 66} y={206} w={58} h={36} title="Pod" state={i < pods ? 'ok' : 'skip'} op={i < pods ? 1 : 0.25} />)}
          <Banner y={282} text={T.banner(t)} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
