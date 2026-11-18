import { useState } from 'react';
import { UseMidiDevicesReturn } from './useMidiDevices';
import { ShowAlert } from './useConsoleAlert';

/** Apertura del modal de teclados Bluetooth MIDI, escaneo y conexión */
export const useBluetoothModal = (midi: UseMidiDevicesReturn, showAlert: ShowAlert) => {
  const [visible, setVisible] = useState<boolean>(false);
  const [connectingAddress, setConnectingAddress] = useState<string | null>(null);

  const startScan = async () => {
    const granted = await midi.requestBluetoothPermissions();
    if (!granted) {
      showAlert(
        'WARNING',
        'PERMISOS BLUETOOTH REQUERIDOS',
        'Se requiere el permiso de Dispositivos Cercanos para buscar teclados Bluetooth.'
      );
      return;
    }
    const started = await midi.startBleScan();
    if (!started) {
      showAlert('WARNING', 'BLUETOOTH APAGADO', 'Activa el Bluetooth del teléfono para buscar teclados MIDI inalámbricos.');
    }
  };

  /** Abre el modal: busca también teclados USB y empieza a escanear Bluetooth */
  const open = () => {
    midi.scan();
    setVisible(true);
    startScan();
  };

  const close = () => {
    setVisible(false);
    midi.stopBleScan();
  };

  const toggleScan = () => {
    if (midi.isScanningBle) midi.stopBleScan();
    else startScan();
  };

  const connectDevice = async (dev: { address: string; name: string }) => {
    setConnectingAddress(dev.address);
    const ok = await midi.connectBle(dev.address);
    setConnectingAddress(null);
    if (ok) {
      showAlert('SUCCESS', 'TECLADO CONECTADO', `Teclado "${dev.name}" enlazado y listo para tocar por Bluetooth.`);
    } else {
      showAlert(
        'ERROR',
        'ERROR DE CONEXIÓN',
        `No se pudo conectar a "${dev.name}". Asegúrate de que no esté conectado a otro teléfono o computadora y que el botón BT esté parpadeando.`
      );
    }
  };

  const disconnect = () => {
    midi.disconnect();
    showAlert('INFO', 'DESCONECTADO', 'Dispositivo MIDI desconectado.');
  };

  return { visible, open, close, toggleScan, connectDevice, disconnect, connectingAddress };
};

export type BluetoothModalApi = ReturnType<typeof useBluetoothModal>;
