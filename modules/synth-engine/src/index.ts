import SynthEngineModule, { MidiDeviceInfoTS } from './SynthEngineModule';

export function initializeEngine(): boolean {
  try {
    return SynthEngineModule.initialize();
  } catch (error) {
    console.error('[SynthEngine TS] Error al inicializar:', error);
    return false;
  }
}

export function triggerNoteOn(note: number, velocity: number = 100): void {
  SynthEngineModule.noteOn(note, velocity);
}

export function triggerNoteOff(note: number): void {
  SynthEngineModule.noteOff(note);
}

export function updateEngineParam(paramName: string, value: number): void {
  SynthEngineModule.setParam(paramName, value);
}

export function fetchDetectedChord(): string {
  try {
    return SynthEngineModule.getDetectedChord();
  } catch {
    return '---';
  }
}

export function updateSplitPoint(note: number): void {
  SynthEngineModule.setSplitPoint(note);
}

export function updateBpm(bpm: number): void {
  SynthEngineModule.setBpm(bpm);
}

export function updateStyleSection(section: string): void {
  SynthEngineModule.setStyleSection(section);
}

export function listMidiDevices(): MidiDeviceInfoTS[] {
  try {
    return SynthEngineModule.scanMidiDevices();
  } catch {
    return [];
  }
}

export function attachMidiDevice(deviceId: string): boolean {
  try {
    return SynthEngineModule.connectMidiDevice(deviceId);
  } catch {
    return false;
  }
}

export default SynthEngineModule;
