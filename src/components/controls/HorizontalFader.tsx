import React, { useRef } from 'react';
import {
  View,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  LayoutChangeEvent,
} from 'react-native';
import { Text } from '../AppText';
import { createThemedStyles, useTheme, useThemedStyles } from '../../theme/ThemeContext';

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

  const styles = useThemedStyles(themed);
  const { c } = useTheme();
  const col = c(color);
  const capWidth = large ? 26 : 22;

  return (
    <View style={styles.hFaderWrapper}>
      <View style={styles.hFaderHeaderRow}>
        <Text style={[styles.hFaderLabel, large && styles.hFaderLabelLarge]}>{label}</Text>
        <Text style={[styles.hFaderValText, large && styles.hFaderValTextLarge, { color: col }]}>
          {displayValue ?? `${value}%`}
        </Text>
      </View>

      <View
        style={[styles.hFaderTouchArea, large && styles.hFaderTouchAreaLarge]}
        onLayout={handleTrackLayout}
        {...panResponder.panHandlers}
      >
        <View style={[styles.hFaderTrackSlot, large && styles.hFaderTrackSlotLarge]}>
          <View style={[styles.hFaderFillBar, { width: `${value}%`, backgroundColor: col }]} />
        </View>
        <View
          pointerEvents="none"
          style={[
            styles.hFaderCap,
            large && styles.hFaderCapLarge,
            {
              left: `${Math.min(Math.max(value, 0), 100)}%`,
              marginLeft: -capWidth / 2,
              borderColor: col,
            },
          ]}
        >
          <View style={[styles.hFaderCapGlowLine, { backgroundColor: col }]} />
        </View>
      </View>
    </View>
  );
};

const themed = createThemedStyles({
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
});
