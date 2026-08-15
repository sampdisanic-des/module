import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchDetectedChord,
  updateSplitPoint,
  updateStyleMasterVolume,
  resetNativeStyleData,
  setNativeStylePpq,
  uploadNativeStyleSectionEvents,
  startNativeStylePlayback,
  stopNativeStylePlayback,
  setNativeStyleAccompaniment,
  setNativeStyleBpm,
  setNativeStyleSection,
  queueNativeStyleSection,
  fetchStylePlaybackState,
} from '../../modules/synth-engine/src/index';
import StyleLibraryService, {
  StylePreset,
  BUILTIN_STYLES,
  StyleImportResult,
} from '../services/styleLibraryService';
import {
  getStyleData,
  ParsedStyle,
  StyleSectionKey,
} from '../services/styParser';

export type StyleSection =
  | 'INTRO_A'
  | 'INTRO_B'
  | 'INTRO_C'
  | 'INTRO_D'
  | 'MAIN_A'
  | 'MAIN_B'
  | 'MAIN_C'
  | 'MAIN_D'
  | 'FILL_A'
  | 'FILL_B'
  | 'FILL_C'
  | 'FILL_D'
  | 'ENDING_A'
  | 'ENDING_B'
  | 'ENDING_C'
  | 'ENDING_D';

export interface UseArrangerReturn {
  currentChord: string;
  bpm: number;
  currentSection: StyleSection;
  queuedSection: string;
  currentBeat: number; // 1, 2, 3, 4
  splitPoint: number;
  isPlaying: boolean;
  isPaused: boolean;
  isSyncStart: boolean;
  isAccompanimentOn: boolean;
  styleVolume: number;
  loadedStyle: StylePreset;
  availableStyles: StylePreset[];
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  setBpm: (newBpm: number) => void;
  setSection: (section: StyleSection) => void;
  triggerFillIn: (targetVariation?: 'A' | 'B' | 'C' | 'D') => void;
  setSplitPoint: (note: number) => void;
  setStyleVolume: (vol: number) => void;
  startStopStyle: () => void;
  pauseStyle: () => void;
  toggleSyncStart: () => void;
  toggleAccompaniment: () => void;
  selectStyle: (preset: StylePreset) => Promise<void>;
  importStyleFiles: (targetCategory?: string) => Promise<StyleImportResult>;
  deleteStyleFile: (styleId: string) => Promise<void>;
  renameStyleFile: (styleId: string, newName: string) => Promise<void>;
}

export const useArranger = (): UseArrangerReturn => {
  const [currentChord, setCurrentChord] = useState<string>('---');
  const [bpm, setBpmState] = useState<number>(100);
  const [currentSection, setCurrentSectionState] = useState<StyleSection>('MAIN_A');
  const [queuedSection, setQueuedSectionState] = useState<string>('');
  const [currentBeat, setCurrentBeatState] = useState<number>(1);
  const [splitPoint, setSplitPointState] = useState<number>(60); // C4
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isSyncStart, setIsSyncStart] = useState<boolean>(false);
  const [isAccompanimentOn, setIsAccompanimentOn] = useState<boolean>(false);
  const [styleVolume, setStyleVolumeState] = useState<number>(85);

  const [availableStyles, setAvailableStyles] = useState<StylePreset[]>(BUILTIN_STYLES);
  const [loadedStyle, setLoadedStyle] = useState<StylePreset>(BUILTIN_STYLES[0]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const currentChordRef = useRef(currentChord);
  currentChordRef.current = currentChord;

  const currentSectionRef = useRef(currentSection);
  currentSectionRef.current = currentSection;

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const isAccompanimentOnRef = useRef(isAccompanimentOn);
  isAccompanimentOnRef.current = isAccompanimentOn;

  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;

  // Polling del acorde detectado y estado del secuenciador nativo C++
  useEffect(() => {
    const interval = setInterval(() => {
      const chord = fetchDetectedChord();
      if (chord !== currentChordRef.current) {
        setCurrentChord(chord);
      }

      if (isSyncStart && !isPlayingRef.current && chord !== '---') {
        setIsPlaying(true);
        isPlayingRef.current = true;
        setIsSyncStart(false);
        startNativeStylePlayback(bpmRef.current, isAccompanimentOnRef.current);
      }

      // Sincronizar estado en tiempo real del secuenciador (tiempos de compás, transición y finalización)
      const status = fetchStylePlaybackState();
      if (status) {
        setCurrentBeatState(status.currentBeat || 1);
        setQueuedSectionState(status.queuedSection || '');
        if (status.currentSection && (status.currentSection as StyleSection) !== currentSectionRef.current) {
          setCurrentSectionState(status.currentSection as StyleSection);
          currentSectionRef.current = status.currentSection as StyleSection;
        }
        if (isPlayingRef.current && !status.isPlaying) {
          // Si el estilo terminó (por ejemplo al finalizar ENDING)
          setIsPlaying(false);
          isPlayingRef.current = false;
          setIsPaused(false);
        }
      }
    }, 40);
    return () => clearInterval(interval);
  }, [isSyncStart]);

  // Sincronizar volumen maestro del estilo a C++
  useEffect(() => {
    updateStyleMasterVolume(styleVolume / 100);
  }, [styleVolume]);

  // Cargar lista inicial de ritmos (integrados + importados)
  useEffect(() => {
    async function loadStylesList() {
      const customStyles = await StyleLibraryService.getCustomStyles();
      const combined = [...BUILTIN_STYLES, ...customStyles];
      setAvailableStyles(combined);
    }
    loadStylesList();
  }, []);

  // Cargar y transferir patrón rítmico al Secuenciador Nativo C++ (Precisión de Muestra 0.00ms Jitter)
  useEffect(() => {
    async function loadPattern() {
      const data = await getStyleData(loadedStyle.id, loadedStyle.filePath);
      if (!data) return;

      resetNativeStyleData();
      setNativeStylePpq(data.ppq || 480);

      const secKeys = Object.keys(data.sections) as StyleSectionKey[];
      secKeys.forEach((secKey) => {
        const sec = data.sections[secKey];
        if (sec && sec.events && sec.events.length > 0) {
          const eventsData = sec.events
            .map(
              (evt) =>
                `${evt.tick},${evt.durationTicks},${evt.channel},${evt.note},${evt.velocity},${evt.program ?? -1},${evt.isDrum ? 1 : 0}`
            )
            .join(';');
          uploadNativeStyleSectionEvents(secKey, sec.totalTicks, eventsData);
        }
      });

      const initialBpm = loadedStyle.defaultBpm || data.defaultBpm || 100;
      setBpmState(initialBpm);
      setNativeStyleBpm(initialBpm);
      setNativeStyleSection('MAIN_A');
      setCurrentSectionState('MAIN_A');
    }
    loadPattern();
  }, [loadedStyle]);

  const startStopStyle = useCallback(() => {
    if (isPlayingRef.current) {
      setIsPlaying(false);
      isPlayingRef.current = false;
      setIsPaused(false);
      stopNativeStylePlayback();
    } else {
      setIsPlaying(true);
      isPlayingRef.current = true;
      setIsPaused(false);
      startNativeStylePlayback(bpmRef.current, isAccompanimentOnRef.current);
    }
  }, []);

  const pauseStyle = useCallback(() => {
    setIsPaused((prev) => {
      const next = !prev;
      if (next) {
        stopNativeStylePlayback();
      } else {
        startNativeStylePlayback(bpmRef.current, isAccompanimentOnRef.current);
      }
      return next;
    });
  }, []);

  const toggleSyncStart = useCallback(() => {
    setIsSyncStart((prev) => !prev);
  }, []);

  const toggleAccompaniment = useCallback(() => {
    setIsAccompanimentOn((prev) => {
      const nextVal = !prev;
      isAccompanimentOnRef.current = nextVal;
      setNativeStyleAccompaniment(nextVal);
      return nextVal;
    });
  }, []);

  const setBpm = useCallback((newBpm: number) => {
    const clamped = Math.min(Math.max(newBpm, 40), 240);
    setBpmState(clamped);
    bpmRef.current = clamped;
    setNativeStyleBpm(clamped);
  }, []);

  const setSection = useCallback((section: StyleSection) => {
    if (isPlayingRef.current) {
      // Encolar sección para transición suave en el compás siguiente
      setQueuedSectionState(section);
      queueNativeStyleSection(section);
    } else {
      setCurrentSectionState(section);
      setNativeStyleSection(section);
    }
  }, []);

  const triggerFillIn = useCallback((targetVariation: 'A' | 'B' | 'C' | 'D' = 'A') => {
    const fillSec = (`FILL_${targetVariation}`) as StyleSection;
    setCurrentSectionState(fillSec);
    if (isPlayingRef.current) {
      setNativeStyleSection(fillSec);
    }
  }, []);

  const setSplitPoint = useCallback((note: number) => {
    setSplitPointState(note);
    updateSplitPoint(note);
  }, []);

  const setStyleVolume = useCallback((vol: number) => {
    const clamped = Math.min(Math.max(vol, 0), 100);
    setStyleVolumeState(clamped);
  }, []);

  const selectStyle = useCallback(async (preset: StylePreset) => {
    if (isPlayingRef.current) {
      stopNativeStylePlayback();
      setIsPlaying(false);
      isPlayingRef.current = false;
    }
    setLoadedStyle(preset);
  }, []);

  const importStyleFiles = useCallback(async (targetCategory: string = 'LATIN'): Promise<StyleImportResult> => {
    const result = await StyleLibraryService.pickAndImportStyleFiles(targetCategory);
    if (result.importedStyles.length > 0) {
      const customStyles = await StyleLibraryService.getCustomStyles();
      setAvailableStyles([...BUILTIN_STYLES, ...customStyles]);
      setLoadedStyle(result.importedStyles[0]);
    }
    return result;
  }, []);

  const deleteStyleFile = useCallback(async (styleId: string) => {
    await StyleLibraryService.deleteCustomStyle(styleId);
    const customStyles = await StyleLibraryService.getCustomStyles();
    setAvailableStyles([...BUILTIN_STYLES, ...customStyles]);
    setLoadedStyle(BUILTIN_STYLES[0]);
  }, []);

  const renameStyleFile = useCallback(async (styleId: string, newName: string) => {
    await StyleLibraryService.renameCustomStyle(styleId, newName);
    const customStyles = await StyleLibraryService.getCustomStyles();
    setAvailableStyles([...BUILTIN_STYLES, ...customStyles]);
  }, []);

  return {
    currentChord,
    bpm,
    currentSection,
    queuedSection,
    currentBeat,
    splitPoint,
    isPlaying,
    isPaused,
    isSyncStart,
    isAccompanimentOn,
    styleVolume,
    loadedStyle,
    availableStyles,
    selectedCategory,
    setSelectedCategory,
    setBpm,
    setSection,
    triggerFillIn,
    setSplitPoint,
    setStyleVolume,
    startStopStyle,
    pauseStyle,
    toggleSyncStart,
    toggleAccompaniment,
    selectStyle,
    importStyleFiles,
    deleteStyleFile,
    renameStyleFile,
  };
};
