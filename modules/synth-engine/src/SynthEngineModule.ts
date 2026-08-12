import { requireNativeModule } from 'expo-modules-core';

export interface MidiDeviceInfoTS {
  id: string;
  name: string;
  type: 'USB' | 'BLUETOOTH';
}

export interface ISynthEngineNativeModule {
  initialize(): boolean;
  noteOn(note: number, velocity: number): void;
  noteOff(note: number): void;
  setParam(paramName: string, value: number): void;

  getDetectedChord(): string;
  setSplitPoint(note: number): void;
  setBpm(bpm: number): void;
  setStyleSection(section: string): void;

  scanMidiDevices(): MidiDeviceInfoTS[];
  connectMidiDevice(deviceId: string): boolean;
}

let NativeSynthEngine: ISynthEngineNativeModule;

try {
  NativeSynthEngine = requireNativeModule<ISynthEngineNativeModule>('SynthEngine');
} catch (e) {
  console.warn('[SynthEngine TS] Advertencia: Módulo nativo SynthEngine no vinculado aún en JS:', e);
  NativeSynthEngine = {
    initialize: () => false,
    noteOn: () => {},
    noteOff: () => {},
    setParam: () => {},
    getDetectedChord: () => '---',
    setSplitPoint: () => {},
    setBpm: () => {},
    setStyleSection: () => {},
    scanMidiDevices: () => [],
    connectMidiDevice: () => false,
  };
}

export default NativeSynthEngine;
