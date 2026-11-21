import { useState } from 'react';
import { StepControls, useStepper, type StepInfo } from '../spark/stepper';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import { Box, Cell } from './kf';

// Shows:      one order travelling from a producer to a leader and its two followers, with the moment at which the producer gets its "ack" marked, and a crash of the leader before or after the followers copied it.
// Because:    what acks=0, 1 and all promise is about the moment of the answer compared with the moment of the copy. In a table that is a row of words; in the picture the ack arrow and the copies can be compared.
// Control:    acks (0, 1, all), when the leader crashes (before or after the followers copied the record), and the step buttons.
// Conclusion: with acks=1 a record can be lost although the producer was told "ok"; with acks=all the answer only comes after the copies, so a crash before it means "no answer, send again" and not "lost".
//
// The model assumes the two followers are in the ISR. Exercise 06 shows the case where they are not (the ISR is the leader alone) and acks=all loses data too.

type Acks = '0' | '1' | 'all';
type Phase = 'send' | 'write' | 'copy' | 'crash' | 'elect';

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; acks: string; crash: string; crashes: { before: string; after: string };
  producer: string; leader: string; follower: string; ack: string; noack: string; lost: string; safe: string; resend: string; newLeader: string;
  phase: Record<Phase, [string, string]>; text: (p: Phase, acks: Acks, crash: 'before' | 'after') => string; caption: string;
}> = {
  th: {
    title: 'เลือก acks และจังหวะที่ Leader ล้ม แล้วกดถัดไปทีละขั้น ดูว่า Order ใบนี้รอดหรือหายไป และ Producer รู้หรือไม่',
    legend: [{ kind: 'new', text: 'Record ที่เพิ่งถูกเขียน' }, { kind: 'use', text: 'Broker ที่ยังทำงาน' }, { kind: 'skip', text: 'Broker ที่ล้มแล้ว' }],
    acks: 'acks', crash: 'Leader ล้ม', crashes: { before: 'ก่อน Follower ทันคัดลอก', after: 'หลัง Follower คัดลอกแล้ว' },
    producer: 'Producer', leader: 'Broker A (Leader)', follower: 'Follower', ack: 'ack: เขียนสำเร็จ', noack: 'ไม่มี ack', lost: 'Record หาย แต่ Producer เชื่อว่าส่งสำเร็จ', safe: 'Record ยังอยู่', resend: 'Producer ไม่ได้ ack จึงส่งซ้ำ', newLeader: 'Leader ใหม่',
    phase: { send: ['ส่ง', 'Producer ส่ง Order'], write: ['Leader เขียน', 'Leader เขียนลง Log'], copy: ['Follower คัดลอก', 'Follower ดึงไปเก็บ'], crash: ['Leader ล้ม', 'Leader ล้ม'], elect: ['เลือก Leader ใหม่', 'เลือก Leader ใหม่'] },
    text: (p, a, c) => {
      if (p === 'send') return a === '0' ? 'Producer ส่ง Order ไปให้ Leader แล้วเดินต่อเลย ไม่รอคำตอบ (acks=0)' : 'Producer ส่ง Order ไปให้ Leader แล้วรอคำตอบ';
      if (p === 'write') return a === '1' ? 'Leader เขียนลง Log ของตัวเองแล้วตอบ ack ทันที (acks=1) ตอนนี้ยังมีสำเนาอยู่ที่ Leader ตัวเดียว' : 'Leader เขียนลง Log ของตัวเอง ตอนนี้ยังมีสำเนาอยู่ที่ Leader ตัวเดียว';
      if (p === 'copy') return a === 'all' ? 'Follower ทั้งสองดึง Record ไปเก็บ แล้ว Leader ถึงตอบ ack (acks=all) ตอนนี้มีสำเนาสามที่' : 'Follower ทั้งสองดึง Record ไปเก็บ ตอนนี้มีสำเนาสามที่';
      if (p === 'crash') return c === 'before' ? 'Leader ล้มก่อนที่ Follower จะทันดึง Record ไปเก็บ' : 'Leader ล้มหลังจาก Follower ดึง Record ไปเก็บแล้ว';
      if (c === 'after') return 'Follower ตัวหนึ่งขึ้นเป็น Leader และมี Record อยู่ในมือ Order ไม่หาย';
      if (a === 'all') return 'Follower ตัวหนึ่งขึ้นเป็น Leader แต่ไม่มี Record นี้ Producer ไม่เคยได้ ack จึงส่ง Order ซ้ำให้ Leader ใหม่ Order ไม่หาย';
      return 'Follower ตัวหนึ่งขึ้นเป็น Leader แต่ไม่มี Record นี้ Order หายไป ทั้งที่ Producer ' + (a === '1' ? 'ได้ ack ไปแล้ว' : 'ไม่รอ ack ตั้งแต่แรก');
    },
    caption: 'แบบจำลองนี้สมมุติว่า Follower ทั้งสองอยู่ใน ISR ครบ แบบฝึก 06 แสดงกรณีที่ ISR เหลือ Leader ตัวเดียว ซึ่ง acks=all ก็ทำ Record หายได้',
  },
  en: {
    title: 'Choose acks and when the leader crashes, then press next one step at a time. See whether the order survives and whether the producer knows',
    legend: [{ kind: 'new', text: 'record just written' }, { kind: 'use', text: 'broker that is running' }, { kind: 'skip', text: 'broker that has crashed' }],
    acks: 'acks', crash: 'leader crashes', crashes: { before: 'before the followers copied', after: 'after the followers copied' },
    producer: 'producer', leader: 'broker A (leader)', follower: 'follower', ack: 'ack: write succeeded', noack: 'no ack', lost: 'record lost, yet the producer believes it was sent', safe: 'record survives', resend: 'no ack came, so the producer sends it again', newLeader: 'new leader',
    phase: { send: ['send', 'producer sends the order'], write: ['leader writes', 'leader appends to its log'], copy: ['followers copy', 'followers fetch it'], crash: ['leader crashes', 'leader crashes'], elect: ['new leader', 'a new leader is chosen'] },
    text: (p, a, c) => {
      if (p === 'send') return a === '0' ? 'The producer sends the order to the leader and moves on without waiting (acks=0).' : 'The producer sends the order to the leader and waits for an answer.';
      if (p === 'write') return a === '1' ? 'The leader appends the record to its own log and answers ack at once (acks=1). Only the leader holds a copy so far.' : 'The leader appends the record to its own log. Only the leader holds a copy so far.';
      if (p === 'copy') return a === 'all' ? 'Both followers fetch the record and store it, and only then does the leader answer ack (acks=all). Three copies exist now.' : 'Both followers fetch the record and store it. Three copies exist now.';
      if (p === 'crash') return c === 'before' ? 'The leader crashes before the followers could fetch the record.' : 'The leader crashes after the followers fetched the record.';
      if (c === 'after') return 'One follower becomes the leader and holds the record. The order is not lost.';
      if (a === 'all') return 'One follower becomes the leader without this record. The producer never got an ack, so it sends the order again to the new leader. The order is not lost.';
      return 'One follower becomes the leader without this record. The order is lost, although the producer ' + (a === '1' ? 'had its ack already.' : 'never waited for an ack.');
    },
    caption: 'The model assumes both followers are in the ISR. Exercise 06 shows the case where the ISR is the leader alone, in which acks=all loses a record too.',
  },
};

export default function AcksLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [acks, setAcks] = useState<Acks>('1');
  const [crash, setCrash] = useState<'before' | 'after'>('before');
  const phases: Phase[] = crash === 'before' ? ['send', 'write', 'crash', 'elect'] : ['send', 'write', 'copy', 'crash', 'elect'];
  const st = useStepper(phases.length);
  const upto = phases.slice(0, st.step + 1);
  const has = (p: Phase) => upto.includes(p);
  const steps: StepInfo[] = phases.map((p) => ({ name: T.phase[p][0], title: T.phase[p][1], text: T.text(p, acks, crash) }));
  const copied = has('copy');
  const crashed = has('crash');
  const elected = has('elect');
  const ackAt: Phase = acks === '1' ? 'write' : acks === 'all' ? 'copy' : 'send';
  const gotAck = has(ackAt) && !(acks === 'all' && crash === 'before');
  const noAck = acks === 'all' && crash === 'before' && crashed;
  const leaderHas = has('write');
  const lost = elected && crash === 'before' && acks !== 'all';
  const resent = elected && crash === 'before' && acks === 'all';
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.acks}</span>
        <span className="seg" role="group" aria-label={T.acks}>
          {(['0', '1', 'all'] as Acks[]).map((a) => (<button key={a} type="button" aria-pressed={acks === a} onClick={() => { setAcks(a); st.go(0); }}>{a}</button>))}
        </span>
        <span className="ib-lbl">{T.crash}</span>
        <span className="seg" role="group" aria-label={T.crash}>
          {(['before', 'after'] as const).map((c) => (<button key={c} type="button" aria-pressed={crash === c} onClick={() => { setCrash(c); st.go(0); }}>{T.crashes[c]}</button>))}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 330" role="img" aria-label={T.title}>
          <Box x={14} y={100} w={170} h={90} title={T.producer} state="use" />
          <text x={28} y={168} className="ib-s">{acks === '0' ? 'acks=0' : `acks=${acks}`}</text>
          <path className="ib-arrow" d="M184,125 L330,125" style={{ opacity: has('send') ? 1 : 0.25 }} />
          <Box x={330} y={60} w={230} h={190} title={T.leader} state={crashed ? 'skip' : 'use'} dead={crashed} />
          {crashed && <text x={445} y={168} textAnchor="middle" className="ib-big ib-bad" style={{ fontSize: 56 }}>✗</text>}
          {leaderHas && <Cell x={350} y={150} w={64} h={52} offset={0} text="o-1" state={has('write') && !copied && !crashed ? 'new' : 'plain'} />}
          {(['B', 'C'] as const).map((n, i) => {
            const y = 20 + i * 150;
            const holds = copied;
            const leader = elected && n === 'B';
            return (
              <g key={n}>
                <Box x={640} y={y} w={226} h={130} title={`${leader ? T.newLeader : T.follower} ${n}`} state={leader ? 'new' : 'use'} />
                {holds && <Cell x={660} y={y + 62} w={64} h={52} offset={0} text="o-1" state={copied && !crashed ? 'new' : 'plain'} />}
                {leader && resent && <Cell x={660} y={y + 62} w={64} h={52} offset={0} text="o-1" state="new" />}
                <path className="ib-arrow" d={`M560,${i === 0 ? 120 : 190} L640,${i === 0 ? 75 : 225}`} style={{ opacity: copied && !crashed ? 1 : 0.2 }} />
              </g>
            );
          })}
          {gotAck && <text x={190} y={226} className="ib-n" style={{ fill: 'var(--brand)' }}>{`✓ ${T.ack}`}</text>}
          {noAck && <text x={190} y={226} className="ib-n" style={{ fill: 'var(--ib-bad)' }}>{`✗ ${T.noack}`}</text>}
          <text x={440} y={300} textAnchor="middle" className="ib-n" style={{ fill: lost ? 'var(--ib-bad)' : 'var(--brand)' }}>{lost ? `✗ ${T.lost}` : resent ? `↻ ${T.resend}` : elected ? `✓ ${T.safe}` : ''}</text>
        </svg>
      </div>
      <StepControls steps={steps} step={st.step} playing={st.playing} go={st.go} toggle={st.toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
