import { useState, useEffect, useCallback, useRef } from 'react';
import {
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
  setNativeSyncStart,
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
  /** Secciones con eventos en el ritmo cargado (p. ej. 'INTRO_A', 'MAIN_B') */
  availableSections: StyleSection[];
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
  selectStyle: (preset: StylePreset, bpmOverride?: number) => Promise<void>;
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
  const [availableSections, setAvailableSections] = useState<StyleSection[]>([]);

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

  // BPM a aplicar al terminar de cargar el próximo estilo (p. ej. desde un banco de memoria)
  const pendingBpmRef = useRef<number | null>(null);
  const loadedStyleRef = useRef(loadedStyle);
  loadedStyleRef.current = loadedStyle;

  // Polling del estado del secuenciador nativo (una sola llamada JNI por ciclo).
  // El Sync Start lo resuelve el motor C++ en el mismo Note On (0 ms).
  useEffect(() => {
    const interval = setInterval(() => {
      const status = fetchStylePlaybackState();
      if (!status) return;

      const chord = status.chord ?? '---';
      if (chord !== currentChordRef.current) {
        currentChordRef.current = chord;
        setCurrentChord(chord);
      }
      setCurrentBeatState(status.currentBeat || 1);
      setQueuedSectionState(status.queuedSection || '');
      setIsSyncStart(!!status.isSyncStart);

      if (status.currentSection && (status.currentSection as StyleSection) !== currentSectionRef.current) {
        setCurrentSectionState(status.currentSection as StyleSection);
        currentSectionRef.current = status.currentSection as StyleSection;
      }
      if (status.isPlaying !== isPlayingRef.current) {
        // Inicio por Sync Start o fin por ENDING
        isPlayingRef.current = status.isPlaying;
        setIsPlaying(status.isPlaying);
        if (!status.isPlaying) setIsPaused(false);
      }
    }, 40);
    return () => clearInterval(interval);
  }, []);

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
    let cancelled = false;
    async function loadPattern() {
      const data = await getStyleData(loadedStyle.id, loadedStyle.filePath);
      // Si se eligió otro ritmo mientras se leía este archivo, descartar
      if (!data || cancelled) return;

      resetNativeStyleData();
      setNativeStylePpq(data.ppq || 480);

      const secKeys = Object.keys(data.sections) as StyleSectionKey[];
      setAvailableSections(
        secKeys.filter((k) => (data.sections[k]?.events?.length ?? 0) > 0) as StyleSection[]
      );
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

      // Ritmos importados: el tempo real viene del archivo (.STY)
      const styleBpm = loadedStyle.isCustom
        ? data.defaultBpm || loadedStyle.defaultBpm
        : loadedStyle.defaultBpm || data.defaultBpm;
      const initialBpm = pendingBpmRef.current ?? styleBpm ?? 100;
      pendingBpmRef.current = null;
      setBpmState(initialBpm);
      bpmRef.current = initialBpm;
      setNativeStyleBpm(initialBpm);
      setNativeStyleSection('MAIN_A');
      setCurrentSectionState('MAIN_A');
      currentSectionRef.current = 'MAIN_A';
    }
    loadPattern();
    return () => {
      cancelled = true;
    };
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
    setIsSyncStart((prev) => {
      const next = !prev && !isPlayingRef.current;
      setNativeSyncStart(next);
      return next;
    });
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
      // Detenido: solo INTRO/MAIN se preseleccionan (FILL/ENDING no aplican)
      if (section.startsWith('FILL_') || section.startsWith('ENDING_')) return;
      setCurrentSectionState(section);
      currentSectionRef.current = section;
      setNativeStyleSection(section);
    }
  }, []);

  const triggerFillIn = useCallback((targetVariation: 'A' | 'B' | 'C' | 'D' = 'A') => {
    if (!isPlayingRef.current) return;
    const fillSec = (`FILL_${targetVariation}`) as StyleSection;
    setNativeStyleSection(fillSec);
  }, []);

  const setSplitPoint = useCallback((note: number) => {
    setSplitPointState(note);
    updateSplitPoint(note);
  }, []);

  const setStyleVolume = useCallback((vol: number) => {
    const clamped = Math.min(Math.max(vol, 0), 100);
    setStyleVolumeState(clamped);
  }, []);

  const selectStyle = useCallback(async (preset: StylePreset, bpmOverride?: number) => {
    if (isPlayingRef.current) {
      stopNativeStylePlayback();
      setIsPlaying(false);
      isPlayingRef.current = false;
    }
    if (loadedStyleRef.current.id === preset.id) {
      // Mismo ritmo: no se recarga, aplicar el BPM directamente
      pendingBpmRef.current = null;
      if (bpmOverride) {
        const clamped = Math.min(Math.max(bpmOverride, 40), 240);
        setBpmState(clamped);
        bpmRef.current = clamped;
        setNativeStyleBpm(clamped);
      }
      return;
    }
    pendingBpmRef.current = bpmOverride ?? null;
    loadedStyleRef.current = preset;
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
    availableSections,
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
