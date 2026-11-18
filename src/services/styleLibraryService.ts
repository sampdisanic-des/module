import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { getStyleData } from './styParser';
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

const STYLES_DIR = importDir('styles');
const INDEX_FILE = `${STYLES_DIR}styles_index.json`;
const VALID_STYLE_EXTENSIONS = ['.sty', '.prs', '.pcs', '.sst', '.mid', '.midi'];
const FALLBACK_BPM = 120;

export interface StylePreset {
  id: string;
  name: string;
  category: string;
  filePath?: string; // Ruta local del archivo importado
  isCustom?: boolean;
  defaultBpm: number;
}

export interface StyleImportResult {
  importedStyles: StylePreset[];
  rejectedCount: number; // formato no soportado
  duplicateCount: number; // ya estaban importados
  failedCount: number; // no se pudieron copiar
}

/** Entrada del índice en disco: guarda el nombre del archivo, no la ruta */
interface StoredStyle {
  id: string;
  name: string;
  category: string;
  fileName: string;
  defaultBpm: number;
  originalName?: string;
  size?: number;
  /** Índices antiguos guardaban la ruta completa */
  filePath?: string;
}

export const BUILTIN_STYLES: StylePreset[] = [
  { id: 'st_1', name: 'Cumbia Professional', category: 'LATIN', defaultBpm: 105 },
  { id: 'st_2', name: 'Pop Rock Ballad', category: 'POP', defaultBpm: 68 },
  { id: 'st_3', name: '8-Beat Piano Groove', category: 'POP', defaultBpm: 110 },
  { id: 'st_4', name: 'Salsa Classic', category: 'LATIN', defaultBpm: 180 },
  { id: 'st_5', name: 'Bachata Groove', category: 'LATIN', defaultBpm: 128 },
];

const newId = () => `custom_sty_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

const toPreset = (s: StoredStyle): StylePreset => ({
  id: s.id,
  name: s.name,
  category: s.category,
  filePath: `${STYLES_DIR}${s.fileName}`,
  isCustom: true,
  defaultBpm: s.defaultBpm,
});

/** Tempo real del archivo (el que trae el .STY), o 120 si no se puede leer */
async function readStyleBpm(path: string): Promise<number> {
  try {
    const data = await getStyleData('import', path);
    return data.defaultBpm || FALLBACK_BPM;
  } catch {
    return FALLBACK_BPM;
  }
}

export class StyleLibraryService {
  private static instance: StyleLibraryService;

  public static getInstance(): StyleLibraryService {
    if (!StyleLibraryService.instance) {
      StyleLibraryService.instance = new StyleLibraryService();
    }
    return StyleLibraryService.instance;
  }

  /**
   * Lee el índice, lo migra al formato por nombre de archivo, quita entradas cuyo archivo
   * ya no existe y recupera archivos de la carpeta que no estuvieran indexados.
   */
  private async loadIndex(): Promise<StoredStyle[]> {
    await ensureDir(STYLES_DIR);
    const raw = await readIndex<StoredStyle>(INDEX_FILE);
    let changed = false;

    const list: StoredStyle[] = [];
    for (const entry of raw) {
      const fileName = entry.fileName || (entry.filePath ? baseName(entry.filePath) : '');
      if (!entry.fileName || entry.filePath) changed = true; // migración
      if (!fileName || !(await fileExists(`${STYLES_DIR}${fileName}`))) {
        console.warn(`[StyleLibraryService] Archivo faltante, se quita del índice: ${entry.name}`);
        changed = true;
        continue;
      }
      const { filePath: _legacy, ...rest } = entry;
      list.push({ ...rest, fileName });
    }

    // Archivos en la carpeta que no están en el índice (p. ej. índice dañado)
    const dirFiles = await FileSystem.readDirectoryAsync(STYLES_DIR);
    for (const fileName of dirFiles) {
      if (!VALID_STYLE_EXTENSIONS.includes(extensionOf(fileName))) continue;
      if (list.some((s) => s.fileName === fileName)) continue;
      const path = `${STYLES_DIR}${fileName}`;
      list.push({
        id: newId(),
        name: displayNameFromFile(fileName),
        category: 'CUSTOM',
        fileName,
        defaultBpm: await readStyleBpm(path),
        size: await fileSize(path),
      });
      changed = true;
    }

    if (changed) await writeIndex(INDEX_FILE, list);
    return list;
  }

  public async getCustomStyles(): Promise<StylePreset[]> {
    try {
      return (await this.loadIndex()).map(toPreset);
    } catch (e) {
      console.warn('[StyleLibraryService] Error leyendo ritmos importados:', e);
      return [];
    }
  }

  public async pickAndImportStyleFiles(targetCategory: string = 'CUSTOM'): Promise<StyleImportResult> {
    const empty: StyleImportResult = { importedStyles: [], rejectedCount: 0, duplicateCount: 0, failedCount: 0 };
    const result = await DocumentPicker.getDocumentAsync({ type: ['*/*'], copyToCacheDirectory: true, multiple: true });
    if (result.canceled || !result.assets?.length) return empty;

    const list = await this.loadIndex();
    const category = targetCategory === 'ALL' ? 'CUSTOM' : targetCategory;
    const out = { ...empty, importedStyles: [] as StylePreset[] };

    for (const file of result.assets) {
      if (!VALID_STYLE_EXTENSIONS.includes(extensionOf(file.name))) {
        out.rejectedCount++;
        continue;
      }
      const size = file.size ?? (await fileSize(file.uri));
      if (list.some((s) => s.originalName === file.name && s.size === size)) {
        out.duplicateCount++;
        continue;
      }
      try {
        const fileName = await copyIntoLibrary(file.uri, file.name, STYLES_DIR);
        const entry: StoredStyle = {
          id: newId(),
          name: file.name.replace(/\.[^/.]+$/, ''),
          category,
          fileName,
          defaultBpm: await readStyleBpm(`${STYLES_DIR}${fileName}`),
          originalName: file.name,
          size,
        };
        list.push(entry);
        out.importedStyles.push(toPreset(entry));
      } catch (e) {
        console.warn(`[StyleLibraryService] No se pudo copiar ${file.name}:`, e);
        out.failedCount++;
      }
    }

    if (out.importedStyles.length > 0) await writeIndex(INDEX_FILE, list);
    return out;
  }

  public async renameCustomStyle(styleId: string, newName: string): Promise<boolean> {
    try {
      const list = await this.loadIndex();
      await writeIndex(
        INDEX_FILE,
        list.map((s) => (s.id === styleId ? { ...s, name: newName.trim() } : s))
      );
      return true;
    } catch (e) {
      console.warn('[StyleLibraryService] Error al renombrar ritmo:', e);
      return false;
    }
  }

  public async deleteCustomStyle(styleId: string): Promise<boolean> {
    try {
      const list = await this.loadIndex();
      const target = list.find((s) => s.id === styleId);
      if (target) await FileSystem.deleteAsync(`${STYLES_DIR}${target.fileName}`, { idempotent: true });
      await writeIndex(INDEX_FILE, list.filter((s) => s.id !== styleId));
      return true;
    } catch (e) {
      console.warn('[StyleLibraryService] Error al eliminar ritmo:', e);
      return false;
    }
  }
}

export default StyleLibraryService.getInstance();
