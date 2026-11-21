import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import { Cell } from './kf';
import { isrFetch, isrInit, isrKill, isrProduce, isrStart, isrUnclean, type IsrState } from './models';

// Shows:      the three copies of one partition (a leader and two followers), what each has written, which of them are in the ISR, and the high watermark that decides what a consumer may read.
// Because:    replication is three logs that are at different lengths at different moments. The lengths, the ISR and the watermark only make sense next to each other.
// Control:    produce (acks=all), "followers fetch", stop or start any broker, min.insync.replicas (1 or 2) and a forced unclean election.
// Conclusion: a record counts as committed (below the high watermark) only when every replica of the ISR has it; with min.insync.replicas=1 a lone leader can acknowledge records that die with it.
//
// Rules are the ones that exercise 06 ran with real brokers: 3 copies of equal size, a stopped broker leaves the ISR and rejoins after it caught up, a write is refused with min.insync.replicas=2 and one broker left,
// and the sequence "stop both followers, write 5 acknowledged records, kill the leader, force an unclean election" lost exactly those 5 records.

const MAX = 12;

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; minIsr: string; produce: string; fetch: string; stop: (n: number) => string; start: (n: number) => string; unclean: string; reset: string;
  leader: string; follower: string; inIsr: string; outIsr: string; dead: string; leo: string; offline: string; hw: string; event: (s: IsrState) => string; caption: string;
}> = {
  th: {
    title: 'ลองเขียน Record, ให้ Follower ดึงข้อมูล, หยุด Broker ทีละตัว แล้วดูว่า High Watermark และ ISR เปลี่ยนอย่างไร ลองทำให้ Record ที่ตอบรับไปแล้วหายไปด้วย',
    legend: [{ kind: 'use', text: 'Record ที่ Commit แล้ว (Consumer อ่านได้)' }, { kind: 'new', text: 'Record ที่เขียนแล้วแต่ยังไม่ครบทุก Replica ใน ISR' }, { kind: 'skip', text: 'Broker ที่หยุดอยู่' }],
    minIsr: 'min.insync.replicas', produce: 'เขียน Record (acks=all)', fetch: 'Follower ดึงข้อมูลจาก Leader', stop: (n) => `หยุด Broker ${n}`, start: (n) => `เริ่ม Broker ${n}`, unclean: 'บังคับเลือก Leader แบบ Unclean', reset: 'เริ่มใหม่',
    leader: 'Leader', follower: 'Follower', inIsr: 'อยู่ใน ISR', outIsr: 'ไม่อยู่ใน ISR', dead: 'หยุดอยู่', leo: 'LEO', offline: 'Partition นี้ไม่มี Leader ทั้งอ่านและเขียนไม่ได้', hw: 'High Watermark',
    event: (s) => ({
      start: 'เริ่มจาก Broker 1 เป็น Leader และทั้งสามตัวอยู่ใน ISR',
      appended: `Leader เขียน Record แล้ว แต่ High Watermark ยังเป็น ${s.hw} จนกว่า Follower ใน ISR จะดึงไป`,
      refused: `เขียนไม่ได้ ใน ISR เหลือน้อยกว่า min.insync.replicas ที่ตั้งไว้ (${s.minIsr}) Producer ได้ NOT_ENOUGH_REPLICAS`,
      offline: 'ไม่มี Leader จึงเขียนหรืออ่านไม่ได้',
      fetched: `Follower ดึงข้อมูลตามทัน High Watermark เป็น ${s.hw}`,
      truncated: `Replica ที่ยาวกว่า Leader ใหม่ ถูกตัด Log ให้เหลือเท่า Leader แล้ว High Watermark เป็น ${s.hw}`,
      killed: s.leader === null ? 'Leader ตัวสุดท้ายใน ISR หยุด Partition ไม่มี Leader เพราะ Replica ที่เหลืออยู่นอก ISR ข้อมูลล่าสุดอยู่ที่ Broker ที่หยุด' : `Broker หยุดและออกจาก ISR ${s.brokers.filter((b) => b.alive).length} ตัวที่เหลือยังทำงานต่อ`,
      started: 'Broker เริ่มใหม่ แต่ยังไม่อยู่ใน ISR จนกว่าจะดึงข้อมูลตามทัน',
      'clean-election': 'Broker ที่เป็น Leader ตัวสุดท้ายกลับมา จึงเป็น Leader ได้ทันทีโดยไม่เสียข้อมูล',
      unclean: s.lost ? `เลือก Leader ที่ข้อมูลไม่ครบ Record ที่ตอบรับไปแล้ว ${s.lost} ตัวหายถาวร` : 'เลือก Leader ใหม่ ไม่มี Record ที่ตอบรับแล้วหายไป',
      nothing: 'ตอนนี้ยังมี Leader อยู่ จึงไม่ต้องบังคับเลือก',
    } as Record<string, string>)[s.event] ?? '',
    caption: 'กติกาในรูปมาจากแบบฝึก 06 ที่รันกับ Broker จริง: สำเนาสามที่ขนาดเท่ากัน, Broker ที่หยุดออกจาก ISR แล้วกลับเข้าหลังตามทัน, การเขียนถูกปฏิเสธเมื่อ min.insync.replicas=2 และเหลือ Broker ตัวเดียว และการหยุด Follower ทั้งสอง เขียน 5 Record ฆ่า Leader แล้วบังคับเลือก Leader แบบ Unclean ทำให้ 5 Record นั้นหายไป',
  },
  en: {
    title: 'Write records, let the followers fetch, stop brokers one at a time and watch the high watermark and the ISR. Try to make an acknowledged record disappear',
    legend: [{ kind: 'use', text: 'committed record (consumers can read it)' }, { kind: 'new', text: 'written, but not yet on every replica of the ISR' }, { kind: 'skip', text: 'broker that is stopped' }],
    minIsr: 'min.insync.replicas', produce: 'write a record (acks=all)', fetch: 'followers fetch from the leader', stop: (n) => `stop broker ${n}`, start: (n) => `start broker ${n}`, unclean: 'force an unclean election', reset: 'start over',
    leader: 'leader', follower: 'follower', inIsr: 'in the ISR', outIsr: 'not in the ISR', dead: 'stopped', leo: 'LEO', offline: 'This partition has no leader: it cannot be read or written', hw: 'high watermark',
    event: (s) => ({
      start: 'We start with broker 1 as the leader and all three in the ISR.',
      appended: `The leader wrote the record, but the high watermark stays at ${s.hw} until the followers of the ISR fetch it.`,
      refused: `The write is refused: the ISR is smaller than min.insync.replicas (${s.minIsr}). The producer gets NOT_ENOUGH_REPLICAS.`,
      offline: 'There is no leader, so nothing can be read or written.',
      fetched: `The followers caught up. The high watermark is ${s.hw}.`,
      truncated: `A replica that was longer than the new leader was cut back to the leader's length. The high watermark is ${s.hw}.`,
      killed: s.leader === null ? 'The last leader of the ISR stopped. The partition has no leader because the replicas that are left are outside the ISR, and the newest data is on the stopped broker.' : `A broker stopped and left the ISR. The ${s.brokers.filter((b) => b.alive).length} that are left carry on.`,
      started: 'The broker is running again but is not in the ISR until it has caught up.',
      'clean-election': 'The broker that was the last leader is back, so it can lead again at once without losing data.',
      unclean: s.lost ? `A leader without the full data was chosen. ${s.lost} records that had been acknowledged are gone for good.` : 'A new leader was chosen. No acknowledged record was lost.',
      nothing: 'There is a leader already, so there is nothing to force.',
    } as Record<string, string>)[s.event] ?? '',
    caption: 'The rules in the picture come from exercise 06 on real brokers: three copies of the same size, a stopped broker leaves the ISR and rejoins after catching up, a write is refused with min.insync.replicas=2 and one broker left, and stopping both followers, writing 5 records, killing the leader and forcing an unclean election lost those 5 records.',
  },
};

export default function IsrLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [s, setS] = useState<IsrState>(() => isrInit(1));
  const total = Math.max(...s.brokers.map((b) => b.leo));
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.minIsr}</span>
        <span className="seg" role="group" aria-label={T.minIsr}>
          {[1, 2].map((m) => (<button key={m} type="button" aria-pressed={s.minIsr === m} onClick={() => setS({ ...s, minIsr: m })}>{m}</button>))}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 330" role="img" aria-label={T.title}>
          {s.brokers.map((b, i) => {
            const x = 14 + i * 290;
            const isLeader = s.leader === b.id;
            return (
              <g key={b.id} style={!b.alive ? { opacity: 0.5 } : undefined}>
                <rect className={!b.alive ? 'ib-skip' : isLeader ? 'ib-new' : 'ib-use'} x={x} y={16} width={270} height={226} rx={12} />
                <text x={x + 14} y={44} className="ib-n">{`Broker ${b.id}`}</text>
                <text x={x + 14} y={66} className="ib-s">{!b.alive ? T.dead : isLeader ? T.leader : T.follower}</text>
                <text x={x + 256} y={44} textAnchor="end" className="ib-s" style={{ fill: b.inIsr ? 'var(--brand)' : 'var(--muted)', fontWeight: 700 }}>{b.alive ? (b.inIsr ? `✓ ${T.inIsr}` : `✗ ${T.outIsr}`) : ''}</text>
                {Array.from({ length: MAX }, (_, j) => {
                  const cx = x + 14 + (j % 6) * 40;
                  const cy = 88 + Math.floor(j / 6) * 52;
                  return j < b.leo ? (
                    <Cell key={j} x={cx} y={cy} w={34} h={34} text={String(j)} state={j < s.hw ? 'use' : 'new'} />
                  ) : (
                    <rect key={j} className="ib-skip" x={cx} y={cy} width={34} height={34} rx={6} style={{ opacity: 0.4 }} />
                  );
                })}
                <text x={x + 14} y={222} className="ib-m" style={{ fontSize: 15, fill: 'var(--fg)' }}>{`${T.leo} ${b.leo}`}</text>
                {!b.alive && <text x={x + 220} y={150} className="ib-bad" style={{ fontSize: 60 }}>✗</text>}
              </g>
            );
          })}
          <rect className="ib-banner" x={14} y={256} width={852} height={56} rx={10} />
          <text x={28} y={280} className="ib-n">{`${T.hw} = ${s.hw}`}</text>
          <text x={28} y={302} className="ib-s">{s.leader === null ? T.offline : `ISR ${s.brokers.filter((b) => b.alive && b.inIsr).length} / min.insync.replicas ${s.minIsr}  ·  ${total} / ${MAX}`}</text>
        </svg>
      </div>
      <div className="lab-controls">
        <button type="button" className="btn sm" disabled={total >= MAX} onClick={() => setS(isrProduce(s))}>{T.produce}</button>
        <button type="button" className="btn sm" onClick={() => setS(isrFetch(s))}>{T.fetch}</button>
        {s.brokers.map((b) => (
          <button key={b.id} type="button" className="btn sm" onClick={() => setS(b.alive ? isrKill(s, b.id) : isrStart(s, b.id))}>{b.alive ? T.stop(b.id) : T.start(b.id)}</button>
        ))}
        <button type="button" className="btn sm" disabled={s.leader !== null} onClick={() => setS(isrUnclean(s))}>{T.unclean}</button>
        <button type="button" className="btn sm" onClick={() => setS(isrInit(s.minIsr))}>{T.reset}</button>
      </div>
      <div className="readout" aria-live="polite"><div>{T.event(s)}</div></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
