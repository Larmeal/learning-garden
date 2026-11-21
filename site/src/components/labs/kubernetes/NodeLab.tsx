import { StepControls, useStepper, type StepInfo } from '../spark/stepper';
import { Tile, Arrow, type Lang } from '../devops/dv';
import data from './node.json';

// Shows:      the inside of one worker node. Down the left the chain kubelet -> containerd (a unix socket) -> the Pod. In the middle the Pod itself: a tiny /pause sandbox and two containers.
//             On the right a panel that changes with the step: the namespaces the containers share, the cgroup files with the real limits, the veth pair and the routes, and the TTL of a ping.
// Because:    "what is a Pod to the kernel" is a list of files and namespace ids on one computer, and each of the five steps points at a different file of the same Pod.
// Control:    the step buttons (five steps).
// Conclusion: the kubelet does not run containers: it asks containerd, and the isolation and the limits are plain kernel features (namespaces, cgroup files, veth and routes).
//
// All values are from exercises/11_node_inside.py (node.json): one network namespace and three mount and pid namespaces for /pause, a and b; memory.max 67108864, cpu.max "10000 100000", cpu.weight 2, throttled in 31
// of 31 periods; Pod CIDRs per node; ptp plugin without a bridge; ping TTL 63 on the same node and 62 across nodes; restarting the kubelet left the containers alone.

const TEXT: Record<Lang, { title: string; caption: string; steps: StepInfo[]; kubelet: string; sock: string; pause: string; a: string; b: string; panel: string[]; lines: string[][] }> = {
  th: {
    title: 'กดถัดไปทีละขั้น ดูว่า Pod หนึ่งตัวเป็นอะไรในสายตาของ Kernel ของ Worker',
    caption: 'ค่าทั้งหมดมาจากการรันจริงในแบบฝึก 11 บน Worker ตัวหนึ่งของ minikube (containerd 1.7.21, cgroup v2 แบบ cgroupfs, CNI kindnet) Pod ในภาพมี Container a (limit CPU 100m, Memory 64Mi) กับ b (ไม่มี limit)',
    steps: [
      { name: 'Kubelet', title: 'Kubelet ไม่ได้รัน Container เอง มันคุยกับ containerd ผ่าน unix socket', text: 'ไฟล์ตั้งค่า /var/lib/kubelet/config.yaml ชี้ไปที่ unix:///run/containerd/containerd.sock ตามมาตรฐาน CRI' },
      { name: 'Sandbox', title: 'Pod หนึ่งตัวคือ Sandbox ตัวเล็กที่รัน /pause บวก Container ของเรา', text: '/pause ไม่ทำอะไรนอกจากถือ Namespace ไว้ให้ Container อื่นมาเข้าร่วม' },
      { name: 'Namespace', title: 'ทุก Container ใช้ Network Namespace เดียวกัน แต่แยก Mount และ PID', text: 'นี่คือเหตุผลที่ Container ใน Pod เดียวกันเรียกกันผ่าน localhost ได้ แต่ไม่เห็นไฟล์และ Process ของกัน' },
      { name: 'Cgroup', title: 'Request กับ Limit กลายเป็นไฟล์ใน cgroup', text: 'limit memory 64Mi เป็น memory.max, limit cpu 100m เป็น cpu.max "10000 100000" (10 มิลลิวินาทีในทุก 100) และ request cpu 50m เป็น cpu.weight' },
      { name: 'Network', title: 'Pod ได้ IP จาก CIDR ของ Node และต่อกับ Node ด้วย veth หนึ่งคู่', text: 'kindnet ใช้ปลั๊กอิน ptp ไม่มี Bridge: Node มี Route ตรงไปหา veth ของแต่ละ Pod และมี Route ไปหา CIDR ของ Node อื่นผ่าน IP ของ Node นั้น จึงมีสองฮ็อปเมื่อข้าม Node' },
    ],
    kubelet: 'Kubelet', sock: 'containerd (CRI)', pause: '/pause', a: 'container a', b: 'container b',
    panel: ['/run/containerd/containerd.sock', 'sandbox + 2 containers', 'net 1 · mnt 3 · pid 3', 'cgroup', 'veth + route'],
    lines: [
      ['kubelet → unix:///run/containerd/containerd.sock', 'crictl pods: 1 sandbox, containers a b'],
      ['ps ของ sandbox: /pause', 'ทั้งหมดอยู่ใน Pod เดียว'],
      ['net: 1 namespace ร่วมกัน', 'mnt: 3 ไม่ซ้ำกัน', 'pid: 3 ไม่ซ้ำกัน'],
      [`memory.max  ${data.cgroup.memoryMax}`, `cpu.max     ${data.cgroup.cpuMax}`, `cpu.weight  ${data.cgroup.cpuWeight}`, `วนลูปเต็ม CPU ได้แค่ ${data.cgroup.usedPct}% (throttled ${data.cgroup.throttledPeriods})`],
      [`garden-m02 10.244.1.0/24 · Pod ต่อด้วย veth`, `10.244.0.0/24 via 192.168.67.2`, `10.244.2.0/24 via 192.168.67.4`, `ping Pod ใน Node เดียวกัน TTL ${data.ttl.sameNode}`, `ping Pod ข้าม Node TTL ${data.ttl.otherNode}`],
    ],
  },
  en: {
    title: 'Press Next one step at a time and see what one Pod is to the kernel of a worker',
    caption: 'All values are from a real run of exercise 11 on a minikube worker (containerd 1.7.21, cgroup v2 with the cgroupfs driver, CNI kindnet). The Pod in the picture has container a (CPU limit 100m, memory 64Mi) and b (no limits).',
    steps: [
      { name: 'Kubelet', title: 'The kubelet does not run containers itself. It talks to containerd over a unix socket', text: 'The config file /var/lib/kubelet/config.yaml points at unix:///run/containerd/containerd.sock, following the CRI standard.' },
      { name: 'Sandbox', title: 'One Pod is a tiny sandbox running /pause, plus our containers', text: '/pause does nothing except hold the namespaces for the other containers to join.' },
      { name: 'Namespaces', title: 'All containers share one network namespace but have their own mount and PID', text: 'That is why containers of one Pod can call each other on localhost, yet do not see each other\'s files and processes.' },
      { name: 'Cgroup', title: 'Requests and limits become files in a cgroup', text: 'A memory limit of 64Mi becomes memory.max, a CPU limit of 100m becomes cpu.max "10000 100000" (10 ms of every 100), and a CPU request of 50m becomes cpu.weight.' },
      { name: 'Network', title: 'The Pod gets an IP from the node\'s CIDR and is joined to the node by one veth pair', text: 'kindnet uses the ptp plugin, with no bridge: the node has a route straight to each Pod\'s veth and a route to every other node\'s CIDR through that node\'s IP, so crossing nodes takes two hops.' },
    ],
    kubelet: 'Kubelet', sock: 'containerd (CRI)', pause: '/pause', a: 'container a', b: 'container b',
    panel: ['/run/containerd/containerd.sock', 'sandbox + 2 containers', 'net 1 · mnt 3 · pid 3', 'cgroup', 'veth + route'],
    lines: [
      ['kubelet → unix:///run/containerd/containerd.sock', 'crictl pods: 1 sandbox, containers a b'],
      ['ps of the sandbox: /pause', 'all inside one Pod'],
      ['net: 1 namespace, shared', 'mnt: 3, all different', 'pid: 3, all different'],
      [`memory.max  ${data.cgroup.memoryMax}`, `cpu.max     ${data.cgroup.cpuMax}`, `cpu.weight  ${data.cgroup.cpuWeight}`, `a loop that wants a whole CPU gets ${data.cgroup.usedPct}% (throttled ${data.cgroup.throttledPeriods})`],
      [`garden-m02 10.244.1.0/24 · the Pod hangs on a veth`, `10.244.0.0/24 via 192.168.67.2`, `10.244.2.0/24 via 192.168.67.4`, `ping a Pod on the same node: TTL ${data.ttl.sameNode}`, `ping a Pod on another node: TTL ${data.ttl.otherNode}`],
    ],
  },
};

export default function NodeLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const sp = useStepper(T.steps.length, 3200);
  const k = sp.step;
  const lines = T.lines[k];
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <div className="viz-box">
        <svg viewBox="0 0 880 484" role="img" aria-label={T.title}>
          <rect className="ib-node" x={14} y={14} width={852} height={290} rx={16} style={{ strokeDasharray: '10 6' }} />
          <text x={30} y={42} className="ib-n">garden-m02 (worker)</text>
          <Tile x={40} y={64} w={180} h={54} title={T.kubelet} state={k === 0 ? 'on' : 'plain'} />
          <Arrow x1={130} y1={120} x2={130} y2={156} op={k === 0 ? 1 : 0.35} />
          <Tile x={40} y={158} w={180} h={54} title={T.sock} state={k === 0 ? 'on' : 'plain'} />
          <Arrow x1={130} y1={214} x2={130} y2={246} op={k >= 1 ? 1 : 0.3} />
          <rect className={k >= 1 ? 'nw-cell on' : 'nw-cell'} x={250} y={64} width={300} height={196} rx={14} style={k < 1 ? { strokeDasharray: '7 5', opacity: 0.5 } : undefined} />
          <text x={266} y={90} className="ib-n">Pod lim</text>
          <Tile x={270} y={104} w={260} h={42} title={T.pause} state={k === 1 || k === 2 ? 'on' : 'plain'} op={k >= 1 ? 1 : 0.4} />
          <Tile x={270} y={158} w={120} h={46} title={T.a} state={k === 3 ? 'on' : 'plain'} op={k >= 1 ? 1 : 0.4} />
          <Tile x={410} y={158} w={120} h={46} title={T.b} state={k === 3 ? 'plain' : 'plain'} op={k >= 1 ? 1 : 0.4} />
          <text x={270} y={236} className="ib-s">{k >= 2 ? (lang === 'th' ? 'net ร่วมกัน · mnt, pid แยก' : 'net shared · mnt, pid separate') : ''}</text>
          <Tile x={40} y={246} w={180} h={54} title={k === 4 ? 'veth' : 'cgroup /kubepods'} state={k >= 3 ? 'on' : 'plain'} op={k >= 3 ? 1 : 0.35} />
          <rect className="ib-node" x={14} y={318} width={852} height={152} rx={14} />
          <text x={30} y={346} className="ib-n">{T.panel[k]}</text>
          {lines.map((l, i) => <text key={i} x={30} y={374 + i * 24} className="ib-m" style={{ fill: 'var(--fg)', fontSize: 15 }}>{l}</text>)}
        </svg>
      </div>
      <StepControls steps={T.steps} step={k} playing={sp.playing} go={sp.go} toggle={sp.toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
