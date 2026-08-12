import { useState, useEffect, useCallback } from 'react';
import {
  fetchDetectedChord,
  updateSplitPoint,
  updateBpm,
  updateStyleSection,
} from '../../modules/synth-engine/src/index';

export type StyleSection = 'INTRO' | 'MAIN_A' | 'MAIN_B' | 'FILL_IN' | 'ENDING';

export interface UseArrangerReturn {
  currentChord: string;
  bpm: number;
  currentSection: StyleSection;
  splitPoint: number;
  setBpm: (newBpm: number) => void;
  setSection: (section: StyleSection) => void;
  setSplitPoint: (note: number) => void;
}

export const useArranger = (): UseArrangerReturn => {
  const [currentChord, setCurrentChord] = useState<string>('---');
  const [bpm, setBpmState] = useState<number>(120);
  const [currentSection, setCurrentSectionState] = useState<StyleSection>('MAIN_A');
  const [splitPoint, setSplitPointState] = useState<number>(60); // C4

  // Polling ligero para actualizar el acorde detectado desde C++ NDK
  useEffect(() => {
    const interval = setInterval(() => {
      const chord = fetchDetectedChord();
      setCurrentChord(chord);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const setBpm = useCallback((newBpm: number) => {
    const clamped = Math.min(Math.max(newBpm, 40), 240);
    setBpmState(clamped);
    updateBpm(clamped);
  }, []);

  const setSection = useCallback((section: StyleSection) => {
    setCurrentSectionState(section);
    updateStyleSection(section);
  }, []);

  const setSplitPoint = useCallback((note: number) => {
    setSplitPointState(note);
    updateSplitPoint(note);
  }, []);

  return {
    currentChord,
    bpm,
    currentSection,
    splitPoint,
    setBpm,
    setSection,
    setSplitPoint,
  };
};
