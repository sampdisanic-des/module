package expo.modules.synthengine

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
  private external fun nativeNoteOn(note: Int, velocity: Int)
  private external fun nativeNoteOff(note: Int)
  private external fun nativeSetParam(paramName: String, value: Float)
  private external fun nativeControlChange(channel: Int, cc: Int, value: Int)
  private external fun nativeProgramChange(channel: Int, program: Int)
  private external fun nativeGetDetectedChord(): String
  private external fun nativeSetSplitPoint(note: Int)
  private external fun nativeSetBpm(bpm: Int)
  private external fun nativeSetStyleSection(section: String)

  override fun definition() = ModuleDefinition {
    Name("SynthEngine")

    OnCreate {
      val context = appContext.reactContext ?: return@OnCreate
      val manager = MidiManager(context)
      manager.listener = object : MidiManager.MidiListener {
        override fun onNoteOn(note: Int, velocity: Int) {
          nativeNoteOn(note, velocity)
        }

        override fun onNoteOff(note: Int) {
          nativeNoteOff(note)
        }

        override fun onControlChange(channel: Int, cc: Int, value: Int) {
          nativeControlChange(channel, cc, value)
        }

        override fun onProgramChange(channel: Int, program: Int) {
          nativeProgramChange(channel, program)
        }
      }
      midiManager = manager
    }

    Function("initialize") {
      return@Function nativeInitialize()
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
      return@Function nativeGetDetectedChord()
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

    Function("scanMidiDevices") {
      val devices = midiManager?.scanDevices() ?: emptyList()
      return@Function devices.map {
        mapOf(
          "id" to it.id,
          "name" to it.name,
          "type" to it.type
        )
      }
    }

    Function("connectMidiDevice") { deviceId: String ->
      val devices = midiManager?.scanDevices() ?: emptyList()
      val target = devices.find { it.id == deviceId }
      if (target != null) {
        var success = false
        midiManager?.connectToDevice(target.nativeDevice) { result ->
          success = result
        }
        return@Function success
      }
      return@Function false
    }
  }
}
