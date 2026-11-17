package expo.modules.synthengine

import android.content.res.AssetManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SynthEngineModule : Module() {
  private var midiManager: MidiManager? = null

  companion object {
    init {
      try {
        System.loadLibrary("synthengine")
      } catch (e: UnsatisfiedLinkError) {
        android.util.Log.e("SynthEngineModule", "Error al cargar libsynthengine.so", e)
      }
    }
  }

  // Métodos C++ JNI
  private external fun nativeInitialize(): Boolean
  private external fun nativeInitializeWithAssets(assetManager: AssetManager): Boolean
  private external fun nativeLoadSoundFont(assetPath: String): Boolean
  private external fun nativeSetLayerMix(layerIndex: Int, volume: Float, mute: Boolean, solo: Boolean)
  private external fun nativeSetLayerVoice(layerIndex: Int, voiceName: String, presetIndex: Int, fontPath: String): Boolean
  private external fun nativeSetLayerOctave(layerIndex: Int, octave: Int)
  private external fun nativeSetGlobalTranspose(transpose: Int)
  private external fun nativeSetLayerParam(layerIndex: Int, paramName: String, value: Float)
  private external fun nativeGetChannelLevels(): FloatArray
  private external fun nativeAuditionVoice(presetIndex: Int, fontPath: String, note: Int, velocity: Int)
  private external fun nativeAuditionStop(note: Int)
  private external fun nativeNoteOn(note: Int, velocity: Int)
  private external fun nativeNoteOff(note: Int)

  // Métodos de Acompañamiento / Estilos (.STY)
  private external fun nativeStyleNoteOn(channel: Int, note: Int, velocity: Int, program: Int)
  private external fun nativeStyleNoteOff(channel: Int, note: Int)
  private external fun nativeSetStyleMasterVolume(volume: Float)
  private external fun nativeStyleAllNotesOff()

  // Secuenciador Nativo C++ (Precisión de Muestra 0ms Jitter)
  private external fun nativeClearStyleData()
  private external fun nativeSetStylePpq(ppq: Int)
  private external fun nativeLoadStyleSectionEvents(sectionName: String, totalTicks: Int, eventsData: String)
  private external fun nativeStartStylePlayback(bpm: Int, accompanimentOn: Boolean)
  private external fun nativeStopStylePlayback()
  private external fun nativeSetStyleAccompaniment(enabled: Boolean)
  private external fun nativeSetStyleBpm(bpm: Int)
  private external fun nativeSetStyleSection(section: String)
  private external fun nativeQueueNextStyleSection(section: String)
  private external fun nativeIsStylePlaying(): Boolean
  private external fun nativeGetCurrentBeat(): Int
  private external fun nativeGetCurrentSection(): String
  private external fun nativeGetQueuedSection(): String
  private external fun nativeSetSyncStart(armed: Boolean)
  private external fun nativeIsSyncStartArmed(): Boolean
  private external fun nativeAllNotesOff()
  private external fun nativeGetSampleRate(): Int

  private external fun nativeSetParam(paramName: String, value: Float)
  private external fun nativeControlChange(channel: Int, cc: Int, value: Int)
  private external fun nativeProgramChange(channel: Int, program: Int)
  private external fun nativePitchBend(channel: Int, pitch: Int)
  private external fun nativeGetDetectedChord(): String
  private external fun nativeSetSplitPoint(note: Int)
  private external fun nativeSetBpm(bpm: Int)

  private fun getMidiManager(): MidiManager? {
    if (midiManager == null) {
      val context = appContext.reactContext
      if (context != null) {
        val manager = MidiManager(context)
        manager.logListener = object : MidiManager.MidiLogListener {
          override fun onLog(tag: String, message: String, level: String) {
            try {
              sendEvent("onMidiLog", mapOf(
                "tag" to tag,
                "message" to message,
                "level" to level,
                "timestamp" to System.currentTimeMillis()
              ))
            } catch (e: Exception) {
              // Ignore if event emitter is not ready
            }
          }
        }

        manager.listener = object : MidiManager.MidiListener {
          override fun onNoteOn(note: Int, velocity: Int) {
            nativeNoteOn(note, velocity)
            try {
              sendEvent("onMidiNoteReceived", mapOf("type" to "noteOn", "note" to note, "velocity" to velocity))
            } catch (e: Exception) {}
          }

          override fun onNoteOff(note: Int) {
            nativeNoteOff(note)
            try {
              sendEvent("onMidiNoteReceived", mapOf("type" to "noteOff", "note" to note, "velocity" to 0))
            } catch (e: Exception) {}
          }

          override fun onControlChange(channel: Int, cc: Int, value: Int) {
            nativeControlChange(channel, cc, value)
          }

          override fun onProgramChange(channel: Int, program: Int) {
            nativeProgramChange(channel, program)
          }

          override fun onPitchBend(channel: Int, pitch: Int) {
            nativePitchBend(channel, pitch)
          }

          override fun onDeviceLost() {
            nativeAllNotesOff()
          }
        }
        midiManager = manager
        android.util.Log.i("SynthEngineModule", "[MidiManager OK] Instanciado exitosamente con React Context!")
      } else {
        android.util.Log.w("SynthEngineModule", "appContext.reactContext sigue siendo null al solicitar MidiManager")
      }
    }
    return midiManager
  }

  override fun definition() = ModuleDefinition {
    Name("SynthEngine")

    Events("onMidiLog", "onMidiNoteReceived")

    OnCreate {
      getMidiManager()
    }

    Function("initialize") {
      val assetManager = appContext.reactContext?.assets
      if (assetManager != null) {
        nativeInitializeWithAssets(assetManager)
      } else {
        nativeInitialize()
      }
    }

    Function("loadSoundFont") { assetPath: String ->
      nativeLoadSoundFont(assetPath)
    }

    Function("setLayerMix") { layerIndex: Int, volume: Double, mute: Boolean, solo: Boolean ->
      nativeSetLayerMix(layerIndex, volume.toFloat(), mute, solo)
    }

    Function("setLayerVoice") { layerIndex: Int, voiceName: String, presetIndex: Int, fontPath: String ->
      nativeSetLayerVoice(layerIndex, voiceName, presetIndex, fontPath)
    }

    Function("setLayerOctave") { layerIndex: Int, octave: Int ->
      nativeSetLayerOctave(layerIndex, octave)
    }

    Function("setGlobalTranspose") { transpose: Int ->
      nativeSetGlobalTranspose(transpose)
    }

    Function("setLayerParam") { layerIndex: Int, paramName: String, value: Double ->
      nativeSetLayerParam(layerIndex, paramName, value.toFloat())
    }

    Function("getChannelLevels") {
      val raw = nativeGetChannelLevels()
      return@Function raw.map { it.toDouble() }
    }

    Function("auditionVoice") { presetIndex: Int, fontPath: String, note: Int, velocity: Int ->
      nativeAuditionVoice(presetIndex, fontPath, note, velocity)
    }

    Function("auditionStop") { note: Int ->
      nativeAuditionStop(note)
    }

    Function("noteOn") { note: Int, velocity: Int ->
      nativeNoteOn(note, velocity)
    }

    Function("noteOff") { note: Int ->
      nativeNoteOff(note)
    }

    // Métodos Arranger / Style
    Function("styleNoteOn") { channel: Int, note: Int, velocity: Int, program: Int ->
      nativeStyleNoteOn(channel, note, velocity, program)
    }

    Function("styleNoteOff") { channel: Int, note: Int ->
      nativeStyleNoteOff(channel, note)
    }

    Function("setStyleMasterVolume") { volume: Double ->
      nativeSetStyleMasterVolume(volume.toFloat())
    }

    Function("styleAllNotesOff") {
      nativeStyleAllNotesOff()
    }

    // Secuenciador Nativo C++
    Function("clearStyleData") {
      nativeClearStyleData()
    }

    Function("setStylePpq") { ppq: Int ->
      nativeSetStylePpq(ppq)
    }

    Function("loadStyleSectionEvents") { sectionName: String, totalTicks: Int, eventsData: String ->
      nativeLoadStyleSectionEvents(sectionName, totalTicks, eventsData)
    }

    Function("startStylePlayback") { bpm: Int, accompanimentOn: Boolean ->
      nativeStartStylePlayback(bpm, accompanimentOn)
    }

    Function("stopStylePlayback") {
      nativeStopStylePlayback()
    }

    Function("setStyleAccompaniment") { enabled: Boolean ->
      nativeSetStyleAccompaniment(enabled)
    }

    Function("setStyleBpm") { bpm: Int ->
      nativeSetStyleBpm(bpm)
    }

    Function("setStyleSection") { section: String ->
      nativeSetStyleSection(section)
    }

    Function("queueNextStyleSection") { section: String ->
      nativeQueueNextStyleSection(section)
    }

    Function("getStylePlaybackState") {
      return@Function mapOf(
        "isPlaying" to nativeIsStylePlaying(),
        "currentBeat" to nativeGetCurrentBeat(),
        "currentSection" to nativeGetCurrentSection(),
        "queuedSection" to nativeGetQueuedSection(),
        "isSyncStart" to nativeIsSyncStartArmed(),
        "chord" to nativeGetDetectedChord()
      )
    }

    Function("setSyncStart") { armed: Boolean ->
      nativeSetSyncStart(armed)
    }

    // Pedal de sustain desde la app (para teclados que no envían CC64)
    Function("setSustainPedal") { on: Boolean ->
      nativeControlChange(0, 64, if (on) 127 else 0)
    }

    Function("allNotesOff") {
      nativeAllNotesOff()
    }

    Function("getSampleRate") {
      nativeGetSampleRate()
    }

    Function("setParam") { paramName: String, value: Double ->
      nativeSetParam(paramName, value.toFloat())
    }

    Function("getDetectedChord") {
      nativeGetDetectedChord()
    }

    Function("setSplitPoint") { note: Int ->
      nativeSetSplitPoint(note)
    }

    Function("setBpm") { bpm: Int ->
      nativeSetBpm(bpm)
    }

    Function("getMidiDiagnostics") {
      val manager = getMidiManager()
      return@Function manager?.getDiagnosticsMap() ?: emptyMap<String, Any>()
    }

    Function("requestUsbPermission") {
      val manager = getMidiManager()
      manager?.requestUsbPermissionExplicit()
      return@Function true
    }

    Function("scanMidiDevices") {
      val manager = getMidiManager()
      val devices = manager?.scanDevices() ?: emptyList()
      return@Function devices.map {
        mapOf(
          "id" to it.id,
          "name" to it.name,
          "type" to it.type,
          "connected" to it.connected
        )
      }
    }

    Function("connectMidiDevice") { deviceId: String ->
      val manager = getMidiManager()
      val devices = manager?.scanDevices() ?: emptyList()
      val target = devices.find { it.id == deviceId }
      if (target != null) {
        if (target.nativeMidiDevice != null) {
          manager?.connectToDevice(target.nativeMidiDevice) {}
        } else if (target.nativeUsbDevice != null) {
          manager?.connectDirectUsbDevice(target.nativeUsbDevice)
        }
        return@Function true
      }
      return@Function false
    }

    Function("isBluetoothEnabled") {
      val manager = getMidiManager()
      return@Function manager?.isBluetoothEnabled() ?: false
    }

    // Abre el diálogo del sistema para encender Bluetooth
    Function("requestEnableBluetooth") {
      val activity = appContext.currentActivity ?: return@Function false
      try {
        val intent = android.content.Intent(android.bluetooth.BluetoothAdapter.ACTION_REQUEST_ENABLE)
        activity.startActivity(intent)
        return@Function true
      } catch (e: Exception) {
        android.util.Log.w("SynthEngineModule", "No se pudo solicitar encender Bluetooth", e)
        return@Function false
      }
    }

    Function("isBleScanning") {
      val manager = getMidiManager()
      return@Function manager?.isBleScanning() ?: false
    }

    Function("startBleScan") {
      val manager = getMidiManager()
      return@Function manager?.startBleScanExplicit() ?: false
    }

    Function("stopBleScan") {
      val manager = getMidiManager()
      return@Function manager?.stopBleScan() ?: true
    }

    Function("getDiscoveredBleDevices") {
      val manager = getMidiManager()
      return@Function manager?.getDiscoveredBleDevices() ?: emptyList<Map<String, Any>>()
    }

    AsyncFunction("connectBleDevice") { address: String ->
      val manager = getMidiManager() ?: return@AsyncFunction false
      var result = false
      val latch = java.util.concurrent.CountDownLatch(1)
      manager.connectBleDeviceByAddress(address) { success ->
        result = success
        latch.countDown()
      }
      try {
        latch.await(5, java.util.concurrent.TimeUnit.SECONDS)
      } catch (e: Exception) {}
      return@AsyncFunction result
    }

    Function("disconnectMidi") {
      val manager = getMidiManager()
      manager?.disconnect()
      return@Function true
    }
  }
}
