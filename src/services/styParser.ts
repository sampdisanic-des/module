import * as FileSystem from 'expo-file-system';

export type StyleSectionKey =
  | 'INTRO_A'
  | 'INTRO_B'
  | 'INTRO_C'
  | 'INTRO_D'
  | 'MAIN_A'
  | 'MAIN_B'
  | 'MAIN_C'
  | 'MAIN_D'
  | 'FILL_A'
  | 'FILL_B'
  | 'FILL_C'
  | 'FILL_D'
  | 'ENDING_A'
  | 'ENDING_B'
  | 'ENDING_C'
  | 'ENDING_D';

export interface StyleNoteEvent {
  tick: number; // Ticks desde el inicio de la sección
  channel: number; // 9: Drums Sub, 10: Drums Main, 11: Bass, 12: Chord 1, 13: Chord 2, 14: Pad, 15: Phrase 1, 16: Phrase 2
  note: number; // 0..127
  velocity: number; // 0..127
  durationTicks: number;
  program?: number; // GM Program Change para este canal si está definido
  isDrum?: boolean;
}

export interface StyleSectionPattern {
  lengthInBeats: number;
  totalTicks: number;
  events: StyleNoteEvent[];
}

export interface ParsedStyle {
  id: string;
  name: string;
  defaultBpm: number;
  ppq: number;
  sections: Partial<Record<StyleSectionKey, StyleSectionPattern>>;
  channelPrograms?: Record<number, number>; // Channel -> GM Program
}

/**
 * Normaliza nombres de marcadores Yamaha a nuestras StyleSectionKey
 */
function normalizeMarkerName(rawName: string): StyleSectionKey | null {
  const clean = rawName.trim().toUpperCase().replace(/[\s\-_]+/g, '');
  if (clean.includes('INTROA') || clean === 'INTRO1' || clean === 'INTOA') return 'INTRO_A';
  if (clean.includes('INTROB') || clean === 'INTRO2') return 'INTRO_B';
  if (clean.includes('INTROC') || clean === 'INTRO3') return 'INTRO_C';
  if (clean.includes('INTROD') || clean === 'INTRO4') return 'INTRO_D';

  if (clean.includes('MAINA') || clean === 'MAIN1' || clean === 'VERSE1') return 'MAIN_A';
  if (clean.includes('MAINB') || clean === 'MAIN2' || clean === 'CHORUS1') return 'MAIN_B';
  if (clean.includes('MAINC') || clean === 'MAIN3' || clean === 'VERSE2') return 'MAIN_C';
  if (clean.includes('MAIND') || clean === 'MAIN4' || clean === 'CHORUS2') return 'MAIN_D';

  if (clean.includes('FILLA') || clean.includes('FILLINAA') || clean.includes('FILL1')) return 'FILL_A';
  if (clean.includes('FILLB') || clean.includes('FILLINBB') || clean.includes('FILL2')) return 'FILL_B';
  if (clean.includes('FILLC') || clean.includes('FILLINCC') || clean.includes('FILL3')) return 'FILL_C';
  if (clean.includes('FILLD') || clean.includes('FILLINDD') || clean.includes('FILL4')) return 'FILL_D';

  if (clean.includes('ENDINGA') || clean === 'ENDING1' || clean === 'OUTROA') return 'ENDING_A';
  if (clean.includes('ENDINGB') || clean === 'ENDING2') return 'ENDING_B';
  if (clean.includes('ENDINGC') || clean === 'ENDING3') return 'ENDING_C';
  if (clean.includes('ENDINGD') || clean === 'ENDING4') return 'ENDING_D';

  return null;
}

/**
 * Decodifica Base64 a Uint8Array en entornos React Native
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let bufferLength = base64.length * 0.75;
  if (base64.endsWith('==')) bufferLength -= 2;
  else if (base64.endsWith('=')) bufferLength -= 1;

  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < base64.length; i += 4) {
    const enc1 = chars.indexOf(base64[i]);
    const enc2 = chars.indexOf(base64[i + 1]);
    const enc3 = chars.indexOf(base64[i + 2]);
    const enc4 = chars.indexOf(base64[i + 3]);

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    bytes[p++] = chr1;
    if (enc3 !== 64 && p < bufferLength) bytes[p++] = chr2;
    if (enc4 !== 64 && p < bufferLength) bytes[p++] = chr3;
  }
  return bytes;
}

/**
 * Parser binario de archivos MIDI / Yamaha .STY (SMF Format 0 / Format 1)
 */
export function parseMidiStyleBinary(data: Uint8Array, styleName: string = 'Custom Style'): ParsedStyle {
  let pos = 0;

  function readString(len: number): string {
    let str = '';
    for (let i = 0; i < len; i++) {
      if (pos < data.length) {
        str += String.fromCharCode(data[pos++]);
      }
    }
    return str;
  }

  function readUint16(): number {
    const val = (data[pos] << 8) | data[pos + 1];
    pos += 2;
    return val;
  }

  function readUint32(): number {
    const val = (data[pos] << 24) | (data[pos + 1] << 16) | (data[pos + 2] << 8) | data[pos + 3];
    pos += 4;
    return val >>> 0;
  }

  function readVarLength(): number {
    let val = 0;
    let b = 0;
    do {
      if (pos >= data.length) break;
      b = data[pos++];
      val = (val << 7) | (b & 0x7f);
    } while (b & 0x80);
    return val;
  }

  // 1. Validar Header Chunk 'MThd'
  const headerTag = readString(4);
  if (headerTag !== 'MThd') {
    throw new Error('Formato no valido: No contiene cabecera MThd');
  }

  const headerLen = readUint32();
  const format = readUint16();
  const numTracks = readUint16();
  const ppq = readUint16() || 480;

  // Saltar bytes sobrantes del header si hubiese
  pos += Math.max(0, headerLen - 6);

  interface RawMarker {
    name: string;
    absTick: number;
  }

  interface RawNoteOn {
    absTick: number;
    channel: number;
    note: number;
    velocity: number;
  }

  const markers: RawMarker[] = [];
  const noteEvents: StyleNoteEvent[] = [];
  const openNotes: Record<string, RawNoteOn> = {};
  const channelPrograms: Record<number, number> = {};
  let detectedBpm = 120;

  // 2. Procesar Tracks 'MTrk'
  for (let t = 0; t < numTracks; t++) {
    if (pos >= data.length) break;
    const trackTag = readString(4);
    if (trackTag !== 'MTrk') {
      // Si encuentra chunks de metadatos Yamaha CASM, CSEG, SInt, podemos saltarlos
      const chunkLen = readUint32();
      pos += chunkLen;
      continue;
    }

    const trackLen = readUint32();
    const trackEnd = pos + trackLen;
    let currentAbsTick = 0;
    let lastStatus = 0;

    while (pos < trackEnd && pos < data.length) {
      const delta = readVarLength();
      currentAbsTick += delta;

      if (pos >= data.length) break;
      let status = data[pos];

      if (status < 0x80) {
        if (lastStatus === 0) {
          pos++; // byte de datos sin estado previo: archivo corrupto, saltar
          continue;
        }
        status = lastStatus; // Running status
      } else {
        pos++;
        // Solo los mensajes de canal establecen running status; meta y SysEx lo cancelan
        lastStatus = status < 0xf0 ? status : 0;
      }

      if (status === 0xff) {
        // Meta Event
        const metaType = data[pos++];
        const metaLen = readVarLength();
        const metaStart = pos;

        if (metaType === 0x06) {
          // Marker (Yamaha SFF: "SInt", "Main A", "Fill In AA", "Ending A"...)
          const markerText = readString(metaLen);
          markers.push({ name: markerText, absTick: currentAbsTick });
          pos = metaStart + metaLen;
        } else if (metaType === 0x51 && metaLen === 3) {
          // Set Tempo (Microseconds per quarter note)
          const usPerQuarter = (data[pos] << 16) | (data[pos + 1] << 8) | data[pos + 2];
          if (usPerQuarter > 0) {
            detectedBpm = Math.round(60000000 / usPerQuarter);
          }
          pos = metaStart + metaLen;
        } else {
          pos = metaStart + metaLen;
        }
      } else if (status === 0xf0 || status === 0xf7) {
        // Sysex
        const sysLen = readVarLength();
        pos += sysLen;
      } else {
        // MIDI Channel Voice Messages
        const msgType = status & 0xf0;
        const channel = (status & 0x0f) + 1; // 1-indexed

        if (msgType === 0x90) {
          // Note On
          const note = data[pos++];
          const velocity = data[pos++];
          const key = `${channel}_${note}`;

          if (velocity > 0) {
            // Cerrar nota previa si habia colision
            if (openNotes[key]) {
              const prev = openNotes[key];
              noteEvents.push({
                tick: prev.absTick,
                channel: prev.channel,
                note: prev.note,
                velocity: prev.velocity,
                durationTicks: Math.max(currentAbsTick - prev.absTick, 120),
                isDrum: prev.channel === 9 || prev.channel === 10,
              });
            }
            openNotes[key] = { absTick: currentAbsTick, channel, note, velocity };
          } else if (openNotes[key]) {
            // Note On con vel=0 es Note Off
            const prev = openNotes[key];
            delete openNotes[key];
            noteEvents.push({
              tick: prev.absTick,
              channel: prev.channel,
              note: prev.note,
              velocity: prev.velocity,
              durationTicks: Math.max(currentAbsTick - prev.absTick, 60),
              isDrum: prev.channel === 9 || prev.channel === 10,
            });
          }
        } else if (msgType === 0x80) {
          // Note Off
          const note = data[pos++];
          pos++; // skip off velocity
          const key = `${channel}_${note}`;
          if (openNotes[key]) {
            const prev = openNotes[key];
            delete openNotes[key];
            noteEvents.push({
              tick: prev.absTick,
              channel: prev.channel,
              note: prev.note,
              velocity: prev.velocity,
              durationTicks: Math.max(currentAbsTick - prev.absTick, 60),
              isDrum: prev.channel === 9 || prev.channel === 10,
            });
          }
        } else if (msgType === 0xc0) {
          // Program Change
          const program = data[pos++];
          channelPrograms[channel] = program;
        } else if (msgType === 0xb0 || msgType === 0xe0) {
          // CC / Pitch Bend (2 data bytes)
          pos += 2;
        } else if (msgType === 0xd0) {
          // Channel Aftertouch (1 data byte)
          pos += 1;
        }
      }
    }
  }

  // Cerrar notas abiertas al final del track
  Object.values(openNotes).forEach((prev) => {
    noteEvents.push({
      tick: prev.absTick,
      channel: prev.channel,
      note: prev.note,
      velocity: prev.velocity,
      durationTicks: 240,
      isDrum: prev.channel === 9 || prev.channel === 10,
    });
  });

  // 3. Segmentar por Marcadores de Sección Yamaha
  const sections: Partial<Record<StyleSectionKey, StyleSectionPattern>> = {};

  const recognizedSections: { key: StyleSectionKey; startTick: number; endTick?: number }[] = [];

  markers.forEach((m) => {
    const secKey = normalizeMarkerName(m.name);
    if (secKey) {
      recognizedSections.push({ key: secKey, startTick: m.absTick });
    }
  });

  // Ordenar secciones por tick de inicio
  recognizedSections.sort((a, b) => a.startTick - b.startTick);

  // Calcular endTick de cada sección con TODOS los marcadores (también los no
  // reconocidos, p. ej. "Fill In BA"), para que una sección no absorba a la siguiente
  const allMarkerTicks = markers.map((m) => m.absTick).sort((a, b) => a - b);
  const lastEventTick = noteEvents.reduce((m, e) => Math.max(m, e.tick + e.durationTicks), 0);
  for (const sec of recognizedSections) {
    const next = allMarkerTicks.find((t) => t > sec.startTick);
    if (next !== undefined) {
      sec.endTick = next;
    } else {
      // Última sección: redondear al compás completo que contiene su último evento
      const bar = ppq * 4;
      const span = Math.max(lastEventTick - sec.startTick, bar);
      sec.endTick = sec.startTick + Math.ceil(span / bar) * bar;
    }
  }

  // Mapear eventos a cada sección con ticks relativos (iniciando en 0)
  recognizedSections.forEach((sec) => {
    const start = sec.startTick;
    const end = sec.endTick || start + ppq * 8;
    const secTicks = Math.max(end - start, ppq * 4);
    const secEvents = noteEvents
      .filter((e) => e.tick >= start && e.tick < end)
      .map((e) => ({
        ...e,
        tick: e.tick - start,
        // Las notas no se extienden más allá del final de su sección
        durationTicks: Math.max(1, Math.min(e.durationTicks, end - e.tick)),
        program: channelPrograms[e.channel],
      }))
      .sort((a, b) => a.tick - b.tick);

    sections[sec.key] = {
      lengthInBeats: Math.round(secTicks / ppq),
      totalTicks: secTicks,
      events: secEvents,
    };
  });

  // Si no se encontraron marcadores explícitos, agrupar todos los eventos en MAIN_A
  if (Object.keys(sections).length === 0 && noteEvents.length > 0) {
    const maxTick = noteEvents.reduce((m, e) => Math.max(m, e.tick + e.durationTicks), ppq * 8);
    const pattern: StyleSectionPattern = {
      lengthInBeats: Math.round(maxTick / ppq),
      totalTicks: maxTick,
      events: noteEvents.map((e) => ({ ...e, program: channelPrograms[e.channel] })),
    };
    sections.MAIN_A = pattern;
    sections.MAIN_B = pattern;
    sections.MAIN_C = pattern;
    sections.MAIN_D = pattern;
    sections.INTRO_A = pattern;
    sections.ENDING_A = pattern;
  }

  return {
    id: styleName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
    name: styleName,
    defaultBpm: detectedBpm > 40 && detectedBpm < 240 ? detectedBpm : 120,
    ppq,
    sections,
    channelPrograms,
  };
}

/**
 * Generador procedural de patrones de ritmos de alta fidelidad para los estilos integrados
 */
export function generateProceduralStyle(styleId: string): ParsedStyle {
  const ppq = 480;
  const beatTicks = ppq;
  const barTicks = beatTicks * 4; // Compás de 4/4 (1920 ticks)

  const sections: Partial<Record<StyleSectionKey, StyleSectionPattern>> = {};

  if (styleId === 'st_1') {
    // 1. CUMBIA PROFESSIONAL (105 BPM)
    const mainAEvents: StyleNoteEvent[] = [];
    for (let bar = 0; bar < 2; bar++) {
      const bOffset = bar * barTicks;
      for (let beat = 0; beat < 4; beat++) {
        const beatOffset = bOffset + beat * beatTicks;
        mainAEvents.push({ tick: beatOffset, channel: 10, note: 36, velocity: 100, durationTicks: 120, isDrum: true });
        mainAEvents.push({ tick: beatOffset, channel: 10, note: 42, velocity: 80, durationTicks: 60, isDrum: true });
        mainAEvents.push({ tick: beatOffset + 120, channel: 10, note: 42, velocity: 95, durationTicks: 60, isDrum: true });
        mainAEvents.push({ tick: beatOffset + 240, channel: 10, note: 42, velocity: 85, durationTicks: 60, isDrum: true });
        mainAEvents.push({ tick: beatOffset + 360, channel: 10, note: 42, velocity: 90, durationTicks: 60, isDrum: true });
      }
      mainAEvents.push({ tick: bOffset + beatTicks + 240, channel: 10, note: 39, velocity: 105, durationTicks: 120, isDrum: true });
      mainAEvents.push({ tick: bOffset + 3 * beatTicks + 240, channel: 10, note: 39, velocity: 105, durationTicks: 120, isDrum: true });

      // Bajo Cumbia (Canal 11) - Tónica en 1, Quinta en 3
      mainAEvents.push({ tick: bOffset + 240, channel: 11, note: 36, velocity: 95, durationTicks: 240, program: 33 });
      mainAEvents.push({ tick: bOffset + 2 * beatTicks + 240, channel: 11, note: 43, velocity: 90, durationTicks: 240, program: 33 });

      // Piano / Acordes Cumbia (Canal 12) - Contratiempos
      [0.5, 1.5, 2.5, 3.5].forEach((b) => {
        const t = bOffset + Math.round(b * beatTicks);
        mainAEvents.push({ tick: t, channel: 12, note: 60, velocity: 85, durationTicks: 180, program: 0 });
        mainAEvents.push({ tick: t, channel: 12, note: 64, velocity: 85, durationTicks: 180, program: 0 });
        mainAEvents.push({ tick: t, channel: 12, note: 67, velocity: 85, durationTicks: 180, program: 0 });
      });

      // Brass / Trompeta Riff (Canal 15)
      mainAEvents.push({ tick: bOffset + 3 * beatTicks, channel: 15, note: 72, velocity: 90, durationTicks: 180, program: 61 });
      mainAEvents.push({ tick: bOffset + 3 * beatTicks + 240, channel: 15, note: 76, velocity: 95, durationTicks: 240, program: 61 });
    }

    const cumbiaPattern: StyleSectionPattern = { lengthInBeats: 8, totalTicks: barTicks * 2, events: mainAEvents };
    sections.MAIN_A = cumbiaPattern;
    sections.MAIN_B = cumbiaPattern;
    sections.MAIN_C = cumbiaPattern;
    sections.MAIN_D = cumbiaPattern;

    // Fill In Cumbia (Redoble de timbales)
    const fillEvents: StyleNoteEvent[] = [
      { tick: 0, channel: 10, note: 38, velocity: 100, durationTicks: 120, isDrum: true },
      { tick: 120, channel: 10, note: 38, velocity: 105, durationTicks: 120, isDrum: true },
      { tick: 240, channel: 10, note: 45, velocity: 110, durationTicks: 120, isDrum: true },
      { tick: 360, channel: 10, note: 47, velocity: 110, durationTicks: 120, isDrum: true },
      { tick: 480, channel: 10, note: 50, velocity: 115, durationTicks: 120, isDrum: true },
      { tick: 720, channel: 10, note: 49, velocity: 120, durationTicks: 480, isDrum: true },
    ];
    sections.FILL_A = { lengthInBeats: 2, totalTicks: beatTicks * 2, events: fillEvents };
    sections.FILL_B = { lengthInBeats: 2, totalTicks: beatTicks * 2, events: fillEvents };
    sections.FILL_C = { lengthInBeats: 2, totalTicks: beatTicks * 2, events: fillEvents };
    sections.FILL_D = { lengthInBeats: 2, totalTicks: beatTicks * 2, events: fillEvents };

    // Intro & Ending Cumbia
    const introEvents: StyleNoteEvent[] = [
      { tick: 0, channel: 10, note: 49, velocity: 110, durationTicks: 480, isDrum: true },
      { tick: 0, channel: 10, note: 36, velocity: 100, durationTicks: 240, isDrum: true },
      { tick: beatTicks, channel: 10, note: 38, velocity: 90, durationTicks: 240, isDrum: true },
      { tick: 2 * beatTicks, channel: 10, note: 38, velocity: 100, durationTicks: 240, isDrum: true },
      { tick: 3 * beatTicks, channel: 10, note: 49, velocity: 115, durationTicks: 480, isDrum: true },
    ];
    sections.INTRO_A = { lengthInBeats: 4, totalTicks: barTicks, events: introEvents };
    sections.ENDING_A = { lengthInBeats: 4, totalTicks: barTicks, events: introEvents };
  } else {
    // PATRON POP ROCK / 8-BEAT / LATIN / BALLAD (Standard 4/4 Groove)
    const mainEvents: StyleNoteEvent[] = [];

    for (let bar = 0; bar < 2; bar++) {
      const bOffset = bar * barTicks;
      // Batería: Kick 1 y 3, Snare 2 y 4, Hi-Hat corcheas
      mainEvents.push({ tick: bOffset, channel: 10, note: 36, velocity: 105, durationTicks: 240, isDrum: true });
      mainEvents.push({ tick: bOffset + 2 * beatTicks, channel: 10, note: 36, velocity: 100, durationTicks: 240, isDrum: true });
      mainEvents.push({ tick: bOffset + beatTicks, channel: 10, note: 38, velocity: 100, durationTicks: 240, isDrum: true });
      mainEvents.push({ tick: bOffset + 3 * beatTicks, channel: 10, note: 38, velocity: 105, durationTicks: 240, isDrum: true });

      for (let i = 0; i < 8; i++) {
        mainEvents.push({
          tick: bOffset + i * 240,
          channel: 10,
          note: 42,
          velocity: i % 2 === 0 ? 90 : 75,
          durationTicks: 120,
          isDrum: true,
        });
      }

      // Bajo continuo (Canal 11)
      mainEvents.push({ tick: bOffset, channel: 11, note: 36, velocity: 90, durationTicks: 400, program: 33 });
      mainEvents.push({ tick: bOffset + 2 * beatTicks, channel: 11, note: 43, velocity: 85, durationTicks: 400, program: 33 });

      // Acorde Teclado (Canal 12)
      mainEvents.push({ tick: bOffset + beatTicks, channel: 12, note: 60, velocity: 80, durationTicks: 400, program: 4 });
      mainEvents.push({ tick: bOffset + beatTicks, channel: 12, note: 64, velocity: 80, durationTicks: 400, program: 4 });
      mainEvents.push({ tick: bOffset + beatTicks, channel: 12, note: 67, velocity: 80, durationTicks: 400, program: 4 });

      mainEvents.push({ tick: bOffset + 3 * beatTicks, channel: 12, note: 60, velocity: 80, durationTicks: 400, program: 4 });
      mainEvents.push({ tick: bOffset + 3 * beatTicks, channel: 12, note: 64, velocity: 80, durationTicks: 400, program: 4 });
      mainEvents.push({ tick: bOffset + 3 * beatTicks, channel: 12, note: 67, velocity: 80, durationTicks: 400, program: 4 });

      // Pad / Cuerdas Sostenidas (Canal 14)
      mainEvents.push({ tick: bOffset, channel: 14, note: 60, velocity: 70, durationTicks: barTicks, program: 48 });
      mainEvents.push({ tick: bOffset, channel: 14, note: 67, velocity: 70, durationTicks: barTicks, program: 48 });
    }

    const defaultPattern: StyleSectionPattern = { lengthInBeats: 8, totalTicks: barTicks * 2, events: mainEvents };
    sections.MAIN_A = defaultPattern;
    sections.MAIN_B = defaultPattern;
    sections.MAIN_C = defaultPattern;
    sections.MAIN_D = defaultPattern;
    sections.INTRO_A = defaultPattern;
    sections.ENDING_A = defaultPattern;

    const fillEvents: StyleNoteEvent[] = [
      { tick: 0, channel: 10, note: 38, velocity: 100, durationTicks: 120, isDrum: true },
      { tick: 120, channel: 10, note: 45, velocity: 105, durationTicks: 120, isDrum: true },
      { tick: 240, channel: 10, note: 47, velocity: 110, durationTicks: 120, isDrum: true },
      { tick: 360, channel: 10, note: 50, velocity: 115, durationTicks: 120, isDrum: true },
      { tick: 480, channel: 10, note: 49, velocity: 120, durationTicks: 480, isDrum: true },
    ];
    sections.FILL_A = { lengthInBeats: 2, totalTicks: beatTicks * 2, events: fillEvents };
    sections.FILL_B = { lengthInBeats: 2, totalTicks: beatTicks * 2, events: fillEvents };
    sections.FILL_C = { lengthInBeats: 2, totalTicks: beatTicks * 2, events: fillEvents };
    sections.FILL_D = { lengthInBeats: 2, totalTicks: beatTicks * 2, events: fillEvents };
  }

  return {
    id: styleId,
    name: styleId,
    defaultBpm: styleId === 'st_1' ? 105 : styleId === 'st_2' ? 68 : styleId === 'st_4' ? 180 : styleId === 'st_5' ? 128 : 110,
    ppq,
    sections,
  };
}

/**
 * Lee un archivo .STY importado localmente o devuelve el patrón procedural
 */
export async function getStyleData(styleId: string, filePath?: string): Promise<ParsedStyle> {
  if (filePath) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists) {
        const base64 = await FileSystem.readAsStringAsync(filePath, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const binaryBytes = base64ToUint8Array(base64);
        const nameClean = filePath.split('/').pop()?.replace(/\.[^/.]+$/, '').replace(/_/g, ' ') || 'Ritmo Personalizado';
        const parsed = parseMidiStyleBinary(binaryBytes, nameClean);
        return parsed;
      }
    } catch (e) {
      console.warn('[StyParser] Fallo al parsear binario .STY, usando fallback procedural:', e);
    }
  }

  return generateProceduralStyle(styleId);
}
