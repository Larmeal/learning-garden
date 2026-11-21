import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import data from './buildcache.json';

// Shows:      the steps of a Dockerfile as a chain. Pick the order of the lines (COPY . . before pip install, or requirements.txt first) and the file you edit
//             (nothing, app.py, requirements.txt). The step that reads the edited file breaks the chain, and every step after it runs again. The time of the real
//             build is shown as a bar.
// Because:    "the order of the lines decides how much is rebuilt" is about a chain: one broken link makes all the links after it new. A table of cached
//             flags does not show where the chain breaks, and why the install step sits after the broken link in one order and before it in the other.
// Control:    the order of the Dockerfile and the file that was edited.
// Conclusion: copy only what the expensive step needs, run it, and only then copy the rest, so a small edit does not break the chain before the expensive step.
//
// The cached flags and the seconds come from exercises/05_build_cache.py --write (buildcache.json); each combination is a real docker build.

type Order = 'bad' | 'good';
type Change = 'none' | 'app' | 'req';
const D = data.order;
const TOTAL = 4.2; // seconds: scale of the bar (the slowest build was 4.0 s)

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; order: string; orders: Record<Order, string>; change: string; changes: Record<Change, string>;
  reads: (step: string, order: Order, i: number) => string; reused: string; again: string; edited: string; secs: string; readout: (rerun: number, total: number, secs: number) => string; caption: string;
}> = {
  th: {
    title: 'เลือกลำดับบรรทัดใน Dockerfile กับไฟล์ที่แก้ แล้วดูว่าสายของ Cache ขาดตรงไหน และ Build ใช้เวลาเท่าไร',
    legend: [{ kind: 'use', text: 'ใช้ Cache เดิม' }, { kind: 'new', text: 'ต้องรันใหม่' }, { kind: 'skip', text: 'ยังไม่ถึงเหตุให้รันใหม่' }],
    order: 'ลำดับบรรทัด',
    orders: { bad: 'COPY . . ก่อน pip install', good: 'COPY requirements.txt ก่อน pip install' },
    change: 'ไฟล์ที่แก้',
    changes: { none: 'ไม่แก้อะไร', app: 'แก้ app.py', req: 'แก้ requirements.txt' },
    reads: (step, order, i) => {
      if (step.startsWith('WORKDIR')) return 'ไม่อ่านไฟล์ของเรา';
      if (step.startsWith('COPY .')) return 'อ่านทุกไฟล์ในโฟลเดอร์';
      if (step.startsWith('COPY requirements')) return 'อ่าน requirements.txt';
      if (step.startsWith('COPY app')) return 'อ่าน app.py';
      return order === 'bad' || i >= 0 ? 'รันต่อจาก Layer ก่อนหน้า' : '';
    },
    reused: 'ใช้ซ้ำ',
    again: 'รันใหม่',
    edited: 'แก้ไฟล์นี้',
    secs: 'วินาที',
    readout: (r, t, s) => (r === 0 ? `ไม่มีขั้นไหนต้องรันใหม่ Build ใช้เวลา ${s} วินาที` : `${r} จาก ${t} ขั้นต้องรันใหม่ Build ใช้เวลา ${s} วินาที`),
    caption: 'แต่ละช่องผสมมาจากการ Build จริงในแบบฝึก 05 (เริ่มจาก Build ที่ปิด Cache แล้วแก้ไฟล์ทีละอย่างตามลำดับ ไม่ได้ Build ซ้ำจากสถานะเดียวกัน) pip install ใช้เวลาประมาณ 3 ถึง 4 วินาที เพราะต้องโหลดแพ็กเกจเล็ก ๆ จากอินเทอร์เน็ต และเวลาจะต่างตามเครือข่าย',
  },
  en: {
    title: 'Choose the order of the lines in the Dockerfile and the file you edit, and see where the chain of the cache breaks and how long the build takes',
    legend: [{ kind: 'use', text: 'cache reused' }, { kind: 'new', text: 'runs again' }, { kind: 'skip', text: 'no reason to run again' }],
    order: 'order of the lines',
    orders: { bad: 'COPY . . before pip install', good: 'COPY requirements.txt before pip install' },
    change: 'file edited',
    changes: { none: 'nothing', app: 'edit app.py', req: 'edit requirements.txt' },
    reads: (step) => {
      if (step.startsWith('WORKDIR')) return 'reads none of our files';
      if (step.startsWith('COPY .')) return 'reads every file in the folder';
      if (step.startsWith('COPY requirements')) return 'reads requirements.txt';
      if (step.startsWith('COPY app')) return 'reads app.py';
      return 'runs on top of the layer before it';
    },
    reused: 'reused',
    again: 'runs again',
    edited: 'edited file',
    secs: 's',
    readout: (r, t, s) => (r === 0 ? `No step runs again. The build took ${s} s.` : `${r} of ${t} steps run again. The build took ${s} s.`),
    caption: 'Every combination comes from a real build in exercise 05 (it starts with a build that bypasses the cache and then edits one file at a time, in order, so builds were not repeated from the same state). The pip install takes about 3 to 4 seconds because it downloads a small package from the internet, and the time varies with the network.',
  },
};

export default function CacheLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [order, setOrder] = useState<Order>('bad');
  const [change, setChange] = useState<Change>('app');
  const rec = D[order];
  const steps = rec.steps;
  const cached = rec[change].cached;
  const secs = rec[change].seconds;
  const n = steps.length;
  const rerun = cached.filter((c) => !c).length;
  const W = Math.min(206, Math.floor((852 - (n - 1) * 24) / n));
  const reading = (s: string) => (change === 'app' && (s.startsWith('COPY .') || s.startsWith('COPY app'))) || (change === 'req' && (s.startsWith('COPY .') || s.startsWith('COPY requirements')));
  const firstBroken = cached.findIndex((c) => !c);
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.order}</span>
        <span className="seg" role="group" aria-label={T.order}>
          {(['bad', 'good'] as Order[]).map((k) => (
            <button key={k} type="button" aria-pressed={order === k} onClick={() => setOrder(k)}>{T.orders[k]}</button>
          ))}
        </span>
      </div>
      <div className="ib-controls">
        <span className="ib-lbl">{T.change}</span>
        <span className="seg" role="group" aria-label={T.change}>
          {(['none', 'app', 'req'] as Change[]).map((k) => (
            <button key={k} type="button" aria-pressed={change === k} onClick={() => setChange(k)}>{T.changes[k]}</button>
          ))}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 340" role="img" aria-label={T.title}>
          {steps.map((s, i) => {
            const x = 14 + i * (W + 24);
            const isCached = cached[i];
            const afterBreak = firstBroken !== -1 && i > firstBroken;
            const cls = isCached ? 'ib-use' : 'ib-new';
            return (
              <g key={s + i}>
                <text x={x} y={52} className="ib-s">{T.reads(s, order, i)}</text>
                {reading(s) && (
                  <g>
                    <rect className="ib-badge" x={x} y={10} width={W} height={24} rx={12} />
                    <text x={x + W / 2} y={27} className="ib-white" style={{ fontSize: 14 }}>{T.edited}</text>
                  </g>
                )}
                <rect className={cls} x={x} y={62} width={W} height={92} rx={10} style={isCached ? undefined : { strokeWidth: 4 }} />
                <text x={x + 12} y={96} className="ib-m" style={{ fontSize: 14, fill: 'var(--fg)' }}>{s.length > Math.floor(W / 8.6) ? s.slice(0, Math.floor(W / 8.6) - 1) + '…' : s}</text>
                <text x={x + 12} y={134} className="ib-n" style={{ fill: isCached ? 'var(--muted)' : 'var(--accent)' }}>{isCached ? T.reused : T.again}{!isCached && afterBreak ? ' ↺' : ''}</text>
                {i < n - 1 && <path className={cached[i + 1] ? 'ib-line' : 'ib-arrow'} d={`M${x + W},108 L${x + W + 24},108`} />}
              </g>
            );
          })}
          <text x={14} y={204} className="ib-s">{T.secs}</text>
          <rect className="ib-zone" x={14} y={214} width={852} height={26} rx={13} />
          <rect className={rerun ? 'ib-badge' : 'ib-badge'} x={14} y={214} width={Math.max(26, (secs / TOTAL) * 852)} height={26} rx={13} style={{ opacity: rerun ? 1 : 0.55 }} />
          <text x={866} y={274} textAnchor="end" className="ib-big" style={{ fontSize: 34 }}>{`${secs} ${T.secs}`}</text>
          <text x={14} y={274} className="ib-n">{`${rerun} / ${n}`}</text>
          <text x={14} y={298} className="ib-s">{T.again}</text>
        </svg>
      </div>
      <div className="readout" aria-live="polite"><div>{T.readout(rerun, n, secs)}</div></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
