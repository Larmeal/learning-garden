import { useCallback, useEffect, useState } from 'react';

// Per-browser progress: { "<subject>/<slug>": true }. Lives in localStorage, so it never leaves this device.
const KEY = 'garden:progress';
const EVT = 'garden-progress';

function read(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

export function useProgress() {
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const sync = () => setDone(read());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    const next = read();
    if (next[id]) delete next[id];
    else next[id] = true;
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // storage blocked: keep the tick for this page view only
    }
    setDone(next);
    window.dispatchEvent(new Event(EVT));
  }, []);

  return { done, toggle };
}
