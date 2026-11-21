import { useState } from 'react';
import { Lines } from '../iceberg/ib';
import { Seg, Tile, Arrow, type Lang, type TileState } from './dv';

// Shows:      three columns, what the code asks for, what the state file remembers it made, and what really exists on disk, for five situations of a real Terraform run (first apply, nothing changed,
//             the code changed, somebody edited a file by hand, somebody deleted a file by hand). Under them the line that terraform plan printed.
// Because:    Terraform's plan is the difference between three things, not two. A reader who thinks "code vs. world" cannot explain why the state file exists or why a hand edit shows up as "will be created".
// Control:    the situation. Each one changes cards in at least one column and the plan line.
// Conclusion: plan compares the code with the state after refreshing the state from the world; whatever differs becomes an action, and apply makes all three columns equal again.
//
// The plan lines are the real ones of exercises/06_infrastructure_as_code.py (Terraform 1.16.6, provider hashicorp/local 2.5): the two files are local_file resources.

type Sit = 'first' | 'same' | 'code' | 'edit' | 'del';
interface Cell { text: string; st: TileState }
interface Col { config: Cell; motd: Cell }
const NONE: Cell = { text: '—', st: 'skip' };
const ok = (t: string): Cell => ({ text: t, st: 'ok' });
const on = (t: string): Cell => ({ text: t, st: 'on' });
const bad = (t: string): Cell => ({ text: t, st: 'bad' });
const V = 'version 1.0.0', V2 = 'version 1.1.0', HAND = 'version 9.9.9';

const SITS: Record<Sit, { code: Col; state: Col; real: Col; plan: string; action: Record<'th' | 'en', string> }> = {
  first: { code: { config: on(V), motd: on('welcome…') }, state: { config: NONE, motd: NONE }, real: { config: NONE, motd: NONE }, plan: 'Plan: 2 to add, 0 to change, 0 to destroy.', action: { th: 'ยังไม่มีอะไรเลย: สร้างสองไฟล์', en: 'nothing exists yet: create both files' } },
  same: { code: { config: ok(V), motd: ok('welcome…') }, state: { config: ok(V), motd: ok('welcome…') }, real: { config: ok(V), motd: ok('welcome…') }, plan: 'No changes. Your infrastructure matches the configuration.', action: { th: 'ทั้งสามคอลัมน์ตรงกัน: ไม่ต้องทำอะไร (รัน apply ซ้ำก็ไม่เปลี่ยนอะไร)', en: 'all three columns agree: nothing to do (a second apply changes nothing either)' } },
  code: { code: { config: on(V2), motd: ok('welcome…') }, state: { config: ok(V), motd: ok('welcome…') }, real: { config: ok(V), motd: ok('welcome…') }, plan: 'Plan: 1 to add, 0 to change, 1 to destroy.', action: { th: 'โค้ดเปลี่ยน: ไฟล์ config ต้องถูกแทนที่ (must be replaced) ส่วน motd ไม่ถูกแตะ', en: 'the code changed: the config file must be replaced, the motd is not touched' } },
  edit: { code: { config: ok(V2), motd: ok('welcome…') }, state: { config: ok(V2), motd: ok('welcome…') }, real: { config: bad(HAND), motd: ok('welcome…') }, plan: 'Plan: 1 to add, 0 to change, 0 to destroy.  # local_file.config will be created', action: { th: 'มีคนแก้ไฟล์ด้วยมือ: Provider อ่านไฟล์ตอน Refresh เห็นเนื้อหาไม่ตรง จึงตัดมันออกจาก State แล้วแผนคือสร้างใหม่', en: 'somebody edited the file by hand: the provider reads the file on refresh, sees other content, drops it from the state, and the plan is to create it again' } },
  del: { code: { config: ok(V2), motd: ok('welcome…') }, state: { config: ok(V2), motd: ok('welcome…') }, real: { config: ok(V2), motd: NONE }, plan: 'Plan: 1 to add, 0 to change, 0 to destroy.  # local_file.motd', action: { th: 'มีคนลบไฟล์ด้วยมือ: แผนคือสร้างไฟล์ motd ขึ้นมาใหม่', en: 'somebody deleted the file by hand: the plan is to create the motd file again' } },
};

const TEXT: Record<Lang, { title: string; caption: string; sit: string; sits: Record<Sit, string>; code: string; state: string; real: string; codeSub: string; stateSub: string; realSub: string; plan: string; apply: string }> = {
  th: {
    title: 'เลือกเหตุการณ์ แล้วดูว่าโค้ด State และของจริงตรงกันหรือไม่ Terraform เขียนแผนว่าอย่างไร',
    caption: 'บรรทัดแผนเป็นผลจริงของแบบฝึก 06 (Terraform 1.16.6 กับ Provider hashicorp/local) ทรัพยากรคือไฟล์สองไฟล์บนดิสก์ เพราะนั่นคือสิ่งที่รันได้โดยไม่ต้องมีบัญชี Cloud',
    sit: 'เหตุการณ์', sits: { first: 'ครั้งแรก', same: 'ไม่มีอะไรเปลี่ยน', code: 'แก้โค้ด', edit: 'มีคนแก้ไฟล์เอง', del: 'มีคนลบไฟล์เอง' },
    code: 'โค้ด', state: 'State', real: 'ของจริง', codeSub: 'main.tf บอกว่าอยากได้อะไร', stateSub: 'terraform.tfstate จำว่าเคยสร้างอะไร', realSub: 'ไฟล์ที่มีอยู่จริงบนดิสก์', plan: 'terraform plan', apply: 'apply แล้ว ทั้งสามคอลัมน์จะตรงกัน',
  },
  en: {
    title: 'Choose a situation and see whether the code, the state and the real thing agree, and what plan Terraform writes',
    caption: 'The plan lines are the real ones of exercise 06 (Terraform 1.16.6 with the provider hashicorp/local). The resources are two files on disk, because that is what runs without a cloud account.',
    sit: 'situation', sits: { first: 'first time', same: 'nothing changed', code: 'edit the code', edit: 'somebody edits a file', del: 'somebody deletes a file' },
    code: 'code', state: 'state', real: 'the real thing', codeSub: 'main.tf says what we want', stateSub: 'terraform.tfstate remembers what was made', realSub: 'the files that exist on disk', plan: 'terraform plan', apply: 'after apply, all three columns agree',
  },
};

export default function IacLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [sit, setSit] = useState<Sit>('code');
  const S = SITS[sit];
  const cols: { id: 'code' | 'state' | 'real'; x: number; title: string; sub: string }[] = [
    { id: 'code', x: 20, title: T.code, sub: T.codeSub },
    { id: 'state', x: 320, title: T.state, sub: T.stateSub },
    { id: 'real', x: 620, title: T.real, sub: T.realSub },
  ];
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Seg label={T.sit} options={(Object.keys(T.sits) as Sit[]).map((k) => ({ id: k, text: T.sits[k] }))} value={sit} onChange={setSit} />
      <div className="viz-box">
        <svg viewBox="0 0 880 446" role="img" aria-label={T.title}>
          {cols.map((c) => (
            <g key={c.id}>
              <text x={c.x + 120} y={30} textAnchor="middle" className="ib-t">{c.title}</text>
              <text x={c.x + 120} y={52} textAnchor="middle" className="ib-s">{c.sub}</text>
              <Tile x={c.x} y={70} w={240} h={70} title="config.json" sub={S[c.id].config.text} state={S[c.id].config.st} />
              <Tile x={c.x + 0} y={158} w={240} h={70} title="motd.txt" sub={S[c.id].motd.text} state={S[c.id].motd.st} />
            </g>
          ))}
          <Arrow x1={262} y1={140} x2={316} y2={140} dashed />
          <Arrow x1={562} y1={140} x2={618} y2={140} dashed />
          <text x={440} y={262} textAnchor="middle" className="ib-n">{T.plan}</text>
          <rect className="ib-banner" x={20} y={274} width={840} height={42} rx={8} />
          <text x={34} y={301} className="ib-m" style={{ fill: 'var(--fg)', fontSize: 15 }}>{S.plan}</text>
          <rect className="ib-banner" x={12} y={330} width={856} height={76} rx={10} />
          <Lines x={26} y={360} text={S.action[lang]} max={88} lh={24} className="ib-n" />
          <text x={20} y={430} className="ib-s">{sit === 'same' ? '' : T.apply}</text>
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
