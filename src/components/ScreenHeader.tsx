import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Text } from './AppText';
import { BackArrowIcon } from './Icons';
import { useLibStyles } from '../screens/library/libraryStyles';
import { useTheme } from '../theme/ThemeContext';

interface ScreenHeaderProps {
  title: string;
  onBack: () => void;
  /** Texto o elementos bajo el título */
  subtitle?: React.ReactNode;
  /** Elementos a la derecha (buscador, botones) */
  children?: React.ReactNode;
}

/** Encabezado de pantallas secundarias: botón volver, título y controles a la derecha */
export const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, onBack, subtitle, children }) => {
  const lib = useLibStyles();
  const { c } = useTheme();
  return (
    <View style={lib.navBar}>
      <TouchableOpacity activeOpacity={0.7} delayPressIn={0} delayPressOut={0} style={lib.backIconBtn} onPress={onBack}>
        <BackArrowIcon size={16} color={c('#00E5FF')} />
      </TouchableOpacity>

      <View style={lib.titleContainer}>
        <Text style={lib.titleMain}>{title}</Text>
        {typeof subtitle === 'string' ? <Text style={lib.subtitle}>{subtitle}</Text> : subtitle}
      </View>

      {children}
    </View>
  );
};
