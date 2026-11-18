import { useEffect, useMemo, useState } from 'react';
import SoundLibraryService, { CustomVoicePreset } from '../services/soundLibraryService';
import { VOICE_LIBRARY } from '../data/voiceLibrary';
import { ShowAlert } from './useConsoleAlert';
import { reportImport } from '../utils/importReport';

/** Librería de voces: integradas + SF2 importados por el usuario */
export const useVoiceLibrary = (showAlert: ShowAlert) => {
  const [customVoices, setCustomVoices] = useState<CustomVoicePreset[]>([]);

  useEffect(() => {
    SoundLibraryService.getCustomVoices().then(setCustomVoices);
  }, []);

  const fullVoiceLibrary = useMemo(() => [...VOICE_LIBRARY, ...customVoices], [customVoices]);

  const importVoices = async (targetCat: string) => {
    const res = await SoundLibraryService.pickAndImportSoundFiles(targetCat);
    const imported = res.importedVoices.length;
    if (imported > 0) setCustomVoices((prev) => [...prev, ...res.importedVoices]);
    reportImport(showAlert, {
      kind: 'sonido(s)',
      formats: '.SF2 / .SFZ',
      imported,
      category: res.importedVoices[0]?.category ?? targetCat,
      rejected: res.rejectedCount,
      duplicates: res.duplicateCount,
      failed: res.failedCount,
    });
  };

  const deleteVoice = (voiceId: string, voiceName: string) => {
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

  const renameVoice = async (voiceId: string, newName: string) => {
    await SoundLibraryService.renameCustomVoice(voiceId, newName);
    setCustomVoices(await SoundLibraryService.getCustomVoices());
  };

  return { fullVoiceLibrary, importVoices, deleteVoice, renameVoice };
};

export type VoiceLibraryApi = ReturnType<typeof useVoiceLibrary>;
