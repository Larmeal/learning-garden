import { ui, type Lang } from '../i18n';

// Difficulty 1-5 as filled squares. Server-rendered unless a parent island hydrates it.
export default function Pips({ level, lang = 'th' }: { level: number; lang?: Lang }) {
  return (
    <span className="pips" role="img" aria-label={ui[lang].pips(level)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} className={i <= level ? 'on' : undefined} />
      ))}
    </span>
  );
}
