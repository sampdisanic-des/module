import { useState, useEffect, useCallback, useRef } from 'react';
import {
  initializeEngine,
  loadSoundFontFile,
  triggerNoteOn,
  triggerNoteOff,
  updateEngineParam,
} from '../../modules/synth-engine/src/index';

export interface UseSynthEngineReturn {
  isInitialized: boolean;
  activeNotes: number[];
  logBuffer: string[];
  noteOn: (note: number, velocity?: number) => void;
  noteOff: (note: number) => void;
  setParam: (paramName: string, value: number) => void;
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
    noteOn,
    noteOff,
    setParam,
    loadSoundFont,
    clearLogs,
  };
};
