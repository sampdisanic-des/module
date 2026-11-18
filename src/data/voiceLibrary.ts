export const matchStyleCategory = (styleCat?: string, styleName?: string, selectedCat?: string): boolean => {
  if (!selectedCat || selectedCat === 'ALL') return true;
  const sel = selectedCat.trim().toUpperCase();
  const cat = (styleCat || '').trim().toUpperCase();
  const name = (styleName || '').trim().toUpperCase();

  if (cat === sel) return true;
  if (sel === 'CUSTOM') return cat === 'CUSTOM' || name.includes('CUSTOM');
  if (sel === 'CUMBIA') return cat === 'CUMBIA' || cat === 'LATIN' || name.includes('CUMBIA');
  if (sel === 'LATIN') return cat === 'LATIN' || cat === 'CUMBIA' || name.includes('SALSA') || name.includes('BACHATA') || name.includes('CUMBIA') || name.includes('MERENGUE') || name.includes('REGGAETON') || name.includes('BOLERO') || name.includes('LATIN');
  if (sel === 'POP') return cat === 'POP' || name.includes('POP') || name.includes('GROOVE') || name.includes('8-BEAT') || name.includes('16-BEAT') || name.includes('BEAT');
  if (sel === 'ROCK') return cat === 'ROCK' || name.includes('ROCK') || name.includes('METAL') || name.includes('PUNK');
  if (sel === 'BALLAD') return cat === 'BALLAD' || name.includes('BALLAD') || name.includes('SLOW') || name.includes('LOVE');
  if (sel === 'DANCE') return cat === 'DANCE' || name.includes('DANCE') || name.includes('DISCO') || name.includes('EDM') || name.includes('HOUSE') || name.includes('TECHNO');

  return cat.includes(sel) || name.includes(sel);
};

export interface VoicePreset {
  id: string;
  name: string;
  category: 'PIANO' | 'PADS' | 'STRINGS' | 'LEADS' | 'BRASS' | 'ORGAN' | 'BASS' | 'CUSTOM';
  sf2Path: string;
  sf2Preset: number;
  isCustom?: boolean;
}

export const VOICE_LIBRARY: VoicePreset[] = [
  { id: 'v1', name: 'Yamaha CFX Grand', category: 'PIANO', sf2Path: 'soundfonts/yamaha_cfx_grand.sf2', sf2Preset: 0 },
  { id: 'v2', name: 'DX7 E-Piano Vintage', category: 'PIANO', sf2Path: 'soundfonts/dx7_epiano.sf2', sf2Preset: 4 },
  { id: 'v3', name: 'Suitcase Mark II Rhodes', category: 'PIANO', sf2Path: 'soundfonts/rhodes_mark2.sf2', sf2Preset: 5 },
  { id: 'v4', name: 'Ambient Pad Warm', category: 'PADS', sf2Path: 'soundfonts/ambient_pad.sf2', sf2Preset: 89 },
  { id: 'v5', name: 'Ethereal Space Choir', category: 'PADS', sf2Path: 'soundfonts/space_choir.sf2', sf2Preset: 91 },
  { id: 'v6', name: 'Syn Strings Symphony', category: 'STRINGS', sf2Path: 'soundfonts/strings_symphony.sf2', sf2Preset: 48 },
  { id: 'v7', name: 'Chamber Solo Violin', category: 'STRINGS', sf2Path: 'soundfonts/solo_violin.sf2', sf2Preset: 40 },
  { id: 'v8', name: 'Synth Lead Moog Saw', category: 'LEADS', sf2Path: 'soundfonts/moog_saw.sf2', sf2Preset: 81 },
  { id: 'v9', name: 'Square Wave Retro Lead', category: 'LEADS', sf2Path: 'soundfonts/square_retro.sf2', sf2Preset: 80 },
  { id: 'v10', name: 'Pop Brass Horn Section', category: 'BRASS', sf2Path: 'soundfonts/pop_brass.sf2', sf2Preset: 61 },
  { id: 'v11', name: 'French Horn Ensemble', category: 'BRASS', sf2Path: 'soundfonts/french_horns.sf2', sf2Preset: 60 },
  { id: 'v12', name: 'B3 Drawbar Hammond Organ', category: 'ORGAN', sf2Path: 'soundfonts/b3_organ.sf2', sf2Preset: 16 },
  { id: 'v13', name: 'Pipe Cathedral Organ', category: 'ORGAN', sf2Path: 'soundfonts/pipe_organ.sf2', sf2Preset: 19 },
  { id: 'v14', name: 'Fender Jazz Bass', category: 'BASS', sf2Path: 'soundfonts/jazz_bass.sf2', sf2Preset: 33 },
  { id: 'v15', name: 'Sub Synth Bass 808', category: 'BASS', sf2Path: 'soundfonts/sub_bass_808.sf2', sf2Preset: 38 },
];

