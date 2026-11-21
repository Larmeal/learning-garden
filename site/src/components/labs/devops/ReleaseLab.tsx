import { useState } from 'react';
import { ClockControls, useClock, prog, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Seg, Tile, type Lang } from './dv';
import data from './release.json';

// Shows:      400 requests arriving one after another, drawn as two strips: which version answered each one (grey = old, accent = new) and whether it worked (green = yes, orange = failed).
//             The new version is released at request 100 and a judge looks at it at request 200, then rolls it back. The strategy decides WHICH requests go to the new version.
// Because:    "how many users does a bad release hurt" is a count of orange marks inside one block of the timeline. Five strategies side by side as numbers would not show that the whole damage is the width of the accent block times the failure rate.
// Control:    the strategy (all at once, blue-green, rolling, canary, feature flag); play, scrub and jump buttons.
// Conclusion: the damage of a bad release is (how many requests reach the new version) x (how long until it is rolled back). Blue-green gives a fast rollback but the same exposure; rolling, canary and a flag reduce the exposure.
//
// Every mark of both strips comes from exercises/05_release_strategies.py (release.json): 400 requests, a bug that fails the 25 percent of requests that use a feature, release at request 100, judge at request 200.

type Strat = 'all-at-once' | 'blue-green' | 'rolling' | 'canary' | 'flag';
const N = data.n, REL = data.deployAt, JUDGE = data.judgeAt;
const STR = data.strategies as Record<Strat, { versions: string; failed: string; onV2: number; failures: number }>;
const D = 10;

const TEXT: Record<Lang, { title: string; caption: string; strat: string; strats: Record<Strat, string>; v1: string; v2: string; served: string; failed: string; row1: string; row2: string; at: string; release: string; judge: string; how: Record<Strat, [string, string]>; marks: (s: Strat) => Mark[]; total: string }> = {
  th: {
    title: 'เลือกวิธี Release แล้วกดเล่น ดูว่าคำขอ 400 ตัวไปถึงเวอร์ชันใหม่กี่ตัว และมีกี่ตัวที่พัง',
    caption: 'ทุกขีดในสองแถวมาจากการรันจริงของแบบฝึก 05 (release.json): Server สองตัวคือเวอร์ชัน 1 กับเวอร์ชัน 2 ที่มีบั๊กทำให้คำขอที่ใช้ Feature (ประมาณหนึ่งในสี่) ล้มเหลว Release ที่คำขอที่ 100 ผู้ตัดสินดูที่คำขอที่ 200 (หน้าต่าง 100 คำขอและเกณฑ์ 10% เป็นข้อสมมติของแบบฝึก)',
    strat: 'วิธี Release', strats: { 'all-at-once': 'ทีเดียวทั้งหมด', 'blue-green': 'Blue-green', rolling: 'Rolling', canary: 'Canary 10%', flag: 'Feature Flag 10%' },
    v1: 'เวอร์ชัน 1', v2: 'เวอร์ชัน 2 (มีบั๊ก)', served: 'ตอบแล้ว', failed: 'พัง', row1: 'ใครตอบ', row2: 'ผลลัพธ์', at: 'คำขอที่', release: 'Release', judge: 'ตัดสิน', total: 'คำขอที่พังทั้งหมด',
    how: {
      'all-at-once': ['ทุกคำขอไปเวอร์ชันใหม่ทันที', 'Deploy เวอร์ชัน 1 กลับลงไปใหม่ (หลักนาที)'],
      'blue-green': ['สวิตช์ชี้ไปเวอร์ชันใหม่ทั้งหมดในครั้งเดียว ตัวเก่ายังเปิดอยู่', 'สลับตัวชี้กลับ (หลักวินาที) แต่ต้องมี Server สองชุด'],
      rolling: ['เปลี่ยนทีละ Instance ทุก 25 คำขอ (มีทั้งหมดสี่ตัว)', 'ย้อน Instance ที่เปลี่ยนไปแล้วกลับทีละตัว'],
      canary: ['ส่งเวอร์ชันใหม่ให้ราว 10% ของคำขอ', 'ตั้งสัดส่วนเป็น 0% (ตั้งค่าเดียว)'],
      flag: ['เวอร์ชันใหม่อยู่ทุกที่แล้ว แต่ Flag เปิดให้ 10% ของคำขอ', 'ปิด Flag (ไม่ต้อง Deploy เลย)'],
    },
    marks: (s) => [
      { at: 0, name: 'ก่อน Release', title: 'ทุกคำขอไปเวอร์ชัน 1 และสำเร็จหมด', text: 'ก่อนคำขอที่ 100 ทุกอย่างปกติ สองแถวเป็นสีเทากับสีเขียว' },
      { at: 2.5, name: 'Release', title: TEXT.th.how[s][0], text: 'ตั้งแต่คำขอที่ 100 เวอร์ชัน 2 เริ่มรับคำขอ บั๊กไม่ปรากฏกับคำขอทั่วไป (Smoke Test ผ่าน) แต่ล้มเฉพาะคำขอที่ใช้ Feature ซึ่งเป็นสัดส่วนหนึ่งในสี่' },
      { at: 5, name: 'ผู้ตัดสิน', title: 'ที่คำขอที่ 200 ผู้ตัดสินเห็นอัตรา Error ของเวอร์ชันใหม่เกิน 10%', text: 'ผู้ตัดสินดูเฉพาะคำขอที่ไปถึงเวอร์ชันใหม่ ถ้าตัวอย่างน้อยเกินไป (เช่น Canary ที่ได้มาแค่สิบกว่าคำขอ) ตัวเลขจะสั่นง่าย' },
      { at: 5.4, name: 'Rollback', title: 'Rollback: ' + TEXT.th.how[s][1], text: 'หลังคำขอที่ 200 ทุกคำขอกลับไปเวอร์ชัน 1 และสำเร็จหมดอีกครั้ง' },
      { at: 10, name: 'จบ', title: 'ความเสียหายคือจำนวนคำขอที่ไปถึงเวอร์ชันใหม่คูณระยะเวลาที่มันอยู่', text: 'เปรียบสี่วิธีที่เหลือกับ Blue-green ดู: ความเร็วของ Rollback ต่างกันมาก แต่จำนวนคำขอที่พังขึ้นกับว่าเวอร์ชันใหม่รับคำขอไปกี่ส่วนเท่านั้น' },
    ],
  },
  en: {
    title: 'Choose a release strategy and press play, and see how many of the 400 requests reach the new version, and how many break',
    caption: 'Every mark in the two rows is from a real run of exercise 05 (release.json): two servers, version 1 and a version 2 with a bug that fails the requests that use a feature (about one in four). Released at request 100, judged at request 200 (the window of 100 requests and the 10% threshold are assumptions of the exercise).',
    strat: 'strategy', strats: { 'all-at-once': 'all at once', 'blue-green': 'blue-green', rolling: 'rolling', canary: 'canary 10%', flag: 'feature flag 10%' },
    v1: 'version 1', v2: 'version 2 (has a bug)', served: 'answered', failed: 'failed', row1: 'who answered', row2: 'result', at: 'request', release: 'release', judge: 'judge', total: 'requests that failed',
    how: {
      'all-at-once': ['every request goes to the new version at once', 'deploy version 1 again (a rollout, minutes)'],
      'blue-green': ['the switch points at the whole new version in one go, the old one is still up', 'switch the pointer back (seconds), but you need two sets of servers'],
      rolling: ['replace one machine every 25 requests (four in all)', 'roll the replaced machines back one by one'],
      canary: ['send the new version about 10% of the requests', 'set the share to 0% (one setting)'],
      flag: ['the new version is everywhere, but the flag is on for 10% of requests', 'turn the flag off (no deploy at all)'],
    },
    marks: (s) => [
      { at: 0, name: 'Before', title: 'Every request goes to version 1 and succeeds', text: 'Before request 100 everything is normal. The two rows are grey and green.' },
      { at: 2.5, name: 'Release', title: TEXT.en.how[s][0], text: 'From request 100 version 2 starts to take requests. The bug does not show on ordinary requests (the smoke test passes) and breaks only the requests that use a feature, about one in four.' },
      { at: 5, name: 'Judge', title: 'At request 200 the judge sees the new version\'s error rate above 10%', text: 'The judge looks only at the requests that reached the new version. With a small sample (for example a canary that got a dozen requests) the number jumps around easily.' },
      { at: 5.4, name: 'Rollback', title: 'Rollback: ' + TEXT.en.how[s][1], text: 'After request 200 every request goes back to version 1 and succeeds again.' },
      { at: 10, name: 'End', title: 'The damage is the number of requests that reached the new version times how long it stayed', text: 'Compare the other four with blue-green: the speed of rollback differs a lot, but the number of failed requests depends only on what share of the requests the new version took.' },
    ],
  },
};

export default function ReleaseLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [s, setS] = useState<Strat>('canary');
  const clock = useClock(D);
  const shown = Math.floor(prog(clock.t, 0, D) * N);
  const d = STR[s];
  let served2 = 0, failed = 0, served1 = 0;
  for (let i = 0; i < shown; i++) { if (d.versions[i] === '2') served2++; else served1++; if (d.failed[i] === '1') failed++; }
  const marks = T.marks(s);
  let cur = 0;
  marks.forEach((m, i) => { if (clock.t >= m.at - 0.001) cur = i; });
  const X0 = 20, W = 840 / N;
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <div className="ib-legend" aria-label="legend">
        <span><i style={{ background: 'var(--line-strong)', borderColor: 'var(--line-strong)' }} />{T.v1}</span>
        <span><i style={{ background: 'var(--accent)', borderColor: 'var(--accent)' }} />{T.v2}</span>
        <span><i style={{ background: 'var(--k2)', borderColor: 'var(--k2)' }} />OK</span>
        <span><i style={{ background: 'var(--ib-bad)', borderColor: 'var(--ib-bad)' }} />{T.failed}</span>
      </div>
      <Seg label={T.strat} options={(Object.keys(T.strats) as Strat[]).map((k) => ({ id: k, text: T.strats[k] }))} value={s} onChange={(v) => { setS(v); clock.restart(); }} />
      <div className="viz-box">
        <svg viewBox="0 0 880 420" role="img" aria-label={T.title}>
          <text x={X0} y={34} className="ib-n">{T.row1}</text>
          <text x={X0} y={118} className="ib-n">{T.row2}</text>
          {Array.from({ length: shown }, (_, i) => (
            <g key={i}>
              <rect x={X0 + i * W} y={42} width={Math.max(W - 0.3, 1)} height={46} style={{ fill: d.versions[i] === '2' ? 'var(--accent)' : 'var(--line-strong)' }} />
              <rect x={X0 + i * W} y={126} width={Math.max(W - 0.3, 1)} height={46} style={{ fill: d.failed[i] === '1' ? 'var(--ib-bad)' : 'var(--k2)' }} />
            </g>
          ))}
          <path d={`M${X0},42 h840 v46 h-840 z M${X0},126 h840 v46 h-840 z`} style={{ fill: 'none', stroke: 'var(--line-strong)', strokeWidth: 1.5 }} />
          {[REL, JUDGE].map((r, i) => (
            <g key={r}>
              <path d={`M${X0 + r * W},34 V182`} style={{ stroke: 'var(--ib-bad)', strokeWidth: 3, strokeDasharray: '6 4' }} />
              <text x={X0 + r * W + 6} y={202} className="ib-s">{(i === 0 ? T.release : T.judge)} · {T.at} {r}</text>
            </g>
          ))}
          <Tile x={X0} y={226} w={200} h={68} title={T.v1} sub={`${T.served} ${served1}`} state="plain" />
          <Tile x={X0 + 224} y={226} w={260} h={68} title={T.v2} sub={`${T.served} ${served2} · ${T.failed} ${failed}`} state={served2 > 0 ? (failed > 0 ? 'bad' : 'on') : 'skip'} />
          <Tile x={X0 + 508} y={226} w={332} h={68} title={T.total} sub={clock.t >= D ? `${d.failures} / ${N}` : `${failed} / ${N}`} state={failed > 0 ? 'bad' : 'ok'} big />
          <Banner y={318} text={marks[cur].title} />
          <text x={X0} y={394} className="ib-s">{T.how[s][0]}</text>
        </svg>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
