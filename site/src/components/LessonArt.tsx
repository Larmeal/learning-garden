import GrowArt from './GrowArt';
import type { PlantStage } from './Plant';
import { isFinished, plantStage, useProgress } from './useProgress';

// The intro-card plant of a lesson: reflects this learner's progress through all its pages, not how complete the writing is.
export default function LessonArt({ pages, content }: { pages: string[]; content: PlantStage }) {
  const { done } = useProgress();
  return <GrowArt stage={plantStage(content, isFinished(done, pages))} />;
}
