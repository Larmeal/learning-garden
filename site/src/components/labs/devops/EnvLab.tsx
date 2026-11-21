import { useState } from 'react';
import { Banner, Lines } from '../iceberg/ib';
import { Seg, Tile, Arrow, type Lang } from './dv';
import matrix from './secrets.json';

// Shows:      (top) one file with one fingerprint running in dev, staging and prod and printing a different line in each, because only the values around it differ;
//             (bottom) a secret kept in three places and who can read it from each place: someone who has the image, someone who can inspect the container, the program inside.
// Because:    "same artifact, different configuration" and "a secret in an environment variable is visible to docker inspect, a mounted file is not" are claims about WHO can see WHAT. A table says them, three eyes that light up or stay dark show them.
// Control:    the environment (changes the highlighted panel and the line the program prints), and the place where the secret lives (changes which eyes can see it).
// Conclusion: configuration is what differs between environments, the program does not; and a secret that is not in the image and not in the container's settings can only be read from the inside.
//
// The three environment lines and the fingerprint (sha256 3f00593d55ea of app.py) are from exercises/03_config_secrets.py; the table of who can read the secret is its docker history / docker inspect / exec results (secrets.json).

type Env = 'dev' | 'staging' | 'prod';
type Place = 'dockerfile_env' | 'run_env' | 'file';
const VALUES: Record<Env, { APP_ENV: string; DATABASE_URL: string; LOG_LEVEL: string }> = {
  dev: { APP_ENV: 'dev', DATABASE_URL: 'sqlite:///dev.db', LOG_LEVEL: 'debug' },
  staging: { APP_ENV: 'staging', DATABASE_URL: 'postgres://staging-db/shop', LOG_LEVEL: 'info' },
  prod: { APP_ENV: 'prod', DATABASE_URL: 'postgres://prod-db/shop', LOG_LEVEL: 'warning' },
};

const TEXT: Record<Lang, { title: string; caption: string; env: string; place: string; places: Record<Place, string>; file: string; out: string; eyes: [string, string, string]; eyesSub: [string, string, string]; read: string; cannot: string; verdict: Record<Place, string>; seeAll: string }> = {
  th: {
    title: 'เลือกว่าจะรันที่ Environment ไหน ดูว่าไฟล์เดียวกันพิมพ์อะไรออกมา แล้วเลือกว่าจะเก็บความลับไว้ที่ไหน ดูว่าใครอ่านมันได้',
    caption: 'ไฟล์ app.py ตัวเดียว (sha256 ขึ้นต้น 3f00593d55ea) รันในสาม Environment และตารางว่าใครอ่านความลับได้ เป็นผลจริงของแบบฝึก 03 (docker history, docker inspect และ docker exec กับ Docker Engine 29)',
    env: 'Environment', place: 'ความลับอยู่ที่', places: { dockerfile_env: 'ENV ใน Dockerfile', run_env: '-e ตอน docker run', file: 'ไฟล์ที่ Mount เข้าไป' },
    file: 'โปรแกรมเดียวกันทุกที่', out: 'พิมพ์ว่า', eyes: ['คนที่ได้ Image ไป', 'คนที่ Inspect Container ได้', 'โปรแกรมข้างใน'], eyesSub: ['docker history', 'docker inspect', 'อ่านจากข้างใน'], read: 'อ่านได้', cannot: 'อ่านไม่ได้', seeAll: 'ค่า Config ทั้งสามชุดมี Key เหมือนกัน ต่างกันแค่ค่า',
    verdict: { dockerfile_env: 'ความลับติดอยู่ใน Image ทุกคนที่ Pull Image ไปอ่านได้ และอยู่ใน Container ทุกตัวด้วย', run_env: 'Image สะอาด แต่ใครมีสิทธิ์ Inspect Container ก็เห็นค่าได้', file: 'อ่านได้เฉพาะจากข้างใน Container ที่ Mount ไฟล์นั้นเข้าไป ไม่อยู่ใน Image และไม่ขึ้นใน docker inspect' },
  },
  en: {
    title: 'Choose the environment to run in and see what the same file prints, then choose where to keep the secret and see who can read it',
    caption: 'One file app.py (sha256 starting 3f00593d55ea) running in three environments, and the table of who can read the secret, are the real results of exercise 03 (docker history, docker inspect and docker exec on Docker Engine 29).',
    env: 'Environment', place: 'The secret lives in', places: { dockerfile_env: 'ENV in the Dockerfile', run_env: '-e at docker run', file: 'a mounted file' },
    file: 'the same program everywhere', out: 'prints', eyes: ['whoever gets the image', 'whoever can inspect the container', 'the program inside'], eyesSub: ['docker history', 'docker inspect', 'reads from inside'], read: 'can read it', cannot: 'cannot read it', seeAll: 'The three sets of config have the same keys, only the values differ',
    verdict: { dockerfile_env: 'The secret is stuck in the image: everybody who pulls the image can read it, and it is in every container as well.', run_env: 'The image is clean, but anybody allowed to inspect the container sees the value.', file: 'It can be read only from inside the container that mounted the file. It is not in the image and does not show in docker inspect.' },
  },
};

export default function EnvLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [env, setEnv] = useState<Env>('prod');
  const [place, setPlace] = useState<Place>('dockerfile_env');
  const v = VALUES[env];
  const row = matrix[place] as { history: boolean; inspect: boolean; inside: boolean };
  const readable = [row.history, row.inspect, row.inside];
  const envs: Env[] = ['dev', 'staging', 'prod'];
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Seg label={T.env} options={envs.map((e) => ({ id: e, text: e }))} value={env} onChange={setEnv} />
      <Seg label={T.place} options={(['dockerfile_env', 'run_env', 'file'] as Place[]).map((p) => ({ id: p, text: T.places[p] }))} value={place} onChange={setPlace} />
      <div className="viz-box">
        <svg viewBox="0 0 880 560" role="img" aria-label={T.title}>
          <Tile x={20} y={46} w={200} h={78} title="app.py" sub="sha256 3f00593d55ea" state="on" />
          <text x={120} y={36} textAnchor="middle" className="ib-s">{T.file}</text>
          <path d="M120,46 V16 H677" style={{ stroke: 'var(--line-strong)', strokeWidth: 2.5, fill: 'none' }} />
          {envs.map((e, i) => {
            const x = 290 + i * 200;
            const vv = VALUES[e];
            const sel = e === env;
            return (
              <g key={e}>
                <path d={`M${x + 93},16 V28`} style={{ stroke: sel ? 'var(--accent)' : 'var(--line-strong)', strokeWidth: sel ? 4 : 2.5 }} />
                <rect className={sel ? 'nw-cell on' : 'nw-cell'} x={x} y={28} width={186} height={116} rx={10} />
                <text x={x + 12} y={52} className="ib-n">{e}</text>
                <text x={x + 12} y={76} className="ib-m" style={{ fill: 'var(--fg)', fontSize: 12 }}>APP_ENV={vv.APP_ENV}</text>
                <text x={x + 12} y={96} className="ib-m" style={{ fill: 'var(--fg)', fontSize: 12 }}>{vv.DATABASE_URL}</text>
                <text x={x + 12} y={116} className="ib-m" style={{ fill: 'var(--fg)', fontSize: 12 }}>LOG_LEVEL={vv.LOG_LEVEL}</text>
              </g>
            );
          })}
          <rect className="ib-banner" x={20} y={156} width={840} height={36} rx={8} />
          <text x={34} y={180} className="ib-m" style={{ fill: 'var(--fg)', fontSize: 15 }}>{T.out} → env={v.APP_ENV} db={v.DATABASE_URL} log={v.LOG_LEVEL}</text>
          <text x={20} y={214} className="ib-s">{T.seeAll}</text>

          <line className="ib-line" x1={20} y1={238} x2={860} y2={238} />
          <Tile x={20} y={290} w={210} h={92} title={T.places[place]} sub="DB_PASSWORD = s3cr3t…" state="on" />
          {[0, 1, 2].map((i) => {
            const y = 262 + i * 88;
            const can = readable[i];
            const outsider = i < 2;
            return (
              <g key={i}>
                <Arrow x1={232} y1={336} x2={330} y2={y + 32} bad={can && outsider} op={can ? 1 : 0.35} dashed={!can} />
                <Tile x={334} y={y} w={290} h={66} title={T.eyes[i]} sub={T.eyesSub[i]} state={can ? (outsider ? 'bad' : 'on') : 'ok'} />
                <text x={640} y={y + 40} className="ib-n" style={{ fill: can && outsider ? 'var(--ib-bad)' : 'var(--fg)' }}>{can ? '✓ ' + T.read : '✗ ' + T.cannot}</text>
              </g>
            );
          })}
          <Banner y={512} text={''} />
          <Lines x={26} y={534} text={T.verdict[place]} max={92} className="ib-n" />
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
