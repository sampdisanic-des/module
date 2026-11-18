import React, { useRef } from 'react';
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
import { useChannelLevel } from '../hooks/useChannelLevel';

// ===================================================
// FADER HORIZONTAL (PARÁMETROS DE VOZ, VOLUMEN DE RITMO)
// ===================================================
interface HorizontalFaderProps {
  label: string;
  value: number; // 0..100
  onChange: (val: number) => void;
  color?: string;
  /** Texto a mostrar en lugar de "NN%" (p. ej. "1.2 s") */
  displayValue?: string;
  /** Tamaño grande para la pantalla de edición */
  large?: boolean;
}

export const HorizontalFader: React.FC<HorizontalFaderProps> = ({
  label,
  value,
  onChange,
  color = '#00E5FF',
  displayValue,
  large = false,
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

  const capWidth = large ? 26 : 22;

  return (
    <View style={styles.hFaderWrapper}>
      <View style={styles.hFaderHeaderRow}>
        <Text style={[styles.hFaderLabel, large && styles.hFaderLabelLarge]}>{label}</Text>
        <Text style={[styles.hFaderValText, large && styles.hFaderValTextLarge, { color }]}>
          {displayValue ?? `${value}%`}
        </Text>
      </View>

      <View
        style={[styles.hFaderTouchArea, large && styles.hFaderTouchAreaLarge]}
        onLayout={handleTrackLayout}
        {...panResponder.panHandlers}
      >
        <View style={[styles.hFaderTrackSlot, large && styles.hFaderTrackSlotLarge]}>
          <View style={[styles.hFaderFillBar, { width: `${value}%`, backgroundColor: color }]} />
        </View>
        <View
          pointerEvents="none"
          style={[
            styles.hFaderCap,
            large && styles.hFaderCapLarge,
            {
              left: `${Math.min(Math.max(value, 0), 100)}%`,
              marginLeft: -capWidth / 2,
              borderColor: color,
            },
          ]}
        >
          <View style={[styles.hFaderCapGlowLine, { backgroundColor: color }]} />
        </View>
      </View>
    </View>
  );
};

// ===================================================
// MEDIDOR VU POR CANAL
// ===================================================
const VU_SEGMENTS = 16;

export const ChannelVuMeter: React.FC<{ channelIndex: number; mute: boolean }> = React.memo(({ channelIndex, mute }) => {
  const level = useChannelLevel(channelIndex, !mute);

  return (
    <View style={styles.vuMeterContainer}>
      {[...Array(VU_SEGMENTS)].map((_, i) => {
        const levelThreshold = ((VU_SEGMENTS - 1 - i) / (VU_SEGMENTS - 1)) * 100;
        const isLit = !mute && level >= levelThreshold;
        let ledColor = '#00E676';
        if (i < 3) ledColor = '#FF3D00';
        else if (i < 6) ledColor = '#FFEA00';

        return (
          <View
            key={i}
            style={[styles.vuLedSegment, { backgroundColor: isLit ? ledColor : '#0E141F' }]}
          />
        );
      })}
    </View>
  );
});

// ===================================================
// FADER VERTICAL DE CANAL (ALTURA FLEXIBLE)
// ===================================================
interface ConsoleFaderProps {
  id: number;
  name: string;
  value: number;
  solo: boolean;
  mute: boolean;
  octave: number;
  isSelected: boolean;
  onSelect: (id: number) => void;
  onChange: (id: number, val: number) => void;
  onToggleSolo: (id: number) => void;
  onToggleMute: (id: number) => void;
  /** Tocar el nombre de la voz abre la librería para este fader */
  onOpenVoice: (id: number) => void;
}

export const ConsoleFader: React.FC<ConsoleFaderProps> = ({
  id,
  name,
  value,
  solo,
  mute,
  octave,
  isSelected,
  onSelect,
  onChange,
  onToggleSolo,
  onToggleMute,
  onOpenVoice,
}) => {
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const trackHeight = useRef(160);
  const startVal = useRef(value);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        onSelectRef.current(id);
        startVal.current = valueRef.current;
      },
      onPanResponderMove: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        // Recorrer todo el alto de la pista equivale a 0..100
        const deltaPercent = (-gestureState.dy / trackHeight.current) * 100;
        const newVal = Math.min(Math.max(startVal.current + deltaPercent, 0), 100);
        onChangeRef.current(id, Math.round(newVal));
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: () => {},
    })
  ).current;

  const handleTrackLayout = (e: LayoutChangeEvent) => {
    trackHeight.current = e.nativeEvent.layout.height || 160;
  };

  const octLabel = octave === 0 ? '' : octave > 0 ? `OCT +${octave}` : `OCT ${octave}`;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      delayPressIn={0}
      delayPressOut={0}
      style={[styles.faderCard, isSelected && styles.faderCardSelected]}
      onPress={() => onSelect(id)}
    >
      <TouchableOpacity
        activeOpacity={0.7}
        delayPressIn={0}
        delayPressOut={0}
        style={[styles.faderVoiceBtn, isSelected && styles.faderVoiceBtnSelected]}
        onPress={() => onOpenVoice(id)}
      >
        <View style={styles.faderVoiceTopRow}>
          <Text style={[styles.faderIdText, isSelected && styles.faderIdTextSelected]}>F{id}</Text>
          {octLabel !== '' && <Text style={styles.faderOctBadge}>{octLabel}</Text>}
        </View>
        <Text style={[styles.faderVoiceName, isSelected && styles.faderVoiceNameSelected]} numberOfLines={2}>
          {name}
        </Text>
      </TouchableOpacity>

      <View style={styles.soloMuteRow}>
        <TouchableOpacity
          activeOpacity={0.7}
          delayPressIn={0}
          delayPressOut={0}
          style={[styles.pillBtn, solo && styles.pillBtnSoloActive]}
          onPress={() => {
            onSelect(id);
            onToggleSolo(id);
          }}
        >
          <Text style={[styles.pillBtnText, solo && styles.pillBtnTextActive]}>S</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          delayPressIn={0}
          delayPressOut={0}
          style={[styles.pillBtn, mute && styles.pillBtnMuteActive]}
          onPress={() => {
            onSelect(id);
            onToggleMute(id);
          }}
        >
          <Text style={[styles.pillBtnText, mute && styles.pillBtnTextActive]}>M</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.faderTrackWrapper}>
        <ChannelVuMeter channelIndex={id - 1} mute={mute} />

        <View style={styles.faderTouchColumn} onLayout={handleTrackLayout} {...panResponder.panHandlers}>
          <View style={styles.faderSlimTrack}>
            <View style={[styles.faderFillBar, mute && styles.faderFillBarMuted, { height: `${value}%` }]} />
          </View>
          <View
            pointerEvents="none"
            style={[styles.faderThumbCap, mute && styles.faderThumbCapMuted, { bottom: `${Math.min(Math.max(value, 0), 100)}%` }]}
          >
            <View style={[styles.faderCapLine, mute && styles.faderCapLineMuted]} />
          </View>
        </View>
      </View>

      <Text style={[styles.faderValDisplay, mute && styles.faderValDisplayMuted]}>{mute ? 'MUTE' : `${value}%`}</Text>
    </TouchableOpacity>
  );
};

const CYAN = '#00E5FF';
const THUMB_H = 20;

const styles = StyleSheet.create({
  // ----- Fader horizontal -----
  hFaderWrapper: {
    width: '100%',
  },
  hFaderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  hFaderLabel: {
    color: '#6B829D',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  hFaderLabelLarge: {
    fontSize: 10,
  },
  hFaderValText: {
    fontSize: 9,
    fontWeight: '800',
  },
  hFaderValTextLarge: {
    fontSize: 11,
  },
  hFaderTouchArea: {
    height: 22,
    justifyContent: 'center',
    marginHorizontal: 11,
  },
  hFaderTouchAreaLarge: {
    height: 30,
    marginHorizontal: 13,
  },
  hFaderTrackSlot: {
    height: 8,
    backgroundColor: '#06080D',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#16202E',
    overflow: 'hidden',
  },
  hFaderTrackSlotLarge: {
    height: 10,
    borderRadius: 5,
  },
  hFaderFillBar: {
    height: '100%',
    opacity: 0.8,
  },
  hFaderCap: {
    position: 'absolute',
    width: 22,
    height: 16,
    borderRadius: 3,
    backgroundColor: '#1E2B3D',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hFaderCapLarge: {
    width: 26,
    height: 22,
    borderRadius: 4,
  },
  hFaderCapGlowLine: {
    width: 2,
    height: 9,
    borderRadius: 1,
  },

  // ----- VU -----
  vuMeterContainer: {
    width: 5,
    alignSelf: 'stretch',
    backgroundColor: '#06080D',
    borderRadius: 2,
    justifyContent: 'space-between',
    marginRight: 6,
    marginVertical: THUMB_H / 2,
    paddingVertical: 1,
  },
  vuLedSegment: {
    width: 5,
    flex: 1,
    marginVertical: 1,
    borderRadius: 1,
  },

  // ----- Fader de canal -----
  faderCard: {
    flex: 1,
    backgroundColor: '#070A10',
    borderRadius: 8,
    padding: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#141E2C',
  },
  faderCardSelected: {
    borderColor: CYAN,
    borderWidth: 1.5,
    backgroundColor: '#08111A',
  },
  faderVoiceBtn: {
    width: '100%',
    backgroundColor: '#0C131E',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#172332',
    paddingHorizontal: 4,
    paddingVertical: 3,
    minHeight: 40,
  },
  faderVoiceBtnSelected: {
    borderColor: '#00E5FF66',
  },
  faderVoiceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faderIdText: {
    color: '#4C6078',
    fontSize: 9,
    fontWeight: '900',
  },
  faderIdTextSelected: {
    color: CYAN,
  },
  faderOctBadge: {
    color: '#FFC400',
    fontSize: 7,
    fontWeight: '900',
  },
  faderVoiceName: {
    color: '#A9BBD0',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 11,
    marginTop: 1,
  },
  faderVoiceNameSelected: {
    color: '#E6F7FF',
  },
  soloMuteRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 4,
    marginTop: 4,
  },
  pillBtn: {
    flex: 1,
    paddingVertical: 4,
    backgroundColor: '#101620',
    borderRadius: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#172332',
  },
  pillBtnSoloActive: {
    backgroundColor: '#00A3FF',
    borderColor: CYAN,
  },
  pillBtnMuteActive: {
    backgroundColor: '#FF3D00',
    borderColor: '#FF8A80',
  },
  pillBtnText: {
    color: '#5D7290',
    fontSize: 9,
    fontWeight: '900',
  },
  pillBtnTextActive: {
    color: '#FFFFFF',
  },
  faderTrackWrapper: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'stretch',
    width: '100%',
    marginTop: 4,
  },
  faderTouchColumn: {
    width: 40,
    alignItems: 'center',
    // margen para que el cap no se salga del área en 0% y 100%
    marginVertical: THUMB_H / 2,
  },
  faderSlimTrack: {
    flex: 1,
    width: 8,
    backgroundColor: '#04060A',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#151E2B',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  faderFillBar: {
    width: '100%',
    backgroundColor: CYAN,
    opacity: 0.85,
  },
  faderFillBarMuted: {
    backgroundColor: '#3B4D63',
  },
  faderThumbCap: {
    position: 'absolute',
    width: 36,
    height: THUMB_H,
    marginBottom: -THUMB_H / 2,
    borderRadius: 4,
    backgroundColor: '#1E2B3D',
    borderWidth: 1,
    borderColor: CYAN,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faderThumbCapMuted: {
    borderColor: '#3B4D63',
  },
  faderCapLine: {
    width: 18,
    height: 2,
    backgroundColor: CYAN,
    borderRadius: 1,
  },
  faderCapLineMuted: {
    backgroundColor: '#3B4D63',
  },
  faderValDisplay: {
    color: CYAN,
    fontSize: 10,
    fontWeight: '900',
    marginTop: 2,
  },
  faderValDisplayMuted: {
    color: '#FF6E40',
  },
});
