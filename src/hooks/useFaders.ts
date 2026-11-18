import { useEffect, useState } from 'react';
import { VoicePreset } from '../data/voiceLibrary';
import { UseSynthEngineReturn } from './useSynthEngine';
import {
  DEFAULT_FADERS,
  FaderState,
  OCTAVE_RANGE,
  TRANSPOSE_RANGE,
  VoiceParamKey,
} from '../types/fader';

type EngineApi = Pick<
  UseSynthEngineReturn,
  'setLayerMix' | 'setLayerVoice' | 'setLayerOctave' | 'setLayerParam' | 'setGlobalTranspose' | 'setParam'
>;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * Estado de los 4 faders (voz, mezcla, octava, envolvente y filtro), transposición global
 * y modulación. Todo cambio se envía al motor nativo desde un único efecto.
 */
export const useFaders = (engine: EngineApi, voiceLibrary: VoicePreset[]) => {
  const { setLayerMix, setLayerVoice, setLayerOctave, setLayerParam, setGlobalTranspose, setParam } = engine;

  const [faders, setFaders] = useState<FaderState[]>(DEFAULT_FADERS);
  const [selectedFaderId, setSelectedFaderId] = useState<number>(1);
  const [transpose, setTranspose] = useState<number>(0);
  const [modulation, setModulation] = useState<number>(0);

  const activeFader = faders.find((f) => f.id === selectedFaderId) || faders[0];

  // Sincronización con el motor C++
  useEffect(() => {
    faders.forEach((fader, index) => {
      const voice = voiceLibrary.find((v) => v.id === fader.name || v.name === fader.name);
      setLayerMix(index, fader.value / 100, fader.mute, fader.solo);
      setLayerVoice(index, fader.name, voice?.sf2Preset ?? 0, voice?.sf2Path || '');
      setLayerOctave(index, fader.octave);
      setLayerParam(index, 'cutoff', fader.cutoff);
      setLayerParam(index, 'resonance', fader.resonance);
      setLayerParam(index, 'attack', fader.attack);
      setLayerParam(index, 'decay', fader.delay);
      setLayerParam(index, 'sustain', fader.sustain);
      setLayerParam(index, 'release', fader.release);
    });
  }, [faders, voiceLibrary, setLayerMix, setLayerVoice, setLayerOctave, setLayerParam]);

  useEffect(() => {
    setGlobalTranspose(transpose);
  }, [transpose, setGlobalTranspose]);

  useEffect(() => {
    setParam('modulation', modulation);
  }, [modulation, setParam]);

  const updateFader = (id: number, patch: Partial<FaderState>) => {
    setFaders((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const setVolume = (id: number, value: number) => updateFader(id, { value });

  const toggleSolo = (id: number) =>
    setFaders((prev) => prev.map((f) => (f.id === id ? { ...f, solo: !f.solo } : f)));

  const toggleMute = (id: number) =>
    setFaders((prev) => prev.map((f) => (f.id === id ? { ...f, mute: !f.mute } : f)));

  const shiftFaderOctave = (id: number, delta: number) =>
    setFaders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, octave: clamp(f.octave + delta, -OCTAVE_RANGE, OCTAVE_RANGE) } : f))
    );

  const changeTranspose = (delta: number) =>
    setTranspose((prev) => clamp(prev + delta, -TRANSPOSE_RANGE, TRANSPOSE_RANGE));

  /** Cambia un parámetro de sonido del fader seleccionado */
  const updateActiveParam = (key: VoiceParamKey, val: number) => updateFader(activeFader.id, { [key]: val });

  const assignVoice = (id: number, voiceName: string) => updateFader(id, { name: voiceName });

  /** Tras renombrar una voz importada, actualizar los faders que la usaban */
  const renameVoiceInFaders = (oldName: string, newName: string) =>
    setFaders((prev) => prev.map((f) => (f.name === oldName ? { ...f, name: newName } : f)));

  return {
    faders,
    setFaders,
    activeFader,
    selectedFaderId,
    setSelectedFaderId,
    transpose,
    setTranspose,
    changeTranspose,
    modulation,
    setModulation,
    setVolume,
    toggleSolo,
    toggleMute,
    shiftFaderOctave,
    updateActiveParam,
    assignVoice,
    renameVoiceInFaders,
  };
};

export type FadersApi = ReturnType<typeof useFaders>;
