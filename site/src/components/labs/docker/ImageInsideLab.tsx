import { StepControls, useStepper, type Lang, type StepInfo } from '../spark/stepper';
import { Legend, Lines } from '../iceberg/ib';
import data from './imageinside.json';

// Shows:      the chain of objects behind one name, alpine:3.22: a tag, an index, a manifest, a config and a layer, each drawn as a box with the first 12 digits of
//             its real sha256. Each step opens one box and shows what is inside it. The last step shows that a tag can move to another manifest while a digest
//             never changes.
// Because:    "an image is blobs named by their hash" is about references. A sentence cannot show that the image id is the name of a box in the chain, or that the same layer has
//             two different hashes (the tar on our disk, the gzip in the registry).
// Control:    the step player (tag, index, manifest, config, layer, tag moves).
// Conclusion: everything is named by the sha256 of its bytes, so a digest pins exactly one image and a tag is only a movable pointer to one.
//
// Every digest and size comes from exercises/11_image_inside.py --write (imageinside.json): docker save of alpine:3.22, the index and manifest read from Docker Hub with
// docker buildx imagetools inspect, and a local registry (registry:3).

const H = data.hub;
const A = data.alpine;
const PLAT = data.platforms;

type Box = { key: string; title: string; hash: string };

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; boxes: Box[]; detail: string[][]; steps: StepInfo[]; caption: string; bytes: string; gz: string; tar: string;
}> = {
  th: {
    title: 'กด ถัดไป ทีละกล่อง เพื่อดูว่าชื่อ alpine:3.22 ชี้ผ่านอะไรบ้างจนถึงไฟล์ของระบบ และทุกกล่องมีชื่อเป็นแฮชของเนื้อหา',
    legend: [{ kind: 'new', text: 'กล่องที่เปิดดูอยู่' }, { kind: 'use', text: 'กล่องที่ผ่านมาแล้ว' }, { kind: 'skip', text: 'ยังไม่ถึง' }],
    boxes: [
      { key: 'tag', title: 'Tag', hash: 'alpine:3.22' },
      { key: 'index', title: 'Index', hash: H.index },
      { key: 'manifest', title: 'Manifest', hash: H.amd64 },
      { key: 'config', title: 'Config', hash: A.config },
      { key: 'layer', title: 'Layer', hash: A.layer },
    ],
    detail: [
      ['Tag คือชื่อที่คนอ่านง่าย', 'ผู้ดูแล Registry ย้ายมันไปชี้ที่อื่นได้ทุกเมื่อ', `วันนี้มันชี้ที่ Index ${H.index}`],
      [`Index แยก Manifest ตามแพลตฟอร์ม ${PLAT.length} แบบ`, PLAT.join('  '), `เครื่องเรา (linux/amd64) ได้ Manifest ${H.amd64}`],
      ['Manifest เป็นรายการของที่ Image ประกอบด้วย', `Config: ${A.config}`, `Layer: ${H.layerGzip} (บีบอัด gzip)`],
      [`Config มี ID เท่ากับ Image ID: ${A.config}`, 'ข้างในมีคำสั่งเริ่ม (Cmd), ตัวแปร (Env), ประวัติของทุกบรรทัด Dockerfile', `และรายการ diff_ids ของ Layer: ${A.layer}`],
      [`ไฟล์ Layer บนดิสก์เราเป็น tar ขนาด ${A.layerBytes.toLocaleString('en-US')} ไบต์`, `แฮช sha256 ของมันคือ ${A.layer} (diff id)`, `ใน Registry เก็บแบบ gzip ซึ่งแฮชต่างออกไปเป็น ${H.layerGzip}`],
      [`Push Image ถัดไปที่ใช้ฐานเดียวกัน ส่ง Layer ใหม่ ${data.registry.mountedSecond === 1 ? 'แค่ 1 ชั้น' : ''}`, 'Layer ฐานไม่ถูกอัปโหลดซ้ำ Registry ตอบว่า Mounted from อีก Repository', `Tag ย้ายได้ (${data.registry.digest} เป็น ${data.registry.newDigest}) แต่ Digest เดิมยังดึงภาพเดิมได้`],
    ],
    bytes: 'ไบต์',
    gz: 'gzip (ใน Registry)',
    tar: 'tar (บนดิสก์เรา)',
    caption: 'แฮชทุกตัวมาจากแบบฝึก 11 (docker save, docker buildx imagetools inspect ที่ Docker Hub และ Registry จริงที่รันใน Container) แสดงเฉพาะ 12 ตัวอักษรแรก Manifest ที่ docker save เขียนบนเครื่องนี้มีแฮชต่างจากของ Docker Hub แต่ Config เป็นตัวเดียวกัน',
    steps: [
      { name: 'Tag', title: 'Tag ชี้ไปที่ Digest', text: 'ชื่ออย่าง alpine:3.22 เป็นแค่ป้าย Registry จดว่าตอนนี้ป้ายนี้ชี้ที่ Index ตัวไหน' },
      { name: 'Index', title: 'Index เลือก Manifest ตามแพลตฟอร์ม', text: 'Tag ของ Image ทางการชี้ที่ Index ซึ่งมี Manifest หนึ่งอันต่อแพลตฟอร์ม Docker เลือกอันที่ตรงกับคอมพิวเตอร์ของเรา' },
      { name: 'Manifest', title: 'Manifest ระบุ Config กับ Layer ด้วยแฮช', text: 'Manifest ไม่ได้ใส่เนื้อหาไว้เอง มันแค่ระบุว่า Config คืออะไรและ Layer มีกี่ชั้น โดยอ้างด้วยแฮชของแต่ละตัว' },
      { name: 'Config', title: 'Config คือตัวตนของ Image', text: 'แฮชของไฟล์ Config คือ Image ID ที่ docker images แสดง ข้างในเก็บคำสั่งเริ่ม ตัวแปร และประวัติของแต่ละบรรทัด Dockerfile' },
      { name: 'Layer', title: 'Layer คือไฟล์ tar ของระบบไฟล์', text: 'เนื้อหาของ Layer มีแฮชสองค่า ตัวหนึ่งของ tar เปล่า ๆ (diff id) อีกตัวของไฟล์ที่ถูกบีบอัดสำหรับส่งผ่านเครือข่าย' },
      { name: 'ย้าย Tag', title: 'Tag ย้ายได้ แต่ Digest ไม่เปลี่ยน', text: 'ทุกอย่างอ้างด้วยแฮชของเนื้อหา แก้ไปหนึ่งไบต์ แฮชก็เปลี่ยนเป็นของใหม่ จึงใช้ Digest ล็อกเวอร์ชันได้แน่นอน ส่วน Tag ย้ายไปชี้ที่อื่นได้เสมอ' },
    ],
  },
  en: {
    title: 'Press Next one box at a time to see what the name alpine:3.22 points through until it reaches the files of the system, and that every box is named by a hash of its content',
    legend: [{ kind: 'new', text: 'the box being opened' }, { kind: 'use', text: 'boxes already passed' }, { kind: 'skip', text: 'not reached yet' }],
    boxes: [
      { key: 'tag', title: 'Tag', hash: 'alpine:3.22' },
      { key: 'index', title: 'Index', hash: H.index },
      { key: 'manifest', title: 'Manifest', hash: H.amd64 },
      { key: 'config', title: 'Config', hash: A.config },
      { key: 'layer', title: 'Layer', hash: A.layer },
    ],
    detail: [
      ['A tag is a name people can read', 'The owner of the registry can move it to point elsewhere at any time', `Today it points at the index ${H.index}`],
      [`The index splits manifests by ${PLAT.length} platforms`, PLAT.join('  '), `Our computer (linux/amd64) gets the manifest ${H.amd64}`],
      ['The manifest is the list of what the image is made of', `Config: ${A.config}`, `Layer: ${H.layerGzip} (gzip compressed)`],
      [`The config has an id equal to the image id: ${A.config}`, 'Inside are the start command (Cmd), variables (Env), the history of every Dockerfile line', `and the list of diff_ids of the layers: ${A.layer}`],
      [`The layer file on our disk is a tar of ${A.layerBytes.toLocaleString('en-US')} bytes`, `its sha256 is ${A.layer} (the diff id)`, `The registry keeps it as gzip, which has a different hash, ${H.layerGzip}`],
      [`Pushing the next image on the same base sends its new layer ${data.registry.mountedSecond === 1 ? '(just 1)' : ''}`, 'The base layer is not uploaded again: the registry says Mounted from another repository', `A tag can move (${data.registry.digest} to ${data.registry.newDigest}) but the old digest still pulls the old image`],
    ],
    bytes: 'bytes',
    gz: 'gzip (in the registry)',
    tar: 'tar (on our disk)',
    caption: 'Every hash comes from exercise 11 (docker save, docker buildx imagetools inspect at Docker Hub, and a real registry running in a container). Only the first 12 characters are shown. The manifest that docker save writes on this computer has a different hash from the one on Docker Hub, but the config is the same.',
    steps: [
      { name: 'Tag', title: 'A tag points at a digest', text: 'A name such as alpine:3.22 is only a label. The registry records which index the label points at right now.' },
      { name: 'Index', title: 'The index picks a manifest by platform', text: 'The tag of an official image points at an index with one manifest per platform. Docker picks the one that matches our computer.' },
      { name: 'Manifest', title: 'The manifest names the config and the layers by hash', text: 'The manifest holds no content itself. It only says what the config is and how many layers there are, by the hash of each.' },
      { name: 'Config', title: 'The config is the identity of the image', text: 'The hash of the config file is the image id that docker images shows. Inside are the start command, the variables and the history of each Dockerfile line.' },
      { name: 'Layer', title: 'A layer is a tar file of a file system', text: 'The content of a layer has two hashes: one of the plain tar (the diff id) and one of the compressed file that travels over the network.' },
      { name: 'Move the tag', title: 'A tag can move, a digest does not change', text: 'Everything is named by the hash of its content. Change one byte and the hash becomes a new one, so a digest pins a version for certain, while a tag can always be moved to point elsewhere.' },
    ],
  },
};

export default function ImageInsideLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const { step, go, playing, toggle } = useStepper(6, 4200);
  const open = Math.min(step, 4); // which box is open
  const W = 156;
  const lines = T.detail[step];
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="viz-box">
        <svg viewBox="0 0 880 330" role="img" aria-label={T.title}>
          {T.boxes.map((b, i) => {
            const x = 14 + i * (W + 18);
            const cls = i === open ? 'ib-new' : i < open ? 'ib-use' : 'ib-skip';
            return (
              <g key={b.key} style={i > open ? { opacity: 0.55 } : undefined}>
                <rect className={cls} x={x} y={30} width={W} height={92} rx={10} />
                <text x={x + 12} y={58} className="ib-n">{b.title}</text>
                <text x={x + 12} y={84} className="ib-m" style={{ fontSize: 13 }}>{b.hash.length > 20 ? b.hash : b.hash}</text>
                <text x={x + 12} y={106} className="ib-s" style={{ fontSize: 13 }}>{b.key === 'tag' ? '' : 'sha256'}</text>
                {i < 4 && <path className={i < open ? 'ib-arrow' : 'ib-line'} d={`M${x + W},76 L${x + W + 18},76`} />}
              </g>
            );
          })}
          <text x={14} y={158} className="ib-t">{T.boxes[open].title}</text>
          <rect className="ib-node" x={14} y={172} width={852} height={138} rx={12} />
          {lines.map((l, i) => (
            <Lines key={i} x={30} y={202 + i * 38} text={l} max={78} lh={20} className={i === 0 ? 'ib-n' : 'ib-m'} />
          ))}
        </svg>
      </div>
      <StepControls steps={T.steps} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
