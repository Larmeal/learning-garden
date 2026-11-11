import { useState } from 'react';

// A file list with the real content of the selected file next to it. The lesson passes files that a script wrote
// and printed, so the reader sees what is on disk without running anything.

type Lang = 'th' | 'en';

const TEXT: Record<Lang, { commit: string; noCommit: string; noContent: string }> = {
  th: { commit: 'Commit', noCommit: 'ไม่ Commit', noContent: 'ไฟล์นี้ไม่ได้แสดงเนื้อหา' },
  en: { commit: 'commit', noCommit: 'not committed', noContent: 'The content of this file is not shown.' },
};

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
  lang?: Lang;
}

export default function FileExplorer({ title, files, caption, lang = 'th' }: Props) {
  const t = TEXT[lang];
  const [k, setK] = useState(0);
  const f = files[k];

  return (
    <figure className="viz">
      <div className="viz-title">{title}</div>
      <div className="gx-split">
        <ul className="gx-filelist">
          {files.map((x, n) => (
            <li key={x.path} data-sel={k === n ? 'true' : undefined}>
              <button type="button" className="gx-filebtn" aria-pressed={k === n} onClick={() => setK(n)}>
                <code>{x.path}</code>
              </button>
              <span className="gx-detail">{x.note}</span>
              {x.git !== undefined && <span className="gx-tag">{x.git ? t.commit : t.noCommit}</span>}
            </li>
          ))}
        </ul>
        <div className="gx-pane gx-grow">
          <span className="lab-label">{f.path}</span>
          {f.text ? <pre className="codeline">{f.text}</pre> : <p className="gx-hint">{t.noContent}</p>}
        </div>
      </div>
      {caption && <p className="viz-caption">{caption}</p>}
    </figure>
  );
}
