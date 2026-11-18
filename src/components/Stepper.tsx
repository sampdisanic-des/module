import React from 'react';
import { StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Text } from './AppText';
import { createThemedStyles, useThemedStyles } from '../theme/ThemeContext';

interface StepperProps {
  label: string;
  value: string;
  onDecrement: () => void;
  onIncrement: () => void;
  /** Resalta el valor (p. ej. transposición distinta de 0) */
  highlight?: boolean;
  /** Sin recuadro propio (cuando ya va dentro de una tarjeta) */
  bare?: boolean;
  style?: ViewStyle;
}

/** Control "ETIQUETA  [-]  valor  [+]" */
export const Stepper: React.FC<StepperProps> = ({ label, value, onDecrement, onIncrement, highlight, bare, style }) => {
  const styles = useThemedStyles(themed);
  return (
    <View style={[styles.stepperBlock, bare && styles.stepperBare, style]}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <TouchableOpacity activeOpacity={0.7} delayPressIn={0} delayPressOut={0} style={styles.stepperBtn} onPress={onDecrement}>
        <Text style={styles.stepperBtnText}>−</Text>
      </TouchableOpacity>
      <Text style={[styles.stepperValue, highlight && styles.stepperValueChanged]}>{value}</Text>
      <TouchableOpacity activeOpacity={0.7} delayPressIn={0} delayPressOut={0} style={styles.stepperBtn} onPress={onIncrement}>
        <Text style={styles.stepperBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

const themed = createThemedStyles({
  stepperBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0C111A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E2A3A',
    paddingHorizontal: 8,
  },
  stepperBtn: {
    width: 34,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#152132',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#24364D',
  },
  stepperBtnText: {
    color: '#00E5FF',
    fontSize: 16,
    fontWeight: '900',
  },
  stepperLabel: {
    flex: 1,
    color: '#6B829D',
    fontSize: 9,
    fontWeight: '900',
  },
  stepperValue: {
    minWidth: 34,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  stepperValueChanged: {
    color: '#FFC400',
  },
  stepperBare: {
    flex: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 0,
  },
});
