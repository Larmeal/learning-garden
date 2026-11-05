import { useEffect, useState } from 'react';

// Shared by the Spark labs that walk through a process one step at a time.
export interface StepInfo {
  name: string;
  title: string;
  text: string;
}

export function useStepper(count: number, interval = 2600) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (step >= count - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), interval);
    return () => clearTimeout(t);
  }, [playing, step, count, interval]);

  const go = (n: number) => {
    setPlaying(false);
    setStep(Math.max(0, Math.min(count - 1, n)));
  };
  const toggle = () => {
    if (step >= count - 1) setStep(0);
    setPlaying((p) => !p);
  };
  const reset = () => {
    setPlaying(false);
    setStep(0);
  };
  return { step, go, playing, toggle, reset };
}

interface ControlsProps {
  steps: StepInfo[];
  step: number;
  playing: boolean;
  go: (n: number) => void;
  toggle: () => void;
}

// The "now" box and the button row that every step lab shows under its picture.
export function StepControls({ steps, step, playing, go, toggle }: ControlsProps) {
  const last = steps.length - 1;
  return (
    <>
      <div className="viz-now" aria-live="polite">
        <strong>{steps[step].title}</strong>
        <span>{steps[step].text}</span>
      </div>
      <div className="viz-controls">
        <button type="button" className="btn" onClick={() => go(step - 1)} disabled={step === 0}>← ก่อนหน้า</button>
        <button type="button" className="btn primary" onClick={toggle}>{playing ? 'หยุด' : step >= last ? 'เล่นใหม่' : 'เล่นต่อเนื่อง'}</button>
        <button type="button" className="btn" onClick={() => go(step + 1)} disabled={step === last}>ถัดไป →</button>
        <div className="viz-steps">
          {steps.map((s, i) => (
            <button key={s.name} type="button" aria-pressed={i === step} onClick={() => go(i)}>
              {i + 1}. {s.name}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
