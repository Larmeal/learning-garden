import { ClockControls, useClock, prog, smooth, mix, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Tile, type Lang } from '../devops/dv';
import data from './ops.json';

// Shows:      a gauge of the average CPU of the Pods (as a percent of what each asked for) with a line at the target 50%, and up to four Pod tiles under it. A busy loop starts, the gauge goes over the line, Pods are added,
//             the gauge falls back, then the load stops, the gauge drops to zero and the Pods are taken away only after a wait.
// Because:    the HPA is a thermostat. The reader has to see the number it reads, the line it compares with, and the delay in both directions, which no sentence conveys.
// Control:    play, scrub and jump.
// Conclusion: desired replicas = ceil(current replicas x current utilization / target), limited by min and max. It goes up quickly and down slowly on purpose.
//
// Real run: exercises/14_helm_hpa_debug.py (ops.json). One busy container limited to 200m with a request of 100m read 200% against a target of 50%, the HPA went from 1 to 4 Pods (the maximum), and after the load stopped
// it took 120 s to return to 1 with a 20 s stabilization window. The time axis here is compressed and the curve between the readings is drawn by hand.

const D = 12;
const U = data.hpa.utilization;

const TEXT: Record<Lang, { title: string; caption: string; gauge: string; target: string; replicas: string; marks: Mark[]; banner: (t: number) => string }> = {
  th: {
    title: 'กดเล่นแล้วดูเข็มวัด CPU เฉลี่ย เมื่อเกินเส้นเป้าหมาย 50% จำนวน Pod จะเพิ่ม และเมื่อโหลดหายก็ลดลงช้ากว่า',
    caption: `ผลจริงของแบบฝึก 14: Container ที่วนลูปเต็มแต่ถูก limit ไว้ ${U}m จาก request 100m อ่านได้ ${U}% เทียบกับเป้า 50% HPA เพิ่มจาก 1 เป็น 4 (ค่าสูงสุด) ใช้เวลารวม ${data.hpa.upSeconds} วินาที (ส่วนใหญ่คือรอ metrics-server อ่านค่าแรก) และหลังหยุดโหลดใช้ ${data.hpa.downSeconds} วินาทีจึงกลับเป็น 1 แกนเวลาในภาพถูกย่อ และเส้นระหว่างจุดอ่านค่าวาดเอง`,
    gauge: 'CPU เฉลี่ยต่อ request', target: 'เป้า 50%', replicas: 'replicas',
    marks: [
      { at: 0, name: 'เริ่ม', title: 'Pod ตัวเดียวกำลังวนลูปเต็มที่', text: 'ใช้ CPU 200% ของที่ขอไว้ แต่ HPA ยังไม่ได้อ่านค่า' },
      { at: 3, name: 'อ่านค่า', title: 'metrics-server รายงาน 200% เทียบกับเป้า 50%', text: 'จำนวนที่ต้องการ = ceil(1 x 200 / 50) = 4' },
      { at: 4.5, name: 'เพิ่ม Pod', title: 'HPA ตั้ง replicas เป็น 4', text: 'ถึงค่าสูงสุดที่ตั้งไว้พอดี เมื่อ Pod ใหม่ช่วยรับโหลด ค่าเฉลี่ยจะลดลงมาใกล้เป้า' },
      { at: 7, name: 'โหลดหาย', title: 'หยุดวนลูป CPU เหลือเกือบ 0', text: 'HPA ไม่ลด Pod ทันที' },
      { at: 10.5, name: 'ลดลง', title: 'หลังหน้าต่างรอ (stabilization) HPA ลดเหลือ 1', text: 'ขึ้นเร็วลงช้าโดยตั้งใจ เพื่อไม่ให้จำนวน Pod แกว่งตามโหลดที่ขึ้นลงชั่วครู่' },
    ],
    banner: (t) => t < 3 ? 'ยังไม่มีค่า CPU ให้ HPA อ่าน' : t < 4.5 ? 'เกินเป้า: ต้องเพิ่ม' : t < 7 ? 'Pod ช่วยกันรับโหลด ค่าเฉลี่ยลดลง' : t < 10.5 ? 'โหลดหายแล้ว แต่ยังรอก่อนลด' : 'ลดเหลือ 1',
  },
  en: {
    title: 'Press play and watch the average CPU gauge: above the 50% target line the number of Pods goes up, and when the load goes away it comes down more slowly',
    caption: `Real result of exercise 14: a container in a busy loop, held to ${U}m with a request of 100m, read ${U}% against a target of 50%. The HPA went from 1 to 4 (the maximum) in ${data.hpa.upSeconds} s in all (mostly waiting for the first reading from metrics-server), and after the load stopped it took ${data.hpa.downSeconds} s to return to 1. The time axis is compressed and the curve between readings is drawn by hand.`,
    gauge: 'average CPU per request', target: 'target 50%', replicas: 'replicas',
    marks: [
      { at: 0, name: 'Start', title: 'One Pod is in a busy loop', text: 'It uses 200% of what it asked for, but the HPA has not read it yet.' },
      { at: 3, name: 'First reading', title: 'metrics-server reports 200% against a target of 50%', text: 'Desired = ceil(1 x 200 / 50) = 4.' },
      { at: 4.5, name: 'Scale up', title: 'The HPA sets replicas to 4', text: 'Exactly the maximum it was given. As the new Pods share the load the average falls toward the target.' },
      { at: 7, name: 'Load stops', title: 'The loop stops and CPU falls to almost 0', text: 'The HPA does not remove Pods at once.' },
      { at: 10.5, name: 'Scale down', title: 'After the stabilization window the HPA goes back to 1', text: 'Up fast and down slowly is deliberate, so that the Pod count does not swing with brief changes in load.' },
    ],
    banner: (t) => t < 3 ? 'No CPU reading for the HPA yet' : t < 4.5 ? 'Over the target: add Pods' : t < 7 ? 'The Pods share the load and the average falls' : t < 10.5 ? 'The load is gone, but wait before scaling down' : 'Back to 1',
  },
};

export default function AutoscaleLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const clock = useClock(D);
  const t = clock.t;
  const reps = t < 4.5 ? 1 : t < 10.5 ? 4 : 1;
  // average utilization (percent of request) drawn by hand between readings
  const u = t < 3 ? 0 : t < 4.5 ? mix(0, U, smooth(prog(t, 3, 3.6))) : t < 7 ? mix(U, 50, smooth(prog(t, 4.5, 6.5))) : mix(50, 0, smooth(prog(t, 7, 7.8)));
  const x = (v: number) => 40 + (v / 250) * 800;
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <div className="viz-box">
        <svg viewBox="0 0 880 300" role="img" aria-label={T.title}>
          <text x={40} y={34} className="ib-n">{T.gauge}</text>
          <rect x={40} y={50} width={800} height={40} rx={8} style={{ fill: 'var(--surface-2)', stroke: 'var(--line-strong)' }} />
          <rect x={40} y={50} width={Math.max(0, x(u) - 40)} height={40} rx={8} style={{ fill: u > 50 ? 'var(--ib-bad)' : 'var(--k2)' }} />
          <path d={`M${x(50)},42 v56`} style={{ stroke: 'var(--accent)', strokeWidth: 4 }} />
          <text x={x(50)} y={118} textAnchor="middle" className="ib-s">{T.target}</text>
          <text x={840} y={118} textAnchor="end" className="ib-big" style={{ fontSize: 30 }}>{Math.round(u)}%</text>
          <text x={40} y={168} className="ib-n">{T.replicas}</text>
          {Array.from({ length: 4 }, (_, i) => <Tile key={i} x={40 + i * 130} y={182} w={110} h={50} title="Pod" state={i < reps ? 'ok' : 'skip'} op={i < reps ? 1 : 0.3} />)}
          <Banner y={246} text={T.banner(t)} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
