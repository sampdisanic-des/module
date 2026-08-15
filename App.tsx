import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  LayoutChangeEvent,
  Modal,
  ScrollView,
  Alert,
  TextInput,
  BackHandler,
} from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Text as SvgText, Line } from 'react-native-svg';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Battery from 'expo-battery';
import { useSynthEngine } from './src/hooks/useSynthEngine';
import { useMidiDevices } from './src/hooks/useMidiDevices';
import { useArranger } from './src/hooks/useArranger';
import SoundLibraryService, { CustomVoicePreset } from './src/services/soundLibraryService';
import BankMemoryService, { MemoryBanksCatalog, MemoryBankPreset } from './src/services/bankMemoryService';
import StyleLibraryService from './src/services/styleLibraryService';
import { fetchChannelLevels } from './modules/synth-engine/src';

export const STYLE_CATEGORIES = ['ALL', 'LATIN', 'POP', 'ROCK', 'BALLAD', 'CUMBIA', 'DANCE', 'CUSTOM'];
export const VOICE_CATEGORIES = ['ALL', 'PIANO', 'PADS', 'STRINGS', 'LEADS', 'BRASS', 'ORGAN', 'BASS', 'CUSTOM'];

// ================= ICONOS VECTORIALES SVG =================
const SearchIcon = ({ size = 13, color = '#7187A1' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2.5" />
    <Line x1="16.5" y1="16.5" x2="21.5" y2="21.5" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
  </Svg>
);

const BluetoothIcon = ({ size = 13, color = '#00E5FF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M7 7L17 17L12 22V2L17 7L7 17"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const UsbCableIcon = ({ size = 13, color = '#7187A1' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2V14M8 6H16V10C16 12.2091 14.2091 14 12 14C9.79086 14 8 12.2091 8 10V6ZM10 2V6M14 2V6M12 14V22"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx="12" cy="20" r="1.5" fill={color} />
  </Svg>
);

const SignalBarsIcon = ({ rssi = -60, size = 12 }: { rssi?: number; size?: number }) => {
  // rssi: > -60 (4 bars), > -75 (3 bars), > -90 (2 bars), <= -90 (1 bar)
  const bars = rssi > -60 ? 4 : rssi > -75 ? 3 : rssi > -90 ? 2 : 1;
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Line x1="2" y1="13" x2="2" y2="10" stroke={bars >= 1 ? '#00E5FF' : '#23384D'} strokeWidth="2" strokeLinecap="round" />
      <Line x1="6" y1="13" x2="6" y2="7.5" stroke={bars >= 2 ? '#00E5FF' : '#23384D'} strokeWidth="2" strokeLinecap="round" />
      <Line x1="10" y1="13" x2="10" y2="5" stroke={bars >= 3 ? '#00E5FF' : '#23384D'} strokeWidth="2" strokeLinecap="round" />
      <Line x1="14" y1="13" x2="14" y2="2" stroke={bars >= 4 ? '#00E5FF' : '#23384D'} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
};

const RefreshIcon = ({ size = 12, color = '#00E5FF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M21 12A9 9 0 006 5.3L3 8M3 3V8H8M3 12A9 9 0 0018 18.7L21 16M21 21V16H16"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const BackArrowIcon = ({ size = 16, color = '#00E5FF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M19 12H5M5 12L12 19M5 12L12 5" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const PlusIcon = ({ size = 15, color = '#000000' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 5V19M5 12H19" stroke={color} strokeWidth="2.8" strokeLinecap="round" />
  </Svg>
);

const EditIcon = ({ size = 13, color = '#8A9EB8' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M11 4H4C3.44772 4 3 4.44772 3 5V20C3 20.5523 3.44772 21 4 21H19C19.5523 21 20 20.5523 20 20V13" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Path d="M18.5 2.5C19.3284 1.67157 20.6716 1.67157 21.5 2.5C22.3284 3.32843 22.3284 4.67157 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const TrashIcon = ({ size = 13, color = '#FF5252' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 6H21M19 6V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20V6M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6M10 11V17M14 11V17" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const CloseIcon = ({ size = 10, color = '#8A9EB8' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M18 6L6 18M6 6L18 18" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const AssignIcon = ({ size = 14, color = '#00E5FF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M20 6L9 17L4 12" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const matchStyleCategory = (styleCat?: string, styleName?: string, selectedCat?: string): boolean => {
  if (!selectedCat || selectedCat === 'ALL') return true;
  const sel = selectedCat.trim().toUpperCase();
  const cat = (styleCat || '').trim().toUpperCase();
  const name = (styleName || '').trim().toUpperCase();

  if (cat === sel) return true;
  if (sel === 'CUSTOM') return cat === 'CUSTOM' || name.includes('CUSTOM');
  if (sel === 'CUMBIA') return cat === 'CUMBIA' || cat === 'LATIN' || name.includes('CUMBIA');
  if (sel === 'LATIN') return cat === 'LATIN' || cat === 'CUMBIA' || name.includes('SALSA') || name.includes('BACHATA') || name.includes('CUMBIA') || name.includes('MERENGUE') || name.includes('REGGAETON') || name.includes('BOLERO') || name.includes('LATIN');
  if (sel === 'POP') return cat === 'POP' || name.includes('POP') || name.includes('GROOVE') || name.includes('8-BEAT') || name.includes('16-BEAT') || name.includes('BEAT');
  if (sel === 'ROCK') return cat === 'ROCK' || name.includes('ROCK') || name.includes('METAL') || name.includes('PUNK');
  if (sel === 'BALLAD') return cat === 'BALLAD' || name.includes('BALLAD') || name.includes('SLOW') || name.includes('LOVE');
  if (sel === 'DANCE') return cat === 'DANCE' || name.includes('DANCE') || name.includes('DISCO') || name.includes('EDM') || name.includes('HOUSE') || name.includes('TECHNO');

  return cat.includes(sel) || name.includes(sel);
};

export interface VoicePreset {
  id: string;
  name: string;
  category: 'PIANO' | 'PADS' | 'STRINGS' | 'LEADS' | 'BRASS' | 'ORGAN' | 'BASS';
  sf2Path: string;
  sf2Preset: number;
  isCustom?: boolean;
}

const VOICE_LIBRARY: VoicePreset[] = [
  { id: 'v1', name: 'Yamaha CFX Grand', category: 'PIANO', sf2Path: 'soundfonts/yamaha_cfx_grand.sf2', sf2Preset: 0 },
  { id: 'v2', name: 'DX7 E-Piano Vintage', category: 'PIANO', sf2Path: 'soundfonts/dx7_epiano.sf2', sf2Preset: 4 },
  { id: 'v3', name: 'Suitcase Mark II Rhodes', category: 'PIANO', sf2Path: 'soundfonts/rhodes_mark2.sf2', sf2Preset: 5 },
  { id: 'v4', name: 'Ambient Pad Warm', category: 'PADS', sf2Path: 'soundfonts/ambient_pad.sf2', sf2Preset: 89 },
  { id: 'v5', name: 'Ethereal Space Choir', category: 'PADS', sf2Path: 'soundfonts/space_choir.sf2', sf2Preset: 91 },
  { id: 'v6', name: 'Syn Strings Symphony', category: 'STRINGS', sf2Path: 'soundfonts/strings_symphony.sf2', sf2Preset: 48 },
  { id: 'v7', name: 'Chamber Solo Violin', category: 'STRINGS', sf2Path: 'soundfonts/solo_violin.sf2', sf2Preset: 40 },
  { id: 'v8', name: 'Synth Lead Moog Saw', category: 'LEADS', sf2Path: 'soundfonts/moog_saw.sf2', sf2Preset: 81 },
  { id: 'v9', name: 'Square Wave Retro Lead', category: 'LEADS', sf2Path: 'soundfonts/square_retro.sf2', sf2Preset: 80 },
  { id: 'v10', name: 'Pop Brass Horn Section', category: 'BRASS', sf2Path: 'soundfonts/pop_brass.sf2', sf2Preset: 61 },
  { id: 'v11', name: 'French Horn Ensemble', category: 'BRASS', sf2Path: 'soundfonts/french_horns.sf2', sf2Preset: 60 },
  { id: 'v12', name: 'B3 Drawbar Hammond Organ', category: 'ORGAN', sf2Path: 'soundfonts/b3_organ.sf2', sf2Preset: 16 },
  { id: 'v13', name: 'Pipe Cathedral Organ', category: 'ORGAN', sf2Path: 'soundfonts/pipe_organ.sf2', sf2Preset: 19 },
  { id: 'v14', name: 'Fender Jazz Bass', category: 'BASS', sf2Path: 'soundfonts/jazz_bass.sf2', sf2Preset: 33 },
  { id: 'v15', name: 'Sub Synth Bass 808', category: 'BASS', sf2Path: 'soundfonts/sub_bass_808.sf2', sf2Preset: 38 },
];

// ===================================================
// FADER HORIZONTAL PROFESIONAL 3D (HARDWARE CONSOLE)
// ===================================================
interface HorizontalFaderProps {
  label: string;
  value: number; // 0..100
  onChange: (val: number) => void;
  color?: string;
  icon?: string;
}

const HorizontalFader: React.FC<HorizontalFaderProps> = ({
  label,
  value,
  onChange,
  color = '#00E5FF',
  icon,
}) => {
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const trackWidth = useRef(140);
  const startVal = useRef(value);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        startVal.current = valueRef.current;
      },
      onPanResponderMove: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const deltaPercent = (gestureState.dx / trackWidth.current) * 100;
        const newVal = Math.min(Math.max(startVal.current + deltaPercent, 0), 100);
        onChangeRef.current(Math.round(newVal));
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: () => {},
    })
  ).current;

  const handleTrackLayout = (e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width || 140;
  };

  return (
    <View style={styles.hFaderWrapper}>
      <View style={styles.hFaderHeaderRow}>
        <Text style={styles.hFaderLabel}>{label}</Text>
        <Text style={[styles.hFaderValText, { color }]}>{value}%</Text>
      </View>

      <View
        style={styles.hFaderTrackRowContainer}
        onLayout={handleTrackLayout}
        {...panResponder.panHandlers}
      >
        {icon && <Text style={[styles.hFaderIconText, { color }]}>{icon}</Text>}
        <View style={styles.hFaderTrackSlot}>
          <View style={styles.hFaderGrooveLine} />
          <View style={[styles.hFaderFillBar, { width: `${value}%`, backgroundColor: color }]} />
          {/* Cap de Mezcladora Hardware 3D */}
          <View
            style={[
              styles.hFaderMasterCap3D,
              { left: `${Math.min(Math.max(value, 0), 91)}%`, borderColor: color },
            ]}
          >
            <View style={[styles.hFaderCapGlowLine, { backgroundColor: color }]} />
          </View>
        </View>
      </View>
    </View>
  );
};

// ===================================================
// FADER VERTICAL AGRANDADO PARA CUTOFF EN ENVELOPE
// ===================================================
interface MiniVerticalFaderProps {
  label: string;
  value: number; // 0..100
  color?: string;
  onChange: (val: number) => void;
}

const MiniVerticalFader: React.FC<MiniVerticalFaderProps> = ({
  label,
  value,
  color = '#00E5FF',
  onChange,
}) => {
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const startVal = useRef(value);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        startVal.current = valueRef.current;
      },
      onPanResponderMove: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const deltaPercent = -gestureState.dy / 0.8;
        const newVal = Math.min(Math.max(startVal.current + deltaPercent, 0), 100);
        onChangeRef.current(Math.round(newVal));
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: () => {},
    })
  ).current;

  return (
    <View style={styles.miniFaderCol}>
      <Text style={styles.miniFaderLabel}>{label}</Text>
      <View style={styles.miniFaderTrack} {...panResponder.panHandlers}>
        <View style={styles.miniFaderCenterLine} />
        <View style={[styles.miniFaderFill, { height: `${value}%`, backgroundColor: color }]} />
        <View
          style={[
            styles.miniFaderCap3D,
            { bottom: `${Math.min(Math.max(value, 0), 84)}%`, borderColor: color },
          ]}
        >
          <View style={[styles.miniFaderCapLine, { backgroundColor: color }]} />
        </View>
      </View>
      <Text style={[styles.miniFaderValText, { color }]}>{value}%</Text>
    </View>
  );
};

// ===================================================
// MEDIDOR VU DINÁMICO AISLADO POR CANAL (0ms UI LATENCY)
// ===================================================
const ChannelVuMeter: React.FC<{ channelIndex: number; mute: boolean }> = React.memo(({ channelIndex, mute }) => {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (mute) {
      setLevel(0);
      return;
    }
    const interval = setInterval(() => {
      try {
        const raw = fetchChannelLevels();
        if (Array.isArray(raw) && raw.length > channelIndex) {
          const val = Math.min(100, Math.round(raw[channelIndex] * 100));
          setLevel(val);
        }
      } catch (e) {}
    }, 45);

    return () => clearInterval(interval);
  }, [channelIndex, mute]);

  return (
    <View style={styles.vuMeterContainer}>
      {[...Array(14)].map((_, i) => {
        const levelThreshold = ((13 - i) / 13) * 100;
        const isLit = !mute && level >= levelThreshold;
        let ledColor = '#00E676';
        if (i < 3) ledColor = '#FF3D00';
        else if (i < 6) ledColor = '#FFEA00';

        return (
          <View
            key={i}
            style={[
              styles.vuLedSegment,
              { backgroundColor: isLit ? ledColor : '#0E141F' },
            ]}
          />
        );
      })}
    </View>
  );
});

// ===================================================
// FADER VERTICAL RECTO Y DELGADO DE CANAL
// ===================================================
interface ConsoleFaderProps {
  id: number;
  name: string;
  value: number;
  solo: boolean;
  mute: boolean;
  isSelected: boolean;
  isPlaying: boolean;
  onSelect: (id: number) => void;
  onChange: (id: number, val: number) => void;
  onToggleSolo: (id: number) => void;
  onToggleMute: (id: number) => void;
}

const ConsoleFader: React.FC<ConsoleFaderProps> = ({
  id,
  name,
  value,
  solo,
  mute,
  isSelected,
  isPlaying,
  onSelect,
  onChange,
  onToggleSolo,
  onToggleMute,
}) => {
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const startVal = useRef(value);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        onSelect(id);
        startVal.current = valueRef.current;
      },
      onPanResponderMove: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const deltaPercent = -gestureState.dy / 1.3;
        const newVal = Math.min(Math.max(startVal.current + deltaPercent, 0), 100);
        onChangeRef.current(id, Math.round(newVal));
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: () => {},
    })
  ).current;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      delayPressIn={0}
      delayPressOut={0}
      style={[
        styles.faderChannelCard,
        isSelected && styles.faderChannelCardSelected,
      ]}
      onPress={() => onSelect(id)}
    >
      <Text style={[styles.faderHeaderTitle, isSelected && styles.faderHeaderTitleSelected]}>
        FADER {id}
      </Text>
      <Text style={styles.faderVoiceName} numberOfLines={3}>
        {name}
      </Text>

      {/* Solo / Mute */}
      <View style={styles.soloMuteRow}>
        <TouchableOpacity
          activeOpacity={0.7}
          delayPressIn={0}
          delayPressOut={0}
          style={[styles.pillBtnSolo, solo && styles.pillBtnSoloActive]}
          onPress={() => {
            onSelect(id);
            onToggleSolo(id);
          }}
        >
          <Text style={[styles.pillBtnText, solo && styles.pillBtnTextActive]}>SOLO</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          delayPressIn={0}
          delayPressOut={0}
          style={[styles.pillBtnMute, mute && styles.pillBtnMuteActive]}
          onPress={() => {
            onSelect(id);
            onToggleMute(id);
          }}
        >
          <Text style={[styles.pillBtnText, mute && styles.pillBtnTextActive]}>MUTE</Text>
        </TouchableOpacity>
      </View>

      {/* Pista Recta Delgada + VU Meter Dinámico Aislado */}
      <View style={styles.faderTrackWrapper}>
        <ChannelVuMeter channelIndex={id - 1} mute={mute} />

        <View style={styles.faderSlimTrack} {...panResponder.panHandlers}>
          <View style={styles.faderCenterLine} />
          <View style={[styles.faderFillBar, { height: `${value}%` }]} />
          <View
            style={[
              styles.faderRectThumbCap,
              { bottom: `${Math.min(Math.max(value, 0), 90)}%` },
            ]}
          >
            <View style={styles.faderCapCyanLine} />
          </View>
        </View>
      </View>

      <Text style={styles.faderValDisplay}>{value}%</Text>
    </TouchableOpacity>
  );
};

// ===================================================
// PERILLA CONCÉNTRICA TÁCTIL (PANRESPONDER)
// ===================================================
interface ConsoleKnobProps {
  label: string;
  value: number;
  displayValue: string;
  size?: number;
  color?: string;
  onChange: (val: number) => void;
}

const ConsoleKnob: React.FC<ConsoleKnobProps> = ({
  label,
  value,
  displayValue,
  size = 54,
  color = '#FF9100',
  onChange,
}) => {
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const startVal = useRef(value);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        startVal.current = valueRef.current;
      },
      onPanResponderMove: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const deltaPercent = -gestureState.dy * 0.9;
        const newVal = Math.min(Math.max(startVal.current + deltaPercent, 0), 100);
        onChangeRef.current(Math.round(newVal));
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: () => {},
    })
  ).current;

  const rotationDeg = -135 + (value / 100) * 270;

  return (
    <View style={styles.knobCol}>
      <View
        style={[
          styles.knobOuterCircle,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
        {...panResponder.panHandlers}
      >
        <Svg width={size} height={size} viewBox="0 0 60 60" style={styles.absoluteCenter}>
          <Circle cx="30" cy="30" r="25" stroke="#121A26" strokeWidth="4" fill="none" />
          <Circle
            cx="30"
            cy="30"
            r="25"
            stroke={color}
            strokeWidth="4"
            strokeDasharray={`${(value / 100) * 125} 200`}
            strokeLinecap="round"
            fill="none"
            transform="rotate(135 30 30)"
          />
        </Svg>

        <View
          style={[
            styles.knobDialBody,
            {
              width: size - 14,
              height: size - 14,
              borderRadius: (size - 14) / 2,
              transform: [{ rotate: `${rotationDeg}deg` }],
            },
          ]}
        >
          <View style={[styles.knobDialIndicator, { backgroundColor: color }]} />
        </View>
      </View>

      <Text style={styles.knobTitleText}>{label}</Text>
      <Text style={[styles.knobValueText, { color }]}>{displayValue}</Text>
    </View>
  );
};

// ===================================================
// APLICACIÓN PRINCIPAL (SYNTH CONNECT PRO)
// ===================================================
export default function App() {
  const {
    isInitialized,
    auditionVoice,
    auditionStop,
    noteOn,
    noteOff,
    setParam,
    setLayerMix,
    setLayerVoice,
    setLayerOctave,
    setGlobalTranspose,
    setLayerParam,
    loadSoundFont,
  } = useSynthEngine();
  const {
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
  } = useMidiDevices();

  const [isBleModalVisible, setIsBleModalVisible] = useState<boolean>(false);
  const [isConnectingAddress, setIsConnectingAddress] = useState<string | null>(null);

  const connectedBleDevice = devices.find((d) => d.type === 'BLUETOOTH');
  const connectedUsbDevice = usbDevices.length > 0 ? usbDevices[0] : devices.find((d) => d.type === 'USB');

  const handleOpenBluetoothModal = async () => {
    setIsBleModalVisible(true);
    const granted = await requestBluetoothPermissions();
    if (granted) {
      startBleScan();
    } else {
      showAlert(
        'WARNING',
        'PERMISOS BLUETOOTH REQUERIDOS',
        'Se requieren permisos de Dispositivos Cercanos y Ubicación para buscar teclados Bluetooth.'
      );
    }
  };

  const handleConnectBleDevice = async (dev: { address: string; name: string }) => {
    setIsConnectingAddress(dev.address);
    const ok = await connectBle(dev.address);
    setIsConnectingAddress(null);
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
  const {
    currentChord,
    bpm,
    currentSection,
    queuedSection,
    currentBeat,
    isPlaying,
    isPaused,
    isSyncStart,
    isAccompanimentOn,
    styleVolume,
    loadedStyle,
    availableStyles,
    selectedCategory,
    setSelectedCategory,
    setBpm,
    setSection,
    triggerFillIn,
    setStyleVolume,
    startStopStyle,
    pauseStyle,
    toggleSyncStart,
    toggleAccompaniment,
    selectStyle,
    importStyleFiles,
    deleteStyleFile,
    renameStyleFile,
  } = useArranger();

  // Estados de Vista Integrada (Sin Modales Flotantes)
  const [currentView, setCurrentView] = useState<'MAIN' | 'STYLE_LIBRARY' | 'VOICE_LIBRARY'>('MAIN');
  const [styleSearchText, setStyleSearchText] = useState<string>('');
  const [voiceSearchText, setVoiceSearchText] = useState<string>('');
  const [renameDialog, setRenameDialog] = useState<{
    visible: boolean;
    targetId: string;
    currentName: string;
    type: 'STYLE' | 'VOICE';
  }>({
    visible: false,
    targetId: '',
    currentName: '',
    type: 'STYLE',
  });
  const [renameInputText, setRenameInputText] = useState<string>('');

  const [activeBank, setActiveBank] = useState<number>(1);
  const [modulation, setModulation] = useState<number>(40);
  const [selectedFaderId, setSelectedFaderId] = useState<number>(1);

  // Transposición Global (Aplica a todos los faders)
  const [transpose, setTranspose] = useState<number>(0);

  // Selección de parámetro activo en el visualizador ADSR
  const [selectedAdsr, setSelectedAdsr] = useState<'ATTACK' | 'DELAY' | 'SUSTAIN' | 'RELEASE'>('ATTACK');

  // Hora y Batería Reales del Dispositivo
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  const [batteryPercent, setBatteryPercent] = useState<number>(100);

  // Faders State (Cada fader con su octava y efectos DSP independientes)
  const [faders, setFaders] = useState([
    { id: 1, name: 'Concert Grand Piano', value: 80, solo: false, mute: false, octave: 0, cutoff: 100, resonance: 20, attack: 0, delay: 45, sustain: 100, release: 30 },
    { id: 2, name: 'Ambient Pad Warm', value: 65, solo: false, mute: false, octave: 0, cutoff: 90, resonance: 25, attack: 15, delay: 50, sustain: 90, release: 40 },
    { id: 3, name: 'Syn Strings Symphony', value: 50, solo: false, mute: false, octave: 0, cutoff: 95, resonance: 20, attack: 10, delay: 45, sustain: 95, release: 35 },
    { id: 4, name: 'Synth Lead Moog Saw', value: 75, solo: false, mute: false, octave: 0, cutoff: 100, resonance: 30, attack: 0, delay: 40, sustain: 100, release: 25 },
  ]);

  const activeFader = faders.find((f) => f.id === selectedFaderId) || faders[0];

  // Voice Selection & Custom SoundFonts State
  const [customVoices, setCustomVoices] = useState<CustomVoicePreset[]>([]);

  useEffect(() => {
    async function loadUserSoundfonts() {
      const userList = await SoundLibraryService.getCustomVoices();
      setCustomVoices(userList);
    }
    loadUserSoundfonts();
  }, []);

  const fullVoiceLibrary = [...VOICE_LIBRARY, ...customVoices];

  // Sincronización continua de mezcla, voces, octava y efectos por fader a C++ NDK
  useEffect(() => {
    faders.forEach((fader, index) => {
      const foundVoice = fullVoiceLibrary.find((v) => v.id === fader.name || v.name === fader.name);
      setLayerMix(index, fader.value / 100, fader.mute, fader.solo);
      setLayerVoice(index, fader.name, foundVoice?.sf2Preset ?? index, foundVoice?.sf2Path || '');
      setLayerOctave(index, fader.octave);
      setLayerParam(index, 'cutoff', fader.cutoff);
      setLayerParam(index, 'resonance', fader.resonance);
      setLayerParam(index, 'attack', fader.attack);
      setLayerParam(index, 'decay', fader.delay);
      setLayerParam(index, 'sustain', fader.sustain);
      setLayerParam(index, 'release', fader.release);
    });
  }, [faders, fullVoiceLibrary, setLayerMix, setLayerVoice, setLayerOctave, setLayerParam]);

  // Voice Selection State
  const [selectedVoiceCategory, setSelectedVoiceCategory] = useState<string>('ALL');
  const [targetFaderId, setTargetFaderId] = useState<number>(1);

  // Sincronización de transposición global y modulación
  useEffect(() => {
    setGlobalTranspose(transpose);
  }, [transpose, setGlobalTranspose]);

  useEffect(() => {
    setParam('modulation', modulation);
  }, [modulation, setParam]);



  // Custom Console Alert State
  const [consoleAlert, setConsoleAlert] = useState<{
    visible: boolean;
    type: 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING';
    title: string;
    message: string;
    onConfirm?: () => void;
    showCancel?: boolean;
  }>({
    visible: false,
    type: 'SUCCESS',
    title: '',
    message: '',
  });

  const showAlert = (
    type: 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING',
    title: string,
    message: string,
    onConfirm?: () => void,
    showCancel: boolean = false
  ) => {
    setConsoleAlert({
      visible: true,
      type,
      title,
      message,
      onConfirm,
      showCancel,
    });
  };

  const hideAlert = () => {
    setConsoleAlert((prev) => ({ ...prev, visible: false }));
  };

  // Bank Memory Catalog State
  const [memoryBanksCatalog, setMemoryBanksCatalog] = useState<MemoryBanksCatalog>({});

  useEffect(() => {
    async function loadBanks() {
      const catalog = await BankMemoryService.getAllBanks();
      setMemoryBanksCatalog(catalog);
    }
    loadBanks();
  }, []);

  const bankPressTimerRef = useRef<{ [key: number]: any }>({});
  const bankPressStartRef = useRef<{ [key: number]: number }>({});
  const bankDidClearRef = useRef<{ [key: number]: boolean }>({});

  const handleClearMemoryBank = async (bankNum: number) => {
    try {
      await BankMemoryService.clearBank(bankNum);
      setMemoryBanksCatalog((prev) => {
        const next = { ...prev };
        delete next[bankNum];
        return next;
      });
      if (activeBank === bankNum) {
        setActiveBank(0);
      }
      showAlert(
        'INFO',
        `BANCO ${bankNum} LIMPIADO`,
        `Se ha borrado la configuración del BANCO ${bankNum}. Ahora está vacío.`
      );
    } catch (e) {
      console.warn('Error al limpiar banco de memoria:', e);
    }
  };

  const handleBankPressIn = (bankNum: number) => {
    bankPressStartRef.current[bankNum] = Date.now();
    bankDidClearRef.current[bankNum] = false;

    // Timer de 3 segundos exactos para limpiar el banco
    bankPressTimerRef.current[bankNum] = setTimeout(() => {
      bankDidClearRef.current[bankNum] = true;
      handleClearMemoryBank(bankNum);
    }, 3000);
  };

  const handleBankPressOut = (bankNum: number) => {
    if (bankPressTimerRef.current[bankNum]) {
      clearTimeout(bankPressTimerRef.current[bankNum]);
    }
    if (bankDidClearRef.current[bankNum]) {
      return;
    }
    const duration = Date.now() - (bankPressStartRef.current[bankNum] || 0);
    if (duration >= 1000) {
      // 1 segundo sostenido: Guardar en el banco
      handleSaveMemoryBank(bankNum);
    } else {
      // Toque normal: Cargar banco
      handleLoadMemoryBank(bankNum);
    }
  };

  const handleSaveMemoryBank = async (bankNum: number) => {
    const f1 = faders.find((f) => f.id === 1) || { name: 'Voice 1', value: 80, mute: false, solo: false, octave: 0, cutoff: 100, resonance: 20, attack: 0, delay: 45, sustain: 100, release: 30 };
    const f2 = faders.find((f) => f.id === 2) || { name: 'Voice 2', value: 65, mute: false, solo: false, octave: 0, cutoff: 90, resonance: 25, attack: 15, delay: 50, sustain: 90, release: 40 };
    const f3 = faders.find((f) => f.id === 3) || { name: 'Voice 3', value: 50, mute: false, solo: false, octave: 0, cutoff: 95, resonance: 20, attack: 10, delay: 45, sustain: 95, release: 35 };
    const f4 = faders.find((f) => f.id === 4) || { name: 'Voice 4', value: 75, mute: false, solo: false, octave: 0, cutoff: 100, resonance: 30, attack: 0, delay: 40, sustain: 100, release: 25 };

    const newPreset = await BankMemoryService.saveBank(bankNum, {
      f1: { voiceId: f1.name, volume: f1.value, mute: f1.mute, solo: f1.solo, octave: f1.octave, cutoff: f1.cutoff, resonance: f1.resonance, attack: f1.attack, delay: f1.delay, sustain: f1.sustain, release: f1.release },
      f2: { voiceId: f2.name, volume: f2.value, mute: f2.mute, solo: f2.solo, octave: f2.octave, cutoff: f2.cutoff, resonance: f2.resonance, attack: f2.attack, delay: f2.delay, sustain: f2.sustain, release: f2.release },
      f3: { voiceId: f3.name, volume: f3.value, mute: f3.mute, solo: f3.solo, octave: f3.octave, cutoff: f3.cutoff, resonance: f3.resonance, attack: f3.attack, delay: f3.delay, sustain: f3.sustain, release: f3.release },
      f4: { voiceId: f4.name, volume: f4.value, mute: f4.mute, solo: f4.solo, octave: f4.octave, cutoff: f4.cutoff, resonance: f4.resonance, attack: f4.attack, delay: f4.delay, sustain: f4.sustain, release: f4.release },
      octave: f1.octave,
      transpose,
      attack: f1.attack,
      delay: f1.delay,
      sustain: f1.sustain,
      release: f1.release,
      cutoff: f1.cutoff,
      resonance: f1.resonance,
      modulation,
      styleId: loadedStyle.id,
      styleName: loadedStyle.name,
      styleCategory: loadedStyle.category,
      styleVolume,
      bpm,
    });

    setMemoryBanksCatalog((prev) => ({ ...prev, [bankNum]: newPreset }));
    setActiveBank(bankNum);

    showAlert(
      'SUCCESS',
      `GUARDADO EN BANCO ${bankNum}`,
      `Se ha guardado la combinación actual en el BANCO ${bankNum}:\n- F1: ${f1.name} (OCT ${f1.octave > 0 ? '+' : ''}${f1.octave})\n- F2: ${f2.name} (OCT ${f2.octave > 0 ? '+' : ''}${f2.octave})\n- Ritmo: ${loadedStyle.name}\n- Transposición Global: ${transpose > 0 ? '+' : ''}${transpose}`
    );
  };

  const handleLoadMemoryBank = async (bankNum: number) => {
    const preset = memoryBanksCatalog[bankNum];
    if (!preset) {
      showAlert(
        'INFO',
        `BANCO ${bankNum} VACÍO`,
        `El BANCO ${bankNum} no tiene ningún preset guardado todavía.\n\nMantén presionado el botón BANK ${bankNum} para guardar tu configuración actual.`
      );
      return;
    }

    // Restaurar Faders con sus octavas y efectos individuales
    const newFaders = [
      {
        id: 1,
        name: preset.f1.voiceId,
        value: preset.f1.volume,
        mute: preset.f1.mute,
        solo: preset.f1.solo,
        octave: preset.f1.octave ?? preset.octave ?? 0,
        cutoff: preset.f1.cutoff ?? preset.cutoff ?? 100,
        resonance: preset.f1.resonance ?? preset.resonance ?? 20,
        attack: preset.f1.attack ?? preset.attack ?? 0,
        delay: preset.f1.delay ?? preset.delay ?? 45,
        sustain: preset.f1.sustain ?? preset.sustain ?? 100,
        release: preset.f1.release ?? preset.release ?? 30,
      },
      {
        id: 2,
        name: preset.f2.voiceId,
        value: preset.f2.volume,
        mute: preset.f2.mute,
        solo: preset.f2.solo,
        octave: preset.f2.octave ?? 0,
        cutoff: preset.f2.cutoff ?? preset.cutoff ?? 90,
        resonance: preset.f2.resonance ?? preset.resonance ?? 25,
        attack: preset.f2.attack ?? preset.attack ?? 15,
        delay: preset.f2.delay ?? preset.delay ?? 50,
        sustain: preset.f2.sustain ?? preset.sustain ?? 90,
        release: preset.f2.release ?? preset.release ?? 40,
      },
      {
        id: 3,
        name: preset.f3.voiceId,
        value: preset.f3.volume,
        mute: preset.f3.mute,
        solo: preset.f3.solo,
        octave: preset.f3.octave ?? 0,
        cutoff: preset.f3.cutoff ?? preset.cutoff ?? 95,
        resonance: preset.f3.resonance ?? preset.resonance ?? 20,
        attack: preset.f3.attack ?? preset.attack ?? 10,
        delay: preset.f3.delay ?? preset.delay ?? 45,
        sustain: preset.f3.sustain ?? preset.sustain ?? 95,
        release: preset.f3.release ?? preset.release ?? 35,
      },
      {
        id: 4,
        name: preset.f4.voiceId,
        value: preset.f4.volume,
        mute: preset.f4.mute,
        solo: preset.f4.solo,
        octave: preset.f4.octave ?? 0,
        cutoff: preset.f4.cutoff ?? preset.cutoff ?? 100,
        resonance: preset.f4.resonance ?? preset.resonance ?? 30,
        attack: preset.f4.attack ?? preset.attack ?? 0,
        delay: preset.f4.delay ?? preset.delay ?? 40,
        sustain: preset.f4.sustain ?? preset.sustain ?? 100,
        release: preset.f4.release ?? preset.release ?? 25,
      },
    ];
    setFaders(newFaders);
    setTranspose(preset.transpose);
    setModulation(preset.modulation);

    // Aplicar a Motor Sintetizador Nativo C++ inmediatamente
    try {
      newFaders.forEach((f, idx) => {
        const foundVoice = fullVoiceLibrary.find((v) => v.id === f.name || v.name === f.name);
        setLayerMix(idx, f.value / 100, f.mute, f.solo);
        setLayerVoice(idx, f.name, foundVoice?.sf2Preset ?? idx, foundVoice?.sf2Path || '');
        setLayerOctave(idx, f.octave);
        setLayerParam(idx, 'cutoff', f.cutoff);
        setLayerParam(idx, 'resonance', f.resonance);
        setLayerParam(idx, 'attack', f.attack);
        setLayerParam(idx, 'decay', f.delay);
        setLayerParam(idx, 'sustain', f.sustain);
        setLayerParam(idx, 'release', f.release);
      });
      setGlobalTranspose(preset.transpose);
      setParam('modulation', preset.modulation);
    } catch (e) {
      console.warn('Error al aplicar envolvente de banco a synth engine:', e);
    }

    // Restaurar Ritmo y Tempo
    setStyleVolume(preset.styleVolume);
    setBpm(preset.bpm);

    const matchStyle = availableStyles.find((s) => s.id === preset.styleId || s.name === preset.styleName);
    if (matchStyle) {
      selectStyle(matchStyle);
    }

    setActiveBank(bankNum);
  };

  const handleImportSoundFile = async () => {
    const targetCat = selectedVoiceCategory === 'ALL' ? 'PIANO' : selectedVoiceCategory;
    const res = await SoundLibraryService.pickAndImportSoundFiles(targetCat);

    if (res.importedVoices.length > 0) {
      setCustomVoices((prev) => [...prev, ...res.importedVoices]);
      if (res.rejectedCount > 0) {
        showAlert(
          'WARNING',
          'IMPORTACIÓN PARCIAL',
          `Se agregaron ${res.importedVoices.length} sonido(s) a ${targetCat}, pero ${res.rejectedCount} archivo(s) no tenían formato .SF2 / .SFZ.`
        );
      } else {
        showAlert(
          'SUCCESS',
          'SONIDO IMPORTADO',
          `Se agregaron ${res.importedVoices.length} archivo(s) .SF2 correctamente a la categoría ${targetCat}.`
        );
      }
    } else if (res.rejectedCount > 0) {
      showAlert(
        'ERROR',
        'FORMATO NO SOPORTADO',
        `Se rechazaron ${res.rejectedCount} archivo(s). Por favor selecciona únicamente archivos con formato .SF2 o .SFZ.`
      );
    }
  };

  const handleDeleteVoice = (voiceId: string, voiceName: string) => {
    showAlert(
      'WARNING',
      'ELIMINAR SONIDO',
      `¿Estás seguro de eliminar el sonido "${voiceName}" de la memoria del dispositivo?`,
      async () => {
        await SoundLibraryService.deleteCustomVoice(voiceId);
        setCustomVoices((prev) => prev.filter((v) => v.id !== voiceId));
      },
      true
    );
  };

  // Contadores de Categorías
  const getStyleCategoryCount = (cat: string) => {
    if (cat === 'ALL') return availableStyles.length;
    return availableStyles.filter((st) => matchStyleCategory(st.category, st.name, cat)).length;
  };

  const getVoiceCategoryCount = (cat: string) => {
    if (cat === 'ALL') return fullVoiceLibrary.length;
    return fullVoiceLibrary.filter((v) => v.category === cat).length;
  };

  // Listas filtradas con buscador en tiempo real
  const filteredStyles = availableStyles.filter((st) => {
    const matchesCat = matchStyleCategory(st.category, st.name, selectedCategory);
    const matchesSearch = !styleSearchText.trim() || st.name.toLowerCase().includes(styleSearchText.toLowerCase().trim());
    return matchesCat && matchesSearch;
  });

  const filteredVoices = fullVoiceLibrary.filter((v) => {
    const matchesCat = selectedVoiceCategory === 'ALL' || v.category === selectedVoiceCategory;
    const matchesSearch = !voiceSearchText.trim() || v.name.toLowerCase().includes(voiceSearchText.toLowerCase().trim());
    return matchesCat && matchesSearch;
  });

  // Diálogo de Renombrar
  const openRenameDialog = (id: string, name: string, type: 'STYLE' | 'VOICE') => {
    setRenameDialog({ visible: true, targetId: id, currentName: name, type });
    setRenameInputText(name);
  };

  const handleSaveRename = async () => {
    const trimmed = renameInputText.trim();
    if (!trimmed) return;
    if (renameDialog.type === 'STYLE') {
      await renameStyleFile(renameDialog.targetId, trimmed);
      showAlert('SUCCESS', 'RITMO RENOMBRADO', `El ritmo ha sido renombrado a "${trimmed}".`);
    } else {
      await SoundLibraryService.renameCustomVoice(renameDialog.targetId, trimmed);
      const userList = await SoundLibraryService.getCustomVoices();
      setCustomVoices(userList);
      setFaders((prev) =>
        prev.map((f) => (f.name === renameDialog.currentName ? { ...f, name: trimmed } : f))
      );
      showAlert('SUCCESS', 'VOZ RENOMBRADA', `La voz ha sido renombrada a "${trimmed}".`);
    }
    setRenameDialog({ visible: false, targetId: '', currentName: '', type: 'STYLE' });
  };

  useEffect(() => {
    async function lockLandscape() {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } catch (e) {
        console.warn('ScreenOrientation error:', e);
      }
    }
    lockLandscape();

    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
      setCurrentTimeStr(`${formattedHours}:${formattedMinutes} ${ampm}`);
    };
    updateTime();
    const timeInterval = setInterval(updateTime, 30000);

    async function fetchBattery() {
      try {
        const level = await Battery.getBatteryLevelAsync();
        if (level >= 0) {
          setBatteryPercent(Math.round(level * 100));
        }
      } catch (e) {
        console.warn('Battery error:', e);
      }
    }
    fetchBattery();

    return () => clearInterval(timeInterval);
  }, []);

  // Interceptor del botón físico / gestual de retroceso de Android
  useEffect(() => {
    const onBackPress = () => {
      if (isBleModalVisible) {
        setIsBleModalVisible(false);
        stopBleScan();
        return true;
      }
      if (renameDialog.visible) {
        setRenameDialog({ visible: false, targetId: '', currentName: '', type: 'STYLE' });
        return true;
      }
      if (consoleAlert.visible) {
        hideAlert();
        return true;
      }
      if (currentView !== 'MAIN') {
        setCurrentView('MAIN');
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [currentView, isBleModalVisible, renameDialog.visible, consoleAlert.visible, stopBleScan]);

  const handleFaderChange = (id: number, newVal: number) => {
    setFaders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, value: newVal } : f))
    );
    setParam(`fader_${id}`, newVal);
  };

  const toggleSolo = (id: number) => {
    setFaders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, solo: !f.solo } : f))
    );
  };

  const toggleMute = (id: number) => {
    setFaders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, mute: !f.mute } : f))
    );
  };

  const handleStartStop = () => {
    startStopStyle();
  };

  // Helper de Perilla Maestra ADSR
  // Helper de Perilla Maestra ADSR para el Fader Seleccionado
  const getAdsrCurrentValue = () => {
    switch (selectedAdsr) {
      case 'ATTACK': return activeFader.attack;
      case 'DELAY': return activeFader.delay;
      case 'SUSTAIN': return activeFader.sustain;
      case 'RELEASE': return activeFader.release;
    }
  };

  const handleAdsrKnobChange = (val: number) => {
    setFaders((prev) =>
      prev.map((f) => {
        if (f.id !== activeFader.id) return f;
        const updated = { ...f };
        if (selectedAdsr === 'ATTACK') { updated.attack = val; setLayerParam(f.id - 1, 'attack', val); }
        if (selectedAdsr === 'DELAY') { updated.delay = val; setLayerParam(f.id - 1, 'decay', val); }
        if (selectedAdsr === 'SUSTAIN') { updated.sustain = val; setLayerParam(f.id - 1, 'sustain', val); }
        if (selectedAdsr === 'RELEASE') { updated.release = val; setLayerParam(f.id - 1, 'release', val); }
        return updated;
      })
    );
  };

  const getAdsrDisplayValue = () => {
    switch (selectedAdsr) {
      case 'ATTACK': return `${Math.round((activeFader.attack / 100) * 500)}ms`;
      case 'DELAY': return `${((activeFader.delay / 100) * 4.9 + 0.1).toFixed(1)}s`;
      case 'SUSTAIN': return `${activeFader.sustain}%`;
      case 'RELEASE': return `${((activeFader.release / 100) * 4.9 + 0.1).toFixed(1)}s`;
    }
  };

  // Coordenadas SVG ADSR para el Fader Seleccionado
  const calculateAdsrPoints = () => {
    const startX = 6;
    const baseY = 58;
    const peakY = 6;

    const attackX = startX + 12 + (activeFader.attack / 100) * 45;
    const decayX = attackX + 20 + (activeFader.delay / 100) * 55;
    const sustainY = baseY - (activeFader.sustain / 100) * (baseY - peakY);
    const sustainX = decayX + 40;
    const releaseX = Math.min(sustainX + 15 + (activeFader.release / 100) * 45, 214);

    return {
      path: `M ${startX} ${baseY} L ${attackX} ${peakY} L ${decayX} ${sustainY} L ${sustainX} ${sustainY} L ${releaseX} ${baseY} Z`,
      strokePath: `M ${startX} ${baseY} L ${attackX} ${peakY} L ${decayX} ${sustainY} L ${sustainX} ${sustainY} L ${releaseX} ${baseY}`,
      p1: { x: attackX, y: peakY },
      p2: { x: decayX, y: sustainY },
      p3: { x: sustainX, y: sustainY },
      p4: { x: releaseX, y: baseY },
    };
  };

  const adsrCoords = calculateAdsrPoints();

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="light-content" hidden={true} />

      {/* HEADER PRINCIPAL */}
      <View style={styles.header}>
        {/* IZQUIERDA: Conexión Cable USB OTG y Botón Bluetooth Independiente */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          {/* 1. Sección Cable Directo USB OTG */}
          <TouchableOpacity
            activeOpacity={0.7}
            delayPressIn={0}
            delayPressOut={0}
            style={[
              styles.midiStatusBoxHeader,
              connectedUsbDevice && styles.midiStatusBoxHeaderConnected,
            ]}
            onPress={() => scan()}
          >
            <UsbCableIcon size={12} color={connectedUsbDevice ? '#00E5FF' : '#6B829D'} />
            <Text style={[styles.midiStatusTextHeader, connectedUsbDevice && styles.midiStatusTextHeaderConnected]}>
              {connectedUsbDevice
                ? `${connectedUsbDevice.name.toUpperCase()} USB OK`
                : 'USB OTG LISTO'}
            </Text>
          </TouchableOpacity>

          {/* 2. Botón Bluetooth Independiente */}
          <TouchableOpacity
            activeOpacity={0.7}
            delayPressIn={0}
            delayPressOut={0}
            style={[
              styles.btHeaderBtn,
              connectedBleDevice && styles.btHeaderBtnConnected,
              isScanningBle && !connectedBleDevice && styles.btHeaderBtnScanning,
            ]}
            onPress={handleOpenBluetoothModal}
          >
            <BluetoothIcon
              size={12}
              color={connectedBleDevice ? '#00E5FF' : isScanningBle ? '#00E5FF' : '#7187A1'}
            />
            <Text
              style={[
                styles.btHeaderBtnText,
                connectedBleDevice && styles.btHeaderBtnTextConnected,
                isScanningBle && !connectedBleDevice && styles.btHeaderBtnTextScanning,
              ]}
            >
              {connectedBleDevice ? `${connectedBleDevice.name.toUpperCase()} (BLE)` : 'BT MIDI'}
            </Text>
            {connectedBleDevice && <View style={styles.btHeaderConnectedDot} />}
          </TouchableOpacity>
        </View>

        {/* CENTRO PERFECTO: Nombre de la App */}
        <View style={styles.headerCenterAbsolute}>
          <Text style={styles.headerTitle}>
            SYNTH <Text style={styles.headerTitleCyan}>CONNECT</Text>{' '}
            <Text style={styles.headerTitlePro}>Pro</Text>
          </Text>
        </View>

        {/* DERECHA: Hora real y Batería real */}
        <View style={styles.headerRightInfo}>
          <Text style={styles.sysTimeText}>{currentTimeStr}</Text>
          <View style={styles.sysDotGreen} />
          <Text style={styles.sysBattery}>{batteryPercent}%</Text>
        </View>
      </View>

      {/* ================= VISTA 1: CONSOLA PRINCIPAL ================= */}
      {currentView === 'MAIN' && (
        <View style={styles.mainWorkspace}>
          {/* ================= PANEL IZQUIERDO: STYLES (YAMAHA .STY) ================= */}
          <View style={styles.leftPanel}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.panelHeaderRow}
              onPress={() => setCurrentView('STYLE_LIBRARY')}
            >
              <Text style={styles.panelTitle}>STYLES ({selectedCategory})</Text>
              <Text style={styles.menuIcon}>≡</Text>
            </TouchableOpacity>

            {/* Selector de Géneros / Categorías de Ritmo */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.styleCategoriesBar}>
              {['ALL', 'LATIN', 'POP', 'ROCK', 'BALLAD', 'CUMBIA', 'DANCE', 'CUSTOM'].map((cat) => {
                const isActive = selectedCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    activeOpacity={0.7}
                    delayPressIn={0}
                    delayPressOut={0}
                    style={[styles.styleCategoryPillMini, isActive && styles.styleCategoryPillMiniActive]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Text style={[styles.styleCategoryPillMiniText, isActive && styles.styleCategoryPillMiniTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Lista de Estilos filtrados por Género con Scroll Vertical */}
            <View style={styles.stylesListContainer}>
              <ScrollView style={styles.stylesListScroll} nestedScrollEnabled={true} showsVerticalScrollIndicator={false}>
                {(() => {
                  const filtered = availableStyles.filter((st) => matchStyleCategory(st.category, st.name, selectedCategory));
                  if (filtered.length === 0) {
                    return (
                      <View style={styles.styleItemRowEmpty}>
                        <Text style={styles.styleItemTextEmpty}>- NO HAY RITMOS -</Text>
                      </View>
                    );
                  }
                  return filtered.map((st) => {
                    const isSelected = st.id === loadedStyle.id;
                    return (
                      <TouchableOpacity
                        key={st.id}
                        activeOpacity={0.7}
                        delayPressIn={0}
                        delayPressOut={0}
                        style={[styles.styleItemRow, isSelected && styles.styleItemRowSelected]}
                        onPress={() => selectStyle(st)}
                      >
                        <Text style={[styles.styleItemText, isSelected && styles.styleItemTextSelected]} numberOfLines={1}>
                          {st.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  });
                })()}
              </ScrollView>
            </View>

            {/* Style Volume Slider Fader 3D */}
            <HorizontalFader
              label="STYLE VOLUME"
              value={styleVolume}
              onChange={setStyleVolume}
              color="#00E5FF"
            />

            {/* Matriz Hardware de Secciones: 4 Columnas x 2 Filas con Indicadores de 4 Tiempos */}
            <View style={styles.styleSectionsMatrix}>
              {/* Columna 1: INTRO A / INTRO B */}
              <View style={styles.sectionCol}>
                {(() => {
                  const isCurrent = currentSection === 'INTRO_A';
                  const isQueued = queuedSection === 'INTRO_A';
                  return (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      delayPressIn={0}
                      delayPressOut={0}
                      style={[
                        styles.sectionBtnRect,
                        styles.introBtn,
                        isCurrent && styles.introBtnActive,
                        isQueued && styles.sectionBtnQueued,
                      ]}
                      onPress={() => {
                        setSection('INTRO_A');
                        if (!isPlaying) startStopStyle();
                      }}
                    >
                      <Text style={[styles.sectionBtnText, styles.introText, isCurrent && styles.introTextActive, isQueued && styles.queuedText]}>
                        INTRO A
                      </Text>
                      <View style={styles.beatIndicatorRow}>
                        {[1, 2, 3, 4].map((b) => (
                          <View
                            key={b}
                            style={[
                              styles.beatDot,
                              isPlaying && isCurrent && currentBeat === b && styles.beatDotIntroActive,
                            ]}
                          />
                        ))}
                      </View>
                    </TouchableOpacity>
                  );
                })()}

                {(() => {
                  const isCurrent = currentSection === 'INTRO_B';
                  const isQueued = queuedSection === 'INTRO_B';
                  return (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      delayPressIn={0}
                      delayPressOut={0}
                      style={[
                        styles.sectionBtnRect,
                        styles.introBtn,
                        isCurrent && styles.introBtnActive,
                        isQueued && styles.sectionBtnQueued,
                      ]}
                      onPress={() => {
                        setSection('INTRO_B');
                        if (!isPlaying) startStopStyle();
                      }}
                    >
                      <Text style={[styles.sectionBtnText, styles.introText, isCurrent && styles.introTextActive, isQueued && styles.queuedText]}>
                        INTRO B
                      </Text>
                      <View style={styles.beatIndicatorRow}>
                        {[1, 2, 3, 4].map((b) => (
                          <View
                            key={b}
                            style={[
                              styles.beatDot,
                              isPlaying && isCurrent && currentBeat === b && styles.beatDotIntroActive,
                            ]}
                          />
                        ))}
                      </View>
                    </TouchableOpacity>
                  );
                })()}
              </View>

              {/* Columna 2: MAIN A / MAIN B */}
              <View style={styles.sectionCol}>
                {(() => {
                  const isCurrent = currentSection === 'MAIN_A';
                  const isQueued = queuedSection === 'MAIN_A';
                  return (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      delayPressIn={0}
                      delayPressOut={0}
                      style={[
                        styles.sectionBtnRect,
                        styles.mainBtn,
                        isCurrent && styles.mainBtnActive,
                        isQueued && styles.sectionBtnQueued,
                      ]}
                      onPress={() => setSection('MAIN_A')}
                    >
                      <Text style={[styles.sectionBtnText, styles.mainText, isCurrent && styles.mainTextActive, isQueued && styles.queuedText]}>
                        MAIN A
                      </Text>
                      <View style={styles.beatIndicatorRow}>
                        {[1, 2, 3, 4].map((b) => (
                          <View
                            key={b}
                            style={[
                              styles.beatDot,
                              isPlaying && isCurrent && currentBeat === b && styles.beatDotMainActive,
                            ]}
                          />
                        ))}
                      </View>
                    </TouchableOpacity>
                  );
                })()}

                {(() => {
                  const isCurrent = currentSection === 'MAIN_B';
                  const isQueued = queuedSection === 'MAIN_B';
                  return (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      delayPressIn={0}
                      delayPressOut={0}
                      style={[
                        styles.sectionBtnRect,
                        styles.mainBtn,
                        isCurrent && styles.mainBtnActive,
                        isQueued && styles.sectionBtnQueued,
                      ]}
                      onPress={() => setSection('MAIN_B')}
                    >
                      <Text style={[styles.sectionBtnText, styles.mainText, isCurrent && styles.mainTextActive, isQueued && styles.queuedText]}>
                        MAIN B
                      </Text>
                      <View style={styles.beatIndicatorRow}>
                        {[1, 2, 3, 4].map((b) => (
                          <View
                            key={b}
                            style={[
                              styles.beatDot,
                              isPlaying && isCurrent && currentBeat === b && styles.beatDotMainActive,
                            ]}
                          />
                        ))}
                      </View>
                    </TouchableOpacity>
                  );
                })()}
              </View>

              {/* Columna 3: MAIN C / MAIN D */}
              <View style={styles.sectionCol}>
                {(() => {
                  const isCurrent = currentSection === 'MAIN_C';
                  const isQueued = queuedSection === 'MAIN_C';
                  return (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      delayPressIn={0}
                      delayPressOut={0}
                      style={[
                        styles.sectionBtnRect,
                        styles.mainBtn,
                        isCurrent && styles.mainBtnActive,
                        isQueued && styles.sectionBtnQueued,
                      ]}
                      onPress={() => setSection('MAIN_C')}
                    >
                      <Text style={[styles.sectionBtnText, styles.mainText, isCurrent && styles.mainTextActive, isQueued && styles.queuedText]}>
                        MAIN C
                      </Text>
                      <View style={styles.beatIndicatorRow}>
                        {[1, 2, 3, 4].map((b) => (
                          <View
                            key={b}
                            style={[
                              styles.beatDot,
                              isPlaying && isCurrent && currentBeat === b && styles.beatDotMainActive,
                            ]}
                          />
                        ))}
                      </View>
                    </TouchableOpacity>
                  );
                })()}

                {(() => {
                  const isCurrent = currentSection === 'MAIN_D';
                  const isQueued = queuedSection === 'MAIN_D';
                  return (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      delayPressIn={0}
                      delayPressOut={0}
                      style={[
                        styles.sectionBtnRect,
                        styles.mainBtn,
                        isCurrent && styles.mainBtnActive,
                        isQueued && styles.sectionBtnQueued,
                      ]}
                      onPress={() => setSection('MAIN_D')}
                    >
                      <Text style={[styles.sectionBtnText, styles.mainText, isCurrent && styles.mainTextActive, isQueued && styles.queuedText]}>
                        MAIN D
                      </Text>
                      <View style={styles.beatIndicatorRow}>
                        {[1, 2, 3, 4].map((b) => (
                          <View
                            key={b}
                            style={[
                              styles.beatDot,
                              isPlaying && isCurrent && currentBeat === b && styles.beatDotMainActive,
                            ]}
                          />
                        ))}
                      </View>
                    </TouchableOpacity>
                  );
                })()}
              </View>

              {/* Columna 4: ENDING A / ENDING B */}
              <View style={styles.sectionCol}>
                {(() => {
                  const isCurrent = currentSection === 'ENDING_A';
                  const isQueued = queuedSection === 'ENDING_A';
                  return (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      delayPressIn={0}
                      delayPressOut={0}
                      style={[
                        styles.sectionBtnRect,
                        styles.endingBtn,
                        isCurrent && styles.endingBtnActive,
                        isQueued && styles.sectionBtnQueued,
                      ]}
                      onPress={() => setSection('ENDING_A')}
                    >
                      <Text style={[styles.sectionBtnText, styles.endingText, isCurrent && styles.endingTextActive, isQueued && styles.queuedText]}>
                        ENDING A
                      </Text>
                      <View style={styles.beatIndicatorRow}>
                        {[1, 2, 3, 4].map((b) => (
                          <View
                            key={b}
                            style={[
                              styles.beatDot,
                              isPlaying && isCurrent && currentBeat === b && styles.beatDotEndingActive,
                            ]}
                          />
                        ))}
                      </View>
                    </TouchableOpacity>
                  );
                })()}

                {(() => {
                  const isCurrent = currentSection === 'ENDING_B';
                  const isQueued = queuedSection === 'ENDING_B';
                  return (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      delayPressIn={0}
                      delayPressOut={0}
                      style={[
                        styles.sectionBtnRect,
                        styles.endingBtn,
                        isCurrent && styles.endingBtnActive,
                        isQueued && styles.sectionBtnQueued,
                      ]}
                      onPress={() => setSection('ENDING_B')}
                    >
                      <Text style={[styles.sectionBtnText, styles.endingText, isCurrent && styles.endingTextActive, isQueued && styles.queuedText]}>
                        ENDING B
                      </Text>
                      <View style={styles.beatIndicatorRow}>
                        {[1, 2, 3, 4].map((b) => (
                          <View
                            key={b}
                            style={[
                              styles.beatDot,
                              isPlaying && isCurrent && currentBeat === b && styles.beatDotEndingActive,
                            ]}
                          />
                        ))}
                      </View>
                    </TouchableOpacity>
                  );
                })()}
              </View>
            </View>

            {/* Barra de Transporte Inferior (Diseño Rectangular Profesional) */}
            <View style={styles.transportRow}>
              {/* SYNC START */}
              <TouchableOpacity
                style={[styles.transportBtnRect, isSyncStart && styles.syncStartBtnActive]}
                activeOpacity={0.7}
                delayPressIn={0}
                delayPressOut={0}
                onPress={toggleSyncStart}
              >
                <Text style={[styles.transportBtnTitle, isSyncStart && styles.syncStartTitleActive]}>SYNC</Text>
                <Text style={[styles.transportBtnSub, isSyncStart && styles.syncStartSubActive]}>START</Text>
              </TouchableOpacity>

              {/* ACMP ON/OFF */}
              <TouchableOpacity
                style={[styles.transportBtnRect, isAccompanimentOn && styles.acmpBtnActive]}
                activeOpacity={0.7}
                delayPressIn={0}
                delayPressOut={0}
                onPress={toggleAccompaniment}
              >
                <Text style={[styles.transportBtnTitle, isAccompanimentOn && styles.acmpTitleActive]}>ACMP</Text>
                <Text style={[styles.transportBtnSub, isAccompanimentOn && styles.acmpSubActive]}>{isAccompanimentOn ? 'ON' : 'OFF'}</Text>
              </TouchableOpacity>

              {/* START / STOP */}
              <TouchableOpacity
                activeOpacity={0.8}
                delayPressIn={0}
                delayPressOut={0}
                style={[styles.startStopRectBtn, isPlaying && styles.startStopRectBtnActive]}
                onPress={startStopStyle}
              >
                <Text style={[styles.startStopRectTitle, isPlaying && styles.startStopRectTitleActive]}>
                  {isPlaying ? 'STOP' : 'START / STOP'}
                </Text>
              </TouchableOpacity>

              {/* FILL IN */}
              <TouchableOpacity
                style={styles.transportBtnRect}
                activeOpacity={0.7}
                delayPressIn={0}
                delayPressOut={0}
                onPress={() => {
                  const varLetter = (currentSection.split('_')[1] as 'A' | 'B' | 'C' | 'D') || 'A';
                  triggerFillIn(varLetter);
                }}
              >
                <Text style={styles.transportBtnTitle}>FILL</Text>
                <Text style={styles.transportBtnSub}>IN</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ================= PANEL CENTRAL: PERFORMANCE LAYERS ================= */}
          <View style={styles.centerPanel}>
            <View style={styles.panelHeaderRow}>
              <Text style={styles.panelTitle}>PERFORMANCE LAYERS</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                delayPressIn={0}
                delayPressOut={0}
                onPress={() => setCurrentView('VOICE_LIBRARY')}
              >
                <Text style={styles.menuIcon}>≡</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.fadersGridSeparated}>
              {faders.map((fader) => (
                <ConsoleFader
                  key={fader.id}
                  id={fader.id}
                  name={fader.name}
                  value={fader.value}
                  solo={fader.solo}
                  mute={fader.mute}
                  isSelected={selectedFaderId === fader.id}
                  isPlaying={isPlaying}
                  onSelect={setSelectedFaderId}
                  onChange={handleFaderChange}
                  onToggleSolo={toggleSolo}
                  onToggleMute={toggleMute}
                />
              ))}
            </View>

            {/* OCTAVE (Por Fader Seleccionado) & TRANSPOSE (Global para Todos los Faders) */}
            <View style={styles.centerBottomControlRow}>
              <View style={styles.octaveTrpBlock}>
                <Text style={styles.octaveTrpTitle}>OCTAVE (F{activeFader.id})</Text>
                <View style={styles.octaveTrpRowInner}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    delayPressIn={0}
                    delayPressOut={0}
                    style={styles.octaveMinusBtn}
                    onPress={() => {
                      const newOct = Math.max(activeFader.octave - 1, -3);
                      setFaders((prev) =>
                        prev.map((f) => (f.id === activeFader.id ? { ...f, octave: newOct } : f))
                      );
                      setLayerOctave(activeFader.id - 1, newOct);
                    }}
                  >
                    <Text style={styles.octaveBtnSymbol}>-</Text>
                  </TouchableOpacity>

                  <Text style={styles.octaveValueText}>
                    {activeFader.octave > 0 ? `+${activeFader.octave}` : activeFader.octave}
                  </Text>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    delayPressIn={0}
                    delayPressOut={0}
                    style={styles.octavePlusBtn}
                    onPress={() => {
                      const newOct = Math.min(activeFader.octave + 1, 3);
                      setFaders((prev) =>
                        prev.map((f) => (f.id === activeFader.id ? { ...f, octave: newOct } : f))
                      );
                      setLayerOctave(activeFader.id - 1, newOct);
                    }}
                  >
                    <Text style={styles.octaveBtnSymbol}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.octaveTrpBlock}>
                <Text style={styles.octaveTrpTitle}>TRANSPOSE</Text>
                <View style={styles.octaveTrpRowInner}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    delayPressIn={0}
                    delayPressOut={0}
                    style={styles.octaveMinusBtn}
                    onPress={() => {
                      const newTrp = Math.max(transpose - 1, -12);
                      setTranspose(newTrp);
                      setGlobalTranspose(newTrp);
                    }}
                  >
                    <Text style={styles.octaveBtnSymbol}>-</Text>
                  </TouchableOpacity>

                  <Text style={styles.octaveValueText}>
                    {transpose > 0 ? `+${transpose}` : transpose}
                  </Text>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    delayPressIn={0}
                    delayPressOut={0}
                    style={styles.octavePlusBtn}
                    onPress={() => {
                      const newTrp = Math.min(transpose + 1, 12);
                      setTranspose(newTrp);
                      setGlobalTranspose(newTrp);
                    }}
                  >
                    <Text style={styles.octaveBtnSymbol}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {/* ================= PANEL DERECHO ================= */}
          <View style={styles.rightPanel}>
            <View style={styles.rightTopRow}>
              {/* COLUMNA IZQUIERDA: ENVELOPE + TEMPO RELLENANDO ESPACIO + RESONANCE DEBAJO DE TEMPO */}
              <View style={styles.adsrAndTempoLeftCol}>
                {/* Tarjeta Consola ADSR con Solo Cutoff */}
                <View style={styles.adsrCardContainerCompact}>
                  <Text style={styles.panelTitle}>ENVELOPE (ADSR - F{activeFader.id})</Text>

                  {/* 1. HASTA ARRIBA: Gráfica SVG */}
                  <View style={styles.adsrGraphCardBox}>
                    <Svg height="60" width="100%" viewBox="0 0 220 70">
                      <Defs>
                        <LinearGradient id="orangeGrad" x1="0" y1="0" x2="0" y2="1">
                          <Stop offset="0" stopColor="#FF9100" stopOpacity="0.8" />
                          <Stop offset="1" stopColor="#FF9100" stopOpacity="0.05" />
                        </LinearGradient>
                      </Defs>

                      <Line x1="0" y1="35" x2="220" y2="35" stroke="#121C2B" strokeWidth="1" strokeDasharray="4 4" />
                      <Line x1="110" y1="0" x2="110" y2="70" stroke="#121C2B" strokeWidth="1" strokeDasharray="4 4" />

                      <Path d={adsrCoords.path} fill="url(#orangeGrad)" />
                      <Path d={adsrCoords.strokePath} stroke="#FF9100" strokeWidth="2.5" fill="none" />

                      {/* Nodos A, D, S, R */}
                      <Circle
                        cx={adsrCoords.p1.x}
                        cy={adsrCoords.p1.y}
                        r={selectedAdsr === 'ATTACK' ? '5.5' : '4'}
                        fill={selectedAdsr === 'ATTACK' ? '#FF9100' : '#FFFFFF'}
                        stroke="#FF9100"
                        strokeWidth="2"
                      />
                      <SvgText
                        x={adsrCoords.p1.x}
                        y={adsrCoords.p1.y + (selectedAdsr === 'ATTACK' ? 14 : 12)}
                        fill={selectedAdsr === 'ATTACK' ? '#FF9100' : '#8A9EB8'}
                        fontSize="8"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        A
                      </SvgText>

                      <Circle
                        cx={adsrCoords.p2.x}
                        cy={adsrCoords.p2.y}
                        r={selectedAdsr === 'DELAY' ? '5.5' : '4'}
                        fill={selectedAdsr === 'DELAY' ? '#FF9100' : '#FFFFFF'}
                        stroke="#FF9100"
                        strokeWidth="2"
                      />
                      <SvgText
                        x={adsrCoords.p2.x}
                        y={adsrCoords.p2.y - 6}
                        fill={selectedAdsr === 'DELAY' ? '#FF9100' : '#8A9EB8'}
                        fontSize="8"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        D
                      </SvgText>

                      <Circle
                        cx={adsrCoords.p3.x}
                        cy={adsrCoords.p3.y}
                        r={selectedAdsr === 'SUSTAIN' ? '5.5' : '4'}
                        fill={selectedAdsr === 'SUSTAIN' ? '#FF9100' : '#FFFFFF'}
                        stroke="#FF9100"
                        strokeWidth="2"
                      />
                      <SvgText
                        x={adsrCoords.p3.x}
                        y={adsrCoords.p3.y - 6}
                        fill={selectedAdsr === 'SUSTAIN' ? '#FF9100' : '#8A9EB8'}
                        fontSize="8"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        S
                      </SvgText>

                      <Circle
                        cx={adsrCoords.p4.x}
                        cy={adsrCoords.p4.y}
                        r={selectedAdsr === 'RELEASE' ? '5.5' : '4'}
                        fill={selectedAdsr === 'RELEASE' ? '#FF9100' : '#FFFFFF'}
                        stroke="#FF9100"
                        strokeWidth="2"
                      />
                      <SvgText
                        x={adsrCoords.p4.x}
                        y={adsrCoords.p4.y - 6}
                        fill={selectedAdsr === 'RELEASE' ? '#FF9100' : '#8A9EB8'}
                        fontSize="8"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        R
                      </SvgText>
                    </Svg>
                  </View>

                  {/* 2. FILA MEDIA: PERILLA ADSR (IZQ) + FADER DE CUTOFF (DER) */}
                  <View style={styles.adsrMiddleRowWithFilters}>
                    <View style={styles.adsrKnobLeftColSingle}>
                      <ConsoleKnob
                        label={selectedAdsr}
                        value={getAdsrCurrentValue()}
                        displayValue={getAdsrDisplayValue()}
                        size={54}
                        color="#FF9100"
                        onChange={handleAdsrKnobChange}
                      />
                    </View>

                    {/* Fader de CUTOFF a la derecha */}
                    <View style={styles.cutoffSingleCol}>
                      <MiniVerticalFader
                        label="CUTOFF"
                        value={activeFader.cutoff}
                        color="#00E5FF"
                        onChange={(val) => {
                          setFaders((prev) =>
                            prev.map((f) => (f.id === activeFader.id ? { ...f, cutoff: val } : f))
                          );
                          setLayerParam(activeFader.id - 1, 'cutoff', val);
                        }}
                      />
                    </View>
                  </View>

                  {/* 3. ABAJO: 4 Botones ADSR (ATTACK, DELAY, SUSTAIN, RELEASE) */}
                  <View style={styles.adsrFourBtnsRow}>
                    {(['ATTACK', 'DELAY', 'SUSTAIN', 'RELEASE'] as const).map((param) => {
                      const isSel = selectedAdsr === param;
                      let displayVal = '';
                      if (param === 'ATTACK') displayVal = `${Math.round((activeFader.attack / 100) * 500)}ms`;
                      if (param === 'DELAY') displayVal = `${((activeFader.delay / 100) * 4.9 + 0.1).toFixed(1)}s`;
                      if (param === 'SUSTAIN') displayVal = `${activeFader.sustain}%`;
                      if (param === 'RELEASE') displayVal = `${((activeFader.release / 100) * 4.9 + 0.1).toFixed(1)}s`;

                      return (
                        <TouchableOpacity
                          key={param}
                          activeOpacity={0.7}
                          delayPressIn={0}
                          delayPressOut={0}
                          style={[styles.adsrFourBtnPill, isSel && styles.adsrFourBtnPillActive]}
                          onPress={() => setSelectedAdsr(param)}
                        >
                          <Text style={[styles.adsrFourBtnText, isSel && styles.adsrFourBtnTextActive]}>
                            {param}
                          </Text>
                          <Text style={[styles.adsrFourBtnVal, isSel && styles.adsrFourBtnValActive]}>
                            {displayVal}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* TEMPO CONTROL SUBIDO PARA RELLENAR ESPACIO EN BLANCO DIRECTAMENTE BAJO ADSR */}
                <View style={styles.tempoCardShiftedUpDirect}>
                  <Text style={styles.tempoBlockTitleBig}>TEMPO CONTROL</Text>
                  <View style={styles.tempoRowInnerGiant}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      delayPressIn={0}
                      delayPressOut={0}
                      style={styles.tempoMinusBtnGiant}
                      onPress={() => setBpm(Math.max(bpm - 1, 30))}
                    >
                      <Text style={styles.tempoBtnSymbolGiant}>-</Text>
                    </TouchableOpacity>

                    <Text style={styles.tempoBigNumGiant}>
                      {bpm} <Text style={styles.bpmSubTextGiant}>BPM</Text>
                    </Text>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      delayPressIn={0}
                      delayPressOut={0}
                      style={styles.tempoPlusBtnGiant}
                      onPress={() => setBpm(Math.min(bpm + 1, 280))}
                    >
                      <Text style={styles.tempoBtnSymbolGiant}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* FADER DE RESONANCE UBICADO EN EL ESPACIO LIBRE DEBAJO DE TEMPO */}
                <View style={styles.resonanceCardBelowTempo}>
                  <HorizontalFader
                    label="RESONANCE"
                    value={activeFader.resonance}
                    onChange={(val) => {
                      setFaders((prev) =>
                        prev.map((f) => (f.id === activeFader.id ? { ...f, resonance: val } : f))
                      );
                      setLayerParam(activeFader.id - 1, 'resonance', val);
                    }}
                    color="#FF9100"
                    icon="◇"
                  />
                </View>
              </View>

              {/* COLUMNA DERECHA: BANCOS DE MEMORIA */}
              <View style={styles.banksContainerStretchedFullHeight}>
                <Text style={styles.banksHeader}>MEMORY BANKS</Text>
                <View style={styles.banksGridTwoCols}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((bankNum) => {
                    const isActive = activeBank === bankNum;
                    const hasPreset = !!memoryBanksCatalog[bankNum];
                    return (
                      <TouchableOpacity
                        key={bankNum}
                        activeOpacity={0.7}
                        delayPressIn={0}
                        delayPressOut={0}
                        style={[
                          styles.bankCardBtn,
                          hasPreset && styles.bankCardBtnHasPreset,
                          isActive && styles.bankCardBtnActive,
                        ]}
                        onPressIn={() => handleBankPressIn(bankNum)}
                        onPressOut={() => handleBankPressOut(bankNum)}
                      >
                        <Text
                          style={[
                            styles.bankCardBadge,
                            hasPreset && styles.bankCardBadgeHasPreset,
                            isActive && styles.bankCardBadgeActive,
                          ]}
                        >
                          {isActive ? 'EN USO' : hasPreset ? 'GUARDADO' : 'VACÍO'}
                        </Text>
                        <Text
                          style={[
                            styles.bankCardText,
                            hasPreset && styles.bankCardTextHasPreset,
                            isActive && styles.bankCardTextActive,
                          ]}
                        >
                          BANK
                        </Text>
                        <Text
                          style={[
                            styles.bankCardNum,
                            hasPreset && styles.bankCardNumHasPreset,
                            isActive && styles.bankCardNumActive,
                          ]}
                        >
                          {bankNum}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Slider Horizontal de Modulación al Fondo */}
            <View style={styles.rightBottomModRow}>
              <HorizontalFader
                label="MODULATION"
                value={modulation}
                onChange={setModulation}
                color="#00E5FF"
                icon="∿"
              />
            </View>
          </View>
        </View>
      )}

      {/* ================= VISTA 2: LIBRERÍA DE RITMOS (.STY) INTEGRADA ================= */}
      {currentView === 'STYLE_LIBRARY' && (
        <View style={styles.fullScreenLibraryContainer}>
          {/* Barra Superior de Control y Búsqueda */}
          <View style={styles.libNavBar}>
            <TouchableOpacity
              activeOpacity={0.7}
              delayPressIn={0}
              delayPressOut={0}
              style={styles.libBackIconBtn}
              onPress={() => setCurrentView('MAIN')}
            >
              <BackArrowIcon size={16} color="#00E5FF" />
            </TouchableOpacity>

            <View style={styles.libTitleContainer}>
              <Text style={styles.libTitleMain}>LIBRERÍA DE RITMOS (.STY)</Text>
              <Text style={styles.libSubtitle}>
                Ritmo activo: <Text style={styles.libLoadedHighlight}>{loadedStyle.name}</Text> ({loadedStyle.defaultBpm} BPM)
              </Text>
            </View>

            {/* Buscador de Ritmos */}
            <View style={styles.libSearchBox}>
              <View style={styles.libSearchIconWrap}>
                <SearchIcon size={13} color="#7187A1" />
              </View>
              <TextInput
                style={styles.libSearchInput}
                placeholder="Buscar ritmo por nombre..."
                placeholderTextColor="#5C7087"
                value={styleSearchText}
                onChangeText={setStyleSearchText}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {styleSearchText.length > 0 && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  delayPressIn={0}
                  delayPressOut={0}
                  onPress={() => setStyleSearchText('')}
                  style={styles.libSearchClearBtn}
                >
                  <CloseIcon size={10} color="#8A9EB8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Botón Importar .STY con Icono */}
            <TouchableOpacity
              activeOpacity={0.7}
              delayPressIn={0}
              delayPressOut={0}
              style={styles.libImportIconBtn}
              onPress={async () => {
                const targetCat = selectedCategory === 'ALL' ? 'LATIN' : selectedCategory;
                const res = await importStyleFiles(targetCat);
                if (res.importedStyles.length > 0) {
                  showAlert('SUCCESS', 'RITMO IMPORTADO', `Se agregó el ritmo "${res.importedStyles[0].name}" a la categoría ${targetCat}.`);
                }
              }}
            >
              <PlusIcon size={16} color="#000000" />
            </TouchableOpacity>
          </View>

          {/* Selector de Categorías con Contador Numérico */}
          <View style={styles.libCategoriesBar}>
            {STYLE_CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat;
              const count = getStyleCategoryCount(cat);
              return (
                <TouchableOpacity
                  key={cat}
                  activeOpacity={0.7}
                  delayPressIn={0}
                  delayPressOut={0}
                  style={[styles.libCategoryPill, isActive && styles.libCategoryPillActive]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[styles.libCategoryPillText, isActive && styles.libCategoryPillTextActive]}>
                    {cat}
                  </Text>
                  <View style={[styles.libCategoryCountBadge, isActive && styles.libCategoryCountBadgeActive]}>
                    <Text style={[styles.libCategoryCountText, isActive && styles.libCategoryCountTextActive]}>
                      {count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Grid de Ritmos Enumerados */}
          <ScrollView style={styles.libScrollView} contentContainerStyle={styles.libGridContainer}>
            {filteredStyles.length === 0 ? (
              <View style={styles.libEmptyContainer}>
                <Text style={styles.libEmptyText}>No se encontraron ritmos que coincidan con la búsqueda.</Text>
              </View>
            ) : (
              filteredStyles.map((st, index) => {
                const isLoaded = loadedStyle.id === st.id;
                const styleNum = String(index + 1).padStart(2, '0');
                return (
                  <TouchableOpacity
                    key={st.id}
                    activeOpacity={0.8}
                    delayPressIn={0}
                    delayPressOut={0}
                    style={[
                      styles.libCardItem,
                      isLoaded && styles.libCardItemLoaded,
                      st.isCustom && styles.libCardItemCustom,
                    ]}
                    onPress={() => {
                      selectStyle(st);
                      showAlert('SUCCESS', 'RITMO CARGADO', `Se ha seleccionado "${st.name}" (${st.defaultBpm} BPM).`);
                    }}
                  >
                    <View style={styles.libCardTopRow}>
                      <View style={styles.libCardNumBadge}>
                        <Text style={styles.libCardNumText}>#{styleNum}</Text>
                      </View>
                      <View style={styles.libCardCategoryBadge}>
                        <Text style={styles.libCardCategoryText}>{st.isCustom ? 'CUSTOM .STY' : st.category}</Text>
                      </View>
                      <Text style={styles.libCardBpmText}>{st.defaultBpm} BPM</Text>
                    </View>

                    <Text style={[styles.libCardTitle, isLoaded && styles.libCardTitleLoaded]} numberOfLines={1}>
                      {st.name}
                    </Text>

                    <View style={styles.libCardActionsRowRight}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        delayPressIn={0}
                        delayPressOut={0}
                        style={styles.libEditIconBtn}
                        onPress={() => openRenameDialog(st.id, st.name, 'STYLE')}
                      >
                        <EditIcon size={13} color="#8A9EB8" />
                      </TouchableOpacity>

                      {st.isCustom && (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          delayPressIn={0}
                          delayPressOut={0}
                          style={styles.libTrashIconBtn}
                          onPress={() => {
                            showAlert(
                              'WARNING',
                              'ELIMINAR RITMO',
                              `¿Estás seguro de eliminar el ritmo "${st.name}"?`,
                              async () => {
                                await deleteStyleFile(st.id);
                              },
                              true
                            );
                          }}
                        >
                          <TrashIcon size={13} color="#FF5252" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      )}

      {/* ================= VISTA 3: LIBRERÍA DE VOCES & SOUNDFONTS INTEGRADA ================= */}
      {currentView === 'VOICE_LIBRARY' && (
        <View style={styles.fullScreenLibraryContainer}>
          {/* Barra Superior de Control y Búsqueda */}
          <View style={styles.libNavBar}>
            <TouchableOpacity
              activeOpacity={0.7}
              delayPressIn={0}
              delayPressOut={0}
              style={styles.libBackIconBtn}
              onPress={() => setCurrentView('MAIN')}
            >
              <BackArrowIcon size={16} color="#00E5FF" />
            </TouchableOpacity>

            <View style={styles.libTitleContainer}>
              <Text style={styles.libTitleMain}>LIBRERÍA DE VOCES & SOUNDFONTS</Text>
              {/* Selector de Canal Destino F1..F4 */}
              <View style={styles.libTargetFaderBar}>
                <Text style={styles.libTargetFaderLabel}>ASIGNAR A:</Text>
                {[1, 2, 3, 4].map((fId) => {
                  const isSel = targetFaderId === fId;
                  const fName = faders.find((f) => f.id === fId)?.name || `FADER ${fId}`;
                  return (
                    <TouchableOpacity
                      key={fId}
                      activeOpacity={0.7}
                      delayPressIn={0}
                      delayPressOut={0}
                      style={[styles.libTargetFaderPill, isSel && styles.libTargetFaderPillActive]}
                      onPress={() => setTargetFaderId(fId)}
                    >
                      <Text style={[styles.libTargetFaderNum, isSel && styles.libTargetFaderNumActive]}>F{fId}</Text>
                      <Text style={[styles.libTargetFaderName, isSel && styles.libTargetFaderNameActive]} numberOfLines={1}>
                        {fName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Buscador de Voces */}
            <View style={styles.libSearchBox}>
              <View style={styles.libSearchIconWrap}>
                <SearchIcon size={13} color="#7187A1" />
              </View>
              <TextInput
                style={styles.libSearchInput}
                placeholder="Buscar sonido..."
                placeholderTextColor="#5C7087"
                value={voiceSearchText}
                onChangeText={setVoiceSearchText}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {voiceSearchText.length > 0 && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  delayPressIn={0}
                  delayPressOut={0}
                  onPress={() => setVoiceSearchText('')}
                  style={styles.libSearchClearBtn}
                >
                  <CloseIcon size={10} color="#8A9EB8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Botón Importar .SF2 con Icono */}
            <TouchableOpacity
              activeOpacity={0.7}
              delayPressIn={0}
              delayPressOut={0}
              style={styles.libImportIconBtn}
              onPress={handleImportSoundFile}
            >
              <PlusIcon size={16} color="#000000" />
            </TouchableOpacity>
          </View>

          {/* Categorías de Filtro con Contadores */}
          <View style={styles.libCategoriesBar}>
            {VOICE_CATEGORIES.map((cat) => {
              const isActive = selectedVoiceCategory === cat;
              const count = getVoiceCategoryCount(cat);
              return (
                <TouchableOpacity
                  key={cat}
                  activeOpacity={0.7}
                  delayPressIn={0}
                  delayPressOut={0}
                  style={[styles.libCategoryPill, isActive && styles.libCategoryPillActive]}
                  onPress={() => setSelectedVoiceCategory(cat)}
                >
                  <Text style={[styles.libCategoryPillText, isActive && styles.libCategoryPillTextActive]}>
                    {cat}
                  </Text>
                  <View style={[styles.libCategoryCountBadge, isActive && styles.libCategoryCountBadgeActive]}>
                    <Text style={[styles.libCategoryCountText, isActive && styles.libCategoryCountTextActive]}>
                      {count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Grid de Voces Enumeradas */}
          <ScrollView style={styles.libScrollView} contentContainerStyle={styles.libGridContainer}>
            {filteredVoices.length === 0 ? (
              <View style={styles.libEmptyContainer}>
                <Text style={styles.libEmptyText}>No se encontraron sonidos que coincidan con la búsqueda.</Text>
              </View>
            ) : (
              filteredVoices.map((v, index) => {
                const isAssigned = faders.find((f) => f.id === targetFaderId)?.name === v.name;
                const voiceNum = String(index + 1).padStart(3, '0');
                return (
                  <TouchableOpacity
                    key={v.id}
                    activeOpacity={0.8}
                    delayPressIn={0}
                    delayPressOut={0}
                    style={[
                      styles.libCardItem,
                      isAssigned && styles.libCardItemLoaded,
                      v.isCustom && styles.libCardItemCustom,
                    ]}
                    onPress={() => {
                      auditionVoice(v.sf2Preset, v.sf2Path || '', 60, 100);
                      setTimeout(() => auditionStop(60), 450);
                    }}
                  >
                    <View style={styles.libCardTopRow}>
                      <View style={styles.libCardNumBadge}>
                        <Text style={styles.libCardNumText}>#{voiceNum}</Text>
                      </View>
                      <View style={styles.libCardCategoryBadge}>
                        <Text style={styles.libCardCategoryText}>{v.category}</Text>
                      </View>
                      <Text style={styles.libCardBpmText}>{v.isCustom ? '[LOCAL SF2]' : `PR #${v.sf2Preset}`}</Text>
                    </View>

                    <Text style={[styles.libCardTitle, isAssigned && styles.libCardTitleLoaded]} numberOfLines={1}>
                      {v.name}
                    </Text>

                    <View style={styles.libCardActionsRowRight}>
                      {/* Botón Asignar a Fader Destino con Icono */}
                      <TouchableOpacity
                        activeOpacity={0.7}
                        delayPressIn={0}
                        delayPressOut={0}
                        style={[styles.libAssignIconBtn, isAssigned && styles.libAssignIconBtnActive]}
                        onPress={() => {
                          const targetIdx = targetFaderId - 1;
                          setFaders((prev) =>
                            prev.map((f) => (f.id === targetFaderId ? { ...f, name: v.name } : f))
                          );
                          setLayerVoice(targetIdx, v.name, v.sf2Preset, v.sf2Path || '');
                          auditionVoice(v.sf2Preset, v.sf2Path || '', 60, 100);
                          setTimeout(() => auditionStop(60), 400);
                          showAlert('SUCCESS', 'VOZ ASIGNADA', `"${v.name}" asignado a FADER ${targetFaderId}.`);
                        }}
                      >
                        <AssignIcon size={14} color={isAssigned ? '#00E5FF' : '#8A9EB8'} />
                      </TouchableOpacity>

                      {/* Botón Editar Nombre */}
                      <TouchableOpacity
                        activeOpacity={0.7}
                        delayPressIn={0}
                        delayPressOut={0}
                        style={styles.libEditIconBtn}
                        onPress={() => openRenameDialog(v.id, v.name, 'VOICE')}
                      >
                        <EditIcon size={13} color="#8A9EB8" />
                      </TouchableOpacity>

                      {/* Botón Eliminar Sonido */}
                      <TouchableOpacity
                        activeOpacity={0.7}
                        delayPressIn={0}
                        delayPressOut={0}
                        style={styles.libTrashIconBtn}
                        onPress={() => handleDeleteVoice(v.id, v.name)}
                      >
                        <TrashIcon size={13} color="#FF5252" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      )}

      {/* MODAL DE EDICIÓN DE NOMBRE (RENOMBRAR) */}
      <Modal
        visible={renameDialog.visible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setRenameDialog({ visible: false, targetId: '', currentName: '', type: 'STYLE' })}
      >
        <View style={styles.consoleAlertOverlay}>
          <View style={styles.renameBox}>
            <View style={styles.consoleAlertHeader}>
              <Text style={styles.renameBadge}>EDITAR NOMBRE</Text>
              <Text style={styles.consoleAlertTitleText}>
                {renameDialog.type === 'STYLE' ? 'Renombrar Ritmo' : 'Renombrar Sonido'}
              </Text>
            </View>

            <TextInput
              style={styles.renameInput}
              value={renameInputText}
              onChangeText={setRenameInputText}
              autoFocus={true}
              selectTextOnFocus={true}
              placeholder="Ingresa el nuevo nombre..."
              placeholderTextColor="#5C7087"
            />

            <View style={styles.consoleAlertActionsRow}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.consoleAlertCancelBtn}
                onPress={() => setRenameDialog({ visible: false, targetId: '', currentName: '', type: 'STYLE' })}
              >
                <Text style={styles.consoleAlertCancelBtnText}>CANCELAR</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.renameSaveBtn}
                onPress={handleSaveRename}
              >
                <Text style={styles.renameSaveBtnText}>GUARDAR NOMBRE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DE ALERTA Y NOTIFICACIONES DE CONSOLA PERSONALIZADO */}
      <Modal
        visible={consoleAlert.visible}
        animationType="fade"
        transparent={true}
        onRequestClose={hideAlert}
      >
        <View style={styles.consoleAlertOverlay}>
          <View
            style={[
              styles.consoleAlertBox,
              consoleAlert.type === 'ERROR' && styles.consoleAlertBoxError,
              consoleAlert.type === 'SUCCESS' && styles.consoleAlertBoxSuccess,
            ]}
          >
            <View style={styles.consoleAlertHeader}>
              <Text
                style={[
                  styles.consoleAlertBadge,
                  consoleAlert.type === 'ERROR' && styles.consoleAlertBadgeError,
                ]}
              >
                {consoleAlert.type === 'ERROR'
                  ? 'ERROR FORMATO'
                  : consoleAlert.type === 'SUCCESS'
                  ? 'EXITO'
                  : 'INFORMACION'}
              </Text>
              <Text style={styles.consoleAlertTitleText}>{consoleAlert.title}</Text>
            </View>

            <Text style={styles.consoleAlertMessageText}>{consoleAlert.message}</Text>

            <View style={styles.consoleAlertActionsRow}>
              {consoleAlert.showCancel && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  delayPressIn={0}
                  delayPressOut={0}
                  style={styles.consoleAlertCancelBtn}
                  onPress={hideAlert}
                >
                  <Text style={styles.consoleAlertCancelBtnText}>CANCELAR</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                activeOpacity={0.7}
                delayPressIn={0}
                delayPressOut={0}
                style={[
                  styles.consoleAlertConfirmBtn,
                  consoleAlert.type === 'ERROR' && styles.consoleAlertConfirmBtnError,
                ]}
                onPress={() => {
                  const cb = consoleAlert.onConfirm;
                  hideAlert();
                  if (cb) cb();
                }}
              >
                <Text style={styles.consoleAlertConfirmBtnText}>
                  {consoleAlert.showCancel ? 'CONFIRMAR' : 'ENTENDIDO'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DE CONEXIÓN BLUETOOTH MIDI */}
      <Modal
        visible={isBleModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setIsBleModalVisible(false);
          stopBleScan();
        }}
      >
        <View style={styles.consoleAlertOverlay}>
          <View style={styles.bleModalBox}>
            {/* Header del Modal */}
            <View style={styles.bleModalHeader}>
              <View style={styles.bleModalHeaderLeft}>
                <View style={styles.bleIconCircle}>
                  <BluetoothIcon size={16} color="#00E5FF" />
                </View>
                <View>
                  <Text style={styles.bleModalTitle}>CONEXIÓN BLUETOOTH MIDI</Text>
                  <Text style={styles.bleModalSubtitle}>Soporte para M-Vave, CME, Korg, Roland BLE</Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.bleModalCloseBtn}
                onPress={() => {
                  setIsBleModalVisible(false);
                  stopBleScan();
                }}
              >
                <CloseIcon size={12} color="#8A9EB8" />
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
                    onPress={() => {
                      disconnect();
                      showAlert('INFO', 'DESCONECTADO', 'Dispositivo MIDI desconectado.');
                    }}
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
                  onPress={async () => {
                    if (isScanningBle) {
                      stopBleScan();
                    } else {
                      const granted = await requestBluetoothPermissions();
                      if (granted) {
                        startBleScan();
                      }
                    }
                  }}
                >
                  <RefreshIcon size={12} color={isScanningBle ? '#FF5252' : '#000000'} />
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
                    const isCurrent = connectedBleDevice?.name.toLowerCase() === dev.name.toLowerCase() || dev.isConnected;
                    const isConnecting = isConnectingAddress === dev.address;

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
                            <BluetoothIcon size={14} color={isCurrent ? '#00E5FF' : '#7187A1'} />
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
                              onPress={() => handleConnectBleDevice(dev)}
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
    </SafeAreaView>
  );
}

// ===================================================
// ESTILOS DE DISEÑO PROFESIONAL
// ===================================================
const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#090D14',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  absoluteCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  header: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#101622',
    borderRadius: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#192433',
    position: 'relative',
  },
  midiStatusBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#06090E',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#131C28',
    gap: 4,
  },
  midiStatusBoxHeaderConnected: {
    borderColor: '#00E5FF55',
    backgroundColor: '#071824',
  },
  midiStatusTextHeader: {
    color: '#6B829D',
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  midiStatusTextHeaderConnected: {
    color: '#00E5FF',
    fontWeight: '900',
  },
  btHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A121F',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#192C44',
    gap: 4,
  },
  btHeaderBtnConnected: {
    backgroundColor: '#071D2B',
    borderColor: '#00E5FF',
  },
  btHeaderBtnScanning: {
    borderColor: '#2979FF',
    backgroundColor: '#0C1A30',
  },
  btHeaderBtnText: {
    color: '#8A9EB8',
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  btHeaderBtnTextConnected: {
    color: '#00E5FF',
    fontWeight: '900',
  },
  btHeaderBtnTextScanning: {
    color: '#64B5F6',
  },
  btHeaderConnectedDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#00E676',
    marginLeft: 1,
  },

  // ================= ESTILOS MODAL BLUETOOTH =================
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
  bleModalTitle: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  bleModalSubtitle: {
    color: '#657E9A',
    fontSize: 7.5,
    fontWeight: '600',
    marginTop: 1,
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
  bleLedIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bleLedConnected: {
    backgroundColor: '#00E676',
  },
  bleLedScanning: {
    backgroundColor: '#00E5FF',
  },
  bleLedIdle: {
    backgroundColor: '#50637A',
  },
  bleStatusText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  bleLatencyText: {
    color: '#00E676',
    fontSize: 7,
    fontWeight: '700',
    marginTop: 2,
    marginLeft: 14,
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
  bleScanningDotPulse: {
    color: '#00E5FF',
    fontSize: 7,
    fontWeight: '800',
  },
  bleDevicesScrollView: {
    flex: 1,
  },
  bleDevicesScrollContent: {
    gap: 4,
    paddingBottom: 4,
  },
  bleEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  bleEmptyTitle: {
    color: '#A0B2C6',
    fontSize: 8.5,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  bleEmptyDesc: {
    color: '#526982',
    fontSize: 7,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 11,
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
  bleDeviceName: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  bleDeviceNameActive: {
    color: '#00E5FF',
  },
  bleDeviceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  bleDeviceAddress: {
    color: '#5C7491',
    fontSize: 6.5,
    fontWeight: '700',
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
  bleDeviceCardRight: {
    marginLeft: 8,
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
  bleDotGreenMini: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#00E676',
  },
  bleConnectedBadgeText: {
    color: '#00E676',
    fontSize: 6.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
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
  bleModalFooter: {
    marginTop: 6,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: '#121D2C',
  },
  bleFooterTipText: {
    color: '#526982',
    fontSize: 6.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerCenterAbsolute: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  headerTitleCyan: {
    color: '#00E5FF',
  },
  headerTitlePro: {
    color: '#00A3FF',
    fontStyle: 'italic',
    fontWeight: '700',
  },
  headerRightInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sysTimeText: {
    color: '#A0B3C9',
    fontSize: 9,
    fontWeight: '700',
    marginRight: 10,
  },
  sysDotGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00E676',
    marginRight: 5,
  },
  sysBattery: {
    color: '#00E676',
    fontSize: 9,
    fontWeight: '800',
  },
  mainWorkspace: {
    flex: 1,
    flexDirection: 'row',
    marginTop: 4,
  },

  // ================= STYLES PANEL (LEFT) =================
  leftPanel: {
    width: '31%',
    backgroundColor: '#0D121B',
    borderRadius: 8,
    padding: 5,
    marginRight: 4,
    borderWidth: 1,
    borderColor: '#17202C',
    justifyContent: 'space-between',
  },
  panelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  panelTitle: {
    color: '#44576E',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  menuIcon: {
    color: '#44576E',
    fontSize: 12,
  },
  stylesListContainer: {
    backgroundColor: '#070A0F',
    borderRadius: 6,
    padding: 2,
    borderWidth: 1,
    borderColor: '#121A24',
    maxHeight: 90,
  },
  stylesListScroll: {
    maxHeight: 86,
  },
  styleItemRow: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginBottom: 1,
  },
  styleItemRowSelected: {
    backgroundColor: '#122233',
    borderWidth: 1,
    borderColor: '#00E5FF',
  },
  styleItemText: {
    color: '#5C7087',
    fontSize: 9,
    fontWeight: '600',
  },
  styleItemTextSelected: {
    color: '#00E5FF',
    fontWeight: '800',
  },
  styleSectionsMatrix: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  sectionCol: {
    width: '23.5%',
    justifyContent: 'space-between',
  },
  sectionBtnRect: {
    height: 27,
    borderRadius: 4,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2.5,
    paddingHorizontal: 2,
    marginBottom: 3,
    borderWidth: 1,
  },
  sectionBtnQueued: {
    borderColor: '#FFD700',
    backgroundColor: '#2A2000',
    shadowColor: '#FFD700',
    shadowOpacity: 0.9,
    shadowRadius: 5,
  },
  queuedText: {
    color: '#FFD700',
    fontWeight: '900',
  },
  beatIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  beatDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#1E293B',
  },
  beatDotIntroActive: {
    backgroundColor: '#FFB300',
    shadowColor: '#FFB300',
    shadowOpacity: 1,
    shadowRadius: 3,
  },
  beatDotMainActive: {
    backgroundColor: '#00E5FF',
    shadowColor: '#00E5FF',
    shadowOpacity: 1,
    shadowRadius: 3,
  },
  beatDotEndingActive: {
    backgroundColor: '#FF1744',
    shadowColor: '#FF1744',
    shadowOpacity: 1,
    shadowRadius: 3,
  },
  sectionBtnText: {
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  introBtn: {
    backgroundColor: '#1C1508',
    borderColor: '#FFB30055',
  },
  introBtnActive: {
    backgroundColor: '#FFB300',
    borderColor: '#FFD54F',
    shadowColor: '#FFB300',
    shadowOpacity: 0.9,
    shadowRadius: 5,
  },
  introText: {
    color: '#FFB300',
  },
  introTextActive: {
    color: '#000000',
    fontWeight: '900',
  },
  mainBtn: {
    backgroundColor: '#081720',
    borderColor: '#00E5FF44',
  },
  mainBtnActive: {
    backgroundColor: '#00E5FF',
    borderColor: '#80D8FF',
    shadowColor: '#00E5FF',
    shadowOpacity: 0.9,
    shadowRadius: 5,
  },
  mainText: {
    color: '#00E5FF',
  },
  mainTextActive: {
    color: '#000000',
    fontWeight: '900',
  },
  endingBtn: {
    backgroundColor: '#200A0A',
    borderColor: '#FF174444',
  },
  endingBtnActive: {
    backgroundColor: '#FF1744',
    borderColor: '#FF5252',
    shadowColor: '#FF1744',
    shadowOpacity: 0.9,
    shadowRadius: 5,
  },
  endingText: {
    color: '#FF5252',
  },
  endingTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },

  // ================= PERFORMANCE LAYERS (CENTER) =================
  centerPanel: {
    width: '34%',
    backgroundColor: '#0D121B',
    borderRadius: 8,
    padding: 5,
    marginRight: 4,
    borderWidth: 1,
    borderColor: '#17202C',
    justifyContent: 'space-between',
  },
  fadersGridSeparated: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
    marginVertical: 2,
  },
  faderChannelCard: {
    width: '23.5%',
    backgroundColor: '#070A10',
    borderRadius: 6,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#141E2C',
  },
  faderChannelCardSelected: {
    borderColor: '#00E5FF',
    borderWidth: 2,
    shadowColor: '#00E5FF',
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 4,
  },
  faderHeaderTitle: {
    color: '#3B4D63',
    fontSize: 7,
    fontWeight: '800',
  },
  faderHeaderTitleSelected: {
    color: '#00E5FF',
    fontWeight: '900',
  },
  faderVoiceName: {
    color: '#00E5FF',
    fontSize: 7.5,
    fontWeight: '700',
    height: 26,
    textAlign: 'center',
    lineHeight: 8.5,
    marginVertical: 1,
  },
  soloMuteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 2,
  },
  pillBtnSolo: {
    width: '47%',
    paddingVertical: 2,
    backgroundColor: '#101620',
    borderRadius: 3,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#172332',
  },
  pillBtnSoloActive: {
    backgroundColor: '#00A3FF',
    borderColor: '#00E5FF',
  },
  pillBtnMute: {
    width: '47%',
    paddingVertical: 2,
    backgroundColor: '#101620',
    borderRadius: 3,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#172332',
  },
  pillBtnMuteActive: {
    backgroundColor: '#FF3D00',
    borderColor: '#FF8A80',
  },
  pillBtnText: {
    color: '#4C6078',
    fontSize: 6,
    fontWeight: '800',
  },
  pillBtnTextActive: {
    color: '#FFFFFF',
  },
  faderTrackWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    width: '100%',
  },
  vuMeterContainer: {
    width: 4,
    height: 140,
    backgroundColor: '#06080D',
    borderRadius: 2,
    justifyContent: 'space-between',
    marginRight: 3,
    paddingVertical: 1,
  },
  vuLedSegment: {
    width: 4,
    height: 8,
    borderRadius: 1,
  },
  faderSlimTrack: {
    width: 12,
    height: 140,
    backgroundColor: '#070A0F',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#151E2B',
    position: 'relative',
    justifyContent: 'flex-end',
    alignItems: 'center',
    overflow: 'visible',
  },
  faderCenterLine: {
    position: 'absolute',
    width: 2,
    height: '100%',
    backgroundColor: '#172333',
  },
  faderFillBar: {
    width: '100%',
    backgroundColor: '#00E5FF',
    borderRadius: 1,
    opacity: 0.85,
  },
  faderRectThumbCap: {
    position: 'absolute',
    width: 26,
    height: 14,
    borderRadius: 3,
    backgroundColor: '#1E2B3D',
    borderWidth: 1,
    borderColor: '#00E5FF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00E5FF',
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 4,
  },
  faderCapCyanLine: {
    width: 12,
    height: 2,
    backgroundColor: '#00E5FF',
    borderRadius: 1,
  },
  faderValDisplay: {
    color: '#00E5FF',
    fontSize: 7,
    fontWeight: '800',
    marginTop: 2,
  },
  centerBottomControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  octaveTrpBlock: {
    width: '48.5%',
    backgroundColor: '#06090E',
    borderRadius: 6,
    padding: 3,
    borderWidth: 1,
    borderColor: '#121A24',
    alignItems: 'center',
  },
  octaveTrpTitle: {
    color: '#3B4D63',
    fontSize: 6.5,
    fontWeight: '800',
  },
  octaveTrpRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 2,
  },
  octaveMinusBtn: {
    width: 24,
    height: 24,
    backgroundColor: '#0F1620',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1C2B3E',
  },
  octavePlusBtn: {
    width: 24,
    height: 24,
    backgroundColor: '#00E5FF',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  octaveBtnSymbol: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  octaveValueText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },

  // ================= RIGHT PANEL =================
  rightPanel: {
    flex: 1,
    backgroundColor: '#0D121B',
    borderRadius: 8,
    padding: 5,
    borderWidth: 1,
    borderColor: '#17202C',
    justifyContent: 'space-between',
  },
  rightTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
    marginBottom: 4,
  },
  adsrAndTempoLeftCol: {
    width: '61%',
    justifyContent: 'space-between',
  },
  adsrCardContainerCompact: {
    backgroundColor: '#06090E',
    borderRadius: 6,
    padding: 4,
    borderWidth: 1,
    borderColor: '#121A24',
  },
  adsrGraphCardBox: {
    height: 60,
    width: '100%',
    backgroundColor: '#0A0F17',
    borderRadius: 4,
    padding: 1,
    borderWidth: 1,
    borderColor: '#16202E',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  adsrMiddleRowWithFilters: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  adsrKnobLeftColSingle: {
    width: '50%',
    alignItems: 'center',
  },
  cutoffSingleCol: {
    width: '45%',
    alignItems: 'center',
  },
  miniFaderCol: {
    alignItems: 'center',
    height: 92,
    justifyContent: 'space-between',
  },
  miniFaderLabel: {
    color: '#3B4D63',
    fontSize: 6,
    fontWeight: '800',
  },
  miniFaderTrack: {
    width: 12,
    height: 68,
    backgroundColor: '#0A0F17',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#16202E',
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  miniFaderCenterLine: {
    position: 'absolute',
    width: 2,
    height: '100%',
    backgroundColor: '#16202E',
  },
  miniFaderFill: {
    width: '100%',
    borderRadius: 2,
  },
  miniFaderCap3D: {
    position: 'absolute',
    width: 20,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#1E2B3D',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00E5FF',
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 3,
  },
  miniFaderCapLine: {
    width: 10,
    height: 1.5,
    borderRadius: 1,
  },
  miniFaderValText: {
    fontSize: 7,
    fontWeight: '800',
  },
  adsrFourBtnsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  adsrFourBtnPill: {
    width: '23.5%',
    paddingVertical: 3,
    backgroundColor: '#0F1620',
    borderRadius: 3,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#172332',
  },
  adsrFourBtnPillActive: {
    backgroundColor: '#1C293A',
    borderColor: '#FF9100',
  },
  adsrFourBtnText: {
    color: '#3B4D63',
    fontSize: 5.5,
    fontWeight: '800',
  },
  adsrFourBtnTextActive: {
    color: '#FF9100',
    fontWeight: '900',
  },
  adsrFourBtnVal: {
    color: '#5C7087',
    fontSize: 6.5,
    fontWeight: '800',
    marginTop: 1,
  },
  adsrFourBtnValActive: {
    color: '#FFFFFF',
  },

  // Tarjeta de Tempo desplazada directamente debajo de ADSR
  tempoCardShiftedUpDirect: {
    backgroundColor: '#06090E',
    borderRadius: 6,
    padding: 3,
    borderWidth: 1,
    borderColor: '#121A24',
    alignItems: 'center',
    marginTop: 3,
  },
  tempoBlockTitleBig: {
    color: '#3B4D63',
    fontSize: 6.5,
    fontWeight: '800',
  },
  tempoRowInnerGiant: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 1,
    paddingHorizontal: 4,
  },
  tempoBigNumGiant: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  bpmSubTextGiant: {
    color: '#00E676',
    fontSize: 7,
    fontWeight: '700',
  },
  tempoMinusBtnGiant: {
    width: 26,
    height: 26,
    backgroundColor: '#0F1620',
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1C2B3E',
  },
  tempoPlusBtnGiant: {
    width: 26,
    height: 26,
    backgroundColor: '#00E676',
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tempoBtnSymbolGiant: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  // Tarjeta de Resonancia debajo de Tempo
  resonanceCardBelowTempo: {
    backgroundColor: '#06090E',
    borderRadius: 6,
    padding: 4,
    borderWidth: 1,
    borderColor: '#121A24',
    marginTop: 3,
  },

  // Tarjeta de Bancos de Memoria
  banksContainerStretchedFullHeight: {
    width: '37%',
    backgroundColor: '#06090E',
    borderRadius: 6,
    padding: 4,
    borderWidth: 1,
    borderColor: '#121A24',
    justifyContent: 'space-between',
  },
  banksHeader: {
    color: '#3B4D63',
    fontSize: 7,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 2,
  },
  banksGridTwoCols: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'space-between',
  },
  bankCardBtn: {
    width: '48%',
    height: '23.5%',
    backgroundColor: '#0D131C',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  bankCardBtnHasPreset: {
    borderColor: '#00E5FF',
    backgroundColor: '#071B26',
  },
  bankCardBtnActive: {
    backgroundColor: '#072414',
    borderColor: '#00E676',
  },
  bankCardBadge: {
    fontSize: 5,
    fontWeight: '900',
    color: '#475569',
    letterSpacing: 0.5,
    marginBottom: -1,
  },
  bankCardBadgeHasPreset: {
    color: '#00E5FF',
  },
  bankCardBadgeActive: {
    color: '#00E676',
  },
  bankCardText: {
    color: '#64748B',
    fontSize: 5,
    fontWeight: '800',
  },
  bankCardTextHasPreset: {
    color: '#00E5FF',
  },
  bankCardTextActive: {
    color: '#00E676',
  },
  bankCardNum: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '900',
  },
  bankCardNumHasPreset: {
    color: '#00E5FF',
  },
  bankCardNumActive: {
    color: '#00E676',
  },

  // Componentes de Fader Horizontal 3D
  hFaderWrapper: {
    width: '100%',
    marginVertical: 1,
  },
  hFaderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 1,
  },
  hFaderLabel: {
    color: '#3B4D63',
    fontSize: 7,
    fontWeight: '800',
  },
  hFaderValText: {
    fontSize: 8,
    fontWeight: '700',
  },
  hFaderTrackRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 14,
  },
  hFaderIconText: {
    fontSize: 10,
    marginRight: 4,
  },
  hFaderTrackSlot: {
    flex: 1,
    height: 10,
    backgroundColor: '#06080D',
    borderRadius: 4,
    position: 'relative',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#121A24',
    overflow: 'visible',
  },
  hFaderGrooveLine: {
    position: 'absolute',
    width: '100%',
    height: 2,
    backgroundColor: '#16202E',
  },
  hFaderFillBar: {
    height: '100%',
    borderRadius: 3,
    opacity: 0.85,
  },
  hFaderMasterCap3D: {
    position: 'absolute',
    width: 22,
    height: 16,
    borderRadius: 3,
    backgroundColor: '#1E2B3D',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00E5FF',
    shadowOpacity: 0.7,
    shadowRadius: 4,
    elevation: 4,
  },
  hFaderCapGlowLine: {
    width: 2,
    height: 10,
    borderRadius: 1,
  },
  rightBottomModRow: {
    width: '100%',
    backgroundColor: '#06090E',
    borderRadius: 6,
    padding: 4,
    borderWidth: 1,
    borderColor: '#121A24',
  },
  knobCol: {
    alignItems: 'center',
  },
  knobOuterCircle: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0F17',
    borderWidth: 1,
    borderColor: '#16202E',
    position: 'relative',
  },
  knobDialBody: {
    backgroundColor: '#16202E',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 3,
    borderWidth: 1,
    borderColor: '#263447',
    position: 'relative',
  },
  knobDialIndicator: {
    width: 3,
    height: 7,
    borderRadius: 1.5,
  },
  knobTitleText: {
    color: '#3B4D63',
    fontSize: 7,
    fontWeight: '800',
    marginTop: 2,
  },
  knobValueText: {
    fontSize: 8,
    fontWeight: '700',
  },
  // Modal Overlay & Content Box
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(4, 7, 12, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  modalContentBox: {
    width: '95%',
    height: '92%',
    backgroundColor: '#0B1019',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#00E5FF',
    padding: 12,
    shadowColor: '#00E5FF',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#162335',
    paddingBottom: 6,
  },
  modalTitleBox: {
    flex: 1,
  },
  modalTitleText: {
    color: '#00E5FF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  modalSubTitleText: {
    color: '#657D99',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },
  modalCloseBtn: {
    backgroundColor: '#1E2A3A',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#30455E',
  },
  modalCloseBtnText: {
    color: '#FF5252',
    fontSize: 10,
    fontWeight: '800',
  },
  targetFaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  targetFaderLabel: {
    color: '#8CA3BF',
    fontSize: 9,
    fontWeight: '800',
    marginRight: 4,
  },
  targetFaderBtn: {
    flex: 1,
    backgroundColor: '#0D1522',
    borderWidth: 1,
    borderColor: '#19283D',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  targetFaderBtnActive: {
    backgroundColor: '#002B3D',
    borderColor: '#00E5FF',
  },
  targetFaderBtnNum: {
    color: '#3D5470',
    fontSize: 9,
    fontWeight: '900',
  },
  targetFaderBtnNumActive: {
    color: '#00E5FF',
  },
  targetFaderBtnName: {
    color: '#7F9BB8',
    fontSize: 9,
    fontWeight: '700',
    flex: 1,
  },
  targetFaderBtnNameActive: {
    color: '#FFFFFF',
  },
  categoriesBar: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  categoryPill: {
    flex: 1,
    backgroundColor: '#0F1826',
    borderWidth: 1,
    borderColor: '#1C2D45',
    borderRadius: 4,
    paddingVertical: 4,
    alignItems: 'center',
  },
  categoryPillActive: {
    backgroundColor: '#00E5FF',
    borderColor: '#00E5FF',
  },
  categoryPillText: {
    color: '#6F8AA8',
    fontSize: 9,
    fontWeight: '800',
  },
  categoryPillTextActive: {
    color: '#050911',
  },
  consoleAlertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 16, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  consoleAlertBox: {
    width: '85%',
    maxWidth: 380,
    backgroundColor: '#0B131E',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#00E5FF',
    padding: 16,
  },
  consoleAlertBoxError: {
    borderColor: '#FF2A4B',
  },
  consoleAlertBoxSuccess: {
    borderColor: '#00E5FF',
  },
  consoleAlertHeader: {
    marginBottom: 8,
  },
  consoleAlertBadge: {
    fontSize: 9,
    fontWeight: '900',
    color: '#00E5FF',
    letterSpacing: 1,
    marginBottom: 4,
  },
  consoleAlertBadgeError: {
    color: '#FF2A4B',
  },
  consoleAlertTitleText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  consoleAlertMessageText: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 16,
  },
  consoleAlertActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  consoleAlertCancelBtn: {
    height: 30,
    paddingHorizontal: 14,
    borderRadius: 4,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  consoleAlertCancelBtnText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  consoleAlertConfirmBtn: {
    height: 30,
    paddingHorizontal: 16,
    borderRadius: 4,
    backgroundColor: '#00E5FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  consoleAlertConfirmBtnError: {
    backgroundColor: '#FF2A4B',
  },
  consoleAlertConfirmBtnText: {
    color: '#090E17',
    fontSize: 10,
    fontWeight: '900',
  },
  voicesScrollView: {
    flex: 1,
  },
  voicesGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 10,
  },
  voiceCardItem: {
    width: '32%',
    backgroundColor: '#0E1724',
    borderWidth: 1,
    borderColor: '#1A293D',
    borderRadius: 6,
    padding: 8,
  },
  voiceCardItemActive: {
    backgroundColor: '#072535',
    borderColor: '#00E5FF',
  },
  voiceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  voiceCardCategory: {
    color: '#00E5FF',
    fontSize: 8,
    fontWeight: '800',
  },
  voiceCardPreset: {
    color: '#526A87',
    fontSize: 8,
    fontWeight: '700',
  },
  voiceCardName: {
    color: '#D0E1F5',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 6,
  },
  voiceCardNameActive: {
    color: '#FFFFFF',
  },
  voiceCardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#162335',
    paddingTop: 4,
    alignItems: 'flex-start',
  },
  voiceAssignBadge: {
    color: '#4B6380',
    fontSize: 7.5,
    fontWeight: '700',
  },
  voiceAssignBadgeActive: {
    color: '#00E5FF',
    fontWeight: '900',
  },
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalImportBtn: {
    backgroundColor: '#00B0FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  modalImportBtnText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  modalIconBtnImport: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 5,
    backgroundColor: '#00E5FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00E5FF',
  },
  modalIconBtnImportText: {
    color: '#090E17',
    fontSize: 16,
    fontWeight: '900',
  },
  modalIconBtnClose: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 5,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalIconBtnCloseText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: 'bold',
  },
  styleItemRowEmpty: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginBottom: 1,
    height: 20,
    justifyContent: 'center',
  },
  styleItemTextEmpty: {
    color: '#26354A',
    fontSize: 8,
    fontStyle: 'italic',
    fontWeight: '600',
  },
  styleCategoriesBar: {
    maxHeight: 26,
    marginBottom: 4,
  },
  styleCategoryPillMini: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#101726',
    borderWidth: 1,
    borderColor: '#19263B',
    marginRight: 4,
  },
  styleCategoryPillMiniActive: {
    backgroundColor: '#00E5FF',
    borderColor: '#00E5FF',
  },
  styleCategoryPillMiniText: {
    color: '#8A9EB8',
    fontSize: 8,
    fontWeight: '700',
  },
  styleCategoryPillMiniTextActive: {
    color: '#090E17',
    fontWeight: '900',
  },
  voiceCardItemCustom: {
    borderColor: '#00B0FF',
  },
  voiceTrashBtn: {
    marginTop: 4,
    backgroundColor: '#3B1219',
    borderColor: '#FF2A4B',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  voiceTrashBtnText: {
    color: '#FF2A4B',
    fontSize: 7,
    fontWeight: '900',
  },

  // ================= ESTILOS DE VISTAS INTEGRADAS A PANTALLA COMPLETA =================
  fullScreenLibraryContainer: {
    flex: 1,
    backgroundColor: '#070A0F',
    paddingHorizontal: 6,
    paddingTop: 4,
    paddingBottom: 6,
  },
  libNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0D121B',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 4,
  },
  libBackIconBtn: {
    width: 28,
    height: 28,
    backgroundColor: '#162232',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#00E5FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  libTitleContainer: {
    flex: 1,
    marginHorizontal: 8,
  },
  libTitleMain: {
    color: '#E2E8F0',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  libSubtitle: {
    color: '#8A9EB8',
    fontSize: 7.5,
    marginTop: 1,
  },
  libLoadedHighlight: {
    color: '#00E5FF',
    fontWeight: '900',
  },
  libSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#080C14',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 6,
    height: 26,
    width: 170,
    marginRight: 6,
  },
  libSearchIconWrap: {
    marginRight: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  libSearchInput: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 8.5,
    paddingVertical: 0,
  },
  libSearchClearBtn: {
    padding: 2,
  },
  libSearchClearText: {
    color: '#8A9EB8',
    fontSize: 9,
    fontWeight: 'bold',
  },
  libImportIconBtn: {
    width: 28,
    height: 28,
    backgroundColor: '#00E5FF',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  libTargetFaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 3,
  },
  libTargetFaderLabel: {
    color: '#7187A1',
    fontSize: 7,
    fontWeight: '800',
  },
  libTargetFaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101724',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  libTargetFaderPillActive: {
    backgroundColor: '#003844',
    borderColor: '#00E5FF',
  },
  libTargetFaderNum: {
    color: '#7187A1',
    fontSize: 7.5,
    fontWeight: '900',
    marginRight: 3,
  },
  libTargetFaderNumActive: {
    color: '#00E5FF',
  },
  libTargetFaderName: {
    color: '#5C7087',
    fontSize: 7,
    fontWeight: '700',
    maxWidth: 65,
  },
  libTargetFaderNameActive: {
    color: '#FFFFFF',
  },
  libCategoriesBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 4,
  },
  libCategoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1622',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#1A2433',
  },
  libCategoryPillActive: {
    backgroundColor: '#003844',
    borderColor: '#00E5FF',
  },
  libCategoryPillText: {
    color: '#7187A1',
    fontSize: 8,
    fontWeight: '800',
  },
  libCategoryPillTextActive: {
    color: '#00E5FF',
    fontWeight: '900',
  },
  libCategoryCountBadge: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginLeft: 4,
  },
  libCategoryCountBadgeActive: {
    backgroundColor: '#00E5FF',
  },
  libCategoryCountText: {
    color: '#8A9EB8',
    fontSize: 6.5,
    fontWeight: '900',
  },
  libCategoryCountTextActive: {
    color: '#000000',
  },
  libScrollView: {
    flex: 1,
  },
  libGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 4,
    paddingBottom: 10,
  },
  libEmptyContainer: {
    width: '100%',
    paddingVertical: 20,
    alignItems: 'center',
  },
  libEmptyText: {
    color: '#5C7087',
    fontSize: 9,
    fontStyle: 'italic',
  },
  libCardItem: {
    width: '49.3%',
    backgroundColor: '#0D131D',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#1A2434',
    padding: 6,
    marginBottom: 2,
  },
  libCardItemLoaded: {
    borderColor: '#00E5FF',
    backgroundColor: '#0B1B2B',
  },
  libCardItemCustom: {
    borderColor: '#9C27B044',
  },
  libCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  libCardNumBadge: {
    backgroundColor: '#141E2C',
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 3,
  },
  libCardNumText: {
    color: '#00E5FF',
    fontSize: 7.5,
    fontWeight: '900',
  },
  libCardCategoryBadge: {
    backgroundColor: '#182436',
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 3,
  },
  libCardCategoryText: {
    color: '#8A9EB8',
    fontSize: 7,
    fontWeight: '800',
  },
  libCardBpmText: {
    color: '#FFB300',
    fontSize: 7.5,
    fontWeight: '800',
  },
  libCardTitle: {
    color: '#CBD5E1',
    fontSize: 9.5,
    fontWeight: '800',
    marginBottom: 4,
  },
  libCardTitleLoaded: {
    color: '#00E5FF',
    fontWeight: '900',
  },
  libCardActionsRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
    marginTop: 2,
  },
  libAssignIconBtn: {
    width: 26,
    height: 24,
    backgroundColor: '#182030',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#2A3B52',
    justifyContent: 'center',
    alignItems: 'center',
  },
  libAssignIconBtnActive: {
    backgroundColor: '#003844',
    borderColor: '#00E5FF',
  },
  libEditIconBtn: {
    width: 26,
    height: 24,
    backgroundColor: '#182030',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#2A3B52',
    justifyContent: 'center',
    alignItems: 'center',
  },
  libTrashIconBtn: {
    width: 26,
    height: 24,
    backgroundColor: '#2B0E14',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#FF1744',
    justifyContent: 'center',
    alignItems: 'center',
  },
  renameBox: {
    width: 320,
    backgroundColor: '#0B0F17',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00E5FF',
    padding: 12,
  },
  renameBadge: {
    color: '#00E5FF',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  renameInput: {
    backgroundColor: '#05080E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 4,
    color: '#FFFFFF',
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginVertical: 10,
  },
  renameSaveBtn: {
    backgroundColor: '#00E5FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  renameSaveBtnText: {
    color: '#000000',
    fontSize: 8.5,
    fontWeight: '900',
  },

  // ================= ESTILOS DE BOTONES RECTANGULARES DE TRANSPORTE =================
  transportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  syncStartBtnActive: {
    borderColor: '#00E676',
    backgroundColor: '#003314',
  },
  acmpBtnActive: {
    borderColor: '#00E5FF',
    backgroundColor: '#003644',
  },
  transportBtnRect: {
    flex: 1,
    height: 32,
    borderRadius: 4,
    backgroundColor: '#0F1722',
    borderWidth: 1,
    borderColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  transportBtnTitle: {
    color: '#8A9EB8',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  transportBtnSub: {
    color: '#475569',
    fontSize: 6.5,
    fontWeight: '800',
  },
  syncStartTitleActive: {
    color: '#00E676',
    fontWeight: '900',
  },
  syncStartSubActive: {
    color: '#00E676',
    fontWeight: '900',
  },
  acmpTitleActive: {
    color: '#00E5FF',
    fontWeight: '900',
  },
  acmpSubActive: {
    color: '#00E5FF',
    fontWeight: '900',
  },
  startStopRectBtn: {
    flex: 1.5,
    height: 32,
    borderRadius: 4,
    backgroundColor: '#0D273D',
    borderWidth: 1.5,
    borderColor: '#00E5FF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00E5FF',
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  startStopRectBtnActive: {
    backgroundColor: '#350E14',
    borderColor: '#FF1744',
    shadowColor: '#FF1744',
    shadowOpacity: 0.8,
    shadowRadius: 5,
  },
  startStopRectTitle: {
    color: '#00E5FF',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  startStopRectTitleActive: {
    color: '#FF5252',
    fontWeight: '900',
  },

  // ================= ESTILOS CONTROLES DE CENTRO =================
  centerControlsRowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 4,
  },
  controlPillBox: {
    flex: 1,
    backgroundColor: '#070B12',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#162232',
    padding: 3,
    alignItems: 'center',
  },
  controlPillLabel: {
    color: '#7187A1',
    fontSize: 6.5,
    fontWeight: '800',
    marginBottom: 2,
  },
  controlPillBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 3,
  },
  stepBtnUltra: {
    width: 22,
    height: 18,
    borderRadius: 3,
    backgroundColor: '#101B2B',
    borderWidth: 1,
    borderColor: '#1E2F46',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBtnText: {
    color: '#00E5FF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  stepValueBadge: {
    backgroundColor: '#0F1A28',
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#00E5FF44',
    minWidth: 44,
    alignItems: 'center',
  },
  stepValueText: {
    color: '#FFFFFF',
    fontSize: 7.5,
    fontWeight: '900',
  },
});
