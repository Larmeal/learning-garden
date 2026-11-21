import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import { Box } from './kf';

// Shows:      a client that dials a broker at a bootstrap address, the broker answering "I am at this address", and the client dialling that address, for three values of advertised.listeners and two places where the client may run.
// Because:    connection failures to Kafka come from the second dial, not the first, and the picture of three arrows (ask, answer, dial) is the only way to see where it breaks.
// Control:    where the client runs (inside the Docker network or on this computer) and what the broker advertises.
// Conclusion: the client uses the address that the broker tells it, not the address it was started with, so that address has to be reachable from where the client is.
//
// Ran in exercise 11 or 01: from this computer with the right address (works), from this computer with broker.invalid (the bootstrap answer arrives, the dial fails with "Failed to resolve"),
// from inside the Docker network with klab-k1:9092 (works). The other three cells follow from the same rule and were not run.

type Where = 'host' | 'docker';
type Adv = 'ok' | 'bad' | 'internal';

const CELLS: Record<Where, Record<Adv, { works: boolean; ran: boolean }>> = {
  host: { ok: { works: true, ran: true }, bad: { works: false, ran: true }, internal: { works: false, ran: false } },
  docker: { ok: { works: false, ran: false }, bad: { works: false, ran: false }, internal: { works: true, ran: true } },
};
const ADDR: Record<Adv, string> = { ok: '127.0.0.1:29092', bad: 'broker.invalid:29092', internal: 'klab-k1:9092' };
const BOOT: Record<Where, string> = { host: '127.0.0.1:29092', docker: 'klab-k1:9092' };

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; where: string; wheres: Record<Where, string>; adv: string; advs: Record<Adv, string>;
  client: string; broker: string; ask: string; answer: string; dial: string; ran: string; notRan: string; why: (w: Where, a: Adv, ok: boolean) => string; caption: string;
}> = {
  th: {
    title: 'เลือกว่า Client รันอยู่ที่ไหน และ Broker ประกาศที่อยู่ของตัวเองว่าอะไร ดูว่าลูกศรสุดท้าย (Client ต่อไปหา Broker) ไปถึงหรือไม่',
    legend: [{ kind: 'use', text: 'ขั้นที่สำเร็จ' }, { kind: 'skip', text: 'ขั้นที่ล้มเหลว' }],
    where: 'Client รันที่', wheres: { host: 'คอมพิวเตอร์ของเราเอง', docker: 'ในเครือข่าย Docker เดียวกับ Broker' },
    adv: 'advertised.listeners', advs: { ok: '127.0.0.1:29092', bad: 'broker.invalid:29092', internal: 'klab-k1:9092' },
    client: 'Client', broker: 'Broker', ask: '1 ถาม', answer: '2 ตอบว่า "ฉันอยู่ที่"', dial: '3 ต่อไปที่', ran: 'รันจริง', notRan: 'ไม่ได้รัน (อนุมานจากกติกาเดียวกัน)',
    why: (w, a, ok) => ok ? 'ที่อยู่ที่ Broker ประกาศ ตรงกับที่ Client เข้าถึงได้จากที่ที่มันรันอยู่ จึงต่อสำเร็จ' : a === 'bad' ? 'ชื่อที่ประกาศหาไม่เจอเลย (Failed to resolve) แต่การถามครั้งแรกสำเร็จ เพราะ Client ต่อด้วยที่อยู่ Bootstrap ที่เรากรอกเอง' : w === 'host' ? 'ชื่อ klab-k1 มีอยู่แค่ในเครือข่าย Docker คอมพิวเตอร์ของเราไม่รู้จัก' : 'ที่อยู่ 127.0.0.1 ในคอนเทนเนอร์ของ Client หมายถึงตัว Client เอง ไม่ใช่ Broker',
    caption: 'แบบฝึก 11 รันกรณีที่ Broker ประกาศ broker.invalid:29092 แล้ว Producer ได้ Failed to resolve และเวลาหมด ส่วนกรณีที่ถูกต้องรันตลอดทั้งชุดแบบฝึก อีกสามช่องในตารางไม่ได้รัน',
  },
  en: {
    title: 'Choose where the client runs and what the broker advertises, and see whether the last arrow (the client dialling the broker) arrives',
    legend: [{ kind: 'use', text: 'step that worked' }, { kind: 'skip', text: 'step that failed' }],
    where: 'client runs on', wheres: { host: 'this computer', docker: 'the same Docker network as the broker' },
    adv: 'advertised.listeners', advs: { ok: '127.0.0.1:29092', bad: 'broker.invalid:29092', internal: 'klab-k1:9092' },
    client: 'client', broker: 'broker', ask: '1 asks', answer: '2 answers "I am at"', dial: '3 dials', ran: 'ran for real', notRan: 'not run (follows from the same rule)',
    why: (w, a, ok) => ok ? 'The address that the broker advertises is one that the client can reach from where it runs, so the connection works.' : a === 'bad' ? 'The advertised name cannot be found at all (Failed to resolve), yet the first question worked because the client dialled the bootstrap address that we typed ourselves.' : w === 'host' ? 'The name klab-k1 exists only inside the Docker network. This computer does not know it.' : '127.0.0.1 inside the client\'s container means the client itself, not the broker.',
    caption: 'Exercise 11 ran the case where the broker advertises broker.invalid:29092: the producer got Failed to resolve and timed out. The correct cases ran throughout the exercises. The other three cells of the table were not run.',
  },
};

export default function ListenerLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [w, setW] = useState<Where>('host');
  const [a, setA] = useState<Adv>('ok');
  const cell = CELLS[w][a];
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.where}</span>
        <span className="seg" role="group" aria-label={T.where}>
          {(['host', 'docker'] as Where[]).map((x) => (<button key={x} type="button" aria-pressed={w === x} onClick={() => setW(x)}>{T.wheres[x]}</button>))}
        </span>
        <span className="ib-lbl">{T.adv}</span>
        <span className="seg" role="group" aria-label={T.adv}>
          {(['ok', 'bad', 'internal'] as Adv[]).map((x) => (<button key={x} type="button" aria-pressed={a === x} onClick={() => setA(x)}>{T.advs[x]}</button>))}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 300" role="img" aria-label={T.title}>
          <Box x={14} y={80} w={210} h={110} title={T.client} state="use" sub={T.wheres[w]} />
          <Box x={640} y={80} w={226} h={110} title={T.broker} state="use" sub={`advertised: ${ADDR[a]}`} />
          <path className="ib-arrow" d="M224,100 L640,100" />
          <text x={432} y={90} textAnchor="middle" className="ib-n">{`${T.ask} ${BOOT[w]}`}</text>
          <path className="ib-arrow" d="M640,140 L224,140" style={{ stroke: 'var(--k3)' }} />
          <text x={432} y={130} textAnchor="middle" className="ib-n">{`${T.answer} ${ADDR[a]}`}</text>
          <path className={cell.works ? 'ib-arrow' : 'ib-line'} d={cell.works ? 'M224,180 L640,180' : 'M224,180 L400,180'} style={cell.works ? { stroke: 'var(--brand)' } : { stroke: 'var(--ib-bad)', strokeWidth: 4, strokeDasharray: '8 6' }} />
          {!cell.works && <text x={440} y={190} className="ib-bad" style={{ fontSize: 36 }}>✗</text>}
          <text x={432} y={212} textAnchor="middle" className="ib-n" style={{ fill: cell.works ? 'var(--brand)' : 'var(--ib-bad)' }}>{`${T.dial} ${ADDR[a]} ${cell.works ? '✓' : '✗'}`}</text>
          <text x={14} y={250} className="ib-s">{cell.ran ? `● ${T.ran}` : `○ ${T.notRan}`}</text>
        </svg>
      </div>
      <div className="readout" aria-live="polite"><div>{T.why(w, a, cell.works)}</div></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
