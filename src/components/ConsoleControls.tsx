import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  LayoutChangeEvent,
} from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Line } from 'react-native-svg';
import { useChannelLevel } from '../hooks/useChannelLevel';

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

export const HorizontalFader: React.FC<HorizontalFaderProps> = ({
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

export const MiniVerticalFader: React.FC<MiniVerticalFaderProps> = ({
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
export const ChannelVuMeter: React.FC<{ channelIndex: number; mute: boolean }> = React.memo(({ channelIndex, mute }) => {
  const level = useChannelLevel(channelIndex, !mute);

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

export const ConsoleFader: React.FC<ConsoleFaderProps> = ({
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

export const ConsoleKnob: React.FC<ConsoleKnobProps> = ({
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


const styles = StyleSheet.create({
  absoluteCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  faderCapCyanLine: {
    width: 12,
    height: 2,
    backgroundColor: '#00E5FF',
    borderRadius: 1,
  },
  faderCenterLine: {
    position: 'absolute',
    width: 2,
    height: '100%',
    backgroundColor: '#172333',
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
  faderFillBar: {
    width: '100%',
    backgroundColor: '#00E5FF',
    borderRadius: 1,
    opacity: 0.85,
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
  faderTrackWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    width: '100%',
  },
  faderValDisplay: {
    color: '#00E5FF',
    fontSize: 7,
    fontWeight: '800',
    marginTop: 2,
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
  hFaderCapGlowLine: {
    width: 2,
    height: 10,
    borderRadius: 1,
  },
  hFaderFillBar: {
    height: '100%',
    borderRadius: 3,
    opacity: 0.85,
  },
  hFaderGrooveLine: {
    position: 'absolute',
    width: '100%',
    height: 2,
    backgroundColor: '#16202E',
  },
  hFaderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 1,
  },
  hFaderIconText: {
    fontSize: 10,
    marginRight: 4,
  },
  hFaderLabel: {
    color: '#3B4D63',
    fontSize: 7,
    fontWeight: '800',
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
  hFaderTrackRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 14,
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
  hFaderValText: {
    fontSize: 8,
    fontWeight: '700',
  },
  hFaderWrapper: {
    width: '100%',
    marginVertical: 1,
  },
  knobCol: {
    alignItems: 'center',
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
  knobOuterCircle: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0F17',
    borderWidth: 1,
    borderColor: '#16202E',
    position: 'relative',
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
  miniFaderCenterLine: {
    position: 'absolute',
    width: 2,
    height: '100%',
    backgroundColor: '#16202E',
  },
  miniFaderCol: {
    alignItems: 'center',
    height: 92,
    justifyContent: 'space-between',
  },
  miniFaderFill: {
    width: '100%',
    borderRadius: 2,
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
  miniFaderValText: {
    fontSize: 7,
    fontWeight: '800',
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
  pillBtnText: {
    color: '#4C6078',
    fontSize: 6,
    fontWeight: '800',
  },
  pillBtnTextActive: {
    color: '#FFFFFF',
  },
  soloMuteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 2,
  },
  vuLedSegment: {
    width: 4,
    height: 8,
    borderRadius: 1,
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
});
