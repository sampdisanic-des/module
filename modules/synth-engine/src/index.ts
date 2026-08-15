import SynthEngineModule, { MidiDeviceInfoTS, StylePlaybackState } from './SynthEngineModule';

export function initializeEngine(): boolean {
  try {
    return SynthEngineModule.initialize();
  } catch (error) {
    console.error('[SynthEngine TS] Error al inicializar:', error);
    return false;
  }
}

export function loadSoundFontFile(assetPath: string): boolean {
  try {
    return SynthEngineModule.loadSoundFont(assetPath);
  } catch (error) {
    console.error('[SynthEngine TS] Error al cargar SoundFont asset:', error);
    return false;
  }
}

export function configureLayerMix(layerIndex: number, volume: number, mute: boolean, solo: boolean): void {
  try {
    SynthEngineModule.setLayerMix(layerIndex, volume, mute, solo);
  } catch (error) {
    console.error('[SynthEngine TS] Error en configureLayerMix:', error);
  }
}

export function configureLayerVoice(
  layerIndex: number,
  voiceName: string,
  presetIndex: number = 0,
  fontPath: string = ''
): boolean {
  try {
    return SynthEngineModule.setLayerVoice(layerIndex, voiceName, presetIndex, fontPath);
  } catch (error) {
    console.error('[SynthEngine TS] Error en configureLayerVoice:', error);
    return false;
  }
}

export function configureLayerOctave(layerIndex: number, octave: number): void {
  try {
    SynthEngineModule.setLayerOctave(layerIndex, octave);
  } catch (error) {
    console.error('[SynthEngine TS] Error en configureLayerOctave:', error);
  }
}

export function configureGlobalTranspose(transpose: number): void {
  try {
    SynthEngineModule.setGlobalTranspose(transpose);
  } catch (error) {
    console.error('[SynthEngine TS] Error en configureGlobalTranspose:', error);
  }
}

export function configureLayerParam(layerIndex: number, paramName: string, value: number): void {
  try {
    SynthEngineModule.setLayerParam(layerIndex, paramName, value);
  } catch (error) {
    console.error('[SynthEngine TS] Error en configureLayerParam:', error);
  }
}

export function fetchChannelLevels(): number[] {
  try {
    return SynthEngineModule.getChannelLevels();
  } catch {
    return [0, 0, 0, 0];
  }
}

export function auditionVoicePreset(presetIndex: number, fontPath: string = '', note: number = 60, velocity: number = 100): void {
  try {
    SynthEngineModule.auditionVoice(presetIndex, fontPath, note, velocity);
  } catch (error) {
    console.error('[SynthEngine TS] Error en auditionVoicePreset:', error);
  }
}

export function auditionVoiceStop(note: number = 60): void {
  try {
    SynthEngineModule.auditionStop(note);
  } catch (error) {
    console.error('[SynthEngine TS] Error en auditionVoiceStop:', error);
  }
}

export function triggerNoteOn(note: number, velocity: number = 100): void {
  SynthEngineModule.noteOn(note, velocity);
}

export function triggerNoteOff(note: number): void {
  SynthEngineModule.noteOff(note);
}

// Métodos de Reproducción de Estilos Yamaha (.STY)
export function triggerStyleNoteOn(channel: number, note: number, velocity: number = 100, program: number = -1): void {
  SynthEngineModule.styleNoteOn(channel, note, velocity, program);
}

export function triggerStyleNoteOff(channel: number, note: number): void {
  SynthEngineModule.styleNoteOff(channel, note);
}

export function updateStyleMasterVolume(volume: number): void {
  SynthEngineModule.setStyleMasterVolume(volume);
}

export function stopAllStyleNotes(): void {
  SynthEngineModule.styleAllNotesOff();
}

// SECUENCIADOR NATIVO C++ DE PRECISIÓN DE MUESTRA (0.00ms JITTER)
export function resetNativeStyleData(): void {
  SynthEngineModule.clearStyleData();
}

export function setNativeStylePpq(ppq: number): void {
  SynthEngineModule.setStylePpq(ppq);
}

export function uploadNativeStyleSectionEvents(sectionName: string, totalTicks: number, eventsData: string): void {
  SynthEngineModule.loadStyleSectionEvents(sectionName, totalTicks, eventsData);
}

export function startNativeStylePlayback(bpm: number, accompanimentOn: boolean): void {
  SynthEngineModule.startStylePlayback(bpm, accompanimentOn);
}

export function stopNativeStylePlayback(): void {
  SynthEngineModule.stopStylePlayback();
}

export function setNativeStyleAccompaniment(enabled: boolean): void {
  SynthEngineModule.setStyleAccompaniment(enabled);
}

export function setNativeStyleBpm(bpm: number): void {
  SynthEngineModule.setStyleBpm(bpm);
}

export function setNativeStyleSection(section: string): void {
  SynthEngineModule.setStyleSection(section);
}

export function queueNativeStyleSection(section: string): void {
  SynthEngineModule.queueNextStyleSection(section);
}

export function fetchStylePlaybackState(): StylePlaybackState {
  try {
    return SynthEngineModule.getStylePlaybackState();
  } catch {
    return {
      isPlaying: false,
      currentBeat: 1,
      currentSection: 'MAIN_A',
      queuedSection: ''
    };
  }
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

export function checkBluetoothEnabled(): boolean {
  try {
    return SynthEngineModule.isBluetoothEnabled();
  } catch {
    return false;
  }
}

export function checkBleScanning(): boolean {
  try {
    return SynthEngineModule.isBleScanning();
  } catch {
    return false;
  }
}

export function triggerBleScan(): boolean {
  try {
    return SynthEngineModule.startBleScan();
  } catch {
    return false;
  }
}

export function cancelBleScan(): boolean {
  try {
    return SynthEngineModule.stopBleScan();
  } catch {
    return true;
  }
}

export function fetchDiscoveredBleDevices(): DiscoveredBleDeviceTS[] {
  try {
    return SynthEngineModule.getDiscoveredBleDevices();
  } catch {
    return [];
  }
}

export async function attachBleDevice(address: string): Promise<boolean> {
  try {
    return await SynthEngineModule.connectBleDevice(address);
  } catch {
    return false;
  }
}

export function detachMidi(): boolean {
  try {
    return SynthEngineModule.disconnectMidi();
  } catch {
    return false;
  }
}

export function fetchMidiDiagnostics(): any {
  try {
    return SynthEngineModule.getMidiDiagnostics();
  } catch {
    return {
      systemMidiDevices: [],
      usbHostDevices: [],
      isDirectUsbActive: false,
      openPortCount: 0,
      connectedDeviceName: 'Ninguno'
    };
  }
}

export function promptUsbPermission(): boolean {
  try {
    return SynthEngineModule.requestUsbPermission();
  } catch {
    return false;
  }
}

export { addMidiLogListener, addMidiNoteListener, StylePlaybackState, DiscoveredBleDeviceTS } from './SynthEngineModule';

export default SynthEngineModule;
