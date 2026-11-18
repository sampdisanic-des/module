import React from 'react';
import { Modal, TouchableOpacity, View } from 'react-native';
import { Text } from '../AppText';
import { ConsoleAlertState } from '../../hooks/useConsoleAlert';
import { useModalStyles } from './modalStyles';

interface ConsoleAlertModalProps {
  alert: ConsoleAlertState;
  onClose: () => void;
}

const BADGE: Record<ConsoleAlertState['type'], string> = {
  ERROR: 'ERROR',
  SUCCESS: 'ÉXITO',
  INFO: 'INFORMACIÓN',
  WARNING: 'ATENCIÓN',
};

/** Aviso de la consola (éxito, error, información o confirmación) */
export const ConsoleAlertModal: React.FC<ConsoleAlertModalProps> = ({ alert, onClose }) => {
  const modal = useModalStyles();
  const isError = alert.type === 'ERROR';

  const confirm = () => {
    const cb = alert.onConfirm;
    onClose();
    if (cb) cb();
  };

  return (
    <Modal visible={alert.visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={[modal.box, isError && modal.boxError, alert.type === 'SUCCESS' && modal.boxSuccess]}>
          <View style={modal.header}>
            <Text style={[modal.badge, isError && modal.badgeError]}>{BADGE[alert.type]}</Text>
            <Text style={modal.titleText}>{alert.title}</Text>
          </View>

          <Text style={modal.messageText}>{alert.message}</Text>

          <View style={modal.actionsRow}>
            {alert.showCancel && (
              <TouchableOpacity activeOpacity={0.7} delayPressIn={0} delayPressOut={0} style={modal.cancelBtn} onPress={onClose}>
                <Text style={modal.cancelBtnText}>CANCELAR</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              activeOpacity={0.7}
              delayPressIn={0}
              delayPressOut={0}
              style={[modal.confirmBtn, isError && modal.confirmBtnError]}
              onPress={confirm}
            >
              <Text style={modal.confirmBtnText}>{alert.showCancel ? 'CONFIRMAR' : 'ENTENDIDO'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
