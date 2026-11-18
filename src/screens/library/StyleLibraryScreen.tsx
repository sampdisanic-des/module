import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from '../../components/AppText';
import { ScreenHeader } from '../../components/ScreenHeader';
import { UseArrangerReturn } from '../../hooks/useArranger';
import { ShowAlert } from '../../hooks/useConsoleAlert';
import { matchStyleCategory } from '../../data/voiceLibrary';
import { STYLE_CATEGORIES } from '../../data/categories';
import { SearchBox, ImportButton } from './SearchBox';
import { CategoryBar } from './CategoryBar';
import { LibraryCard, EditCardButton, DeleteCardButton, EmptyLibrary } from './LibraryCard';
import { useLibStyles } from './libraryStyles';
import { reportImport } from '../../utils/importReport';

interface StyleLibraryScreenProps {
  arranger: UseArrangerReturn;
  onBack: () => void;
  onRename: (styleId: string, currentName: string) => void;
  showAlert: ShowAlert;
}

/** Librería de ritmos (.STY): búsqueda, categorías, importar, renombrar y borrar */
export const StyleLibraryScreen: React.FC<StyleLibraryScreenProps> = ({ arranger, onBack, onRename, showAlert }) => {
  const { availableStyles, loadedStyle, selectedCategory, setSelectedCategory, selectStyle, importStyleFiles, deleteStyleFile } = arranger;
  const lib = useLibStyles();
  const [search, setSearch] = useState('');

  const getCount = (cat: string) =>
    cat === 'ALL' ? availableStyles.length : availableStyles.filter((st) => matchStyleCategory(st.category, st.name, cat)).length;

  const query = search.toLowerCase().trim();
  const filtered = availableStyles.filter(
    (st) => matchStyleCategory(st.category, st.name, selectedCategory) && (!query || st.name.toLowerCase().includes(query))
  );

  const handleImport = async () => {
    const res = await importStyleFiles(selectedCategory);
    reportImport(showAlert, {
      kind: 'ritmo(s)',
      formats: '.STY / .MID',
      imported: res.importedStyles.length,
      category: res.importedStyles[0]?.category ?? selectedCategory,
      rejected: res.rejectedCount,
      duplicates: res.duplicateCount,
      failed: res.failedCount,
    });
  };

  return (
    <View style={lib.container}>
      <ScreenHeader
        title="LIBRERÍA DE RITMOS (.STY)"
        onBack={onBack}
        subtitle={
          <Text style={lib.subtitle}>
            Ritmo activo: <Text style={lib.loadedHighlight}>{loadedStyle.name}</Text> ({loadedStyle.defaultBpm} BPM)
          </Text>
        }
      >
        <SearchBox value={search} onChange={setSearch} placeholder="Buscar ritmo por nombre..." />
        <ImportButton onPress={handleImport} />
      </ScreenHeader>

      <CategoryBar categories={STYLE_CATEGORIES} selected={selectedCategory} onSelect={setSelectedCategory} getCount={getCount} />

      <ScrollView style={lib.scrollView} contentContainerStyle={lib.gridContainer}>
        {filtered.length === 0 ? (
          <EmptyLibrary message="No se encontraron ritmos que coincidan con la búsqueda." />
        ) : (
          filtered.map((st, index) => (
            <LibraryCard
              key={st.id}
              number={`#${String(index + 1).padStart(2, '0')}`}
              category={st.isCustom ? 'CUSTOM .STY' : st.category}
              meta={`${st.defaultBpm} BPM`}
              title={st.name}
              highlighted={loadedStyle.id === st.id}
              isCustom={st.isCustom}
              onPress={() => {
                selectStyle(st);
                showAlert('SUCCESS', 'RITMO CARGADO', `Se ha seleccionado "${st.name}" (${st.defaultBpm} BPM).`);
              }}
            >
              <EditCardButton onPress={() => onRename(st.id, st.name)} />
              {st.isCustom && (
                <DeleteCardButton
                  onPress={() =>
                    showAlert('WARNING', 'ELIMINAR RITMO', `¿Estás seguro de eliminar el ritmo "${st.name}"?`, () => deleteStyleFile(st.id), true)
                  }
                />
              )}
            </LibraryCard>
          ))
        )}
      </ScrollView>
    </View>
  );
};
