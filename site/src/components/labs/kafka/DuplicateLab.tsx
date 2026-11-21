import { useState } from 'react';
import { StepControls, useStepper, type StepInfo } from '../spark/stepper';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import { Box, Cell } from './kf';
import data from './delivery.json';

// Shows:      a producer that sends an order, a leader that writes it but is slow to answer, a timeout, and the retry, with the log of the leader and the (producer id, sequence) stamp of each record.
// Because:    a duplicate is born from a retry of a write that had already worked. The order of events (write, silence, timeout, retry) is the whole story, and the stamp is what removes the duplicate.
// Control:    idempotence off or on, and the step buttons.
// Conclusion: without idempotence the retry writes the order again; with it the leader recognises the stamp (producer 7, sequence 0) and answers with the offset it already has.
//
// Exercise 08 froze a follower so that acks=all could not complete, with request.timeout.ms=3000: the log held 3 copies of the order without idempotence (two retries) and 1 copy with it. The picture shows one retry.

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; idem: string; off: string; on: string; producer: string; leader: string; stamp: string; retry: string; timeout: string; same: string; steps: (idem: boolean) => StepInfo[]; real: (a: number, b: number) => string; caption: string;
}> = {
  th: {
    title: 'เลือกว่าเปิด Idempotence หรือไม่ แล้วกดถัดไปทีละขั้น ดูว่าเมื่อ Producer ส่ง Order ซ้ำหลัง Timeout Log ของ Leader จะมีกี่ชุด',
    legend: [{ kind: 'new', text: 'Record ที่เพิ่งเขียน' }, { kind: 'use', text: 'Record ที่อยู่ใน Log' }, { kind: 'skip', text: 'ที่ที่ไม่มีการเขียน' }],
    idem: 'enable.idempotence', off: 'ปิด', on: 'เปิด', producer: 'Producer', leader: 'Leader', stamp: 'producerId · sequence', retry: 'ส่งซ้ำ', timeout: 'ไม่ได้รับคำตอบภายใน request.timeout.ms', same: 'เคยเห็นแล้ว ตอบ offset 0 เหมือนเดิม',
    steps: (idem) => [
      { name: 'ส่ง', title: 'Producer ส่ง Order o-1', text: 'Producer ส่ง Order ไปให้ Leader ด้วย acks=all และรอคำตอบ' },
      { name: 'Leader เขียน', title: 'Leader เขียนลง Log แล้ว', text: 'Leader เขียน Order ลง Log ของตัวเองที่ offset 0 แต่ต้องรอ Follower ดึงข้อมูลก่อนถึงจะตอบได้ และตอนนี้ Follower ตัวหนึ่งค้างอยู่' },
      { name: 'Timeout', title: 'Producer รอจนหมดเวลา', text: 'คำตอบไม่มาภายใน request.timeout.ms Producer ไม่รู้ว่า Order ถูกเขียนไปแล้ว จึงต้องตัดสินใจส่งซ้ำ' },
      { name: 'ส่งซ้ำ', title: 'Producer ส่ง Order เดิมอีกครั้ง', text: idem ? 'Producer ส่ง Batch เดิมอีกครั้ง พร้อมตราเดิมคือ producerId 7 และ sequence 0' : 'Producer ส่ง Batch เดิมอีกครั้ง โดยไม่มีตราอะไรบอกว่าเป็นของเดิม' },
      { name: 'ผลลัพธ์', title: idem ? 'Log มี Order เดียว' : 'Log มี Order สองชุด', text: idem ? 'Leader เห็นว่า producerId 7 sequence 0 เคยเขียนไปแล้ว จึงไม่เขียนซ้ำ และตอบ offset 0 ที่มีอยู่ Order มีชุดเดียว' : 'Leader ไม่มีทางรู้ว่าซ้ำ จึงเขียนอีกชุดที่ offset 1 ผู้อ่านจะเห็น Order เดียวกันสองครั้ง' },
    ],
    real: (a, b) => `ของจริงจากแบบฝึก 08: ไม่เปิด Idempotence ได้ ${a} ชุดใน Log (Producer ส่งซ้ำ 2 ครั้ง) เปิดแล้วได้ ${b} ชุด`,
    caption: 'แบบฝึก 08 ใช้ docker pause หยุด Follower ตัวหนึ่งเพื่อให้ acks=all ตอบไม่ได้ และตั้ง request.timeout.ms=3000 ในรูปวาดการส่งซ้ำแค่รอบเดียว',
  },
  en: {
    title: 'Choose idempotence on or off and press next one step at a time. See how many copies of the order the leader\'s log holds after the producer retries',
    legend: [{ kind: 'new', text: 'record just written' }, { kind: 'use', text: 'record in the log' }, { kind: 'skip', text: 'a place where nothing was written' }],
    idem: 'enable.idempotence', off: 'off', on: 'on', producer: 'producer', leader: 'leader', stamp: 'producerId · sequence', retry: 'retry', timeout: 'no answer within request.timeout.ms', same: 'seen before, answer offset 0 again',
    steps: (idem) => [
      { name: 'send', title: 'The producer sends order o-1', text: 'The producer sends the order to the leader with acks=all and waits for the answer.' },
      { name: 'leader writes', title: 'The leader has written it', text: 'The leader appended the order to its own log at offset 0, but it has to wait for the followers before it can answer, and one follower is stuck right now.' },
      { name: 'timeout', title: 'The producer waits until the time is up', text: 'No answer came within request.timeout.ms. The producer cannot know that the order was written, so it has to decide to send it again.' },
      { name: 'retry', title: 'The producer sends the same order again', text: idem ? 'The producer sends the same batch again, with the same stamp: producerId 7 and sequence 0.' : 'The producer sends the same batch again, with nothing that says it is the same one.' },
      { name: 'result', title: idem ? 'The log holds one order' : 'The log holds two copies', text: idem ? 'The leader sees that producerId 7 sequence 0 was written already, so it does not write it again and answers with the existing offset 0. There is one order.' : 'The leader has no way to tell, so it writes another copy at offset 1. A reader will see the same order twice.' },
    ],
    real: (a, b) => `The real run of exercise 08: ${a} copies in the log without idempotence (the producer retried twice) and ${b} copy with it`,
    caption: 'Exercise 08 used docker pause on one follower so that acks=all could not complete, with request.timeout.ms=3000. The picture shows one retry.',
  },
};

export default function DuplicateLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [idem, setIdem] = useState(false);
  const steps = T.steps(idem);
  const st = useStepper(steps.length);
  const s = st.step;
  const wrote = s >= 1;
  const second = s >= 4 && !idem;
  const stamp = (n: number) => (idem ? `7 · ${n}` : '−1');
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.idem}</span>
        <span className="seg" role="group" aria-label={T.idem}>
          <button type="button" aria-pressed={!idem} onClick={() => { setIdem(false); st.go(0); }}>{T.off}</button>
          <button type="button" aria-pressed={idem} onClick={() => { setIdem(true); st.go(0); }}>{T.on}</button>
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 300" role="img" aria-label={T.title}>
          <Box x={14} y={40} w={200} h={100} title={T.producer} state="use" sub={`${T.stamp}: ${idem ? '7 · 0' : '−1'}`} />
          <path className="ib-arrow" d="M214,70 L330,70" style={{ opacity: s >= 0 && s < 3 ? 1 : 0.25 }} />
          <path className="ib-arrow" d="M214,112 L330,112" style={{ opacity: s >= 3 ? 1 : 0.15, stroke: 'var(--k3)' }} />
          {s >= 3 && <text x={272} y={136} textAnchor="middle" className="ib-s">{T.retry}</text>}
          <Box x={330} y={20} w={536} h={150} title={T.leader} state="use" />
          {[0, 1, 2, 3, 4].map((j) => (
            <rect key={j} className="ib-skip" x={350 + j * 100} y={70} width={80} height={60} rx={8} style={{ opacity: 0.35 }} />
          ))}
          {wrote && <Cell x={350} y={70} w={80} h={60} offset={0} text="o-1" sub={stamp(0)} state={s === 1 ? 'new' : 'use'} />}
          {second && <Cell x={450} y={70} w={80} h={60} offset={1} text="o-1" sub={stamp(0)} state="new" />}
          {s === 2 && <text x={440} y={218} textAnchor="middle" className="ib-n" style={{ fill: 'var(--ib-bad)' }}>⏱ {T.timeout}</text>}
          {s === 4 && idem && <text x={590} y={218} textAnchor="middle" className="ib-n" style={{ fill: 'var(--brand)' }}>✓ {T.same}</text>}
          {s === 4 && !idem && <text x={590} y={218} textAnchor="middle" className="ib-n" style={{ fill: 'var(--ib-bad)' }}>✗ 2 × o-1</text>}
        </svg>
      </div>
      <StepControls steps={steps} step={s} playing={st.playing} go={st.go} toggle={st.toggle} lang={lang} />
      <div className="readout"><div>{T.real(data.duplicates.plain, data.duplicates.idempotent)}</div></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
