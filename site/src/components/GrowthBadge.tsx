import Plant, { type PlantStage } from './Plant';
import { isFinished, plantStage, useProgress } from './useProgress';
import { ui, type Lang } from '../i18n';

// Small plant plus label in the lesson header, driven by this learner's progress through all the lesson's pages.
export default function GrowthBadge({ pages, content, lang = 'th' }: { pages: string[]; content: PlantStage; lang?: Lang }) {
  const { done } = useProgress();
  const t = ui[lang].badge;
  const stage = plantStage(content, isFinished(done, pages));
  const read = pages.filter((p) => done[p]).length;
  const label: Record<PlantStage, string> = {
    seed: t.seed,
    sprout: t.sprout(read, pages.length),
    evergreen: t.evergreen,
  };
  return (
    <span className="stage" title={t.title}>
      <Plant stage={stage} size={26} sway />
      {label[stage]}
    </span>
  );
}
