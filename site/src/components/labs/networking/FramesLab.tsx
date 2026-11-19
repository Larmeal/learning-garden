import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Legend, ease } from './nw';
import data from './http.json';

// Shows:      the real frames of one HTTP/2 connection, in the order they were captured, as two strips of coloured blocks (client to server above, server to client below). A block is a frame and its colour is
//             its stream: the six requests are six small HEADERS frames (colours 1 to 6), and the six responses are a HEADERS and a DATA frame per stream. Frames that belong to no stream (SETTINGS, WINDOW_UPDATE)
//             are grey. Blocks have two widths. Pressing play adds the frames one by one.
// Because:    "many streams share one connection" is a statement about frames tagged with a stream id travelling in one byte stream. The reader has to see the frames of stream 1, 3, 5 side by side in the same
//             strip, and see how small a repeated HEADERS frame is (HPACK).
// Control:    play, the scrub bar and the jump buttons (the clock).
// Conclusion: HTTP/2 cuts a connection into frames with a 9-byte header that names the stream, so any number of requests can be in flight together; a repeated request costs 8 bytes of headers instead of 17.
//
// The frame types, stream ids and lengths are the real ones captured in exercises/12_http.py (http.json). The server's DATA frames are 1000 bytes each because that is the body we served.

const D = 16;
const X0 = 16, W = 800;
const COLORS = ['nw-l3', 'nw-l4', 'nw-app', 'nw-l2', 'nw-tls', 'nw-l3'];
const STREAMS = [1, 3, 5, 7, 9, 11];
const cls = (sid: number) => (sid === 0 ? 'nw-cell' : COLORS[STREAMS.indexOf(sid)]);
type Fr = [string, number, number];
const client = data.frames.client as Fr[];
const server = data.frames.server as Fr[];

type T = { title: string; caption: string; c2s: string; s2c: string; stream: string; bytes: string; marks: Mark[]; none: string; small: string };
const TEXT: Record<Lang, T> = {
  th: {
    title: 'กดเล่นแล้วดูเฟรมของ HTTP/2 ที่จับได้จริง แต่ละแถวคือหนึ่ง Stream ที่ใช้ร่วมกันบน Connection เดียว',
    caption: 'ชนิด เลข Stream และขนาดของทุกเฟรมเป็นผลจริงที่จับได้ในแบบฝึก 12 (DATA ละ 1000 ไบต์เพราะเป็นขนาดข้อมูลที่เราให้ Server ส่ง) แท่งมีสองความกว้าง คือเฟรมเล็กกับเฟรม DATA ขนาดจริงอ่านจากตัวเลขในแท่ง',
    c2s: 'Client → Server', s2c: 'Server → Client', stream: 'Stream', bytes: 'ไบต์', none: 'ไม่มี Stream (ทั้ง Connection)', small: 'เล็ก',
    marks: [
      { at: 0.5, name: 'Preface', title: 'เริ่มด้วย Preface และ SETTINGS', text: 'Client ส่งสตริง PRI * HTTP/2.0 ยาว 24 ไบต์ แล้ว SETTINGS (ตั้งค่าของฝั่งตัวเอง) และ WINDOW_UPDATE (เปิดที่ว่างรับข้อมูล) เฟรมพวกนี้เป็นเรื่องของทั้ง Connection จึงไม่มี Stream และเป็นสีเทา' },
      { at: 3, name: 'หกคำขอ', title: 'หกคำขอเป็นหกเฟรม HEADERS บน Stream 1, 3, 5, 7, 9, 11', text: 'Client ใช้เลขคี่ ทุกอันจบด้วย END_STREAM เพราะ GET ไม่มีเนื้อหา สังเกตว่าอันแรกยาว 17 ไบต์ แต่อีกห้าอันยาวแค่ 8 ไบต์ เพราะ HPACK จำหัวข้อที่ซ้ำกันไว้ใน Table แล้วส่งเป็นดัชนีสั้น ๆ' },
      { at: 8, name: 'Response', title: 'Server ตอบบน Stream เดิม: HEADERS แล้ว DATA', text: 'Response แต่ละอันเป็นเฟรม HEADERS ตามด้วยเฟรม DATA ขนาด 1000 ไบต์ที่จบด้วย END_STREAM ทั้งหกอันอยู่ในสายไบต์เดียวกันของ TCP เฟรมของต่าง Stream มาปนกันได้ เพราะทุกเฟรมมี Header ยาว 9 ไบต์ที่บอกว่าเป็นของ Stream ไหน' },
    ],
  },
  en: {
    title: 'Press play and watch the real frames of HTTP/2. Each colour is one stream, all sharing one connection',
    caption: 'The type, stream number and size of every frame are the real results captured in exercise 12 (each DATA is 1000 bytes because that is the body we told the server to send). Blocks have two widths, small frames and DATA frames. The real size is the number inside the block.',
    c2s: 'Client → Server', s2c: 'Server → Client', stream: 'stream', bytes: 'bytes', none: 'no stream (the whole connection)', small: 'small',
    marks: [
      { at: 0.5, name: 'Preface', title: 'It starts with the preface and SETTINGS', text: 'The client sends the 24-byte string PRI * HTTP/2.0, then SETTINGS (its own settings) and WINDOW_UPDATE (opening room to receive data). These frames concern the whole connection, so they have no stream and are grey.' },
      { at: 3, name: 'Six requests', title: 'Six requests are six HEADERS frames on streams 1, 3, 5, 7, 9, 11', text: 'The client uses odd numbers, and each ends with END_STREAM because a GET has no body. Note that the first is 17 bytes but the other five are only 8, because HPACK remembers the repeated headers in a table and sends short indexes.' },
      { at: 8, name: 'Responses', title: 'The server answers on the same streams: HEADERS, then DATA', text: 'Each response is a HEADERS frame followed by a 1000-byte DATA frame that ends with END_STREAM. All six are in one TCP byte stream. Frames of different streams can be mixed because each has a 9-byte header that says which stream it belongs to.' },
    ],
  },
};

const widthOf = (len: number, total: number) => Math.max(26, (len / total) * W);

export default function FramesLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const clock = useClock(D);
  const { t } = clock;
  let current = 0;
  T.marks.forEach((m, i) => { if (t >= m.at - 0.001) current = i; });

  const th = lang === 'th';
  const word = (kind: string, fromClient: boolean) => (kind === 'HEADERS' ? (fromClient ? (th ? 'ขอ' : 'ask') : (th ? 'หัว' : 'head')) : kind === 'DATA' ? (th ? 'ข้อมูล' : 'data') : kind === 'SETTINGS' ? (th ? 'ตั้งค่า' : 'set') : 'Window');
  const rowOf = (sid: number) => (sid === 0 ? 0 : STREAMS.indexOf(sid) + 1);
  const panel = (frames: Fr[], y0: number, label: string, t0: number, t1: number, fromClient: boolean) => {
    const cw = Math.min(64, (W + X0 - 150) / frames.length);
    return (
      <g>
        <text x={X0} y={y0 - 14} className="ib-t">{label}</text>
        {[0, 1, 2, 3, 4, 5, 6].map((r) => (
          <g key={r}>
            <text x={X0} y={y0 + r * 32 + 21} className="ib-n" style={{ fill: r === 0 ? 'var(--muted)' : 'var(--fg)' }}>{r === 0 ? (th ? 'ทั้ง Connection' : 'whole connection') : `${T.stream} ${STREAMS[r - 1]}`}</text>
            <path className="ib-line" d={`M${X0 + 124},${y0 + r * 32 + 28} L${X0 + W},${y0 + r * 32 + 28}`} style={{ opacity: 0.5 }} />
          </g>
        ))}
        {frames.map((f, i) => {
          const op = ease(t, t0 + (i / frames.length) * (t1 - t0), t0 + (i / frames.length) * (t1 - t0) + 0.5);
          const r = rowOf(f[1]);
          return (
            <g key={i} style={{ opacity: op }}>
              <rect className={cls(f[1])} x={X0 + 130 + i * cw} y={y0 + r * 32 + 1} width={cw - 3} height={27} rx={6} style={f[1] === 0 ? { fill: 'var(--surface-2)' } : undefined} />
              <text x={X0 + 130 + i * cw + (cw - 3) / 2} y={y0 + r * 32 + 20} textAnchor="middle" className="ib-m" style={{ fontSize: 14, fontWeight: 700, fill: f[1] === 0 ? 'var(--fg)' : 'var(--on-key)' }}>{word(f[0], fromClient)}</text>
            </g>
          );
        })}
      </g>
    );
  };

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend layers={[]} lang={lang} extra={[{ cls: 'l3', text: `${T.stream} 1, 3, 5, 7, 9, 11` }, { cls: 'same', text: T.none }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 620" role="img" aria-label={T.title}>
          {panel(client, 50, T.c2s, 0.3, 7, true)}
          {panel(server, 310, T.s2c, 7.5, 14, false)}
          <Banner y={566} text={T.marks[current].title} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
