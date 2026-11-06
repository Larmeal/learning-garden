import { useState } from 'react';

type Kind = 'file' | 'ephemeral';

type Lang = 'th' | 'en';

const TEXT: Record<
  Lang,
  {
    ephemeral: string;
    fileExisting: string;
    fileNew: string;
    shut: string;
    cloudMode: (shut: string) => string;
    cloudEnv: (shut: string) => string;
    folderFound: string;
    none: string;
    title: string;
    modeLabel: string;
    auto: string;
    cloudCheck: string;
    folderBefore: string;
    folderAfter: string;
    treeTitle: string;
    commit: string;
    noCommit: string;
    memory: string;
    tree: Record<string, string>;
  }
> = {
  th: {
    ephemeral: 'mode="ephemeral" บังคับให้อยู่ใน memory',
    fileExisting: 'mode="file" ใช้โฟลเดอร์ gx/ ที่มีอยู่',
    fileNew: 'mode="file" สร้างโฟลเดอร์ gx/ ใหม่ในโฟลเดอร์โปรเจกต์',
    shut: 'GX Cloud ถูกปิดบริการแล้ว: GX 1.24.1 raise GreatExpectationsError ทันที ไม่ได้คืน CloudDataContext',
    cloudMode: (shut) => `mode="cloud" ${shut}`,
    cloudEnv: (shut) => `เจอค่าตั้งของ GX Cloud (env var) ซึ่งทำให้ get_context() เลือกทางของ cloud ก่อน แต่ ${shut} (ข้อนี้อ่านจากคำอธิบายในซอร์ส ไม่ได้ทดลองด้วย env var)`,
    folderFound: 'ไม่มี cloud แต่พบโฟลเดอร์ gx/ จึงใช้ file context',
    none: 'ไม่พบทั้ง cloud และโฟลเดอร์ gx/ จึงอยู่ใน memory',
    title: 'gx.get_context() จะได้ context ชนิดไหน',
    modeLabel: 'พารามิเตอร์ mode',
    auto: 'ไม่ระบุ',
    cloudCheck: 'ตั้ง env var ของ GX Cloud (ไว้เทียบ)',
    folderBefore: 'มีโฟลเดอร์ ',
    folderAfter: ' ในโปรเจกต์',
    treeTitle: 'สิ่งที่ file context เขียนลงดิสก์ (ยืนยันด้วยการรัน)',
    commit: 'commit เข้า git',
    noCommit: 'ไม่ commit',
    memory: 'ทุกอย่างอยู่ใน memory ของโปรเซสนี้ ปิดโปรแกรมแล้วหายหมด เหมาะกับการทดลองและสคริปต์ที่สร้าง object ใหม่ทุกครั้ง',
    tree: {
      'gx/great_expectations.yml': 'ตั้งค่า context และ data source',
      'gx/expectations/<suite>.json': 'expectation suite',
      'gx/validation_definitions/<name>.json': 'ชื่อ+id ของ batch definition และ suite',
      'gx/checkpoints/<name>.json': 'checkpoint และ action',
      'gx/uncommitted/config_variables.yml': 'ค่าลับ (ตัวแปรสำหรับ ${VAR})',
      'gx/uncommitted/validations/…': 'ผลการตรวจทุกรอบ',
      'gx/uncommitted/data_docs/local_site/…': 'รายงาน HTML',
    },
  },
  en: {
    ephemeral: 'mode="ephemeral" forces the context to stay in memory',
    fileExisting: 'mode="file" uses the gx/ folder that already exists',
    fileNew: 'mode="file" creates a new gx/ folder in the project folder',
    shut: 'GX Cloud has been shut down: GX 1.24.1 raises GreatExpectationsError at once and does not return a CloudDataContext',
    cloudMode: (shut) => `mode="cloud": ${shut}`,
    cloudEnv: (shut) => `Found GX Cloud settings (env var), so get_context() takes the cloud path first. But ${shut} (read from the explanation in the source, not tried with a real env var)`,
    folderFound: 'No cloud, but a gx/ folder was found, so it uses a file context',
    none: 'Neither cloud nor a gx/ folder was found, so it stays in memory',
    title: 'Which kind of context does gx.get_context() return',
    modeLabel: 'mode parameter',
    auto: 'not set',
    cloudCheck: 'Set the GX Cloud env var (for comparison)',
    folderBefore: 'The project has a ',
    folderAfter: ' folder',
    treeTitle: 'What a file context writes to disk (confirmed by running it)',
    commit: 'commit to git',
    noCommit: 'do not commit',
    memory: 'Everything stays in the memory of this process and is gone when the program ends. Good for experiments and for scripts that build new objects every time.',
    tree: {
      'gx/great_expectations.yml': 'Context and data source settings',
      'gx/expectations/<suite>.json': 'expectation suite',
      'gx/validation_definitions/<name>.json': 'Names and ids of the batch definition and the suite',
      'gx/checkpoints/<name>.json': 'checkpoint and actions',
      'gx/uncommitted/config_variables.yml': 'Secrets (variables for ${VAR})',
      'gx/uncommitted/validations/…': 'The results of every run',
      'gx/uncommitted/data_docs/local_site/…': 'HTML report',
    },
  },
};

// Mirrors ProjectManager._build_context with mode=None: cloud settings first (GX 1.24.1 raises, the service is shut down),
// then a gx/ folder, then memory.
function choose(mode: string, cloud: boolean, folder: boolean, t: (typeof TEXT)['th']): { kind: Kind | 'error'; why: string } {
  if (mode === 'ephemeral') return { kind: 'ephemeral', why: t.ephemeral };
  if (mode === 'file') return { kind: 'file', why: folder ? t.fileExisting : t.fileNew };
  if (mode === 'cloud') return { kind: 'error', why: t.cloudMode(t.shut) };
  if (cloud) return { kind: 'error', why: t.cloudEnv(t.shut) };
  if (folder) return { kind: 'file', why: t.folderFound };
  return { kind: 'ephemeral', why: t.none };
}

const KIND_LABEL: Record<Kind | 'error', string> = {
  file: 'FileDataContext',
  ephemeral: 'EphemeralDataContext',
  error: 'GreatExpectationsError',
};

const TREE: { path: string; git: boolean }[] = [
  { path: 'gx/great_expectations.yml', git: true },
  { path: 'gx/expectations/<suite>.json', git: true },
  { path: 'gx/validation_definitions/<name>.json', git: true },
  { path: 'gx/checkpoints/<name>.json', git: true },
  { path: 'gx/uncommitted/config_variables.yml', git: false },
  { path: 'gx/uncommitted/validations/…', git: false },
  { path: 'gx/uncommitted/data_docs/local_site/…', git: false },
];

export default function ContextPicker({ lang = 'th' }: { lang?: Lang }) {
  const t = TEXT[lang];
  const [mode, setMode] = useState('auto');
  const [cloud, setCloud] = useState(false);
  const [folder, setFolder] = useState(false);
  const res = choose(mode, cloud, folder, t);

  return (
    <figure className="viz">
      <div className="viz-title">{t.title}</div>
      <div className="lab-controls">
        <div>
          <div className="lab-label">{t.modeLabel}</div>
          <div className="seg" role="group" aria-label="mode">
            {['auto', 'ephemeral', 'file', 'cloud'].map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>{m === 'auto' ? t.auto : m}</button>
            ))}
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={cloud} onChange={(e) => setCloud(e.target.checked)} />
          {t.cloudCheck}
        </label>
        <label className="check">
          <input type="checkbox" checked={folder} onChange={(e) => setFolder(e.target.checked)} />
          {t.folderBefore}<code>gx/</code>{t.folderAfter}
        </label>
      </div>

      <div className="viz-now" aria-live="polite" data-bad={res.kind === 'error' || undefined}>
        <strong>{KIND_LABEL[res.kind]}</strong>
        <span>{res.why}</span>
      </div>

      {res.kind === 'file' && (
        <div className="gx-tree">
          <div className="lab-label">{t.treeTitle}</div>
          {TREE.map((n) => (
            <div key={n.path} className="gx-tree-row" data-git={n.git}>
              <code>{n.path}</code>
              <span>{t.tree[n.path]}</span>
              <span className="gx-tag">{n.git ? t.commit : t.noCommit}</span>
            </div>
          ))}
        </div>
      )}
      {res.kind === 'ephemeral' && (
        <p className="viz-caption">{t.memory}</p>
      )}
    </figure>
  );
}
