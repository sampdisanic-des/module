import React from 'react';
import { View } from 'react-native';
import { UseArrangerReturn } from '../../hooks/useArranger';
import { FadersApi } from '../../hooks/useFaders';
import { MemoryBanksApi } from '../../hooks/useMemoryBanks';
import { createThemedStyles, useThemedStyles } from '../../theme/ThemeContext';
import { ArrangerPanel } from './ArrangerPanel';
import { MixerPanel } from './MixerPanel';
import { BankBar } from './BankBar';

interface LiveScreenProps {
  arranger: UseArrangerReturn;
  mixer: FadersApi;
  banks: MemoryBanksApi;
  onOpenVoice: (faderId: number) => void;
  onEditVoice: () => void;
}

/** Pantalla principal para tocar: arreglista a la izquierda, faders a la derecha, bancos abajo */
export const LiveScreen: React.FC<LiveScreenProps> = ({ arranger, mixer, banks, onOpenVoice, onEditVoice }) => {
  const styles = useThemedStyles(themed);
  return (
    <View style={styles.liveContainer}>
      <View style={styles.liveWorkspace}>
        <ArrangerPanel arranger={arranger} />
        <MixerPanel mixer={mixer} onOpenVoice={onOpenVoice} />
      </View>
      <BankBar banks={banks} activeFaderId={mixer.activeFader.id} onEdit={onEditVoice} />
    </View>
  );
};

const themed = createThemedStyles({
  liveContainer: {
    flex: 1,
    paddingTop: 5,
    gap: 5,
  },
  liveWorkspace: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
});
