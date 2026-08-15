import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';

const STYLES_DIR = `${FileSystem.documentDirectory}styles/`;
const INDEX_FILE = `${STYLES_DIR}styles_index.json`;

export interface StylePreset {
  id: string;
  name: string;
  category: string;
  filePath?: string; // Ruta local del archivo .sty importado
  isCustom?: boolean;
  defaultBpm: number;
}

export interface StyleImportResult {
  importedStyles: StylePreset[];
  rejectedCount: number;
  message?: string;
}

const VALID_STYLE_EXTENSIONS = ['.sty', '.prs', '.pcs', '.sst', '.mid', '.midi'];

export const BUILTIN_STYLES: StylePreset[] = [
  { id: 'st_1', name: 'Cumbia Professional', category: 'LATIN', defaultBpm: 105 },
  { id: 'st_2', name: 'Pop Rock Ballad', category: 'POP', defaultBpm: 68 },
  { id: 'st_3', name: '8-Beat Piano Groove', category: 'POP', defaultBpm: 110 },
  { id: 'st_4', name: 'Salsa Classic', category: 'LATIN', defaultBpm: 180 },
  { id: 'st_5', name: 'Bachata Groove', category: 'LATIN', defaultBpm: 128 },
];

export class StyleLibraryService {
  private static instance: StyleLibraryService;

  public static getInstance(): StyleLibraryService {
    if (!StyleLibraryService.instance) {
      StyleLibraryService.instance = new StyleLibraryService();
    }
    return StyleLibraryService.instance;
  }

  private async ensureDirectoryExists(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(STYLES_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(STYLES_DIR, { intermediates: true });
      }
    } catch (e) {
      console.warn('[StyleLibraryService] Error asegurando directorio de ritmos:', e);
    }
  }

  public async getCustomStyles(): Promise<StylePreset[]> {
    await this.ensureDirectoryExists();
    try {
      let indexList: StylePreset[] = [];
      const fileInfo = await FileSystem.getInfoAsync(INDEX_FILE);
      if (fileInfo.exists) {
        const jsonContent = await FileSystem.readAsStringAsync(INDEX_FILE);
        const parsed = JSON.parse(jsonContent);
        if (Array.isArray(parsed)) {
          indexList = parsed;
        }
      }

      // Escaneo automático de seguridad del directorio físico para recuperar cualquier archivo no indexado
      const dirFiles = await FileSystem.readDirectoryAsync(STYLES_DIR);
      let needsSave = false;

      for (const fileName of dirFiles) {
        if (fileName === 'styles_index.json') continue;
        const fileExt = '.' + (fileName.split('.').pop()?.toLowerCase() || '');
        if (!VALID_STYLE_EXTENSIONS.includes(fileExt)) continue;

        const filePath = `${STYLES_DIR}${fileName}`;
        const alreadyIndexed = indexList.some((s) => s.filePath && (s.filePath.endsWith(fileName) || s.filePath === filePath));

        if (!alreadyIndexed) {
          const cleanName = fileName.replace(/^[0-9]+_/, '').replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
          const recoveredStyle: StylePreset = {
            id: `custom_sty_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: cleanName,
            category: 'CUSTOM',
            filePath: filePath,
            isCustom: true,
            defaultBpm: 120,
          };
          indexList.push(recoveredStyle);
          needsSave = true;
        }
      }

      if (needsSave || !fileInfo.exists) {
        await this.saveIndex(indexList);
      }

      return indexList;
    } catch (e) {
      console.warn('[StyleLibraryService] Error leyendo índice de ritmos:', e);
      return [];
    }
  }

  private async saveIndex(styles: StylePreset[]): Promise<void> {
    await this.ensureDirectoryExists();
    try {
      await FileSystem.writeAsStringAsync(INDEX_FILE, JSON.stringify(styles, null, 2));
    } catch (e) {
      console.warn('[StyleLibraryService] Error guardando índice de ritmos:', e);
    }
  }

  public async pickAndImportStyleFiles(targetCategory: string = 'LATIN'): Promise<StyleImportResult> {
    await this.ensureDirectoryExists();
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['*/*'],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return { importedStyles: [], rejectedCount: 0 };
      }

      const currentCustomStyles = await this.getCustomStyles();
      const newlyImportedStyles: StylePreset[] = [];
      let rejectedCount = 0;

      const assignedCategory = targetCategory === 'ALL' ? 'LATIN' : targetCategory;

      for (const file of result.assets) {
        const fileExt = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
        if (!VALID_STYLE_EXTENSIONS.includes(fileExt)) {
          rejectedCount++;
          continue;
        }

        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        const targetFilename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const destinationPath = `${STYLES_DIR}${targetFilename}`;

        // Copiar archivo al almacenamiento local persistente permanente
        await FileSystem.copyAsync({
          from: file.uri,
          to: destinationPath,
        });

        const newStyle: StylePreset = {
          id: `custom_sty_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: cleanName,
          category: assignedCategory,
          filePath: destinationPath,
          isCustom: true,
          defaultBpm: 120,
        };

        newlyImportedStyles.push(newStyle);
      }

      if (newlyImportedStyles.length > 0) {
        const updatedList = [...currentCustomStyles, ...newlyImportedStyles];
        await this.saveIndex(updatedList);
      }

      return {
        importedStyles: newlyImportedStyles,
        rejectedCount,
      };
    } catch (e) {
      console.warn('[StyleLibraryService] Error al importar archivos .STY:', e);
      return { importedStyles: [], rejectedCount: 0, message: 'Error de lectura de archivo' };
    }
  }

  public async renameCustomStyle(styleId: string, newName: string): Promise<boolean> {
    try {
      const current = await this.getCustomStyles();
      const updatedList = current.map((s) => (s.id === styleId ? { ...s, name: newName.trim() } : s));
      await this.saveIndex(updatedList);
      return true;
    } catch (e) {
      console.warn('[StyleLibraryService] Error al renombrar ritmo:', e);
      return false;
    }
  }

  public async deleteCustomStyle(styleId: string): Promise<boolean> {
    try {
      const current = await this.getCustomStyles();
      const target = current.find((s) => s.id === styleId);
      if (target && target.filePath) {
        const fileInfo = await FileSystem.getInfoAsync(target.filePath);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(target.filePath, { idempotent: true });
        }
      }

      const updatedList = current.filter((s) => s.id !== styleId);
      await this.saveIndex(updatedList);
      return true;
    } catch (e) {
      console.warn('[StyleLibraryService] Error al eliminar ritmo:', e);
      return false;
    }
  }
}

export default StyleLibraryService.getInstance();
