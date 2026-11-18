import React from 'react';
import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  TextProps,
  TextInputProps,
} from 'react-native';
import { APP_FONT } from '../theme/fonts';

/**
 * Text y TextInput con la fuente de la app. Usar siempre estos en lugar de los de
 * react-native para que ningún texto caiga en la fuente del sistema.
 */
export const Text = React.forwardRef<RNText, TextProps>(({ style, ...rest }, ref) => (
  <RNText ref={ref} {...rest} style={[styles.base, style]} />
));
Text.displayName = 'AppText';

export const TextInput = React.forwardRef<RNTextInput, TextInputProps>(({ style, ...rest }, ref) => (
  <RNTextInput ref={ref} {...rest} style={[styles.base, style]} />
));
TextInput.displayName = 'AppTextInput';

const styles = StyleSheet.create({
  base: {
    fontFamily: APP_FONT,
  },
});
