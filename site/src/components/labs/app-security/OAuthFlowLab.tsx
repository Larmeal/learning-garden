import { useState } from 'react';
import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import { Seq, type Msg, type Note, type Party } from './seq';

// Shows:      the authorization code flow between a browser, an app (the client), an authorization server and an attacker, in four stories: the normal flow
//             with PKCE, a stolen code with no PKCE, a stolen code with PKCE, and a redirect_uri checked by prefix against one checked exactly.
// Because:    the whole point of the flow is that the code travels through the browser (which can leak it) while the token is fetched straight from
//             the server. The order, and who holds the verifier, is what turns a stolen code from a token into nothing.
// Control:    the story (4 options). Each draws its own six messages and ends differently.
// Conclusion: the code on the redirect is not a secret by itself. PKCE ties it to the client that asked, and an exact redirect_uri keeps it from being sent
//             to the attacker's address in the first place.
//
// The results (the six messages in this order, the stolen code gets a token only without PKCE, the prefix check sends the code to shop.test.evil.test,
// the exact check refuses) are asserted in exercises/07_oauth.py with a toy authorization server.

type Story = 'normal' | 'stealOff' | 'stealOn' | 'loose';
const STORIES: Story[] = ['normal', 'stealOff', 'stealOn', 'loose'];
type K = 'normal' | 'bad' | 'blocked';
const KINDS: Record<Story, K[]> = {
  normal: ['normal', 'normal', 'normal', 'normal', 'normal', 'normal'],
  stealOff: ['normal', 'normal', 'normal', 'bad', 'bad', 'bad'],
  stealOn: ['normal', 'normal', 'normal', 'bad', 'bad', 'blocked'],
  loose: ['bad', 'normal', 'bad', 'bad', 'normal', 'normal'],
};
const FROM_TO: Record<Story, [number, number][]> = {
  normal: [[1, 0], [0, 2], [2, 0], [0, 1], [1, 2], [2, 1]],
  stealOff: [[1, 0], [0, 2], [2, 0], [0, 3], [3, 2], [2, 3]],
  stealOn: [[1, 0], [0, 2], [2, 0], [0, 3], [3, 2], [2, 3]],
  loose: [[3, 0], [0, 2], [2, 0], [0, 3], [3, 2], [2, 3]],
};

type Item = { who: 0 | 1 | 2 | 3; text: [string, string]; at: number; tone?: 'ok' | 'bad' | 'plain'; lock?: boolean };
const TA = (i: number) => 0.4 + i * 1.7 + 1.2; // when message i (0 based) has arrived
const ITEMS: Record<Story, Item[]> = {
  normal: [{ who: 1, text: ['verifier (ลับ)', 'verifier (secret)'], at: 0.4, tone: 'ok', lock: true }, { who: 2, text: ['challenge', 'challenge'], at: TA(1), tone: 'plain' }, { who: 0, text: ['code=ABC…', 'code=ABC…'], at: TA(2), tone: 'plain' }, { who: 1, text: ['code=ABC…', 'code=ABC…'], at: TA(3), tone: 'plain' }, { who: 1, text: ['token', 'token'], at: TA(5), tone: 'ok' }],
  stealOff: [{ who: 2, text: ['ไม่มี challenge', 'no challenge'], at: TA(1), tone: 'bad' }, { who: 0, text: ['code=ABC…', 'code=ABC…'], at: TA(2), tone: 'plain' }, { who: 3, text: ['code=ABC… (รั่ว)', 'code=ABC… (leaked)'], at: TA(3), tone: 'bad' }, { who: 3, text: ['token ของ Ann', "Ann's token"], at: TA(5), tone: 'bad' }],
  stealOn: [{ who: 1, text: ['verifier (ลับ)', 'verifier (secret)'], at: 0.4, tone: 'ok', lock: true }, { who: 2, text: ['challenge', 'challenge'], at: TA(1), tone: 'plain' }, { who: 0, text: ['code=ABC…', 'code=ABC…'], at: TA(2), tone: 'plain' }, { who: 3, text: ['code=ABC… (รั่ว)', 'code=ABC… (leaked)'], at: TA(3), tone: 'bad' }, { who: 3, text: ['ไม่มี verifier ✗', 'no verifier ✗'], at: TA(4), tone: 'plain' }],
  loose: [{ who: 3, text: ['redirect_uri ของผู้โจมตี', 'attacker redirect_uri'], at: 0.4, tone: 'bad' }, { who: 2, text: ['เทียบแค่ขึ้นต้น ✗', 'prefix match ✗'], at: TA(1), tone: 'bad' }, { who: 3, text: ['code=ABC…', 'code=ABC…'], at: TA(3), tone: 'bad' }, { who: 3, text: ['token ของ Ann', "Ann's token"], at: TA(5), tone: 'bad' }],
};
const HOLD: Record<Lang, string[]> = {
  th: ['Browser ถืออยู่', 'App ถืออยู่', 'Auth server จำไว้', 'ผู้โจมตีถืออยู่'],
  en: ['Browser holds', 'App holds', 'Auth server knows', 'Attacker holds'],
};

const TEXT: Record<Lang, {
  title: string; pick: string; stories: Record<Story, string>; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; caption: string;
  parties: [string, string, string, string]; subs: [string, string, string, string];
  msgs: Record<Story, string[]>; notes: Record<Story, [string, 'ok' | 'bad']>; marks: Record<Story, [string, string][]>;
}> = {
  th: {
    title: 'เลือกเรื่องราวหนึ่งแบบ แล้วกดเล่นดู Authorization Code Flow ทีละข้อความ ว่าใครถือ Code ใครถือ Verifier และ Token ไปจบที่ใคร',
    pick: 'เรื่องราว',
    stories: { normal: 'Flow ปกติ (PKCE)', stealOff: 'โจรขโมย Code (ไม่มี PKCE)', stealOn: 'โจรขโมย Code (มี PKCE)', loose: 'redirect_uri หลวม' },
    legend: [{ kind: 'new', text: 'ข้อความปกติ' }, { kind: 'use', text: 'ผู้เล่นที่เชื่อได้' }],
    parties: ['Browser', 'App', 'Auth Server', 'ผู้โจมตี'], subs: ['ผู้ใช้', 'shop.test', 'id.test', 'Mallory'],
    msgs: {
      normal: ['App ส่งผู้ใช้ไป /authorize ใส่ scope, state และ code_challenge (S256 ของ verifier)', 'ผู้ใช้ล็อกอินและกดอนุญาต', 'Redirect กลับ redirect_uri?code=...&state=...', 'Browser ส่ง code กับ state ให้ App (App เช็ก state ตรง)', 'POST /token code และ code_verifier', 'access_token กับ id_token'],
      stealOff: ['App ส่งผู้ใช้ไป /authorize (ไม่ใส่ code_challenge)', 'ผู้ใช้ล็อกอินและกดอนุญาต', 'Redirect กลับพร้อม code', 'Code หลุดไปถึงผู้โจมตี (ผ่าน Log หรือลิงก์ที่ถูกดัก)', 'POST /token ด้วย Code ที่ขโมยมา', 'ได้ access_token ไปเลย'],
      stealOn: ['App ส่งผู้ใช้ไป /authorize พร้อม code_challenge', 'ผู้ใช้ล็อกอินและกดอนุญาต', 'Redirect กลับพร้อม code', 'Code หลุดไปถึงผู้โจมตี', 'POST /token ด้วย Code ที่ขโมยมา แต่ไม่มี code_verifier', 'invalid_grant (pkce) ปฏิเสธ'],
      loose: ['ผู้โจมตีส่งลิงก์ /authorize ที่ redirect_uri เป็น shop.test.evil.test ให้ผู้ใช้กด', 'ผู้ใช้เห็นหน้าอนุญาตปกติและกด', 'Server ตรวจแบบขึ้นต้นด้วย https://shop.test จึงยอม และ Redirect ไปที่ shop.test.evil.test', 'Code ตกถึงผู้โจมตี', 'POST /token ด้วย Code นั้น (App จริงไม่ได้ใช้ PKCE)', 'ผู้โจมตีได้ access_token'],
    },
    notes: {
      normal: ['Code วิ่งผ่าน Browser ได้ แต่ Token ถูกขอตรงจาก App ถึง Server และมี verifier ที่มีแต่ App', 'ok'],
      stealOff: ['Code ที่ไม่ผูกกับใครใช้แลก Token ได้ ใครถือก็ได้ Token', 'bad'],
      stealOn: ['Server เทียบ SHA-256 ของ verifier กับ challenge ผู้โจมตีไม่เคยเห็น verifier จึงได้แค่ Code ที่ใช้ไม่ได้', 'ok'],
      loose: ['การเทียบแบบขึ้นต้นด้วยยอมรับโดเมนของผู้โจมตี ต้องเทียบทั้งสตริงกับที่ลงทะเบียนไว้ ซึ่งแบบฝึกทดสอบแล้วปฏิเสธ', 'bad'],
    },
    marks: {
      normal: [['ขอ', 'App ตั้งต้นและเก็บ verifier ไว้กับตัวเอง'], ['Code', 'Code กลับมาทาง Browser'], ['Token', 'App แลก Code กับ Token โดยตรง']],
      stealOff: [['ขอ', 'ไม่มี PKCE'], ['Code หลุด', 'ผู้โจมตีได้ Code'], ['ได้ Token', 'ไม่มีอะไรหยุด']],
      stealOn: [['ขอ', 'มี PKCE'], ['Code หลุด', 'ผู้โจมตีได้ Code'], ['ถูกปฏิเสธ', 'ไม่มี verifier']],
      loose: [['ลิงก์', 'redirect_uri ของผู้โจมตี'], ['Redirect', 'Server ยอมเพราะเทียบแค่ขึ้นต้น'], ['Token', 'ผู้โจมตีแลกได้']],
    },
    caption: 'ลำดับหกข้อความ ผลของโจรที่ขโมย Code ทั้งสองแบบ การเทียบ redirect_uri แบบขึ้นต้น และแบบเทียบทั้งสตริง มาจากแบบฝึก 07 ที่ใช้ Authorization Server จำลอง เนื้อหาของแต่ละข้อความย่อให้เห็นเฉพาะส่วนสำคัญ ไม่ใช่รูปแบบของมาตรฐานเต็ม',
  },
  en: {
    title: 'Pick one story and press play: follow the authorization code flow message by message, see who holds the code, who holds the verifier, and where the token ends up',
    pick: 'Story',
    stories: { normal: 'The normal flow (PKCE)', stealOff: 'A thief steals the code (no PKCE)', stealOn: 'A thief steals the code (PKCE)', loose: 'A loose redirect_uri' },
    legend: [{ kind: 'new', text: 'a normal message' }, { kind: 'use', text: 'a party we can trust' }],
    parties: ['Browser', 'App', 'Auth server', 'Attacker'], subs: ['the user', 'shop.test', 'id.test', 'Mallory'],
    msgs: {
      normal: ['The app sends the user to /authorize with scope, state and a code_challenge (S256 of the verifier)', 'The user logs in and presses allow', 'Redirect back to redirect_uri?code=...&state=...', 'The browser hands code and state to the app (the app checks state matches)', 'POST /token with the code and the code_verifier', 'access_token and id_token'],
      stealOff: ['The app sends the user to /authorize (no code_challenge)', 'The user logs in and presses allow', 'Redirect back with a code', 'The code leaks to the attacker (through a log or an intercepted link)', 'POST /token with the stolen code', 'He gets an access_token'],
      stealOn: ['The app sends the user to /authorize with a code_challenge', 'The user logs in and presses allow', 'Redirect back with a code', 'The code leaks to the attacker', 'POST /token with the stolen code but no code_verifier', 'invalid_grant (pkce), refused'],
      loose: ['The attacker sends a link to /authorize whose redirect_uri is shop.test.evil.test', 'The user sees the normal consent page and presses allow', 'The server checks only that it starts with https://shop.test, accepts, and redirects to shop.test.evil.test', 'The code lands with the attacker', 'POST /token with that code (the real app does not use PKCE)', 'The attacker gets an access_token'],
    },
    notes: {
      normal: ['The code may travel through the browser, but the token is requested straight from the app to the server, with a verifier only the app has', 'ok'],
      stealOff: ['A code that is tied to nobody can be exchanged by anybody who holds it', 'bad'],
      stealOn: ['The server compares the SHA-256 of the verifier with the challenge. The attacker never saw the verifier, so the code he has is useless', 'ok'],
      loose: ['Comparing by prefix accepts the attacker\'s domain. The whole string must equal what was registered, which the exercise tested and refused', 'bad'],
    },
    marks: {
      normal: [['ask', 'The app starts and keeps the verifier to itself'], ['code', 'The code comes back through the browser'], ['token', 'The app exchanges the code for a token directly']],
      stealOff: [['ask', 'No PKCE'], ['code leaks', 'The attacker gets the code'], ['token', 'Nothing stops him']],
      stealOn: [['ask', 'With PKCE'], ['code leaks', 'The attacker gets the code'], ['refused', 'No verifier']],
      loose: [['the link', "The attacker's redirect_uri"], ['redirect', 'The server accepts because it compares only the start'], ['token', 'The attacker can exchange it']],
    },
    caption: 'The order of the six messages, the outcome for a thief in both cases, and the prefix and exact comparisons of redirect_uri come from exercise 07, which uses a toy authorization server. Each message is shortened to its important part and is not the format of the full standard.',
  },
};

export default function OAuthFlowLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [s, setS] = useState<Story>('normal');
  const clock = useClock(12);
  const parties: Party[] = [
    { x: 100, title: T.parties[0], sub: T.subs[0] },
    { x: 320, title: T.parties[1], sub: T.subs[1] },
    { x: 560, title: T.parties[2], sub: T.subs[2] },
    { x: 780, title: T.parties[3], sub: T.subs[3], bad: true },
  ];
  const msgs: Msg[] = FROM_TO[s].map(([from, to], i) => ({ from, to, y: 334 + i * 58, at: 0.4 + i * 1.7, label: T.msgs[s][i], n: i + 1, kind: KINDS[s][i], max: 44, dur: 1.2 }));
  const holdings = (t: number) => (
    <g>
      {[0, 1, 2, 3].map((w) => {
        const x = parties[w].x;
        const its = ITEMS[s].filter((it) => it.who === w && t >= it.at);
        return (
          <g key={w}>
            <rect x={x - 104} y={76} width={208} height={150} rx={14} fill="var(--surface)" stroke={w === 3 ? 'var(--ib-bad)' : 'var(--line-strong)'} strokeWidth={2} />
            <text x={x} y={98} textAnchor="middle" className="ib-s" style={{ fontSize: 13.5 }}>{HOLD[lang][w]}</text>
            {its.slice(-3).map((it, k) => (
              <g key={it.text[0] + it.at}>
                <rect x={x - 94} y={108 + k * 38} width={188} height={32} rx={16} fill={it.tone === 'bad' ? 'color-mix(in srgb, var(--ib-bad) 14%, var(--surface))' : it.tone === 'ok' ? 'var(--accent-soft)' : 'var(--surface)'} stroke={it.tone === 'bad' ? 'var(--ib-bad)' : it.tone === 'ok' ? 'var(--accent)' : 'var(--line-strong)'} strokeWidth={2.5} />
                <text x={x - 82} y={129 + k * 38} style={{ fontFamily: 'var(--mono, monospace)', fontSize: 12.5, fontWeight: 700 }}>{it.text[lang === 'th' ? 0 : 1]}{it.lock ? ' 🔒' : ''}</text>
              </g>
            ))}
          </g>
        );
      })}
    </g>
  );
  const [text, kind] = T.notes[s];
  const notes: Note[] = [{ x: 24, y: 690, w: 832, h: 62, at: 10.8, text, kind, max: lang === 'th' ? 80 : 94 }];
  const marks: Mark[] = T.marks[s].map(([name, tx], i) => ({ at: [0, 3.5, 8][i] ?? 0, name, title: tx, text: T.msgs[s][[0, 2, 5][i]] }));
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
        <svg viewBox="0 0 880 770" role="img" aria-label={T.title}>
          <Seq parties={parties} msgs={msgs} notes={notes} t={clock.t} bottom={680} extra={holdings(clock.t)} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
