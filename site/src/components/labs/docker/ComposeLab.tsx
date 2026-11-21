import { useState } from 'react';
import { StepControls, useStepper, type Lang, type StepInfo } from '../spark/stepper';
import { Legend } from '../iceberg/ib';
import data from './compose.json';

// Shows:      a compose file on the left and, on the right, what docker compose up builds from it one step at a time: the network, the volume, the database, then
//             the loader that reads a file into it. A switch changes one line of the file, depends_on, and the loader either waits for the database to be healthy
//             and succeeds, or starts as soon as the database container exists and fails with connection refused. The last step is docker compose down.
// Because:    "Compose is the order and the wiring of containers, not only a list of them". The two depends_on forms differ in time: one waits, the other does not.
// Control:    the form of depends_on (wait for healthy, or plain list) and the step player.
// Conclusion: a service name is a DNS name inside the project network, depends_on with a condition waits for the health check, and down removes containers and the network but keeps the volume.
//
// The names and the two outcomes come from exercises/09_compose.py --write (compose.json); each outcome was a real docker compose up.

type Mode = 'healthy' | 'plain';
const NETWORK = data.network;
const VOLUME = data.volume;
const DB = data.names.find((n) => n.includes('db')) ?? 'dlab-pipe-db-1';
const LOADER = data.names.find((n) => n.includes('loader')) ?? 'dlab-pipe-loader-1';

const YAML_HEALTHY = ['services:', '  db:', '    image: postgres:17-alpine', '    volumes: [pgdata:/var/lib/…]', '    healthcheck: pg_isready', '  loader:', '    depends_on:', '      db: {condition: service_healthy}', '    command: psql -h db -f load.sql', 'volumes:', '  pgdata:'];
const YAML_PLAIN = [...YAML_HEALTHY.slice(0, 6), '    depends_on: [db]', '', '    command: psql -h db -f load.sql', ...YAML_HEALTHY.slice(9)];

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; mode: string; modes: Record<Mode, string>; file: string; net: string; vol: string;
  db: string; loader: string; starting: string; healthy: string; waiting: string; failed: string; done: string; ok: string; refused: string; steps: (m: Mode) => StepInfo[]; caption: string;
}> = {
  th: {
    title: 'เลือกรูปแบบของ depends_on แล้วกดถัดไปทีละขั้น ดูว่า docker compose up สร้างอะไรตามลำดับ และ loader ได้ผลต่างกันอย่างไร',
    legend: [{ kind: 'new', text: 'สร้างในขั้นนี้' }, { kind: 'use', text: 'มีอยู่แล้ว' }, { kind: 'skip', text: 'ยังไม่ถึงหรือถูกลบไปแล้ว' }],
    mode: 'depends_on แบบ',
    modes: { healthy: 'รอ db healthy', plain: 'รายการธรรมดา' },
    file: 'compose.yaml',
    net: 'Network ของโปรเจกต์',
    vol: 'Volume ที่มีชื่อ',
    db: 'บริการ db (ฐานข้อมูล)',
    loader: 'บริการ loader (ตัวโหลดข้อมูล)',
    starting: 'กำลังเริ่ม',
    healthy: 'healthy ✓',
    waiting: 'รอ db healthy',
    failed: 'ล้มเหลว',
    done: 'จบด้วย 0',
    ok: 'โหลด 2 แถวสำเร็จ',
    refused: 'Connection refused',
    caption: 'ชื่อ Container, Network และ Volume กับผลของ depends_on ทั้งสองแบบมาจากแบบฝึก 09 (docker compose up จริงสองครั้ง) ข้อความ Connection refused มาจาก Log จริงของ loader',
    steps: (m) => [
      { name: 'ไฟล์', title: 'compose.yaml อธิบายสองบริการกับหนึ่ง Volume', text: 'Compose อ่านไฟล์นี้แล้วตั้งชื่อโปรเจกต์ตามบรรทัด name ทุกอย่างที่สร้างจะขึ้นต้นด้วยชื่อนั้น' },
      { name: 'Network', title: 'สร้าง Network ของโปรเจกต์', text: `Compose สร้าง Network ชื่อ ${NETWORK} ให้เอง บริการทุกตัวต่อเข้าวงนี้ ชื่อของบริการจึงใช้เป็นชื่อ DNS ในวงนี้ได้ (db, loader)` },
      { name: 'Volume', title: 'สร้าง Volume ที่ไฟล์ประกาศไว้', text: `Compose สร้าง Volume ชื่อ ${VOLUME} เพื่อเก็บข้อมูลของ db มันจะไม่ถูกลบตอน down ธรรมดา` },
      { name: 'db เริ่ม', title: 'เริ่ม Container ของ db', text: `Container ${DB} เริ่มทำงาน แต่ Postgres ข้างในยังเตรียมระบบอยู่ จึงยังตอบการเชื่อมต่อไม่ได้ เช็กสถานะจะเห็นว่ายังไม่ healthy` },
      m === 'healthy'
        ? { name: 'รอ', title: 'loader รอให้ db healthy', text: 'เพราะ depends_on มีเงื่อนไข service_healthy Compose จึงยังไม่เริ่ม loader จนกว่า Health Check ของ db จะผ่าน' }
        : { name: 'loader เริ่ม', title: 'loader เริ่มทันทีที่ db เริ่ม', text: 'depends_on แบบรายการธรรมดาแค่สั่งให้ db เริ่มก่อน ไม่ได้รอให้มันพร้อม loader จึงเริ่มทั้งที่ Postgres ยังไม่รับการเชื่อมต่อ' },
      m === 'healthy'
        ? { name: 'loader รัน', title: 'loader เรียก db ด้วยชื่อ', text: 'psql -h db ใช้ชื่อบริการเป็นชื่อ Host ผ่าน DNS ของ Network โปรเจกต์ db ตอบรับ และโหลดสองแถวสำเร็จ' }
        : { name: 'loader รัน', title: 'loader เรียก db แล้วถูกปฏิเสธ', text: 'psql -h db หาที่อยู่ของ db เจอ แต่พอร์ต 5432 ยังไม่เปิด ได้ข้อความ Connection refused (รัน)' },
      m === 'healthy'
        ? { name: 'จบงาน', title: 'loader จบด้วย Exit Code 0', text: 'loader ทำงานเสร็จแล้วออก ส่วน db ยังรันต่อ ซึ่งเป็นรูปแบบปกติของงานโหลดข้อมูล' }
        : { name: 'จบงาน', title: 'loader จบด้วย Exit Code ที่ไม่ใช่ 0', text: 'loader ล้มและหยุด ส่วน db พร้อมหลังจากนั้นไม่นาน แต่ไม่มีใครโหลดข้อมูล การรันซ้ำอาจผ่าน แต่ระบบที่ขึ้นกับจังหวะแบบนี้เชื่อถือไม่ได้' },
      { name: 'down', title: 'docker compose down', text: `Container กับ Network ถูกลบ แต่ Volume ${VOLUME} ยังอยู่ ข้อมูลของ db จึงอยู่ครบเมื่อสั่ง up ครั้งหน้า ถ้าอยากลบด้วยต้องใช้ down -v (รัน)` },
    ],
  },
  en: {
    title: 'Choose the form of depends_on and press Next one step at a time, and see what docker compose up builds in order and how the loader fares differently',
    legend: [{ kind: 'new', text: 'created in this step' }, { kind: 'use', text: 'already there' }, { kind: 'skip', text: 'not reached yet, or already removed' }],
    mode: 'depends_on form',
    modes: { healthy: 'wait for db healthy', plain: 'plain list' },
    file: 'compose.yaml',
    net: 'Network of the project',
    vol: 'Named volume',
    db: 'service db (database)',
    loader: 'service loader (data loader)',
    starting: 'starting',
    healthy: 'healthy ✓',
    waiting: 'waiting for db healthy',
    failed: 'failed',
    done: 'exit 0',
    ok: 'loaded 2 rows',
    refused: 'Connection refused',
    caption: 'The names of the containers, network and volume and the results of both depends_on forms come from exercise 09 (two real docker compose up runs). The text Connection refused comes from the real log of the loader.',
    steps: (m) => [
      { name: 'file', title: 'compose.yaml describes two services and one volume', text: 'Compose reads this file and names the project from the line name. Everything it creates starts with that name.' },
      { name: 'Network', title: 'Create the network of the project', text: `Compose makes a network called ${NETWORK} by itself. Every service joins it, so the name of a service works as a DNS name in this network (db, loader).` },
      { name: 'Volume', title: 'Create the volume the file declares', text: `Compose creates the volume ${VOLUME} to keep the data of db. A plain down does not remove it.` },
      { name: 'db starts', title: 'Start the container of db', text: `The container ${DB} starts, but Postgres inside is still preparing, so it cannot answer connections yet. A status check shows it is not healthy yet.` },
      m === 'healthy'
        ? { name: 'wait', title: 'loader waits for db to be healthy', text: 'Because depends_on has the condition service_healthy, Compose does not start the loader until the health check of db passes.' }
        : { name: 'loader starts', title: 'loader starts as soon as db starts', text: 'A plain depends_on list only starts db first and does not wait until it is ready. So the loader starts while Postgres is not accepting connections yet.' },
      m === 'healthy'
        ? { name: 'loader runs', title: 'loader calls db by name', text: 'psql -h db uses the service name as the host name, through the DNS of the project network. db answers and two rows are loaded.' }
        : { name: 'loader runs', title: 'loader calls db and is refused', text: 'psql -h db finds the address of db, but port 5432 is not open yet, so it gets Connection refused (ran).' },
      m === 'healthy'
        ? { name: 'done', title: 'loader ends with exit code 0', text: 'The loader finishes its work and exits while db keeps running, which is the normal shape of a data loading job.' }
        : { name: 'done', title: 'loader ends with a non-zero exit code', text: 'The loader fails and stops. db is ready shortly after, but nobody loads the data. Running again might pass, but a system that depends on that timing cannot be trusted.' },
      { name: 'down', title: 'docker compose down', text: `The containers and the network are removed, but the volume ${VOLUME} stays, so the data of db is all there the next time we run up. To remove it too we need down -v (ran).` },
    ],
  },
};

export default function ComposeLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [mode, setMode] = useState<Mode>('healthy');
  const steps = T.steps(mode);
  const { step, go, playing, toggle } = useStepper(steps.length, 3600);
  const yaml = mode === 'healthy' ? YAML_HEALTHY : YAML_PLAIN;
  const hasNet = step >= 1 && step < 7;
  const hasVol = step >= 2;
  const dbUp = step >= 3 && step < 7;
  const dbHealthy = mode === 'healthy' ? step >= 4 : step >= 6;
  const loaderUp = mode === 'healthy' ? step >= 5 && step < 7 : step >= 4 && step < 7;
  const loaderState = mode === 'healthy' ? (step >= 6 ? T.done : step === 5 ? 'psql -h db …' : T.waiting) : step >= 5 ? T.failed : 'psql -h db …';
  const loaderOk = mode === 'healthy' && step >= 6;
  const loaderBad = mode === 'plain' && step >= 5;
  const cls = (now: boolean, exists: boolean) => (!exists ? 'ib-skip' : now ? 'ib-new' : 'ib-use');
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.mode}</span>
        <span className="seg" role="group" aria-label={T.mode}>
          {(['healthy', 'plain'] as Mode[]).map((k) => (
            <button key={k} type="button" aria-pressed={mode === k} onClick={() => { setMode(k); go(4); }}>{T.modes[k]}</button>
          ))}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 400" role="img" aria-label={T.title}>
          <text x={14} y={24} className="ib-t">{T.file}</text>
          <rect className={step === 0 ? 'ib-new' : 'ib-node'} x={14} y={34} width={310} height={yaml.length * 26 + 18} rx={10} />
          {yaml.map((l, i) => (
            <text key={i} x={28} y={60 + i * 26} className="ib-m" style={{ whiteSpace: 'pre', fontSize: 14, fill: l.includes('depends_on') || l.includes('condition') ? 'var(--accent)' : 'var(--fg)' }}>{l}</text>
          ))}
          <rect className={cls(step === 1, hasNet)} x={350} y={34} width={516} height={236} rx={14} style={hasNet ? undefined : { opacity: 0.55 }} />
          <text x={366} y={62} className="ib-n">{T.net}</text>
          <text x={366} y={84} className="ib-m">{NETWORK}</text>
          <g style={dbUp ? undefined : { opacity: 0.4 }}>
            <rect className={cls(step === 3, dbUp)} x={370} y={112} width={220} height={128} rx={10} />
            <text x={384} y={142} className="ib-n">{T.db}</text>
            <text x={384} y={166} className="ib-m">{DB}</text>
            <text x={384} y={206} className="ib-n" style={{ fill: dbHealthy ? 'var(--accent)' : 'var(--muted)' }}>{dbUp ? (dbHealthy ? T.healthy : T.starting) : ''}</text>
          </g>
          <g style={loaderUp || step >= 6 ? undefined : { opacity: 0.4 }}>
            <rect className={cls(step === 5 || step === 4, loaderUp)} x={630} y={112} width={220} height={128} rx={10} style={loaderBad ? { stroke: 'var(--ib-bad)' } : undefined} />
            <text x={644} y={142} className="ib-n">{T.loader}</text>
            <text x={644} y={166} className="ib-m">{LOADER}</text>
            <text x={644} y={206} className="ib-n" style={{ fill: loaderBad ? 'var(--ib-bad)' : loaderOk ? 'var(--accent)' : 'var(--muted)' }}>{loaderUp ? loaderState : ''}</text>
          </g>
          {loaderUp && step >= 5 && (
            <g>
              <path className={loaderBad ? 'ib-arrow-bad' : 'ib-arrow'} d="M630,176 L594,176" />
              <text x={612} y={104} textAnchor="middle" className="ib-s" style={{ fill: loaderBad ? 'var(--ib-bad)' : 'var(--accent)' }}>{loaderBad ? '✗' : '✓'}</text>
            </g>
          )}
          <g style={hasVol ? undefined : { opacity: 0.4 }}>
            <rect className={cls(step === 2, hasVol)} x={370} y={300} width={296} height={70} rx={10} />
            <text x={384} y={330} className="ib-n">{T.vol}</text>
            <text x={384} y={354} className="ib-m">{VOLUME}</text>
            {dbUp && <path className="ib-line" d="M480,270 L480,300" style={{ strokeWidth: 3 }} />}
          </g>
          {step >= 5 && (
            <text x={690} y={310} className="ib-s" style={{ fill: loaderBad ? 'var(--ib-bad)' : 'var(--accent)' }}>{loaderBad ? T.refused : loaderOk || step >= 5 ? T.ok : ''}</text>
          )}
        </svg>
      </div>
      <StepControls steps={steps} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
