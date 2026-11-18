import { useState } from 'react';
import { ClockControls, useClock, prog, smooth, mix, type Lang, type Mark } from '../spark/timeline';
import { Legend, Lines } from '../iceberg/ib';

// Shows:      a TLS 1.3 handshake as four numbered messages between a browser and a server, the three checks the browser makes on the certificate
//             after message 2, and what happens when one check fails. Pick a scenario and replay it.
// Because:    "TLS is a handshake" is only words until you see that the browser decides after the server's first answer, and that the data
//             is encrypted only after the keys exist on both sides.
// Control:    the scenario (a good server, a CA the browser does not trust, another host name, an expired certificate); the clock plays it.
// Conclusion: the browser checks who signed, the name and the dates before it sends anything of its own, and a failed check ends the connection there.
//
// The sizes of the four flights (1524, 1818, 80, 510 bytes) and the three error messages are what exercises/03_tls.py printed with the OpenSSL
// of this Python (3.5.9). The sizes depend on the certificate and the OpenSSL version: they are an example, not a constant.

type Scn = 'good' | 'ca' | 'name' | 'date';
const SCN: Scn[] = ['good', 'ca', 'name', 'date'];
const FAILS: Record<Scn, number> = { good: -1, ca: 0, name: 1, date: 2 };
const ERR: Record<Scn, string> = {
  good: '',
  ca: 'CERTIFICATE_VERIFY_FAILED: unable to get local issuer certificate',
  name: 'CERTIFICATE_VERIFY_FAILED: Hostname mismatch',
  date: 'CERTIFICATE_VERIFY_FAILED: certificate has expired',
};
const SIZES = [1524, 1818, 80, 510];

const TEXT: Record<Lang, {
  title: string; pick: string; scn: Record<Scn, string>; client: string; server: string; msgs: string[]; checks: string[]; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[];
  bytes: string; stop: string; keys: string; data: string; caption: string; marks: (s: Scn) => Mark[];
}> = {
  th: {
    title: 'เลือกสถานการณ์ แล้วกดเล่น ดู Handshake ของ TLS ทีละข้อความ และดูว่า Browser ตรวจใบรับรองตรงไหน',
    pick: 'สถานการณ์',
    scn: { good: 'Server ปกติ', ca: 'CA ที่ไม่รู้จัก', name: 'ชื่อ Host ไม่ตรง', date: 'ใบรับรองหมดอายุ' },
    client: 'Browser', server: 'Server',
    msgs: ['ClientHello: ฉันรองรับ TLS 1.3 และนี่คือ Key Share ของฉัน', 'ServerHello, Certificate, Finished: Key Share ของฉัน ใบรับรอง และหลักฐานว่ามี Private Key', 'Finished: ฉันตรวจครบแล้ว และคำนวณ Key ได้เหมือนกัน', 'ตั๋ว Session สำหรับเชื่อมต่อครั้งหน้า'],
    checks: ['ออกโดย CA ที่เรารู้จัก', 'ชื่อ Host ตรงกับที่เราขอ', 'ยังไม่หมดอายุ'],
    legend: [{ kind: 'new', text: 'ผ่านการตรวจ' }, { kind: 'use', text: 'ข้อความที่วิ่งอยู่' }, { kind: 'node', text: 'ยังไม่เกิดขึ้น' }],
    bytes: 'ไบต์', stop: 'Browser ตัดการเชื่อมต่อ ไม่ส่งข้อความที่สามและไม่ส่งข้อมูลของผู้ใช้เลย', keys: 'ทั้งสองฝั่งได้ Key ลับตัวเดียวกัน โดยไม่เคยส่ง Key นั้นผ่านสาย', data: 'ข้อมูลจริง (GET /orders) เข้ารหัสด้วย Key นี้',
    caption: 'ขนาดสี่ข้อความและข้อความ Error มาจากแบบฝึก 03 กับ OpenSSL 3.5.9 ของ Python ที่ใช้ ขนาดจะเปลี่ยนตามใบรับรองและเวอร์ชัน จึงเป็นตัวอย่าง ไม่ใช่ค่าคงที่ ส่วนลำดับข้อความตาม TLS 1.3 ของ RFC 8446 ซึ่งเราไม่ได้อ่านจากตัวสเปกในบทนี้',
    marks: (s) => [
      { at: 0, name: 'เริ่ม', title: 'Browser ทักก่อน (ข้อความที่ 1)', text: 'ClientHello บอกเวอร์ชันและ Cipher ที่รองรับ พร้อมค่าครึ่งหนึ่งของ Key ที่จะคำนวณร่วมกัน' },
      { at: 2.6, name: 'Server ตอบ', title: 'Server ส่งใบรับรองกลับมา (ข้อความที่ 2)', text: 'ข้อความนี้ใหญ่ที่สุดเพราะมีใบรับรองอยู่ด้วย ใบรับรองคือหลักฐานที่ CA เซ็นรับรองว่ากุญแจสาธารณะนี้เป็นของชื่อนี้' },
      { at: 4.4, name: 'ตรวจ', title: s === 'good' ? 'Browser ตรวจสามข้อ และผ่านทั้งหมด' : 'Browser ตรวจสามข้อ และมีข้อหนึ่งไม่ผ่าน', text: s === 'good' ? 'ออกโดย CA ที่เชื่อ ชื่อตรง และยังไม่หมดอายุ จึงเดินต่อ' : 'Browser หยุดทันทีที่ตรวจไม่ผ่าน ไม่มีข้อมูลของผู้ใช้ถูกส่งไป' },
      { at: 7, name: 'เสร็จ', title: s === 'good' ? 'ข้อความที่ 3 และ 4: ข้อตกลงเสร็จ' : 'จบการเชื่อมต่อ', text: s === 'good' ? 'ทั้งสองฝั่งมี Key เดียวกันแล้ว จากนี้ทุกอย่างเข้ารหัส' : 'Error ที่เห็นคือข้อความจริงจาก OpenSSL ในแบบฝึก' },
    ],
  },
  en: {
    title: 'Pick a scenario and press play: follow a TLS handshake message by message and see where the browser checks the certificate',
    pick: 'Scenario',
    scn: { good: 'A good server', ca: 'An unknown CA', name: 'Another host name', date: 'An expired certificate' },
    client: 'Browser', server: 'Server',
    msgs: ['ClientHello: I support TLS 1.3, and here is my key share', 'ServerHello, Certificate, Finished: my key share, my certificate, and proof I hold the private key', 'Finished: I checked everything and derived the same key', 'Session tickets for the next connection'],
    checks: ['signed by a CA we know', 'host name matches the one we asked for', 'not expired'],
    legend: [{ kind: 'new', text: 'check passed' }, { kind: 'use', text: 'message in flight' }, { kind: 'node', text: 'not happened yet' }],
    bytes: 'bytes', stop: 'The browser drops the connection. No third message, and nothing of the user\'s is ever sent', keys: 'Both sides now hold the same secret key, and that key never crossed the wire', data: 'The real data (GET /orders) is encrypted with this key',
    caption: 'The four sizes and the error messages come from exercise 03 with the OpenSSL 3.5.9 of the Python used. The sizes change with the certificate and the version, so they are an example and not a constant. The order of messages follows TLS 1.3 in RFC 8446, which this lesson did not read from the spec.',
    marks: (s) => [
      { at: 0, name: 'start', title: 'The browser speaks first (message 1)', text: 'The ClientHello lists the versions and ciphers it supports, with half of the key the two sides will work out together.' },
      { at: 2.6, name: 'server', title: 'The server sends back its certificate (message 2)', text: 'This is the biggest message because it carries the certificate, the proof from a CA that this public key belongs to this name.' },
      { at: 4.4, name: 'check', title: s === 'good' ? 'The browser makes three checks and all pass' : 'The browser makes three checks and one fails', text: s === 'good' ? 'Signed by a CA it trusts, the name matches, and it has not expired, so it goes on.' : 'The browser stops as soon as a check fails. Nothing of the user\'s is sent.' },
      { at: 7, name: 'done', title: s === 'good' ? 'Messages 3 and 4: the agreement is done' : 'The connection ends', text: s === 'good' ? 'Both sides hold the same key. From now on everything is encrypted.' : 'The error shown is the real message from OpenSSL in the exercise.' },
    ],
  },
};

const CX = 120, SX = 760;
const START = [0.6, 2.6, 7.0, 8.6];
const DUR = 1.5;

export default function TlsHandshakeLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [scn, setScn] = useState<Scn>('good');
  const clock = useClock(12);
  const { t } = clock;
  const failAt = FAILS[scn];
  const msgY = [104, 168, 338, 388];
  const dirs = [1, -1, 1, -1]; // 1 = client to server
  const checksP = smooth(prog(t, 4.4, 5.2));
  const rowShow = (i: number) => smooth(prog(t, 4.4 + i * 0.5, 4.8 + i * 0.5));
  const failed = scn !== 'good';
  const lastMsg = failed ? 2 : 4; // number of messages that happen
  const arrow = (i: number) => {
    if (i >= lastMsg) return null;
    const p = smooth(prog(t, START[i], START[i] + DUR));
    const x1 = dirs[i] === 1 ? CX : SX, x2 = dirs[i] === 1 ? SX : CX;
    const y = msgY[i];
    const xe = mix(x1, x2, p);
    return (
      <g key={i} style={{ opacity: t >= START[i] - 0.1 ? 1 : 0 }}>
        <line x1={x1} y1={y} x2={xe} y2={y} className="ib-line" style={{ stroke: 'var(--accent)', strokeWidth: 3.5 }} />
        <circle cx={xe} cy={y} r={8} className="ib-new" />
        <g style={{ opacity: p > 0.5 ? 1 : 0.0 }}>
          <circle cx={x1 + dirs[i] * 40} cy={y} r={15} style={{ fill: 'var(--accent)' }} />
          <text x={x1 + dirs[i] * 40} y={y + 5} textAnchor="middle" className="ib-white" style={{ fontSize: 15 }}>{i + 1}</text>
          <Lines x={CX + 66} y={y - 22} text={`${T.msgs[i]} (${SIZES[i].toLocaleString('en-US')} ${T.bytes})`} max={lang === 'th' ? 54 : 62} lh={19} className="ib-n" />
        </g>
      </g>
    );
  };
  const keysP = smooth(prog(t, 9.8, 10.6));
  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.pick}</span>
        <div className="seg" role="group" aria-label={T.pick} style={{ flexWrap: 'wrap' }}>
          {SCN.map((s) => <button key={s} type="button" aria-pressed={scn === s} onClick={() => { setScn(s); clock.restart(); }}>{T.scn[s]}</button>)}
        </div>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 520" role="img" aria-label={T.title}>
          <rect className="ib-use" x={30} y={10} width={180} height={44} rx={10} />
          <text x={CX} y={39} textAnchor="middle" className="ib-n" style={{ fontWeight: 700, fontSize: 18 }}>{T.client}</text>
          <rect className="ib-use" x={670} y={10} width={180} height={44} rx={10} />
          <text x={SX} y={39} textAnchor="middle" className="ib-n" style={{ fontWeight: 700, fontSize: 18 }}>{T.server}</text>
          <line x1={CX} y1={54} x2={CX} y2={500} className="ib-line" style={{ strokeDasharray: '6 6' }} />
          <line x1={SX} y1={54} x2={SX} y2={500} className="ib-line" style={{ strokeDasharray: '6 6' }} />
          {[0, 1, 2, 3].map(arrow)}
          {/* the three checks */}
          <g style={{ opacity: checksP }}>
            <rect className="ib-zone" x={170} y={206} width={540} height={110} rx={12} />
            {T.checks.map((c, i) => {
              const bad = failAt === i;
              return (
                <g key={c} style={{ opacity: rowShow(i) }}>
                  <text x={196} y={236 + i * 30} className={bad ? 'ib-bad ib-n' : 'ib-ok ib-n'} style={{ fontWeight: 700 }}>{bad ? '✗' : '✓'}</text>
                  <text x={226} y={236 + i * 30} className="ib-n">{c}</text>
                </g>
              );
            })}
          </g>
          {failed && (
            <g style={{ opacity: smooth(prog(t, 5.9, 6.6)) }}>
              <rect x={30} y={338} width={820} height={96} rx={12} style={{ fill: 'var(--surface)', stroke: 'var(--ib-bad)', strokeWidth: 3 }} />
              <text x={50} y={368} className="ib-m" style={{ fontSize: 15, fill: 'var(--ib-bad)' }}>{ERR[scn]}</text>
              <Lines x={50} y={402} text={T.stop} max={lang === 'th' ? 74 : 92} className="ib-n" />
            </g>
          )}
          {!failed && (
            <g style={{ opacity: keysP }}>
              <rect className="ib-new" x={170} y={430} width={540} height={74} rx={12} />
              <Lines x={190} y={458} text={T.keys} max={lang === 'th' ? 54 : 62} className="ib-n" lh={21} />
              <Lines x={190} y={494} text={T.data} max={lang === 'th' ? 54 : 62} className="ib-s" />
            </g>
          )}
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks(scn)} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
