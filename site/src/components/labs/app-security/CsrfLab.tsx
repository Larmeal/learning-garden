import { useState } from 'react';
import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import { Seq, type Msg, type Note, type Party } from './seq';

// Shows:      a user logged in to bank.test opens a page on evil.test, which makes the browser send a transfer request to the bank. Pick a defence
//             (none, SameSite=Lax, a CSRF token, an Origin check) and replay: with none, 500 moves to the attacker, with each defence the same
//             request is stopped at a different place, and the bank's own page still works.
// Because:    CSRF is "the browser sends the cookie by itself". Only a picture with three parties shows who sent the request and who attached the cookie.
// Control:    the defence (4 options); the clock plays the story. The messages, the stopping point and the final balance change with the option.
// Conclusion: the cookie proves the browser, not the page that made the request. The defences add something a foreign page cannot supply, or stop
//             the browser from attaching the cookie.
//
// The results (status 200 and 500 moved with no defence and SameSite=None, 401 with Lax, 403 with a token and with an Origin check) are asserted in
// exercises/05_sessions_csrf.py. The browser there is a model written from the rules, not a real browser.

type Def = 'none' | 'lax' | 'token' | 'origin';
const DEFS: Def[] = ['none', 'lax', 'token', 'origin'];

const TEXT: Record<Lang, {
  title: string; pick: string; defs: Record<Def, string>; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; caption: string;
  parties: [string, string, string]; subs: [string, string, string];
  msg: (d: Def) => { m1: string; m2: string; m3: string; m4: string };
  notes: (d: Def) => { a: string; b: string; kind: 'ok' | 'bad' };
  marks: (d: Def) => Mark[];
}> = {
  th: {
    title: 'เลือกวิธีป้องกัน แล้วกดเล่นดูว่า Request โอนเงินที่เว็บอื่นสั่งให้ Browser ส่งไป ผ่านหรือถูกหยุดตรงไหน',
    pick: 'วิธีป้องกัน',
    defs: { none: 'ไม่มีอะไรเลย', lax: 'SameSite=Lax', token: 'CSRF Token', origin: 'ตรวจ Origin' },
    legend: [{ kind: 'new', text: 'Request ที่ธนาคารยอมรับ' }, { kind: 'use', text: 'ฝั่งที่ไม่ได้ทำอะไรผิด' }],
    parties: ['ผู้ใช้ Browser', 'evil.test', 'bank.test'], subs: ['ล็อกอินที่ธนาคารค้างไว้', 'หน้าเว็บของผู้โจมตี', 'ธนาคาร'],
    msg: (d) => ({
      m1: 'ผู้ใช้เปิดหน้าของ evil.test (มีฟอร์มซ่อนอยู่)',
      m2: 'Script ในหน้านั้นสั่งให้ Browser ส่งฟอร์มโอนเงินไปที่ธนาคาร',
      m3: d === 'lax' ? 'POST ข้ามเว็บ: Browser ไม่แนบ Cookie' : 'POST /transfer to=evil amount=500 พร้อม Cookie ของผู้ใช้',
      m4: d === 'none' ? '200 โอนแล้ว' : d === 'lax' ? '401 ยังไม่ได้ล็อกอิน' : '403 ปฏิเสธ',
    }),
    notes: (d) => (d === 'none'
      ? { a: 'ธนาคารเห็น Cookie ที่ถูกต้อง จึงเชื่อว่าผู้ใช้ตั้งใจโอน', b: 'ผู้โจมตีได้ 500', kind: 'bad' }
      : d === 'lax'
        ? { a: 'SameSite=Lax บอก Browser ว่าอย่าแนบ Cookie เมื่อ POST มาจากเว็บอื่น', b: 'ผู้โจมตีได้ 0', kind: 'ok' }
        : d === 'token'
          ? { a: 'Request ไม่มี CSRF Token ที่ธนาคารสร้างให้หน้าของตัวเอง และเว็บอื่นอ่านไม่ได้', b: 'ผู้โจมตีได้ 0', kind: 'ok' }
          : { a: 'Origin ของ Request คือ https://evil.test ไม่ตรงกับ https://bank.test', b: 'ผู้โจมตีได้ 0', kind: 'ok' }),
    caption: 'ผลสี่แบบ (200 โอน 500, 401, 403, 403) และหน้าของธนาคารเองที่ยังทำงานได้เมื่อเปิดป้องกันทุกอย่าง มาจากแบบฝึก 05 ซึ่ง Browser ในแบบฝึกเป็นโมเดลที่เขียนจากกฎของ SameSite ไม่ใช่ Browser จริง',
    marks: (d) => [
      { at: 0, name: 'เปิดหน้า', title: 'ผู้ใช้ล็อกอินธนาคารไว้ แล้วเปิดหน้าอื่น', text: 'Browser เก็บ Cookie ของ bank.test ไว้ เมื่อไหร่ที่มี Request ไปที่ bank.test Browser จะแนบ Cookie ให้เองโดยที่ผู้ใช้ไม่ต้องทำอะไร' },
      { at: 2.0, name: 'ส่งฟอร์ม', title: 'หน้าของผู้โจมตีสั่งให้ Browser ส่ง Request', text: 'ผู้โจมตีไม่เห็น Cookie และไม่รู้ Password เขาแค่ทำให้ Browser เป็นคนส่ง' },
      { at: 4.5, name: 'ผล', title: d === 'none' ? 'ธนาคารโอนเงิน' : 'ธนาคารไม่โอน', text: d === 'none' ? 'Request ที่มี Cookie ถูกต้องทุกอย่าง ธนาคารจึงแยกไม่ออกว่าผู้ใช้กดเองหรือถูกหลอกให้ส่ง' : 'ป้องกันอย่างหนึ่งเพิ่มเงื่อนไขที่หน้าของผู้โจมตีทำให้ไม่ได้ ผลคือไม่มีเงินเคลื่อนที่' },
    ],
  },
  en: {
    title: 'Pick a defence and press play: see where the transfer request that another site makes the browser send gets through or is stopped',
    pick: 'Defence',
    defs: { none: 'nothing at all', lax: 'SameSite=Lax', token: 'CSRF token', origin: 'Origin check' },
    legend: [{ kind: 'new', text: 'a request the bank accepts' }, { kind: 'use', text: 'a side that did nothing wrong' }],
    parties: ['User browser', 'evil.test', 'bank.test'], subs: ['still logged in to the bank', "the attacker's page", 'the bank'],
    msg: (d) => ({
      m1: 'The user opens a page of evil.test (a hidden form is on it)',
      m2: 'A script on that page tells the browser to submit a transfer form to the bank',
      m3: d === 'lax' ? 'Cross-site POST: the browser leaves the cookie off' : 'POST /transfer to=evil amount=500 with the user\'s cookie',
      m4: d === 'none' ? '200 sent' : d === 'lax' ? '401 not logged in' : '403 refused',
    }),
    notes: (d) => (d === 'none'
      ? { a: 'The bank sees a valid cookie, so it believes the user meant to transfer', b: 'Attacker gets 500', kind: 'bad' }
      : d === 'lax'
        ? { a: 'SameSite=Lax tells the browser not to attach the cookie to a POST that comes from another site', b: 'Attacker gets 0', kind: 'ok' }
        : d === 'token'
          ? { a: 'The request has no CSRF token, which the bank gave only to its own page and other sites cannot read', b: 'Attacker gets 0', kind: 'ok' }
          : { a: 'The request\'s Origin is https://evil.test, which is not https://bank.test', b: 'Attacker gets 0', kind: 'ok' }),
    caption: 'The four outcomes (200 and 500 moved, 401, 403, 403) and the bank\'s own page that still works with every defence on come from exercise 05. The browser in that exercise is a model written from the SameSite rules, not a real browser.',
    marks: (d) => [
      { at: 0, name: 'open', title: 'The user is logged in to the bank and opens another page', text: 'The browser keeps the cookie of bank.test. Whenever a request goes to bank.test the browser attaches it by itself, with nothing for the user to do.' },
      { at: 2.0, name: 'submit', title: "The attacker's page tells the browser to send a request", text: 'The attacker never sees the cookie and does not know the password. He only makes the browser the sender.' },
      { at: 4.5, name: 'result', title: d === 'none' ? 'The bank moves the money' : 'The bank does not move the money', text: d === 'none' ? 'The request carries a perfectly valid cookie, so the bank cannot tell whether the user pressed the button or was tricked into sending it.' : 'A defence adds a condition that the attacker\'s page cannot meet. No money moves.' },
    ],
  },
};

export default function CsrfLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [d, setD] = useState<Def>('none');
  const clock = useClock(8);
  const m = T.msg(d);
  const parties: Party[] = [
    { x: 120, title: T.parties[0], sub: T.subs[0] },
    { x: 440, title: T.parties[1], sub: T.subs[1], bad: true },
    { x: 760, title: T.parties[2], sub: T.subs[2] },
  ];
  const stopped = d !== 'none';
  const msgs: Msg[] = [
    { from: 0, to: 1, y: 124, at: 0.4, label: m.m1, n: 1 },
    { from: 1, to: 0, y: 200, at: 2.0, label: m.m2, n: 2, kind: 'bad' },
    { from: 0, to: 2, y: 274, at: 3.4, label: m.m3, n: 3, kind: d === 'lax' ? 'blocked' : 'normal', max: 36, dur: 1.5 },
    { from: 2, to: 0, y: 350, at: 5.2, label: m.m4, n: 4, kind: stopped ? 'bad' : 'normal', max: 36 },
  ];
  const nt = T.notes(d);
  const notes: Note[] = [
    { x: 24, y: 390, w: 832, h: 46, at: 6.2, text: nt.a, kind: nt.kind, max: lang === 'th' ? 80 : 96 },
    { x: 24, y: 446, w: 832, h: 40, at: 6.8, text: nt.b, kind: nt.kind },
  ];
  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.pick}</span>
        <div className="seg" role="group" aria-label={T.pick} style={{ flexWrap: 'wrap' }}>
          {DEFS.map((x) => <button key={x} type="button" aria-pressed={d === x} onClick={() => { setD(x); clock.restart(); }}>{T.defs[x]}</button>)}
        </div>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 500" role="img" aria-label={T.title}>
          <Seq parties={parties} msgs={msgs} notes={notes} t={clock.t} bottom={380} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks(d)} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
