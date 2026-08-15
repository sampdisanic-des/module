import { useState, useEffect, useCallback } from 'react';
import {
  initializeEngine,
  loadSoundFontFile,
  triggerNoteOn,
  triggerNoteOff,
  updateEngineParam,
  configureLayerMix,
  configureLayerVoice,
  configureLayerOctave,
  configureGlobalTranspose,
  configureLayerParam,
  auditionVoicePreset,
  auditionVoiceStop,
} from '../../modules/synth-engine/src/index';

export interface UseSynthEngineReturn {
  isInitialized: boolean;
  activeNotes: number[];
  logBuffer: string[];
  auditionVoice: (presetIndex: number, fontPath?: string, note?: number, velocity?: number) => void;
  auditionStop: (note?: number) => void;
  noteOn: (note: number, velocity?: number) => void;
  noteOff: (note: number) => void;
  setParam: (paramName: string, value: number) => void;
  setLayerMix: (layerIndex: number, volume: number, mute: boolean, solo: boolean) => void;
  setLayerVoice: (layerIndex: number, voiceName: string, presetIndex?: number, fontPath?: string) => boolean;
  setLayerOctave: (layerIndex: number, octave: number) => void;
  setGlobalTranspose: (transpose: number) => void;
  setLayerParam: (layerIndex: number, paramName: string, value: number) => void;
  loadSoundFont: (assetPath: string) => boolean;
  clearLogs: () => void;
}

export const useSynthEngine = (): UseSynthEngineReturn => {
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [activeNotes, setActiveNotes] = useState<number[]>([]);
  const [logBuffer, setLogBuffer] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toISOString().substring(11, 19);
    setLogBuffer((prev) => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)]);
  }, []);

  useEffect(() => {
    const success = initializeEngine();
    setIsInitialized(success);
    if (success) {
      addLog('Motor C++ NDK (JSI) Inicializado correctamente');
    } else {
      addLog('Error: No se pudo inicializar el motor C++');
    }
  }, [addLog]);

  const auditionVoice = useCallback(
    (presetIndex: number, fontPath: string = '', note: number = 60, velocity: number = 100) => {
      auditionVoicePreset(presetIndex, fontPath, note, velocity);
    },
    []
  );

  const auditionStop = useCallback((note: number = 60) => {
    auditionVoiceStop(note);
  }, []);

  const noteOn = useCallback(
    (note: number, velocity: number = 100) => {
      triggerNoteOn(note, velocity);
      setActiveNotes((prev) => (prev.includes(note) ? prev : [...prev, note]));
      addLog(`NoteON: ${note} | Vel: ${velocity}`);
    },
    [addLog]
  );

  const noteOff = useCallback(
    (note: number) => {
      triggerNoteOff(note);
      setActiveNotes((prev) => prev.filter((n) => n !== note));
      addLog(`NoteOFF: ${note}`);
    },
    [addLog]
  );

  const setParam = useCallback(
    (paramName: string, value: number) => {
      updateEngineParam(paramName, value);
      addLog(`setParam: ${paramName} -> ${value.toFixed(2)}`);
    },
    [addLog]
  );

  const setLayerMix = useCallback(
    (layerIndex: number, volume: number, mute: boolean, solo: boolean) => {
      configureLayerMix(layerIndex, volume, mute, solo);
    },
    []
  );

  const setLayerVoice = useCallback(
    (layerIndex: number, voiceName: string, presetIndex: number = 0, fontPath: string = '') => {
      return configureLayerVoice(layerIndex, voiceName, presetIndex, fontPath);
    },
    []
  );

  const setLayerOctave = useCallback(
    (layerIndex: number, octave: number) => {
      configureLayerOctave(layerIndex, octave);
    },
    []
  );

  const setGlobalTranspose = useCallback(
    (transpose: number) => {
      configureGlobalTranspose(transpose);
    },
    []
  );

  const setLayerParam = useCallback(
    (layerIndex: number, paramName: string, value: number) => {
      configureLayerParam(layerIndex, paramName, value);
    },
    []
  );

  const loadSoundFont = useCallback(
    (assetPath: string) => {
      const res = loadSoundFontFile(assetPath);
      addLog(`loadSoundFont: ${assetPath} -> ${res ? 'OK' : 'Error'}`);
      return res;
    },
    [addLog]
  );

  const clearLogs = useCallback(() => {
    setLogBuffer([]);
  }, []);

  return {
    isInitialized,
    activeNotes,
    logBuffer,
    auditionVoice,
    auditionStop,
    noteOn,
    noteOff,
    setParam,
    setLayerMix,
    setLayerVoice,
    setLayerOctave,
    setGlobalTranspose,
    setLayerParam,
    loadSoundFont,
    clearLogs,
  };
};
