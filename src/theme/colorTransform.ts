/**
 * Conversión automática de la paleta oscura (la que está escrita en los estilos) al tema claro.
 *
 * Reglas, según el "croma" (qué tan saturado es el color):
 * - Neutros (fondos, bordes, textos gris azulado):
 *     oscuros (fondos y bordes) -> claros, conservando el orden de profundidad;
 *     medios y claros (textos)  -> oscuros con buen contraste sobre fondo claro.
 * - Acentos (cian, naranja, rojo, verde...):
 *     brillantes (texto, LED, botones) -> versión más oscura, legible sobre blanco;
 *     oscuros (fondos teñidos)         -> tinte muy claro del mismo tono.
 *
 * Los colores en FIXED_COLORS no se transforman (p. ej. texto blanco sobre un botón de color).
 */

/** Blanco que se mantiene blanco en ambos temas (texto sobre botones de acento) */
export const ON_ACCENT = '#FFFFFE';

const FIXED_COLORS = new Set([ON_ACCENT.toUpperCase()]);

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

const hexToRgb = (hex: string): Rgb => ({
  r: parseInt(hex.slice(0, 2), 16) / 255,
  g: parseInt(hex.slice(2, 4), 16) / 255,
  b: parseInt(hex.slice(4, 6), 16) / 255,
});

const rgbToHsl = ({ r, g, b }: Rgb): Hsl => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
};

const hslToHex = ({ h, s, l }: Hsl): string => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) => Math.round(Math.min(1, Math.max(0, v + m)) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Luminancia relativa WCAG (0 = negro, 1 = blanco) */
const relativeLuminance = (hex: string): number => {
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const { r, g, b } = hexToRgb(hex.slice(1));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

/** Luminancia máxima de un acento en tema claro: contraste >= 3.5:1 contra el fondo claro */
const MAX_ACCENT_LUMINANCE = 0.22;

const NEUTRAL_CHROMA = 0.22; // por debajo: neutro
const NEUTRAL_TEXT_FROM = 0.26; // luminosidad desde la que un neutro se considera texto

const transformRgb = (rgb: Rgb): string => {
  const chroma = Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b);
  const { h, s, l } = rgbToHsl(rgb);

  if (chroma < NEUTRAL_CHROMA) {
    if (l < NEUTRAL_TEXT_FROM) {
      // Fondos y bordes: invertir comprimiendo para que todo quede claro
      return hslToHex({ h, s: Math.min(s, 0.3), l: clamp01(1 - l * 0.65) });
    }
    // Textos: cuanto más claro era, más oscuro queda
    return hslToHex({ h, s: Math.min(s, 0.35), l: clamp01(0.5 - (l - NEUTRAL_TEXT_FROM) * 0.55) });
  }

  if (l < 0.3) {
    // Fondos teñidos (cola amarilla, botón activo...): tinte claro del mismo tono
    return hslToHex({ h, s: Math.min(s, 0.85), l: clamp01(0.9 + (0.3 - l) * 0.2) });
  }

  // Acentos brillantes: oscurecer hasta que contrasten con el fondo claro. Se mide la luminancia
  // percibida, así el cian y el amarillo (que se ven más claros) se oscurecen más que el rojo.
  let target = Math.min(l, 0.5);
  let out = hslToHex({ h, s, l: target });
  while (relativeLuminance(out) > MAX_ACCENT_LUMINANCE && target > 0.12) {
    target -= 0.01;
    out = hslToHex({ h, s, l: target });
  }
  return out;
};

const cache = new Map<string, string>();

/** Devuelve el equivalente en tema claro de un color del tema oscuro */
export const toLightColor = (color: string): string => {
  const cached = cache.get(color);
  if (cached) return cached;

  let result = color;
  const m = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(color);
  if (m && !FIXED_COLORS.has(`#${m[1]}`.toUpperCase())) {
    result = transformRgb(hexToRgb(m[1])) + (m[2] ?? '');
  } else if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const full = color.slice(1).split('').map((c) => c + c).join('');
    result = transformRgb(hexToRgb(full));
  }
  cache.set(color, result);
  return result;
};

const COLOR_KEYS = /color$/i; // color, backgroundColor, borderColor, shadowColor, ...

/** Aplica toLightColor a todas las propiedades de color de un objeto de estilos */
export const mapStyleColors = <T extends Record<string, any>>(styles: T): T => {
  const out: Record<string, any> = {};
  for (const [name, style] of Object.entries(styles)) {
    const mapped: Record<string, any> = {};
    for (const [prop, value] of Object.entries(style as Record<string, any>)) {
      mapped[prop] = typeof value === 'string' && COLOR_KEYS.test(prop) ? toLightColor(value) : value;
    }
    out[name] = mapped;
  }
  return out as T;
};
