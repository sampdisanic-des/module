package expo.modules.synthengine

import org.junit.Assert.assertEquals
import org.junit.Test

class MidiParsersTest {
  private data class Msg(val status: Int, val d1: Int, val d2: Int)

  private fun bytes(vararg v: Int) = ByteArray(v.size) { v[it].toByte() }

  private fun parseStream(vararg chunks: ByteArray): List<Msg> {
    val out = mutableListOf<Msg>()
    val parser = MidiStreamParser { s, a, b -> out.add(Msg(s, a, b)) }
    chunks.forEach { parser.feed(it, 0, it.size) }
    return out
  }

  @Test fun noteOnOff() {
    assertEquals(
      listOf(Msg(0x90, 60, 100), Msg(0x80, 60, 0)),
      parseStream(bytes(0x90, 60, 100, 0x80, 60, 0))
    )
  }

  @Test fun runningStatusKeepsAllNoteOffs() {
    // Ráfaga típica de teclado: Note On con running status y velocidad 0 como Note Off
    val msgs = parseStream(bytes(0x90, 60, 100, 64, 90, 60, 0, 64, 0))
    assertEquals(4, msgs.size)
    assertEquals(Msg(0x90, 64, 90), msgs[1])
    assertEquals(Msg(0x90, 60, 0), msgs[2])
    assertEquals(Msg(0x90, 64, 0), msgs[3])
  }

  @Test fun messageSplitAcrossPackets() {
    val msgs = parseStream(bytes(0x90, 60), bytes(100), bytes(0xB0, 64), bytes(127))
    assertEquals(listOf(Msg(0x90, 60, 100), Msg(0xB0, 64, 127)), msgs)
  }

  @Test fun realtimeInsideMessageIsIgnored() {
    // Clock (F8) y Active Sensing (FE) intercalados no rompen el mensaje
    val msgs = parseStream(bytes(0x90, 0xF8, 60, 0xFE, 100))
    assertEquals(listOf(Msg(0x90, 60, 100)), msgs)
  }

  @Test fun sysexIsSkipped() {
    val msgs = parseStream(bytes(0xF0, 0x43, 0x10, 0x4C, 0xF7, 0x90, 62, 80))
    assertEquals(listOf(Msg(0x90, 62, 80)), msgs)
  }

  @Test fun dataAfterSysexWithoutStatusIsIgnored() {
    val msgs = parseStream(bytes(0x90, 60, 100, 0xF0, 1, 2, 0xF7, 61, 100))
    assertEquals(listOf(Msg(0x90, 60, 100)), msgs)
  }

  @Test fun programChangeAndPressureHaveOneDataByte() {
    val msgs = parseStream(bytes(0xC0, 5, 0xD0, 40, 0x90, 60, 1))
    assertEquals(listOf(Msg(0xC0, 5, 0), Msg(0xD0, 40, 0), Msg(0x90, 60, 1)), msgs)
  }

  @Test fun pitchBendChannel() {
    val msgs = parseStream(bytes(0xE3, 0x00, 0x40))
    assertEquals(listOf(Msg(0xE3, 0, 0x40)), msgs)
  }

  private fun parseUsb(vararg v: Int): List<Msg> {
    val out = mutableListOf<Msg>()
    val b = bytes(*v)
    forEachUsbMidiMessage(b, b.size) { s, a, c -> out.add(Msg(s, a, c)) }
    return out
  }

  @Test fun usbPacketsWithPaddingStayAligned() {
    val msgs = parseUsb(
      0x09, 0x90, 60, 100,
      0x00, 0x00, 0x00, 0x00,   // relleno
      0x08, 0x80, 60, 0,
      0x0B, 0xB0, 64, 127,
      0x0C, 0xC0, 3, 0
    )
    assertEquals(
      listOf(Msg(0x90, 60, 100), Msg(0x80, 60, 0), Msg(0xB0, 64, 127), Msg(0xC0, 3, 0)),
      msgs
    )
  }

  @Test fun usbSysexPacketsIgnoredAndTruncatedTailDropped() {
    val msgs = parseUsb(
      0x04, 0xF0, 0x43, 0x10,   // SysEx inicio
      0x07, 0x4C, 0x00, 0xF7,   // SysEx fin
      0x09, 0x91, 64, 90,
      0x09, 0x90                // paquete incompleto
    )
    assertEquals(listOf(Msg(0x91, 64, 90)), msgs)
  }
}
