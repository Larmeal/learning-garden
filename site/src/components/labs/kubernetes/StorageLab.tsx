import { useState } from 'react';
import { Seg, Tile, Arrow, type Lang } from '../devops/dv';
import data from './storage.json';

// Shows:      the chain claim -> volume -> folder on a node, drawn for real: the PVC "data", the PV that was made for it, and the hostPath folder that sits on ONE node. A Pod is dropped onto a node
//             and either finds the file `note` or finds an empty folder. A second switch shows an emptyDir, and a third deletes the claim.
// Because:    "persistent" only means something once you see WHERE the bytes are. On this cluster they are in a folder of one worker, and a Pod on the other worker sees nothing.
// Control:    the kind of volume (PVC or emptyDir) and what happens (a new Pod on garden-m02, a new Pod on garden-m03, delete the claim).
// Conclusion: a claim survives a Pod, an emptyDir does not. But a claim is only as portable as the PV behind it: hostPath belongs to a node, a `local` PV with nodeAffinity makes the scheduler follow it.
//
// Measured by exercises/09_storage.py (storage.json): PV path /tmp/hostpath-provisioner/<ns>/data, no nodeAffinity, `note` on garden-m02, 0 files seen from garden-m03, and the folder still holding `note` after the PVC was deleted.

type Vol = 'pvc' | 'empty';
type Act = 'm02' | 'm03' | 'del';
const P = data.pv;

const TEXT: Record<Lang, { title: string; caption: string; vol: string; vols: Record<Vol, string>; act: string; acts: Record<Act, string>; claim: string; folder: string; pod: string; sees: string; none: string; note: (v: Vol, a: Act) => string }> = {
  th: {
    title: 'เลือกชนิด Volume และสิ่งที่เกิดขึ้น แล้วดูว่า Pod ตัวใหม่เจอไฟล์ note หรือเจอโฟลเดอร์ว่าง',
    caption: `ทุกอย่างมาจากการรันจริงในแบบฝึก 09 บน minikube: StorageClass standard ใช้ provisioner ${P.provisioner} ได้ PV เป็น hostPath ${P.path} และไม่มี nodeAffinity ไฟล์ note อยู่บน garden-m02 ส่วน Pod บน garden-m03 เห็น 0 ไฟล์ และหลังลบ PVC โฟลเดอร์ยังมีไฟล์อยู่ (reclaimPolicy ${P.reclaim})`,
    vol: 'Volume', vols: { pvc: 'PersistentVolumeClaim', empty: 'emptyDir' }, act: 'สิ่งที่เกิดขึ้น', acts: { m02: 'Pod ใหม่บน garden-m02', m03: 'Pod ใหม่บน garden-m03', del: 'ลบ PVC' },
    claim: 'PVC data', folder: 'โฟลเดอร์บน Node', pod: 'Pod ตัวใหม่', sees: 'เห็น', none: 'ว่าง (0 ไฟล์)',
    note: (v, a) => v === 'empty' ? 'emptyDir เกิดมาพร้อม Pod และหายไปพร้อม Pod: Pod ตัวใหม่ได้โฟลเดอร์ว่างเสมอ' : a === 'm02' ? 'Pod ใหม่ Mount Claim เดิมบน Node ที่เก็บโฟลเดอร์ไว้ จึงเจอไฟล์ note ที่ Pod ตัวก่อนเขียน' : a === 'm03' ? 'Claim ยัง Bound อยู่ แต่ PV ชนิด hostPath ไม่มี nodeAffinity ให้ Scheduler รู้ว่าข้อมูลอยู่ที่ไหน Pod บน Node อื่นจึงเห็นโฟลเดอร์ว่างของ Node นั้น' : 'PV ถูกลบพร้อม Claim (reclaimPolicy Delete) แต่ไฟล์บน Worker ยังค้างอยู่ เพราะ Provisioner ของ minikube ทำงานบน Control Plane',
  },
  en: {
    title: 'Pick the kind of volume and what happens, and see whether the new Pod finds the file note or an empty folder',
    caption: `All from a real run of exercise 09 on minikube: the standard StorageClass uses provisioner ${P.provisioner}, the PV is a hostPath ${P.path} with no nodeAffinity, the file note is on garden-m02, a Pod on garden-m03 sees 0 files, and after the PVC is deleted the folder still holds the file (reclaimPolicy ${P.reclaim}).`,
    vol: 'volume', vols: { pvc: 'PersistentVolumeClaim', empty: 'emptyDir' }, act: 'what happens', acts: { m02: 'new Pod on garden-m02', m03: 'new Pod on garden-m03', del: 'delete the PVC' },
    claim: 'PVC data', folder: 'folder on the node', pod: 'the new Pod', sees: 'sees', none: 'empty (0 files)',
    note: (v, a) => v === 'empty' ? 'An emptyDir is born with the Pod and dies with it: a new Pod always gets an empty folder.' : a === 'm02' ? 'The new Pod mounts the same claim on the node that holds the folder, so it finds the file note that the earlier Pod wrote.' : a === 'm03' ? 'The claim is still Bound, but a hostPath PV has no nodeAffinity to tell the scheduler where the data is. A Pod on another node sees that node\'s empty folder.' : 'The PV is deleted with the claim (reclaimPolicy Delete) but the file on the worker stays, because minikube\'s provisioner runs on the control plane.',
  },
};

export default function StorageLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [vol, setVol] = useState<Vol>('pvc');
  const [act, setAct] = useState<Act>('m02');
  const podNode = act === 'm03' ? 'garden-m03' : 'garden-m02';
  const found = vol === 'pvc' && act === 'm02';
  const del = vol === 'pvc' && act === 'del';
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Seg label={T.vol} options={(Object.keys(T.vols) as Vol[]).map((k) => ({ id: k, text: T.vols[k] }))} value={vol} onChange={setVol} />
      <Seg label={T.act} options={(Object.keys(T.acts) as Act[]).filter((k) => vol === 'pvc' || k !== 'del').map((k) => ({ id: k, text: T.acts[k] }))} value={vol === 'empty' && act === 'del' ? 'm02' : act} onChange={setAct} />
      <div className="viz-box">
        <svg viewBox="0 0 880 290" role="img" aria-label={T.title}>
          {['garden-m02', 'garden-m03'].map((n, i) => (
            <g key={n}>
              <rect className="ib-node" x={20 + i * 300} y={20} width={280} height={250} rx={14} />
              <text x={34 + i * 300} y={48} className="ib-n">{n}</text>
              <rect className="nw-cell" x={40 + i * 300} y={190} width={240} height={64} rx={8} style={{ opacity: vol === 'pvc' ? 1 : 0.35 }} />
              <text x={50 + i * 300} y={214} className="ib-s">{T.folder}</text>
              <text x={50 + i * 300} y={240} className="ib-m" style={{ fill: 'var(--fg)' }}>{vol === 'pvc' && i === 0 ? 'note' : '(0)'}</text>
              {podNode === n && !del && <Tile x={60 + i * 300} y={76} w={200} h={70} title={T.pod} sub={`${T.sees}: ${found ? 'note' : T.none}`} state={found ? 'ok' : 'bad'} />}
              {podNode === n && !del && <Arrow x1={160 + i * 300} y1={148} x2={160 + i * 300} y2={186} bad={!found} />}
            </g>
          ))}
          {vol === 'pvc' && (
            <g>
              <Tile x={640} y={30} w={220} h={56} title={T.claim} sub="Bound" state={del ? 'skip' : 'on'} />
              <Tile x={640} y={120} w={220} h={56} title="PV (hostPath)" sub="nodeAffinity: —" state={del ? 'skip' : 'on'} op={del ? 0.5 : 1} />
              <Arrow x1={750} y1={88} x2={750} y2={118} />
              <text x={640} y={206} className="ib-s">{del ? (lang === 'th' ? 'PV หาย แต่ไฟล์ยังค้าง' : 'PV gone, the file is left') : ''}</text>
            </g>
          )}
        </svg>
      </div>
      <p className="viz-now"><strong>{T.vols[vol]}</strong><span>{T.note(vol, act)}</span></p>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
