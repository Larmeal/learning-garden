import { useState } from 'react';
import type { Lang } from '../../../i18n';

type Scenario = 'good' | 'bad' | 'empty' | 'broken' | 'late';
type Policy = 'ignore' | 'gate' | 'gate-rows';

const SCENARIOS: Record<Lang, { id: Scenario; label: string; note: string }[]> = {
  th: [
    { id: 'good', label: 'ข้อมูลดี', note: 'ทุก expectation ผ่าน' },
    { id: 'bad', label: 'ข้อมูลเสีย', note: 'มีค่านอกช่วงและ null' },
    { id: 'empty', label: 'ตารางว่าง', note: 'upstream ส่งไฟล์ว่างมา' },
    { id: 'broken', label: 'expectation พัง', note: 'คอลัมน์ที่อ้างถึงหายไป' },
    { id: 'late', label: 'action ล้ม', note: 'ข้อมูลเสีย แต่ Slack webhook ใช้ไม่ได้' },
  ],
  en: [
    { id: 'good', label: 'Good data', note: 'Every expectation passes' },
    { id: 'bad', label: 'Bad data', note: 'There are out-of-range values and nulls' },
    { id: 'empty', label: 'Empty table', note: 'Upstream sent an empty file' },
    { id: 'broken', label: 'Broken expectation', note: 'The column it refers to is missing' },
    { id: 'late', label: 'Action fails', note: 'The data is bad, but the Slack webhook does not work' },
  ],
};

const POLICIES: Record<Lang, { id: Policy; label: string; code: string }[]> = {
  th: [
    { id: 'ignore', label: 'เรียกแล้วไม่เช็กผล', code: 'checkpoint.run(...)\npublish()' },
    { id: 'gate', label: 'หยุดเมื่อ success เป็น False', code: 'result = checkpoint.run(...)\nif not result.success:\n    raise ...\npublish()' },
    { id: 'gate-rows', label: 'หยุด + มี expectation จำนวนแถว', code: '# suite มี ExpectTableRowCountToBeBetween(min_value=1)\nresult = checkpoint.run(...)\nif not result.success:\n    raise ...\npublish()' },
  ],
  en: [
    { id: 'ignore', label: 'Call it, ignore the result', code: 'checkpoint.run(...)\npublish()' },
    { id: 'gate', label: 'Stop when success is False', code: 'result = checkpoint.run(...)\nif not result.success:\n    raise ...\npublish()' },
    { id: 'gate-rows', label: 'Stop + a row count expectation', code: '# the suite has ExpectTableRowCountToBeBetween(min_value=1)\nresult = checkpoint.run(...)\nif not result.success:\n    raise ...\npublish()' },
  ],
};

const TEXT: Record<Lang, {
  title: string;
  scenario: string;
  code: string;
  staging: string;
  lateHead: string;
  lateText: string;
  alwaysHead: string;
  goodText: string;
  badText: string;
  stopHead: string;
  brokenText: string;
  emptyStopText: string;
  failText: string;
  emptyPubHead: string;
  emptyPubText: string;
  publish: string;
  allPass: string;
}> = {
  th: {
    title: 'pipeline ที่เรียก checkpoint: จะเกิดอะไรกับข้อมูลที่ตามมา',
    scenario: 'สถานการณ์',
    code: 'โค้ดใน pipeline',
    staging: 'โหลดเข้า staging',
    lateHead: 'งานล้มด้วย exception จาก action',
    lateText: 'Checkpoint.run() raise ก่อนจะถึงบรรทัดถัดไป จึงไม่มี publish ผลการตรวจถูกเก็บไว้แล้ว และถ้าเขียน gate ไว้ก็ไม่ได้ใช้ เพราะไม่มีโอกาสอ่าน result ลองดักด้วย try/except ถ้าต้องการแยก "ข้อมูลเสีย" ออกจาก "แจ้งเตือนล้ม"',
    alwaysHead: 'publish ทุกครั้ง',
    goodText: 'ข้อมูลดี จึงไม่มีผลเสีย',
    badText: 'Checkpoint.run() ไม่ raise เมื่อข้อมูลไม่ผ่าน pipeline จึงเดินต่อและ publish ข้อมูลที่เสียออกไป',
    stopHead: 'หยุดก่อน publish',
    brokenText: 'หยุดถูก แต่สาเหตุคือ expectation พัง (ดู exception_info ของผล) ไม่ใช่ข้อมูลเสีย ควรแยกสองกรณีนี้ในข้อความเตือน',
    emptyStopText: 'ตารางว่างล้มเพราะ suite มี expectation จำนวนแถว',
    failText: 'result.success เป็น False จึงหยุด',
    emptyPubHead: 'publish ตารางว่าง',
    emptyPubText: 'expectation แบบ column map ผ่านโดยปริยายเมื่อไม่มีแถว result.success เป็น True ทั้งที่ไม่มีข้อมูลเลย ต้องมี expectation จำนวนแถว',
    publish: 'publish',
    allPass: 'ทุกข้อผ่าน',
  },
  en: {
    title: 'A pipeline that calls a checkpoint: what happens to the data that follows',
    scenario: 'Scenario',
    code: 'Code in the pipeline',
    staging: 'Load into staging',
    lateHead: 'The job fails with an exception from an action',
    lateText: 'Checkpoint.run() raises before the next line, so there is no publish. The validation result is already saved. A gate, if you wrote one, is never used, because there is no chance to read result. Catch the exception with try/except if you need to tell "bad data" apart from "the alert failed".',
    alwaysHead: 'Publishes every time',
    goodText: 'The data is good, so nothing goes wrong.',
    badText: 'Checkpoint.run() does not raise when the data fails. The pipeline keeps going and publishes the bad data.',
    stopHead: 'Stops before publish',
    brokenText: 'It stops correctly, but the cause is a broken expectation (see exception_info of the result), not bad data. Tell these two cases apart in the alert message.',
    emptyStopText: 'The empty table fails because the suite has a row count expectation.',
    failText: 'result.success is False, so it stops.',
    emptyPubHead: 'Publishes an empty table',
    emptyPubText: 'A column map expectation passes by default when there are no rows. result.success is True even though there is no data at all. You need a row count expectation.',
    publish: 'publish',
    allPass: 'Every expectation passed.',
  },
};

interface Out {
  published: boolean;
  headline: string;
  text: string;
  bad: boolean;
}

function simulate(s: Scenario, p: Policy, t: (typeof TEXT)[Lang]): Out {
  const gated = p !== 'ignore';
  // Whether the suite itself reports failure for the scenario (verified: an empty table passes unless a row-count expectation exists).
  const reportsFail = s === 'bad' || s === 'broken' || s === 'late' || (s === 'empty' && p === 'gate-rows');
  if (s === 'late') {
    return {
      published: false,
      bad: true,
      headline: t.lateHead,
      text: t.lateText,
    };
  }
  if (!gated) {
    return {
      published: true,
      bad: s !== 'good',
      headline: t.alwaysHead,
      text: s === 'good' ? t.goodText : t.badText,
    };
  }
  if (reportsFail) {
    return {
      published: false,
      bad: false,
      headline: t.stopHead,
      text:
        s === 'broken'
          ? t.brokenText
          : s === 'empty'
            ? t.emptyStopText
            : t.failText,
    };
  }
  if (s === 'empty') {
    return {
      published: true,
      bad: true,
      headline: t.emptyPubHead,
      text: t.emptyPubText,
    };
  }
  return { published: true, bad: false, headline: t.publish, text: t.allPass };
}

export default function PipelineGate({ lang = 'th' }: { lang?: Lang }) {
  const [s, setS] = useState<Scenario>('empty');
  const [p, setP] = useState<Policy>('gate');
  const t = TEXT[lang];
  const scenarios = SCENARIOS[lang];
  const policies = POLICIES[lang];
  const out = simulate(s, p, t);
  const pol = policies.find((x) => x.id === p)!;

  return (
    <figure className="viz">
      <div className="viz-title">{t.title}</div>
      <div className="lab-controls">
        <div>
          <div className="lab-label">{t.scenario}</div>
          <div className="seg" role="group" aria-label={t.scenario}>
            {scenarios.map((x) => (
              <button key={x.id} type="button" aria-pressed={s === x.id} onClick={() => setS(x.id)}>{x.label}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="lab-label">{t.code}</div>
          <div className="seg" role="group" aria-label={t.code}>
            {policies.map((x) => (
              <button key={x.id} type="button" aria-pressed={p === x.id} onClick={() => setP(x.id)}>{x.label}</button>
            ))}
          </div>
        </div>
      </div>

      <pre className="codeline">{pol.code}</pre>

      <div className="gx-pipe" aria-hidden="true">
        <span data-on>{t.staging}</span>
        <i />
        <span data-on>checkpoint</span>
        <i />
        <span data-on={out.published} data-bad={out.published && out.bad ? true : undefined}>publish</span>
      </div>

      <div className="viz-now" aria-live="polite" data-bad={out.bad || undefined}>
        <strong>{out.headline}</strong>
        <span>{scenarios.find((x) => x.id === s)!.note}. {out.text}</span>
      </div>
    </figure>
  );
}
