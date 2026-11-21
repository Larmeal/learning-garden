import { useState } from 'react';
import { Seg, Tile, Arrow, type Lang } from '../devops/dv';
import data from './security.json';

// Shows:      three views of the same question, "who may do what to whom". RBAC: a Pod with a token knocks on the API server and four questions get yes or no. NetworkPolicy: a server Pod, a friend, a stranger and a
//             Pod from another namespace, with an arrow that is green when the connection went through and orange when it did not. Pod Security: three Pods try to enter a namespace marked restricted.
// Because:    all three are walls, and a wall is easiest to understand as the thing that stops an arrow. The reader switches the rule and watches the arrows change.
// Control:    the topic (RBAC, NetworkPolicy, Pod Security) and, inside each, the rule (before and after the Role, none / deny all / allow friend, the Pod).
// Conclusion: Kubernetes starts open on the network and closed on the API. You add a Role to open the API, and a NetworkPolicy to close the network. And the restricted level admits only Pods that ask for less.
//
// Every yes, no, reached, blocked and refused is a result printed by exercises/13_rbac_security.py (security.json), run on minikube with the kindnet CNI, which does enforce NetworkPolicy.

type Topic = 'rbac' | 'net' | 'psa';
type Pol = 'none' | 'denyAll' | 'allowFriend';

const TEXT: Record<Lang, { title: string; caption: string; topic: string; topics: Record<Topic, string>; role: string; roles: [string, string]; pol: string; pols: Record<Pol, string>; yes: string; no: string; reached: string; blocked: string; refused: string; admitted: string; notes: Record<Topic, string>; netNote: Record<Pol, string>; psaPods: [string, string, string]; capsRow: string }> = {
  th: {
    title: 'เลือกหัวข้อแล้วเปลี่ยนกฎ ดูว่าลูกศรไหนผ่านและไหนถูกกั้น',
    caption: 'ทุกคำตอบ (yes, no, reached, blocked, refused) คือผลจริงของแบบฝึก 13 บน minikube ที่ใช้ CNI kindnet ซึ่งบังคับ NetworkPolicy จริง',
    topic: 'หัวข้อ', topics: { rbac: 'RBAC', net: 'NetworkPolicy', psa: 'Pod Security' }, role: 'Role กับ RoleBinding', roles: ['ยังไม่มี', 'ผูกแล้ว (get, list pods)'], pol: 'NetworkPolicy บน srv', pols: { none: 'ไม่มี Policy', denyAll: 'เลือก srv แต่ไม่มีกฎ', allowFriend: 'อนุญาตเฉพาะ app=friend' },
    yes: 'ได้', no: 'ไม่ได้', reached: 'ถึง', blocked: 'ถูกกั้น', refused: 'ถูกปฏิเสธ', admitted: 'รับเข้า',
    notes: { rbac: 'ServiceAccount default มีโทเคนอยู่ในทุก Pod แต่ไม่มีสิทธิ์เลย พอผูก Role ที่ให้ list pods ใน Namespace เดียว ก็ทำได้แค่นั้น: ลบ Pod, อ่าน Secret หรือไปดู Namespace อื่นยังไม่ได้', net: '', psa: 'ระดับ restricted รับเฉพาะ Pod ที่ตั้งค่าครบห้าอย่าง Pod ที่ทำงานอยู่แล้วก่อนติด Label ไม่ถูกแตะ เพราะตรวจตอนรับเข้าเท่านั้น' },
    netNote: { none: 'ไม่มี NetworkPolicy ทุก Pod คุยกับทุก Pod ได้ ไม่ว่า Namespace ไหน', denyAll: 'Policy ที่เลือก srv แต่ไม่ระบุกฎ Ingress ทำให้ไม่มีใครเข้าได้เลย', allowFriend: 'กฎอนุญาตเฉพาะ Pod ที่มี Label ตรง Pod จาก Namespace อื่นไม่ผ่าน เพราะ podSelector ล้วนหมายถึง Namespace เดียวกัน' },
    psaPods: ['Pod privileged: true', 'Pod ธรรมดา', 'Pod ที่ตั้งค่าห้าอย่าง'], capsRow: 'Capability ที่เหลือ',
  },
  en: {
    title: 'Pick a topic and change the rule, and see which arrows go through and which are stopped',
    caption: 'Every answer (yes, no, reached, blocked, refused) is a real result of exercise 13 on minikube with the kindnet CNI, which really enforces NetworkPolicy.',
    topic: 'topic', topics: { rbac: 'RBAC', net: 'NetworkPolicy', psa: 'Pod Security' }, role: 'Role and RoleBinding', roles: ['none yet', 'bound (get, list pods)'], pol: 'NetworkPolicy on srv', pols: { none: 'no policy', denyAll: 'selects srv, no rule', allowFriend: 'allow only app=friend' },
    yes: 'yes', no: 'no', reached: 'reached', blocked: 'blocked', refused: 'refused', admitted: 'admitted',
    notes: { rbac: 'The default ServiceAccount has a token in every Pod but no rights at all. Once a Role that allows list pods is bound, it can do just that: it still cannot delete Pods, read Secrets or look at another namespace.', net: '', psa: 'The restricted level admits only Pods that set all five things. Pods that were already running before the label are not touched, because the check is at admission.' },
    netNote: { none: 'With no NetworkPolicy every Pod can talk to every Pod, in any namespace.', denyAll: 'A policy that selects srv and lists no ingress rule lets nobody in.', allowFriend: 'The rule lets in only Pods with the matching label. A Pod from another namespace is not let in, because a bare podSelector means the same namespace.' },
    psaPods: ['Pod with privileged: true', 'an ordinary Pod', 'a Pod with the five settings'], capsRow: 'capabilities left',
  },
};

export default function SecurityLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [topic, setTopic] = useState<Topic>('rbac');
  const [bound, setBound] = useState(false);
  const [pol, setPol] = useState<Pol>('none');
  const rbacRows = data.can_i.map((r, i) => ({ q: `${r.what} · ${i === 3 ? 'other namespace' : 'same namespace'}`, a: bound ? r.answer : 'no' }));
  const net = data.netpol[pol];
  const other = pol === 'none' ? 'reached' : data.netpol.otherNamespace;
  const ok = (v: string) => v === 'reached';
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Seg label={T.topic} options={(Object.keys(T.topics) as Topic[]).map((k) => ({ id: k, text: T.topics[k] }))} value={topic} onChange={setTopic} />
      {topic === 'rbac' && <Seg label={T.role} options={[{ id: 'no', text: T.roles[0] }, { id: 'yes', text: T.roles[1] }]} value={bound ? 'yes' : 'no'} onChange={(v) => setBound(v === 'yes')} />}
      {topic === 'net' && <Seg label={T.pol} options={(Object.keys(T.pols) as Pol[]).map((k) => ({ id: k, text: T.pols[k] }))} value={pol} onChange={setPol} />}
      <div className="viz-box">
        <svg viewBox="0 0 880 330" role="img" aria-label={T.title}>
          {topic === 'rbac' && (
            <g>
              <Tile x={20} y={110} w={200} h={90} title="Pod p" sub="ServiceAccount default" state="plain" />
              <Tile x={620} y={110} w={230} h={90} title="API Server" sub="RBAC" state="on" />
              {rbacRows.map((r, i) => (
                <g key={i}>
                  <Arrow x1={224} y1={140 + (i - 1.5) * 18} x2={616} y2={36 + i * 74 + 20} bad={r.a === 'no'} op={0.9} />
                  <Tile x={300} y={20 + i * 74} w={300} h={56} title={r.q} sub={r.a === 'yes' ? `✓ ${T.yes}` : `✗ ${T.no} (403)`} state={r.a === 'yes' ? 'ok' : 'bad'} />
                </g>
              ))}
            </g>
          )}
          {topic === 'net' && (
            <g>
              <Tile x={620} y={50} w={230} h={80} title="Pod srv" sub="app=srv" state="on" />
              <Tile x={20} y={20} w={200} h={64} title="friend" sub="app=friend" state="plain" />
              <Tile x={20} y={110} w={200} h={64} title="stranger" sub="app=stranger" state="plain" />
              <Tile x={20} y={220} w={200} h={64} title="victim" sub={lang === 'th' ? 'Namespace อื่น' : 'other namespace'} state="plain" />
              {([['friend', 52, net.friend], ['stranger', 142, net.stranger], ['victim', 252, other]] as [string, number, string][]).map(([n, y, v]) => (
                <g key={n}>
                  <Arrow x1={224} y1={y} x2={616} y2={90} bad={!ok(v)} dashed={!ok(v)} />
                  <text x={240} y={n === 'friend' ? 34 : n === 'stranger' ? 122 : 276} textAnchor="start" className="ib-n" style={{ fill: ok(v) ? 'var(--k2)' : 'var(--ib-bad)' }}>{ok(v) ? `✓ ${T.reached}` : `✗ ${T.blocked}`}</text>
                </g>
              ))}
              {pol !== 'none' && <rect x={590} y={40} width={8} height={100} rx={4} style={{ fill: 'var(--ib-bad)' }} />}
            </g>
          )}
          {topic === 'psa' && (
            <g>
              <rect className="ib-node" x={400} y={20} width={450} height={290} rx={14} style={{ stroke: 'var(--accent)', strokeWidth: 3 }} />
              <text x={416} y={50} className="ib-n">namespace · enforce=restricted</text>
              {([[0, data.psa.privileged], [1, data.psa.plain], [2, data.psa.hardened]] as [number, string][]).map(([i, v]) => (
                <g key={i}>
                  <Tile x={20} y={30 + i * 92} w={270} h={64} title={T.psaPods[i]} state="plain" />
                  <Arrow x1={294} y1={62 + i * 92} x2={v === 'admitted' ? 430 : 380} y2={62 + i * 92} bad={v !== 'admitted'} />
                  {v === 'admitted'
                    ? <Tile x={440} y={30 + i * 92} w={380} h={64} title={`✓ ${T.admitted}`} sub={`${T.capsRow}: ${data.caps.hardened}`} state="ok" />
                    : <text x={386} y={50 + i * 92 + 28} className="ib-n" style={{ fill: 'var(--ib-bad)' }}>✗ {T.refused}</text>}
                </g>
              ))}
            </g>
          )}
        </svg>
      </div>
      <p className="viz-now"><strong>{T.topics[topic]}</strong><span>{topic === 'net' ? T.netNote[pol] : T.notes[topic]}</span></p>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
