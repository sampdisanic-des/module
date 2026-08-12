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
  private external fun nativeNoteOn(note: Int, velocity: Int)
  private external fun nativeNoteOff(note: Int)
  private external fun nativeSetParam(paramName: String, value: Float)
  private external fun nativeControlChange(channel: Int, cc: Int, value: Int)
  private external fun nativeProgramChange(channel: Int, program: Int)
  private external fun nativePitchBend(channel: Int, pitch: Int)
  private external fun nativeGetDetectedChord(): String
  private external fun nativeSetSplitPoint(note: Int)
  private external fun nativeSetBpm(bpm: Int)
  private external fun nativeSetStyleSection(section: String)

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

    Function("noteOn") { note: Int, velocity: Int ->
      nativeNoteOn(note, velocity)
    }

    Function("noteOff") { note: Int ->
      nativeNoteOff(note)
    }

    Function("setParam") { paramName: String, value: Float ->
      nativeSetParam(paramName, value)
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

    Function("setStyleSection") { section: String ->
      nativeSetStyleSection(section)
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
          "type" to it.type
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
  }
}
