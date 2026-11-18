import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { VoicePreset } from '../data/voiceLibrary';
import {
  baseName,
  copyIntoLibrary,
  displayNameFromFile,
  ensureDir,
  extensionOf,
  fileExists,
  fileSize,
  importDir,
  readIndex,
  writeIndex,
} from './importStorage';

const SOUNDFONTS_DIR = importDir('soundfonts');
const INDEX_FILE = `${SOUNDFONTS_DIR}soundfonts_index.json`;
const VALID_SOUND_EXTENSIONS = ['.sf2', '.sfz'];

export interface CustomVoicePreset extends VoicePreset {
  isCustom: true;
}

export interface SoundImportResult {
  importedVoices: CustomVoicePreset[];
  rejectedCount: number; // formato no soportado
  duplicateCount: number; // ya estaban importados
  failedCount: number; // no se pudieron copiar
}

/** Entrada del índice en disco: guarda el nombre del archivo, no la ruta */
interface StoredVoice {
  id: string;
  name: string;
  category: VoicePreset['category'];
  fileName: string;
  sf2Preset: number;
  originalName?: string;
  size?: number;
  /** Índices antiguos guardaban la ruta completa */
  sf2Path?: string;
}

const newId = () => `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

const toPreset = (v: StoredVoice): CustomVoicePreset => ({
  id: v.id,
  name: v.name,
  category: v.category,
  sf2Path: `${SOUNDFONTS_DIR}${v.fileName}`,
  sf2Preset: v.sf2Preset,
  isCustom: true,
});

export class SoundLibraryService {
  private static instance: SoundLibraryService;

  public static getInstance(): SoundLibraryService {
    if (!SoundLibraryService.instance) {
      SoundLibraryService.instance = new SoundLibraryService();
    }
    return SoundLibraryService.instance;
  }

  /**
   * Lee el índice, lo migra al formato por nombre de archivo, quita entradas cuyo archivo
   * ya no existe y recupera archivos de la carpeta que no estuvieran indexados.
   */
  private async loadIndex(): Promise<StoredVoice[]> {
    await ensureDir(SOUNDFONTS_DIR);
    const raw = await readIndex<StoredVoice>(INDEX_FILE);
    let changed = false;

    const list: StoredVoice[] = [];
    for (const entry of raw) {
      const fileName = entry.fileName || (entry.sf2Path ? baseName(entry.sf2Path) : '');
      if (!entry.fileName || entry.sf2Path) changed = true; // migración
      if (!fileName || !(await fileExists(`${SOUNDFONTS_DIR}${fileName}`))) {
        console.warn(`[SoundLibraryService] Archivo faltante, se quita del índice: ${entry.name}`);
        changed = true;
        continue;
      }
      const { sf2Path: _legacy, ...rest } = entry;
      list.push({ ...rest, fileName });
    }

    // Archivos en la carpeta que no están en el índice (p. ej. índice dañado)
    const dirFiles = await FileSystem.readDirectoryAsync(SOUNDFONTS_DIR);
    for (const fileName of dirFiles) {
      if (!VALID_SOUND_EXTENSIONS.includes(extensionOf(fileName))) continue;
      if (list.some((v) => v.fileName === fileName)) continue;
      list.push({
        id: newId(),
        name: displayNameFromFile(fileName),
        category: 'CUSTOM',
        fileName,
        sf2Preset: 0,
        size: await fileSize(`${SOUNDFONTS_DIR}${fileName}`),
      });
      changed = true;
    }

    if (changed) await writeIndex(INDEX_FILE, list);
    return list;
  }

  public async getCustomVoices(): Promise<CustomVoicePreset[]> {
    try {
      return (await this.loadIndex()).map(toPreset);
    } catch (e) {
      console.warn('[SoundLibraryService] Error leyendo voces importadas:', e);
      return [];
    }
  }

  public async pickAndImportSoundFiles(targetCategory: string): Promise<SoundImportResult> {
    const empty: SoundImportResult = { importedVoices: [], rejectedCount: 0, duplicateCount: 0, failedCount: 0 };
    const result = await DocumentPicker.getDocumentAsync({ type: ['*/*'], copyToCacheDirectory: true, multiple: true });
    if (result.canceled || !result.assets?.length) return empty;

    const list = await this.loadIndex();
    const category = (targetCategory === 'ALL' ? 'CUSTOM' : targetCategory) as VoicePreset['category'];
    const out = { ...empty, importedVoices: [] as CustomVoicePreset[] };

    for (const file of result.assets) {
      if (!VALID_SOUND_EXTENSIONS.includes(extensionOf(file.name))) {
        out.rejectedCount++;
        continue;
      }
      const size = file.size ?? (await fileSize(file.uri));
      if (list.some((v) => v.originalName === file.name && v.size === size)) {
        out.duplicateCount++;
        continue;
      }
      try {
        const fileName = await copyIntoLibrary(file.uri, file.name, SOUNDFONTS_DIR);
        const entry: StoredVoice = {
          id: newId(),
          name: file.name.replace(/\.[^/.]+$/, ''),
          category,
          fileName,
          sf2Preset: 0,
          originalName: file.name,
          size,
        };
        list.push(entry);
        out.importedVoices.push(toPreset(entry));
      } catch (e) {
        console.warn(`[SoundLibraryService] No se pudo copiar ${file.name}:`, e);
        out.failedCount++;
      }
    }

    if (out.importedVoices.length > 0) await writeIndex(INDEX_FILE, list);
    return out;
  }

  public async renameCustomVoice(voiceId: string, newName: string): Promise<boolean> {
    try {
      const list = await this.loadIndex();
      await writeIndex(
        INDEX_FILE,
        list.map((v) => (v.id === voiceId ? { ...v, name: newName.trim() } : v))
      );
      return true;
    } catch (e) {
      console.warn('[SoundLibraryService] Error al renombrar voz:', e);
      return false;
    }
  }

  public async deleteCustomVoice(voiceId: string): Promise<boolean> {
    try {
      const list = await this.loadIndex();
      const target = list.find((v) => v.id === voiceId);
      if (target) await FileSystem.deleteAsync(`${SOUNDFONTS_DIR}${target.fileName}`, { idempotent: true });
      await writeIndex(INDEX_FILE, list.filter((v) => v.id !== voiceId));
      return true;
    } catch (e) {
      console.warn('[SoundLibraryService] Error al eliminar voz:', e);
      return false;
    }
  }
}

export default SoundLibraryService.getInstance();
