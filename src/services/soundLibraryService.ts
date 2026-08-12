import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { VoicePreset } from '../../App';

const SOUNDFONTS_DIR = `${FileSystem.documentDirectory}soundfonts/`;
const INDEX_FILE = `${SOUNDFONTS_DIR}soundfonts_index.json`;

export interface CustomVoicePreset extends VoicePreset {
  isCustom: true;
}

export class SoundLibraryService {
  private static instance: SoundLibraryService;

  public static getInstance(): SoundLibraryService {
    if (!SoundLibraryService.instance) {
      SoundLibraryService.instance = new SoundLibraryService();
    }
    return SoundLibraryService.instance;
  }

  private async ensureDirectoryExists(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(SOUNDFONTS_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(SOUNDFONTS_DIR, { intermediates: true });
      }
    } catch (e) {
      console.warn('[SoundLibraryService] Error asegurando directorio soundfonts:', e);
    }
  }

  public async getCustomVoices(): Promise<CustomVoicePreset[]> {
    await this.ensureDirectoryExists();
    try {
      const fileInfo = await FileSystem.getInfoAsync(INDEX_FILE);
      if (!fileInfo.exists) {
        return [];
      }
      const jsonContent = await FileSystem.readAsStringAsync(INDEX_FILE);
      const parsed = JSON.parse(jsonContent);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('[SoundLibraryService] Error leyendo índice de voces:', e);
      return [];
    }
  }

  private async saveIndex(voices: CustomVoicePreset[]): Promise<void> {
    await this.ensureDirectoryExists();
    try {
      await FileSystem.writeAsStringAsync(INDEX_FILE, JSON.stringify(voices, null, 2));
    } catch (e) {
      console.warn('[SoundLibraryService] Error guardando índice de voces:', e);
    }
  }

  public async pickAndImportSoundFiles(targetCategory: string): Promise<CustomVoicePreset[]> {
    await this.ensureDirectoryExists();
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['*/*'], // Permite seleccionar archivos .sf2 / .sfz
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return [];
      }

      const currentCustomVoices = await this.getCustomVoices();
      const newlyImportedVoices: CustomVoicePreset[] = [];

      for (const file of result.assets) {
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        // Filtrar o permitir archivos .sf2 / .sfz
        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        const targetFilename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const destinationPath = `${SOUNDFONTS_DIR}${targetFilename}`;

        // Copiar archivo al almacenamiento local persistente de la app
        await FileSystem.copyAsync({
          from: file.uri,
          to: destinationPath,
        });

        const newVoice: CustomVoicePreset = {
          id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: cleanName,
          category: (targetCategory === 'ALL' ? 'PIANO' : targetCategory) as any,
          sf2Path: destinationPath,
          sf2Preset: 0,
          isCustom: true,
        };

        newlyImportedVoices.push(newVoice);
      }

      const updatedList = [...currentCustomVoices, ...newlyImportedVoices];
      await this.saveIndex(updatedList);
      return newlyImportedVoices;
    } catch (e) {
      console.warn('[SoundLibraryService] Error al importar archivos de sonido:', e);
      return [];
    }
  }

  public async deleteCustomVoice(voiceId: string): Promise<boolean> {
    try {
      const current = await this.getCustomVoices();
      const target = current.find((v) => v.id === voiceId);
      if (target) {
        // Eliminar archivo físico si existe
        const fileInfo = await FileSystem.getInfoAsync(target.sf2Path);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(target.sf2Path, { idempotent: true });
        }
      }

      const updatedList = current.filter((v) => v.id !== voiceId);
      await this.saveIndex(updatedList);
      return true;
    } catch (e) {
      console.warn('[SoundLibraryService] Error al eliminar voz:', e);
      return false;
    }
  }

  public async updateCustomVoice(voiceId: string, newName: string, newCategory: string): Promise<boolean> {
    try {
      const current = await this.getCustomVoices();
      const updatedList = current.map((v) =>
        v.id === voiceId ? { ...v, name: newName, category: newCategory as any } : v
      );
      await this.saveIndex(updatedList);
      return true;
    } catch (e) {
      console.warn('[SoundLibraryService] Error al actualizar voz:', e);
      return false;
    }
  }
}

export default SoundLibraryService.getInstance();
