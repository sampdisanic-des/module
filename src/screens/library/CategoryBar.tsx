import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Text } from '../../components/AppText';
import { useLibStyles } from './libraryStyles';

interface CategoryBarProps {
  categories: string[];
  selected: string;
  onSelect: (cat: string) => void;
  getCount: (cat: string) => number;
}

/** Filtro de categorías con contador */
export const CategoryBar: React.FC<CategoryBarProps> = ({ categories, selected, onSelect, getCount }) => {
  const lib = useLibStyles();
  return (
    <View style={lib.categoriesBar}>
      {categories.map((cat) => {
        const isActive = selected === cat;
        return (
          <TouchableOpacity
            key={cat}
            activeOpacity={0.7}
            delayPressIn={0}
            delayPressOut={0}
            style={[lib.categoryPill, isActive && lib.categoryPillActive]}
            onPress={() => onSelect(cat)}
          >
            <Text style={[lib.categoryPillText, isActive && lib.categoryPillTextActive]}>{cat}</Text>
            <View style={[lib.categoryCountBadge, isActive && lib.categoryCountBadgeActive]}>
              <Text style={[lib.categoryCountText, isActive && lib.categoryCountTextActive]}>{getCount(cat)}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};
