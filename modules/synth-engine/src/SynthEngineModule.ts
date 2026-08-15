import { requireNativeModule, EventEmitter, Subscription } from 'expo-modules-core';

export interface MidiDeviceInfoTS {
  id: string;
  name: string;
  type: 'USB' | 'BLUETOOTH';
}

export interface SystemMidiDeviceDiag {
  id: string;
  sysId: number;
  name: string;
  manufacturer: string;
  product: string;
  type: string;
  inputPorts: number;
  outputPorts: number;
  isOpen: boolean;
}

export interface UsbHostDeviceDiag {
  name: string;
  vendorId: number;
  productId: number;
  manufacturerName: string;
  productName: string;
  hasPermission: boolean;
  interfaceCount: number;
}

export interface MidiDiagnosticsData {
  systemMidiDevices: SystemMidiDeviceDiag[];
  usbHostDevices: UsbHostDeviceDiag[];
  rawUsbNodes?: string[];
  isDirectUsbActive: boolean;
  openPortCount: number;
  connectedDeviceName: string;
}

export interface MidiLogEvent {
  tag: string;
  message: string;
  level: string;
  timestamp: number;
}

export interface MidiNoteEvent {
  type: 'noteOn' | 'noteOff';
  note: number;
  velocity: number;
}

export interface StylePlaybackState {
  isPlaying: boolean;
  currentBeat: number; // 1, 2, 3, 4
  currentSection: string;
  queuedSection: string;
}

export interface DiscoveredBleDeviceTS {
  name: string;
  address: string;
  rssi: number;
  isConnected: boolean;
}

export interface ISynthEngineNativeModule {
  initialize(): boolean;
  loadSoundFont(assetPath: string): boolean;
  setLayerMix(layerIndex: number, volume: number, mute: boolean, solo: boolean): void;
  setLayerVoice(layerIndex: number, voiceName: string, presetIndex: number, fontPath: string): boolean;
  setLayerOctave(layerIndex: number, octave: number): void;
  setGlobalTranspose(transpose: number): void;
  setLayerParam(layerIndex: number, paramName: string, value: number): void;
  getChannelLevels(): number[];
  auditionVoice(presetIndex: number, fontPath: string, note: number, velocity: number): void;
  auditionStop(note: number): void;
  noteOn(note: number, velocity: number): void;
  noteOff(note: number): void;

  // Arranger / Styles
  styleNoteOn(channel: number, note: number, velocity: number, program: number): void;
  styleNoteOff(channel: number, note: number): void;
  setStyleMasterVolume(volume: number): void;
  styleAllNotesOff(): void;

  // Secuenciador Nativo C++ (Precisión de Muestra 0ms Jitter)
  clearStyleData(): void;
  setStylePpq(ppq: number): void;
  loadStyleSectionEvents(sectionName: string, totalTicks: number, eventsData: string): void;
  startStylePlayback(bpm: number, accompanimentOn: boolean): void;
  stopStylePlayback(): void;
  setStyleAccompaniment(enabled: boolean): void;
  setStyleBpm(bpm: number): void;
  setStyleSection(section: string): void;
  queueNextStyleSection(section: string): void;
  getStylePlaybackState(): StylePlaybackState;

  setParam(paramName: string, value: number): void;

  getDetectedChord(): string;
  setSplitPoint(note: number): void;
  setBpm(bpm: number): void;

  scanMidiDevices(): MidiDeviceInfoTS[];
  connectMidiDevice(deviceId: string): boolean;

  isBluetoothEnabled(): boolean;
  isBleScanning(): boolean;
  startBleScan(): boolean;
  stopBleScan(): boolean;
  getDiscoveredBleDevices(): DiscoveredBleDeviceTS[];
  connectBleDevice(address: string): Promise<boolean>;
  disconnectMidi(): boolean;

  getMidiDiagnostics(): MidiDiagnosticsData;
  requestUsbPermission(): boolean;
}

let NativeSynthEngine: any;

try {
  NativeSynthEngine = requireNativeModule('SynthEngine');
} catch (e) {
  console.warn('[SynthEngine TS] Advertencia: Módulo nativo SynthEngine no vinculado aún en JS:', e);
  NativeSynthEngine = {
    initialize: () => false,
    loadSoundFont: () => false,
    setLayerMix: () => {},
    setLayerVoice: () => true,
    setLayerOctave: () => {},
    setGlobalTranspose: () => {},
    setLayerParam: () => {},
    getChannelLevels: () => [0, 0, 0, 0],
    auditionVoice: () => {},
    auditionStop: () => {},
    noteOn: () => {},
    noteOff: () => {},
    styleNoteOn: () => {},
    styleNoteOff: () => {},
    setStyleMasterVolume: () => {},
    styleAllNotesOff: () => {},
    clearStyleData: () => {},
    setStylePpq: () => {},
    loadStyleSectionEvents: () => {},
    startStylePlayback: () => {},
    stopStylePlayback: () => {},
    setStyleAccompaniment: () => {},
    setStyleBpm: () => {},
    setStyleSection: () => {},
    queueNextStyleSection: () => {},
    getStylePlaybackState: () => ({
      isPlaying: false,
      currentBeat: 1,
      currentSection: 'MAIN_A',
      queuedSection: ''
    }),
    setParam: () => {},
    getDetectedChord: () => '---',
    setSplitPoint: () => {},
    setBpm: () => {},
    scanMidiDevices: () => [],
    connectMidiDevice: () => false,
    isBluetoothEnabled: () => false,
    isBleScanning: () => false,
    startBleScan: () => false,
    stopBleScan: () => true,
    getDiscoveredBleDevices: () => [],
    connectBleDevice: async () => false,
    disconnectMidi: () => true,
    getMidiDiagnostics: () => ({
      systemMidiDevices: [],
      usbHostDevices: [],
      isDirectUsbActive: false,
      openPortCount: 0,
      connectedDeviceName: 'Ninguno'
    }),
    requestUsbPermission: () => false,
  };
}

const emitter = new EventEmitter(NativeSynthEngine);

export function addMidiLogListener(listener: (event: MidiLogEvent) => void): Subscription {
  return emitter.addListener('onMidiLog', listener);
}

export function addMidiNoteListener(listener: (event: MidiNoteEvent) => void): Subscription {
  return emitter.addListener('onMidiNoteReceived', listener);
}

export default NativeSynthEngine;
