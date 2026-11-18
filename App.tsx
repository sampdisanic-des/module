import React, { useEffect, useState } from 'react';
import { BackHandler, SafeAreaView, StatusBar } from 'react-native';
import { setSustainPedal } from './modules/synth-engine/src';
import { useSynthEngine } from './src/hooks/useSynthEngine';
import { useMidiDevices } from './src/hooks/useMidiDevices';
import { useArranger } from './src/hooks/useArranger';
import { useConsoleAlert } from './src/hooks/useConsoleAlert';
import { useVoiceLibrary } from './src/hooks/useVoiceLibrary';
import { useFaders } from './src/hooks/useFaders';
import { useMemoryBanks } from './src/hooks/useMemoryBanks';
import { useBluetoothModal } from './src/hooks/useBluetoothModal';
import { useDeviceStatus } from './src/hooks/useDeviceStatus';
import { ThemeProvider, createThemedStyles, useTheme, useThemedStyles } from './src/theme/ThemeContext';
import { TopBar } from './src/components/TopBar';
import { LiveScreen } from './src/screens/live/LiveScreen';
import { EditVoiceScreen } from './src/screens/EditVoiceScreen';
import { StyleLibraryScreen } from './src/screens/library/StyleLibraryScreen';
import { VoiceLibraryScreen } from './src/screens/library/VoiceLibraryScreen';
import { ConsoleAlertModal } from './src/components/modals/ConsoleAlertModal';
import { RenameModal, RenameRequest } from './src/components/modals/RenameModal';
import { BluetoothMidiModal } from './src/components/modals/BluetoothMidiModal';

type View = 'LIVE' | 'EDIT_VOICE' | 'STYLE_LIBRARY' | 'VOICE_LIBRARY';

// ===================================================
// SYNTH CONNECT PRO: conecta los hooks con las pantallas
// ===================================================
function SynthConnectApp() {
  const styles = useThemedStyles(themed);
  const { mode } = useTheme();

  const engine = useSynthEngine();
  const midi = useMidiDevices();
  const arranger = useArranger();
  const { alert, showAlert, hideAlert } = useConsoleAlert();
  const voices = useVoiceLibrary(showAlert);
  const mixer = useFaders(engine, voices.fullVoiceLibrary);
  const banks = useMemoryBanks(mixer, arranger, showAlert);
  const ble = useBluetoothModal(midi, showAlert);
  const { timeStr, batteryPercent } = useDeviceStatus();

  const [view, setView] = useState<View>('LIVE');
  // La librería de voces se abre desde En vivo o desde Editar voz, y vuelve a donde se abrió
  const [voiceLibraryReturn, setVoiceLibraryReturn] = useState<'LIVE' | 'EDIT_VOICE'>('LIVE');
  const [renameRequest, setRenameRequest] = useState<RenameRequest | null>(null);

  // Pedal de sustain virtual (el piano no envía el pedal por MIDI)
  const [isSustainOn, setIsSustainOn] = useState<boolean>(false);
  const toggleSustain = () => {
    const next = !isSustainOn;
    setIsSustainOn(next);
    setSustainPedal(next);
  };

  const openVoiceLibrary = (faderId: number, from: 'LIVE' | 'EDIT_VOICE') => {
    mixer.setSelectedFaderId(faderId);
    setVoiceLibraryReturn(from);
    setView('VOICE_LIBRARY');
  };

  const handleRename = async (req: RenameRequest, newName: string) => {
    if (req.type === 'STYLE') {
      await arranger.renameStyleFile(req.targetId, newName);
      showAlert('SUCCESS', 'RITMO RENOMBRADO', `El ritmo ha sido renombrado a "${newName}".`);
    } else {
      await voices.renameVoice(req.targetId, newName);
      mixer.renameVoiceInFaders(req.currentName, newName);
      await banks.renameVoice(req.currentName, newName);
      showAlert('SUCCESS', 'VOZ RENOMBRADA', `La voz ha sido renombrada a "${newName}".`);
    }
    setRenameRequest(null);
  };

  // Botón atrás de Android: cierra modales y vuelve a la pantalla anterior
  useEffect(() => {
    const onBackPress = () => {
      if (ble.visible) {
        ble.close();
        return true;
      }
      if (renameRequest) {
        setRenameRequest(null);
        return true;
      }
      if (alert.visible) {
        hideAlert();
        return true;
      }
      if (view === 'VOICE_LIBRARY') {
        setView(voiceLibraryReturn);
        return true;
      }
      if (view !== 'LIVE') {
        setView('LIVE');
        return true;
      }
      return false;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [view, voiceLibraryReturn, ble, renameRequest, alert.visible, hideAlert]);

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} hidden={true} />

      <TopBar
        midi={midi}
        arranger={arranger}
        onMidiPress={ble.open}
        onStylePress={() => setView('STYLE_LIBRARY')}
        isSustainOn={isSustainOn}
        onToggleSustain={toggleSustain}
        timeStr={timeStr}
        batteryPercent={batteryPercent}
      />

      {view === 'LIVE' && (
        <LiveScreen
          arranger={arranger}
          mixer={mixer}
          banks={banks}
          onOpenVoice={(id) => openVoiceLibrary(id, 'LIVE')}
          onEditVoice={() => setView('EDIT_VOICE')}
        />
      )}

      {view === 'EDIT_VOICE' && (
        <EditVoiceScreen mixer={mixer} onBack={() => setView('LIVE')} onChangeVoice={(id) => openVoiceLibrary(id, 'EDIT_VOICE')} />
      )}

      {view === 'STYLE_LIBRARY' && (
        <StyleLibraryScreen
          arranger={arranger}
          onBack={() => setView('LIVE')}
          onRename={(id, name) => setRenameRequest({ type: 'STYLE', targetId: id, currentName: name })}
          showAlert={showAlert}
        />
      )}

      {view === 'VOICE_LIBRARY' && (
        <VoiceLibraryScreen
          voices={voices}
          mixer={mixer}
          engine={engine}
          initialTargetFaderId={mixer.selectedFaderId}
          onBack={() => setView(voiceLibraryReturn)}
          onRename={(id, name) => setRenameRequest({ type: 'VOICE', targetId: id, currentName: name })}
          showAlert={showAlert}
        />
      )}

      <RenameModal request={renameRequest} onCancel={() => setRenameRequest(null)} onSave={handleRename} />
      <ConsoleAlertModal alert={alert} onClose={hideAlert} />
      <BluetoothMidiModal midi={midi} ble={ble} />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <SynthConnectApp />
    </ThemeProvider>
  );
}

const themed = createThemedStyles({
  safeContainer: {
    flex: 1,
    backgroundColor: '#090D14',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
