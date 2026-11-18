import React from 'react';
import { View } from 'react-native';
import { ChannelFader } from '../../components/controls/ChannelFader';
import { Stepper } from '../../components/Stepper';
import { FadersApi } from '../../hooks/useFaders';
import { formatSigned } from '../../types/fader';
import { createThemedStyles, useThemedStyles } from '../../theme/ThemeContext';

interface MixerPanelProps {
  mixer: FadersApi;
  /** Tocar el nombre de la voz abre la librería para ese fader */
  onOpenVoice: (faderId: number) => void;
}

/** Zona derecha de En vivo: 4 faders, octava del fader seleccionado y transposición global */
export const MixerPanel: React.FC<MixerPanelProps> = ({ mixer, onOpenVoice }) => {
  const styles = useThemedStyles(themed);
  const { faders, selectedFaderId, setSelectedFaderId, transpose, activeFader } = mixer;

  return (
    <View style={styles.mixerZone}>
      <View style={styles.fadersRowLive}>
        {faders.map((fader) => (
          <ChannelFader
            key={fader.id}
            id={fader.id}
            name={fader.name}
            value={fader.value}
            solo={fader.solo}
            mute={fader.mute}
            octave={fader.octave}
            isSelected={selectedFaderId === fader.id}
            onSelect={setSelectedFaderId}
            onChange={mixer.setVolume}
            onToggleSolo={mixer.toggleSolo}
            onToggleMute={mixer.toggleMute}
            onOpenVoice={onOpenVoice}
          />
        ))}
      </View>

      <View style={styles.mixerBottomRow}>
        {/* La octava cambia solo el fader seleccionado */}
        <Stepper
          label={`OCTAVA F${activeFader.id}`}
          value={formatSigned(activeFader.octave)}
          highlight={activeFader.octave !== 0}
          onDecrement={() => mixer.shiftFaderOctave(activeFader.id, -1)}
          onIncrement={() => mixer.shiftFaderOctave(activeFader.id, 1)}
        />
        <Stepper
          label="TRANSP."
          value={formatSigned(transpose)}
          highlight={transpose !== 0}
          onDecrement={() => mixer.changeTranspose(-1)}
          onIncrement={() => mixer.changeTranspose(1)}
        />
      </View>
    </View>
  );
};

const themed = createThemedStyles({
  fadersRowLive: {
    flex: 1,
    flexDirection: 'row',
    gap: 5,
  },
  mixerBottomRow: {
    height: 40,
    flexDirection: 'row',
    gap: 6,
  },
  mixerZone: {
    flex: 54,
    gap: 6,
  },
});
