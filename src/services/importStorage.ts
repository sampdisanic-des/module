import * as FileSystem from 'expo-file-system';

/**
 * Almacenamiento de archivos importados por el usuario (ritmos .STY y sonidos .SF2).
 *
 * - Los archivos se copian a la memoria privada de la app (documentDirectory/<carpeta>/).
 *   Se conservan al cerrar la app y al actualizarla; solo se borran al desinstalarla.
 * - El índice guarda el NOMBRE del archivo, no la ruta completa: si Android cambia la ruta
 *   de datos de la app (p. ej. al restaurar un respaldo), los importados siguen funcionando.
 * - El índice se escribe de forma segura (archivo temporal + reemplazo) para que un cierre
 *   a mitad de la escritura no lo corrompa.
 */

export const importDir = (folder: string) => `${FileSystem.documentDirectory}${folder}/`;

export async function ensureDir(dir: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
}

/** Nombre del archivo a partir de lo guardado (acepta rutas completas de índices antiguos) */
export const baseName = (pathOrName: string) => decodeURIComponent(pathOrName.split('/').pop() || pathOrName);

/** Extensión en minúsculas con punto (".sf2") */
export const extensionOf = (name: string) => '.' + (name.split('.').pop()?.toLowerCase() || '');

/** Nombre visible a partir del nombre de archivo ("1700000_Mi_Ritmo.sty" -> "Mi Ritmo") */
export const displayNameFromFile = (fileName: string) =>
  fileName.replace(/^[0-9]+(_[0-9]+)?_/, '').replace(/\.[^/.]+$/, '').replace(/_/g, ' ');

export async function fileExists(path: string): Promise<boolean> {
  try {
    return (await FileSystem.getInfoAsync(path)).exists;
  } catch {
    return false;
  }
}

export async function fileSize(path: string): Promise<number | undefined> {
  try {
    const info = await FileSystem.getInfoAsync(path);
    return info.exists && !info.isDirectory ? info.size : undefined;
  } catch {
    return undefined;
  }
}

/** Lee un índice JSON; si el principal falta o está dañado, usa el temporal de la última escritura */
export async function readIndex<T>(indexFile: string): Promise<T[]> {
  for (const path of [indexFile, `${indexFile}.tmp`]) {
    try {
      if (!(await fileExists(path))) continue;
      const parsed = JSON.parse(await FileSystem.readAsStringAsync(path));
      if (Array.isArray(parsed)) return parsed as T[];
    } catch (e) {
      console.warn(`[importStorage] Índice ilegible (${path}):`, e);
    }
  }
  return [];
}

/** Escribe el índice primero en un temporal y luego reemplaza el principal */
export async function writeIndex<T>(indexFile: string, items: T[]): Promise<void> {
  const tmp = `${indexFile}.tmp`;
  await FileSystem.writeAsStringAsync(tmp, JSON.stringify(items, null, 2));
  await FileSystem.deleteAsync(indexFile, { idempotent: true });
  await FileSystem.moveAsync({ from: tmp, to: indexFile });
}

let importCounter = 0;

/**
 * Copia un archivo elegido con el selector a la carpeta de importados con un nombre único,
 * y borra la copia temporal que deja el selector en la caché.
 * Devuelve el nombre del archivo guardado.
 */
export async function copyIntoLibrary(sourceUri: string, originalName: string, dir: string): Promise<string> {
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileName = `${Date.now()}_${importCounter++}_${safeName}`;
  await FileSystem.copyAsync({ from: sourceUri, to: `${dir}${fileName}` });
  if (sourceUri.startsWith(FileSystem.cacheDirectory ?? '\0')) {
    await FileSystem.deleteAsync(sourceUri, { idempotent: true });
  }
  return fileName;
}
