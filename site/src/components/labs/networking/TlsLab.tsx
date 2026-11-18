import { useState } from 'react';
import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Legend, Lifelines, Msg, ease } from './nw';
import data from './tls.json';

// Shows:      the first round trips of a connection with TLS 1.3 or TLS 1.2, as arrows between client and server, one row per flight of messages. For each arrow the picture says what a person who only
//             watches the wire can read (plain text) and what is hidden (encrypted), and a counter shows how many round trips have passed when the first byte of the response arrives (3 or 4).
// Because:    "TLS 1.3 saves a round trip, and hides the certificate" are statements about ORDER and about WHICH message is encrypted. The same list of messages for 1.2 and 1.3 side by side in one picture
//             shows both at once.
// Control:    the switch TLS 1.3 / TLS 1.2 (each one changes the arrows, the counter and what is visible), plus play, the scrub bar and the jump buttons (the clock).
// Conclusion: the key is agreed in the first two messages in 1.3 (one round trip), so everything after the ServerHello, including the certificate, is encrypted; in 1.2 the certificate travels in plain
//             and another round trip is spent before the data.
//
// The sizes of the records, the times to the first byte (64 ms and 84 ms, round trip 20 ms), the visible server name and the visible certificate in 1.2 are real: exercises/11_tls.py (tls.json).

type V = 'tls13' | 'tls12';
const D = 24;
const XS = { c: 150, s: 730 };
const S13 = (data.records13.s2c as { length: number }[]).map((r) => r.length);
const C13 = (data.records13.c2s as { length: number }[]).map((r) => r.length);
const S12 = (data.records12 as { length: number; handshake?: string }[]).map((r) => r.length);
const ch = data.records13.c2s[0].length;
const tm = data.times as Record<string, (number | null)[]>;
const T13 = Math.round(tm.tls13[2] as number), T12 = Math.round(tm.tls12[2] as number), TNG = Math.round(tm.nagle[2] as number), TP = Math.round(tm.plain[2] as number);
const RT = (ms: number) => (ms / data.rtt).toFixed(1);

interface Row { from: 'c' | 's'; label: string; sees: string; plain: boolean; rtt?: number; at: number }

type T = { title: string; caption: string; ver: Record<V, string>; client: string; server: string; sees: string; hidden: string; visible: string; rttN: string; ms: string; marks: Record<V, Mark[]>; rows: (v: V) => Row[]; first: string };
const TEXT: Record<Lang, T> = {
  th: {
    title: 'เลือก TLS 1.3 หรือ TLS 1.2 แล้วกดเล่น ดูว่ากว่าจะได้ Byte แรกของ Response ผ่านไปกี่รอบเวลา และคนที่แอบดูบนสายเห็นอะไร',
    caption: `ขนาดของ Record, เวลา ${T13} และ ${T12} มิลลิวินาทีถึง Byte แรกของ Response (RTT 20 มิลลิวินาที) และสิ่งที่เห็นได้บนสายมาจากการจับ Packet จริงในแบบฝึก 11 การที่ข้อความใน TLS 1.3 หลัง ServerHello มองเข้าไปไม่ได้ เราเดาความหมายจากลำดับและขนาด ไม่ได้ถอดรหัส`,
    ver: { tls13: 'TLS 1.3', tls12: 'TLS 1.2' }, client: 'Client', server: 'Server', sees: 'คนแอบดูเห็น', hidden: 'เข้ารหัส เห็นแค่ขนาด', visible: 'อ่านได้', rttN: 'รอบเวลาที่ผ่านไป', ms: 'มิลลิวินาที', first: 'Byte แรกของ Response ถึงแล้ว',
    rows: (v) => v === 'tls13' ? [
      { from: 'c', label: 'SYN', sees: 'เห็นว่ากำลังต่อ Port 8443', plain: true, at: 1 },
      { from: 's', label: 'SYN,ACK', sees: '', plain: true, at: 2.6, rtt: 1 },
      { from: 'c', label: `ClientHello (${ch} B)`, sees: 'อ่านได้: server name garden.test, เวอร์ชันที่รองรับ, Key Share x25519', plain: true, at: 4.2 },
      { from: 's', label: `ServerHello (${S13[0]} B) + ข้อความเข้ารหัส (${S13.slice(2, 6).join(', ')} B)`, sees: 'ServerHello อ่านได้ ที่เหลือเข้ารหัส รวมทั้ง Certificate', plain: false, at: 6.4, rtt: 2 },
      { from: 'c', label: `Finished (เข้ารหัส) + Request (เข้ารหัส)`, sees: `${C13.slice(2).join(', ')} B ของข้อมูลเข้ารหัส ไม่เห็นเนื้อหา`, plain: false, at: 8.6 },
      { from: 's', label: `Response (เข้ารหัส ${S13[S13.length - 1]} B)`, sees: 'ไม่เห็นเนื้อหา', plain: false, at: 10.8, rtt: 3 },
    ] : [
      { from: 'c', label: 'SYN', sees: 'เห็นว่ากำลังต่อ Port 8447', plain: true, at: 1 },
      { from: 's', label: 'SYN,ACK', sees: '', plain: true, at: 2.4, rtt: 1 },
      { from: 'c', label: 'ClientHello', sees: 'อ่านได้ทั้งหมด รวมทั้ง server name', plain: true, at: 3.8 },
      { from: 's', label: `ServerHello + Certificate (${S12[1]} B) + KeyExchange`, sees: 'อ่านได้ทั้งหมด รวมทั้ง Certificate ที่บอกว่าใครคือ Server', plain: true, at: 5.5, rtt: 2 },
      { from: 'c', label: 'ClientKeyExchange + Finished', sees: 'ฝั่ง Client ส่งส่วนของตัวเอง แล้วเริ่มเข้ารหัส', plain: true, at: 7.1 },
      { from: 's', label: 'Finished (เข้ารหัส)', sees: 'เข้ารหัส', plain: false, at: 8.7, rtt: 3 },
      { from: 'c', label: 'Request (เข้ารหัส)', sees: 'ไม่เห็นเนื้อหา', plain: false, at: 10.3 },
      { from: 's', label: 'Response (เข้ารหัส)', sees: 'ไม่เห็นเนื้อหา', plain: false, at: 11.9, rtt: 4 },
    ],
    marks: {
      tls13: [
        { at: 1, name: 'TCP', title: 'TCP จับมือก่อน: หนึ่งรอบเวลา', text: 'TLS วิ่งบน TCP จึงต้องรอ Handshake ของ TCP ให้เสร็จก่อน (บท 7) นี่คือรอบเวลาที่หนึ่ง และเป็นรอบเดียวกับที่ HTTP ธรรมดาก็ต้องจ่าย' },
        { at: 4.2, name: 'ClientHello', title: 'ClientHello ส่งส่วนของ Key Exchange มาด้วยเลย', text: 'Client บอกชื่อที่อยากคุยด้วย (SNI) เวอร์ชันที่รองรับ และส่ง Key Share แบบ x25519 ไปพร้อมกัน เพราะเดาล่วงหน้าว่า Server จะเลือกกลุ่มนี้ ทำให้ตกลงกุญแจได้ภายในรอบเวลาเดียว ข้อความนี้ยังอ่านได้ทั้งหมดบนสาย' },
        { at: 6.4, name: 'ServerHello', title: 'ServerHello แล้วทุกอย่างเข้ารหัส', text: `Server ตอบด้วย Key Share ของตัวเอง ตั้งแต่ตรงนี้ทั้งสองฝั่งคำนวณกุญแจเดียวกันได้ ข้อความที่ตามมา คือ Certificate, CertificateVerify และ Finished ถูกเข้ารหัสทั้งหมด คนแอบดูเห็นแค่ Record ที่ขนาด ${S13[3]} ไบต์ ซึ่งไม่ได้บอกอะไร ในแบบฝึกชื่อ garden ไม่ปรากฏบนสายขาลงเลย` },
        { at: 8.6, name: 'ส่งข้อมูล', title: 'Client ตรวจ Certificate แล้วส่ง Request ต่อทันที', text: `Client ถอดรหัส ตรวจว่า Certificate ถูกต้อง แล้วส่ง Finished ตามด้วย Request ในจังหวะเดียวกัน ไม่ต้องรออะไรเพิ่ม (ถ้าลืมตั้ง TCP_NODELAY จะถูก Nagle กั๊กไว้อีกหนึ่งรอบเวลา เป็น ${TNG} มิลลิวินาที ตามที่แบบฝึกวัดได้)` },
        { at: 10.8, name: 'ถึงแล้ว', title: 'Byte แรกของ Response: 3 รอบเวลา', text: `ทั้งหมด ${T13} มิลลิวินาที หรือ ${RT(T13)} รอบเวลาของสาย เทียบกับ HTTP ธรรมดา ${RT(TP)} รอบ TLS 1.3 จึงมีราคาเพิ่มหนึ่งรอบเวลา` },
      ],
      tls12: [
        { at: 1, name: 'TCP', title: 'TCP จับมือก่อน: หนึ่งรอบเวลา', text: 'เหมือน TLS 1.3 คือรอบเวลาที่หนึ่งเป็นของ TCP' },
        { at: 3.8, name: 'ClientHello', title: 'ClientHello ยังไม่มี Key Share', text: 'ใน TLS 1.2 Client ยังไม่ส่งส่วนของ Key Exchange มา เพราะยังไม่รู้ว่า Server จะเลือกวิธีไหน ต้องรอ ServerHello ก่อน' },
        { at: 5.5, name: 'Certificate', title: 'Server ส่ง Certificate เป็นข้อความธรรมดา', text: `ServerHello, Certificate (${S12[1]} ไบต์) และ ServerKeyExchange มาในจังหวะเดียวกัน และอ่านได้ทั้งหมดบนสาย ใครแอบดูก็รู้ว่าเรากำลังคุยกับ Server ตัวไหน และเห็นรายละเอียดของ Certificate` },
        { at: 7.1, name: 'Key Exchange', title: 'Client ตอบส่วนของ Key Exchange แล้วเริ่มเข้ารหัส', text: 'Client ส่ง ClientKeyExchange และ Finished ซึ่งเป็นข้อความแรกที่เข้ารหัส Server ตอบ Finished กลับ นี่คือรอบเวลาเพิ่มที่ TLS 1.2 ต้องใช้ก่อนเริ่มส่งข้อมูลได้' },
        { at: 11.9, name: 'ถึงแล้ว', title: 'Byte แรกของ Response: 4 รอบเวลา', text: `ทั้งหมด ${T12} มิลลิวินาที หรือ ${RT(T12)} รอบเวลาของสาย TLS 1.2 เพิ่มสองรอบเวลาจาก HTTP ธรรมดา ส่วน TLS 1.3 เพิ่มแค่หนึ่ง` },
      ],
    },
  },
  en: {
    title: 'Pick TLS 1.3 or TLS 1.2 and press play, and see how many round trips pass before the first byte of the response, and what someone watching the wire can read',
    caption: `The sizes of the records, the times of ${T13} and ${T12} milliseconds to the first byte of the response (round trip 20 milliseconds) and what is visible on the wire come from the real capture of exercise 11. The messages of TLS 1.3 after the ServerHello cannot be looked into, so we guess their meaning from the order and the size and do not decrypt them.`,
    ver: { tls13: 'TLS 1.3', tls12: 'TLS 1.2' }, client: 'Client', server: 'Server', sees: 'what a watcher sees', hidden: 'encrypted, only the size is seen', visible: 'readable', rttN: 'round trips so far', ms: 'ms', first: 'the first byte of the response has arrived',
    rows: (v) => v === 'tls13' ? [
      { from: 'c', label: 'SYN', sees: 'sees that a connection to port 8443 starts', plain: true, at: 1 },
      { from: 's', label: 'SYN,ACK', sees: '', plain: true, at: 2.6, rtt: 1 },
      { from: 'c', label: `ClientHello (${ch} B)`, sees: 'readable: server name garden.test, the versions supported, the x25519 key share', plain: true, at: 4.2 },
      { from: 's', label: `ServerHello (${S13[0]} B) + encrypted messages (${S13.slice(2, 6).join(', ')} B)`, sees: 'the ServerHello is readable, the rest is encrypted, the certificate included', plain: false, at: 6.4, rtt: 2 },
      { from: 'c', label: 'Finished (encrypted) + request (encrypted)', sees: `${C13.slice(2).join(', ')} B of encrypted data, no content`, plain: false, at: 8.6 },
      { from: 's', label: `Response (encrypted, ${S13[S13.length - 1]} B)`, sees: 'no content', plain: false, at: 10.8, rtt: 3 },
    ] : [
      { from: 'c', label: 'SYN', sees: 'sees that a connection to port 8447 starts', plain: true, at: 1 },
      { from: 's', label: 'SYN,ACK', sees: '', plain: true, at: 2.4, rtt: 1 },
      { from: 'c', label: 'ClientHello', sees: 'all readable, the server name included', plain: true, at: 3.8 },
      { from: 's', label: `ServerHello + Certificate (${S12[1]} B) + KeyExchange`, sees: 'all readable, including the certificate that says who the server is', plain: true, at: 5.5, rtt: 2 },
      { from: 'c', label: 'ClientKeyExchange + Finished', sees: 'the client sends its own part and starts encrypting', plain: true, at: 7.1 },
      { from: 's', label: 'Finished (encrypted)', sees: 'encrypted', plain: false, at: 8.7, rtt: 3 },
      { from: 'c', label: 'Request (encrypted)', sees: 'no content', plain: false, at: 10.3 },
      { from: 's', label: 'Response (encrypted)', sees: 'no content', plain: false, at: 11.9, rtt: 4 },
    ],
    marks: {
      tls13: [
        { at: 1, name: 'TCP', title: 'TCP shakes hands first: one round trip', text: 'TLS runs on TCP, so it has to wait for the TCP handshake to finish (lesson 7). That is round trip number one, and plain HTTP pays it as well.' },
        { at: 4.2, name: 'ClientHello', title: 'The ClientHello carries a key exchange share at once', text: 'The client says which name it wants (SNI) and which versions it supports, and sends an x25519 key share at the same time, guessing that the server will pick that group. That lets the key be agreed in a single round trip. This message is still fully readable on the wire.' },
        { at: 6.4, name: 'ServerHello', title: 'ServerHello, and then everything is encrypted', text: `The server answers with its own key share. From here both sides can compute the same key. The messages that follow, the certificate, the certificate verify and the finished, are all encrypted. A watcher sees only a record of ${S13[3]} bytes, which says nothing. In the exercise the name garden never appeared on the downstream wire.` },
        { at: 8.6, name: 'Data', title: 'The client checks the certificate and sends the request at once', text: `The client decrypts, checks that the certificate is right, and sends Finished followed by the request in the same moment, with nothing more to wait for (if TCP_NODELAY is forgotten, Nagle holds it for one more round trip, giving ${TNG} milliseconds, as the exercise measured).` },
        { at: 10.8, name: 'Arrived', title: 'The first byte of the response: 3 round trips', text: `In all ${T13} milliseconds, or ${RT(T13)} round trips of the cable, against ${RT(TP)} for plain HTTP. So TLS 1.3 costs one extra round trip.` },
      ],
      tls12: [
        { at: 1, name: 'TCP', title: 'TCP shakes hands first: one round trip', text: 'As with TLS 1.3, round trip number one belongs to TCP.' },
        { at: 3.8, name: 'ClientHello', title: 'The ClientHello has no key share yet', text: 'In TLS 1.2 the client does not send its part of the key exchange yet, because it does not know which method the server will choose. It has to wait for the ServerHello.' },
        { at: 5.5, name: 'Certificate', title: 'The server sends its certificate as plain messages', text: `The ServerHello, the certificate (${S12[1]} bytes) and the ServerKeyExchange come in the same moment and all of them are readable on the wire. Anyone watching can tell which server we are talking to and see the details of the certificate.` },
        { at: 7.1, name: 'Key exchange', title: 'The client answers with its key exchange part and starts to encrypt', text: 'The client sends ClientKeyExchange and Finished, the first messages that are encrypted. The server answers with its Finished. This is the extra round trip that TLS 1.2 needs before data can be sent.' },
        { at: 11.9, name: 'Arrived', title: 'The first byte of the response: 4 round trips', text: `In all ${T12} milliseconds, or ${RT(T12)} round trips of the cable. TLS 1.2 adds two round trips to plain HTTP, and TLS 1.3 adds only one.` },
      ],
    },
  },
};

export default function TlsLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [v, setV] = useState<V>('tls13');
  const clock = useClock(D);
  const { t } = clock;
  const marks = T.marks[v];
  let current = 0;
  marks.forEach((m, i) => { if (t >= m.at - 0.001) current = i; });
  const rows = T.rows(v);
  const pick = (x: V) => { setV(x); clock.restart(); };
  const pitch = v === 'tls13' ? 62 : 58;
  const y0 = 96;
  const rtt = rows.reduce((n, r) => (r.rtt && t >= r.at + 1.4 ? r.rtt : n), 0);
  const times = data.times as Record<string, (number | null)[]>;
  const done = t >= rows[rows.length - 1].at + 1.4;

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <div className="ib-controls">
        <div className="seg" role="group" aria-label="version">
          {(['tls13', 'tls12'] as V[]).map((x) => (
            <button key={x} type="button" aria-pressed={v === x} onClick={() => pick(x)}>{T.ver[x]}</button>
          ))}
        </div>
      </div>
      <Legend layers={[]} lang={lang} extra={[{ cls: 'chg', text: T.visible }, { cls: 'bad', text: T.hidden }]} />
      <div className="viz-box">
        <svg viewBox={`0 0 880 ${y0 + rows.length * pitch + 144}`} role="img" aria-label={T.title}>
          <Lifelines xs={[XS.c, XS.s]} y1={62} y2={y0 + rows.length * pitch + 6} names={[T.client, T.server]} />
          {rows.map((r, i) => {
            const y = y0 + i * pitch;
            const toServer = r.from === 'c';
            const p = ease(t, r.at, r.at + 1.4);
            return (
              <g key={i}>
                <Msg x1={toServer ? XS.c : XS.s} y1={y} x2={toServer ? XS.s : XS.c} y2={y + 14} p={p} kind={r.plain ? 'data' : 'retx'} n={i + 1} label={r.label} labelDy={-7} />
                {p > 0.95 && r.sees && <text x={440} y={y + 32} textAnchor="middle" className="ib-s" style={{ fill: r.plain ? 'var(--fg)' : 'var(--ib-bad)', fontWeight: 600 }}>{T.sees}: {r.sees}</text>}
              </g>
            );
          })}
          <g>
            <rect className="nw-cell" x={20} y={y0 + rows.length * pitch + 14} width={250} height={58} rx={10} />
            <text x={32} y={y0 + rows.length * pitch + 34} className="ib-s">{T.rttN}</text>
            <text x={32} y={y0 + rows.length * pitch + 62} className="ib-n" style={{ fontSize: 20 }}>{rtt} {done ? `· ${times[v][2]} ${T.ms}` : ''}</text>
          </g>
          {done && <text x={290} y={y0 + rows.length * pitch + 50} className="ib-n" style={{ fill: 'var(--k2)' }}>✓ {T.first}</text>}
          <Banner y={y0 + rows.length * pitch + 84} text={marks[current].title} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
