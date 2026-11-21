import { useState } from 'react';
import { ClockControls, useClock, prog, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Seg, Tile, Arrow, type Lang } from '../devops/dv';
import data from './config.json';

// Shows:      a ConfigMap card on the left and a Pod on the right with three things made from it: an environment variable, a file, and a file mounted with subPath. At t = 2 the ConfigMap changes from info to debug.
//             A bar shows the kubelet's sync catching up. The reader sees which of the three follow the change and which never do, and can restart the Pod to see all three read the new value.
// Because:    "when does a Pod notice a new config" has three different answers, and each answer is a moment on a timeline.
// Control:    whether the Pod is restarted at the end; play, scrub and jump.
// Conclusion: an env var is read once at container start; a mounted file follows the ConfigMap within about a minute; a subPath file never follows. A restart picks up everything.
//
// Measured by exercises/08_config_secrets.py (config.json): the file changed 86 s after the patch, the env var stayed `info` and the subPath file stayed `info`. The time axis here is compressed (12 s stands for about 90 s).

const D = 12;
const SEC = data.propagation.fileSeconds;
type Mode = 'keep' | 'restart';

const TEXT: Record<Lang, { title: string; caption: string; mode: string; modes: Record<Mode, string>; cm: string; env: string; file: string; pinned: string; sync: string; marks: (m: Mode) => Mark[]; banner: (t: number, m: Mode) => string }> = {
  th: {
    title: 'เปลี่ยนค่าใน ConfigMap แล้วกดเล่น ดูว่าค่าไหนใน Pod ตามมา ค่าไหนอยู่เหมือนเดิม',
    caption: `ผลจากแบบฝึก 08: ไฟล์เปลี่ยนตาม ConfigMap หลัง ${SEC} วินาที ส่วนตัวแปรสภาพแวดล้อมกับไฟล์ที่ Mount ด้วย subPath ยังเป็น info แกนเวลาในภาพถูกย่อ (12 วินาทีแทนประมาณ 90 วินาที)`,
    mode: 'หลังจากนั้น', modes: { keep: 'ปล่อย Pod ไว้', restart: 'Restart Pod' }, cm: 'ConfigMap app-config', env: 'ตัวแปร LEVEL', file: 'ไฟล์ /etc/app/app.properties', pinned: 'ไฟล์ subPath /etc/pinned/...', sync: 'Kubelet ซิงก์',
    marks: (m) => [
      { at: 0, name: 'ก่อนเปลี่ยน', title: 'ทุกอย่างเป็น info', text: 'Pod เริ่มทำงานด้วย ConfigMap ที่ LEVEL=info' },
      { at: 2.2, name: 'แก้ ConfigMap', title: 'LEVEL เปลี่ยนเป็น debug ใน API', text: 'ConfigMap ถูกแก้แล้ว แต่ Pod ยังไม่รู้เลย' },
      { at: 8.5, name: 'ไฟล์ตาม', title: `ไฟล์ที่ Mount ทั้งโฟลเดอร์เปลี่ยนเป็น debug (จริง ${SEC} วินาที)`, text: 'Kubelet ซิงก์ Volume เป็นรอบ จึงช้าเป็นหลักนาที ส่วนตัวแปรกับไฟล์ subPath ไม่ขยับ' },
      ...(m === 'restart' ? [{ at: 11, name: 'Restart', title: 'Pod ถูกสร้างใหม่ ทุกค่าเป็น debug', text: 'Container ใหม่อ่านตัวแปรและ subPath จาก ConfigMap ตอนเริ่ม' }] : []),
    ],
    banner: (t, m) => t < 2.2 ? 'ConfigMap กับ Pod ตรงกัน' : m === 'restart' && t >= 11 ? 'Restart แล้ว ทุกค่าตรงกับ ConfigMap' : t < 8.5 ? 'ConfigMap เปลี่ยนแล้ว แต่ใน Pod ยังเป็นค่าเก่า' : 'ไฟล์ตามแล้ว ตัวแปรกับ subPath ยังเป็นค่าเก่า',
  },
  en: {
    title: 'Change the value in the ConfigMap and press play, and see which values in the Pod follow and which stay as they were',
    caption: `Results of exercise 08: the file followed the ConfigMap after ${SEC} s, while the environment variable and the file mounted with subPath stayed info. The time axis is compressed (12 s stands for about 90 s).`,
    mode: 'afterwards', modes: { keep: 'leave the Pod', restart: 'restart the Pod' }, cm: 'ConfigMap app-config', env: 'variable LEVEL', file: 'file /etc/app/app.properties', pinned: 'subPath file /etc/pinned/...', sync: 'kubelet sync',
    marks: (m) => [
      { at: 0, name: 'Before', title: 'Everything says info', text: 'The Pod started with the ConfigMap at LEVEL=info.' },
      { at: 2.2, name: 'Edit ConfigMap', title: 'LEVEL becomes debug in the API', text: 'The ConfigMap was edited, but the Pod does not know yet.' },
      { at: 8.5, name: 'File follows', title: `The folder-mounted file becomes debug (${SEC} s in the real run)`, text: 'The kubelet syncs volumes in rounds, so it takes up to a minute or more. The variable and the subPath file do not move.' },
      ...(m === 'restart' ? [{ at: 11, name: 'Restart', title: 'The Pod is recreated and every value is debug', text: 'The new container reads the variable and the subPath file from the ConfigMap at start.' }] : []),
    ],
    banner: (t, m) => t < 2.2 ? 'The ConfigMap and the Pod agree' : m === 'restart' && t >= 11 ? 'Restarted: everything matches the ConfigMap' : t < 8.5 ? 'The ConfigMap changed, but the Pod still has the old value' : 'The file followed; the variable and the subPath file still have the old value',
  },
};

export default function ConfigLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [m, setM] = useState<Mode>('keep');
  const clock = useClock(D);
  const t = clock.t;
  const cmNew = t >= 2.2;
  const fileNew = t >= 8.5;
  const rst = m === 'restart' && t >= 11;
  const val = (x: boolean) => (x ? 'debug' : 'info');
  const sync = prog(t, 2.2, 8.5);
  const rows = [
    { y: 70, n: T.env, v: val(rst), st: rst ? 'on' : 'plain' },
    { y: 150, n: T.file, v: val(fileNew || rst), st: fileNew || rst ? 'on' : 'plain' },
    { y: 230, n: T.pinned, v: val(rst), st: rst ? 'on' : 'plain' },
  ] as const;
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Seg label={T.mode} options={(Object.keys(T.modes) as Mode[]).map((k) => ({ id: k, text: T.modes[k] }))} value={m} onChange={(v) => { setM(v); clock.restart(); }} />
      <div className="viz-box">
        <svg viewBox="0 0 880 370" role="img" aria-label={T.title}>
          <Tile x={20} y={118} w={230} h={110} title={T.cm} sub={`LEVEL=${val(cmNew)}`} state={cmNew ? 'on' : 'plain'} />
          <rect className="ib-node" x={400} y={30} width={460} height={270} rx={14} style={{ strokeDasharray: '9 6' }} />
          <text x={416} y={58} className="ib-n">Pod reader</text>
          {rows.map((r, i) => (
            <g key={r.n}>
              <Arrow x1={252} y1={150 + (i - 1) * 20} x2={396} y2={r.y + 26} op={i === 1 ? Math.max(0.3, sync) : 0.3} dashed={i !== 1} />
              <Tile x={430} y={r.y} w={400} h={52} title={r.n} sub={r.v} state={r.st === 'on' ? 'on' : 'plain'} />
            </g>
          ))}
          <rect x={20} y={246} width={230} height={14} rx={6} style={{ fill: 'var(--surface-2)', stroke: 'var(--line-strong)' }} />
          <rect x={20} y={246} width={230 * sync} height={14} rx={6} style={{ fill: 'var(--accent)' }} />
          <text x={20} y={280} className="ib-s">{T.sync}</text>
          <Banner y={312} text={T.banner(t, m)} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks(m)} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
