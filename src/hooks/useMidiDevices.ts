import { useState, useEffect, useCallback, useRef } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import {
  listMidiDevices,
  attachMidiDevice,
  checkBluetoothEnabled,
  checkBleScanning,
  requestBluetoothEnable,
  triggerBleScan,
  cancelBleScan,
  fetchDiscoveredBleDevices,
  attachBleDevice,
  detachMidi,
  fetchMidiDiagnostics,
} from '../../modules/synth-engine/src/index';
import {
  MidiDeviceInfoTS,
  DiscoveredBleDeviceTS,
  MidiDiagnosticsData,
} from '../../modules/synth-engine/src/SynthEngineModule';

export interface UseMidiDevicesReturn {
  devices: MidiDeviceInfoTS[];
  usbDevices: MidiDeviceInfoTS[];
  connectedUsbDevice: MidiDeviceInfoTS | undefined;
  connectedBleDevice: MidiDeviceInfoTS | undefined;
  connectedDeviceId: string | null;
  connectedDeviceName: string;
  isDirectUsbActive: boolean;
  isBluetoothEnabled: boolean;
  isScanningBle: boolean;
  discoveredBleDevices: DiscoveredBleDeviceTS[];
  diagnostics: MidiDiagnosticsData | null;
  scan: () => void;
  connect: (deviceId: string) => boolean;
  requestBluetoothPermissions: () => Promise<boolean>;
  startBleScan: () => Promise<boolean>;
  stopBleScan: () => void;
  connectBle: (address: string) => Promise<boolean>;
  disconnect: () => boolean;
}

const POLL_INTERVAL_MS = 1500;
const BLE_POLL_INTERVAL_MS = 600;

// Evita re-renderizar toda la app cuando el listado no cambió
function sameJson<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export const useMidiDevices = (): UseMidiDevicesReturn => {
  const [devices, setDevices] = useState<MidiDeviceInfoTS[]>([]);
  const [connectedDeviceId, setConnectedDeviceId] = useState<string | null>(null);
  const [isBluetoothEnabled, setIsBluetoothEnabled] = useState<boolean>(false);
  const [isScanningBle, setIsScanningBle] = useState<boolean>(false);
  const [discoveredBleDevices, setDiscoveredBleDevices] = useState<DiscoveredBleDeviceTS[]>([]);
  const [diagnostics, setDiagnostics] = useState<MidiDiagnosticsData | null>(null);

  const devicesRef = useRef<MidiDeviceInfoTS[]>([]);
  const bleListRef = useRef<DiscoveredBleDeviceTS[]>([]);
  const isScanningRef = useRef(false);

  const requestBluetoothPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    try {
      // Android 12+: "Dispositivos cercanos" es suficiente (sin ubicación)
      const required =
        Platform.Version >= 31
          ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
          : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
      const results = await PermissionsAndroid.requestMultiple(required as any);
      return required.every((p) => results[p] === PermissionsAndroid.RESULTS.GRANTED);
    } catch (err) {
      console.warn('[useMidiDevices] Error al solicitar permisos:', err);
      return false;
    }
  }, []);

  const refreshBleList = useCallback(() => {
    const bleList = fetchDiscoveredBleDevices();
    if (!sameJson(bleList, bleListRef.current)) {
      bleListRef.current = bleList;
      setDiscoveredBleDevices(bleList);
    }
  }, []);

  const scan = useCallback(() => {
    const list = listMidiDevices();
    if (!sameJson(list, devicesRef.current)) {
      devicesRef.current = list;
      setDevices(list);
    }
    setIsBluetoothEnabled(checkBluetoothEnabled());
    const scanning = checkBleScanning();
    isScanningRef.current = scanning;
    setIsScanningBle(scanning);
    if (scanning) refreshBleList();
  }, [refreshBleList]);

  const refreshDiagnostics = useCallback(() => {
    setDiagnostics(fetchMidiDiagnostics());
  }, []);

  const connect = useCallback(
    (deviceId: string) => {
      const success = attachMidiDevice(deviceId);
      if (success) setConnectedDeviceId(deviceId);
      // La apertura es asíncrona en Android: refrescar en breve
      setTimeout(scan, 800);
      return success;
    },
    [scan]
  );

  const startBleScan = useCallback(async (): Promise<boolean> => {
    // Bluetooth apagado: pedir al sistema que lo encienda y esperar hasta 20 s
    if (!checkBluetoothEnabled()) {
      if (!requestBluetoothEnable()) return false;
      const deadline = Date.now() + 20000;
      while (!checkBluetoothEnabled() && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 500));
      }
      setIsBluetoothEnabled(checkBluetoothEnabled());
      if (!checkBluetoothEnabled()) return false;
      await new Promise((r) => setTimeout(r, 800)); // el adaptador tarda en quedar listo
    }
    const started = triggerBleScan();
    if (started) {
      isScanningRef.current = true;
      setIsScanningBle(true);
      bleListRef.current = [];
      setDiscoveredBleDevices([]);
    }
    return started;
  }, []);

  const stopBleScan = useCallback(() => {
    cancelBleScan();
    isScanningRef.current = false;
    setIsScanningBle(false);
  }, []);

  const connectBle = useCallback(
    async (address: string): Promise<boolean> => {
      stopBleScan();
      const success = await attachBleDevice(address);
      scan();
      refreshBleList();
      refreshDiagnostics();
      return success;
    },
    [stopBleScan, scan, refreshBleList, refreshDiagnostics]
  );

  const disconnect = useCallback(() => {
    const result = detachMidi();
    setConnectedDeviceId(null);
    scan();
    refreshDiagnostics();
    return result;
  }, [scan, refreshDiagnostics]);

  useEffect(() => {
    scan();
    refreshDiagnostics();
    const interval = setInterval(scan, POLL_INTERVAL_MS);
    const bleInterval = setInterval(() => {
      if (isScanningRef.current) refreshBleList();
    }, BLE_POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      clearInterval(bleInterval);
    };
  }, [scan, refreshBleList, refreshDiagnostics]);

  const usbDevices = devices.filter((d) => d.type === 'USB');
  const connectedUsbDevice = usbDevices.find((d) => d.connected);
  const connectedBleDevice = devices.find((d) => d.type === 'BLUETOOTH' && d.connected);
  const connectedNames = devices.filter((d) => d.connected).map((d) => d.name);

  return {
    devices,
    usbDevices,
    connectedUsbDevice,
    connectedBleDevice,
    connectedDeviceId,
    connectedDeviceName: connectedNames.length > 0 ? connectedNames.join(', ') : 'Ninguno',
    isDirectUsbActive: diagnostics?.isDirectUsbActive ?? false,
    isBluetoothEnabled,
    isScanningBle,
    discoveredBleDevices,
    diagnostics,
    scan: () => {
      scan();
      refreshDiagnostics();
    },
    connect,
    requestBluetoothPermissions,
    startBleScan,
    stopBleScan,
    connectBle,
    disconnect,
  };
};
