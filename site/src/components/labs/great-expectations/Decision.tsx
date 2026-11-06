import { useState } from 'react';

// A small question-by-question chooser. Nodes with `options` ask; nodes with `answer` end the walk. The tree is
// written in the lesson, so every leaf is something the lesson already showed with a script.

type Lang = 'th' | 'en';

const TEXT: Record<Lang, { back: string; restart: string; answered: (n: number) => string }> = {
  th: { back: 'ย้อนกลับ', restart: 'เริ่มใหม่', answered: (n) => `ตอบแล้ว ${n} ข้อ` },
  en: { back: 'Back', restart: 'Start over', answered: (n) => `${n} answered` },
};

export interface Node {
  id: string;
  q?: string;
  options?: { label: string; to: string }[];
  answer?: string;
  text?: string;
}
interface Props {
  title: string;
  start: string;
  nodes: Node[];
  caption?: string;
  lang?: Lang;
}

export default function Decision({ title, start, nodes, caption, lang = 'th' }: Props) {
  const t = TEXT[lang];
  const [trail, setTrail] = useState<string[]>([start]);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const now = byId.get(trail[trail.length - 1]);
  if (!now) return null;

  return (
    <figure className="viz">
      <div className="viz-title">{title}</div>
      <div className="viz-controls">
        <button type="button" className="btn sm" disabled={trail.length < 2} onClick={() => setTrail((t) => t.slice(0, -1))}>{t.back}</button>
        <button type="button" className="btn sm" disabled={trail.length < 2} onClick={() => setTrail([start])}>{t.restart}</button>
        <span className="gx-tag">{t.answered(trail.length - 1)}</span>
      </div>
      {trail.slice(0, -1).length > 0 && (
        <ol className="gx-steps gx-trail">
          {trail.slice(0, -1).map((id, i) => {
            const n = byId.get(id);
            const via = n?.options?.find((o) => o.to === trail[i + 1])?.label;
            return (
              <li key={id} data-state="done">
                <span className="gx-detail">{n?.q} </span>
                <b>{via}</b>
              </li>
            );
          })}
        </ol>
      )}
      {now.options ? (
        <div className="viz-now" aria-live="polite">
          <strong>{now.q}</strong>
          <div className="viz-steps" style={{ marginTop: 10 }}>
            {now.options.map((o) => (
              <button key={o.to + o.label} type="button" aria-pressed={false} onClick={() => setTrail((t) => [...t, o.to])}>{o.label}</button>
            ))}
          </div>
        </div>
      ) : (
        <div className="viz-now" aria-live="polite">
          <strong>{now.answer}</strong>
          {now.text && <span>{now.text}</span>}
        </div>
      )}
      {caption && <p className="viz-caption">{caption}</p>}
    </figure>
  );
}
