import { useState } from 'react';
import { Lines } from '../iceberg/ib';
import { Seg, Tile, Arrow, type Lang, type TileState } from './dv';

// Shows:      the pipeline as a line of five stations (secret scan, dependency check, build, image scan, deploy) and four different threats. Pick a threat and see which station stops it, which stations it has
//             already passed or never reaches, and the real numbers of what the scan found.
// Because:    "shift security left" is about WHERE on the line a thing is stopped. The same four threats stopped at different stations would cost different amounts; the reader needs to see the threat travel and stop.
// Control:    the threat (a key in an old commit, a dependency with a known hole, the same dependency list a month later, an old image).
// Conclusion: each check catches a different kind of thing at a different place, and some things only become dangerous AFTER the build (a new advisory), which is why the bill of materials is kept and matched again.
//
// Real: the history scan finds a key that the files no longer hold and git log -S names two commits; the SBOM matches one advisory on day 1 and three on day 30 without any new build; Trivy 0.67.2 finds
// 101 vulnerabilities (11 critical) on nginx:1.21-alpine and flags the operating system as out of support (EOSL). All from exercises/11_devsecops.py. The advisories of the SBOM check are invented for the exercise.

type Threat = 'secret' | 'dep1' | 'dep30' | 'image';
const STATIONS = ['secret', 'deps', 'build', 'image', 'deploy'] as const;
const CATCH: Record<Threat, number> = { secret: 0, dep1: 1, dep30: 1, image: 3 };

const TEXT: Record<Lang, { title: string; caption: string; threat: string; threats: Record<Threat, string>; st: Record<(typeof STATIONS)[number], [string, string]>; blocked: string; passed: string; never: string; detail: Record<Threat, string>; after: string }> = {
  th: {
    title: 'เลือกสิ่งที่เป็นภัย แล้วดูว่า Pipeline ด่านไหนจับมันได้ ด่านก่อนหน้าผ่านไปแล้ว และด่านหลังไม่ต้องเจอมันเลย',
    caption: 'ผลของการสแกนทั้งหมดมาจากแบบฝึก 11 (11_devsecops.py): สแกน History ของ Git จริง, จับคู่ SBOM กับรายการช่องโหว่ที่แต่งขึ้นสำหรับแบบฝึก และ Trivy 0.67.2 กับฐานข้อมูลช่องโหว่จริงสแกนบน nginx:1.21-alpine จำนวนช่องโหว่ของ Image เปลี่ยนทุกวันตามฐานข้อมูล',
    threat: 'สิ่งที่เป็นภัย', threats: { secret: 'Key ที่เคย Commit ไว้', dep1: 'Dependency ที่มีช่องโหว่ (วันแรก)', dep30: 'ลิสต์เดิม ผ่านไป 30 วัน', image: 'Image ฐานที่หมดการสนับสนุน' },
    st: { secret: ['สแกน Secret', 'อ่านทั้ง History'], deps: ['ตรวจ Dependency', 'จับคู่ SBOM กับช่องโหว่'], build: ['Build Image', 'Transformation'], image: ['สแกน Image', 'Trivy'], deploy: ['Deploy', 'ขึ้น Production'] },
    blocked: 'หยุดที่นี่', passed: 'ผ่านแล้ว', never: 'ไม่ต้องไปถึง', after: 'ถ้าไม่ถูกจับที่ด่านนี้ ภัยจะไปต่อจนถึงด่านถัดไป',
    detail: {
      secret: 'สแกนไฟล์ปัจจุบันไม่เจออะไรเลย เพราะลบบรรทัดแล้ว แต่สแกน History เจอ AKIAIOSFODNN7EXAMPLE ใน Commit ที่เพิ่มมัน และ git log -S ชี้ได้ว่าสอง Commit ที่แตะมัน (ที่เพิ่ม กับที่ลบ) Key ยังอยู่ใน Object Store ของ Git',
      dep1: 'SBOM ของโปรเจกต์ลิสต์ 5 แพ็กเกจ (pin เวอร์ชัน) และรายการช่องโหว่ (ที่แต่งขึ้น) ของวันแรกตรงกับ 1 ตัว คือ pyyaml ระดับ critical Gate ที่ตั้งให้ล้มตั้งแต่ระดับ high จึงหยุด Build',
      dep30: 'อีก 30 วัน รายการช่องโหว่ (ที่แต่งขึ้น) มี 3 ตัวที่ตรงกับ SBOM ตัวเดิม (requests ระดับ high, jinja2 ระดับ medium และ pyyaml ระดับ critical) โดยไม่มี Build ใหม่ ไบต์เดิมกลายเป็นมีความเสี่ยง จึงต้องเก็บ SBOM ไว้จับคู่ซ้ำ',
      image: 'Trivy พบช่องโหว่ 101 รายการ (11 รายการเป็น critical) บน nginx:1.21-alpine และบอกว่าระบบปฏิบัติการ (Alpine 3.15) หมดการสนับสนุน (EOSL) ซึ่งเป็นสัญญาณที่ต้องอัปเดต Base Image นับจำนวนช่องโหว่เฉย ๆ ไม่เล่าเรื่องนี้ครบ',
    },
  },
  en: {
    title: 'Choose a threat and see which station of the pipeline stops it, which stations it has already passed, and which it never has to reach',
    caption: 'All scan results are from exercise 11 (11_devsecops.py): a scan of a real Git history, an SBOM matched against a list of advisories made up for the exercise, and Trivy 0.67.2 with its real vulnerability database scanning nginx:1.21-alpine. The number of vulnerabilities of an image changes every day with the database.',
    threat: 'the threat', threats: { secret: 'a key once committed', dep1: 'a vulnerable dependency (day 1)', dep30: 'the same list, 30 days later', image: 'a base image out of support' },
    st: { secret: ['secret scan', 'reads the whole history'], deps: ['dependency check', 'match SBOM to advisories'], build: ['build image', 'transformation'], image: ['image scan', 'Trivy'], deploy: ['deploy', 'to production'] },
    blocked: 'stopped here', passed: 'passed', never: 'never reached', after: 'If it is not caught at this station, the threat goes on to the next',
    detail: {
      secret: 'A scan of the files as they are now finds nothing, because the line was removed, but a scan of the history finds AKIAIOSFODNN7EXAMPLE in the commit that added it, and git log -S names the two commits that touched it (added, removed). The key is still in the object store of Git.',
      dep1: 'The SBOM of the project lists 5 pinned packages and the advisory list (invented) of day 1 matches 1 of them: pyyaml, critical. A gate set to fail from high stops the build.',
      dep30: 'Thirty days later the advisory list (invented) has 3 matches with the same SBOM (requests, high; jinja2, medium; pyyaml, critical) with no new build. The same bytes became risky, which is why we keep the SBOM to match it again.',
      image: 'Trivy found 101 vulnerabilities (11 critical) in nginx:1.21-alpine and says the operating system (Alpine 3.15) is out of support (EOSL), a signal to update the base image. A bare count of vulnerabilities does not tell this whole story.',
    },
  },
};

export default function GatesLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [th, setTh] = useState<Threat>('secret');
  const at = CATCH[th];
  const state = (i: number): { s: TileState; sub: string } => {
    if (i < at) return { s: 'ok', sub: '✓ ' + T.passed };
    if (i === at) return { s: 'bad', sub: '✗ ' + T.blocked };
    return { s: 'skip', sub: T.never };
  };
  const xs = [20, 190, 360, 530, 700];
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Seg label={T.threat} options={(Object.keys(T.threats) as Threat[]).map((k) => ({ id: k, text: T.threats[k] }))} value={th} onChange={setTh} />
      <div className="viz-box">
        <svg viewBox="0 0 880 420" role="img" aria-label={T.title}>
          <text x={20} y={30} className="ib-t">Commit → Pipeline → Production</text>
          {STATIONS.map((s, i) => {
            const st = i === 2 ? { s: (at >= 3 ? 'ok' : 'skip') as TileState, sub: at >= 3 ? '✓ ' + T.passed : T.never } : state(i);
            const isGate = i !== 2 && i !== 4;
            const sub = i === 4 ? (at > 3 ? '' : T.never) : st.sub;
            return (
              <g key={s}>
                <Tile x={xs[i]} y={56} w={160} h={90} title={T.st[s][0]} sub={sub} state={i === 4 ? 'skip' : st.s} />
                <text x={xs[i] + 80} y={170} textAnchor="middle" className="ib-s">{T.st[s][1]}</text>
                {i < 4 && <Arrow x1={xs[i] + 162} y1={101} x2={xs[i + 1] - 2} y2={101} bad={i === at} op={i <= at ? 1 : 0.3} dashed={i > at} />}
                {isGate && i === at && <path d={`M${xs[i] + 80},56 v-16`} style={{ stroke: 'var(--ib-bad)', strokeWidth: 4 }} />}
              </g>
            );
          })}
          <circle cx={xs[at] + 80} cy={30} r={0} />
          <rect className="ib-banner" x={12} y={200} width={856} height={170} rx={10} />
          <Lines x={26} y={232} text={T.detail[th]} max={88} lh={26} className="ib-n" />
          <text x={20} y={402} className="ib-s">{T.after}</text>
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
