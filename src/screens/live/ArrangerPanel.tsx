import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Text } from '../../components/AppText';
import { HorizontalFader } from '../../components/controls/HorizontalFader';
import { StyleSection, UseArrangerReturn } from '../../hooks/useArranger';
import { createThemedStyles, useThemedStyles } from '../../theme/ThemeContext';
import { ON_ACCENT } from '../../theme/colorTransform';

type Variation = 'A' | 'B' | 'C' | 'D';
const VARIATIONS: Variation[] = ['A', 'B', 'C', 'D'];

const formatSectionName = (sec: string) => {
  if (!sec) return '';
  const [kind, letter] = sec.split('_');
  return `${kind} ${letter ?? ''}`.trim();
};

/** Zona izquierda de En vivo: acorde, secciones del ritmo y transporte */
export const ArrangerPanel: React.FC<{ arranger: UseArrangerReturn }> = ({ arranger }) => {
  const styles = useThemedStyles(themed);
  const {
    currentChord,
    currentSection,
    queuedSection,
    isPlaying,
    isSyncStart,
    isAccompanimentOn,
    styleVolume,
    availableSections,
    setSection,
    triggerFillIn,
    setStyleVolume,
    startStopStyle,
    toggleSyncStart,
    toggleAccompaniment,
  } = arranger;

  // Variación en uso: la de la sección actual (MAIN_B, FILL_B, INTRO_B -> B)
  const currentVariation = (currentSection.split('_')[1] as Variation) || 'A';

  // INTRO / ENDING usan la variación en uso; si el ritmo no la trae, la A
  const resolveSection = (kind: 'INTRO' | 'ENDING'): StyleSection => {
    const wanted = `${kind}_${currentVariation}` as StyleSection;
    return availableSections.includes(wanted) ? wanted : (`${kind}_A` as StyleSection);
  };

  const handleIntro = () => {
    setSection(resolveSection('INTRO'));
    if (!isPlaying) startStopStyle();
  };

  const handleEnding = () => {
    if (isPlaying) setSection(resolveSection('ENDING'));
  };

  const introCurrent = currentSection.startsWith('INTRO_');
  const introQueued = queuedSection.startsWith('INTRO_');
  const endingCurrent = currentSection.startsWith('ENDING_');
  const endingQueued = queuedSection.startsWith('ENDING_');

  return (
    <View style={styles.arrangerZone}>
      <View style={styles.chordCard}>
        {/* Ambas columnas empiezan con su etiqueta arriba, a la misma altura */}
        <View style={styles.chordMain}>
          <Text style={styles.chordLabel}>ACORDE</Text>
          <View style={styles.chordValueBox}>
            <Text style={[styles.chordText, currentChord === '---' && styles.chordTextIdle]} numberOfLines={1} adjustsFontSizeToFit>
              {currentChord}
            </Text>
          </View>
        </View>
        <View style={styles.chordSide}>
          <View style={styles.sectionLabelRow}>
            <Text style={styles.chordLabel}>SECCIÓN</Text>
            <Text style={styles.sectionNextText} numberOfLines={1}>
              {queuedSection ? `SIGUE: ${formatSectionName(queuedSection)}` : isSyncStart ? 'ESPERANDO NOTA' : ''}
            </Text>
          </View>
          <Text style={[styles.sectionNowText, isPlaying && styles.sectionNowTextPlaying]}>{formatSectionName(currentSection)}</Text>
          <View style={styles.styleVolumeBox}>
            <HorizontalFader label="VOL. RITMO" value={styleVolume} onChange={setStyleVolume} color="#00E5FF" />
          </View>
        </View>
      </View>

      {/* MAIN A-D */}
      <View style={styles.mainSectionRow}>
        {VARIATIONS.map((letter) => {
          const sec = `MAIN_${letter}` as StyleSection;
          const isCurrent = currentSection === sec;
          const isVariation = !isCurrent && currentVariation === letter && !currentSection.startsWith('MAIN_');
          const isQueued = queuedSection === sec;
          return (
            <TouchableOpacity
              key={sec}
              activeOpacity={0.7}
              delayPressIn={0}
              delayPressOut={0}
              style={[
                styles.mainSectionBtn,
                isVariation && styles.mainSectionBtnVariation,
                isCurrent && styles.mainSectionBtnActive,
                isQueued && styles.liveQueued,
              ]}
              onPress={() => setSection(sec)}
            >
              <Text style={styles.mainSectionKind}>MAIN</Text>
              <Text
                style={[
                  styles.mainSectionLetter,
                  (isCurrent || isVariation) && styles.mainSectionLetterActive,
                  isQueued && styles.sectionTextQueued,
                ]}
              >
                {letter}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* INTRO / FILL / ENDING */}
      <View style={styles.specialSectionRow}>
        <TouchableOpacity
          activeOpacity={0.7}
          delayPressIn={0}
          delayPressOut={0}
          style={[styles.specialBtn, introCurrent && isPlaying && styles.liveIntroBtnActive, introQueued && styles.liveQueued]}
          onPress={handleIntro}
        >
          <Text style={[styles.specialBtnText, styles.liveIntroText, introQueued && styles.sectionTextQueued]}>INTRO</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          delayPressIn={0}
          delayPressOut={0}
          style={[styles.specialBtn, currentSection.startsWith('FILL_') && styles.fillBtnActive, !isPlaying && styles.specialBtnDisabled]}
          onPress={() => triggerFillIn(currentVariation)}
        >
          <Text style={[styles.specialBtnText, styles.fillText]}>FILL</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          delayPressIn={0}
          delayPressOut={0}
          style={[
            styles.specialBtn,
            endingCurrent && isPlaying && styles.liveEndingBtnActive,
            endingQueued && styles.liveQueued,
            !isPlaying && styles.specialBtnDisabled,
          ]}
          onPress={handleEnding}
        >
          <Text style={[styles.specialBtnText, styles.liveEndingText, endingQueued && styles.sectionTextQueued]}>ENDING</Text>
        </TouchableOpacity>
      </View>

      {/* SYNC / ACMP / START */}
      <View style={styles.transportRowLive}>
        <TouchableOpacity
          activeOpacity={0.7}
          delayPressIn={0}
          delayPressOut={0}
          style={[styles.transportBtnLive, isSyncStart && styles.syncBtnOn]}
          onPress={toggleSyncStart}
        >
          <View style={[styles.transportLed, isSyncStart && styles.transportLedSync]} />
          <Text style={[styles.transportBtnLiveText, isSyncStart && styles.syncTextOn]}>SYNC</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          delayPressIn={0}
          delayPressOut={0}
          style={[styles.transportBtnLive, isAccompanimentOn && styles.acmpBtnOn]}
          onPress={toggleAccompaniment}
        >
          <View style={[styles.transportLed, isAccompanimentOn && styles.transportLedAcmp]} />
          <Text style={[styles.transportBtnLiveText, isAccompanimentOn && styles.acmpTextOn]}>ACMP</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          delayPressIn={0}
          delayPressOut={0}
          style={[styles.startBtnLive, isPlaying && styles.startBtnLivePlaying]}
          onPress={startStopStyle}
        >
          <Text style={[styles.startBtnLiveText, isPlaying && styles.startBtnLiveTextPlaying]}>{isPlaying ? 'STOP' : 'START'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const themed = createThemedStyles({
  acmpBtnOn: {
    backgroundColor: '#04232E',
    borderColor: '#00E5FF',
  },
  acmpTextOn: {
    color: '#00E5FF',
  },
  arrangerZone: {
    flex: 46,
    gap: 6,
  },
  chordCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#060A10',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#192433',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 14,
  },
  chordLabel: {
    color: '#4C6078',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
    lineHeight: 12,
  },
  chordMain: {
    flex: 1,
  },
  chordValueBox: {
    flex: 1,
    justifyContent: 'center',
  },
  chordSide: {
    width: '44%',
  },
  chordText: {
    color: '#00E5FF',
    fontSize: 54,
    fontWeight: '900',
    letterSpacing: -1,
  },
  chordTextIdle: {
    color: '#1E2B3D',
  },
  fillBtnActive: {
    backgroundColor: '#24183D',
    borderColor: '#B388FF',
    borderWidth: 1.5,
  },
  fillText: {
    color: '#B388FF',
  },
  liveEndingBtnActive: {
    backgroundColor: '#3D0A12',
    borderColor: '#FF1744',
    borderWidth: 1.5,
  },
  liveEndingText: {
    color: '#FF5252',
  },
  liveIntroBtnActive: {
    backgroundColor: '#3A2900',
    borderColor: '#FFB300',
    borderWidth: 1.5,
  },
  liveIntroText: {
    color: '#FFB300',
  },
  liveQueued: {
    borderColor: '#FFD700',
    borderWidth: 1.5,
    backgroundColor: '#2A2000',
  },
  mainSectionBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#081720',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#123142',
  },
  mainSectionBtnActive: {
    backgroundColor: '#00394A',
    borderColor: '#00E5FF',
    borderWidth: 1.5,
  },
  mainSectionBtnVariation: {
    borderColor: '#00E5FF66',
  },
  mainSectionKind: {
    color: '#4C7A8C',
    fontSize: 8,
    fontWeight: '900',
  },
  mainSectionLetter: {
    color: '#5FA9BF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: -2,
  },
  mainSectionLetterActive: {
    color: '#00E5FF',
  },
  mainSectionRow: {
    height: 54,
    flexDirection: 'row',
    gap: 6,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  sectionNextText: {
    flex: 1,
    textAlign: 'right',
    color: '#FFD700',
    fontSize: 9,
    fontWeight: '800',
  },
  sectionNowText: {
    color: '#8A9EB8',
    fontSize: 18,
    fontWeight: '900',
  },
  sectionNowTextPlaying: {
    color: '#FFFFFF',
  },
  sectionTextQueued: {
    color: '#FFD700',
  },
  specialBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0C111A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E2A3A',
  },
  specialBtnDisabled: {
    opacity: 0.45,
  },
  specialBtnText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  specialSectionRow: {
    height: 44,
    flexDirection: 'row',
    gap: 6,
  },
  startBtnLive: {
    flex: 1.6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#00E5FF',
    borderRadius: 8,
  },
  startBtnLivePlaying: {
    backgroundColor: '#FF1744',
  },
  startBtnLiveText: {
    color: '#00151C',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 1,
  },
  startBtnLiveTextPlaying: {
    color: ON_ACCENT,
  },
  styleVolumeBox: {
    marginTop: 'auto',
  },
  syncBtnOn: {
    backgroundColor: '#062A16',
    borderColor: '#00E676',
  },
  syncTextOn: {
    color: '#00E676',
  },
  transportBtnLive: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0C111A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E2A3A',
  },
  transportBtnLiveText: {
    color: '#8A9EB8',
    fontSize: 13,
    fontWeight: '900',
  },
  transportLed: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1E2B3D',
  },
  transportLedAcmp: {
    backgroundColor: '#00E5FF',
  },
  transportLedSync: {
    backgroundColor: '#00E676',
  },
  transportRowLive: {
    height: 52,
    flexDirection: 'row',
    gap: 6,
  },
});
