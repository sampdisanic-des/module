import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Text } from '../../components/AppText';
import { EditIcon, TrashIcon } from '../../components/Icons';
import { useLibStyles } from './libraryStyles';
import { useTheme } from '../../theme/ThemeContext';

interface LibraryCardProps {
  number: string; // "#01"
  category: string;
  meta: string; // texto a la derecha (BPM, programa...)
  title: string;
  highlighted: boolean; // cargado / asignado
  isCustom?: boolean;
  onPress: () => void;
  /** Botones de acción a la derecha */
  children?: React.ReactNode;
}

/** Tarjeta de un ritmo o una voz en las librerías */
export const LibraryCard: React.FC<LibraryCardProps> = ({ number, category, meta, title, highlighted, isCustom, onPress, children }) => {
  const lib = useLibStyles();
  const { c } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      delayPressIn={0}
      delayPressOut={0}
      style={[lib.cardItem, highlighted && lib.cardItemLoaded, isCustom && lib.cardItemCustom]}
      onPress={onPress}
    >
      <View style={lib.cardTopRow}>
        <View style={lib.cardNumBadge}>
          <Text style={lib.cardNumText}>{number}</Text>
        </View>
        <View style={lib.cardCategoryBadge}>
          <Text style={lib.cardCategoryText}>{category}</Text>
        </View>
        <Text style={lib.cardBpmText}>{meta}</Text>
      </View>

      <Text style={[lib.cardTitle, highlighted && lib.cardTitleLoaded]} numberOfLines={1}>
        {title}
      </Text>

      <View style={lib.cardActionsRowRight}>{children}</View>
    </TouchableOpacity>
  );
};

export const EditCardButton: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const lib = useLibStyles();
  const { c } = useTheme();
  return (
    <TouchableOpacity activeOpacity={0.7} delayPressIn={0} delayPressOut={0} style={lib.editIconBtn} onPress={onPress}>
      <EditIcon size={13} color={c('#8A9EB8')} />
    </TouchableOpacity>
  );
};

export const DeleteCardButton: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const lib = useLibStyles();
  const { c } = useTheme();
  return (
    <TouchableOpacity activeOpacity={0.7} delayPressIn={0} delayPressOut={0} style={lib.trashIconBtn} onPress={onPress}>
      <TrashIcon size={13} color={c('#FF5252')} />
    </TouchableOpacity>
  );
};

/** Lista vacía */
export const EmptyLibrary: React.FC<{ message: string }> = ({ message }) => {
  const lib = useLibStyles();
  const { c } = useTheme();
  return (
    <View style={lib.emptyContainer}>
      <Text style={lib.emptyText}>{message}</Text>
    </View>
  );
};
