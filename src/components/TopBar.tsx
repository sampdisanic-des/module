import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Text } from './AppText';
import { BluetoothIcon, MoonIcon, SunIcon, UsbCableIcon } from './Icons';
import { UseMidiDevicesReturn } from '../hooks/useMidiDevices';
import { UseArrangerReturn } from '../hooks/useArranger';
import { createThemedStyles, useTheme, useThemedStyles } from '../theme/ThemeContext';

interface TopBarProps {
  midi: Pick<UseMidiDevicesReturn, 'connectedBleDevice' | 'connectedUsbDevice' | 'isScanningBle'>;
  arranger: Pick<UseArrangerReturn, 'loadedStyle' | 'bpm' | 'setBpm' | 'isPlaying' | 'currentBeat'>;
  onMidiPress: () => void;
  onStylePress: () => void;
  isSustainOn: boolean;
  onToggleSustain: () => void;
  timeStr: string;
  batteryPercent: number;
}

/** Barra superior: teclado MIDI, ritmo, tempo, beat, sustain, tema, hora y batería */
export const TopBar: React.FC<TopBarProps> = ({
  midi,
  arranger,
  onMidiPress,
  onStylePress,
  isSustainOn,
  onToggleSustain,
  timeStr,
  batteryPercent,
}) => {
  const styles = useThemedStyles(themed);
  const { c, mode, toggleTheme } = useTheme();
  const { connectedBleDevice, connectedUsbDevice, isScanningBle } = midi;
  const { loadedStyle, bpm, setBpm, isPlaying, currentBeat } = arranger;

  const isConnected = !!(connectedBleDevice || connectedUsbDevice);
  const deviceLabel = connectedBleDevice?.name || connectedUsbDevice?.name || 'SIN TECLADO';

  return (
    <View style={styles.topBar}>
      {/* Indicador MIDI único: abre la conexión de teclados */}
      <TouchableOpacity
        activeOpacity={0.7}
        delayPressIn={0}
        delayPressOut={0}
        style={[styles.topMidiBtn, isConnected && styles.topMidiBtnConnected]}
        onPress={onMidiPress}
      >
        <View style={[styles.topMidiDot, isConnected ? styles.topMidiDotOn : isScanningBle && styles.topMidiDotScanning]} />
        {connectedUsbDevice && !connectedBleDevice ? (
          <UsbCableIcon size={12} color={c('#00E5FF')} />
        ) : (
          <BluetoothIcon size={12} color={c(isConnected ? '#00E5FF' : '#6B829D')} />
        )}
        <Text style={[styles.topMidiText, isConnected && styles.topMidiTextConnected]} numberOfLines={1}>
          {deviceLabel.toUpperCase()}
        </Text>
      </TouchableOpacity>

      {/* Ritmo cargado: abre la librería */}
      <TouchableOpacity activeOpacity={0.7} delayPressIn={0} delayPressOut={0} style={styles.topStyleBtn} onPress={onStylePress}>
        <Text style={styles.topStyleLabel}>RITMO</Text>
        <Text style={styles.topStyleName} numberOfLines={1}>
          {loadedStyle.name}
        </Text>
        <Text style={styles.topStyleChevron}>›</Text>
      </TouchableOpacity>

      {/* Tempo */}
      <View style={styles.topTempoBox}>
        <TouchableOpacity activeOpacity={0.7} delayPressIn={0} delayPressOut={0} style={styles.topTempoBtn} onPress={() => setBpm(bpm - 1)}>
          <Text style={styles.topTempoBtnText}>−</Text>
        </TouchableOpacity>
        <View style={styles.topTempoValueBox}>
          <Text style={styles.topTempoValue}>{bpm}</Text>
          <Text style={styles.topTempoUnit}>BPM</Text>
        </View>
        <TouchableOpacity activeOpacity={0.7} delayPressIn={0} delayPressOut={0} style={styles.topTempoBtn} onPress={() => setBpm(bpm + 1)}>
          <Text style={styles.topTempoBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Beat (el primer tiempo en rojo) */}
      <View style={styles.topBeatRow}>
        {[1, 2, 3, 4].map((b) => {
          const lit = isPlaying && currentBeat === b;
          return <View key={b} style={[styles.topBeatDot, lit && (b === 1 ? styles.topBeatDotDownbeat : styles.topBeatDotOn)]} />;
        })}
      </View>

      {/* Pedal de sustain virtual (el piano no envía CC64) */}
      <TouchableOpacity
        activeOpacity={0.7}
        delayPressIn={0}
        delayPressOut={0}
        style={[styles.topSustainBtn, isSustainOn && styles.topSustainBtnOn]}
        onPress={onToggleSustain}
      >
        <Text style={[styles.topSustainText, isSustainOn && styles.topSustainTextOn]}>SUSTAIN</Text>
      </TouchableOpacity>

      {/* Tema claro / oscuro */}
      <TouchableOpacity activeOpacity={0.7} delayPressIn={0} delayPressOut={0} style={styles.topThemeBtn} onPress={toggleTheme}>
        {mode === 'dark' ? <SunIcon size={16} color={c('#FFC400')} /> : <MoonIcon size={16} color={c('#B388FF')} />}
      </TouchableOpacity>

      <View style={styles.topSysInfo}>
        <Text style={styles.topSysText}>{timeStr}</Text>
        <Text style={styles.topSysText}>{batteryPercent}%</Text>
      </View>
    </View>
  );
};

const themed = createThemedStyles({
  topBar: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#101622',
    borderRadius: 8,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#192433',
  },
  topBeatDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#141D2A',
    borderWidth: 1,
    borderColor: '#1F2C3E',
  },
  topBeatDotDownbeat: {
    backgroundColor: '#FF1744',
    borderColor: '#FF8A80',
  },
  topBeatDotOn: {
    backgroundColor: '#00E5FF',
    borderColor: '#80F2FF',
  },
  topBeatRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 2,
  },
  topMidiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    maxWidth: 170,
    paddingHorizontal: 8,
    backgroundColor: '#06090E',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1A2636',
  },
  topMidiBtnConnected: {
    backgroundColor: '#071824',
    borderColor: '#00E5FF66',
  },
  topMidiDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FF5252',
  },
  topMidiDotOn: {
    backgroundColor: '#00E676',
  },
  topMidiDotScanning: {
    backgroundColor: '#2979FF',
  },
  topMidiText: {
    flexShrink: 1,
    color: '#6B829D',
    fontSize: 9,
    fontWeight: '800',
  },
  topMidiTextConnected: {
    color: '#00E5FF',
  },
  topStyleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 10,
    backgroundColor: '#0A111B',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1E2E44',
  },
  topStyleChevron: {
    color: '#00E5FF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: -2,
  },
  topStyleLabel: {
    color: '#4C6078',
    fontSize: 8,
    fontWeight: '900',
  },
  topStyleName: {
    flex: 1,
    color: '#E6F7FF',
    fontSize: 12,
    fontWeight: '800',
  },
  topSustainBtn: {
    height: 30,
    paddingHorizontal: 10,
    justifyContent: 'center',
    backgroundColor: '#0A121F',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1E2E44',
  },
  topSustainBtnOn: {
    backgroundColor: '#2A2205',
    borderColor: '#FFC400',
  },
  topSustainText: {
    color: '#8A9EB8',
    fontSize: 10,
    fontWeight: '900',
  },
  topSustainTextOn: {
    color: '#FFC400',
  },
  topSysInfo: {
    alignItems: 'flex-end',
    paddingLeft: 2,
  },
  topSysText: {
    color: '#5D7290',
    fontSize: 8,
    fontWeight: '800',
  },
  topTempoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    backgroundColor: '#06090E',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1A2636',
  },
  topTempoBtn: {
    width: 30,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topTempoBtnText: {
    color: '#00E5FF',
    fontSize: 16,
    fontWeight: '900',
  },
  topTempoUnit: {
    color: '#5D7290',
    fontSize: 7,
    fontWeight: '900',
  },
  topTempoValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  topTempoValueBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    minWidth: 58,
    justifyContent: 'center',
  },
  topThemeBtn: {
    width: 32,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A121F',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1E2E44',
  },
});
