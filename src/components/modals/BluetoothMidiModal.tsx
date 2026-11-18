import React from 'react';
import { Modal, ScrollView, TouchableOpacity, View } from 'react-native';
import { Text } from '../AppText';
import { BluetoothIcon, CloseIcon, RefreshIcon, SignalBarsIcon } from '../Icons';
import { UseMidiDevicesReturn } from '../../hooks/useMidiDevices';
import { BluetoothModalApi } from '../../hooks/useBluetoothModal';
import { createThemedStyles, useTheme, useThemedStyles } from '../../theme/ThemeContext';
import { useModalStyles } from './modalStyles';

interface BluetoothMidiModalProps {
  midi: Pick<UseMidiDevicesReturn, 'connectedBleDevice' | 'isScanningBle' | 'isBluetoothEnabled' | 'discoveredBleDevices'>;
  ble: BluetoothModalApi;
}

/** Búsqueda y conexión de teclados MIDI por Bluetooth LE */
export const BluetoothMidiModal: React.FC<BluetoothMidiModalProps> = ({ midi, ble }) => {
  const styles = useThemedStyles(themed);
  const modal = useModalStyles();
  const { c } = useTheme();
  const { connectedBleDevice, isScanningBle, isBluetoothEnabled, discoveredBleDevices } = midi;

  return (
    <Modal
      visible={ble.visible}
      animationType="fade"
      transparent={true}
      onRequestClose={ble.close}
    >
      <View style={modal.overlay}>
        <View style={styles.bleModalBox}>
          {/* Header del Modal */}
          <View style={styles.bleModalHeader}>
            <View style={styles.bleModalHeaderLeft}>
              <View style={styles.bleIconCircle}>
                <BluetoothIcon size={16} color={c('#00E5FF')} />
              </View>
              <View>
                <Text style={styles.bleModalTitle}>CONEXIÓN BLUETOOTH MIDI</Text>
                <Text style={styles.bleModalSubtitle}>Soporte para M-Vave, CME, Korg, Roland BLE</Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.bleModalCloseBtn}
              onPress={ble.close}
            >
              <CloseIcon size={12} color={c('#8A9EB8')} />
            </TouchableOpacity>
          </View>

          {/* Barra de Estado y Botón de Escaneo */}
          <View style={styles.bleStatusBarCard}>
            <View style={styles.bleStatusInfoCol}>
              <View style={styles.bleStatusRow}>
                <View
                  style={[
                    styles.bleLedIndicator,
                    connectedBleDevice
                      ? styles.bleLedConnected
                      : isScanningBle
                      ? styles.bleLedScanning
                      : styles.bleLedIdle,
                  ]}
                />
                <Text style={styles.bleStatusText}>
                  {connectedBleDevice
                    ? `CONECTADO: ${connectedBleDevice.name.toUpperCase()}`
                    : isScanningBle
                    ? 'ESCANEANDO DISPOSITIVOS CERCANOS...'
                    : isBluetoothEnabled
                    ? 'BLUETOOTH ACTIVO (LISTO PARA ESCANEAR)'
                    : 'BLUETOOTH DESACTIVADO'}
                </Text>
              </View>

              {connectedBleDevice && (
                <Text style={styles.bleLatencyText}>Latencia estimada: Ultra-baja (~8-12ms)</Text>
              )}
            </View>

            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              {connectedBleDevice && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.bleDisconnectBtn}
                  onPress={ble.disconnect}
                >
                  <Text style={styles.bleDisconnectBtnText}>DESCONECTAR</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles.bleScanToggleBtn,
                  isScanningBle && styles.bleScanToggleBtnActive,
                ]}
                onPress={ble.toggleScan}
              >
                <RefreshIcon size={12} color={c(isScanningBle ? '#FF5252' : '#000000')} />
                <Text
                  style={[
                    styles.bleScanToggleBtnText,
                    isScanningBle && styles.bleScanToggleBtnTextActive,
                  ]}
                >
                  {isScanningBle ? 'DETENER' : 'BUSCAR TECLADOS'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Contenedor de Lista de Dispositivos Detectados */}
          <View style={styles.bleDevicesListContainer}>
            <View style={styles.bleDevicesListHeader}>
              <Text style={styles.bleDevicesListTitle}>
                DISPOSITIVOS DETECTADOS ({discoveredBleDevices.length})
              </Text>
              {isScanningBle && <Text style={styles.bleScanningDotPulse}>Buscando...</Text>}
            </View>

            <ScrollView
              style={styles.bleDevicesScrollView}
              contentContainerStyle={styles.bleDevicesScrollContent}
              showsVerticalScrollIndicator={true}
            >
              {discoveredBleDevices.length === 0 ? (
                <View style={styles.bleEmptyContainer}>
                  <Text style={styles.bleEmptyTitle}>
                    {isScanningBle
                      ? 'Buscando teclados Bluetooth cercanos...'
                      : 'No se han buscado dispositivos aún'}
                  </Text>
                  <Text style={styles.bleEmptyDesc}>
                    Asegúrate de que tu teclado M-Vave esté encendido y que el botón BT esté parpadeando rápidamente en azul.
                  </Text>
                </View>
              ) : (
                discoveredBleDevices.map((dev) => {
                  const isCurrent = dev.isConnected;
                  const isConnecting = ble.connectingAddress === dev.address;

                  return (
                    <View
                      key={dev.address}
                      style={[
                        styles.bleDeviceCard,
                        isCurrent && styles.bleDeviceCardActive,
                      ]}
                    >
                      <View style={styles.bleDeviceCardLeft}>
                        <View style={[styles.bleDeviceIconBox, isCurrent && styles.bleDeviceIconBoxActive]}>
                          <BluetoothIcon size={14} color={c(isCurrent ? '#00E5FF' : '#7187A1')} />
                        </View>
                        <View>
                          <Text style={[styles.bleDeviceName, isCurrent && styles.bleDeviceNameActive]}>
                            {dev.name}
                          </Text>
                          <View style={styles.bleDeviceMetaRow}>
                            <Text style={styles.bleDeviceAddress}>{dev.address}</Text>
                            <View style={styles.bleDeviceRssiBox}>
                              <SignalBarsIcon rssi={dev.rssi} size={11} />
                              <Text style={styles.bleDeviceRssiText}>{dev.rssi} dBm</Text>
                            </View>
                          </View>
                        </View>
                      </View>

                      <View style={styles.bleDeviceCardRight}>
                        {isCurrent ? (
                          <View style={styles.bleConnectedBadge}>
                            <View style={styles.bleDotGreenMini} />
                            <Text style={styles.bleConnectedBadgeText}>CONECTADO</Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            activeOpacity={0.7}
                            disabled={isConnecting}
                            style={[
                              styles.bleConnectCardBtn,
                              isConnecting && styles.bleConnectCardBtnDisabled,
                            ]}
                            onPress={() => ble.connectDevice(dev)}
                          >
                            <Text style={styles.bleConnectCardBtnText}>
                              {isConnecting ? 'CONECTANDO...' : 'CONECTAR'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>

          {/* Footer con Tips de Ayuda Rápida */}
          <View style={styles.bleModalFooter}>
            <Text style={styles.bleFooterTipText}>
              Tip para M-Vave (SMK-25 / SMC-PAD): Mantén presionado el botón BT durante 3 segundos hasta que la luz azul parpadee rápido para entrar en modo emparejamiento.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const themed = createThemedStyles({
  bleConnectCardBtn: {
    backgroundColor: '#00E5FF',
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bleConnectCardBtnDisabled: {
    backgroundColor: '#2A3C4E',
  },
  bleConnectCardBtnText: {
    color: '#000000',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bleConnectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#06291C',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#00E676',
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 4,
  },
  bleConnectedBadgeText: {
    color: '#00E676',
    fontSize: 6.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bleDeviceAddress: {
    color: '#5C7491',
    fontSize: 6.5,
    fontWeight: '700',
  },
  bleDeviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0C1320',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#192639',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  bleDeviceCardActive: {
    backgroundColor: '#081D2E',
    borderColor: '#00E5FF88',
  },
  bleDeviceCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  bleDeviceCardRight: {
    marginLeft: 8,
  },
  bleDeviceIconBox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#121C2B',
    borderWidth: 1,
    borderColor: '#1C2E44',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bleDeviceIconBoxActive: {
    backgroundColor: '#0C2B3F',
    borderColor: '#00E5FF',
  },
  bleDeviceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  bleDeviceName: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  bleDeviceNameActive: {
    color: '#00E5FF',
  },
  bleDeviceRssiBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  bleDeviceRssiText: {
    color: '#5C7491',
    fontSize: 6.5,
    fontWeight: '700',
  },
  bleDevicesListContainer: {
    minHeight: 120,
    maxHeight: 165,
    backgroundColor: '#070C14',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#152233',
    padding: 6,
  },
  bleDevicesListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#121D2C',
    marginBottom: 4,
  },
  bleDevicesListTitle: {
    color: '#6F87A3',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bleDevicesScrollContent: {
    gap: 4,
    paddingBottom: 4,
  },
  bleDevicesScrollView: {
    flex: 1,
  },
  bleDisconnectBtn: {
    backgroundColor: '#2A0D12',
    borderWidth: 1,
    borderColor: '#FF5252',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  bleDisconnectBtnText: {
    color: '#FF5252',
    fontSize: 7.5,
    fontWeight: '900',
  },
  bleDotGreenMini: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#00E676',
  },
  bleEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  bleEmptyDesc: {
    color: '#526982',
    fontSize: 7,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 11,
  },
  bleEmptyTitle: {
    color: '#A0B2C6',
    fontSize: 8.5,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  bleFooterTipText: {
    color: '#526982',
    fontSize: 6.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  bleIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0C2032',
    borderWidth: 1,
    borderColor: '#00E5FF66',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bleLatencyText: {
    color: '#00E676',
    fontSize: 7,
    fontWeight: '700',
    marginTop: 2,
    marginLeft: 14,
  },
  bleLedConnected: {
    backgroundColor: '#00E676',
  },
  bleLedIdle: {
    backgroundColor: '#50637A',
  },
  bleLedIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bleLedScanning: {
    backgroundColor: '#00E5FF',
  },
  bleModalBox: {
    width: '92%',
    maxWidth: 580,
    maxHeight: '92%',
    backgroundColor: '#090F1A',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#00E5FF44',
    padding: 12,
    shadowColor: '#00E5FF',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 20,
  },
  bleModalCloseBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#121A26',
    borderWidth: 1,
    borderColor: '#223347',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bleModalFooter: {
    marginTop: 6,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: '#121D2C',
  },
  bleModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#162232',
    paddingBottom: 8,
    marginBottom: 8,
  },
  bleModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bleModalSubtitle: {
    color: '#657E9A',
    fontSize: 7.5,
    fontWeight: '600',
    marginTop: 1,
  },
  bleModalTitle: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  bleScanToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00E5FF',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 5,
  },
  bleScanToggleBtnActive: {
    backgroundColor: '#1E1217',
    borderWidth: 1,
    borderColor: '#FF5252',
  },
  bleScanToggleBtnText: {
    color: '#000000',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bleScanToggleBtnTextActive: {
    color: '#FF5252',
  },
  bleScanningDotPulse: {
    color: '#00E5FF',
    fontSize: 7,
    fontWeight: '800',
  },
  bleStatusBarCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#060B12',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#152438',
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 8,
  },
  bleStatusInfoCol: {
    flex: 1,
    marginRight: 8,
  },
  bleStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bleStatusText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
