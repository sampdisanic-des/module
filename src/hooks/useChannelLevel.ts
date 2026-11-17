import { useEffect, useState } from 'react';
import { fetchChannelLevels } from '../../modules/synth-engine/src';

// Un único sondeo nativo compartido por los 4 medidores (en lugar de uno por medidor)
type Listener = (levels: number[]) => void;
const listeners = new Set<Listener>();
let timer: ReturnType<typeof setInterval> | null = null;
const POLL_MS = 45;

function ensurePolling() {
  if (timer || listeners.size === 0) return;
  timer = setInterval(() => {
    let levels: number[];
    try {
      levels = fetchChannelLevels();
    } catch {
      levels = [0, 0, 0, 0];
    }
    listeners.forEach((l) => l(levels));
  }, POLL_MS);
}

function stopPollingIfIdle() {
  if (timer && listeners.size === 0) {
    clearInterval(timer);
    timer = null;
  }
}

/** Nivel 0..100 del canal (F1..F4) medido sobre el audio real del motor. */
export function useChannelLevel(channelIndex: number, enabled: boolean): number {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setLevel(0);
      return;
    }
    const listener: Listener = (levels) => {
      const raw = levels[channelIndex] ?? 0;
      const next = Math.min(100, Math.round(raw * 100));
      setLevel((prev) => (prev === next ? prev : next));
    };
    listeners.add(listener);
    ensurePolling();
    return () => {
      listeners.delete(listener);
      stopPollingIfIdle();
    };
  }, [channelIndex, enabled]);

  return level;
}
