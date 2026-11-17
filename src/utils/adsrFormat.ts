// Textos de la envolvente que reflejan exactamente el mapeo del motor C++
// (SynthEngine::applyLayerEnvelopeLocked). Valores de entrada en escala UI 0..100.

function formatSeconds(sec: number): string {
  if (sec < 1) return `${Math.round(sec * 1000)}ms`;
  return `${sec.toFixed(1)}s`;
}

/** Ataque mínimo por voz: 0..3 s (curva cuadrática). 0 = el del SoundFont. */
export function formatAttack(value: number): string {
  const a = Math.max(0, Math.min(100, value)) / 100;
  const sec = a * a * 3;
  return sec < 0.005 ? 'SF2' : formatSeconds(sec);
}

/** Multiplicador del decay del SoundFont: x0.25..x4 (45 = neutro). */
export function formatDecay(value: number): string {
  const d = Math.max(0, Math.min(100, value));
  const scale = d >= 45 ? Math.pow(4, (d - 45) / 55) : Math.pow(4, (d - 45) / 45);
  return `x${scale.toFixed(scale < 1 ? 2 : 1)}`;
}

export function formatSustain(value: number): string {
  return `${Math.round(value)}%`;
}

/** Release por voz: 0.02..6 s (curva cuadrática). */
export function formatRelease(value: number): string {
  const r = Math.max(0, Math.min(100, value)) / 100;
  return formatSeconds(0.02 + r * r * 6);
}
