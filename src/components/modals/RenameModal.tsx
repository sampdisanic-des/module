import React, { useEffect, useState } from 'react';
import { Modal, TouchableOpacity, View } from 'react-native';
import { Text, TextInput } from '../AppText';
import { createThemedStyles, useTheme, useThemedStyles } from '../../theme/ThemeContext';
import { useModalStyles } from './modalStyles';

export interface RenameRequest {
  type: 'STYLE' | 'VOICE';
  targetId: string;
  currentName: string;
}

interface RenameModalProps {
  /** null = cerrado */
  request: RenameRequest | null;
  onCancel: () => void;
  onSave: (request: RenameRequest, newName: string) => void;
}

/** Cambiar el nombre de un ritmo o de una voz importada */
export const RenameModal: React.FC<RenameModalProps> = ({ request, onCancel, onSave }) => {
  const styles = useThemedStyles(themed);
  const modal = useModalStyles();
  const { c } = useTheme();
  const [text, setText] = useState('');

  useEffect(() => {
    if (request) setText(request.currentName);
  }, [request]);

  const save = () => {
    const trimmed = text.trim();
    if (request && trimmed) onSave(request, trimmed);
  };

  return (
    <Modal visible={!!request} animationType="fade" transparent={true} onRequestClose={onCancel}>
      <View style={modal.overlay}>
        <View style={styles.renameBox}>
          <View style={modal.header}>
            <Text style={styles.renameBadge}>EDITAR NOMBRE</Text>
            <Text style={modal.titleText}>{request?.type === 'STYLE' ? 'Renombrar Ritmo' : 'Renombrar Sonido'}</Text>
          </View>

          <TextInput
            style={styles.renameInput}
            value={text}
            onChangeText={setText}
            autoFocus={true}
            selectTextOnFocus={true}
            placeholder="Ingresa el nuevo nombre..."
            placeholderTextColor={c('#5C7087')}
          />

          <View style={modal.actionsRow}>
            <TouchableOpacity activeOpacity={0.7} style={modal.cancelBtn} onPress={onCancel}>
              <Text style={modal.cancelBtnText}>CANCELAR</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7} style={styles.renameSaveBtn} onPress={save}>
              <Text style={styles.renameSaveBtnText}>GUARDAR NOMBRE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const themed = createThemedStyles({
  renameBadge: {
    color: '#00E5FF',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  renameBox: {
    width: 320,
    backgroundColor: '#0B0F17',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00E5FF',
    padding: 12,
  },
  renameInput: {
    backgroundColor: '#05080E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 4,
    color: '#FFFFFF',
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginVertical: 10,
  },
  renameSaveBtn: {
    backgroundColor: '#00E5FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  renameSaveBtnText: {
    color: '#000000',
    fontSize: 8.5,
    fontWeight: '900',
  },
});
