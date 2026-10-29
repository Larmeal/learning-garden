import { useState } from 'react';

// A file list with the real content of the selected file next to it. The lesson passes files that a script wrote
// and printed, so the reader sees what is on disk without running anything.

export interface F {
  path: string;
  note: string;
  git?: boolean;
  text?: string;
}
interface Props {
  title: string;
  files: F[];
  caption?: string;
}

export default function FileExplorer({ title, files, caption }: Props) {
  const [k, setK] = useState(0);
  const f = files[k];

  return (
    <figure className="viz">
      <div className="viz-title">{title}</div>
      <div className="gx-split">
        <ul className="gx-files" style={{ flex: '1 1 300px' }}>
          {files.map((x, n) => (
            <li key={x.path} data-match={k === n ? 'true' : undefined}>
              <button type="button" className="gx-tree-key" aria-pressed={k === n} onClick={() => setK(n)} style={{ textAlign: 'left' }}>
                <code>{x.path}</code>
              </button>
              <span className="gx-detail">{x.note}</span>
              {x.git !== undefined && <span className="gx-tag">{x.git ? 'commit' : 'ไม่ commit'}</span>}
            </li>
          ))}
        </ul>
        <div className="gx-pane gx-grow">
          <span className="lab-label">{f.path}</span>
          {f.text ? <pre className="codeline">{f.text}</pre> : <p className="gx-hint">ไฟล์นี้ไม่ได้แสดงเนื้อหา</p>}
        </div>
      </div>
      {caption && <p className="viz-caption">{caption}</p>}
    </figure>
  );
}
