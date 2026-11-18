import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Text } from '../components/AppText';
import { ScreenHeader } from '../components/ScreenHeader';
import { AdsrGraph } from '../components/AdsrGraph';
import { HorizontalFader } from '../components/controls/HorizontalFader';
import { Stepper } from '../components/Stepper';
import { FadersApi } from '../hooks/useFaders';
import { formatSigned } from '../types/fader';
import { formatAttack, formatDecay, formatRelease, formatSustain } from '../utils/adsrFormat';
import { createThemedStyles, useThemedStyles } from '../theme/ThemeContext';

interface EditVoiceScreenProps {
  mixer: FadersApi;
  onBack: () => void;
  /** Abrir la librería para cambiar la voz del fader */
  onChangeVoice: (faderId: number) => void;
}

const ENV_COLOR = '#FF9100';
const FILTER_COLOR = '#00E5FF';
const MOD_COLOR = '#B388FF';

/** Edición del sonido de cada fader: envolvente, filtro, octava y modulación */
export const EditVoiceScreen: React.FC<EditVoiceScreenProps> = ({ mixer, onBack, onChangeVoice }) => {
  const styles = useThemedStyles(themed);
  const { faders, activeFader: f, selectedFaderId, setSelectedFaderId, updateActiveParam } = mixer;

  return (
    <View style={styles.editContainer}>
      <ScreenHeader title="EDITAR VOZ" onBack={onBack} subtitle="Los cambios se aplican al fader seleccionado y se guardan con los bancos.">
        <View style={styles.editFaderTabs}>
          {faders.map((tab) => {
            const isSel = tab.id === selectedFaderId;
            return (
              <TouchableOpacity
                key={tab.id}
                activeOpacity={0.7}
                delayPressIn={0}
                delayPressOut={0}
                style={[styles.editFaderTab, isSel && styles.editFaderTabActive]}
                onPress={() => setSelectedFaderId(tab.id)}
              >
                <Text style={[styles.editFaderTabId, isSel && styles.editFaderTabIdActive]}>F{tab.id}</Text>
                <Text style={[styles.editFaderTabName, isSel && styles.editFaderTabNameActive]} numberOfLines={1}>
                  {tab.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScreenHeader>

      <View style={styles.editBody}>
        {/* Voz, gráfica y octava */}
        <View style={styles.editCard}>
          <Text style={styles.editCardTitle}>VOZ F{f.id}</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            delayPressIn={0}
            delayPressOut={0}
            style={styles.editVoiceNameBox}
            onPress={() => onChangeVoice(f.id)}
          >
            <Text style={styles.editVoiceName} numberOfLines={2}>
              {f.name}
            </Text>
            <Text style={styles.editVoiceChange}>CAMBIAR ›</Text>
          </TouchableOpacity>

          <AdsrGraph attack={f.attack} decay={f.delay} sustain={f.sustain} release={f.release} />

          <Stepper
            bare
            label={`OCTAVA F${f.id}`}
            value={formatSigned(f.octave)}
            onDecrement={() => mixer.shiftFaderOctave(f.id, -1)}
            onIncrement={() => mixer.shiftFaderOctave(f.id, 1)}
          />
        </View>

        {/* Envolvente */}
        <View style={styles.editCard}>
          <Text style={styles.editCardTitle}>ENVOLVENTE</Text>
          <View style={styles.editFaderStack}>
            <HorizontalFader large label="ATTACK" value={f.attack} displayValue={formatAttack(f.attack)} color={ENV_COLOR} onChange={(v) => updateActiveParam('attack', v)} />
            <HorizontalFader large label="DECAY" value={f.delay} displayValue={formatDecay(f.delay)} color={ENV_COLOR} onChange={(v) => updateActiveParam('delay', v)} />
            <HorizontalFader large label="SUSTAIN" value={f.sustain} displayValue={formatSustain(f.sustain)} color={ENV_COLOR} onChange={(v) => updateActiveParam('sustain', v)} />
            <HorizontalFader large label="RELEASE" value={f.release} displayValue={formatRelease(f.release)} color={ENV_COLOR} onChange={(v) => updateActiveParam('release', v)} />
          </View>
        </View>

        {/* Filtro y modulación */}
        <View style={styles.editCard}>
          <Text style={styles.editCardTitle}>FILTRO</Text>
          <View style={styles.editFaderStack}>
            <HorizontalFader large label="CUTOFF" value={f.cutoff} color={FILTER_COLOR} onChange={(v) => updateActiveParam('cutoff', v)} />
            <HorizontalFader large label="RESONANCIA" value={f.resonance} color={FILTER_COLOR} onChange={(v) => updateActiveParam('resonance', v)} />
          </View>
          <Text style={[styles.editCardTitle, styles.editCardTitleSpaced]}>MODULACIÓN (TODAS LAS VOCES)</Text>
          <HorizontalFader large label="VIBRATO" value={mixer.modulation} color={MOD_COLOR} onChange={mixer.setModulation} />
        </View>
      </View>
    </View>
  );
};

const themed = createThemedStyles({
  editBody: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  editCard: {
    flex: 1,
    backgroundColor: '#0A0F17',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#192433',
    padding: 10,
  },
  editCardTitle: {
    color: '#6B829D',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  editCardTitleSpaced: {
    marginTop: 14,
  },
  editContainer: {
    flex: 1,
    paddingTop: 5,
  },
  editFaderStack: {
    gap: 10,
  },
  editFaderTab: {
    width: 92,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: '#080C14',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  editFaderTabActive: {
    borderColor: '#FF9100',
    backgroundColor: '#1F1405',
  },
  editFaderTabId: {
    color: '#5D7290',
    fontSize: 9,
    fontWeight: '900',
  },
  editFaderTabIdActive: {
    color: '#FF9100',
  },
  editFaderTabName: {
    color: '#6B829D',
    fontSize: 8,
    fontWeight: '700',
  },
  editFaderTabNameActive: {
    color: '#FFE0B2',
  },
  editFaderTabs: {
    flexDirection: 'row',
    gap: 4,
  },
  editVoiceChange: {
    color: '#00E5FF',
    fontSize: 9,
    fontWeight: '900',
  },
  editVoiceName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  editVoiceNameBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#060A10',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#24364D',
    padding: 8,
  },
});
