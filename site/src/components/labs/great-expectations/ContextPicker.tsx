import { useState } from 'react';

type Kind = 'cloud' | 'file' | 'ephemeral';

// Mirrors ProjectManager._build_context with mode=None: cloud first (needs its settings), then a gx/ folder, then memory.
function choose(mode: string, cloud: boolean, folder: boolean): { kind: Kind | 'error'; why: string } {
  if (mode === 'ephemeral') return { kind: 'ephemeral', why: 'mode="ephemeral" บังคับให้อยู่ใน memory' };
  if (mode === 'file') return { kind: 'file', why: folder ? 'mode="file" ใช้โฟลเดอร์ gx/ ที่มีอยู่' : 'mode="file" สร้างโฟลเดอร์ gx/ ใหม่ในโฟลเดอร์โปรเจกต์' };
  if (mode === 'cloud') {
    return cloud ? { kind: 'cloud', why: 'mode="cloud" และมีค่าตั้งของ GX Cloud ครบ' } : { kind: 'error', why: 'mode="cloud" แต่ไม่มี GX_CLOUD_ORGANIZATION_ID / GX_CLOUD_ACCESS_TOKEN จึง error' };
  }
  if (cloud) return { kind: 'cloud', why: 'เจอค่าตั้งของ GX Cloud (env var) จึงเลือก cloud ก่อนอย่างอื่น' };
  if (folder) return { kind: 'file', why: 'ไม่มี cloud แต่พบโฟลเดอร์ gx/ จึงใช้ file context' };
  return { kind: 'ephemeral', why: 'ไม่พบทั้ง cloud และโฟลเดอร์ gx/ จึงอยู่ใน memory' };
}

const KIND_LABEL: Record<Kind | 'error', string> = {
  cloud: 'CloudDataContext',
  file: 'FileDataContext',
  ephemeral: 'EphemeralDataContext',
  error: 'GXCloudConfigurationError',
};

const TREE: { path: string; note: string; git: boolean }[] = [
  { path: 'gx/great_expectations.yml', note: 'ตั้งค่า context และ data source', git: true },
  { path: 'gx/expectations/<suite>.json', note: 'expectation suite', git: true },
  { path: 'gx/validation_definitions/<name>.json', note: 'ชื่อ+id ของ batch definition และ suite', git: true },
  { path: 'gx/checkpoints/<name>.json', note: 'checkpoint และ action', git: true },
  { path: 'gx/uncommitted/config_variables.yml', note: 'ค่าลับ (ตัวแปรสำหรับ ${VAR})', git: false },
  { path: 'gx/uncommitted/validations/…', note: 'ผลการตรวจทุกรอบ', git: false },
  { path: 'gx/uncommitted/data_docs/local_site/…', note: 'รายงาน HTML', git: false },
];

export default function ContextPicker() {
  const [mode, setMode] = useState('auto');
  const [cloud, setCloud] = useState(false);
  const [folder, setFolder] = useState(false);
  const res = choose(mode, cloud, folder);

  return (
    <figure className="viz">
      <div className="viz-title">gx.get_context() จะได้ context ชนิดไหน</div>
      <div className="lab-controls">
        <div>
          <div className="lab-label">พารามิเตอร์ mode</div>
          <div className="seg" role="group" aria-label="mode">
            {['auto', 'ephemeral', 'file', 'cloud'].map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>{m === 'auto' ? 'ไม่ระบุ' : m}</button>
            ))}
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={cloud} onChange={(e) => setCloud(e.target.checked)} />
          ตั้ง env var ของ GX Cloud
        </label>
        <label className="check">
          <input type="checkbox" checked={folder} onChange={(e) => setFolder(e.target.checked)} />
          มีโฟลเดอร์ <code>gx/</code> ในโปรเจกต์
        </label>
      </div>

      <div className="viz-now" aria-live="polite" data-bad={res.kind === 'error' || undefined}>
        <strong>{KIND_LABEL[res.kind]}</strong>
        <span>{res.why}</span>
      </div>

      {res.kind === 'file' && (
        <div className="gx-tree">
          <div className="lab-label">สิ่งที่ file context เขียนลงดิสก์ (ยืนยันด้วยการรัน)</div>
          {TREE.map((t) => (
            <div key={t.path} className="gx-tree-row" data-git={t.git}>
              <code>{t.path}</code>
              <span>{t.note}</span>
              <span className="gx-tag">{t.git ? 'commit เข้า git' : 'ไม่ commit'}</span>
            </div>
          ))}
        </div>
      )}
      {res.kind === 'ephemeral' && (
        <p className="viz-caption">ทุกอย่างอยู่ใน memory ของโปรเซสนี้ ปิดโปรแกรมแล้วหายหมด เหมาะกับการทดลองและสคริปต์ที่สร้าง object ใหม่ทุกครั้ง</p>
      )}
      {res.kind === 'cloud' && (
        <p className="viz-caption">suite, checkpoint และผลถูกเก็บที่ GX Cloud เส้นทางนี้ไม่ได้ครอบคลุมในบทเรียน</p>
      )}
    </figure>
  );
}
