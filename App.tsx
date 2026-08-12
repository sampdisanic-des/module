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
} from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Text as SvgText, Line } from 'react-native-svg';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Battery from 'expo-battery';
import { useSynthEngine } from './src/hooks/useSynthEngine';
import { useMidiDevices } from './src/hooks/useMidiDevices';
import { useArranger } from './src/hooks/useArranger';

const STYLES_LIST = [
  { id: '1', name: '1. Cumbia Professional' },
  { id: '2', name: '2. Pop Rock Ballad' },
  { id: '3', name: '3. 8-Beat Piano' },
  { id: '4', name: '4. Salsa Classic' },
  { id: '5', name: '5. Bachata Groove' },
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

  const activeLevel = isPlaying && !mute ? value : 0;

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
      <Text style={styles.faderVoiceName} numberOfLines={1}>
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

      {/* Pista Recta Delgada + VU Meter Dinámico */}
      <View style={styles.faderTrackWrapper}>
        <View style={styles.vuMeterContainer}>
          {[...Array(14)].map((_, i) => {
            const levelThreshold = ((13 - i) / 13) * 100;
            const isLit = activeLevel >= levelThreshold;
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
  const { isInitialized, noteOn, noteOff, setParam } = useSynthEngine();
  const { devices } = useMidiDevices();
  const { bpm, currentSection, setBpm, setSection } = useArranger();

  // Estados
  const [selectedStyleId, setSelectedStyleId] = useState<string>('2');
  const [styleVolume, setStyleVolume] = useState<number>(85);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeBank, setActiveBank] = useState<number>(1);
  const [modulation, setModulation] = useState<number>(40);
  const [selectedFaderId, setSelectedFaderId] = useState<number>(1);

  // Octava y Transposición
  const [octave, setOctave] = useState<number>(0);
  const [transpose, setTranspose] = useState<number>(0);

  // Filtros (Cutoff & Resonance)
  const [cutoff, setCutoff] = useState<number>(75);
  const [resonance, setResonance] = useState<number>(40);

  // ADSR (ATTACK, DELAY, SUSTAIN, RELEASE)
  const [attack, setAttack] = useState<number>(20);
  const [delay, setDelay] = useState<number>(45);
  const [sustain, setSustain] = useState<number>(85);
  const [release, setRelease] = useState<number>(30);
  const [selectedAdsr, setSelectedAdsr] = useState<'ATTACK' | 'DELAY' | 'SUSTAIN' | 'RELEASE'>('ATTACK');

  // Hora y Batería Reales del Dispositivo
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  const [batteryPercent, setBatteryPercent] = useState<number>(100);

  // Faders State
  const [faders, setFaders] = useState([
    { id: 1, name: 'CFX Piano', value: 80, solo: false, mute: false },
    { id: 2, name: 'Ambient Pad', value: 65, solo: false, mute: false },
    { id: 3, name: 'Syn Strings', value: 50, solo: false, mute: false },
    { id: 4, name: 'Synth Lead', value: 75, solo: false, mute: false },
  ]);

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
    const nextState = !isPlaying;
    setIsPlaying(nextState);
    if (nextState) {
      noteOn(60, 100);
    } else {
      noteOff(60);
    }
  };

  // Helper de Perilla Maestra ADSR
  const getAdsrCurrentValue = () => {
    switch (selectedAdsr) {
      case 'ATTACK': return attack;
      case 'DELAY': return delay;
      case 'SUSTAIN': return sustain;
      case 'RELEASE': return release;
    }
  };

  const handleAdsrKnobChange = (val: number) => {
    switch (selectedAdsr) {
      case 'ATTACK': setAttack(val); break;
      case 'DELAY': setDelay(val); break;
      case 'SUSTAIN': setSustain(val); break;
      case 'RELEASE': setRelease(val); break;
    }
  };

  const getAdsrDisplayValue = () => {
    switch (selectedAdsr) {
      case 'ATTACK': return `${Math.round((attack / 100) * 500)}ms`;
      case 'DELAY': return `${((delay / 100) * 4.9 + 0.1).toFixed(1)}s`;
      case 'SUSTAIN': return `${sustain}%`;
      case 'RELEASE': return `${((release / 100) * 4.9 + 0.1).toFixed(1)}s`;
    }
  };

  // Coordenadas SVG ADSR
  const calculateAdsrPoints = () => {
    const startX = 6;
    const baseY = 58;
    const peakY = 6;

    const attackX = startX + 12 + (attack / 100) * 45;
    const decayX = attackX + 20 + (delay / 100) * 55;
    const sustainY = baseY - (sustain / 100) * (baseY - peakY);
    const sustainX = decayX + 40;
    const releaseX = Math.min(sustainX + 15 + (release / 100) * 45, 214);

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

      {/* HEADER REORGANIZADO */}
      <View style={styles.header}>
        {/* IZQUIERDA: Instrumento detectado */}
        <View style={styles.midiStatusBoxHeader}>
          <Text style={styles.midiStatusTextHeader}>
            {devices.length > 0
              ? `${devices[0].name} USB OK | Local OFF`
              : 'PSR-E463 USB OK | Local OFF'}
          </Text>
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

      {/* ÁREA DE TRABAJO EN GRID */}
      <View style={styles.mainWorkspace}>
        {/* ================= PANEL IZQUIERDO: STYLES (YAMAHA .STY) ================= */}
        <View style={styles.leftPanel}>
          <View style={styles.panelHeaderRow}>
            <Text style={styles.panelTitle}>STYLES (YAMAHA .STY)</Text>
            <Text style={styles.menuIcon}>≡</Text>
          </View>

          {/* Lista de Estilos */}
          <View style={styles.stylesListContainer}>
            {STYLES_LIST.map((st) => {
              const isSelected = st.id === selectedStyleId;
              return (
                <TouchableOpacity
                  key={st.id}
                  activeOpacity={0.7}
                  delayPressIn={0}
                  delayPressOut={0}
                  style={[styles.styleItemRow, isSelected && styles.styleItemRowSelected]}
                  onPress={() => setSelectedStyleId(st.id)}
                >
                  <Text style={[styles.styleItemText, isSelected && styles.styleItemTextSelected]}>
                    {st.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Style Volume Slider Fader 3D */}
          <HorizontalFader
            label="STYLE VOLUME"
            value={styleVolume}
            onChange={setStyleVolume}
            color="#00E5FF"
          />

          {/* 8 Botones Circulares de Secciones */}
          <View style={styles.stylePadsGrid}>
            {[
              { id: 'INTRO_A', label: 'A', sub: 'INTRO A' },
              { id: 'INTRO_B', label: 'B', sub: 'INTRO B' },
              { id: 'MAIN_A', label: 'A', sub: 'MAIN A' },
              { id: 'MAIN_B', label: 'B', sub: 'MAIN B' },
              { id: 'INTRO_C', label: 'C', sub: 'INTRO C' },
              { id: 'INTRO_D', label: 'D', sub: 'INTRO D' },
              { id: 'MAIN_C', label: 'C', sub: 'MAIN C' },
              { id: 'MAIN_D', label: 'D', sub: 'MAIN D' },
            ].map((pad) => {
              const isActive = currentSection === pad.id;
              return (
                <View key={pad.id} style={styles.padWrapper}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    delayPressIn={0}
                    delayPressOut={0}
                    style={[styles.padCircleOuter, isActive && styles.padCircleOuterActive]}
                    onPress={() => setSection(pad.id as any)}
                  >
                    <View style={[styles.padCircleInner, isActive && styles.padCircleInnerActive]}>
                      <Text style={[styles.padTextLabel, isActive && styles.padTextLabelActive]}>
                        {pad.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.padSubText}>{pad.sub}</Text>
                </View>
              );
            })}
          </View>

          {/* Barra de Transporte Inferior */}
          <View style={styles.transportRow}>
            <TouchableOpacity
              style={styles.transportBtnSide}
              activeOpacity={0.7}
              delayPressIn={0}
              delayPressOut={0}
            >
              <Text style={styles.transportIcon}>▶</Text>
              <Text style={styles.transportSub}>INTRO</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              delayPressIn={0}
              delayPressOut={0}
              style={[styles.startStopGiantBtn, isPlaying && styles.startStopGiantBtnActive]}
              onPress={handleStartStop}
            >
              <View style={styles.startStopInnerGlow} />
              <Text style={styles.startStopText}>START/STOP</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.transportBtnSide}
              activeOpacity={0.7}
              delayPressIn={0}
              delayPressOut={0}
            >
              <Text style={styles.transportIcon}>↻</Text>
              <Text style={styles.transportSub}>ENDING</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ================= PANEL CENTRAL: PERFORMANCE LAYERS ================= */}
        <View style={styles.centerPanel}>
          <Text style={styles.panelTitle}>PERFORMANCE LAYERS</Text>

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

          {/* OCTAVE & TRANSPOSE */}
          <View style={styles.centerBottomControlRow}>
            <View style={styles.octaveTrpBlock}>
              <Text style={styles.octaveTrpTitle}>OCTAVE</Text>
              <View style={styles.octaveTrpRowInner}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  delayPressIn={0}
                  delayPressOut={0}
                  style={styles.octaveMinusBtn}
                  onPress={() => setOctave(Math.max(octave - 1, -3))}
                >
                  <Text style={styles.octaveBtnSymbol}>-</Text>
                </TouchableOpacity>

                <Text style={styles.octaveValueText}>
                  {octave > 0 ? `+${octave}` : octave}
                </Text>

                <TouchableOpacity
                  activeOpacity={0.7}
                  delayPressIn={0}
                  delayPressOut={0}
                  style={styles.octavePlusBtn}
                  onPress={() => setOctave(Math.min(octave + 1, 3))}
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
                  onPress={() => setTranspose(Math.max(transpose - 1, -12))}
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
                  onPress={() => setTranspose(Math.min(transpose + 1, 12))}
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
                <Text style={styles.panelTitle}>ENVELOPE (ADSR)</Text>

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
                      value={cutoff}
                      color="#00E5FF"
                      onChange={setCutoff}
                    />
                  </View>
                </View>

                {/* 3. ABAJO: 4 Botones ADSR (ATTACK, DELAY, SUSTAIN, RELEASE) */}
                <View style={styles.adsrFourBtnsRow}>
                  {(['ATTACK', 'DELAY', 'SUSTAIN', 'RELEASE'] as const).map((param) => {
                    const isSel = selectedAdsr === param;
                    let displayVal = '';
                    if (param === 'ATTACK') displayVal = `${Math.round((attack / 100) * 500)}ms`;
                    if (param === 'DELAY') displayVal = `${((delay / 100) * 4.9 + 0.1).toFixed(1)}s`;
                    if (param === 'SUSTAIN') displayVal = `${sustain}%`;
                    if (param === 'RELEASE') displayVal = `${((release / 100) * 4.9 + 0.1).toFixed(1)}s`;

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
                  value={resonance}
                  onChange={setResonance}
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
                  return (
                    <TouchableOpacity
                      key={bankNum}
                      activeOpacity={0.7}
                      delayPressIn={0}
                      delayPressOut={0}
                      style={[styles.bankCardBtn, isActive && styles.bankCardBtnActive]}
                      onPress={() => setActiveBank(bankNum)}
                    >
                      <Text style={[styles.bankCardText, isActive && styles.bankCardTextActive]}>
                        BANK
                      </Text>
                      <Text style={[styles.bankCardNum, isActive && styles.bankCardNumActive]}>
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
    backgroundColor: '#06090E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#131C28',
  },
  midiStatusTextHeader: {
    color: '#00E5FF',
    fontSize: 8.5,
    fontWeight: '700',
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
  stylePadsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  padWrapper: {
    width: '23%',
    alignItems: 'center',
    marginBottom: 1,
  },
  padCircleOuter: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#101620',
    borderWidth: 2,
    borderColor: '#FF9100',
    justifyContent: 'center',
    alignItems: 'center',
  },
  padCircleOuterActive: {
    borderColor: '#00E5FF',
    shadowColor: '#00E5FF',
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  padCircleInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#00A3FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  padCircleInnerActive: {
    backgroundColor: '#00E5FF',
  },
  padTextLabel: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  padTextLabelActive: {
    color: '#05090F',
  },
  padSubText: {
    color: '#3B4D63',
    fontSize: 6,
    fontWeight: '800',
    marginTop: 1,
  },
  transportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transportBtnSide: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#101620',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#172230',
  },
  transportIcon: {
    color: '#7187A1',
    fontSize: 10,
  },
  transportSub: {
    color: '#3B4D63',
    fontSize: 6,
    fontWeight: '800',
  },
  startStopGiantBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#00A3FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#00E5FF',
  },
  startStopGiantBtnActive: {
    backgroundColor: '#FF3D00',
    borderColor: '#FF9100',
  },
  startStopInnerGlow: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF22',
  },
  startStopText: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: '900',
    textAlign: 'center',
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
    fontSize: 7,
    fontWeight: '700',
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
    backgroundColor: '#0F1620',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#172332',
  },
  bankCardBtnActive: {
    backgroundColor: '#00E676',
    borderColor: '#69F0AE',
  },
  bankCardText: {
    color: '#00E676',
    fontSize: 5,
    fontWeight: '800',
  },
  bankCardTextActive: {
    color: '#05090F',
  },
  bankCardNum: {
    color: '#00E676',
    fontSize: 10,
    fontWeight: '900',
  },
  bankCardNumActive: {
    color: '#05090F',
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
});
