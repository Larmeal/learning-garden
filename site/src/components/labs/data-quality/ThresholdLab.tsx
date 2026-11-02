import { useState, type ReactElement } from 'react';
import raw from './monitoring.json';
import {
  evaluate, evaluateFreshness, evaluationDays, freshnessFlags, loadedDays, naiveVolumeFlags, nullFixedFlags, nullRollingFlags,
  nullSpcFlags, weekdayVolumeFlags, type MonitorData, type Score,
} from './monitorMath';
import type { Lang } from '../../../i18n';

const data = raw as unknown as MonitorData;

const TEXT = {
  th: {
    chartLabel: 'กราฟรายวัน 120 วัน จุดสีคือวันที่ detector แจ้งเตือน',
    calibration: 'ช่วงปรับเทียบ (28 วันแรก)',
    day: 'วัน',
    title: 'ขยับเกณฑ์แล้วดูว่าแจ้งเตือนผิดกับพลาดเหตุจริงอย่างไร',
    watching: 'สิ่งที่เฝ้าดู',
    fresh: 'freshness',
    volume: 'volume (จำนวน row)',
    nullRate: 'null rate',
    detector: 'detector',
    volumeGroup: 'detector ของ volume',
    nullGroup: 'detector ของ null',
    naive: 'z-score ธรรมดา',
    weekday: 'เทียบวันเดียวกัน',
    fixed: 'เกณฑ์คงที่',
    spc: 'control limit (SPC)',
    rolling: 'กระโดดจากค่ากลาง',
    weight: 'ให้น้ำหนัก',
    weightGroup: 'น้ำหนักของ F-score',
    f1: 'F1 (เท่ากัน)',
    f2: 'F2 (recall สำคัญกว่า)',
    minDays: 'จำนวนวันขั้นต่ำ',
    nullThreshold: 'threshold ของ null',
    sigmas: 'จำนวน σ',
    jumpOver: 'กระโดดเกิน',
    points: 'จุด',
    minRatio: 'สัดส่วนต่ำสุด',
    freshNote: (d: number) => `แจ้งเตือนเมื่อไม่มีการโหลดติดกันตั้งแต่ ${d} วันขึ้นไป ช่วงที่ไม่มีการโหลดมี 6 ช่วง: 3 ช่วงเป็นเหตุจริง (2, 3, 4 วัน) และ 3 ช่วงเป็นการหยุดตามแผน (1, 1, 2 วัน)`,
    naiveNote: (k: string) => `แจ้งเตือนเมื่อ z-score ต่ำกว่า -${k} โดยใช้ค่าเฉลี่ยและส่วนเบี่ยงเบนมาตรฐานเดียวสำหรับทุกวัน`,
    weekdayNote: (p: string) => `แจ้งเตือนเมื่อจำนวน row ต่ำกว่า ${p}% ของ median ของวันเดียวกันในสัปดาห์ย้อนหลังสูงสุด 4 สัปดาห์`,
    fixedNote: (p: string) => `แจ้งเตือนเมื่อสัดส่วน null สูงกว่า ${p}%`,
    spcNote: (n: number) => `แจ้งเตือนเมื่อสูงกว่าค่าเฉลี่ย + ${n} × ส่วนเบี่ยงเบนมาตรฐานของ 28 วันแรก (control limit แบบ SPC)`,
    rollingNote: (p: string) => `แจ้งเตือนเมื่อสัดส่วน null สูงกว่า median 14 วันก่อนหน้าเกิน ${p} จุดเปอร์เซ็นต์`,
    tp: 'แจ้งเตือนถูก (TP)',
    fp: 'แจ้งเตือนผิด (FP)',
    fn: 'พลาดเหตุจริง (FN)',
    legend: ['จุดสีเข้ม = แจ้งเตือนถูก, จุดสีแดง = แจ้งเตือนผิด, วงสีส้ม = เหตุจริงที่พลาด, ขีดดำใต้กราฟ = วันที่มีเหตุจริง ข้อมูลเป็นชุดสังเคราะห์จาก ', ' ที่รู้คำตอบ จึงให้คะแนนได้ ข้อมูลจริงไม่มีป้ายคำตอบแบบนี้ และผลของ detector ที่ดูเกือบสมบูรณ์ในที่นี้ไม่ควรถูกคาดหวังกับข้อมูลจริง'],
  },
  en: {
    chartLabel: 'Daily chart over 120 days. Colored dots are the days the detector raised an alert',
    calibration: 'Calibration window (first 28 days)',
    day: 'Day',
    title: 'Move the threshold and see how it trades false alerts against missed incidents',
    watching: 'What to watch',
    fresh: 'Freshness',
    volume: 'Volume (row count)',
    nullRate: 'Null rate',
    detector: 'Detector',
    volumeGroup: 'Volume detector',
    nullGroup: 'Null detector',
    naive: 'Plain z-score',
    weekday: 'Same weekday',
    fixed: 'Fixed threshold',
    spc: 'Control limit (SPC)',
    rolling: 'Jump from the median',
    weight: 'Weighting',
    weightGroup: 'F-score weighting',
    f1: 'F1 (equal weight)',
    f2: 'F2 (recall counts more)',
    minDays: 'Minimum days',
    nullThreshold: 'Null threshold',
    sigmas: 'Number of σ',
    jumpOver: 'Jump over',
    points: 'points',
    minRatio: 'Minimum ratio',
    freshNote: (d: number) => `Alerts when nothing has loaded for ${d} or more days in a row. There are 6 stretches with no load: 3 are real incidents (2, 3 and 4 days) and 3 are planned pauses (1, 1 and 2 days).`,
    naiveNote: (k: string) => `Alerts when the z-score is below -${k}, using one mean and one standard deviation for every day.`,
    weekdayNote: (p: string) => `Alerts when the row count is below ${p}% of the median of the same weekday over up to the previous 4 weeks.`,
    fixedNote: (p: string) => `Alerts when the null share is above ${p}%.`,
    spcNote: (n: number) => `Alerts when the value is above the mean + ${n} × the standard deviation of the first 28 days (an SPC control limit).`,
    rollingNote: (p: string) => `Alerts when the null share is more than ${p} percentage points above the median of the previous 14 days.`,
    tp: 'Correct alerts (TP)',
    fp: 'False alerts (FP)',
    fn: 'Missed incidents (FN)',
    legend: ['Dark dot = correct alert, red dot = false alert, orange ring = missed incident, black tick under the chart = a day with a real incident. The data is a synthetic series from ', ' whose answers are known, which is why it can be scored. Real data has no such labels, and a detector that looks almost perfect here should not be expected to do as well on real data.'],
  },
} as const;
type Tab = 'fresh' | 'volume' | 'null';

const W = 720;
const H = 176;
const PAD = { l: 8, r: 8, t: 10, b: 24 };
const x = (i: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / (data.days - 1);
const bar = (i: number) => (W - PAD.l - PAD.r) / (data.days - 1);

const GOOD = 'var(--accent, #4338CA)';
const BAD = '#DC2626';
const MISS = '#D97706';

function Chart({ values, yMax, flags, truth, eligible, bands, lang }: {
  lang: Lang;
  values: number[]; yMax: number; flags: Set<number>; truth: Set<number>; eligible: Set<number>;
  bands?: { start: number; length: number; fill: string; stroke: string }[];
}) {
  const t = TEXT[lang];
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - Math.min(v, yMax) / yMax);
  const path = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t.chartLabel} style={{ width: '100%', height: 'auto' }}>
      <rect x={x(0)} y={PAD.t} width={x(data.calibrationDays - 1) - x(0)} height={H - PAD.t - PAD.b} fill="var(--surface-2, #eee)" />
      <text x={x(0) + 4} y={PAD.t + 12} fontSize="11" fill="var(--muted, #666)">{t.calibration}</text>
      {bands?.map((b, n) => (
        <rect key={n} x={x(b.start) - bar(0) / 2} y={PAD.t} width={b.length * bar(0)} height={H - PAD.t - PAD.b} fill={b.fill} stroke={b.stroke} strokeWidth="1.5" />
      ))}
      <path d={path} fill="none" stroke="var(--muted, #666)" strokeWidth="1.4" />
      {[...truth].map((i) => (
        <line key={`t${i}`} x1={x(i)} x2={x(i)} y1={H - PAD.b + 4} y2={H - PAD.b + 14} stroke="var(--fg, #111)" strokeWidth="2" />
      ))}
      {[...truth].filter((i) => eligible.has(i) && !flags.has(i)).map((i) => (
        <circle key={`m${i}`} cx={x(i)} cy={y(values[i])} r="6" fill="none" stroke={MISS} strokeWidth="2" />
      ))}
      {[...flags].map((i) => (
        <circle key={`f${i}`} cx={x(i)} cy={y(values[i])} r="4.5" fill={truth.has(i) ? GOOD : BAD} />
      ))}
      <text x={PAD.l} y={H - 4} fontSize="11" fill="var(--muted, #666)">{t.day} 0</text>
      <text x={W - PAD.r} y={H - 4} fontSize="11" textAnchor="end" fill="var(--muted, #666)">{t.day} {data.days - 1}</text>
    </svg>
  );
}

function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <label className="range">
      <span className="lab-label" style={{ margin: 0 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <b style={{ fontFamily: 'var(--mono)' }}>{fmt ? fmt(value) : value}</b>
    </label>
  );
}

export default function ThresholdLab({ lang = 'th' }: { lang?: Lang }) {
  const t = TEXT[lang];
  const [tab, setTab] = useState<Tab>('volume');
  const [minDays, setMinDays] = useState(2);
  const [vol, setVol] = useState<'naive' | 'weekday'>('naive');
  const [k, setK] = useState(2);
  const [ratio, setRatio] = useState(0.7);
  const [nul, setNul] = useState<'fixed' | 'spc' | 'rolling'>('fixed');
  const [fixed, setFixed] = useState(0.9);
  const [sigmas, setSigmas] = useState(3);
  const [jump, setJump] = useState(0.1);
  const [beta, setBeta] = useState<1 | 2>(1);

  const loaded = loadedDays(data);
  const all = evaluationDays(data);
  let score: Score;
  let chart: ReactElement;
  let note = '';

  if (tab === 'fresh') {
    score = evaluateFreshness(data, minDays);
    const flagged = freshnessFlags(data, minDays);
    const bands = data.gaps.map((g, i) => {
      const f = flagged.has(i);
      if (f && g.incident) return { start: g.start, length: g.length, fill: 'rgba(67,56,202,.25)', stroke: GOOD };
      if (f) return { start: g.start, length: g.length, fill: 'rgba(220,38,38,.25)', stroke: BAD };
      if (g.incident) return { start: g.start, length: g.length, fill: 'rgba(217,119,6,.2)', stroke: MISS };
      return { start: g.start, length: g.length, fill: 'rgba(120,120,120,.15)', stroke: 'transparent' };
    });
    chart = <Chart lang={lang} values={data.rows} yMax={1200} flags={new Set()} truth={new Set()} eligible={new Set()} bands={bands} />;
    note = t.freshNote(minDays);
  } else if (tab === 'volume') {
    const flags = vol === 'naive' ? naiveVolumeFlags(data, k) : weekdayVolumeFlags(data, ratio);
    score = evaluate(flags, data.volumeIncidentDays, loaded);
    chart = <Chart lang={lang} values={data.rows} yMax={1200} flags={flags} truth={new Set(data.volumeIncidentDays)} eligible={loaded} />;
    note = vol === 'naive'
      ? t.naiveNote(k.toFixed(1))
      : t.weekdayNote((ratio * 100).toFixed(0));
  } else {
    const flags = nul === 'fixed' ? nullFixedFlags(data, fixed) : nul === 'spc' ? nullSpcFlags(data, sigmas) : nullRollingFlags(data, jump);
    score = evaluate(flags, data.nullIncidentDays, all);
    chart = <Chart lang={lang} values={data.nullRate} yMax={0.7} flags={flags} truth={new Set(data.nullIncidentDays)} eligible={all} />;
    note = nul === 'fixed'
      ? t.fixedNote((fixed * 100).toFixed(0))
      : nul === 'spc'
        ? t.spcNote(sigmas)
        : t.rollingNote((jump * 100).toFixed(0));
  }

  const f = beta === 1 ? score.f1 : score.f2;

  return (
    <figure className="viz">
      <div className="viz-title">{t.title}</div>
      <div className="lab-controls">
        <div>
          <div className="lab-label">{t.watching}</div>
          <div className="seg" role="group" aria-label={t.watching}>
            <button type="button" aria-pressed={tab === 'fresh'} onClick={() => setTab('fresh')}>{t.fresh}</button>
            <button type="button" aria-pressed={tab === 'volume'} onClick={() => setTab('volume')}>{t.volume}</button>
            <button type="button" aria-pressed={tab === 'null'} onClick={() => setTab('null')}>{t.nullRate}</button>
          </div>
        </div>
        {tab === 'volume' && (
          <div>
            <div className="lab-label">{t.detector}</div>
            <div className="seg" role="group" aria-label={t.volumeGroup}>
              <button type="button" aria-pressed={vol === 'naive'} onClick={() => setVol('naive')}>{t.naive}</button>
              <button type="button" aria-pressed={vol === 'weekday'} onClick={() => setVol('weekday')}>{t.weekday}</button>
            </div>
          </div>
        )}
        {tab === 'null' && (
          <div>
            <div className="lab-label">{t.detector}</div>
            <div className="seg" role="group" aria-label={t.nullGroup}>
              <button type="button" aria-pressed={nul === 'fixed'} onClick={() => setNul('fixed')}>{t.fixed}</button>
              <button type="button" aria-pressed={nul === 'spc'} onClick={() => setNul('spc')}>{t.spc}</button>
              <button type="button" aria-pressed={nul === 'rolling'} onClick={() => setNul('rolling')}>{t.rolling}</button>
            </div>
          </div>
        )}
        <div>
          <div className="lab-label">{t.weight}</div>
          <div className="seg" role="group" aria-label={t.weightGroup}>
            <button type="button" aria-pressed={beta === 1} onClick={() => setBeta(1)}>{t.f1}</button>
            <button type="button" aria-pressed={beta === 2} onClick={() => setBeta(2)}>{t.f2}</button>
          </div>
        </div>
      </div>

      {tab === 'fresh' && <Slider label={t.minDays} value={minDays} min={1} max={5} step={1} onChange={setMinDays} />}
      {tab === 'volume' && vol === 'naive' && <Slider label="k (z < -k)" value={k} min={0.5} max={3} step={0.5} onChange={setK} fmt={(v) => v.toFixed(1)} />}
      {tab === 'volume' && vol === 'weekday' && <Slider label={t.minRatio} value={ratio} min={0.3} max={0.9} step={0.1} onChange={setRatio} fmt={(v) => `${(v * 100).toFixed(0)}%`} />}
      {tab === 'null' && nul === 'fixed' && <Slider label={t.nullThreshold} value={fixed} min={0.08} max={0.9} step={0.01} onChange={setFixed} fmt={(v) => `${(v * 100).toFixed(0)}%`} />}
      {tab === 'null' && nul === 'spc' && <Slider label={t.sigmas} value={sigmas} min={1} max={4} step={1} onChange={setSigmas} />}
      {tab === 'null' && nul === 'rolling' && <Slider label={t.jumpOver} value={jump} min={0.02} max={0.3} step={0.01} onChange={setJump} fmt={(v) => `${(v * 100).toFixed(0)} ${t.points}`} />}

      <div className="viz-box">{chart}</div>
      <p className="viz-caption">{note}</p>

      <div className="readout" aria-live="polite">
        <span>{t.tp} <b>{score.tp}</b></span>
        <span>{t.fp} <b>{score.fp}</b></span>
        <span>{t.fn} <b>{score.fn}</b></span>
        <span>precision <b>{score.precision.toFixed(2)}</b></span>
        <span>recall <b>{score.recall.toFixed(2)}</b></span>
        <span>F{beta} <b>{f.toFixed(2)}</b></span>
      </div>

      <p className="viz-caption">
        {t.legend[0]}<code>07_monitoring.py</code>{t.legend[1]}
      </p>
    </figure>
  );
}
