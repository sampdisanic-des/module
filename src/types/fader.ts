/** Estado de un fader (capa de voz). `delay` es el decay de la envolvente (nombre heredado de los bancos guardados). */
export interface FaderState {
  id: number; // 1..4
  name: string; // nombre o id de la voz asignada
  value: number; // volumen 0..100
  solo: boolean;
  mute: boolean;
  octave: number; // -3..+3
  cutoff: number;
  resonance: number;
  attack: number;
  delay: number;
  sustain: number;
  release: number;
}

/** Parámetros de sonido editables por fader */
export type VoiceParamKey = 'cutoff' | 'resonance' | 'attack' | 'delay' | 'sustain' | 'release';

export const DEFAULT_FADERS: FaderState[] = [
  { id: 1, name: 'Yamaha CFX Grand', value: 80, solo: false, mute: false, octave: 0, cutoff: 100, resonance: 20, attack: 0, delay: 45, sustain: 100, release: 30 },
  { id: 2, name: 'Ambient Pad Warm', value: 65, solo: false, mute: false, octave: 0, cutoff: 90, resonance: 25, attack: 15, delay: 50, sustain: 90, release: 40 },
  { id: 3, name: 'Syn Strings Symphony', value: 50, solo: false, mute: false, octave: 0, cutoff: 95, resonance: 20, attack: 10, delay: 45, sustain: 95, release: 35 },
  { id: 4, name: 'Synth Lead Moog Saw', value: 75, solo: false, mute: false, octave: 0, cutoff: 100, resonance: 30, attack: 0, delay: 40, sustain: 100, release: 25 },
];

export const OCTAVE_RANGE = 3;
export const TRANSPOSE_RANGE = 12;

export const formatSigned = (n: number) => (n > 0 ? `+${n}` : `${n}`);
