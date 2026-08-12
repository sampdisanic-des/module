import { useState, useEffect, useCallback } from 'react';
import {
  listMidiDevices,
  attachMidiDevice,
} from '../../modules/synth-engine/src/index';
import { MidiDeviceInfoTS } from '../../modules/synth-engine/src/SynthEngineModule';

export interface UseMidiDevicesReturn {
  devices: MidiDeviceInfoTS[];
  connectedDeviceId: string | null;
  scan: () => void;
  connect: (deviceId: string) => boolean;
}

export const useMidiDevices = (): UseMidiDevicesReturn => {
  const [devices, setDevices] = useState<MidiDeviceInfoTS[]>([]);
  const [connectedDeviceId, setConnectedDeviceId] = useState<string | null>(null);

  const scan = useCallback(() => {
    const list = listMidiDevices();
    setDevices(list);
  }, []);

  const connect = useCallback((deviceId: string) => {
    const success = attachMidiDevice(deviceId);
    if (success) {
      setConnectedDeviceId(deviceId);
    }
    return success;
  }, []);

  useEffect(() => {
    scan();
    // Re-escanear dispositivos cada 3 segundos
    const interval = setInterval(scan, 3000);
    return () => clearInterval(interval);
  }, [scan]);

  return {
    devices,
    connectedDeviceId,
    scan,
    connect,
  };
};
