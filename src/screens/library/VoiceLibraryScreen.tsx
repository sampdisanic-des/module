import React, { useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { Text } from '../../components/AppText';
import { AssignIcon } from '../../components/Icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { FadersApi } from '../../hooks/useFaders';
import { VoiceLibraryApi } from '../../hooks/useVoiceLibrary';
import { UseSynthEngineReturn } from '../../hooks/useSynthEngine';
import { ShowAlert } from '../../hooks/useConsoleAlert';
import { VOICE_CATEGORIES } from '../../data/categories';
import { VoicePreset } from '../../data/voiceLibrary';
import { SearchBox, ImportButton } from './SearchBox';
import { CategoryBar } from './CategoryBar';
import { LibraryCard, EditCardButton, DeleteCardButton, EmptyLibrary } from './LibraryCard';
import { useLibStyles } from './libraryStyles';
import { useTheme } from '../../theme/ThemeContext';

interface VoiceLibraryScreenProps {
  voices: VoiceLibraryApi;
  mixer: FadersApi;
  engine: Pick<UseSynthEngineReturn, 'auditionVoice' | 'auditionStop'>;
  /** Fader al que se asignará la voz al abrir la pantalla */
  initialTargetFaderId: number;
  onBack: () => void;
  onRename: (voiceId: string, currentName: string) => void;
  showAlert: ShowAlert;
}

/** Librería de voces y SoundFonts: preescucha, asignación a F1-F4, importar, renombrar y borrar */
export const VoiceLibraryScreen: React.FC<VoiceLibraryScreenProps> = ({
  voices,
  mixer,
  engine,
  initialTargetFaderId,
  onBack,
  onRename,
  showAlert,
}) => {
  const { fullVoiceLibrary, importVoices, deleteVoice } = voices;
  const [targetFaderId, setTargetFaderId] = useState<number>(initialTargetFaderId);
  const [category, setCategory] = useState<string>('ALL');
  const lib = useLibStyles();
  const { c } = useTheme();
  const [search, setSearch] = useState('');

  const getCount = (cat: string) => (cat === 'ALL' ? fullVoiceLibrary.length : fullVoiceLibrary.filter((v) => v.category === cat).length);

  const query = search.toLowerCase().trim();
  const filtered = fullVoiceLibrary.filter(
    (v) => (category === 'ALL' || v.category === category) && (!query || v.name.toLowerCase().includes(query))
  );

  const audition = (v: VoicePreset, ms: number) => {
    engine.auditionVoice(v.sf2Preset, v.sf2Path || '', 60, 100);
    setTimeout(() => engine.auditionStop(60), ms);
  };

  const assign = (v: VoicePreset) => {
    mixer.assignVoice(targetFaderId, v.name);
    audition(v, 400);
    showAlert('SUCCESS', 'VOZ ASIGNADA', `"${v.name}" asignado a FADER ${targetFaderId}.`);
  };

  const targetName = mixer.faders.find((f) => f.id === targetFaderId)?.name;

  return (
    <View style={lib.container}>
      <ScreenHeader
        title="LIBRERÍA DE VOCES & SOUNDFONTS"
        onBack={onBack}
        subtitle={
          <View style={lib.targetFaderBar}>
            <Text style={lib.targetFaderLabel}>ASIGNAR A:</Text>
            {mixer.faders.map((f) => {
              const isSel = targetFaderId === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  activeOpacity={0.7}
                  delayPressIn={0}
                  delayPressOut={0}
                  style={[lib.targetFaderPill, isSel && lib.targetFaderPillActive]}
                  onPress={() => setTargetFaderId(f.id)}
                >
                  <Text style={[lib.targetFaderNum, isSel && lib.targetFaderNumActive]}>F{f.id}</Text>
                  <Text style={[lib.targetFaderName, isSel && lib.targetFaderNameActive]} numberOfLines={1}>
                    {f.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        }
      >
        <SearchBox value={search} onChange={setSearch} placeholder="Buscar sonido..." />
        <ImportButton onPress={() => importVoices(category)} />
      </ScreenHeader>

      <CategoryBar categories={VOICE_CATEGORIES} selected={category} onSelect={setCategory} getCount={getCount} />

      <ScrollView style={lib.scrollView} contentContainerStyle={lib.gridContainer}>
        {filtered.length === 0 ? (
          <EmptyLibrary message="No se encontraron sonidos que coincidan con la búsqueda." />
        ) : (
          filtered.map((v, index) => {
            const isAssigned = targetName === v.name;
            return (
              <LibraryCard
                key={v.id}
                number={`#${String(index + 1).padStart(3, '0')}`}
                category={v.category}
                meta={v.isCustom ? '[LOCAL SF2]' : `PR #${v.sf2Preset}`}
                title={v.name}
                highlighted={isAssigned}
                isCustom={v.isCustom}
                onPress={() => audition(v, 450)}
              >
                <TouchableOpacity
                  activeOpacity={0.7}
                  delayPressIn={0}
                  delayPressOut={0}
                  style={[lib.assignIconBtn, isAssigned && lib.assignIconBtnActive]}
                  onPress={() => assign(v)}
                >
                  <AssignIcon size={14} color={c(isAssigned ? '#00E5FF' : '#8A9EB8')} />
                </TouchableOpacity>
                <EditCardButton onPress={() => onRename(v.id, v.name)} />
                <DeleteCardButton onPress={() => deleteVoice(v.id, v.name)} />
              </LibraryCard>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};
