import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ImageStyle, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { mapStyleColors, toLightColor } from './colorTransform';

export type ThemeMode = 'dark' | 'light';

const SETTINGS_FILE = `${FileSystem.documentDirectory}ui_settings.json`;

interface ThemeContextValue {
  mode: ThemeMode;
  toggleTheme: () => void;
  /** Convierte un color escrito para el tema oscuro al tema activo (para colores en JSX: iconos, SVG, LEDs) */
  c: (darkColor: string) => string;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  toggleTheme: () => {},
  c: (x) => x,
});

async function readSavedMode(): Promise<ThemeMode | null> {
  try {
    const info = await FileSystem.getInfoAsync(SETTINGS_FILE);
    if (!info.exists) return null;
    const data = JSON.parse(await FileSystem.readAsStringAsync(SETTINGS_FILE));
    return data.themeMode === 'light' || data.themeMode === 'dark' ? data.themeMode : null;
  } catch {
    return null;
  }
}

async function saveMode(mode: ThemeMode) {
  try {
    await FileSystem.writeAsStringAsync(SETTINGS_FILE, JSON.stringify({ themeMode: mode }));
  } catch (e) {
    console.warn('No se pudo guardar el tema:', e);
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>('dark');

  useEffect(() => {
    readSavedMode().then((saved) => saved && setMode(saved));
  }, []);

  const toggleTheme = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      saveMode(next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, toggleTheme, c: mode === 'light' ? toLightColor : (x: string) => x }),
    [mode, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Crea las dos versiones de una hoja de estilos: la escrita (tema oscuro) y la derivada
 * automáticamente para el tema claro. Se llama una vez por archivo, fuera del componente.
 */
export function createThemedStyles<T extends NamedStyles<T> | NamedStyles<any>>(darkStyles: T & NamedStyles<any>): { dark: T; light: T } {
  return {
    dark: StyleSheet.create(darkStyles),
    light: StyleSheet.create(mapStyleColors(darkStyles)) as T,
  };
}

/** Devuelve la hoja de estilos del tema activo */
export function useThemedStyles<T>(themed: { dark: T; light: T }): T {
  const { mode } = useTheme();
  return themed[mode];
}
