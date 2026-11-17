import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { VoicePreset } from '../data/voiceLibrary';

const SOUNDFONTS_DIR = `${FileSystem.documentDirectory}soundfonts/`;
const INDEX_FILE = `${SOUNDFONTS_DIR}soundfonts_index.json`;

export interface CustomVoicePreset extends VoicePreset {
  isCustom: true;
}

export interface SoundImportResult {
  importedVoices: CustomVoicePreset[];
  rejectedCount: number;
  message?: string;
}

const VALID_SOUND_EXTENSIONS = ['.sf2', '.sfz'];

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
      let indexList: CustomVoicePreset[] = [];
      const fileInfo = await FileSystem.getInfoAsync(INDEX_FILE);
      if (fileInfo.exists) {
        const jsonContent = await FileSystem.readAsStringAsync(INDEX_FILE);
        const parsed = JSON.parse(jsonContent);
        if (Array.isArray(parsed)) {
          indexList = parsed;
        }
      }

      // Escaneo automático de seguridad del directorio físico para recuperar cualquier archivo no indexado
      const dirFiles = await FileSystem.readDirectoryAsync(SOUNDFONTS_DIR);
      let needsSave = false;

      for (const fileName of dirFiles) {
        if (fileName === 'soundfonts_index.json') continue;
        const fileExt = '.' + (fileName.split('.').pop()?.toLowerCase() || '');
        if (!VALID_SOUND_EXTENSIONS.includes(fileExt)) continue;

        const filePath = `${SOUNDFONTS_DIR}${fileName}`;
        const alreadyIndexed = indexList.some((v) => v.sf2Path.endsWith(fileName) || v.sf2Path === filePath);

        if (!alreadyIndexed) {
          const cleanName = fileName.replace(/^[0-9]+_/, '').replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
          const recoveredVoice: CustomVoicePreset = {
            id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: cleanName,
            category: 'CUSTOM' as any,
            sf2Path: filePath,
            sf2Preset: 0,
            isCustom: true,
          };
          indexList.push(recoveredVoice);
          needsSave = true;
        }
      }

      if (needsSave || !fileInfo.exists) {
        await this.saveIndex(indexList);
      }

      return indexList;
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

  public async pickAndImportSoundFiles(targetCategory: string): Promise<SoundImportResult> {
    await this.ensureDirectoryExists();
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['*/*'],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return { importedVoices: [], rejectedCount: 0 };
      }

      const currentCustomVoices = await this.getCustomVoices();
      const newlyImportedVoices: CustomVoicePreset[] = [];
      let rejectedCount = 0;

      const assignedCategory = targetCategory === 'ALL' ? 'PIANO' : targetCategory;

      for (const file of result.assets) {
        const fileExt = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
        if (!VALID_SOUND_EXTENSIONS.includes(fileExt)) {
          rejectedCount++;
          continue;
        }

        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        const targetFilename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const destinationPath = `${SOUNDFONTS_DIR}${targetFilename}`;

        // Copiar archivo al almacenamiento local persistente permanente
        await FileSystem.copyAsync({
          from: file.uri,
          to: destinationPath,
        });

        const newVoice: CustomVoicePreset = {
          id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: cleanName,
          category: assignedCategory as any,
          sf2Path: destinationPath,
          sf2Preset: 0,
          isCustom: true,
        };

        newlyImportedVoices.push(newVoice);
      }

      if (newlyImportedVoices.length > 0) {
        const updatedList = [...currentCustomVoices, ...newlyImportedVoices];
        await this.saveIndex(updatedList);
      }

      return {
        importedVoices: newlyImportedVoices,
        rejectedCount,
      };
    } catch (e) {
      console.warn('[SoundLibraryService] Error al importar archivos de sonido:', e);
      return { importedVoices: [], rejectedCount: 0, message: 'Error de lectura de archivo' };
    }
  }

  public async renameCustomVoice(voiceId: string, newName: string): Promise<boolean> {
    try {
      const current = await this.getCustomVoices();
      const updatedList = current.map((v) => (v.id === voiceId ? { ...v, name: newName.trim() } : v));
      await this.saveIndex(updatedList);
      return true;
    } catch (e) {
      console.warn('[SoundLibraryService] Error al renombrar voz:', e);
      return false;
    }
  }

  public async deleteCustomVoice(voiceId: string): Promise<boolean> {
    try {
      const current = await this.getCustomVoices();
      const target = current.find((v) => v.id === voiceId);
      if (target) {
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
}

export default SoundLibraryService.getInstance();
