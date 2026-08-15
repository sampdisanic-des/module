import { useState, useEffect, useCallback, useRef } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import {
  listMidiDevices,
  attachMidiDevice,
  checkBluetoothEnabled,
  checkBleScanning,
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

export const useMidiDevices = (): UseMidiDevicesReturn => {
  const [devices, setDevices] = useState<MidiDeviceInfoTS[]>([]);
  const [connectedDeviceId, setConnectedDeviceId] = useState<string | null>(null);
  const [connectedDeviceName, setConnectedDeviceName] = useState<string>('Ninguno');
  const [isDirectUsbActive, setIsDirectUsbActive] = useState<boolean>(false);
  const [isBluetoothEnabled, setIsBluetoothEnabled] = useState<boolean>(false);
  const [isScanningBle, setIsScanningBle] = useState<boolean>(false);
  const [discoveredBleDevices, setDiscoveredBleDevices] = useState<DiscoveredBleDeviceTS[]>([]);
  const [diagnostics, setDiagnostics] = useState<MidiDiagnosticsData | null>(null);

  const isScanningRef = useRef(false);

  const requestBluetoothPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;

    try {
      const permissionsToRequest: any[] = [];

      if (Platform.Version >= 31) {
        permissionsToRequest.push(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
        );
      }
      permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);

      const grantedResults = await PermissionsAndroid.requestMultiple(permissionsToRequest);

      const allGranted = Object.values(grantedResults).every(
        (val) => val === PermissionsAndroid.RESULTS.GRANTED
      );

      return allGranted;
    } catch (err) {
      console.warn('[useMidiDevices] Error al solicitar permisos:', err);
      return false;
    }
  }, []);

  const scan = useCallback(() => {
    const list = listMidiDevices();
    setDevices(list);

    const isBt = checkBluetoothEnabled();
    setIsBluetoothEnabled(isBt);

    const isScanning = checkBleScanning();
    setIsScanningBle(isScanning);
    isScanningRef.current = isScanning;

    if (isScanning) {
      const bleList = fetchDiscoveredBleDevices();
      setDiscoveredBleDevices(bleList);
    }

    const diag = fetchMidiDiagnostics();
    setDiagnostics(diag);
    if (diag) {
      setConnectedDeviceName(diag.connectedDeviceName || 'Ninguno');
      setIsDirectUsbActive(diag.isDirectUsbActive || false);
    }
  }, []);

  const connect = useCallback((deviceId: string) => {
    const success = attachMidiDevice(deviceId);
    if (success) {
      setConnectedDeviceId(deviceId);
      scan();
    }
    return success;
  }, [scan]);

  const startBleScan = useCallback(async (): Promise<boolean> => {
    const hasPermissions = await requestBluetoothPermissions();
    if (!hasPermissions) {
      console.warn('[useMidiDevices] Permisos Bluetooth / Ubicación denegados');
      return false;
    }

    const started = triggerBleScan();
    if (started) {
      setIsScanningBle(true);
      isScanningRef.current = true;
      setDiscoveredBleDevices([]);
    }
    return started;
  }, [requestBluetoothPermissions]);

  const stopBleScan = useCallback(() => {
    cancelBleScan();
    setIsScanningBle(false);
    isScanningRef.current = false;
  }, []);

  const connectBle = useCallback(async (address: string): Promise<boolean> => {
    stopBleScan();
    const success = await attachBleDevice(address);
    if (success) {
      scan();
    }
    return success;
  }, [stopBleScan, scan]);

  const disconnect = useCallback(() => {
    const result = detachMidi();
    setConnectedDeviceId(null);
    setConnectedDeviceName('Ninguno');
    scan();
    return result;
  }, [scan]);

  // Polling regular de dispositivos y actualización rápida mientras se escanea BLE
  useEffect(() => {
    scan();
    const interval = setInterval(() => {
      scan();
      if (isScanningRef.current) {
        const bleList = fetchDiscoveredBleDevices();
        setDiscoveredBleDevices(bleList);
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [scan]);

  const usbDevices = devices.filter((d) => d.type === 'USB');

  return {
    devices,
    usbDevices,
    connectedDeviceId,
    connectedDeviceName,
    isDirectUsbActive,
    isBluetoothEnabled,
    isScanningBle,
    discoveredBleDevices,
    diagnostics,
    scan,
    connect,
    requestBluetoothPermissions,
    startBleScan,
    stopBleScan,
    connectBle,
    disconnect,
  };
};
