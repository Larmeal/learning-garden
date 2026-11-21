import { useState } from 'react';
import { ClockControls, useClock, prog, smooth, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Seg, Tile, Arrow, type Lang } from '../devops/dv';
import data from './cluster.json';

// Shows:      a cluster as two worker computers (boxes) with Pods (small tiles) on them, and above them one card that holds the wish ("3 copies of web") and what is counted now.
//             The reader presses one of two accidents (a Pod is deleted, a worker computer stops) and watches the card go from "3 = 3" to "2 ≠ 3" and the missing Pods appear again.
// Because:    "desired state" is a difference between two numbers that something keeps closing. A paragraph says it, but only a picture in time shows who notices and who acts.
// Control:    the accident (delete a Pod, stop a worker); play, scrub and jump buttons.
// Conclusion: you never tell Kubernetes to restart anything. You write what you want, and a loop compares it with what exists and closes the gap.
//
// Numbers (2.3 s, 43 s, 61 s) come from exercises/01_cluster.py (cluster.json); the animation time is shortened and says so in the caption.

type Acc = 'pod' | 'node';
const D = 12;
const REPLACE = data.replace.seconds, NOTREADY = data.nodeLoss.notReadySeconds, MOVED = data.nodeLoss.movedSeconds;

const TEXT: Record<Lang, { title: string; caption: string; acc: string; accs: Record<Acc, string>; want: string; have: string; cp: string; w: string; down: string; pend: string; marks: (a: Acc) => Mark[]; banner: (a: Acc, t: number) => string }> = {
  th: {
    title: 'เลือกอุบัติเหตุแล้วกดเล่น ดูว่าตัวเลขสองตัวบนการ์ดไม่เท่ากันเมื่อไรและใครทำให้มันเท่ากันอีกครั้ง',
    caption: `เวลาในภาพถูกย่อให้เล่นจบใน 12 วินาที เวลาจริงจากแบบฝึก 01 บนคลัสเตอร์ 3 Node: Pod ที่ถูกลบมี Pod ใหม่พร้อมใช้ใน ${REPLACE} วินาที ส่วน Node ที่หยุดถูกประกาศ NotReady หลัง ${NOTREADY} วินาที และ Pod ใหม่พร้อมครบที่ ${MOVED} วินาที (ปกติ Pod บน Node ที่หายไปจะรอ 300 วินาที แบบฝึกนี้ลดเหลือ 10 วินาทีด้วย tolerationSeconds)`,
    acc: 'อุบัติเหตุ', accs: { pod: 'ลบ Pod หนึ่งตัว', node: 'Worker หยุดทำงานทั้งเครื่อง' },
    want: 'ที่ต้องการ', have: 'ที่เจอตอนนี้', cp: 'Control Plane', w: 'Worker', down: 'หยุดทำงาน', pend: 'กำลังสร้าง',
    marks: (a) => a === 'pod' ? [
      { at: 0, name: 'ปกติ', title: 'ต้องการ 3 ตัว เจอ 3 ตัว ตัวเลขเท่ากัน', text: 'Deployment บอกไว้ว่าอยากได้ web 3 ตัว Control Plane ตรวจแล้วเจอ 3 ตัวพอดี จึงไม่ต้องทำอะไร' },
      { at: 2.5, name: 'Pod ถูกลบ', title: 'มีคนลบ Pod หนึ่งตัว', text: 'ไม่มีใครบอก Kubernetes ว่าให้สร้างใหม่ มันแค่นับแล้วเจอว่าเหลือ 2' },
      { at: 4.5, name: 'ตัวเลขไม่เท่ากัน', title: 'ต้องการ 3 เจอ 2: ช่องว่างหนึ่งตัว', text: 'ReplicaSet Controller เห็นความต่างนี้ มันไม่รู้ว่าทำไม Pod หายไป รู้แค่ว่าขาดหนึ่ง' },
      { at: 7, name: 'สร้างใหม่', title: 'Pod ใหม่ (ชื่อใหม่) ถูกสร้างและเริ่มทำงาน', text: `Scheduler เลือก Node ให้ แล้ว Kubelet ของ Node นั้นรัน Container จบใน ${REPLACE} วินาทีจริง` },
      { at: 10, name: 'กลับมาเท่ากัน', title: 'ต้องการ 3 เจอ 3 อีกครั้ง', text: 'Pod ตัวเก่าไม่ได้กลับมา ตัวที่เห็นคือตัวใหม่ที่มีชื่อต่างจากเดิม' },
    ] : [
      { at: 0, name: 'ปกติ', title: 'ต้องการ 3 ตัว เจอ 3 ตัว ตัวเลขเท่ากัน', text: 'Pod กระจายอยู่บน Worker สองเครื่อง' },
      { at: 2.5, name: 'Worker หยุด', title: 'Worker ตัวบนหยุดทำงาน', text: 'Pod สองตัวที่อยู่บนนั้นยังขึ้นว่า Running ในรายการ เพราะ Control Plane ยังไม่รู้ว่าเกิดอะไรขึ้น' },
      { at: 5, name: 'NotReady', title: `Control Plane ประกาศว่า Worker NotReady (จริง ${NOTREADY} วินาที)`, text: 'Kubelet ของ Worker ต้องส่ง Lease ทุกประมาณ 10 วินาที พอเงียบเกิน 40 วินาที Node Controller ก็ติดป้ายว่า NotReady ตัวเลขจึงเปลี่ยนเป็น 1' },
      { at: 8, name: 'สร้างที่อื่น', title: `Pod ใหม่สองตัวขึ้นบน Worker ที่ยังอยู่ (จริง ${MOVED} วินาที)`, text: 'ReplicaSet Controller เห็นว่าขาดสอง จึงสร้างสองตัว Scheduler ส่งไปที่ Worker ที่ยังพร้อม' },
      { at: 11, name: 'เท่ากันอีกครั้ง', title: 'ต้องการ 3 เจอ 3 บน Worker เครื่องเดียว', text: 'ไม่มีใครต้องเข้าไปแก้ด้วยมือ ตัวเลขสองตัวนี้ถูกตรวจซ้ำตลอดเวลา' },
    ],
    banner: (a, t) => a === 'pod' ? (t < 2.5 ? 'Deployment บอกว่าอยากได้ web 3 ตัว' : t < 7 ? 'ตัวเลขสองตัวไม่เท่ากัน จึงต้องมีคนสร้างเพิ่ม' : 'ช่องว่างถูกปิดแล้ว') : (t < 2.5 ? 'Deployment บอกว่าอยากได้ web 3 ตัว' : t < 5 ? 'Worker หยุดแล้ว แต่ Control Plane ยังไม่รู้' : t < 8 ? 'รู้แล้วว่า Worker หาย กำลังสร้าง Pod แทน' : 'Pod ที่หายไปถูกสร้างบน Worker ที่เหลือ'),
  },
  en: {
    title: 'Pick an accident and press play, and see when the two numbers on the card stop matching and who makes them match again',
    caption: `The animation is shortened to play in 12 seconds. Real times from exercise 01 on the 3 node cluster: a deleted Pod has a new Pod Ready in ${REPLACE} s; a stopped node is declared NotReady after ${NOTREADY} s and the replacement Pods are all Ready at ${MOVED} s (normally Pods on a lost node wait 300 s; the exercise shortens that to 10 s with tolerationSeconds).`,
    acc: 'accident', accs: { pod: 'delete one Pod', node: 'a whole worker stops' },
    want: 'wanted', have: 'found now', cp: 'Control Plane', w: 'Worker', down: 'down', pend: 'starting',
    marks: (a) => a === 'pod' ? [
      { at: 0, name: 'Normal', title: 'Wanted 3, found 3: the numbers match', text: 'The Deployment says it wants 3 copies of web. The control plane counts and finds 3, so there is nothing to do.' },
      { at: 2.5, name: 'Pod deleted', title: 'Someone deletes one Pod', text: 'Nobody tells Kubernetes to create a new one. It only counts, and finds 2.' },
      { at: 4.5, name: 'Mismatch', title: 'Wanted 3, found 2: a gap of one', text: 'The ReplicaSet controller sees the difference. It does not know why the Pod went away, only that one is missing.' },
      { at: 7, name: 'Create', title: 'A new Pod (with a new name) is created and starts', text: `The scheduler picks a node, then that node's kubelet runs the container, in ${REPLACE} s in the real run.` },
      { at: 10, name: 'Match again', title: 'Wanted 3, found 3 again', text: 'The old Pod did not come back. What you see is a new one with a different name.' },
    ] : [
      { at: 0, name: 'Normal', title: 'Wanted 3, found 3: the numbers match', text: 'The Pods are spread over two workers.' },
      { at: 2.5, name: 'Worker stops', title: 'The upper worker stops', text: 'The two Pods on it still say Running in the list, because the control plane does not know yet.' },
      { at: 5, name: 'NotReady', title: `The control plane declares the worker NotReady (${NOTREADY} s in the real run)`, text: 'A kubelet renews a Lease about every 10 s. When it is silent for more than 40 s the node controller marks the node NotReady, and the number found drops to 1.' },
      { at: 8, name: 'Create elsewhere', title: `Two new Pods start on the worker that is left (${MOVED} s in the real run)`, text: 'The ReplicaSet controller sees two missing and creates two. The scheduler sends them to the worker that is still ready.' },
      { at: 11, name: 'Match again', title: 'Wanted 3, found 3, all on one worker', text: 'Nobody had to fix it by hand. The two numbers are checked again and again.' },
    ],
    banner: (a, t) => a === 'pod' ? (t < 2.5 ? 'The Deployment says it wants 3 copies of web' : t < 7 ? 'The two numbers differ, so someone must create one more' : 'The gap is closed') : (t < 2.5 ? 'The Deployment says it wants 3 copies of web' : t < 5 ? 'The worker has stopped, but the control plane does not know yet' : t < 8 ? 'It knows the worker is gone and is creating replacement Pods' : 'The lost Pods were created on the worker that is left'),
  },
};

export default function ClusterLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [a, setA] = useState<Acc>('pod');
  const clock = useClock(D);
  const t = clock.t;
  // positions: worker A (top-left) holds slots 0,1 ; worker B holds slot 2 ; replacements go to B (node case) or A (pod case)
  const slotsA = [60, 150], slotsB = [60, 150];
  const nodeDown = a === 'node' ? prog(t, 2.5, 3) : 0;
  const stopped = a === 'node' && t >= 2.5;
  const declared = a === 'node' && t >= 5;
  // which Pods are visible and how
  const pods: { x: number; y: number; state: 'plain' | 'ok' | 'bad' | 'skip' | 'on'; op: number; label: string }[] = [];
  const AY = 150, BY = 270;
  if (a === 'pod') {
    pods.push({ x: 70 + slotsA[0], y: AY, state: 'ok', op: 1, label: 'web-a' });
    pods.push({ x: 70 + slotsA[1], y: AY, state: t < 2.5 ? 'ok' : t < 4.5 ? 'bad' : 'plain', op: t < 4.5 ? 1 : 1 - prog(t, 4.5, 5.5), label: 'web-b' });
    pods.push({ x: 70 + slotsB[0], y: BY, state: 'ok', op: 1, label: 'web-c' });
    if (t >= 7) pods.push({ x: 70 + slotsA[1], y: AY, state: t < 9 ? 'on' : 'ok', op: smooth(prog(t, 7, 7.6)), label: 'web-d' });
  } else {
    pods.push({ x: 70 + slotsA[0], y: AY, state: stopped ? (declared ? 'skip' : 'bad') : 'ok', op: declared ? 1 - prog(t, 5, 6) * 0.5 : 1, label: 'web-a' });
    pods.push({ x: 70 + slotsA[1], y: AY, state: stopped ? (declared ? 'skip' : 'bad') : 'ok', op: declared ? 1 - prog(t, 5, 6) * 0.5 : 1, label: 'web-b' });
    pods.push({ x: 70 + slotsB[0], y: BY, state: 'ok', op: 1, label: 'web-c' });
    if (t >= 8) {
      pods.push({ x: 70 + slotsB[1], y: BY, state: t < 10 ? 'on' : 'ok', op: smooth(prog(t, 8, 8.6)), label: 'web-d' });
      pods.push({ x: 70 + slotsB[1] + 90, y: BY, state: t < 10 ? 'on' : 'ok', op: smooth(prog(t, 8.3, 8.9)), label: 'web-e' });
    }
  }
  const found = a === 'pod' ? (t < 2.5 ? 3 : t < 7 ? 2 : 3) : (t < 5 ? 3 : t < 8 ? 1 : 3);
  const match = found === 3;
  const marks = T.marks(a);
  const cardX = 520;
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <div className="ib-legend" aria-label="legend">
        <span><i style={{ background: 'color-mix(in srgb, var(--k2) 30%, var(--surface))', borderColor: 'var(--k2)' }} />Running</span>
        <span><i className="new" />{T.pend}</span>
        <span><i style={{ background: 'color-mix(in srgb, var(--ib-bad) 25%, var(--surface))', borderColor: 'var(--ib-bad)' }} />{a === 'pod' ? 'Terminating' : T.down}</span>
      </div>
      <Seg label={T.acc} options={(Object.keys(T.accs) as Acc[]).map((k) => ({ id: k, text: T.accs[k] }))} value={a} onChange={(v) => { setA(v); clock.restart(); }} />
      <div className="viz-box">
        <svg viewBox="0 0 880 400" role="img" aria-label={T.title}>
          <rect className="ib-node" x={cardX} y={20} width={340} height={168} rx={12} style={{ stroke: match ? 'var(--k2)' : 'var(--ib-bad)', strokeWidth: 3 }} />
          <text x={cardX + 16} y={46} className="ib-n">{T.cp}</text>
          <text x={cardX + 16} y={70} className="ib-s">Deployment web</text>
          <text x={cardX + 40} y={118} className="ib-s">{T.want}</text>
          <text x={cardX + 40} y={160} className="ib-big" style={{ fontSize: 44 }}>3</text>
          <text x={cardX + 140} y={152} className="ib-big" style={{ fontSize: 44, fill: match ? 'var(--k2)' : 'var(--ib-bad)' }}>{match ? '=' : '≠'}</text>
          <text x={cardX + 215} y={118} className="ib-s">{T.have}</text>
          <text x={cardX + 235} y={160} className="ib-big" style={{ fontSize: 44, fill: match ? 'var(--fg)' : 'var(--ib-bad)' }}>{found}</text>
          <Arrow x1={cardX - 8} y1={104} x2={460} y2={104} dashed op={match ? 0.35 : 1} bad={!match} />
          <text x={cardX - 12} y={92} className="ib-s" textAnchor="end">{lang === 'th' ? 'ตรวจซ้ำตลอด' : 'checks again and again'}</text>
          {[{ y: 100, title: `${T.w} 1`, dn: stopped, key: 'A' }, { y: 220, title: `${T.w} 2`, dn: false, key: 'B' }].map((n) => (
            <g key={n.key} style={{ opacity: n.dn ? 1 - 0.4 * nodeDown : 1 }}>
              <rect className="ib-node" x={20} y={n.y} width={460} height={100} rx={12} style={{ strokeDasharray: n.dn ? '8 6' : undefined, stroke: n.dn && a === 'node' ? 'var(--ib-bad)' : undefined }} />
              <text x={34} y={n.y + 26} className="ib-n">{n.title}</text>
              {n.dn && <text x={34} y={n.y + 90} className="ib-s" style={{ fill: 'var(--ib-bad)' }}>{declared ? 'NotReady' : T.down}</text>}
            </g>
          ))}
          {pods.map((p, i) => <Tile key={i} x={p.x} y={p.y} w={80} h={40} title={p.label} state={p.state} op={p.op} />)}
          <Banner y={340} text={T.banner(a, t)} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
