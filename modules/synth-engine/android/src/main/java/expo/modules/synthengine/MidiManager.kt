package expo.modules.synthengine

import android.content.Context
import android.media.midi.*
import android.os.Handler
import android.os.Looper
import android.util.Log

class MidiDeviceHandler(
  val id: String,
  val name: String,
  val type: String, // "USB" o "BLUETOOTH"
  val nativeDevice: MidiDeviceInfo
)

class MidiManager(private val context: Context) {
  private val midiManager: android.media.midi.MidiManager? =
    context.getSystemService(Context.MIDI_SERVICE) as? android.media.midi.MidiManager

  private var openMidiDevice: MidiDevice? = null
  private var outputPort: MidiOutputPort? = null

  interface MidiListener {
    fun onNoteOn(note: Int, velocity: Int)
    fun onNoteOff(note: Int)
    fun onControlChange(channel: Int, cc: Int, value: Int)
    fun onProgramChange(channel: Int, program: Int)
  }

  var listener: MidiListener? = null

  fun scanDevices(): List<MidiDeviceHandler> {
    val result = mutableListOf<MidiDeviceHandler>()
    if (midiManager == null) return result

    val devices = midiManager.devices
    for (dev in devices) {
      val properties = dev.properties
      val name = properties.getString(MidiDeviceInfo.PROPERTY_NAME)
        ?: properties.getString(MidiDeviceInfo.PROPERTY_MANUFACTURER)
        ?: "Dispositivo MIDI Generico"
      
      val isUsb = dev.type == MidiDeviceInfo.TYPE_USB
      val typeStr = if (isUsb) "USB" else "BLUETOOTH"
      val id = "midi_${dev.id}"

      result.add(MidiDeviceHandler(id, name, typeStr, dev))
    }
    return result
  }

  fun connectToDevice(deviceInfo: MidiDeviceInfo, onConnected: (Boolean) -> Unit) {
    if (midiManager == null) {
      onConnected(false)
      return
    }

    midiManager.openDevice(deviceInfo, { device ->
      if (device != null) {
        openMidiDevice = device
        val info = device.info
        if (info.outputPortCount > 0) {
          outputPort = device.openOutputPort(0)
          outputPort?.connect(MidiReceiverImpl())
          Log.i("MidiManager", "[OK] Conectado exitosamente a puerto MIDI: ${info.properties.getString(MidiDeviceInfo.PROPERTY_NAME)}")
          onConnected(true)
        } else {
          Log.w("MidiManager", "El dispositivo no tiene puertos de salida MIDI")
          onConnected(false)
        }
      } else {
        Log.e("MidiManager", "Error al abrir dispositivo MIDI")
        onConnected(false)
      }
    }, Handler(Looper.getMainLooper()))
  }

  fun disconnect() {
    outputPort?.close()
    openMidiDevice?.close()
    outputPort = null
    openMidiDevice = null
    Log.i("MidiManager", "Dispositivo MIDI desconectado")
  }

  private inner class MidiReceiverImpl : MidiReceiver() {
    override fun onSend(data: ByteArray?, offset: Int, count: Int, timestamp: Long) {
      if (data == null || count < 2) return

      var index = offset
      val end = offset + count

      while (index < end) {
        val status = data[index].toInt() and 0xFF
        val command = status and 0xF0
        val channel = status and 0x0F

        when (command) {
          0x90 -> { // Note ON
            if (index + 2 < end) {
              val note = data[index + 1].toInt() and 0x7F
              val velocity = data[index + 2].toInt() and 0x7F
              if (velocity > 0) {
                listener?.onNoteOn(note, velocity)
              } else {
                listener?.onNoteOff(note)
              }
              index += 3
            } else break
          }
          0x80 -> { // Note OFF
            if (index + 2 < end) {
              val note = data[index + 1].toInt() and 0x7F
              listener?.onNoteOff(note)
              index += 3
            } else break
          }
          0xB0 -> { // Control Change
            if (index + 2 < end) {
              val cc = data[index + 1].toInt() and 0x7F
              val value = data[index + 2].toInt() and 0x7F
              listener?.onControlChange(channel, cc, value)
              index += 3
            } else break
          }
          0xC0 -> { // Program Change
            if (index + 1 < end) {
              val program = data[index + 1].toInt() and 0x7F
              listener?.onProgramChange(channel, program)
              index += 2
            } else break
          }
          else -> {
            index++
          }
        }
      }
    }
  }
}
