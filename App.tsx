import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Modal,
  ScrollView,
  TextInput,
  BackHandler,
} from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Text as SvgText, Line } from 'react-native-svg';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Battery from 'expo-battery';
import { useSynthEngine } from './src/hooks/useSynthEngine';
import { useMidiDevices } from './src/hooks/useMidiDevices';
import { useArranger } from './src/hooks/useArranger';
import SoundLibraryService, { CustomVoicePreset } from './src/services/soundLibraryService';
import BankMemoryService, { MemoryBanksCatalog, MemoryBankPreset } from './src/services/bankMemoryService';
import StyleLibraryService from './src/services/styleLibraryService';
import { setSustainPedal } from './modules/synth-engine/src';
import { formatAttack, formatDecay, formatSustain, formatRelease } from './src/utils/adsrFormat';
import { SearchIcon, BluetoothIcon, UsbCableIcon, SignalBarsIcon, RefreshIcon, BackArrowIcon, PlusIcon, EditIcon, TrashIcon, CloseIcon, AssignIcon } from './src/components/Icons';
import { HorizontalFader, ConsoleFader } from './src/components/ConsoleControls';
import { VOICE_LIBRARY, VoicePreset, matchStyleCategory } from './src/data/voiceLibrary';
export type { VoicePreset } from './src/data/voiceLibrary';

export const STYLE_CATEGORIES = ['ALL', 'LATIN', 'POP', 'ROCK', 'BALLAD', 'CUMBIA', 'DANCE', 'CUSTOM'];
export const VOICE_CATEGORIES = ['ALL', 'PIANO', 'PADS', 'STRINGS', 'LEADS', 'BRASS', 'ORGAN', 'BASS', 'CUSTOM'];

// ===================================================
// APLICACIÓN PRINCIPAL (SYNTH CONNECT PRO)
// ===================================================
export default function App() {
  const {
    isInitialized,
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
  } = useSynthEngine();
  const {
    devices,
    usbDevices,
    connectedUsbDevice,
    connectedBleDevice,
    connectedDeviceId,
    connectedDeviceName,
    isDirectUsbActive,
    isBluetoothEnabled,
    isScanningBle,
    discoveredBleDevices,
    diagnostics,
    scan,
    connect,
    requestBluetoothPermissions,
    startBleScan,
    stopBleScan,
    connectBle,
    disconnect,
  } = useMidiDevices();

  const [isBleModalVisible, setIsBleModalVisible] = useState<boolean>(false);

  // Pedal de sustain virtual (muchos teclados Bluetooth no envían el pedal por MIDI)
  const [isSustainOn, setIsSustainOn] = useState<boolean>(false);
  const toggleSustain = () => {
    setIsSustainOn((prev) => {
      const next = !prev;
      setSustainPedal(next);
      return next;
    });
  };
  const [isConnectingAddress, setIsConnectingAddress] = useState<string | null>(null);


  const handleOpenBluetoothModal = async () => {
    setIsBleModalVisible(true);
    const granted = await requestBluetoothPermissions();
    if (granted) {
      const started = await startBleScan();
      if (!started) {
        showAlert(
          'WARNING',
          'BLUETOOTH APAGADO',
          'Activa el Bluetooth del teléfono para buscar teclados MIDI inalámbricos.'
        );
      }
    } else {
      showAlert(
        'WARNING',
        'PERMISOS BLUETOOTH REQUERIDOS',
        'Se requiere el permiso de Dispositivos Cercanos para buscar teclados Bluetooth.'
      );
    }
  };

  const handleConnectBleDevice = async (dev: { address: string; name: string }) => {
    setIsConnectingAddress(dev.address);
    const ok = await connectBle(dev.address);
    setIsConnectingAddress(null);
    if (ok) {
      showAlert('SUCCESS', 'TECLADO CONECTADO', `Teclado "${dev.name}" enlazado y listo para tocar por Bluetooth.`);
    } else {
      showAlert(
        'ERROR',
        'ERROR DE CONEXIÓN',
        `No se pudo conectar a "${dev.name}". Asegúrate de que no esté conectado a otro teléfono o computadora y que el botón BT esté parpadeando.`
      );
    }
  };
  const {
    currentChord,
    bpm,
    currentSection,
    queuedSection,
    currentBeat,
    isPlaying,
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
    setStyleVolume,
    startStopStyle,
    toggleSyncStart,
    toggleAccompaniment,
    selectStyle,
    importStyleFiles,
    deleteStyleFile,
    renameStyleFile,
  } = useArranger();

  // Estados de Vista Integrada (Sin Modales Flotantes)
  const [currentView, setCurrentView] = useState<'MAIN' | 'STYLE_LIBRARY' | 'VOICE_LIBRARY' | 'EDIT_VOICE'>('MAIN');
  // Vista a la que vuelve la librería de voces (se puede abrir desde En vivo o desde Editar voz)
  const [voiceLibraryReturnView, setVoiceLibraryReturnView] = useState<'MAIN' | 'EDIT_VOICE'>('MAIN');
  const [styleSearchText, setStyleSearchText] = useState<string>('');
  const [voiceSearchText, setVoiceSearchText] = useState<string>('');
  const [renameDialog, setRenameDialog] = useState<{
    visible: boolean;
    targetId: string;
    currentName: string;
    type: 'STYLE' | 'VOICE';
  }>({
    visible: false,
    targetId: '',
    currentName: '',
    type: 'STYLE',
  });
  const [renameInputText, setRenameInputText] = useState<string>('');

  const [activeBank, setActiveBank] = useState<number>(1);
  const [modulation, setModulation] = useState<number>(0);
  const [selectedFaderId, setSelectedFaderId] = useState<number>(1);

  // Transposición Global (Aplica a todos los faders)
  const [transpose, setTranspose] = useState<number>(0);

  // Hora y Batería Reales del Dispositivo
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  const [batteryPercent, setBatteryPercent] = useState<number>(100);

  // Faders State (Cada fader con su octava y efectos DSP independientes)
  const [faders, setFaders] = useState([
    { id: 1, name: 'Yamaha CFX Grand', value: 80, solo: false, mute: false, octave: 0, cutoff: 100, resonance: 20, attack: 0, delay: 45, sustain: 100, release: 30 },
    { id: 2, name: 'Ambient Pad Warm', value: 65, solo: false, mute: false, octave: 0, cutoff: 90, resonance: 25, attack: 15, delay: 50, sustain: 90, release: 40 },
    { id: 3, name: 'Syn Strings Symphony', value: 50, solo: false, mute: false, octave: 0, cutoff: 95, resonance: 20, attack: 10, delay: 45, sustain: 95, release: 35 },
    { id: 4, name: 'Synth Lead Moog Saw', value: 75, solo: false, mute: false, octave: 0, cutoff: 100, resonance: 30, attack: 0, delay: 40, sustain: 100, release: 25 },
  ]);

  const activeFader = faders.find((f) => f.id === selectedFaderId) || faders[0];

  // Voice Selection & Custom SoundFonts State
  const [customVoices, setCustomVoices] = useState<CustomVoicePreset[]>([]);

  useEffect(() => {
    async function loadUserSoundfonts() {
      const userList = await SoundLibraryService.getCustomVoices();
      setCustomVoices(userList);
    }
    loadUserSoundfonts();
  }, []);

  const fullVoiceLibrary = useMemo(() => [...VOICE_LIBRARY, ...customVoices], [customVoices]);

  // Sincronización continua de mezcla, voces, octava y efectos por fader a C++ NDK
  useEffect(() => {
    faders.forEach((fader, index) => {
      const foundVoice = fullVoiceLibrary.find((v) => v.id === fader.name || v.name === fader.name);
      setLayerMix(index, fader.value / 100, fader.mute, fader.solo);
      setLayerVoice(index, fader.name, foundVoice?.sf2Preset ?? 0, foundVoice?.sf2Path || '');
      setLayerOctave(index, fader.octave);
      setLayerParam(index, 'cutoff', fader.cutoff);
      setLayerParam(index, 'resonance', fader.resonance);
      setLayerParam(index, 'attack', fader.attack);
      setLayerParam(index, 'decay', fader.delay);
      setLayerParam(index, 'sustain', fader.sustain);
      setLayerParam(index, 'release', fader.release);
    });
  }, [faders, fullVoiceLibrary, setLayerMix, setLayerVoice, setLayerOctave, setLayerParam]);

  // Voice Selection State
  const [selectedVoiceCategory, setSelectedVoiceCategory] = useState<string>('ALL');
  const [targetFaderId, setTargetFaderId] = useState<number>(1);

  // Sincronización de transposición global y modulación
  useEffect(() => {
    setGlobalTranspose(transpose);
  }, [transpose, setGlobalTranspose]);

  useEffect(() => {
    setParam('modulation', modulation);
  }, [modulation, setParam]);



  // Custom Console Alert State
  const [consoleAlert, setConsoleAlert] = useState<{
    visible: boolean;
    type: 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING';
    title: string;
    message: string;
    onConfirm?: () => void;
    showCancel?: boolean;
  }>({
    visible: false,
    type: 'SUCCESS',
    title: '',
    message: '',
  });

  const showAlert = (
    type: 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING',
    title: string,
    message: string,
    onConfirm?: () => void,
    showCancel: boolean = false
  ) => {
    setConsoleAlert({
      visible: true,
      type,
      title,
      message,
      onConfirm,
      showCancel,
    });
  };

  const hideAlert = () => {
    setConsoleAlert((prev) => ({ ...prev, visible: false }));
  };

  // Bank Memory Catalog State
  const [memoryBanksCatalog, setMemoryBanksCatalog] = useState<MemoryBanksCatalog>({});

  useEffect(() => {
    async function loadBanks() {
      const catalog = await BankMemoryService.getAllBanks();
      setMemoryBanksCatalog(catalog);
    }
    loadBanks();
  }, []);

  const bankPressTimerRef = useRef<{ [key: number]: any }>({});
  const bankPressStartRef = useRef<{ [key: number]: number }>({});
  const bankDidClearRef = useRef<{ [key: number]: boolean }>({});

  const handleClearMemoryBank = async (bankNum: number) => {
    try {
      await BankMemoryService.clearBank(bankNum);
      setMemoryBanksCatalog((prev) => {
        const next = { ...prev };
        delete next[bankNum];
        return next;
      });
      if (activeBank === bankNum) {
        setActiveBank(0);
      }
      showAlert(
        'INFO',
        `BANCO ${bankNum} LIMPIADO`,
        `Se ha borrado la configuración del BANCO ${bankNum}. Ahora está vacío.`
      );
    } catch (e) {
      console.warn('Error al limpiar banco de memoria:', e);
    }
  };

  const handleBankPressIn = (bankNum: number) => {
    bankPressStartRef.current[bankNum] = Date.now();
    bankDidClearRef.current[bankNum] = false;

    // Timer de 3 segundos exactos para limpiar el banco
    bankPressTimerRef.current[bankNum] = setTimeout(() => {
      bankDidClearRef.current[bankNum] = true;
      handleClearMemoryBank(bankNum);
    }, 3000);
  };

  const handleBankPressOut = (bankNum: number) => {
    if (bankPressTimerRef.current[bankNum]) {
      clearTimeout(bankPressTimerRef.current[bankNum]);
    }
    if (bankDidClearRef.current[bankNum]) {
      return;
    }
    const duration = Date.now() - (bankPressStartRef.current[bankNum] || 0);
    if (duration >= 1000) {
      // 1 segundo sostenido: Guardar en el banco
      handleSaveMemoryBank(bankNum);
    } else {
      // Toque normal: Cargar banco
      handleLoadMemoryBank(bankNum);
    }
  };

  const handleSaveMemoryBank = async (bankNum: number) => {
    const f1 = faders.find((f) => f.id === 1) || { name: 'Voice 1', value: 80, mute: false, solo: false, octave: 0, cutoff: 100, resonance: 20, attack: 0, delay: 45, sustain: 100, release: 30 };
    const f2 = faders.find((f) => f.id === 2) || { name: 'Voice 2', value: 65, mute: false, solo: false, octave: 0, cutoff: 90, resonance: 25, attack: 15, delay: 50, sustain: 90, release: 40 };
    const f3 = faders.find((f) => f.id === 3) || { name: 'Voice 3', value: 50, mute: false, solo: false, octave: 0, cutoff: 95, resonance: 20, attack: 10, delay: 45, sustain: 95, release: 35 };
    const f4 = faders.find((f) => f.id === 4) || { name: 'Voice 4', value: 75, mute: false, solo: false, octave: 0, cutoff: 100, resonance: 30, attack: 0, delay: 40, sustain: 100, release: 25 };

    const newPreset = await BankMemoryService.saveBank(bankNum, {
      f1: { voiceId: f1.name, volume: f1.value, mute: f1.mute, solo: f1.solo, octave: f1.octave, cutoff: f1.cutoff, resonance: f1.resonance, attack: f1.attack, delay: f1.delay, sustain: f1.sustain, release: f1.release },
      f2: { voiceId: f2.name, volume: f2.value, mute: f2.mute, solo: f2.solo, octave: f2.octave, cutoff: f2.cutoff, resonance: f2.resonance, attack: f2.attack, delay: f2.delay, sustain: f2.sustain, release: f2.release },
      f3: { voiceId: f3.name, volume: f3.value, mute: f3.mute, solo: f3.solo, octave: f3.octave, cutoff: f3.cutoff, resonance: f3.resonance, attack: f3.attack, delay: f3.delay, sustain: f3.sustain, release: f3.release },
      f4: { voiceId: f4.name, volume: f4.value, mute: f4.mute, solo: f4.solo, octave: f4.octave, cutoff: f4.cutoff, resonance: f4.resonance, attack: f4.attack, delay: f4.delay, sustain: f4.sustain, release: f4.release },
      octave: f1.octave,
      transpose,
      attack: f1.attack,
      delay: f1.delay,
      sustain: f1.sustain,
      release: f1.release,
      cutoff: f1.cutoff,
      resonance: f1.resonance,
      modulation,
      styleId: loadedStyle.id,
      styleName: loadedStyle.name,
      styleCategory: loadedStyle.category,
      styleVolume,
      bpm,
    });

    setMemoryBanksCatalog((prev) => ({ ...prev, [bankNum]: newPreset }));
    setActiveBank(bankNum);

    showAlert(
      'SUCCESS',
      `GUARDADO EN BANCO ${bankNum}`,
      `Se ha guardado la combinación actual en el BANCO ${bankNum}:\n- F1: ${f1.name} (OCT ${f1.octave > 0 ? '+' : ''}${f1.octave})\n- F2: ${f2.name} (OCT ${f2.octave > 0 ? '+' : ''}${f2.octave})\n- Ritmo: ${loadedStyle.name}\n- Transposición Global: ${transpose > 0 ? '+' : ''}${transpose}`
    );
  };

  const handleLoadMemoryBank = async (bankNum: number) => {
    const preset = memoryBanksCatalog[bankNum];
    if (!preset) {
      showAlert(
        'INFO',
        `BANCO ${bankNum} VACÍO`,
        `El BANCO ${bankNum} no tiene ningún preset guardado todavía.\n\nMantén presionado el botón BANK ${bankNum} para guardar tu configuración actual.`
      );
      return;
    }

    // Restaurar Faders con sus octavas y efectos individuales
    const newFaders = [
      {
        id: 1,
        name: preset.f1.voiceId,
        value: preset.f1.volume,
        mute: preset.f1.mute,
        solo: preset.f1.solo,
        octave: preset.f1.octave ?? preset.octave ?? 0,
        cutoff: preset.f1.cutoff ?? preset.cutoff ?? 100,
        resonance: preset.f1.resonance ?? preset.resonance ?? 20,
        attack: preset.f1.attack ?? preset.attack ?? 0,
        delay: preset.f1.delay ?? preset.delay ?? 45,
        sustain: preset.f1.sustain ?? preset.sustain ?? 100,
        release: preset.f1.release ?? preset.release ?? 30,
      },
      {
        id: 2,
        name: preset.f2.voiceId,
        value: preset.f2.volume,
        mute: preset.f2.mute,
        solo: preset.f2.solo,
        octave: preset.f2.octave ?? 0,
        cutoff: preset.f2.cutoff ?? preset.cutoff ?? 90,
        resonance: preset.f2.resonance ?? preset.resonance ?? 25,
        attack: preset.f2.attack ?? preset.attack ?? 15,
        delay: preset.f2.delay ?? preset.delay ?? 50,
        sustain: preset.f2.sustain ?? preset.sustain ?? 90,
        release: preset.f2.release ?? preset.release ?? 40,
      },
      {
        id: 3,
        name: preset.f3.voiceId,
        value: preset.f3.volume,
        mute: preset.f3.mute,
        solo: preset.f3.solo,
        octave: preset.f3.octave ?? 0,
        cutoff: preset.f3.cutoff ?? preset.cutoff ?? 95,
        resonance: preset.f3.resonance ?? preset.resonance ?? 20,
        attack: preset.f3.attack ?? preset.attack ?? 10,
        delay: preset.f3.delay ?? preset.delay ?? 45,
        sustain: preset.f3.sustain ?? preset.sustain ?? 95,
        release: preset.f3.release ?? preset.release ?? 35,
      },
      {
        id: 4,
        name: preset.f4.voiceId,
        value: preset.f4.volume,
        mute: preset.f4.mute,
        solo: preset.f4.solo,
        octave: preset.f4.octave ?? 0,
        cutoff: preset.f4.cutoff ?? preset.cutoff ?? 100,
        resonance: preset.f4.resonance ?? preset.resonance ?? 30,
        attack: preset.f4.attack ?? preset.attack ?? 0,
        delay: preset.f4.delay ?? preset.delay ?? 40,
        sustain: preset.f4.sustain ?? preset.sustain ?? 100,
        release: preset.f4.release ?? preset.release ?? 25,
      },
    ];
    setFaders(newFaders);
    setTranspose(preset.transpose);
    setModulation(preset.modulation);

    // Aplicar a Motor Sintetizador Nativo C++ inmediatamente
    try {
      newFaders.forEach((f, idx) => {
        const foundVoice = fullVoiceLibrary.find((v) => v.id === f.name || v.name === f.name);
        setLayerMix(idx, f.value / 100, f.mute, f.solo);
        setLayerVoice(idx, f.name, foundVoice?.sf2Preset ?? 0, foundVoice?.sf2Path || '');
        setLayerOctave(idx, f.octave);
        setLayerParam(idx, 'cutoff', f.cutoff);
        setLayerParam(idx, 'resonance', f.resonance);
        setLayerParam(idx, 'attack', f.attack);
        setLayerParam(idx, 'decay', f.delay);
        setLayerParam(idx, 'sustain', f.sustain);
        setLayerParam(idx, 'release', f.release);
      });
      setGlobalTranspose(preset.transpose);
      setParam('modulation', preset.modulation);
    } catch (e) {
      console.warn('Error al aplicar envolvente de banco a synth engine:', e);
    }

    // Restaurar Ritmo y Tempo
    setStyleVolume(preset.styleVolume);
    setBpm(preset.bpm);

    const matchStyle = availableStyles.find((s) => s.id === preset.styleId || s.name === preset.styleName);
    if (matchStyle) {
      selectStyle(matchStyle, preset.bpm);
    }

    setActiveBank(bankNum);
  };

  const handleImportSoundFile = async () => {
    const targetCat = selectedVoiceCategory === 'ALL' ? 'PIANO' : selectedVoiceCategory;
    const res = await SoundLibraryService.pickAndImportSoundFiles(targetCat);

    if (res.importedVoices.length > 0) {
      setCustomVoices((prev) => [...prev, ...res.importedVoices]);
      if (res.rejectedCount > 0) {
        showAlert(
          'WARNING',
          'IMPORTACIÓN PARCIAL',
          `Se agregaron ${res.importedVoices.length} sonido(s) a ${targetCat}, pero ${res.rejectedCount} archivo(s) no tenían formato .SF2 / .SFZ.`
        );
      } else {
        showAlert(
          'SUCCESS',
          'SONIDO IMPORTADO',
          `Se agregaron ${res.importedVoices.length} archivo(s) .SF2 correctamente a la categoría ${targetCat}.`
        );
      }
    } else if (res.rejectedCount > 0) {
      showAlert(
        'ERROR',
        'FORMATO NO SOPORTADO',
        `Se rechazaron ${res.rejectedCount} archivo(s). Por favor selecciona únicamente archivos con formato .SF2 o .SFZ.`
      );
    }
  };

  const handleDeleteVoice = (voiceId: string, voiceName: string) => {
    showAlert(
      'WARNING',
      'ELIMINAR SONIDO',
      `¿Estás seguro de eliminar el sonido "${voiceName}" de la memoria del dispositivo?`,
      async () => {
        await SoundLibraryService.deleteCustomVoice(voiceId);
        setCustomVoices((prev) => prev.filter((v) => v.id !== voiceId));
      },
      true
    );
  };

  // Contadores de Categorías
  const getStyleCategoryCount = (cat: string) => {
    if (cat === 'ALL') return availableStyles.length;
    return availableStyles.filter((st) => matchStyleCategory(st.category, st.name, cat)).length;
  };

  const getVoiceCategoryCount = (cat: string) => {
    if (cat === 'ALL') return fullVoiceLibrary.length;
    return fullVoiceLibrary.filter((v) => v.category === cat).length;
  };

  // Listas filtradas con buscador en tiempo real
  const filteredStyles = availableStyles.filter((st) => {
    const matchesCat = matchStyleCategory(st.category, st.name, selectedCategory);
    const matchesSearch = !styleSearchText.trim() || st.name.toLowerCase().includes(styleSearchText.toLowerCase().trim());
    return matchesCat && matchesSearch;
  });

  const filteredVoices = fullVoiceLibrary.filter((v) => {
    const matchesCat = selectedVoiceCategory === 'ALL' || v.category === selectedVoiceCategory;
    const matchesSearch = !voiceSearchText.trim() || v.name.toLowerCase().includes(voiceSearchText.toLowerCase().trim());
    return matchesCat && matchesSearch;
  });

  // Diálogo de Renombrar
  const openRenameDialog = (id: string, name: string, type: 'STYLE' | 'VOICE') => {
    setRenameDialog({ visible: true, targetId: id, currentName: name, type });
    setRenameInputText(name);
  };

  const handleSaveRename = async () => {
    const trimmed = renameInputText.trim();
    if (!trimmed) return;
    if (renameDialog.type === 'STYLE') {
      await renameStyleFile(renameDialog.targetId, trimmed);
      showAlert('SUCCESS', 'RITMO RENOMBRADO', `El ritmo ha sido renombrado a "${trimmed}".`);
    } else {
      await SoundLibraryService.renameCustomVoice(renameDialog.targetId, trimmed);
      const userList = await SoundLibraryService.getCustomVoices();
      setCustomVoices(userList);
      setFaders((prev) =>
        prev.map((f) => (f.name === renameDialog.currentName ? { ...f, name: trimmed } : f))
      );
      showAlert('SUCCESS', 'VOZ RENOMBRADA', `La voz ha sido renombrada a "${trimmed}".`);
    }
    setRenameDialog({ visible: false, targetId: '', currentName: '', type: 'STYLE' });
  };

  useEffect(() => {
    async function lockLandscape() {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } catch (e) {
        console.warn('ScreenOrientation error:', e);
      }
    }
    lockLandscape();

    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
      setCurrentTimeStr(`${formattedHours}:${formattedMinutes} ${ampm}`);
    };
    updateTime();
    const timeInterval = setInterval(updateTime, 30000);

    async function fetchBattery() {
      try {
        const level = await Battery.getBatteryLevelAsync();
        if (level >= 0) {
          setBatteryPercent(Math.round(level * 100));
        }
      } catch (e) {
        console.warn('Battery error:', e);
      }
    }
    fetchBattery();

    return () => clearInterval(timeInterval);
  }, []);

  // Interceptor del botón físico / gestual de retroceso de Android
  useEffect(() => {
    const onBackPress = () => {
      if (isBleModalVisible) {
        setIsBleModalVisible(false);
        stopBleScan();
        return true;
      }
      if (renameDialog.visible) {
        setRenameDialog({ visible: false, targetId: '', currentName: '', type: 'STYLE' });
        return true;
      }
      if (consoleAlert.visible) {
        hideAlert();
        return true;
      }
      if (currentView === 'VOICE_LIBRARY') {
        setCurrentView(voiceLibraryReturnView);
        return true;
      }
      if (currentView !== 'MAIN') {
        setCurrentView('MAIN');
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [currentView, voiceLibraryReturnView, isBleModalVisible, renameDialog.visible, consoleAlert.visible, stopBleScan]);

  const handleFaderChange = (id: number, newVal: number) => {
    setFaders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, value: newVal } : f))
    );
  };

  const toggleSolo = (id: number) => {
    setFaders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, solo: !f.solo } : f))
    );
  };

  const toggleMute = (id: number) => {
    setFaders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, mute: !f.mute } : f))
    );
  };

  // OCTAVE desplaza todos los faders juntos (conservando la diferencia entre ellos)
  const shiftAllOctaves = (delta: number) => {
    const next = faders.map((f) => ({ ...f, octave: Math.max(-3, Math.min(3, f.octave + delta)) }));
    setFaders(next);
    next.forEach((f, idx) => setLayerOctave(idx, f.octave));
  };

  // Octava de un solo fader (pantalla Editar voz)
  const shiftFaderOctave = (id: number, delta: number) => {
    setFaders((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        const octave = Math.max(-3, Math.min(3, f.octave + delta));
        setLayerOctave(f.id - 1, octave);
        return { ...f, octave };
      })
    );
  };

  const changeTranspose = (delta: number) => {
    const newTrp = Math.max(-12, Math.min(12, transpose + delta));
    setTranspose(newTrp);
    setGlobalTranspose(newTrp);
  };

  // Parámetros de sonido del fader seleccionado ('delay' es el decay en el estado)
  type VoiceParamKey = 'cutoff' | 'resonance' | 'attack' | 'delay' | 'sustain' | 'release';
  const updateActiveFaderParam = (key: VoiceParamKey, val: number) => {
    const targetId = activeFader.id;
    setFaders((prev) => prev.map((f) => (f.id === targetId ? { ...f, [key]: val } : f)));
    setLayerParam(targetId - 1, key === 'delay' ? 'decay' : key, val);
  };

  const openVoiceLibrary = (faderId: number, from: 'MAIN' | 'EDIT_VOICE') => {
    setSelectedFaderId(faderId);
    setTargetFaderId(faderId);
    setVoiceLibraryReturnView(from);
    setCurrentView('VOICE_LIBRARY');
  };

  // Octava mostrada en En vivo: si todos los faders coinciden se muestra el valor, si no "MIX"
  const allOctavesEqual = faders.every((f) => f.octave === faders[0].octave);
  const formatSigned = (n: number) => (n > 0 ? `+${n}` : `${n}`);

  // ----- Arreglista -----
  // Variación en uso (A-D): la de la sección actual (MAIN_B, FILL_B, INTRO_B -> B)
  const currentVariation = ((currentSection.split('_')[1] as 'A' | 'B' | 'C' | 'D') || 'A');

  // INTRO / ENDING usan la variación en uso; si el ritmo no la trae, la A
  const resolveSection = (kind: 'INTRO' | 'ENDING') => {
    const wanted = `${kind}_${currentVariation}` as typeof currentSection;
    if (availableSections.includes(wanted)) return wanted;
    return `${kind}_A` as typeof currentSection;
  };

  const handleIntroPress = () => {
    setSection(resolveSection('INTRO'));
    if (!isPlaying) startStopStyle();
  };

  const handleEndingPress = () => {
    if (!isPlaying) return;
    setSection(resolveSection('ENDING'));
  };

  const handleFillPress = () => {
    triggerFillIn(currentVariation);
  };

  const formatSectionName = (sec: string) => {
    if (!sec) return '';
    const [kind, letter] = sec.split('_');
    return `${kind} ${letter ?? ''}`.trim();
  };

  const isMidiConnected = !!(connectedBleDevice || connectedUsbDevice);
  const midiDeviceLabel = connectedBleDevice?.name || connectedUsbDevice?.name || 'SIN TECLADO';

  const handleMidiIndicatorPress = () => {
    scan();
    handleOpenBluetoothModal();
  };

  // Gráfica ADSR del fader seleccionado, dibujada en el tamaño real del recuadro (sin deformar)
  const [adsrGraphSize, setAdsrGraphSize] = useState<{ w: number; h: number }>({ w: 240, h: 140 });
  const calculateAdsrPoints = () => {
    const { w, h } = adsrGraphSize;
    const pad = 14;
    const baseY = h - pad;
    const peakY = pad + 6;
    const usable = w - pad * 2;
    // Reparto horizontal: A 0-25%, D 0-25%, meseta fija 20%, R 0-25% del ancho
    const startX = pad;
    const attackX = startX + usable * 0.04 + (activeFader.attack / 100) * usable * 0.22;
    const decayX = attackX + usable * 0.06 + (activeFader.delay / 100) * usable * 0.22;
    const sustainY = baseY - (activeFader.sustain / 100) * (baseY - peakY);
    const sustainX = decayX + usable * 0.2;
    const releaseX = Math.min(sustainX + usable * 0.04 + (activeFader.release / 100) * usable * 0.22, w - pad);
    // Etiqueta arriba del punto, o abajo si no cabe
    const labelY = (y: number) => (y - 9 < 8 ? y + 16 : y - 9);
    return {
      path: `M ${startX} ${baseY} L ${attackX} ${peakY} L ${decayX} ${sustainY} L ${sustainX} ${sustainY} L ${releaseX} ${baseY} Z`,
      strokePath: `M ${startX} ${baseY} L ${attackX} ${peakY} L ${decayX} ${sustainY} L ${sustainX} ${sustainY} L ${releaseX} ${baseY}`,
      midY: (baseY + peakY) / 2,
      nodes: [
        { key: 'A', x: attackX, y: peakY, ly: labelY(peakY) },
        { key: 'D', x: decayX, y: sustainY, ly: labelY(sustainY) },
        { key: 'S', x: sustainX, y: sustainY, ly: labelY(sustainY) },
        { key: 'R', x: releaseX, y: baseY, ly: baseY - 9 },
      ],
    };
  };

  const adsrCoords = calculateAdsrPoints();

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="light-content" hidden={true} />

      {/* ================= BARRA SUPERIOR ================= */}
      <View style={styles.topBar}>
        {/* Indicador MIDI único: abre la conexión de teclados */}
        <TouchableOpacity
          activeOpacity={0.7}
          delayPressIn={0}
          delayPressOut={0}
          style={[styles.topMidiBtn, isMidiConnected && styles.topMidiBtnConnected]}
          onPress={handleMidiIndicatorPress}
        >
          <View style={[styles.topMidiDot, isMidiConnected ? styles.topMidiDotOn : isScanningBle && styles.topMidiDotScanning]} />
          {connectedUsbDevice && !connectedBleDevice ? (
            <UsbCableIcon size={12} color="#00E5FF" />
          ) : (
            <BluetoothIcon size={12} color={isMidiConnected ? '#00E5FF' : '#6B829D'} />
          )}
          <Text style={[styles.topMidiText, isMidiConnected && styles.topMidiTextConnected]} numberOfLines={1}>
            {midiDeviceLabel.toUpperCase()}
          </Text>
        </TouchableOpacity>

        {/* Ritmo cargado: abre la librería */}
        <TouchableOpacity
          activeOpacity={0.7}
          delayPressIn={0}
          delayPressOut={0}
          style={styles.topStyleBtn}
          onPress={() => setCurrentView('STYLE_LIBRARY')}
        >
          <Text style={styles.topStyleLabel}>RITMO</Text>
          <Text style={styles.topStyleName} numberOfLines={1}>
            {loadedStyle.name}
          </Text>
          <Text style={styles.topStyleChevron}>›</Text>
        </TouchableOpacity>

        {/* Tempo */}
        <View style={styles.topTempoBox}>
          <TouchableOpacity
            activeOpacity={0.7}
            delayPressIn={0}
            delayPressOut={0}
            style={styles.topTempoBtn}
            onPress={() => setBpm(bpm - 1)}
          >
            <Text style={styles.topTempoBtnText}>-</Text>
          </TouchableOpacity>
          <View style={styles.topTempoValueBox}>
            <Text style={styles.topTempoValue}>{bpm}</Text>
            <Text style={styles.topTempoUnit}>BPM</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            delayPressIn={0}
            delayPressOut={0}
            style={styles.topTempoBtn}
            onPress={() => setBpm(bpm + 1)}
          >
            <Text style={styles.topTempoBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Beat */}
        <View style={styles.topBeatRow}>
          {[1, 2, 3, 4].map((b) => {
            const lit = isPlaying && currentBeat === b;
            return (
              <View
                key={b}
                style={[styles.topBeatDot, lit && (b === 1 ? styles.topBeatDotDownbeat : styles.topBeatDotOn)]}
              />
            );
          })}
        </View>

        {/* Pedal de sustain virtual (el piano no envía CC64) */}
        <TouchableOpacity
          activeOpacity={0.7}
          delayPressIn={0}
          delayPressOut={0}
          style={[styles.topSustainBtn, isSustainOn && styles.topSustainBtnOn]}
          onPress={toggleSustain}
        >
          <Text style={[styles.topSustainText, isSustainOn && styles.topSustainTextOn]}>SUSTAIN</Text>
        </TouchableOpacity>

        <View style={styles.topSysInfo}>
          <Text style={styles.topSysText}>{currentTimeStr}</Text>
          <Text style={styles.topSysText}>{batteryPercent}%</Text>
        </View>
      </View>

      {/* ================= VISTA 1: EN VIVO ================= */}
      {currentView === 'MAIN' && (
        <View style={styles.liveContainer}>
          <View style={styles.liveWorkspace}>
            {/* ---------- ZONA IZQUIERDA: ARREGLISTA ---------- */}
            <View style={styles.arrangerZone}>
              <View style={styles.chordCard}>
                <View style={styles.chordMain}>
                  <Text style={styles.chordLabel}>ACORDE</Text>
                  <Text
                    style={[styles.chordText, currentChord === '---' && styles.chordTextIdle]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {currentChord}
                  </Text>
                </View>
                <View style={styles.chordSide}>
                  <Text style={styles.chordLabel}>SECCIÓN</Text>
                  <Text style={[styles.sectionNowText, isPlaying && styles.sectionNowTextPlaying]}>
                    {formatSectionName(currentSection)}
                  </Text>
                  <Text style={styles.sectionNextText} numberOfLines={1}>
                    {queuedSection ? `SIGUE: ${formatSectionName(queuedSection)}` : isSyncStart ? 'ESPERANDO NOTA' : ' '}
                  </Text>
                  <View style={styles.styleVolumeBox}>
                    <HorizontalFader label="VOL. RITMO" value={styleVolume} onChange={setStyleVolume} color="#00E5FF" />
                  </View>
                </View>
              </View>

              {/* MAIN A-D */}
              <View style={styles.mainSectionRow}>
                {(['A', 'B', 'C', 'D'] as const).map((letter) => {
                  const sec = `MAIN_${letter}` as const;
                  const isCurrent = currentSection === sec;
                  const isVariation = !isCurrent && currentVariation === letter && !currentSection.startsWith('MAIN_');
                  const isQueued = queuedSection === sec;
                  return (
                    <TouchableOpacity
                      key={sec}
                      activeOpacity={0.7}
                      delayPressIn={0}
                      delayPressOut={0}
                      style={[
                        styles.mainSectionBtn,
                        isVariation && styles.mainSectionBtnVariation,
                        isCurrent && styles.mainSectionBtnActive,
                        isQueued && styles.liveQueued,
                      ]}
                      onPress={() => setSection(sec)}
                    >
                      <Text style={styles.mainSectionKind}>MAIN</Text>
                      <Text
                        style={[
                          styles.mainSectionLetter,
                          (isCurrent || isVariation) && styles.mainSectionLetterActive,
                          isQueued && styles.sectionTextQueued,
                        ]}
                      >
                        {letter}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* INTRO / FILL / ENDING */}
              <View style={styles.specialSectionRow}>
                {(() => {
                  const isCurrent = currentSection.startsWith('INTRO_');
                  const isQueued = queuedSection.startsWith('INTRO_');
                  return (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      delayPressIn={0}
                      delayPressOut={0}
                      style={[styles.specialBtn, isCurrent && isPlaying && styles.liveIntroBtnActive, isQueued && styles.liveQueued]}
                      onPress={handleIntroPress}
                    >
                      <Text style={[styles.specialBtnText, styles.liveIntroText, isQueued && styles.sectionTextQueued]}>INTRO</Text>
                    </TouchableOpacity>
                  );
                })()}

                <TouchableOpacity
                  activeOpacity={0.7}
                  delayPressIn={0}
                  delayPressOut={0}
                  style={[
                    styles.specialBtn,
                    currentSection.startsWith('FILL_') && styles.fillBtnActive,
                    !isPlaying && styles.specialBtnDisabled,
                  ]}
                  onPress={handleFillPress}
                >
                  <Text style={[styles.specialBtnText, styles.fillText]}>FILL</Text>
                </TouchableOpacity>

                {(() => {
                  const isCurrent = currentSection.startsWith('ENDING_');
                  const isQueued = queuedSection.startsWith('ENDING_');
                  return (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      delayPressIn={0}
                      delayPressOut={0}
                      style={[
                        styles.specialBtn,
                        isCurrent && isPlaying && styles.liveEndingBtnActive,
                        isQueued && styles.liveQueued,
                        !isPlaying && styles.specialBtnDisabled,
                      ]}
                      onPress={handleEndingPress}
                    >
                      <Text style={[styles.specialBtnText, styles.liveEndingText, isQueued && styles.sectionTextQueued]}>ENDING</Text>
                    </TouchableOpacity>
                  );
                })()}
              </View>

              {/* SYNC / ACMP / START */}
              <View style={styles.transportRowLive}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  delayPressIn={0}
                  delayPressOut={0}
                  style={[styles.transportBtnLive, isSyncStart && styles.syncBtnOn]}
                  onPress={toggleSyncStart}
                >
                  <View style={[styles.transportLed, isSyncStart && styles.transportLedSync]} />
                  <Text style={[styles.transportBtnLiveText, isSyncStart && styles.syncTextOn]}>SYNC</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  delayPressIn={0}
                  delayPressOut={0}
                  style={[styles.transportBtnLive, isAccompanimentOn && styles.acmpBtnOn]}
                  onPress={toggleAccompaniment}
                >
                  <View style={[styles.transportLed, isAccompanimentOn && styles.transportLedAcmp]} />
                  <Text style={[styles.transportBtnLiveText, isAccompanimentOn && styles.acmpTextOn]}>ACMP</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  delayPressIn={0}
                  delayPressOut={0}
                  style={[styles.startBtnLive, isPlaying && styles.startBtnLivePlaying]}
                  onPress={startStopStyle}
                >
                  <Text style={[styles.startBtnLiveText, isPlaying && styles.startBtnLiveTextPlaying]}>
                    {isPlaying ? 'STOP' : 'START'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ---------- ZONA DERECHA: 4 FADERS ---------- */}
            <View style={styles.mixerZone}>
              <View style={styles.fadersRowLive}>
                {faders.map((fader) => (
                  <ConsoleFader
                    key={fader.id}
                    id={fader.id}
                    name={fader.name}
                    value={fader.value}
                    solo={fader.solo}
                    mute={fader.mute}
                    octave={fader.octave}
                    isSelected={selectedFaderId === fader.id}
                    onSelect={setSelectedFaderId}
                    onChange={handleFaderChange}
                    onToggleSolo={toggleSolo}
                    onToggleMute={toggleMute}
                    onOpenVoice={(id) => openVoiceLibrary(id, 'MAIN')}
                  />
                ))}
              </View>

              <View style={styles.mixerBottomRow}>
                <View style={styles.stepperBlock}>
                  <Text style={styles.stepperLabel}>OCTAVA</Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    delayPressIn={0}
                    delayPressOut={0}
                    style={styles.stepperBtn}
                    onPress={() => shiftAllOctaves(-1)}
                  >
                    <Text style={styles.stepperBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{allOctavesEqual ? formatSigned(faders[0].octave) : 'MIX'}</Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    delayPressIn={0}
                    delayPressOut={0}
                    style={styles.stepperBtn}
                    onPress={() => shiftAllOctaves(1)}
                  >
                    <Text style={styles.stepperBtnText}>+</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.stepperBlock}>
                  <Text style={styles.stepperLabel}>TRANSP.</Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    delayPressIn={0}
                    delayPressOut={0}
                    style={styles.stepperBtn}
                    onPress={() => changeTranspose(-1)}
                  >
                    <Text style={styles.stepperBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={[styles.stepperValue, transpose !== 0 && styles.stepperValueChanged]}>{formatSigned(transpose)}</Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    delayPressIn={0}
                    delayPressOut={0}
                    style={styles.stepperBtn}
                    onPress={() => changeTranspose(1)}
                  >
                    <Text style={styles.stepperBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {/* ---------- FILA INFERIOR: BANCOS + EDITAR ---------- */}
          <View style={styles.bankBar}>
            <View style={styles.bankBarLabelBox}>
              <Text style={styles.bankBarLabel}>BANCOS</Text>
              <Text style={styles.bankBarHint}>MANTENER 1 s = GUARDAR</Text>
            </View>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((bankNum) => {
              const isActive = activeBank === bankNum;
              const hasPreset = !!memoryBanksCatalog[bankNum];
              return (
                <TouchableOpacity
                  key={bankNum}
                  activeOpacity={0.7}
                  delayPressIn={0}
                  delayPressOut={0}
                  style={[styles.bankBtn, hasPreset && styles.bankBtnSaved, isActive && styles.bankBtnActive]}
                  onPressIn={() => handleBankPressIn(bankNum)}
                  onPressOut={() => handleBankPressOut(bankNum)}
                >
                  <Text style={[styles.bankBtnNum, hasPreset && styles.bankBtnNumSaved, isActive && styles.bankBtnNumActive]}>
                    {bankNum}
                  </Text>
                  <View style={[styles.bankBtnDot, hasPreset && styles.bankBtnDotSaved, isActive && styles.bankBtnDotActive]} />
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              activeOpacity={0.7}
              delayPressIn={0}
              delayPressOut={0}
              style={styles.editVoiceBtn}
              onPress={() => setCurrentView('EDIT_VOICE')}
            >
              <EditIcon size={13} color="#000000" />
              <Text style={styles.editVoiceBtnText}>EDITAR F{activeFader.id}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ================= VISTA: EDITAR VOZ ================= */}
      {currentView === 'EDIT_VOICE' && (
        <View style={styles.editContainer}>
          <View style={styles.libNavBar}>
            <TouchableOpacity
              activeOpacity={0.7}
              delayPressIn={0}
              delayPressOut={0}
              style={styles.libBackIconBtn}
              onPress={() => setCurrentView('MAIN')}
            >
              <BackArrowIcon size={16} color="#00E5FF" />
            </TouchableOpacity>

            <View style={styles.libTitleContainer}>
              <Text style={styles.libTitleMain}>EDITAR VOZ</Text>
              <Text style={styles.libSubtitle}>Los cambios se aplican al fader seleccionado y se guardan con los bancos.</Text>
            </View>

            <View style={styles.editFaderTabs}>
              {faders.map((f) => {
                const isSel = f.id === selectedFaderId;
                return (
                  <TouchableOpacity
                    key={f.id}
                    activeOpacity={0.7}
                    delayPressIn={0}
                    delayPressOut={0}
                    style={[styles.editFaderTab, isSel && styles.editFaderTabActive]}
                    onPress={() => setSelectedFaderId(f.id)}
                  >
                    <Text style={[styles.editFaderTabId, isSel && styles.editFaderTabIdActive]}>F{f.id}</Text>
                    <Text style={[styles.editFaderTabName, isSel && styles.editFaderTabNameActive]} numberOfLines={1}>
                      {f.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.editBody}>
            {/* Columna 1: voz, gráfica y octava */}
            <View style={styles.editCard}>
              <Text style={styles.editCardTitle}>VOZ F{activeFader.id}</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                delayPressIn={0}
                delayPressOut={0}
                style={styles.editVoiceNameBox}
                onPress={() => openVoiceLibrary(activeFader.id, 'EDIT_VOICE')}
              >
                <Text style={styles.editVoiceName} numberOfLines={2}>
                  {activeFader.name}
                </Text>
                <Text style={styles.editVoiceChange}>CAMBIAR ›</Text>
              </TouchableOpacity>

              <View
                style={styles.editGraphBox}
                onLayout={(e) => {
                  const { width, height } = e.nativeEvent.layout;
                  if (width > 0 && height > 0) setAdsrGraphSize({ w: width, h: height });
                }}
              >
                <Svg width={adsrGraphSize.w} height={adsrGraphSize.h}>
                  <Defs>
                    <LinearGradient id="adsrGrad" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor="#FF9100" stopOpacity="0.7" />
                      <Stop offset="1" stopColor="#FF9100" stopOpacity="0.05" />
                    </LinearGradient>
                  </Defs>
                  <Line x1="0" y1={adsrCoords.midY} x2={adsrGraphSize.w} y2={adsrCoords.midY} stroke="#121C2B" strokeWidth="1" strokeDasharray="4 4" />
                  <Path d={adsrCoords.path} fill="url(#adsrGrad)" />
                  <Path d={adsrCoords.strokePath} stroke="#FF9100" strokeWidth="2.5" fill="none" />
                  {adsrCoords.nodes.map((n) => (
                    <React.Fragment key={n.key}>
                      <Circle cx={n.x} cy={n.y} r="5" fill="#FFFFFF" stroke="#FF9100" strokeWidth="2" />
                      <SvgText x={n.x} y={n.ly} fill="#8A9EB8" fontSize="11" fontWeight="bold" textAnchor="middle">
                        {n.key}
                      </SvgText>
                    </React.Fragment>
                  ))}
                </Svg>
              </View>

              <View style={styles.editOctaveRow}>
                <Text style={styles.stepperLabel}>OCTAVA F{activeFader.id}</Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  delayPressIn={0}
                  delayPressOut={0}
                  style={styles.stepperBtn}
                  onPress={() => shiftFaderOctave(activeFader.id, -1)}
                >
                  <Text style={styles.stepperBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{formatSigned(activeFader.octave)}</Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  delayPressIn={0}
                  delayPressOut={0}
                  style={styles.stepperBtn}
                  onPress={() => shiftFaderOctave(activeFader.id, 1)}
                >
                  <Text style={styles.stepperBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Columna 2: envolvente */}
            <View style={styles.editCard}>
              <Text style={styles.editCardTitle}>ENVOLVENTE</Text>
              <View style={styles.editFaderStack}>
                <HorizontalFader large label="ATTACK" value={activeFader.attack} displayValue={formatAttack(activeFader.attack)} color="#FF9100" onChange={(v) => updateActiveFaderParam('attack', v)} />
                <HorizontalFader large label="DECAY" value={activeFader.delay} displayValue={formatDecay(activeFader.delay)} color="#FF9100" onChange={(v) => updateActiveFaderParam('delay', v)} />
                <HorizontalFader large label="SUSTAIN" value={activeFader.sustain} displayValue={formatSustain(activeFader.sustain)} color="#FF9100" onChange={(v) => updateActiveFaderParam('sustain', v)} />
                <HorizontalFader large label="RELEASE" value={activeFader.release} displayValue={formatRelease(activeFader.release)} color="#FF9100" onChange={(v) => updateActiveFaderParam('release', v)} />
              </View>
            </View>

            {/* Columna 3: filtro y modulación */}
            <View style={styles.editCard}>
              <Text style={styles.editCardTitle}>FILTRO</Text>
              <View style={styles.editFaderStack}>
                <HorizontalFader large label="CUTOFF" value={activeFader.cutoff} color="#00E5FF" onChange={(v) => updateActiveFaderParam('cutoff', v)} />
                <HorizontalFader large label="RESONANCIA" value={activeFader.resonance} color="#00E5FF" onChange={(v) => updateActiveFaderParam('resonance', v)} />
              </View>
              <Text style={[styles.editCardTitle, styles.editCardTitleSpaced]}>MODULACIÓN (TODAS LAS VOCES)</Text>
              <HorizontalFader large label="VIBRATO" value={modulation} color="#B388FF" onChange={setModulation} />
            </View>
          </View>
        </View>
      )}

      {/* ================= VISTA 2: LIBRERÍA DE RITMOS (.STY) INTEGRADA ================= */}
      {currentView === 'STYLE_LIBRARY' && (
        <View style={styles.fullScreenLibraryContainer}>
          {/* Barra Superior de Control y Búsqueda */}
          <View style={styles.libNavBar}>
            <TouchableOpacity
              activeOpacity={0.7}
              delayPressIn={0}
              delayPressOut={0}
              style={styles.libBackIconBtn}
              onPress={() => setCurrentView('MAIN')}
            >
              <BackArrowIcon size={16} color="#00E5FF" />
            </TouchableOpacity>

            <View style={styles.libTitleContainer}>
              <Text style={styles.libTitleMain}>LIBRERÍA DE RITMOS (.STY)</Text>
              <Text style={styles.libSubtitle}>
                Ritmo activo: <Text style={styles.libLoadedHighlight}>{loadedStyle.name}</Text> ({loadedStyle.defaultBpm} BPM)
              </Text>
            </View>

            {/* Buscador de Ritmos */}
            <View style={styles.libSearchBox}>
              <View style={styles.libSearchIconWrap}>
                <SearchIcon size={13} color="#7187A1" />
              </View>
              <TextInput
                style={styles.libSearchInput}
                placeholder="Buscar ritmo por nombre..."
                placeholderTextColor="#5C7087"
                value={styleSearchText}
                onChangeText={setStyleSearchText}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {styleSearchText.length > 0 && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  delayPressIn={0}
                  delayPressOut={0}
                  onPress={() => setStyleSearchText('')}
                  style={styles.libSearchClearBtn}
                >
                  <CloseIcon size={10} color="#8A9EB8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Botón Importar .STY con Icono */}
            <TouchableOpacity
              activeOpacity={0.7}
              delayPressIn={0}
              delayPressOut={0}
              style={styles.libImportIconBtn}
              onPress={async () => {
                const targetCat = selectedCategory === 'ALL' ? 'LATIN' : selectedCategory;
                const res = await importStyleFiles(targetCat);
                if (res.importedStyles.length > 0) {
                  showAlert('SUCCESS', 'RITMO IMPORTADO', `Se agregó el ritmo "${res.importedStyles[0].name}" a la categoría ${targetCat}.`);
                }
              }}
            >
              <PlusIcon size={16} color="#000000" />
            </TouchableOpacity>
          </View>

          {/* Selector de Categorías con Contador Numérico */}
          <View style={styles.libCategoriesBar}>
            {STYLE_CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat;
              const count = getStyleCategoryCount(cat);
              return (
                <TouchableOpacity
                  key={cat}
                  activeOpacity={0.7}
                  delayPressIn={0}
                  delayPressOut={0}
                  style={[styles.libCategoryPill, isActive && styles.libCategoryPillActive]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[styles.libCategoryPillText, isActive && styles.libCategoryPillTextActive]}>
                    {cat}
                  </Text>
                  <View style={[styles.libCategoryCountBadge, isActive && styles.libCategoryCountBadgeActive]}>
                    <Text style={[styles.libCategoryCountText, isActive && styles.libCategoryCountTextActive]}>
                      {count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Grid de Ritmos Enumerados */}
          <ScrollView style={styles.libScrollView} contentContainerStyle={styles.libGridContainer}>
            {filteredStyles.length === 0 ? (
              <View style={styles.libEmptyContainer}>
                <Text style={styles.libEmptyText}>No se encontraron ritmos que coincidan con la búsqueda.</Text>
              </View>
            ) : (
              filteredStyles.map((st, index) => {
                const isLoaded = loadedStyle.id === st.id;
                const styleNum = String(index + 1).padStart(2, '0');
                return (
                  <TouchableOpacity
                    key={st.id}
                    activeOpacity={0.8}
                    delayPressIn={0}
                    delayPressOut={0}
                    style={[
                      styles.libCardItem,
                      isLoaded && styles.libCardItemLoaded,
                      st.isCustom && styles.libCardItemCustom,
                    ]}
                    onPress={() => {
                      selectStyle(st);
                      showAlert('SUCCESS', 'RITMO CARGADO', `Se ha seleccionado "${st.name}" (${st.defaultBpm} BPM).`);
                    }}
                  >
                    <View style={styles.libCardTopRow}>
                      <View style={styles.libCardNumBadge}>
                        <Text style={styles.libCardNumText}>#{styleNum}</Text>
                      </View>
                      <View style={styles.libCardCategoryBadge}>
                        <Text style={styles.libCardCategoryText}>{st.isCustom ? 'CUSTOM .STY' : st.category}</Text>
                      </View>
                      <Text style={styles.libCardBpmText}>{st.defaultBpm} BPM</Text>
                    </View>

                    <Text style={[styles.libCardTitle, isLoaded && styles.libCardTitleLoaded]} numberOfLines={1}>
                      {st.name}
                    </Text>

                    <View style={styles.libCardActionsRowRight}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        delayPressIn={0}
                        delayPressOut={0}
                        style={styles.libEditIconBtn}
                        onPress={() => openRenameDialog(st.id, st.name, 'STYLE')}
                      >
                        <EditIcon size={13} color="#8A9EB8" />
                      </TouchableOpacity>

                      {st.isCustom && (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          delayPressIn={0}
                          delayPressOut={0}
                          style={styles.libTrashIconBtn}
                          onPress={() => {
                            showAlert(
                              'WARNING',
                              'ELIMINAR RITMO',
                              `¿Estás seguro de eliminar el ritmo "${st.name}"?`,
                              async () => {
                                await deleteStyleFile(st.id);
                              },
                              true
                            );
                          }}
                        >
                          <TrashIcon size={13} color="#FF5252" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      )}

      {/* ================= VISTA 3: LIBRERÍA DE VOCES & SOUNDFONTS INTEGRADA ================= */}
      {currentView === 'VOICE_LIBRARY' && (
        <View style={styles.fullScreenLibraryContainer}>
          {/* Barra Superior de Control y Búsqueda */}
          <View style={styles.libNavBar}>
            <TouchableOpacity
              activeOpacity={0.7}
              delayPressIn={0}
              delayPressOut={0}
              style={styles.libBackIconBtn}
              onPress={() => setCurrentView(voiceLibraryReturnView)}
            >
              <BackArrowIcon size={16} color="#00E5FF" />
            </TouchableOpacity>

            <View style={styles.libTitleContainer}>
              <Text style={styles.libTitleMain}>LIBRERÍA DE VOCES & SOUNDFONTS</Text>
              {/* Selector de Canal Destino F1..F4 */}
              <View style={styles.libTargetFaderBar}>
                <Text style={styles.libTargetFaderLabel}>ASIGNAR A:</Text>
                {[1, 2, 3, 4].map((fId) => {
                  const isSel = targetFaderId === fId;
                  const fName = faders.find((f) => f.id === fId)?.name || `FADER ${fId}`;
                  return (
                    <TouchableOpacity
                      key={fId}
                      activeOpacity={0.7}
                      delayPressIn={0}
                      delayPressOut={0}
                      style={[styles.libTargetFaderPill, isSel && styles.libTargetFaderPillActive]}
                      onPress={() => setTargetFaderId(fId)}
                    >
                      <Text style={[styles.libTargetFaderNum, isSel && styles.libTargetFaderNumActive]}>F{fId}</Text>
                      <Text style={[styles.libTargetFaderName, isSel && styles.libTargetFaderNameActive]} numberOfLines={1}>
                        {fName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Buscador de Voces */}
            <View style={styles.libSearchBox}>
              <View style={styles.libSearchIconWrap}>
                <SearchIcon size={13} color="#7187A1" />
              </View>
              <TextInput
                style={styles.libSearchInput}
                placeholder="Buscar sonido..."
                placeholderTextColor="#5C7087"
                value={voiceSearchText}
                onChangeText={setVoiceSearchText}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {voiceSearchText.length > 0 && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  delayPressIn={0}
                  delayPressOut={0}
                  onPress={() => setVoiceSearchText('')}
                  style={styles.libSearchClearBtn}
                >
                  <CloseIcon size={10} color="#8A9EB8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Botón Importar .SF2 con Icono */}
            <TouchableOpacity
              activeOpacity={0.7}
              delayPressIn={0}
              delayPressOut={0}
              style={styles.libImportIconBtn}
              onPress={handleImportSoundFile}
            >
              <PlusIcon size={16} color="#000000" />
            </TouchableOpacity>
          </View>

          {/* Categorías de Filtro con Contadores */}
          <View style={styles.libCategoriesBar}>
            {VOICE_CATEGORIES.map((cat) => {
              const isActive = selectedVoiceCategory === cat;
              const count = getVoiceCategoryCount(cat);
              return (
                <TouchableOpacity
                  key={cat}
                  activeOpacity={0.7}
                  delayPressIn={0}
                  delayPressOut={0}
                  style={[styles.libCategoryPill, isActive && styles.libCategoryPillActive]}
                  onPress={() => setSelectedVoiceCategory(cat)}
                >
                  <Text style={[styles.libCategoryPillText, isActive && styles.libCategoryPillTextActive]}>
                    {cat}
                  </Text>
                  <View style={[styles.libCategoryCountBadge, isActive && styles.libCategoryCountBadgeActive]}>
                    <Text style={[styles.libCategoryCountText, isActive && styles.libCategoryCountTextActive]}>
                      {count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Grid de Voces Enumeradas */}
          <ScrollView style={styles.libScrollView} contentContainerStyle={styles.libGridContainer}>
            {filteredVoices.length === 0 ? (
              <View style={styles.libEmptyContainer}>
                <Text style={styles.libEmptyText}>No se encontraron sonidos que coincidan con la búsqueda.</Text>
              </View>
            ) : (
              filteredVoices.map((v, index) => {
                const isAssigned = faders.find((f) => f.id === targetFaderId)?.name === v.name;
                const voiceNum = String(index + 1).padStart(3, '0');
                return (
                  <TouchableOpacity
                    key={v.id}
                    activeOpacity={0.8}
                    delayPressIn={0}
                    delayPressOut={0}
                    style={[
                      styles.libCardItem,
                      isAssigned && styles.libCardItemLoaded,
                      v.isCustom && styles.libCardItemCustom,
                    ]}
                    onPress={() => {
                      auditionVoice(v.sf2Preset, v.sf2Path || '', 60, 100);
                      setTimeout(() => auditionStop(60), 450);
                    }}
                  >
                    <View style={styles.libCardTopRow}>
                      <View style={styles.libCardNumBadge}>
                        <Text style={styles.libCardNumText}>#{voiceNum}</Text>
                      </View>
                      <View style={styles.libCardCategoryBadge}>
                        <Text style={styles.libCardCategoryText}>{v.category}</Text>
                      </View>
                      <Text style={styles.libCardBpmText}>{v.isCustom ? '[LOCAL SF2]' : `PR #${v.sf2Preset}`}</Text>
                    </View>

                    <Text style={[styles.libCardTitle, isAssigned && styles.libCardTitleLoaded]} numberOfLines={1}>
                      {v.name}
                    </Text>

                    <View style={styles.libCardActionsRowRight}>
                      {/* Botón Asignar a Fader Destino con Icono */}
                      <TouchableOpacity
                        activeOpacity={0.7}
                        delayPressIn={0}
                        delayPressOut={0}
                        style={[styles.libAssignIconBtn, isAssigned && styles.libAssignIconBtnActive]}
                        onPress={() => {
                          const targetIdx = targetFaderId - 1;
                          setFaders((prev) =>
                            prev.map((f) => (f.id === targetFaderId ? { ...f, name: v.name } : f))
                          );
                          setLayerVoice(targetIdx, v.name, v.sf2Preset, v.sf2Path || '');
                          auditionVoice(v.sf2Preset, v.sf2Path || '', 60, 100);
                          setTimeout(() => auditionStop(60), 400);
                          showAlert('SUCCESS', 'VOZ ASIGNADA', `"${v.name}" asignado a FADER ${targetFaderId}.`);
                        }}
                      >
                        <AssignIcon size={14} color={isAssigned ? '#00E5FF' : '#8A9EB8'} />
                      </TouchableOpacity>

                      {/* Botón Editar Nombre */}
                      <TouchableOpacity
                        activeOpacity={0.7}
                        delayPressIn={0}
                        delayPressOut={0}
                        style={styles.libEditIconBtn}
                        onPress={() => openRenameDialog(v.id, v.name, 'VOICE')}
                      >
                        <EditIcon size={13} color="#8A9EB8" />
                      </TouchableOpacity>

                      {/* Botón Eliminar Sonido */}
                      <TouchableOpacity
                        activeOpacity={0.7}
                        delayPressIn={0}
                        delayPressOut={0}
                        style={styles.libTrashIconBtn}
                        onPress={() => handleDeleteVoice(v.id, v.name)}
                      >
                        <TrashIcon size={13} color="#FF5252" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      )}

      {/* MODAL DE EDICIÓN DE NOMBRE (RENOMBRAR) */}
      <Modal
        visible={renameDialog.visible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setRenameDialog({ visible: false, targetId: '', currentName: '', type: 'STYLE' })}
      >
        <View style={styles.consoleAlertOverlay}>
          <View style={styles.renameBox}>
            <View style={styles.consoleAlertHeader}>
              <Text style={styles.renameBadge}>EDITAR NOMBRE</Text>
              <Text style={styles.consoleAlertTitleText}>
                {renameDialog.type === 'STYLE' ? 'Renombrar Ritmo' : 'Renombrar Sonido'}
              </Text>
            </View>

            <TextInput
              style={styles.renameInput}
              value={renameInputText}
              onChangeText={setRenameInputText}
              autoFocus={true}
              selectTextOnFocus={true}
              placeholder="Ingresa el nuevo nombre..."
              placeholderTextColor="#5C7087"
            />

            <View style={styles.consoleAlertActionsRow}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.consoleAlertCancelBtn}
                onPress={() => setRenameDialog({ visible: false, targetId: '', currentName: '', type: 'STYLE' })}
              >
                <Text style={styles.consoleAlertCancelBtnText}>CANCELAR</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.renameSaveBtn}
                onPress={handleSaveRename}
              >
                <Text style={styles.renameSaveBtnText}>GUARDAR NOMBRE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DE ALERTA Y NOTIFICACIONES DE CONSOLA PERSONALIZADO */}
      <Modal
        visible={consoleAlert.visible}
        animationType="fade"
        transparent={true}
        onRequestClose={hideAlert}
      >
        <View style={styles.consoleAlertOverlay}>
          <View
            style={[
              styles.consoleAlertBox,
              consoleAlert.type === 'ERROR' && styles.consoleAlertBoxError,
              consoleAlert.type === 'SUCCESS' && styles.consoleAlertBoxSuccess,
            ]}
          >
            <View style={styles.consoleAlertHeader}>
              <Text
                style={[
                  styles.consoleAlertBadge,
                  consoleAlert.type === 'ERROR' && styles.consoleAlertBadgeError,
                ]}
              >
                {consoleAlert.type === 'ERROR'
                  ? 'ERROR FORMATO'
                  : consoleAlert.type === 'SUCCESS'
                  ? 'EXITO'
                  : 'INFORMACION'}
              </Text>
              <Text style={styles.consoleAlertTitleText}>{consoleAlert.title}</Text>
            </View>

            <Text style={styles.consoleAlertMessageText}>{consoleAlert.message}</Text>

            <View style={styles.consoleAlertActionsRow}>
              {consoleAlert.showCancel && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  delayPressIn={0}
                  delayPressOut={0}
                  style={styles.consoleAlertCancelBtn}
                  onPress={hideAlert}
                >
                  <Text style={styles.consoleAlertCancelBtnText}>CANCELAR</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                activeOpacity={0.7}
                delayPressIn={0}
                delayPressOut={0}
                style={[
                  styles.consoleAlertConfirmBtn,
                  consoleAlert.type === 'ERROR' && styles.consoleAlertConfirmBtnError,
                ]}
                onPress={() => {
                  const cb = consoleAlert.onConfirm;
                  hideAlert();
                  if (cb) cb();
                }}
              >
                <Text style={styles.consoleAlertConfirmBtnText}>
                  {consoleAlert.showCancel ? 'CONFIRMAR' : 'ENTENDIDO'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DE CONEXIÓN BLUETOOTH MIDI */}
      <Modal
        visible={isBleModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setIsBleModalVisible(false);
          stopBleScan();
        }}
      >
        <View style={styles.consoleAlertOverlay}>
          <View style={styles.bleModalBox}>
            {/* Header del Modal */}
            <View style={styles.bleModalHeader}>
              <View style={styles.bleModalHeaderLeft}>
                <View style={styles.bleIconCircle}>
                  <BluetoothIcon size={16} color="#00E5FF" />
                </View>
                <View>
                  <Text style={styles.bleModalTitle}>CONEXIÓN BLUETOOTH MIDI</Text>
                  <Text style={styles.bleModalSubtitle}>Soporte para M-Vave, CME, Korg, Roland BLE</Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.bleModalCloseBtn}
                onPress={() => {
                  setIsBleModalVisible(false);
                  stopBleScan();
                }}
              >
                <CloseIcon size={12} color="#8A9EB8" />
              </TouchableOpacity>
            </View>

            {/* Barra de Estado y Botón de Escaneo */}
            <View style={styles.bleStatusBarCard}>
              <View style={styles.bleStatusInfoCol}>
                <View style={styles.bleStatusRow}>
                  <View
                    style={[
                      styles.bleLedIndicator,
                      connectedBleDevice
                        ? styles.bleLedConnected
                        : isScanningBle
                        ? styles.bleLedScanning
                        : styles.bleLedIdle,
                    ]}
                  />
                  <Text style={styles.bleStatusText}>
                    {connectedBleDevice
                      ? `CONECTADO: ${connectedBleDevice.name.toUpperCase()}`
                      : isScanningBle
                      ? 'ESCANEANDO DISPOSITIVOS CERCANOS...'
                      : isBluetoothEnabled
                      ? 'BLUETOOTH ACTIVO (LISTO PARA ESCANEAR)'
                      : 'BLUETOOTH DESACTIVADO'}
                  </Text>
                </View>

                {connectedBleDevice && (
                  <Text style={styles.bleLatencyText}>Latencia estimada: Ultra-baja (~8-12ms)</Text>
                )}
              </View>

              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                {connectedBleDevice && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.bleDisconnectBtn}
                    onPress={() => {
                      disconnect();
                      showAlert('INFO', 'DESCONECTADO', 'Dispositivo MIDI desconectado.');
                    }}
                  >
                    <Text style={styles.bleDisconnectBtnText}>DESCONECTAR</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[
                    styles.bleScanToggleBtn,
                    isScanningBle && styles.bleScanToggleBtnActive,
                  ]}
                  onPress={async () => {
                    if (isScanningBle) {
                      stopBleScan();
                    } else {
                      const granted = await requestBluetoothPermissions();
                      if (granted) {
                        startBleScan();
                      }
                    }
                  }}
                >
                  <RefreshIcon size={12} color={isScanningBle ? '#FF5252' : '#000000'} />
                  <Text
                    style={[
                      styles.bleScanToggleBtnText,
                      isScanningBle && styles.bleScanToggleBtnTextActive,
                    ]}
                  >
                    {isScanningBle ? 'DETENER' : 'BUSCAR TECLADOS'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Contenedor de Lista de Dispositivos Detectados */}
            <View style={styles.bleDevicesListContainer}>
              <View style={styles.bleDevicesListHeader}>
                <Text style={styles.bleDevicesListTitle}>
                  DISPOSITIVOS DETECTADOS ({discoveredBleDevices.length})
                </Text>
                {isScanningBle && <Text style={styles.bleScanningDotPulse}>Buscando...</Text>}
              </View>

              <ScrollView
                style={styles.bleDevicesScrollView}
                contentContainerStyle={styles.bleDevicesScrollContent}
                showsVerticalScrollIndicator={true}
              >
                {discoveredBleDevices.length === 0 ? (
                  <View style={styles.bleEmptyContainer}>
                    <Text style={styles.bleEmptyTitle}>
                      {isScanningBle
                        ? 'Buscando teclados Bluetooth cercanos...'
                        : 'No se han buscado dispositivos aún'}
                    </Text>
                    <Text style={styles.bleEmptyDesc}>
                      Asegúrate de que tu teclado M-Vave esté encendido y que el botón BT esté parpadeando rápidamente en azul.
                    </Text>
                  </View>
                ) : (
                  discoveredBleDevices.map((dev) => {
                    const isCurrent = dev.isConnected;
                    const isConnecting = isConnectingAddress === dev.address;

                    return (
                      <View
                        key={dev.address}
                        style={[
                          styles.bleDeviceCard,
                          isCurrent && styles.bleDeviceCardActive,
                        ]}
                      >
                        <View style={styles.bleDeviceCardLeft}>
                          <View style={[styles.bleDeviceIconBox, isCurrent && styles.bleDeviceIconBoxActive]}>
                            <BluetoothIcon size={14} color={isCurrent ? '#00E5FF' : '#7187A1'} />
                          </View>
                          <View>
                            <Text style={[styles.bleDeviceName, isCurrent && styles.bleDeviceNameActive]}>
                              {dev.name}
                            </Text>
                            <View style={styles.bleDeviceMetaRow}>
                              <Text style={styles.bleDeviceAddress}>{dev.address}</Text>
                              <View style={styles.bleDeviceRssiBox}>
                                <SignalBarsIcon rssi={dev.rssi} size={11} />
                                <Text style={styles.bleDeviceRssiText}>{dev.rssi} dBm</Text>
                              </View>
                            </View>
                          </View>
                        </View>

                        <View style={styles.bleDeviceCardRight}>
                          {isCurrent ? (
                            <View style={styles.bleConnectedBadge}>
                              <View style={styles.bleDotGreenMini} />
                              <Text style={styles.bleConnectedBadgeText}>CONECTADO</Text>
                            </View>
                          ) : (
                            <TouchableOpacity
                              activeOpacity={0.7}
                              disabled={isConnecting}
                              style={[
                                styles.bleConnectCardBtn,
                                isConnecting && styles.bleConnectCardBtnDisabled,
                              ]}
                              onPress={() => handleConnectBleDevice(dev)}
                            >
                              <Text style={styles.bleConnectCardBtnText}>
                                {isConnecting ? 'CONECTANDO...' : 'CONECTAR'}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            </View>

            {/* Footer con Tips de Ayuda Rápida */}
            <View style={styles.bleModalFooter}>
              <Text style={styles.bleFooterTipText}>
                Tip para M-Vave (SMK-25 / SMC-PAD): Mantén presionado el botón BT durante 3 segundos hasta que la luz azul parpadee rápido para entrar en modo emparejamiento.
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ===================================================
// ESTILOS DE DISEÑO PROFESIONAL
// ===================================================
const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#090D14',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  bleModalBox: {
    width: '92%',
    maxWidth: 580,
    maxHeight: '92%',
    backgroundColor: '#090F1A',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#00E5FF44',
    padding: 12,
    shadowColor: '#00E5FF',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 20,
  },
  bleModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#162232',
    paddingBottom: 8,
    marginBottom: 8,
  },
  bleModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bleIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0C2032',
    borderWidth: 1,
    borderColor: '#00E5FF66',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bleModalTitle: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  bleModalSubtitle: {
    color: '#657E9A',
    fontSize: 7.5,
    fontWeight: '600',
    marginTop: 1,
  },
  bleModalCloseBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#121A26',
    borderWidth: 1,
    borderColor: '#223347',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bleStatusBarCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#060B12',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#152438',
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 8,
  },
  bleStatusInfoCol: {
    flex: 1,
    marginRight: 8,
  },
  bleStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bleLedIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bleLedConnected: {
    backgroundColor: '#00E676',
  },
  bleLedScanning: {
    backgroundColor: '#00E5FF',
  },
  bleLedIdle: {
    backgroundColor: '#50637A',
  },
  bleStatusText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  bleLatencyText: {
    color: '#00E676',
    fontSize: 7,
    fontWeight: '700',
    marginTop: 2,
    marginLeft: 14,
  },
  bleDisconnectBtn: {
    backgroundColor: '#2A0D12',
    borderWidth: 1,
    borderColor: '#FF5252',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  bleDisconnectBtnText: {
    color: '#FF5252',
    fontSize: 7.5,
    fontWeight: '900',
  },
  bleScanToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00E5FF',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 5,
  },
  bleScanToggleBtnActive: {
    backgroundColor: '#1E1217',
    borderWidth: 1,
    borderColor: '#FF5252',
  },
  bleScanToggleBtnText: {
    color: '#000000',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bleScanToggleBtnTextActive: {
    color: '#FF5252',
  },
  bleDevicesListContainer: {
    minHeight: 120,
    maxHeight: 165,
    backgroundColor: '#070C14',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#152233',
    padding: 6,
  },
  bleDevicesListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#121D2C',
    marginBottom: 4,
  },
  bleDevicesListTitle: {
    color: '#6F87A3',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bleScanningDotPulse: {
    color: '#00E5FF',
    fontSize: 7,
    fontWeight: '800',
  },
  bleDevicesScrollView: {
    flex: 1,
  },
  bleDevicesScrollContent: {
    gap: 4,
    paddingBottom: 4,
  },
  bleEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  bleEmptyTitle: {
    color: '#A0B2C6',
    fontSize: 8.5,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  bleEmptyDesc: {
    color: '#526982',
    fontSize: 7,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 11,
  },
  bleDeviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0C1320',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#192639',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  bleDeviceCardActive: {
    backgroundColor: '#081D2E',
    borderColor: '#00E5FF88',
  },
  bleDeviceCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  bleDeviceIconBox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#121C2B',
    borderWidth: 1,
    borderColor: '#1C2E44',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bleDeviceIconBoxActive: {
    backgroundColor: '#0C2B3F',
    borderColor: '#00E5FF',
  },
  bleDeviceName: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  bleDeviceNameActive: {
    color: '#00E5FF',
  },
  bleDeviceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  bleDeviceAddress: {
    color: '#5C7491',
    fontSize: 6.5,
    fontWeight: '700',
  },
  bleDeviceRssiBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  bleDeviceRssiText: {
    color: '#5C7491',
    fontSize: 6.5,
    fontWeight: '700',
  },
  bleDeviceCardRight: {
    marginLeft: 8,
  },
  bleConnectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#06291C',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#00E676',
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 4,
  },
  bleDotGreenMini: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#00E676',
  },
  bleConnectedBadgeText: {
    color: '#00E676',
    fontSize: 6.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bleConnectCardBtn: {
    backgroundColor: '#00E5FF',
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bleConnectCardBtnDisabled: {
    backgroundColor: '#2A3C4E',
  },
  bleConnectCardBtnText: {
    color: '#000000',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bleModalFooter: {
    marginTop: 6,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: '#121D2C',
  },
  bleFooterTipText: {
    color: '#526982',
    fontSize: 6.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  consoleAlertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 16, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  consoleAlertBox: {
    width: '85%',
    maxWidth: 380,
    backgroundColor: '#0B131E',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#00E5FF',
    padding: 16,
  },
  consoleAlertBoxError: {
    borderColor: '#FF2A4B',
  },
  consoleAlertBoxSuccess: {
    borderColor: '#00E5FF',
  },
  consoleAlertHeader: {
    marginBottom: 8,
  },
  consoleAlertBadge: {
    fontSize: 9,
    fontWeight: '900',
    color: '#00E5FF',
    letterSpacing: 1,
    marginBottom: 4,
  },
  consoleAlertBadgeError: {
    color: '#FF2A4B',
  },
  consoleAlertTitleText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  consoleAlertMessageText: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 16,
  },
  consoleAlertActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  consoleAlertCancelBtn: {
    height: 30,
    paddingHorizontal: 14,
    borderRadius: 4,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  consoleAlertCancelBtnText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  consoleAlertConfirmBtn: {
    height: 30,
    paddingHorizontal: 16,
    borderRadius: 4,
    backgroundColor: '#00E5FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  consoleAlertConfirmBtnError: {
    backgroundColor: '#FF2A4B',
  },
  consoleAlertConfirmBtnText: {
    color: '#090E17',
    fontSize: 10,
    fontWeight: '900',
  },
  fullScreenLibraryContainer: {
    flex: 1,
    backgroundColor: '#070A0F',
    paddingHorizontal: 6,
    paddingTop: 4,
    paddingBottom: 6,
  },
  libNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0D121B',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 4,
  },
  libBackIconBtn: {
    width: 28,
    height: 28,
    backgroundColor: '#162232',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#00E5FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  libTitleContainer: {
    flex: 1,
    marginHorizontal: 8,
  },
  libTitleMain: {
    color: '#E2E8F0',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  libSubtitle: {
    color: '#8A9EB8',
    fontSize: 7.5,
    marginTop: 1,
  },
  libLoadedHighlight: {
    color: '#00E5FF',
    fontWeight: '900',
  },
  libSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#080C14',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 6,
    height: 26,
    width: 170,
    marginRight: 6,
  },
  libSearchIconWrap: {
    marginRight: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  libSearchInput: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 8.5,
    paddingVertical: 0,
  },
  libSearchClearBtn: {
    padding: 2,
  },
  libImportIconBtn: {
    width: 28,
    height: 28,
    backgroundColor: '#00E5FF',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  libTargetFaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 3,
  },
  libTargetFaderLabel: {
    color: '#7187A1',
    fontSize: 7,
    fontWeight: '800',
  },
  libTargetFaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101724',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  libTargetFaderPillActive: {
    backgroundColor: '#003844',
    borderColor: '#00E5FF',
  },
  libTargetFaderNum: {
    color: '#7187A1',
    fontSize: 7.5,
    fontWeight: '900',
    marginRight: 3,
  },
  libTargetFaderNumActive: {
    color: '#00E5FF',
  },
  libTargetFaderName: {
    color: '#5C7087',
    fontSize: 7,
    fontWeight: '700',
    maxWidth: 65,
  },
  libTargetFaderNameActive: {
    color: '#FFFFFF',
  },
  libCategoriesBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 4,
  },
  libCategoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1622',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#1A2433',
  },
  libCategoryPillActive: {
    backgroundColor: '#003844',
    borderColor: '#00E5FF',
  },
  libCategoryPillText: {
    color: '#7187A1',
    fontSize: 8,
    fontWeight: '800',
  },
  libCategoryPillTextActive: {
    color: '#00E5FF',
    fontWeight: '900',
  },
  libCategoryCountBadge: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginLeft: 4,
  },
  libCategoryCountBadgeActive: {
    backgroundColor: '#00E5FF',
  },
  libCategoryCountText: {
    color: '#8A9EB8',
    fontSize: 6.5,
    fontWeight: '900',
  },
  libCategoryCountTextActive: {
    color: '#000000',
  },
  libScrollView: {
    flex: 1,
  },
  libGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 4,
    paddingBottom: 10,
  },
  libEmptyContainer: {
    width: '100%',
    paddingVertical: 20,
    alignItems: 'center',
  },
  libEmptyText: {
    color: '#5C7087',
    fontSize: 9,
    fontStyle: 'italic',
  },
  libCardItem: {
    width: '49.3%',
    backgroundColor: '#0D131D',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#1A2434',
    padding: 6,
    marginBottom: 2,
  },
  libCardItemLoaded: {
    borderColor: '#00E5FF',
    backgroundColor: '#0B1B2B',
  },
  libCardItemCustom: {
    borderColor: '#9C27B044',
  },
  libCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  libCardNumBadge: {
    backgroundColor: '#141E2C',
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 3,
  },
  libCardNumText: {
    color: '#00E5FF',
    fontSize: 7.5,
    fontWeight: '900',
  },
  libCardCategoryBadge: {
    backgroundColor: '#182436',
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 3,
  },
  libCardCategoryText: {
    color: '#8A9EB8',
    fontSize: 7,
    fontWeight: '800',
  },
  libCardBpmText: {
    color: '#FFB300',
    fontSize: 7.5,
    fontWeight: '800',
  },
  libCardTitle: {
    color: '#CBD5E1',
    fontSize: 9.5,
    fontWeight: '800',
    marginBottom: 4,
  },
  libCardTitleLoaded: {
    color: '#00E5FF',
    fontWeight: '900',
  },
  libCardActionsRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
    marginTop: 2,
  },
  libAssignIconBtn: {
    width: 26,
    height: 24,
    backgroundColor: '#182030',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#2A3B52',
    justifyContent: 'center',
    alignItems: 'center',
  },
  libAssignIconBtnActive: {
    backgroundColor: '#003844',
    borderColor: '#00E5FF',
  },
  libEditIconBtn: {
    width: 26,
    height: 24,
    backgroundColor: '#182030',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#2A3B52',
    justifyContent: 'center',
    alignItems: 'center',
  },
  libTrashIconBtn: {
    width: 26,
    height: 24,
    backgroundColor: '#2B0E14',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#FF1744',
    justifyContent: 'center',
    alignItems: 'center',
  },
  renameBox: {
    width: 320,
    backgroundColor: '#0B0F17',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00E5FF',
    padding: 12,
  },
  renameBadge: {
    color: '#00E5FF',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  renameInput: {
    backgroundColor: '#05080E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 4,
    color: '#FFFFFF',
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginVertical: 10,
  },
  renameSaveBtn: {
    backgroundColor: '#00E5FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  renameSaveBtnText: {
    color: '#000000',
    fontSize: 8.5,
    fontWeight: '900',
  },

  // =================== BARRA SUPERIOR ===================
  topBar: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#101622',
    borderRadius: 8,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#192433',
  },
  topMidiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    maxWidth: 170,
    paddingHorizontal: 8,
    backgroundColor: '#06090E',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1A2636',
  },
  topMidiBtnConnected: {
    backgroundColor: '#071824',
    borderColor: '#00E5FF66',
  },
  topMidiDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FF5252',
  },
  topMidiDotOn: {
    backgroundColor: '#00E676',
  },
  topMidiDotScanning: {
    backgroundColor: '#2979FF',
  },
  topMidiText: {
    flexShrink: 1,
    color: '#6B829D',
    fontSize: 9,
    fontWeight: '800',
  },
  topMidiTextConnected: {
    color: '#00E5FF',
  },
  topStyleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 10,
    backgroundColor: '#0A111B',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1E2E44',
  },
  topStyleLabel: {
    color: '#4C6078',
    fontSize: 8,
    fontWeight: '900',
  },
  topStyleName: {
    flex: 1,
    color: '#E6F7FF',
    fontSize: 12,
    fontWeight: '800',
  },
  topStyleChevron: {
    color: '#00E5FF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: -2,
  },
  topTempoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    backgroundColor: '#06090E',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1A2636',
  },
  topTempoBtn: {
    width: 30,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topTempoBtnText: {
    color: '#00E5FF',
    fontSize: 16,
    fontWeight: '900',
  },
  topTempoValueBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    minWidth: 58,
    justifyContent: 'center',
  },
  topTempoValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  topTempoUnit: {
    color: '#5D7290',
    fontSize: 7,
    fontWeight: '900',
  },
  topBeatRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 2,
  },
  topBeatDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#141D2A',
    borderWidth: 1,
    borderColor: '#1F2C3E',
  },
  topBeatDotOn: {
    backgroundColor: '#00E5FF',
    borderColor: '#80F2FF',
  },
  topBeatDotDownbeat: {
    backgroundColor: '#FF1744',
    borderColor: '#FF8A80',
  },
  topSustainBtn: {
    height: 30,
    paddingHorizontal: 10,
    justifyContent: 'center',
    backgroundColor: '#0A121F',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1E2E44',
  },
  topSustainBtnOn: {
    backgroundColor: '#2A2205',
    borderColor: '#FFC400',
  },
  topSustainText: {
    color: '#8A9EB8',
    fontSize: 10,
    fontWeight: '900',
  },
  topSustainTextOn: {
    color: '#FFC400',
  },
  topSysInfo: {
    alignItems: 'flex-end',
    paddingLeft: 2,
  },
  topSysText: {
    color: '#5D7290',
    fontSize: 8,
    fontWeight: '800',
  },

  // =================== EN VIVO ===================
  liveContainer: {
    flex: 1,
    paddingTop: 5,
    gap: 5,
  },
  liveWorkspace: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  arrangerZone: {
    flex: 46,
    gap: 6,
  },
  chordCard: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#060A10',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#192433',
    padding: 8,
    gap: 10,
  },
  chordMain: {
    flex: 1,
    justifyContent: 'center',
  },
  chordLabel: {
    color: '#4C6078',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  chordText: {
    color: '#00E5FF',
    fontSize: 54,
    fontWeight: '900',
    letterSpacing: -1,
  },
  chordTextIdle: {
    color: '#1E2B3D',
  },
  chordSide: {
    width: '44%',
    justifyContent: 'center',
  },
  sectionNowText: {
    color: '#8A9EB8',
    fontSize: 18,
    fontWeight: '900',
  },
  sectionNowTextPlaying: {
    color: '#FFFFFF',
  },
  sectionNextText: {
    color: '#FFD700',
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 6,
  },
  styleVolumeBox: {
    marginTop: 2,
  },
  mainSectionRow: {
    height: 54,
    flexDirection: 'row',
    gap: 6,
  },
  mainSectionBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#081720',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#123142',
  },
  mainSectionBtnVariation: {
    borderColor: '#00E5FF66',
  },
  mainSectionBtnActive: {
    backgroundColor: '#00394A',
    borderColor: '#00E5FF',
    borderWidth: 1.5,
  },
  mainSectionKind: {
    color: '#4C7A8C',
    fontSize: 8,
    fontWeight: '900',
  },
  mainSectionLetter: {
    color: '#5FA9BF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: -2,
  },
  mainSectionLetterActive: {
    color: '#00E5FF',
  },
  liveQueued: {
    borderColor: '#FFD700',
    borderWidth: 1.5,
    backgroundColor: '#2A2000',
  },
  sectionTextQueued: {
    color: '#FFD700',
  },
  specialSectionRow: {
    height: 44,
    flexDirection: 'row',
    gap: 6,
  },
  specialBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0C111A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E2A3A',
  },
  specialBtnDisabled: {
    opacity: 0.45,
  },
  specialBtnText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  liveIntroText: {
    color: '#FFB300',
  },
  liveIntroBtnActive: {
    backgroundColor: '#3A2900',
    borderColor: '#FFB300',
    borderWidth: 1.5,
  },
  fillText: {
    color: '#B388FF',
  },
  fillBtnActive: {
    backgroundColor: '#24183D',
    borderColor: '#B388FF',
    borderWidth: 1.5,
  },
  liveEndingText: {
    color: '#FF5252',
  },
  liveEndingBtnActive: {
    backgroundColor: '#3D0A12',
    borderColor: '#FF1744',
    borderWidth: 1.5,
  },
  transportRowLive: {
    height: 52,
    flexDirection: 'row',
    gap: 6,
  },
  transportBtnLive: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0C111A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E2A3A',
  },
  transportLed: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1E2B3D',
  },
  transportLedSync: {
    backgroundColor: '#00E676',
  },
  transportLedAcmp: {
    backgroundColor: '#00E5FF',
  },
  transportBtnLiveText: {
    color: '#8A9EB8',
    fontSize: 13,
    fontWeight: '900',
  },
  syncBtnOn: {
    backgroundColor: '#062A16',
    borderColor: '#00E676',
  },
  syncTextOn: {
    color: '#00E676',
  },
  acmpBtnOn: {
    backgroundColor: '#04232E',
    borderColor: '#00E5FF',
  },
  acmpTextOn: {
    color: '#00E5FF',
  },
  startBtnLive: {
    flex: 1.6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#00E5FF',
    borderRadius: 8,
  },
  startBtnLivePlaying: {
    backgroundColor: '#FF1744',
  },
  startBtnLiveText: {
    color: '#00151C',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 1,
  },
  startBtnLiveTextPlaying: {
    color: '#FFFFFF',
  },
  mixerZone: {
    flex: 54,
    gap: 6,
  },
  fadersRowLive: {
    flex: 1,
    flexDirection: 'row',
    gap: 5,
  },
  mixerBottomRow: {
    height: 40,
    flexDirection: 'row',
    gap: 6,
  },
  stepperBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0C111A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E2A3A',
    paddingHorizontal: 8,
  },
  stepperLabel: {
    flex: 1,
    color: '#6B829D',
    fontSize: 9,
    fontWeight: '900',
  },
  stepperBtn: {
    width: 34,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#152132',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#24364D',
  },
  stepperBtnText: {
    color: '#00E5FF',
    fontSize: 16,
    fontWeight: '900',
  },
  stepperValue: {
    minWidth: 34,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  stepperValueChanged: {
    color: '#FFC400',
  },
  bankBar: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0D121B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#192433',
    paddingHorizontal: 6,
  },
  bankBarLabelBox: {
    paddingRight: 4,
  },
  bankBarLabel: {
    color: '#8A9EB8',
    fontSize: 10,
    fontWeight: '900',
  },
  bankBarHint: {
    color: '#4C6078',
    fontSize: 6.5,
    fontWeight: '800',
  },
  bankBtn: {
    flex: 1,
    height: 32,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#070B12',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#172332',
  },
  bankBtnSaved: {
    borderColor: '#2E7D5B',
    backgroundColor: '#08150F',
  },
  bankBtnActive: {
    borderColor: '#00E5FF',
    backgroundColor: '#052230',
    borderWidth: 1.5,
  },
  bankBtnNum: {
    color: '#3B4D63',
    fontSize: 14,
    fontWeight: '900',
  },
  bankBtnNumSaved: {
    color: '#69F0AE',
  },
  bankBtnNumActive: {
    color: '#00E5FF',
  },
  bankBtnDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#1A2534',
  },
  bankBtnDotSaved: {
    backgroundColor: '#00E676',
  },
  bankBtnDotActive: {
    backgroundColor: '#00E5FF',
  },
  editVoiceBtn: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    marginLeft: 4,
    backgroundColor: '#FF9100',
    borderRadius: 6,
  },
  editVoiceBtnText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900',
  },

  // =================== EDITAR VOZ ===================
  editContainer: {
    flex: 1,
    paddingTop: 5,
  },
  editFaderTabs: {
    flexDirection: 'row',
    gap: 4,
  },
  editFaderTab: {
    width: 92,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: '#080C14',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  editFaderTabActive: {
    borderColor: '#FF9100',
    backgroundColor: '#1F1405',
  },
  editFaderTabId: {
    color: '#5D7290',
    fontSize: 9,
    fontWeight: '900',
  },
  editFaderTabIdActive: {
    color: '#FF9100',
  },
  editFaderTabName: {
    color: '#6B829D',
    fontSize: 8,
    fontWeight: '700',
  },
  editFaderTabNameActive: {
    color: '#FFE0B2',
  },
  editBody: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  editCard: {
    flex: 1,
    backgroundColor: '#0A0F17',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#192433',
    padding: 10,
  },
  editCardTitle: {
    color: '#6B829D',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  editCardTitleSpaced: {
    marginTop: 14,
  },
  editFaderStack: {
    gap: 10,
  },
  editVoiceNameBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#060A10',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#24364D',
    padding: 8,
  },
  editVoiceName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  editVoiceChange: {
    color: '#00E5FF',
    fontSize: 9,
    fontWeight: '900',
  },
  editGraphBox: {
    flex: 1,
    marginVertical: 8,
    backgroundColor: '#05080D',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#121C2B',
    overflow: 'hidden',
  },
  editOctaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
