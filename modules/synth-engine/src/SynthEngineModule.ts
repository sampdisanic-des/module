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

export interface ISynthEngineNativeModule {
  initialize(): boolean;
  loadSoundFont(assetPath: string): boolean;
  noteOn(note: number, velocity: number): void;
  noteOff(note: number): void;
  setParam(paramName: string, value: number): void;

  getDetectedChord(): string;
  setSplitPoint(note: number): void;
  setBpm(bpm: number): void;
  setStyleSection(section: string): void;

  scanMidiDevices(): MidiDeviceInfoTS[];
  connectMidiDevice(deviceId: string): boolean;

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
    noteOn: () => {},
    noteOff: () => {},
    setParam: () => {},
    getDetectedChord: () => '---',
    setSplitPoint: () => {},
    setBpm: () => {},
    setStyleSection: () => {},
    scanMidiDevices: () => [],
    connectMidiDevice: () => false,
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
