import { useState } from 'react';
import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import { Seq, type Msg, type Note, type Party } from './seq';

// Shows:      a session cookie from login to the next request, and four ways around it: a script that reads the cookie (with and without HttpOnly), and
//             session fixation (with and without a new id at login). Pick a story and replay.
// Because:    "the session id is the password for the next hour" is the claim that makes cookie flags and id rotation matter, and it needs three
//             parties (browser, server, attacker) and the order of the messages to be seen.
// Control:    the story (5 options). Each has its own messages, its own stopping point and its own outcome.
// Conclusion: whoever holds the session id is the user. HttpOnly keeps scripts from reading it, a new id at login keeps an id the attacker chose from
//             becoming the user's, and neither replaces the other.
//
// The results (HttpOnly hides the cookie from script, a kept id lets the attacker in, a new id does not, the id is 43 characters, the header carries
// HttpOnly, Secure and SameSite=Lax) are asserted in exercises/05_sessions_csrf.py. The browser there is a model, not a real browser.

type Story = 'normal' | 'xss' | 'xssHttp' | 'fixKeep' | 'fixNew';
const STORIES: Story[] = ['normal', 'xss', 'xssHttp', 'fixKeep', 'fixNew'];
const SID = 'ZXaHJ6Pl…';

const TEXT: Record<Lang, {
  title: string; pick: string; stories: Record<Story, string>; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; caption: string;
  parties: [string, string, string]; subs: [string, string, string];
  msgs: Record<Story, string[]>; notes: Record<Story, [string, 'ok' | 'bad' | 'plain']>; marks: Record<Story, [string, string][]>;
}> = {
  th: {
    title: 'เลือกเรื่องราวหนึ่งแบบ แล้วกดเล่นดูว่า Session ID วิ่งไปมาอย่างไร และผู้โจมตีเอาไปใช้ได้หรือไม่',
    pick: 'เรื่องราว',
    stories: { normal: 'ล็อกอินปกติ', xss: 'XSS ขโมย Cookie', xssHttp: 'XSS แต่มี HttpOnly', fixKeep: 'Fixation (ID เดิม)', fixNew: 'Fixation (ID ใหม่)' },
    legend: [{ kind: 'new', text: 'ข้อความที่ถึงปลายทาง' }, { kind: 'use', text: 'ผู้เล่นที่ไม่ได้ทำผิด' }],
    parties: ['Browser', 'Server', 'ผู้โจมตี'], subs: ['ของผู้ใช้', 'เว็บของเรา', 'Mallory'],
    msgs: {
      normal: ['POST /login พร้อมชื่อกับรหัสผ่าน', `Set-Cookie: sid=${SID} 43 ตัว; HttpOnly; Secure; SameSite=Lax`, `GET /orders Cookie: sid=${SID}`, '200 Order ของ Ann'],
      xss: [`Set-Cookie: sid=${SID} (ไม่มี HttpOnly)`, 'Script ที่ฝังมารัน document.cookie ได้ sid', `GET /orders Cookie: sid=${SID} (ของที่ขโมยมา)`, '200 Order ของ Ann ไปถึงผู้โจมตี'],
      xssHttp: [`Set-Cookie: sid=${SID}; HttpOnly`, 'Script ที่ฝังมารัน document.cookie ได้ค่าว่าง', 'ผู้โจมตีไม่มี sid จึงส่งอะไรไม่ได้', ''],
      fixKeep: ['GET /pre-login', 'Set-Cookie: sid=A (ผู้โจมตีรู้ A)', 'ผู้โจมตีส่งลิงก์ที่ฝัง sid=A ให้ผู้ใช้ แล้วผู้ใช้ล็อกอิน', 'GET /orders Cookie: sid=A ได้ 200 เป็น Ann'],
      fixNew: ['GET /pre-login', 'Set-Cookie: sid=A (ผู้โจมตีรู้ A)', 'ผู้ใช้ล็อกอินด้วย sid=A Server ออก sid=B ให้ใหม่', 'GET /orders Cookie: sid=A ได้ 401'],
    },
    notes: {
      normal: ['จากนี้ทุก Request แนบ Cookie เองโดย Browser Server รู้ว่าเป็น Ann จาก sid ไม่ต้องส่งรหัสผ่านอีก', 'ok'],
      xss: ['ใครถือ sid ก็คือ Ann ผู้โจมตีใช้ได้จนกว่า Session หมดอายุ หน้าแรกของเว็บไม่ได้รู้เลยว่ามีคนใช้ซ้ำ', 'bad'],
      xssHttp: ['HttpOnly ทำให้ Script อ่าน Cookie ไม่ได้ ผู้โจมตียังใส่ Script ได้ แต่ขโมย sid ไม่ได้ (ยังทำอย่างอื่นในนามผู้ใช้ผ่าน Browser ได้อยู่)', 'ok'],
      fixKeep: ['Server ใช้ sid เดิมต่อหลังล็อกอิน sid ที่ผู้โจมตีรู้จึงกลายเป็น Session ของ Ann', 'bad'],
      fixNew: ['Server เปลี่ยน sid ทุกครั้งที่ล็อกอิน sid=A ที่ผู้โจมตีถืออยู่จึงไม่ใช่ของใครเลย', 'ok'],
    },
    marks: {
      normal: [['ล็อกอิน', 'ผู้ใช้ส่งรหัสผ่านครั้งเดียว'], ['Cookie', 'Server ให้ Session ID ที่สุ่มยาว 256 บิต'], ['ใช้ต่อ', 'Request ถัดไปแนบ Cookie เอง']],
      xss: [['เริ่ม', 'ผู้ใช้ล็อกอินแล้ว Cookie ไม่มี HttpOnly'], ['Script', 'Script ที่ฝังมาอ่าน Cookie ส่งออก'], ['ใช้ของที่ขโมย', 'ผู้โจมตีส่ง Request ในนามผู้ใช้']],
      xssHttp: [['เริ่ม', 'Cookie มี HttpOnly'], ['Script', 'Script อ่านไม่ได้'], ['จบ', 'ผู้โจมตีมือเปล่า']],
      fixKeep: [['รู้ ID', 'ผู้โจมตีขอ Session ID ก่อน'], ['ฝัง', 'ให้ผู้ใช้ใช้ ID นั้น'], ['ใช้', 'หลังผู้ใช้ล็อกอิน ID เดิมกลายเป็น Ann']],
      fixNew: [['รู้ ID', 'ผู้โจมตีขอ Session ID ก่อน'], ['ล็อกอิน', 'Server ออก ID ใหม่'], ['ใช้', 'ID เดิมใช้ไม่ได้']],
    },
    caption: 'ผลทั้งห้าเรื่องและ Header ของ Cookie มาจากแบบฝึก 05 ซึ่ง Browser เป็นโมเดลในโค้ด ไม่ใช่ Browser จริง ค่า sid ย่อให้เห็นแค่ต้น',
  },
  en: {
    title: 'Pick one story and press play: see how the session id travels and whether the attacker can use it',
    pick: 'Story',
    stories: { normal: 'A normal login', xss: 'XSS steals the cookie', xssHttp: 'XSS but HttpOnly', fixKeep: 'Fixation (id kept)', fixNew: 'Fixation (new id)' },
    legend: [{ kind: 'new', text: 'a message that arrived' }, { kind: 'use', text: 'a party that did nothing wrong' }],
    parties: ['Browser', 'Server', 'Attacker'], subs: ["the user's", 'our site', 'Mallory'],
    msgs: {
      normal: ['POST /login with name and password', `Set-Cookie: sid=${SID} 43 characters; HttpOnly; Secure; SameSite=Lax`, `GET /orders Cookie: sid=${SID}`, "200 Ann's orders"],
      xss: [`Set-Cookie: sid=${SID} (no HttpOnly)`, 'The injected script runs document.cookie and gets the sid', `GET /orders Cookie: sid=${SID} (the stolen one)`, "200 Ann's orders reach the attacker"],
      xssHttp: [`Set-Cookie: sid=${SID}; HttpOnly`, 'The injected script runs document.cookie and gets an empty string', 'The attacker has no sid, so there is nothing to send', ''],
      fixKeep: ['GET /pre-login', 'Set-Cookie: sid=A (the attacker knows A)', 'The attacker sends the user a link that plants sid=A, and the user logs in', 'GET /orders Cookie: sid=A gets 200 as Ann'],
      fixNew: ['GET /pre-login', 'Set-Cookie: sid=A (the attacker knows A)', 'The user logs in with sid=A and the server issues a new sid=B', 'GET /orders Cookie: sid=A gets 401'],
    },
    notes: {
      normal: ['From now on the browser attaches the cookie to every request. The server knows it is Ann from the sid and no longer needs the password.', 'ok'],
      xss: ['Whoever holds the sid is Ann. The attacker can use it until the session expires, and the site cannot tell a second user is there.', 'bad'],
      xssHttp: ['HttpOnly keeps scripts from reading the cookie. The attacker can still inject script, but cannot steal the sid (the script can still act in the user\'s name through the browser).', 'ok'],
      fixKeep: ['The server keeps the old sid after login, so the sid the attacker knows becomes Ann\'s session.', 'bad'],
      fixNew: ['The server issues a new sid at every login, so the sid=A the attacker holds belongs to nobody.', 'ok'],
    },
    marks: {
      normal: [['login', 'The user sends the password once'], ['cookie', 'The server gives a random 256 bit session id'], ['reuse', 'The next request carries the cookie by itself']],
      xss: [['start', 'The user is logged in and the cookie has no HttpOnly'], ['script', 'The injected script reads the cookie and sends it out'], ['use it', 'The attacker sends a request in the user\'s name']],
      xssHttp: [['start', 'The cookie has HttpOnly'], ['script', 'The script cannot read it'], ['end', 'The attacker has nothing']],
      fixKeep: [['know the id', 'The attacker asks for a session id first'], ['plant', 'Gets the user to use that id'], ['use', 'After the user logs in the old id is Ann']],
      fixNew: [['know the id', 'The attacker asks for a session id first'], ['login', 'The server issues a new id'], ['use', 'The old id no longer works']],
    },
    caption: 'The five outcomes and the cookie header come from exercise 05, where the browser is a model in code and not a real browser. The sid is shortened to show only its start.',
  },
};


type Item = { who: 0 | 1 | 2; text: string; at: number; until?: number; tone?: 'ok' | 'bad' | 'plain'; lock?: boolean };
const T_ARR = (i: number) => 0.4 + i * 1.8 + 1.3; // when message i (0 based) has arrived
const ITEMS: Record<Story, Item[]> = {
  normal: [{ who: 1, text: 'sid ZXaH… → Ann', at: T_ARR(0) + 0.1, tone: 'ok' }, { who: 0, text: 'sid=ZXaH…', at: T_ARR(1), tone: 'ok', lock: true }],
  xss: [{ who: 0, text: 'sid=ZXaH…', at: T_ARR(0), tone: 'plain' }, { who: 1, text: 'sid ZXaH… → Ann', at: T_ARR(0), tone: 'plain' }, { who: 2, text: 'sid=ZXaH…', at: T_ARR(1), tone: 'bad' }],
  xssHttp: [{ who: 0, text: 'sid=ZXaH…', at: T_ARR(0), tone: 'ok', lock: true }, { who: 1, text: 'sid ZXaH… → Ann', at: T_ARR(0), tone: 'plain' }],
  fixKeep: [{ who: 1, text: 'sid A → (ยังไม่ล็อกอิน)', at: T_ARR(0), until: T_ARR(2), tone: 'plain' }, { who: 2, text: 'sid=A', at: T_ARR(1), tone: 'bad' }, { who: 0, text: 'sid=A (ถูกฝังมา)', at: T_ARR(2), tone: 'bad' }, { who: 1, text: 'sid A → Ann', at: T_ARR(2), tone: 'bad' }],
  fixNew: [{ who: 1, text: 'sid A → (ยังไม่ล็อกอิน)', at: T_ARR(0), until: T_ARR(2), tone: 'plain' }, { who: 2, text: 'sid=A', at: T_ARR(1), tone: 'plain' }, { who: 0, text: 'sid=A', at: T_ARR(2), until: T_ARR(2) + 0.9, tone: 'plain' }, { who: 1, text: 'sid B → Ann', at: T_ARR(2) + 0.2, tone: 'ok' }, { who: 0, text: 'sid=B', at: T_ARR(2) + 0.9, tone: 'ok', lock: true }],
};
const HOLD: Record<Lang, [string, string, string]> = {
  th: ['Browser เก็บไว้ (Cookie)', 'Server จำไว้ (ตาราง Session)', 'ผู้โจมตีถืออยู่'],
  en: ['Browser keeps (cookies)', 'Server remembers (session table)', 'Attacker holds'],
};
const EMPTY: Record<Lang, string> = { th: 'ยังไม่มีอะไร', en: 'nothing yet' };

const ORDER: Record<Story, { msgs: { from: number; to: number; kind?: 'normal' | 'bad' | 'blocked' }[] }> = {
  normal: { msgs: [{ from: 0, to: 1 }, { from: 1, to: 0 }, { from: 0, to: 1 }, { from: 1, to: 0 }] },
  xss: { msgs: [{ from: 1, to: 0 }, { from: 0, to: 2, kind: 'bad' }, { from: 2, to: 1, kind: 'bad' }, { from: 1, to: 2, kind: 'bad' }] },
  xssHttp: { msgs: [{ from: 1, to: 0 }, { from: 0, to: 2, kind: 'blocked' }, { from: 2, to: 1, kind: 'blocked' }] },
  fixKeep: { msgs: [{ from: 2, to: 1 }, { from: 1, to: 2 }, { from: 0, to: 1, kind: 'bad' }, { from: 2, to: 1, kind: 'bad' }] },
  fixNew: { msgs: [{ from: 2, to: 1 }, { from: 1, to: 2 }, { from: 0, to: 1 }, { from: 2, to: 1, kind: 'blocked' }] },
};

export default function CookieSessionLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [s, setS] = useState<Story>('normal');
  const clock = useClock(9);
  const parties: Party[] = [
    { x: 120, title: T.parties[0], sub: T.subs[0] },
    { x: 440, title: T.parties[1], sub: T.subs[1] },
    { x: 760, title: T.parties[2], sub: T.subs[2], bad: true },
  ];
  const labels = T.msgs[s].filter((x) => x);
  const msgs: Msg[] = ORDER[s].msgs.map((m, i) => ({ ...m, y: 318 + i * 66, at: 0.4 + i * 1.8, label: labels[i], n: i + 1, kind: m.kind ?? 'normal', max: 44 }));
  const holdings = (t: number) => (
    <g>
      {[0, 1, 2].map((w) => {
        const x = 120 + w * 320;
        const items = ITEMS[s].filter((it) => it.who === w && t >= it.at && (it.until === undefined || t < it.until));
        return (
          <g key={w}>
            <rect x={x - 118} y={74} width={236} height={170} rx={14} fill="var(--surface)" stroke={w === 2 ? 'var(--ib-bad)' : 'var(--line-strong)'} strokeWidth={2} />
            <text x={x} y={98} textAnchor="middle" className="ib-s" style={{ fontSize: 14 }}>{HOLD[lang][w]}</text>
            {items.length === 0 ? <text x={x} y={166} textAnchor="middle" className="ib-s" style={{ fontSize: 14.5, fill: 'var(--muted)' }}>{EMPTY[lang]}</text> : null}
            {items.map((it, k) => (
              <g key={it.text + it.at}>
                <rect x={x - 108} y={110 + k * 40} width={216} height={34} rx={17} fill={it.tone === 'bad' ? 'color-mix(in srgb, var(--ib-bad) 14%, var(--surface))' : it.tone === 'ok' ? 'var(--accent-soft)' : 'var(--surface)'} stroke={it.tone === 'bad' ? 'var(--ib-bad)' : it.tone === 'ok' ? 'var(--accent)' : 'var(--line-strong)'} strokeWidth={2.5} />
                <text x={x - 96} y={132 + k * 40} style={{ fontFamily: 'var(--mono, monospace)', fontSize: 13, fontWeight: 700 }}>{`${it.who === 0 ? '🍪 ' : ''}${it.text}`}</text>
                {it.lock ? <text x={x + 98} y={133 + k * 40} textAnchor="end" style={{ fontSize: 13 }}>🔒</text> : null}
              </g>
            ))}
          </g>
        );
      })}
    </g>
  );
  const [noteText, kind] = T.notes[s];
  const notes: Note[] = [{ x: 24, y: 596, w: 832, h: 70, at: 7.4, text: noteText, kind, max: lang === 'th' ? 80 : 94 }];
  const marks: Mark[] = T.marks[s].map(([name, text], i) => ({ at: [0, 2.2, 5.6][i] ?? 0, name, title: name, text }));
  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.pick}</span>
        <div className="seg" role="group" aria-label={T.pick} style={{ flexWrap: 'wrap' }}>
          {STORIES.map((x) => <button key={x} type="button" aria-pressed={s === x} onClick={() => { setS(x); clock.restart(); }}>{T.stories[x]}</button>)}
        </div>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 680" role="img" aria-label={T.title}>
          <Seq parties={parties} msgs={msgs} notes={notes} t={clock.t} bottom={586} extra={holdings(clock.t)} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
