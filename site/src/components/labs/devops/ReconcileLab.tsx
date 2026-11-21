import { useState } from 'react';
import { Lines } from '../iceberg/ib';
import { Seg, Tile, Arrow, type Lang, type TileState } from './dv';

// Shows:      the loop of a controller, in three rows: what Git says should exist (desired), what Docker has now (actual, with the differences marked), the list of actions the controller takes,
//             and what Docker has afterwards. Five situations: an empty cluster, a container removed by hand, a container started by hand, a commit that releases v2, a git revert.
// Because:    "the repository is the truth and the cluster is made to match it" is a comparison of two lists. The reader has to see the same list twice with the differences lit up, and the actions as the cure.
// Control:    the situation (every one changes the rows).
// Conclusion: a controller does not follow a script, it repeats "compare, then fix what differs". That is why a hand change is undone, a release is a commit, and a rollback is a revert.
//
// The five lists of actions are the real output of exercises/07_gitops_reconcile.py (reconcile #1, #3, #4, #5 and #6) driving real Docker containers with gitops.py. It is a model of the loop of Argo CD or Flux, not those tools.

type Sit = 'init' | 'removed' | 'extra' | 'release' | 'revert';
type Item = { n: string; v: string };
const V1: Item[] = [{ n: 'web-1', v: 'v1' }, { n: 'web-2', v: 'v1' }, { n: 'worker-1', v: 'v1' }];
const V2: Item[] = [{ n: 'web-1', v: 'v2' }, { n: 'web-2', v: 'v2' }, { n: 'web-3', v: 'v2' }, { n: 'worker-1', v: 'v1' }];

const SITS: Record<Sit, { desired: Item[]; actual: Item[]; steps: [string, string][]; after: Item[] }> = {
  init: { desired: V1, actual: [], steps: [['create', 'web-1'], ['create', 'web-2'], ['create', 'worker-1']], after: V1 },
  removed: { desired: V1, actual: [V1[0], V1[2]], steps: [['create', 'web-2']], after: V1 },
  extra: { desired: V1, actual: [...V1, { n: 'debug-1', v: 'v0' }], steps: [['remove', 'debug-1']], after: V1 },
  release: { desired: V2, actual: V1, steps: [['replace', 'web-1'], ['replace', 'web-2'], ['create', 'web-3']], after: V2 },
  revert: { desired: V1, actual: V2, steps: [['replace', 'web-1'], ['replace', 'web-2'], ['remove', 'web-3']], after: V1 },
};

const TEXT: Record<Lang, { title: string; caption: string; sit: string; sits: Record<Sit, string>; git: string; docker: string; after: string; ctl: string; missing: string; extra: string; wrong: string; none: string; act: Record<string, string>; note: Record<Sit, string>; commit: Record<Sit, string> }> = {
  th: {
    title: 'เลือกเหตุการณ์ แล้วดู Controller เทียบสิ่งที่ Git ต้องการกับสิ่งที่ Docker มี และลงมือแก้เฉพาะที่ต่าง',
    caption: 'รายการสิ่งที่ Controller ลงมือทำเป็นผลจริงของแบบฝึก 07 (07_gitops_reconcile.py) ที่ gitops.py อ่าน desired.json จาก Git แล้วสั่ง Docker จริง นี่เป็นตัวแบบของวงจรที่ Argo CD หรือ Flux ทำ ไม่ใช่เครื่องมือเหล่านั้น',
    sit: 'เหตุการณ์', sits: { init: 'Cluster ว่าง', removed: 'มีคนลบ web-2', extra: 'มีคนเปิด debug-1', release: 'Commit: Release v2', revert: 'git revert' },
    git: 'สิ่งที่ Git ต้องการ', docker: 'สิ่งที่ Docker มีอยู่ตอนนี้', after: 'หลัง Controller ทำงาน', ctl: 'Controller ทำอะไร', missing: 'ขาด', extra: 'เกิน', wrong: 'ผิดรุ่น', none: 'ไม่มีอะไรต้องทำ',
    act: { create: 'สร้าง', replace: 'แทนที่', remove: 'ลบ' },
    commit: { init: 'Commit: web v1 x2, worker v1 x1', removed: 'ไม่มี Commit ใหม่', extra: 'ไม่มี Commit ใหม่', release: 'Commit: release web v2, three replicas', revert: 'Commit: Revert "release web v2"' },
    note: { init: 'Cluster ว่าง Controller จึงสร้างทุกอย่างให้ตรงกับไฟล์', removed: 'Git ไม่ได้เปลี่ยน แต่ของจริงขาดไปหนึ่ง Controller สร้างกลับให้ (Self-healing)', extra: 'มีของที่ไม่มีใครขอ Controller ลบทิ้ง การเปลี่ยนด้วยมือจึงอยู่ได้ไม่นาน', release: 'การ Release คือการแก้ไฟล์ใน Git: เปลี่ยน web สองตัวเก่าและเพิ่มตัวที่สาม โดยไม่แตะ worker', revert: 'Rollback คือ git revert: Controller พา Cluster กลับเป็นเหมือนก่อน Release' },
  },
  en: {
    title: 'Choose a situation and watch the controller compare what Git wants with what Docker has, and fix only what differs',
    caption: 'The lists of actions are the real output of exercise 07 (07_gitops_reconcile.py), where gitops.py reads desired.json from Git and drives real Docker. It is a model of the loop that Argo CD or Flux run, not those tools.',
    sit: 'situation', sits: { init: 'empty cluster', removed: 'somebody removed web-2', extra: 'somebody started debug-1', release: 'commit: release v2', revert: 'git revert' },
    git: 'what Git wants', docker: 'what Docker has now', after: 'after the controller ran', ctl: 'what the controller does', missing: 'missing', extra: 'extra', wrong: 'wrong version', none: 'nothing to do',
    act: { create: 'create', replace: 'replace', remove: 'remove' },
    commit: { init: 'commit: web v1 x2, worker v1 x1', removed: 'no new commit', extra: 'no new commit', release: 'commit: release web v2, three replicas', revert: 'commit: Revert "release web v2"' },
    note: { init: 'The cluster is empty, so the controller creates everything to match the file.', removed: 'Git did not change, but the real thing lacks one. The controller creates it again (self-healing).', extra: 'Something nobody asked for is there, so the controller removes it. A hand change does not live long.', release: 'A release is an edit of the file in Git: the two old web containers change and a third is added, the worker is not touched.', revert: 'A rollback is a git revert: the controller brings the cluster back to what it was before the release.' },
  },
};

export default function ReconcileLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [sit, setSit] = useState<Sit>('release');
  const S = SITS[sit];
  const names = Array.from(new Set([...S.desired.map((d) => d.n), ...S.actual.map((a) => a.n)])).sort();
  const dMap = new Map(S.desired.map((d) => [d.n, d.v]));
  const aMap = new Map(S.actual.map((a) => [a.n, a.v]));
  const cell = (i: number) => ({ x: 20 + i * 142, w: 134 });
  const stateOf = (n: string): { st: TileState; sub: string } => {
    const d = dMap.get(n), a = aMap.get(n);
    if (d && !a) return { st: 'skip', sub: T.missing };
    if (!d && a) return { st: 'bad', sub: T.extra };
    if (d !== a) return { st: 'bad', sub: `${a} → ${d} (${T.wrong})` };
    return { st: 'ok', sub: a! };
  };
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Seg label={T.sit} options={(Object.keys(T.sits) as Sit[]).map((k) => ({ id: k, text: T.sits[k] }))} value={sit} onChange={setSit} />
      <div className="viz-box">
        <svg viewBox="0 0 880 500" role="img" aria-label={T.title}>
          <text x={20} y={26} className="ib-t">{T.git}</text>
          <text x={560} y={26} className="ib-s" textAnchor="end">{T.commit[sit]}</text>
          {names.map((n, i) => {
            const c = cell(i); const d = dMap.get(n);
            return d ? <Tile key={n} x={c.x} y={36} w={c.w} h={52} title={n} sub={d} state="on" /> : <g key={n} />;
          })}
          <text x={20} y={124} className="ib-t">{T.docker}</text>
          {names.map((n, i) => {
            const c = cell(i); const s = stateOf(n);
            return <Tile key={n} x={c.x} y={134} w={c.w} h={52} title={n} sub={s.sub} state={s.st} />;
          })}
          <text x={20} y={228} className="ib-t">{T.ctl}</text>
          {S.steps.length === 0 && <text x={20} y={262} className="ib-n">{T.none}</text>}
          {S.steps.map(([act, n], i) => (
            <g key={i}>
              <Tile x={20 + i * 190} y={240} w={180} h={46} title={`${T.act[act]} ${n}`} state={act === 'remove' ? 'bad' : 'on'} />
            </g>
          ))}
          <Arrow x1={440} y1={292} x2={440} y2={330} />
          <text x={20} y={324} className="ib-t">{T.after}</text>
          {S.after.map((it, i) => {
            const idx = names.indexOf(it.n);
            const c = cell(idx);
            return <Tile key={it.n} x={c.x} y={338} w={c.w} h={52} title={it.n} sub={it.v} state="ok" />;
          })}
          <rect className="ib-banner" x={12} y={410} width={856} height={76} rx={10} />
          <Lines x={26} y={440} text={T.note[sit]} max={88} lh={24} className="ib-n" />
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
