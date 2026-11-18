import * as FileSystem from 'expo-file-system';

const BANKS_FILE = `${FileSystem.documentDirectory}memory_banks.json`;

export interface VoiceChannelState {
  voiceId: string;
  volume: number;
  mute: boolean;
  solo: boolean;
  octave?: number;
  cutoff?: number;
  resonance?: number;
  attack?: number;
  delay?: number;
  sustain?: number;
  release?: number;
}

export interface MemoryBankPreset {
  bankId: number; // 1..8
  updatedAt: string;
  
  // Voices F1..F4
  f1: VoiceChannelState;
  f2: VoiceChannelState;
  f3: VoiceChannelState;
  f4: VoiceChannelState;

  // Pitch & Transposition
  octave: number;
  transpose: number;

  // DSP Filter & Envelope (Legacy / Defaults)
  attack: number;
  delay: number;
  sustain: number;
  release: number;
  cutoff: number;
  resonance: number;
  modulation: number;

  // Arranger Style & Tempo
  styleId: string;
  styleName: string;
  styleCategory: string;
  styleVolume: number;
  bpm: number;
}

export type MemoryBanksCatalog = Record<number, MemoryBankPreset | undefined>;

export class BankMemoryService {
  private static instance: BankMemoryService;

  public static getInstance(): BankMemoryService {
    if (!BankMemoryService.instance) {
      BankMemoryService.instance = new BankMemoryService();
    }
    return BankMemoryService.instance;
  }

  public async getAllBanks(): Promise<MemoryBanksCatalog> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(BANKS_FILE);
      if (!fileInfo.exists) {
        return {};
      }
      const content = await FileSystem.readAsStringAsync(BANKS_FILE);
      const parsed = JSON.parse(content);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch (e) {
      console.warn('[BankMemoryService] Error leyendo bancos de memoria:', e);
      return {};
    }
  }

  private async saveAllBanks(catalog: MemoryBanksCatalog): Promise<void> {
    try {
      await FileSystem.writeAsStringAsync(BANKS_FILE, JSON.stringify(catalog, null, 2));
    } catch (e) {
      console.warn('[BankMemoryService] Error guardando bancos de memoria:', e);
    }
  }

  public async saveBank(bankId: number, presetData: Omit<MemoryBankPreset, 'bankId' | 'updatedAt'>): Promise<MemoryBankPreset> {
    const catalog = await this.getAllBanks();
    const newPreset: MemoryBankPreset = {
      ...presetData,
      bankId,
      updatedAt: new Date().toISOString(),
    };
    catalog[bankId] = newPreset;
    await this.saveAllBanks(catalog);
    return newPreset;
  }

  /** Tras renombrar una voz importada, actualizar los bancos que la usan (guardan el nombre) */
  public async renameVoiceReferences(oldName: string, newName: string): Promise<MemoryBanksCatalog> {
    const catalog = await this.getAllBanks();
    let changed = false;
    for (const preset of Object.values(catalog)) {
      if (!preset) continue;
      for (const key of ['f1', 'f2', 'f3', 'f4'] as const) {
        if (preset[key]?.voiceId === oldName) {
          preset[key].voiceId = newName;
          changed = true;
        }
      }
    }
    if (changed) await this.saveAllBanks(catalog);
    return catalog;
  }

  public async clearBank(bankId: number): Promise<void> {
    const catalog = await this.getAllBanks();
    delete catalog[bankId];
    await this.saveAllBanks(catalog);
  }
}

export default BankMemoryService.getInstance();
