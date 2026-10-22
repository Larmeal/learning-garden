import GrowArt from './GrowArt';
import type { PlantStage } from './Plant';
import { plantStage, useProgress } from './useProgress';

// The intro-card plant of a lesson: reflects this learner's progress, not how complete the writing is.
export default function LessonArt({ lessonId, content }: { lessonId: string; content: PlantStage }) {
  const { done } = useProgress();
  return <GrowArt stage={plantStage(content, !!done[lessonId])} />;
}
