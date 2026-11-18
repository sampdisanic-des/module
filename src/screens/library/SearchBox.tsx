import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { TextInput } from '../../components/AppText';
import { CloseIcon, PlusIcon, SearchIcon } from '../../components/Icons';
import { useLibStyles } from './libraryStyles';
import { useTheme } from '../../theme/ThemeContext';

interface SearchBoxProps {
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
}

export const SearchBox: React.FC<SearchBoxProps> = ({ value, onChange, placeholder }) => {
  const lib = useLibStyles();
  const { c } = useTheme();
  return (
    <View style={lib.searchBox}>
      <View style={lib.searchIconWrap}>
        <SearchIcon size={13} color={c('#7187A1')} />
      </View>
      <TextInput
        style={lib.searchInput}
        placeholder={placeholder}
        placeholderTextColor={c('#5C7087')}
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <TouchableOpacity activeOpacity={0.7} delayPressIn={0} delayPressOut={0} onPress={() => onChange('')} style={lib.searchClearBtn}>
          <CloseIcon size={10} color={c('#8A9EB8')} />
        </TouchableOpacity>
      )}
    </View>
  );
};

/** Botón "+" para importar archivos */
export const ImportButton: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const lib = useLibStyles();
  const { c } = useTheme();
  return (
    <TouchableOpacity activeOpacity={0.7} delayPressIn={0} delayPressOut={0} style={lib.importIconBtn} onPress={onPress}>
      <PlusIcon size={16} color={c('#000000')} />
    </TouchableOpacity>
  );
};
