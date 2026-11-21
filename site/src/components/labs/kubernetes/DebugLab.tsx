import { useState } from 'react';
import { Tile, Arrow, Seg, type Lang } from '../devops/dv';
import ops from './ops.json';
import pods from './pods.json';
import cfg from './config.json';

// Shows:      the seven symptoms that a `kubectl get pods` or a failing request shows, as a status chip. The reader picks one and sees the three things to do, as three cards joined by arrows: the command to run,
//             what it printed in the real run, and the usual cause with its fix.
// Because:    finding out why something is broken is a short chain (symptom, one command, one cause), and the chain is what a reader needs in the head at 3 a.m., not a list of causes.
// Control:    the symptom.
// Conclusion: the status names the layer: image (ImagePull), process (CrashLoop, OOMKilled), placement (Pending), configuration (CreateContainerConfigError), traffic (no endpoints, not Ready). Then ask the object the right question.
//
// Every "what it printed" line is real output of exercises/14_helm_hpa_debug.py, 02_pods.py or 08_config_secrets.py (ops.json, pods.json, config.json).

type S = 'pull' | 'crash' | 'pending' | 'config' | 'oom' | 'noep' | 'notready';
const D = ops.debug;

const TEXT: Record<Lang, { title: string; caption: string; s: string; syms: Record<S, string>; cmd: Record<S, string>; saw: Record<S, string>; cause: Record<S, string>; c1: string; c2: string; c3: string }> = {
  th: {
    title: 'เลือกอาการที่เจอ แล้วดูว่าต้องรันคำสั่งอะไร ผลที่ออกมาหน้าตาเป็นอย่างไร และสาเหตุที่พบบ่อย',
    caption: 'ข้อความในช่อง "ผลที่ได้" คือผลจริงที่พิมพ์ออกมาจากแบบฝึก 14, 02 และ 08 ส่วนช่อง "สาเหตุ" คือสาเหตุที่พบบ่อยตามผู้เขียน ไม่ใช่รายการครบถ้วน',
    s: 'อาการ', syms: { pull: 'ImagePullBackOff', crash: 'CrashLoopBackOff', pending: 'Pending', config: 'CreateContainerConfigError', oom: 'OOMKilled', noep: 'Service ไม่มี Endpoint', notready: 'Running แต่ไม่ Ready' },
    c1: 'ถามว่า', c2: 'ผลที่ได้', c3: 'สาเหตุและวิธีแก้',
    cmd: { pull: 'kubectl describe pod bad-image', crash: 'kubectl logs crash --previous', pending: 'kubectl describe pod too-big (ดู Events)', config: 'kubectl get pod broken -o jsonpath=…state.waiting.message', oom: 'kubectl get pod hog -o jsonpath=…state.terminated', noep: 'kubectl get endpoints typo', notready: 'kubectl describe pod (ดู Events และ Conditions)' },
    saw: { pull: 'Failed to pull image "busybox:no-such-tag": … not found', crash: D.logsPrevious, pending: '0/3 nodes are available: … Insufficient cpu', config: cfg.missingKey, oom: `reason=${pods.oom.reason} exitCode=${pods.oom.exitCode}`, noep: '(ไม่มี subsets: รายการว่าง)', notready: 'Readiness probe failed: …' },
    cause: { pull: 'ชื่อหรือ Tag ของ Image ผิด หรือไม่มีสิทธิ์ดึง แก้ชื่อ หรือใส่ imagePullSecrets', crash: 'โปรแกรมจบด้วยรหัสไม่ใช่ 0 เช่น Config ผิดหรือต่อฐานข้อมูลไม่ได้ อ่าน Log ของรอบก่อน แล้วแก้ต้นเหตุ', pending: 'ไม่มี Node ที่ Request พอ หรือติด Taint หรือ nodeSelector ลด Request เพิ่ม Node หรือเพิ่ม Toleration', config: 'Secret หรือ ConfigMap หรือ Key ที่อ้างถึงไม่มี สร้างให้ครบหรือแก้ชื่อ Key', oom: 'ใช้ Memory เกิน limit จึงถูก Kernel ฆ่า เพิ่ม limit หรือลดการใช้ Memory', noep: 'Selector ของ Service ไม่ตรงกับ Label ของ Pod (พิมพ์ผิดบ่อยมาก) หรือไม่มี Pod ที่ Ready', notready: 'Probe ไม่ผ่าน จึงถูกถอดออกจาก Endpoint แก้แอปหรือค่า Probe (Pod ไม่ถูก Restart)' },
  },
  en: {
    title: 'Pick a symptom and see which command to run, what it printed, and the usual cause',
    caption: 'The text in the "what it printed" card is real output from exercises 14, 02 and 08. The "cause" card holds the usual causes according to the author, not a complete list.',
    s: 'symptom', syms: { pull: 'ImagePullBackOff', crash: 'CrashLoopBackOff', pending: 'Pending', config: 'CreateContainerConfigError', oom: 'OOMKilled', noep: 'Service has no endpoints', notready: 'Running but not Ready' },
    c1: 'ask', c2: 'what it printed', c3: 'cause and fix',
    cmd: { pull: 'kubectl describe pod bad-image', crash: 'kubectl logs crash --previous', pending: 'kubectl describe pod too-big (read Events)', config: 'kubectl get pod broken -o jsonpath=…state.waiting.message', oom: 'kubectl get pod hog -o jsonpath=…state.terminated', noep: 'kubectl get endpoints typo', notready: 'kubectl describe pod (read Events and Conditions)' },
    saw: { pull: 'Failed to pull image "busybox:no-such-tag": … not found', crash: D.logsPrevious, pending: '0/3 nodes are available: … Insufficient cpu', config: cfg.missingKey, oom: `reason=${pods.oom.reason} exitCode=${pods.oom.exitCode}`, noep: '(no subsets: the list is empty)', notready: 'Readiness probe failed: …' },
    cause: { pull: 'The image name or tag is wrong, or there is no right to pull it. Fix the name, or add imagePullSecrets.', crash: 'The program exits with a non-zero code, for example bad config or no database. Read the log of the previous run and fix the cause.', pending: 'No node has enough requests free, or a taint or nodeSelector blocks it. Lower the request, add a node, or add a toleration.', config: 'The Secret or ConfigMap or key that is referenced does not exist. Create it or fix the key name.', oom: 'It used more memory than its limit and the kernel killed it. Raise the limit or use less memory.', noep: 'The selector of the Service does not match the Pod labels (a typo is very common), or no Pod is Ready.', notready: 'The probe fails, so the Pod is taken off the endpoints. Fix the app or the probe settings (the Pod is not restarted).' },
  },
};

export default function DebugLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [s, setS] = useState<S>('pull');
  const bad = s === 'pull' || s === 'config' || s === 'oom' || s === 'crash';
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Seg label={T.s} options={(Object.keys(T.syms) as S[]).map((k) => ({ id: k, text: T.syms[k] }))} value={s} onChange={setS} />
      <div className="viz-box">
        <svg viewBox="0 0 880 300" role="img" aria-label={T.title}>
          <Tile x={14} y={20} w={850} h={56} title={T.syms[s]} sub={s === 'noep' ? 'kubectl get endpoints' : 'kubectl get pods'} state={bad || s === 'pending' ? 'bad' : 'skip'} />
          <Arrow x1={440} y1={80} x2={440} y2={106} />
          {[{ x: 14, h: T.c1, b: T.cmd[s] }, { x: 304, h: T.c2, b: T.saw[s] }, { x: 594, h: T.c3, b: T.cause[s] }].map((c, i) => (
            <g key={c.h}>
              <rect className={i === 2 ? 'nw-cell ok' : 'nw-cell on'} x={c.x} y={110} width={270} height={176} rx={12} />
              <text x={c.x + 14} y={138} className="ib-n">{i + 1}. {c.h}</text>
              <foreignObject x={c.x + 12} y={148} width={246} height={132}>
                <div style={{ fontSize: 14, lineHeight: 1.35, color: 'var(--fg)', fontFamily: i < 2 ? 'var(--mono)' : undefined, overflowWrap: 'anywhere' }}>{c.b}</div>
              </foreignObject>
              {i < 2 && <Arrow x1={c.x + 272} y1={198} x2={c.x + 300} y2={198} />}
            </g>
          ))}
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
