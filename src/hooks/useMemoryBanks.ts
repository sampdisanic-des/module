import { useEffect, useRef, useState } from 'react';
import BankMemoryService, {
  MemoryBankPreset,
  MemoryBanksCatalog,
  VoiceChannelState,
} from '../services/bankMemoryService';
import { DEFAULT_FADERS, FaderState, formatSigned } from '../types/fader';
import { UseArrangerReturn } from './useArranger';
import { FadersApi } from './useFaders';
import { ShowAlert } from './useConsoleAlert';

const SAVE_HOLD_MS = 1000; // mantener 1 s: guardar
const CLEAR_HOLD_MS = 3000; // mantener 3 s: borrar

type ChannelKey = 'f1' | 'f2' | 'f3' | 'f4';
const channelKey = (id: number) => `f${id}` as ChannelKey;

type ArrangerApi = Pick<
  UseArrangerReturn,
  'loadedStyle' | 'styleVolume' | 'bpm' | 'availableStyles' | 'setStyleVolume' | 'setBpm' | 'selectStyle'
>;

const faderToChannel = (f: FaderState): VoiceChannelState => ({
  voiceId: f.name,
  volume: f.value,
  mute: f.mute,
  solo: f.solo,
  octave: f.octave,
  cutoff: f.cutoff,
  resonance: f.resonance,
  attack: f.attack,
  delay: f.delay,
  sustain: f.sustain,
  release: f.release,
});

/** Reconstruye un fader desde un banco; los bancos antiguos guardaban la envolvente global */
const channelToFader = (preset: MemoryBankPreset, def: FaderState): FaderState => {
  const ch = preset[channelKey(def.id)];
  return {
    id: def.id,
    name: ch.voiceId,
    value: ch.volume,
    mute: ch.mute,
    solo: ch.solo,
    octave: ch.octave ?? (def.id === 1 ? preset.octave : undefined) ?? 0,
    cutoff: ch.cutoff ?? preset.cutoff ?? def.cutoff,
    resonance: ch.resonance ?? preset.resonance ?? def.resonance,
    attack: ch.attack ?? preset.attack ?? def.attack,
    delay: ch.delay ?? preset.delay ?? def.delay,
    sustain: ch.sustain ?? preset.sustain ?? def.sustain,
    release: ch.release ?? preset.release ?? def.release,
  };
};

/**
 * 8 bancos de memoria. Toque: cargar. Mantener 1 s: guardar. Mantener 3 s: borrar.
 */
export const useMemoryBanks = (mixer: FadersApi, arranger: ArrangerApi, showAlert: ShowAlert) => {
  const [catalog, setCatalog] = useState<MemoryBanksCatalog>({});
  const [activeBank, setActiveBank] = useState<number>(0); // 0 = ninguno

  const pressTimer = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const pressStart = useRef<Record<number, number>>({});
  const didClear = useRef<Record<number, boolean>>({});

  useEffect(() => {
    BankMemoryService.getAllBanks().then(setCatalog);
  }, []);

  const clearBank = async (bankNum: number) => {
    try {
      await BankMemoryService.clearBank(bankNum);
      setCatalog((prev) => {
        const next = { ...prev };
        delete next[bankNum];
        return next;
      });
      setActiveBank((prev) => (prev === bankNum ? 0 : prev));
      showAlert('INFO', `BANCO ${bankNum} LIMPIADO`, `Se ha borrado la configuración del BANCO ${bankNum}. Ahora está vacío.`);
    } catch (e) {
      console.warn('Error al limpiar banco de memoria:', e);
    }
  };

  const saveBank = async (bankNum: number) => {
    const { faders, transpose, modulation } = mixer;
    const { loadedStyle, styleVolume, bpm } = arranger;
    const f1 = faders[0];

    const newPreset = await BankMemoryService.saveBank(bankNum, {
      f1: faderToChannel(faders[0]),
      f2: faderToChannel(faders[1]),
      f3: faderToChannel(faders[2]),
      f4: faderToChannel(faders[3]),
      // Campos globales heredados (los bancos antiguos los usan como respaldo)
      octave: f1.octave,
      attack: f1.attack,
      delay: f1.delay,
      sustain: f1.sustain,
      release: f1.release,
      cutoff: f1.cutoff,
      resonance: f1.resonance,
      transpose,
      modulation,
      styleId: loadedStyle.id,
      styleName: loadedStyle.name,
      styleCategory: loadedStyle.category,
      styleVolume,
      bpm,
    });

    setCatalog((prev) => ({ ...prev, [bankNum]: newPreset }));
    setActiveBank(bankNum);

    const voices = faders.map((f) => `- F${f.id}: ${f.name} (OCT ${formatSigned(f.octave)})`).join('\n');
    showAlert(
      'SUCCESS',
      `GUARDADO EN BANCO ${bankNum}`,
      `Se ha guardado la combinación actual en el BANCO ${bankNum}:\n${voices}\n- Ritmo: ${loadedStyle.name}\n- Transposición: ${formatSigned(transpose)}`
    );
  };

  const loadBank = (bankNum: number) => {
    const preset = catalog[bankNum];
    if (!preset) {
      showAlert(
        'INFO',
        `BANCO ${bankNum} VACÍO`,
        `El BANCO ${bankNum} no tiene ningún preset guardado todavía.\n\nMantén presionado el botón ${bankNum} durante 1 segundo para guardar tu configuración actual.`
      );
      return;
    }

    mixer.setFaders(DEFAULT_FADERS.map((def) => channelToFader(preset, def)));
    mixer.setTranspose(preset.transpose);
    mixer.setModulation(preset.modulation);

    arranger.setStyleVolume(preset.styleVolume);
    arranger.setBpm(preset.bpm);
    const matchStyle = arranger.availableStyles.find((s) => s.id === preset.styleId || s.name === preset.styleName);
    if (matchStyle) arranger.selectStyle(matchStyle, preset.bpm);

    setActiveBank(bankNum);
  };

  const handlePressIn = (bankNum: number) => {
    pressStart.current[bankNum] = Date.now();
    didClear.current[bankNum] = false;
    pressTimer.current[bankNum] = setTimeout(() => {
      didClear.current[bankNum] = true;
      clearBank(bankNum);
    }, CLEAR_HOLD_MS);
  };

  const handlePressOut = (bankNum: number) => {
    clearTimeout(pressTimer.current[bankNum]);
    if (didClear.current[bankNum]) return;
    const held = Date.now() - (pressStart.current[bankNum] || 0);
    if (held >= SAVE_HOLD_MS) saveBank(bankNum);
    else loadBank(bankNum);
  };

  /** Mantener los bancos al renombrar una voz importada */
  const renameVoice = async (oldName: string, newName: string) => {
    setCatalog(await BankMemoryService.renameVoiceReferences(oldName, newName));
  };

  return { catalog, activeBank, handlePressIn, handlePressOut, renameVoice };
};

export type MemoryBanksApi = ReturnType<typeof useMemoryBanks>;
