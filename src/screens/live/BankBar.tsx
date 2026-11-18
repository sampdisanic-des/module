import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Text } from '../../components/AppText';
import { EditIcon } from '../../components/Icons';
import { MemoryBanksApi } from '../../hooks/useMemoryBanks';
import { createThemedStyles, useTheme, useThemedStyles } from '../../theme/ThemeContext';

interface BankBarProps {
  banks: MemoryBanksApi;
  activeFaderId: number;
  onEdit: () => void;
}

const BANK_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8];

/** Fila inferior de En vivo: bancos 1-8 y botón para editar la voz seleccionada */
export const BankBar: React.FC<BankBarProps> = ({ banks, activeFaderId, onEdit }) => {
  const styles = useThemedStyles(themed);
  const { c } = useTheme();

  return (
    <View style={styles.bankBar}>
      <View style={styles.bankBarLabelBox}>
        <Text style={styles.bankBarLabel}>BANCOS</Text>
        <Text style={styles.bankBarHint}>MANTENER 1 s = GUARDAR</Text>
      </View>
      {BANK_NUMBERS.map((bankNum) => {
        const isActive = banks.activeBank === bankNum;
        const hasPreset = !!banks.catalog[bankNum];
        return (
          <TouchableOpacity
            key={bankNum}
            activeOpacity={0.7}
            delayPressIn={0}
            delayPressOut={0}
            style={[styles.bankBtn, hasPreset && styles.bankBtnSaved, isActive && styles.bankBtnActive]}
            onPressIn={() => banks.handlePressIn(bankNum)}
            onPressOut={() => banks.handlePressOut(bankNum)}
          >
            <Text style={[styles.bankBtnNum, hasPreset && styles.bankBtnNumSaved, isActive && styles.bankBtnNumActive]}>{bankNum}</Text>
            <View style={[styles.bankBtnDot, hasPreset && styles.bankBtnDotSaved, isActive && styles.bankBtnDotActive]} />
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity activeOpacity={0.7} delayPressIn={0} delayPressOut={0} style={styles.editVoiceBtn} onPress={onEdit}>
        <EditIcon size={13} color={c('#000000')} />
        <Text style={styles.editVoiceBtnText}>EDITAR F{activeFaderId}</Text>
      </TouchableOpacity>
    </View>
  );
};

const themed = createThemedStyles({
  bankBar: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0D121B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#192433',
    paddingHorizontal: 6,
  },
  bankBarHint: {
    color: '#4C6078',
    fontSize: 6.5,
    fontWeight: '800',
  },
  bankBarLabel: {
    color: '#8A9EB8',
    fontSize: 10,
    fontWeight: '900',
  },
  bankBarLabelBox: {
    paddingRight: 4,
  },
  bankBtn: {
    flex: 1,
    height: 32,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#070B12',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#172332',
  },
  bankBtnActive: {
    borderColor: '#00E5FF',
    backgroundColor: '#052230',
    borderWidth: 1.5,
  },
  bankBtnDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#1A2534',
  },
  bankBtnDotActive: {
    backgroundColor: '#00E5FF',
  },
  bankBtnDotSaved: {
    backgroundColor: '#00E676',
  },
  bankBtnNum: {
    color: '#3B4D63',
    fontSize: 14,
    fontWeight: '900',
  },
  bankBtnNumActive: {
    color: '#00E5FF',
  },
  bankBtnNumSaved: {
    color: '#69F0AE',
  },
  bankBtnSaved: {
    borderColor: '#2E7D5B',
    backgroundColor: '#08150F',
  },
  editVoiceBtn: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    marginLeft: 4,
    backgroundColor: '#FF9100',
    borderRadius: 6,
  },
  editVoiceBtnText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900',
  },
});
