import { useCallback, useState } from 'react';

export type AlertType = 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING';

export interface ConsoleAlertState {
  visible: boolean;
  type: AlertType;
  title: string;
  message: string;
  onConfirm?: () => void;
  showCancel?: boolean;
}

export type ShowAlert = (
  type: AlertType,
  title: string,
  message: string,
  onConfirm?: () => void,
  showCancel?: boolean
) => void;

/** Avisos de la consola (modal propio en lugar del Alert del sistema) */
export const useConsoleAlert = () => {
  const [alert, setAlert] = useState<ConsoleAlertState>({
    visible: false,
    type: 'SUCCESS',
    title: '',
    message: '',
  });

  const showAlert: ShowAlert = useCallback((type, title, message, onConfirm, showCancel = false) => {
    setAlert({ visible: true, type, title, message, onConfirm, showCancel });
  }, []);

  const hideAlert = useCallback(() => {
    setAlert((prev) => ({ ...prev, visible: false }));
  }, []);

  return { alert, showAlert, hideAlert };
};
