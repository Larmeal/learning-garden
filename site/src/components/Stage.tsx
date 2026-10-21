import Plant, { type PlantStage } from './Plant';

// Growth stage of a lesson, shown as the matching plant plus a label.
const LABEL = { seed: 'เมล็ด', sprout: 'ต้นอ่อน', evergreen: 'โตเต็มที่' } as const;

export type StageName = PlantStage;

export default function Stage({ stage }: { stage: StageName }) {
  return (
    <span className="stage" title={`ระดับการเติบโต: ${LABEL[stage]}`}>
      <Plant stage={stage} size={22} />
      {LABEL[stage]}
    </span>
  );
}
