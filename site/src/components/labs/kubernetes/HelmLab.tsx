import { StepControls, useStepper, type StepInfo } from '../spark/stepper';
import { Tile, Arrow, type Lang } from '../devops/dv';
import data from './ops.json';

// Shows:      on the left the chart (templates plus default values) and the numbers that come out of it with -f and --set; in the middle a tower of release revisions, each a card with the values it was made with and a
//             status; on the right what is really running. The reader steps through install, upgrade, rollback, a bad upgrade and a rollback again, and sees the tower grow by one card each time.
// Because:    "history only grows" and "a rollback is a new revision" are about a stack of cards, and a failed upgrade is a card in the stack while the Pods on the right still belong to the card before it.
// Control:    the step buttons.
// Conclusion: Helm keeps every revision as a Secret and moves forward even when you go back. A failed upgrade does not take the running Pods away.
//
// Statuses and revision numbers are those printed by exercises/14_helm_hpa_debug.py (ops.json): revisions 1 to 5 with 4 failed and 5 deployed, values 2 / 5 / 7 / 9 for default, --set, -f and -f with --set.

type Card = { rev: number; replicas: number; msg: string; image: string; status: string };
const H = data.history;
const CARDS: Card[] = [
  { rev: 1, replicas: 2, msg: 'v1', image: 'busybox:1.37', status: H[0].status },
  { rev: 2, replicas: 3, msg: 'v2', image: 'busybox:1.37', status: H[1].status },
  { rev: 3, replicas: 2, msg: 'v1', image: 'busybox:1.37', status: H[2].status },
  { rev: 4, replicas: 2, msg: 'v1', image: 'busybox:no-such-tag', status: H[3].status },
  { rev: 5, replicas: 2, msg: 'v1', image: 'busybox:1.37', status: H[4].status },
];
// step k shows revisions up to SHOWN[k]; the status each card has at that moment; the Pods that are running
const SHOWN = [0, 1, 2, 3, 4, 5];
const STATUS_AT = (k: number, i: number) => {
  const final = CARDS[i].status;
  if (i === k - 1) return final === 'superseded' ? 'deployed' : final;
  return final;
};
const RUN = [null, CARDS[0], CARDS[1], CARDS[2], CARDS[2], CARDS[4]];

const TEXT: Record<Lang, { title: string; caption: string; steps: StepInfo[]; chart: string; vals: string[]; run: string; none: string; secret: string }> = {
  th: {
    title: 'กดถัดไปทีละขั้น ดูว่า Revision ของ Release ซ้อนกันอย่างไร และ Pod ที่รันอยู่เป็นของ Revision ไหน',
    caption: 'หมายเลข Revision และสถานะ (superseded, deployed, failed) คือผลที่พิมพ์จาก helm history ในการรันจริงของแบบฝึก 14 (Helm v3.13.3) และตัวเลข 2, 5, 7, 9 คือจำนวน replicas ที่ helm template พิมพ์ออกมา',
    chart: 'Chart webapp', vals: ['ค่าเริ่มต้น 2', '--set replicas=5', '-f prod.yaml 7', '-f และ --set 9'], run: 'สิ่งที่รันอยู่จริง', none: 'ยังไม่มีอะไร', secret: 'Secret ของแต่ละ Revision',
    steps: [
      { name: 'Template', title: 'Chart คือแม่แบบกับค่าเริ่มต้น helm template แค่พิมพ์ YAML', text: 'ลำดับความสำคัญของค่าคือ ค่าเริ่มต้น ต่ำกว่า -f ไฟล์ ต่ำกว่า --set และตอนนี้ยังไม่มีอะไรถูกสร้างในคลัสเตอร์' },
      { name: 'Install', title: 'helm install สร้าง Release ที่ Revision 1', text: 'ได้ Deployment กับ Service ที่ติด Label managed-by Helm และ Helm เก็บ Revision นี้ไว้เป็น Secret ชื่อ sh.helm.release.v1.demo.v1' },
      { name: 'Upgrade', title: 'helm upgrade เป็น Revision 2 (replicas 3, ข้อความ v2)', text: 'Revision 1 ถูกทำเครื่องหมายว่า superseded และ Pod ถูกอัปเดตแบบ Rolling' },
      { name: 'Rollback', title: 'helm rollback 1 ได้ Revision 3 ที่มีเนื้อหาเหมือน Revision 1', text: 'ประวัติไม่ย้อนกลับ มันเดินหน้าต่อโดยสร้าง Revision ใหม่ที่ก๊อปเนื้อหาของเก่า' },
      { name: 'Upgrade พัง', title: 'อัปเดตด้วย Image ที่ไม่มีอยู่ ได้ Revision 4 สถานะ failed', text: '--wait รอแล้วหมดเวลา คำสั่งล้มเหลว แต่ Pod ของ Revision 3 ยังรับงานอยู่ (ฝั่งขวายังเป็น Revision 3)' },
      { name: 'Rollback อีกครั้ง', title: 'helm rollback 3 ได้ Revision 5 สถานะ deployed', text: 'Release กลับมาปกติ และมีประวัติครบห้า Revision' },
    ],
  },
  en: {
    title: 'Press Next one step at a time and see how the revisions of a release stack up, and which revision the running Pods belong to',
    caption: 'Revision numbers and statuses (superseded, deployed, failed) are what helm history printed in the real run of exercise 14 (Helm v3.13.3), and 2, 5, 7, 9 are the replica counts that helm template printed.',
    chart: 'chart webapp', vals: ['default 2', '--set replicas=5', '-f prod.yaml 7', '-f and --set 9'], run: 'what is really running', none: 'nothing yet', secret: 'one Secret per revision',
    steps: [
      { name: 'Template', title: 'A chart is templates plus default values. helm template only prints YAML', text: 'Values are overridden in this order: defaults, then a -f file, then --set. Nothing has been created in the cluster yet.' },
      { name: 'Install', title: 'helm install creates a release at revision 1', text: 'It makes a Deployment and a Service labelled managed-by Helm, and Helm stores this revision as a Secret named sh.helm.release.v1.demo.v1.' },
      { name: 'Upgrade', title: 'helm upgrade makes revision 2 (replicas 3, message v2)', text: 'Revision 1 is marked superseded and the Pods are updated by a rolling update.' },
      { name: 'Rollback', title: 'helm rollback 1 gives revision 3, with the content of revision 1', text: 'History does not go backwards. It moves on by creating a new revision that copies the old content.' },
      { name: 'Bad upgrade', title: 'An upgrade with an image that does not exist gives revision 4, status failed', text: '--wait times out and the command fails, but the Pods of revision 3 are still serving (the right side is still revision 3).' },
      { name: 'Rollback again', title: 'helm rollback 3 gives revision 5, status deployed', text: 'The release is healthy again, with five revisions in its history.' },
    ],
  },
};

export default function HelmLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const sp = useStepper(T.steps.length, 3200);
  const k = sp.step;
  const shown = SHOWN[k];
  const run = RUN[k];
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <div className="viz-box">
        <svg viewBox="0 0 880 400" role="img" aria-label={T.title}>
          <rect className={k === 0 ? 'nw-cell on' : 'nw-cell'} x={14} y={14} width={236} height={230} rx={12} />
          <text x={28} y={42} className="ib-n">{T.chart}</text>
          {T.vals.map((v, i) => <text key={v} x={28} y={78 + i * 30} className="ib-m" style={{ fill: 'var(--fg)', fontSize: 14, opacity: k === 0 ? 1 : 0.55 }}>{v}</text>)}
          <text x={28} y={210} className="ib-s">templates/ + values.yaml</text>
          <Arrow x1={252} y1={130} x2={296} y2={130} op={k >= 1 ? 1 : 0.2} />
          <text x={300} y={34} className="ib-s">{T.secret}</text>
          {CARDS.map((c, i) => {
            const on = i < shown;
            const st = on ? STATUS_AT(k, i) : '';
            const y = 330 - i * 62;
            return (
              <g key={c.rev} style={{ opacity: on ? 1 : 0 }}>
                <Tile x={300} y={y - 24} w={280} h={54} title={`revision ${c.rev} · ${st}`} sub={`replicas ${c.replicas} · ${c.msg} · ${c.image.replace('busybox:', '')}`} state={st === 'failed' ? 'bad' : st === 'deployed' ? 'ok' : 'skip'} op={on ? 1 : 0} />
              </g>
            );
          })}
          <rect className="ib-node" x={620} y={14} width={246} height={230} rx={12} />
          <text x={634} y={42} className="ib-n">{T.run}</text>
          {run
            ? <>
                <text x={634} y={72} className="ib-m" style={{ fill: 'var(--fg)' }}>revision {run.rev}</text>
                {Array.from({ length: run.replicas }, (_, i) => <Tile key={i} x={634 + (i % 3) * 74} y={92 + Math.floor(i / 3) * 52} w={66} h={42} title={run.msg} state="ok" />)}
                {k === 4 && <text x={634} y={216} className="ib-s" style={{ fill: 'var(--ib-bad)' }}>rev 4: ImagePullBackOff</text>}
              </>
            : <text x={634} y={72} className="ib-s">{T.none}</text>}
          <Arrow x1={584} y1={130} x2={618} y2={130} op={run ? 1 : 0.2} />
        </svg>
      </div>
      <StepControls steps={T.steps} step={k} playing={sp.playing} go={sp.go} toggle={sp.toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
