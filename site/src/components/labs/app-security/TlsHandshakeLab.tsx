import { useState } from 'react';
import { ClockControls, useClock, prog, smooth, mix, type Lang, type Mark } from '../spark/timeline';
import { Key } from '../data-security/ds';
import { wrapText } from '../iceberg/ib';

// Shows:      a TLS 1.3 handshake as four cards that travel between a browser and a server, with the objects they are about: the server's certificate (name, who signed it, until when), the
//             browser's list of CAs it trusts, the three checks on the certificate after message 2, and the key both sides end with. Pick a scenario and replay it.
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


const NEW: Record<Lang, { browser: string; server: string; trusted: string; asking: string; cert: string; name: string; issuer: string; valid: string; privKey: string; staysHere: string; got: string; sk: string; failed: string }> = {
  th: { browser: 'Browser', server: 'Server', trusted: 'CA ที่ Browser เชื่อ', asking: 'กำลังคุยกับ', cert: 'ใบรับรองของ Server', name: 'ชื่อ', issuer: 'ออกโดย', valid: 'ใช้ได้ถึง', privKey: 'Private Key', staysHere: 'อยู่ที่ Server ตลอด', got: 'ตัวเดียวกัน', sk: 'Key ของการเชื่อมต่อนี้', failed: 'ตรวจไม่ผ่าน' },
  en: { browser: 'Browser', server: 'Server', trusted: 'CAs the browser trusts', asking: 'talking to', cert: "the server's certificate", name: 'name', issuer: 'signed by', valid: 'valid until', privKey: 'private key', staysHere: 'never leaves the server', got: 'the same one', sk: "this connection's key", failed: 'check failed' },
};
const CERT: Record<Scn, { name: string; issuer: string; valid: string; bad: 'issuer' | 'name' | 'valid' | null }> = {
  good: { name: 'shop.test', issuer: 'Test CA', valid: '2027-01-01', bad: null },
  ca: { name: 'shop.test', issuer: 'Unknown CA', valid: '2027-01-01', bad: 'issuer' },
  name: { name: 'other.test', issuer: 'Test CA', valid: '2027-01-01', bad: 'name' },
  date: { name: 'shop.test', issuer: 'Test CA', valid: '2020-01-01', bad: 'valid' },
};
const START = [0.6, 2.6, 7.0, 8.6];
const DUR = 1.5;

export default function TlsHandshakeLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const N = NEW[lang];
  const [scn, setScn] = useState<Scn>('good');
  const clock = useClock(12);
  const { t } = clock;
  const failAt = FAILS[scn];
  const failed = scn !== 'good';
  const cert = CERT[scn];
  const certP = smooth(prog(t, 3.6, 4.1));
  const showRow = (i: number) => smooth(prog(t, 4.4 + i * 0.5, 4.8 + i * 0.5));
  const dirs = [1, -1, 1, -1];
  const ys = [136, 258, 364, 452];
  const bad = 'var(--ib-bad)', acc = 'var(--accent)';
  const card = (i: number) => {
    if (failed && i >= 2) return null;
    const p = smooth(prog(t, START[i], START[i] + DUR));
    if (p <= 0) return null;
    const w = 250;
    const x = 330;
    const lines = wrapText(T.msgs[i], 30);
    const h = lines.length * 19 + 34;
    const top = ys[i] - h - 6;
    const x1 = dirs[i] === 1 ? 308 : 572, x2 = dirs[i] === 1 ? 572 : 308;
    const xe = mix(x1, x2, p);
    return (
      <g key={i}>
        <line x1={x1} y1={ys[i]} x2={xe} y2={ys[i]} stroke={acc} strokeWidth={4} />
        <path d={`M${xe},${ys[i]} l${-10 * dirs[i]},-7 l0,14 z`} fill={acc} />
        <rect x={x - 4} y={top} width={w + 8} height={h} rx={10} fill="var(--surface)" stroke={acc} strokeWidth={2.5} opacity={Math.min(1, p * 2)} />
        <circle cx={x + 8} cy={top + 14} r={12} fill={acc} opacity={Math.min(1, p * 2)} />
        <text x={x + 8} y={top + 19} textAnchor="middle" style={{ fill: 'var(--on-key, #fff)', fontSize: 13.5, fontWeight: 700 }}>{i + 1}</text>
        <text x={x + 28} y={top + 20} className="ib-n" style={{ fontSize: 14.5 }} opacity={Math.min(1, p * 2)}>
          {lines.map((l, k) => <tspan key={k} x={x + 28} dy={k === 0 ? 0 : 19}>{l}</tspan>)}
        </text>
        <text x={x + w - 4} y={top + h - 8} textAnchor="end" className="ib-s" style={{ fontSize: 13.5 }} opacity={Math.min(1, p * 2)}>{`${SIZES[i].toLocaleString('en-US')} ${T.bytes}`}</text>
      </g>
    );
  };
  const marks = T.marks(scn);
  const goodEnd = !failed && t >= 8.2;
  const failEnd = failed && t >= 5.4;
  const rowFail = (i: number) => failed && failAt === i;
  const current = marks[Math.max(0, marks.filter((m) => t >= m.at).length - 1)];
  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <span className="ib-lbl">{T.pick}</span>
        <div className="seg" role="group" aria-label={T.pick} style={{ flexWrap: 'wrap' }}>
          {SCN.map((x) => <button key={x} type="button" aria-pressed={scn === x} onClick={() => { setScn(x); clock.restart(); }}>{T.scn[x]}</button>)}
        </div>
      </div>
      <Key items={[{ color: acc, text: T.legend[0].text }, { color: bad, text: N.failed }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 560" role="img" aria-label={T.title}>
          {/* the browser */}
          <rect x={6} y={6} width={296} height={470} rx={14} fill="var(--surface)" stroke="var(--line-strong)" strokeWidth={2} />
          <text x={20} y={32} className="ib-n" style={{ fontWeight: 700, fontSize: 18 }}>{N.browser}</text>
          <text x={20} y={54} className="ib-s" style={{ fontSize: 14 }}>{`${N.asking} shop.test`}</text>
          <rect x={18} y={68} width={272} height={62} rx={10} fill="var(--accent-soft)" stroke="var(--line-strong)" strokeWidth={1.5} />
          <text x={30} y={90} className="ib-s" style={{ fontSize: 13.5 }}>{N.trusted}</text>
          <text x={30} y={114} style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--mono, monospace)' }}>Test CA</text>
          {T.checks.map((c, i) => {
            const y = 160 + i * 62;
            const p = showRow(i);
            const skipped = failed && i > failAt;
            return (
              <g key={c} opacity={0.35 + 0.65 * p}>
                <rect x={18} y={y} width={272} height={50} rx={10} fill="var(--surface)" stroke={p > 0.9 ? (rowFail(i) ? bad : skipped ? 'var(--line)' : acc) : 'var(--line)'} strokeWidth={p > 0.9 ? 3 : 1.5} strokeDasharray={p < 0.2 ? '6 5' : undefined} />
                <foreignObject x={28} y={y + 4} width={216} height={44}><div style={{ fontSize: 14.5, lineHeight: 1.25, paddingTop: 4, color: skipped ? 'var(--muted)' : undefined }}>{c}</div></foreignObject>
                <text x={274} y={y + 32} textAnchor="end" style={{ fontSize: 22, fontWeight: 700, fill: p < 0.9 ? 'transparent' : rowFail(i) ? bad : skipped ? 'var(--muted)' : acc }}>{rowFail(i) ? '✗' : skipped ? '–' : '✓'}</text>
              </g>
            );
          })}
          {goodEnd ? (
            <g>
              <rect x={18} y={354} width={272} height={64} rx={12} fill="var(--accent-soft)" stroke={acc} strokeWidth={3} />
              <text x={30} y={378} className="ib-s" style={{ fontSize: 13.5 }}>{N.sk}</text>
              <text x={30} y={404} style={{ fontSize: 17, fontWeight: 700, fontFamily: 'var(--mono, monospace)' }}>🔑 k = ••••••••</text>
            </g>
          ) : null}
          {failEnd ? (
            <g>
              <rect x={18} y={354} width={272} height={108} rx={12} fill="color-mix(in srgb, var(--ib-bad) 12%, var(--surface))" stroke={bad} strokeWidth={3} />
              <foreignObject x={28} y={360} width={252} height={98}><div style={{ fontSize: 14, lineHeight: 1.3, fontWeight: 700, color: 'var(--ib-bad)' }}>{`✗ ${T.stop}`}</div></foreignObject>
            </g>
          ) : null}
          {/* the server */}
          <rect x={578} y={6} width={296} height={470} rx={14} fill="var(--surface)" stroke="var(--line-strong)" strokeWidth={2} />
          <text x={592} y={32} className="ib-n" style={{ fontWeight: 700, fontSize: 18 }}>{N.server}</text>
          <rect x={590} y={50} width={272} height={150} rx={12} fill="var(--surface)" stroke={certP > 0.9 && failed ? bad : acc} strokeWidth={3} />
          <text x={602} y={74} className="ib-n" style={{ fontWeight: 700, fontSize: 15.5 }}>{`📜 ${N.cert}`}</text>
          {([['name', N.name, cert.name], ['issuer', N.issuer, cert.issuer], ['valid', N.valid, cert.valid]] as const).map(([k, label, v], i) => {
            const hot = certP > 0.9 && cert.bad === k;
            return (
              <g key={k}>
                <text x={602} y={104 + i * 30} className="ib-s" style={{ fontSize: 14 }}>{label}</text>
                <text x={702} y={104 + i * 30} style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono, monospace)', fill: hot ? bad : 'var(--fg)' }}>{`${v}${hot ? ' ✗' : ''}`}</text>
              </g>
            );
          })}
          <rect x={590} y={214} width={272} height={64} rx={12} fill="var(--accent-soft)" stroke="var(--line-strong)" strokeWidth={2} />
          <text x={602} y={238} className="ib-n" style={{ fontWeight: 700, fontSize: 15.5 }}>{`🔒 ${N.privKey}`}</text>
          <text x={602} y={262} className="ib-s" style={{ fontSize: 14 }}>{N.staysHere}</text>
          {goodEnd ? (
            <g>
              <rect x={590} y={354} width={272} height={64} rx={12} fill="var(--accent-soft)" stroke={acc} strokeWidth={3} />
              <text x={602} y={378} className="ib-s" style={{ fontSize: 13.5 }}>{`${N.sk} (${N.got})`}</text>
              <text x={602} y={404} style={{ fontSize: 17, fontWeight: 700, fontFamily: 'var(--mono, monospace)' }}>🔑 k = ••••••••</text>
            </g>
          ) : null}
          {[0, 1, 2, 3].map(card)}
          {failEnd ? <text x={440} y={352} textAnchor="middle" style={{ fontSize: 14, fontWeight: 700, fill: bad }}>{ERR[scn].replace('CERTIFICATE_VERIFY_FAILED: ', '')}</text> : null}
          <rect x={6} y={486} width={868} height={60} rx={12} className="ib-banner" />
          <foreignObject x={18} y={490} width={844} height={52}><div style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.35, paddingTop: 6 }}>{goodEnd ? `${T.keys}. ${T.data}` : failEnd ? T.stop : current.title}</div></foreignObject>
        </svg>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
