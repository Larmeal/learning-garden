import { useState } from 'react';
import { Seg, Tile, Arrow, type Lang } from '../devops/dv';
import data from './capstone.json';

// Shows:      the whole capstone namespace as one picture: a Secret and a ConfigMap at the top, the database (a StatefulSet Pod db-0 with its PersistentVolumeClaim, behind a Service and a NetworkPolicy shield) on the right,
//             and the loader (a Job with an init container, made again by a CronJob) on the left. The reader picks "all fine" or one of three breakages and sees which box turns orange and what its status says.
// Because:    the point of the capstone is that each breakage shows up in a different place and is read with a different command. A picture of the whole thing is the map that tells where to look.
// Control:    the situation (all fine, Secret key typo, database Pod deleted, loader with the wrong label).
// Conclusion: a failure has a place: a volume that cannot mount (Pod stuck before init), a Pod that is deleted (it comes back and the data stays because the claim stays), a policy that blocks (init container waits). Read events, not guesses.
//
// Real run: exercises/15_capstone_pipeline.py (capstone.json): 1000 rows, a second run from the CronJob adds 0, the Secret key typo gives the FailedMount event shown, db-0 back in 3 s with 1000 rows, and a loader with role=etl stuck in Init:0/1.

type Sit = 'ok' | 'typo' | 'del' | 'label';

const TEXT: Record<Lang, { title: string; caption: string; sit: string; sits: Record<Sit, string>; loader: string; db: string; pol: string; note: Record<Sit, string>; status: Record<Sit, string> }> = {
  th: {
    title: 'เลือกสถานการณ์ แล้วดูว่ากล่องไหนเปลี่ยนเป็นสีส้มและสถานะของมันบอกอะไร',
    caption: `ทุกสถานการณ์มาจากการรันจริงในแบบฝึก 15: ตารางมี ${data.rows} แถว Run ที่สองจาก CronJob เพิ่ม 0 แถว (ON CONFLICT DO NOTHING), db-0 กลับมาใน ${data.recoverSeconds} วินาทีพร้อมข้อมูลครบ, และ Loader ที่ใช้ Label ผิดค้างที่ ${data.blocked}`,
    sit: 'สถานการณ์', sits: { ok: 'ปกติ', typo: 'พิมพ์ชื่อ Key ของ Secret ผิด', del: 'ลบ Pod ของฐานข้อมูล', label: 'Loader ใช้ Label ผิด' },
    loader: 'Loader Job', db: 'db-0 (Postgres)', pol: 'NetworkPolicy: เข้าได้เฉพาะ role=loader',
    note: {
      ok: `ฐานข้อมูล Ready, Loader รอ db ด้วย init container แล้วโหลด ${data.rows} แถวด้วย Secret ที่ Mount เป็นไฟล์ และรันซ้ำไม่เพิ่มแถว`,
      typo: 'Volume ของ Secret Mount ไม่ได้เพราะไม่มี Key ที่อ้างถึง Pod จึงค้างก่อนที่ init container จะเริ่ม ดูได้จาก Events ของ Pod',
      del: 'Pod ของฐานข้อมูลถูกลบ StatefulSet สร้าง db-0 ใหม่ (uid ใหม่ ชื่อเดิม) และ Mount Claim เดิมกลับ ข้อมูลยังครบ',
      label: 'Loader ที่ไม่มี Label role=loader เข้าฐานข้อมูลไม่ได้ init container จึงรอไปเรื่อย ๆ Pod ค้างที่ Init และ Job ไม่จบ',
    },
    status: { ok: 'Job: Complete · rows 1000', typo: 'FailedMount: references non-existent secret key: pasword', del: 'db-0: Terminating → Running (3 วินาที) · rows 1000', label: 'Pod: Init:0/1 · "waiting for db"' },
  },
  en: {
    title: 'Pick a situation, and see which box turns orange and what its status says',
    caption: `Every situation is from a real run of exercise 15: the table holds ${data.rows} rows, the second run from the CronJob adds 0 (ON CONFLICT DO NOTHING), db-0 returns in ${data.recoverSeconds} s with all its data, and a loader with the wrong label stays at ${data.blocked}.`,
    sit: 'situation', sits: { ok: 'all fine', typo: 'misspelled Secret key', del: 'delete the database Pod', label: 'loader with the wrong label' },
    loader: 'Loader Job', db: 'db-0 (Postgres)', pol: 'NetworkPolicy: only role=loader may enter',
    note: {
      ok: `The database is Ready, the loader waits for it with an init container, then loads ${data.rows} rows using a Secret mounted as a file, and running it again adds no rows.`,
      typo: 'The Secret volume cannot be mounted because the key it names does not exist, so the Pod is stuck before the init container starts. The Pod events show it.',
      del: 'The database Pod is deleted. The StatefulSet makes db-0 again (new uid, same name) and mounts the same claim, so the data is all there.',
      label: 'A loader without the label role=loader cannot reach the database, so the init container waits and waits. The Pod stays in Init and the Job never finishes.',
    },
    status: { ok: 'Job: Complete · rows 1000', typo: 'FailedMount: references non-existent secret key: pasword', del: 'db-0: Terminating → Running (3 s) · rows 1000', label: 'Pod: Init:0/1 · "waiting for db"' },
  },
};

export default function PipelineLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [s, setS] = useState<Sit>('ok');
  const loaderBad = s === 'typo' || s === 'label';
  const dbBad = s === 'del';
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Seg label={T.sit} options={(Object.keys(T.sits) as Sit[]).map((k) => ({ id: k, text: T.sits[k] }))} value={s} onChange={setS} />
      <div className="viz-box">
        <svg viewBox="0 0 880 420" role="img" aria-label={T.title}>
          <rect className="ib-node" x={8} y={8} width={864} height={404} rx={16} style={{ strokeDasharray: '10 6' }} />
          <text x={24} y={34} className="ib-n">namespace pipeline</text>
          <Tile x={40} y={50} w={200} h={52} title="Secret db" sub="password" state={s === 'typo' ? 'bad' : 'plain'} />
          <Tile x={260} y={50} w={200} h={52} title="ConfigMap load-sql" sub="load.sql" state="plain" />
          <Tile x={40} y={170} w={260} h={96} title={T.loader} sub={s === 'label' ? 'role=etl' : 'role=loader'} state={loaderBad ? 'bad' : 'ok'} />
          <text x={52} y={254} className="ib-s">init: wait-for-db → loader</text>
          <Arrow x1={140} y1={104} x2={140} y2={168} bad={s === 'typo'} />
          <Arrow x1={360} y1={104} x2={250} y2={168} />
          <Tile x={40} y={300} w={260} h={52} title="CronJob nightly" sub="0 2 * * *" state="plain" />
          <Arrow x1={170} y1={298} x2={170} y2={268} dashed />
          <Arrow x1={302} y1={218} x2={510} y2={218} bad={s === 'label'} dashed={s === 'label'} />
          <rect x={480} y={150} width={14} height={140} rx={6} style={{ fill: s === 'label' ? 'var(--ib-bad)' : 'var(--k2)' }} />
          <text x={500} y={142} className="ib-s">{T.pol}</text>
          <Tile x={520} y={170} w={170} h={96} title="Service db" sub=":5432" state="plain" />
          <Arrow x1={692} y1={218} x2={716} y2={218} />
          <Tile x={720} y={170} w={140} h={96} title={T.db} sub={s === 'del' ? 'Terminating…' : `rows ${data.rows}`} state={dbBad ? 'bad' : 'ok'} />
          <Tile x={720} y={300} w={140} h={52} title="PVC data-db-0" sub="256Mi" state="on" />
          <Arrow x1={790} y1={268} x2={790} y2={298} />
          <rect className="ib-banner" x={20} y={368} width={840} height={36} rx={10} />
          <text x={32} y={392} className="ib-m" style={{ fill: 'var(--fg)', fontSize: 14 }}>{T.status[s]}</text>
        </svg>
      </div>
      <p className="viz-now"><strong>{T.sits[s]}</strong><span>{T.note[s]}</span></p>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
