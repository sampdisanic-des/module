package expo.modules.synthengine

import android.app.PendingIntent
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.*
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.hardware.usb.*
import android.media.midi.*
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import java.util.concurrent.ConcurrentHashMap

class MidiDeviceHandler(
  val id: String,
  val name: String,
  val type: String, // "USB" o "BLUETOOTH"
  val connected: Boolean,
  val nativeMidiDevice: MidiDeviceInfo? = null,
  val nativeUsbDevice: UsbDevice? = null
)

/**
 * Parser MIDI 1.0 con running status. Tolera mensajes partidos entre llamadas,
 * ignora SysEx y mensajes de tiempo real. Un parser por puerto de entrada.
 */
class MidiStreamParser(private val dispatch: (status: Int, d1: Int, d2: Int) -> Unit) {
  private var runningStatus = 0
  private var needed = 0
  private var count = 0
  private var data0 = 0
  private var inSysex = false

  fun feed(bytes: ByteArray, offset: Int, length: Int) {
    val end = offset + length
    var i = offset
    while (i < end) {
      val b = bytes[i].toInt() and 0xFF
      i++
      when {
        b >= 0xF8 -> {} // tiempo real (clock, active sensing): no interrumpe nada
        b >= 0xF0 -> { // system common / SysEx: cancela el running status
          inSysex = (b == 0xF0)
          runningStatus = 0
          count = 0
        }
        b >= 0x80 -> {
          inSysex = false
          runningStatus = b
          needed = if ((b and 0xF0) == 0xC0 || (b and 0xF0) == 0xD0) 1 else 2
          count = 0
        }
        else -> {
          if (inSysex || runningStatus == 0) continue
          if (count == 0) data0 = b
          count++
          if (count >= needed) {
            dispatch(runningStatus, data0, if (needed == 2) b else 0)
            count = 0
          }
        }
      }
    }
  }
}

/** Paquetes USB-MIDI 1.0: siempre de 4 bytes (CIN + 3 bytes MIDI). */
fun forEachUsbMidiMessage(buffer: ByteArray, count: Int, dispatch: (status: Int, d1: Int, d2: Int) -> Unit) {
  var i = 0
  while (i + 4 <= count) {
    val cin = buffer[i].toInt() and 0x0F
    val b1 = buffer[i + 1].toInt() and 0xFF
    val b2 = buffer[i + 2].toInt() and 0x7F
    val b3 = buffer[i + 3].toInt() and 0x7F
    if (b1 >= 0x80) {
      when (cin) {
        0x8, 0x9, 0xA, 0xB, 0xE -> dispatch(b1, b2, b3)
        0xC, 0xD -> dispatch(b1, b2, 0)
        else -> {} // SysEx, relleno (0x00) y mensajes de sistema
      }
    }
    i += 4
  }
}

class MidiManager(private val context: Context) {
  private val systemMidiManager: android.media.midi.MidiManager? =
    context.getSystemService(Context.MIDI_SERVICE) as? android.media.midi.MidiManager
  private val usbManager: UsbManager? =
    context.getSystemService(Context.USB_SERVICE) as? UsbManager
  private val bluetoothAdapter: BluetoothAdapter? by lazy {
    (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter
  }
  private val mainHandler = Handler(Looper.getMainLooper())
  private val prefs = context.getSharedPreferences("synthconnect_midi", Context.MODE_PRIVATE)

  private val ACTION_USB_PERMISSION = "${context.packageName}.USB_MIDI_PERMISSION"

  // Dispositivos abiertos por el servicio MIDI de Android (USB class-compliant y BLE)
  private class OpenDevice(
    val device: MidiDevice,
    val ports: List<MidiOutputPort>,
    val name: String,
    val type: String,
    val bleAddress: String?
  )
  private val openDevices = ConcurrentHashMap<Int, OpenDevice>()
  private val pendingOpens = ConcurrentHashMap.newKeySet<Int>()

  // Driver USB directo (solo para teclados no class-compliant)
  private class DirectUsbSession(
    val device: UsbDevice,
    val connection: UsbDeviceConnection,
    val iface: UsbInterface,
    val endpoint: UsbEndpoint,
    val name: String
  ) {
    @Volatile var running = true
    var thread: Thread? = null
  }
  @Volatile private var directUsb: DirectUsbSession? = null

  interface MidiListener {
    fun onNoteOn(note: Int, velocity: Int)
    fun onNoteOff(note: Int)
    fun onControlChange(channel: Int, cc: Int, value: Int)
    fun onProgramChange(channel: Int, program: Int)
    fun onPitchBend(channel: Int, pitch: Int)
    fun onDeviceLost()
  }

  interface MidiLogListener {
    fun onLog(tag: String, message: String, level: String)
  }

  var listener: MidiListener? = null
  @Volatile var midiMonitorEnabled: Boolean = true
  var logListener: MidiLogListener? = null

  fun logDiag(tag: String, message: String, level: String = "INFO") {
    when (level) {
      "ERROR" -> Log.e(tag, message)
      "WARN" -> Log.w(tag, message)
      else -> Log.i(tag, message)
    }
    logListener?.onLog(tag, message, level)
  }

  private fun dispatch(status: Int, d1: Int, d2: Int) {
    bleReconnectAttempts = 0 // llegan datos: el enlace funciona
    // Monitor MIDI (adb logcat -s MidiIn): permite diagnosticar qué envía cada teclado
    if (midiMonitorEnabled) {
      Log.d("MidiIn", "st=0x%02X ch=%d d1=%d d2=%d".format(status and 0xF0, (status and 0x0F) + 1, d1, d2))
    }
    val l = listener ?: return
    val channel = status and 0x0F
    when (status and 0xF0) {
      0x90 -> if (d2 > 0) l.onNoteOn(d1, d2) else l.onNoteOff(d1)
      0x80 -> l.onNoteOff(d1)
      0xB0 -> l.onControlChange(channel, d1, d2)
      0xC0 -> l.onProgramChange(channel, d1)
      0xE0 -> l.onPitchBend(channel, (d2 shl 7) or d1)
    }
  }

  private inner class PortReceiver : MidiReceiver() {
    private val parser = MidiStreamParser { s, a, b -> dispatch(s, a, b) }
    override fun onSend(data: ByteArray?, offset: Int, count: Int, timestamp: Long) {
      if (data == null || count <= 0) return
      parser.feed(data, offset, count)
    }
  }

  // ---------------------------------------------------------------
  // Broadcasts USB
  // ---------------------------------------------------------------
  private val usbReceiver = object : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
      val device: UsbDevice? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
      } else {
        @Suppress("DEPRECATION")
        intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)
      }
      when (intent.action) {
        ACTION_USB_PERMISSION -> {
          if (device != null && intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) {
            logDiag("MidiManager", "[USB] Permiso concedido: ${usbName(device)}")
            connectDirectUsbDevice(device)
          } else {
            logDiag("MidiManager", "[USB] Permiso denegado", "WARN")
          }
        }
        UsbManager.ACTION_USB_DEVICE_ATTACHED -> {
          if (device != null && findMidiInterface(device) != null) {
            logDiag("MidiManager", "[USB] Conectado: ${usbName(device)}")
            // El servicio MIDI de Android tarda un poco en publicar el dispositivo;
            // si no lo hace (teclado no class-compliant) se usa el driver directo.
            mainHandler.postDelayed({ ensureUsbDeviceHandled(device) }, 1500)
          }
        }
        UsbManager.ACTION_USB_DEVICE_DETACHED -> {
          val session = directUsb
          if (device != null && session != null && session.device.deviceId == device.deviceId) {
            logDiag("MidiManager", "[USB] Desconectado: ${session.name}")
            closeDirectUsb()
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------
  // BLE
  // ---------------------------------------------------------------
  data class BleDiscoveredDevice(val name: String, val address: String, val rssi: Int)

  private val discoveredBleMap = ConcurrentHashMap<String, BleDiscoveredDevice>()
  @Volatile private var isScanningBle: Boolean = false
  private var activeScanCallback: ScanCallback? = null
  private var bleReconnectAttempts = 0

  init {
    try {
      systemMidiManager?.registerDeviceCallback(object : android.media.midi.MidiManager.DeviceCallback() {
        override fun onDeviceAdded(device: MidiDeviceInfo?) {
          // Los BLE solo aparecen cuando los abrimos nosotros (openBluetoothDevice)
          if (device != null && device.type == MidiDeviceInfo.TYPE_USB) {
            logDiag("MidiManager", "[MIDI] Dispositivo USB disponible: ${deviceName(device)}")
            openSystemDevice(device) {}
          }
        }

        override fun onDeviceRemoved(device: MidiDeviceInfo?) {
          if (device == null) return
          val removed = openDevices.remove(device.id) ?: return
          closeQuietly(removed)
          listener?.onDeviceLost() // evita notas pegadas si se desconecta con teclas presionadas
          logDiag("MidiManager", "[MIDI] Dispositivo desconectado: ${removed.name}")
          if (removed.bleAddress != null) scheduleBleReconnect(removed.bleAddress)
        }
      }, mainHandler)

      systemMidiManager?.devices?.filter { it.type == MidiDeviceInfo.TYPE_USB }?.forEach { openSystemDevice(it) {} }
    } catch (e: Exception) {
      Log.w("MidiManager", "Error registrando DeviceCallback:", e)
    }

    try {
      val filter = IntentFilter().apply {
        addAction(ACTION_USB_PERMISSION)
        addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED)
        addAction(UsbManager.ACTION_USB_DEVICE_DETACHED)
      }
      if (Build.VERSION.SDK_INT >= 33) {
        context.registerReceiver(usbReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
      } else {
        context.registerReceiver(usbReceiver, filter)
      }
    } catch (e: Exception) {
      Log.w("MidiManager", "Error registrando receptor USB:", e)
    }

    // Teclados USB no class-compliant que ya estaban conectados al abrir la app
    mainHandler.postDelayed({
      usbManager?.deviceList?.values?.forEach { ensureUsbDeviceHandled(it) }
    }, 1500)

    // Reconectar automáticamente el último teclado Bluetooth usado
    prefs.getString("last_ble_address", null)?.let { addr ->
      mainHandler.postDelayed({ tryAutoReconnectBle(addr) }, 2000)
    }
  }

  private fun hasBlePermissions(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    return context.checkSelfPermission(android.Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED &&
      context.checkSelfPermission(android.Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
  }

  fun isBluetoothEnabled(): Boolean = try { bluetoothAdapter?.isEnabled == true } catch (e: Exception) { false }

  fun isBleScanning(): Boolean = isScanningBle

  fun startBleScanExplicit(): Boolean {
    if (!hasBlePermissions()) {
      logDiag("MidiManager", "[BLE] Faltan permisos BLUETOOTH_SCAN / BLUETOOTH_CONNECT", "WARN")
      return false
    }
    // En modo BLE_ON (Bluetooth apagado por el usuario) el escáner existe pero falla con código 2
    if (!isBluetoothEnabled()) {
      logDiag("MidiManager", "[BLE] Bluetooth apagado: actívalo para buscar teclados", "WARN")
      return false
    }
    val scanner = try { bluetoothAdapter?.bluetoothLeScanner } catch (e: Exception) { null }
    if (scanner == null) {
      logDiag("MidiManager", "[BLE] Bluetooth apagado o no soportado", "WARN")
      return false
    }

    stopBleScan()
    discoveredBleMap.clear()

    return try {
      val settings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build()
      val callback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult?) {
          val bleDev = result?.device ?: return
          val address = bleDev.address ?: return
          val name = try {
            bleDev.name ?: result.scanRecord?.deviceName
          } catch (e: SecurityException) { null } ?: return // sin nombre: no es un teclado identificable
          val isNew = !discoveredBleMap.containsKey(address)
          discoveredBleMap[address] = BleDiscoveredDevice(name, address, result.rssi)
          if (isNew) logDiag("MidiManager", "[BLE] Detectado: $name ($address) ${result.rssi} dBm")
        }

        override fun onScanFailed(errorCode: Int) {
          logDiag("MidiManager", "[BLE] Escaneo falló: código $errorCode", "ERROR")
          isScanningBle = false
        }
      }
      activeScanCallback = callback
      // Sin filtro por UUID: muchos teclados BLE MIDI (M-VAVE) no anuncian el servicio MIDI
      scanner.startScan(emptyList(), settings, callback)
      isScanningBle = true
      mainHandler.postDelayed({ stopBleScan() }, 15000)
      logDiag("MidiManager", "[BLE] Escaneo iniciado")
      true
    } catch (e: Exception) {
      logDiag("MidiManager", "[BLE] Error al escanear: ${e.message}", "ERROR")
      isScanningBle = false
      false
    }
  }

  fun stopBleScan(): Boolean {
    val cb = activeScanCallback
    activeScanCallback = null
    if (cb != null) {
      try { bluetoothAdapter?.bluetoothLeScanner?.stopScan(cb) } catch (e: Exception) {}
    }
    isScanningBle = false
    return true
  }

  fun getDiscoveredBleDevices(): List<Map<String, Any>> {
    val connectedAddresses = openDevices.values.mapNotNull { it.bleAddress }.toSet()
    return discoveredBleMap.values
      .sortedByDescending { it.rssi }
      .map {
        mapOf(
          "name" to it.name,
          "address" to it.address,
          "rssi" to it.rssi,
          "isConnected" to connectedAddresses.contains(it.address)
        )
      }
  }

  fun connectBleDeviceByAddress(address: String, onConnected: (Boolean) -> Unit) {
    stopBleScan()
    if (openDevices.values.any { it.bleAddress == address }) {
      onConnected(true)
      return
    }
    val adapter = bluetoothAdapter
    val midi = systemMidiManager
    if (adapter == null || midi == null || !hasBlePermissions()) {
      logDiag("MidiManager", "[BLE] No disponible (adaptador o permisos)", "ERROR")
      onConnected(false)
      return
    }
    try {
      val bleDev = adapter.getRemoteDevice(address)
      logDiag("MidiManager", "[BLE] Conectando a $address...")
      midi.openBluetoothDevice(bleDev, { device ->
        if (device == null) {
          logDiag("MidiManager", "[BLE] No se pudo abrir $address", "ERROR")
          onConnected(false)
        } else {
          // Este MidiDevice es dueño de la conexión GATT: se conserva abierto.
          // El enlace real se confirma después; si falla, onDeviceRemoved reprograma el reintento.
          val ok = attachPorts(device, bleAddress = address)
          if (ok) prefs.edit().putString("last_ble_address", address).apply()
          onConnected(ok)
        }
      }, mainHandler)
    } catch (e: Exception) {
      logDiag("MidiManager", "[BLE] Excepción: ${e.message}", "ERROR")
      onConnected(false)
    }
  }

  private fun tryAutoReconnectBle(address: String) {
    if (!hasBlePermissions() || !isBluetoothEnabled()) return
    if (openDevices.values.any { it.bleAddress == address }) return
    logDiag("MidiManager", "[BLE] Reconexión automática a $address")
    connectBleDeviceByAddress(address) { ok ->
      if (!ok) scheduleBleReconnect(address)
    }
  }

  // Reintenta mientras la app esté abierta (salvo desconexión manual): 4, 8, 12 s y luego cada 15 s
  private fun scheduleBleReconnect(address: String) {
    if (prefs.getString("last_ble_address", null) != address) return
    bleReconnectAttempts++
    val delay = if (bleReconnectAttempts <= 3) 4000L * bleReconnectAttempts else 15000L
    mainHandler.postDelayed({ tryAutoReconnectBle(address) }, delay)
  }

  fun startBleScan() { startBleScanExplicit() }

  // ---------------------------------------------------------------
  // Servicio MIDI de Android
  // ---------------------------------------------------------------
  private fun deviceName(info: MidiDeviceInfo): String {
    val p = info.properties
    return p.getString(MidiDeviceInfo.PROPERTY_NAME)
      ?: p.getString(MidiDeviceInfo.PROPERTY_PRODUCT)
      ?: p.getString(MidiDeviceInfo.PROPERTY_MANUFACTURER)
      ?: "Teclado MIDI"
  }

  private fun openSystemDevice(info: MidiDeviceInfo, onDone: (Boolean) -> Unit) {
    val midi = systemMidiManager ?: return onDone(false)
    if (openDevices.containsKey(info.id)) return onDone(true)
    if (info.outputPortCount == 0) return onDone(false)
    if (!pendingOpens.add(info.id)) return onDone(true)
    midi.openDevice(info, { device ->
      pendingOpens.remove(info.id)
      if (device == null) {
        logDiag("MidiManager", "[MIDI] No se pudo abrir ${deviceName(info)}", "ERROR")
        onDone(false)
      } else {
        onDone(attachPorts(device, bleAddress = null))
      }
    }, mainHandler)
  }

  private fun attachPorts(device: MidiDevice, bleAddress: String?): Boolean {
    val info = device.info
    val existing = openDevices[info.id]
    if (existing != null) {
      if (bleAddress == null) { // ya abierto: no duplicar (evita notas dobles)
        try { device.close() } catch (e: Exception) {}
        return true
      }
      openDevices.remove(info.id)
      closeQuietly(existing)
    }
    val ports = mutableListOf<MidiOutputPort>()
    for (portInfo in info.ports) {
      if (portInfo.type != MidiDeviceInfo.PortInfo.TYPE_OUTPUT) continue
      try {
        device.openOutputPort(portInfo.portNumber)?.let { port ->
          port.connect(PortReceiver())
          ports.add(port)
        }
      } catch (e: Exception) {
        logDiag("MidiManager", "[MIDI] Error abriendo puerto ${portInfo.portNumber}: ${e.message}", "ERROR")
      }
    }
    if (ports.isEmpty()) {
      try { device.close() } catch (e: Exception) {}
      logDiag("MidiManager", "[MIDI] ${deviceName(info)} no tiene puertos de salida utilizables", "WARN")
      return false
    }
    val type = if (bleAddress != null || info.type == MidiDeviceInfo.TYPE_BLUETOOTH) "BLUETOOTH" else "USB"
    openDevices[info.id] = OpenDevice(device, ports, deviceName(info), type, bleAddress)
    logDiag("MidiManager", "[MIDI] Escuchando ${deviceName(info)} ($type, ${ports.size} puerto(s))")
    // Si el sistema tomó el teclado, el driver directo sobra
    if (type == "USB") closeDirectUsb()
    return true
  }

  private fun closeQuietly(d: OpenDevice) {
    d.ports.forEach { try { it.close() } catch (e: Exception) {} }
    try { d.device.close() } catch (e: Exception) {}
  }

  fun connectToDevice(deviceInfo: MidiDeviceInfo, onConnected: (Boolean) -> Unit) {
    openSystemDevice(deviceInfo, onConnected)
  }

  // ---------------------------------------------------------------
  // Listado
  // ---------------------------------------------------------------
  fun scanDevices(): List<MidiDeviceHandler> {
    val result = mutableListOf<MidiDeviceHandler>()
    val systemUsbNames = mutableSetOf<String>()

    try {
      systemMidiManager?.devices?.forEach { dev ->
        if (dev.outputPortCount == 0) return@forEach
        val type = if (dev.type == MidiDeviceInfo.TYPE_BLUETOOTH) "BLUETOOTH" else "USB"
        if (dev.type == MidiDeviceInfo.TYPE_VIRTUAL) return@forEach
        val name = deviceName(dev)
        if (type == "USB") systemUsbNames.add(name.lowercase())
        result.add(MidiDeviceHandler("sys_midi_${dev.id}", name, type, openDevices.containsKey(dev.id), nativeMidiDevice = dev))
      }
    } catch (e: Exception) {
      Log.w("MidiManager", "Error listando dispositivos MIDI:", e)
    }

    // Teclados USB que el sistema no expone como MIDI (requieren driver directo)
    try {
      usbManager?.deviceList?.values?.forEach { usbDev ->
        if (findMidiInterface(usbDev) == null) return@forEach
        if (isHandledBySystem(usbDev)) return@forEach
        val session = directUsb
        val connected = session != null && session.device.deviceId == usbDev.deviceId
        result.add(MidiDeviceHandler("usb_direct_${usbDev.deviceId}", usbName(usbDev), "USB", connected, nativeUsbDevice = usbDev))
      }
    } catch (e: Exception) {
      Log.w("MidiManager", "Error listando USB:", e)
    }
    return result
  }

  // ---------------------------------------------------------------
  // Driver USB directo
  // ---------------------------------------------------------------
  private fun usbName(d: UsbDevice): String = d.productName ?: d.manufacturerName ?: "Teclado USB"

  private fun isHandledBySystem(usbDev: UsbDevice): Boolean {
    val devices = systemMidiManager?.devices ?: return false
    return devices.any { info ->
      if (info.type != MidiDeviceInfo.TYPE_USB) return@any false
      val usbProp = info.properties.getParcelable<UsbDevice>(MidiDeviceInfo.PROPERTY_USB_DEVICE)
      usbProp?.deviceId == usbDev.deviceId
    }
  }

  /** Interfaz MIDI Streaming (clase 1, subclase 3) o vendor-specific con endpoint de entrada. */
  private fun findMidiInterface(usbDevice: UsbDevice): Pair<UsbInterface, UsbEndpoint>? {
    var vendorFallback: Pair<UsbInterface, UsbEndpoint>? = null
    for (i in 0 until usbDevice.interfaceCount) {
      val iface = usbDevice.getInterface(i)
      val isMidiStreaming = iface.interfaceClass == UsbConstants.USB_CLASS_AUDIO && iface.interfaceSubclass == 3
      val isVendor = iface.interfaceClass == UsbConstants.USB_CLASS_VENDOR_SPEC
      if (!isMidiStreaming && !isVendor) continue
      for (e in 0 until iface.endpointCount) {
        val ep = iface.getEndpoint(e)
        val inBulk = ep.direction == UsbConstants.USB_DIR_IN &&
          (ep.type == UsbConstants.USB_ENDPOINT_XFER_BULK || ep.type == UsbConstants.USB_ENDPOINT_XFER_INT)
        if (!inBulk) continue
        if (isMidiStreaming) return Pair(iface, ep)
        if (vendorFallback == null) vendorFallback = Pair(iface, ep)
      }
    }
    return vendorFallback
  }

  private fun ensureUsbDeviceHandled(device: UsbDevice) {
    if (findMidiInterface(device) == null) return
    if (isHandledBySystem(device)) return
    if (directUsb != null) return
    connectDirectUsbDevice(device)
  }

  private fun requestUsbPermission(device: UsbDevice) {
    val manager = usbManager ?: return
    val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
    // Intent explícito (con paquete): obligatorio para PendingIntent mutables desde Android 14
    val intent = Intent(ACTION_USB_PERMISSION).setPackage(context.packageName)
    val pi = PendingIntent.getBroadcast(context, device.deviceId, intent, flags or PendingIntent.FLAG_UPDATE_CURRENT)
    logDiag("MidiManager", "[USB] Solicitando permiso para ${usbName(device)}")
    manager.requestPermission(device, pi)
  }

  fun connectDirectUsbDevice(usbDevice: UsbDevice) {
    val manager = usbManager ?: return
    val midi = findMidiInterface(usbDevice)
    if (midi == null) {
      logDiag("MidiManager", "[USB] ${usbName(usbDevice)} no tiene interfaz MIDI", "WARN")
      return
    }
    if (!manager.hasPermission(usbDevice)) {
      requestUsbPermission(usbDevice)
      return
    }
    closeDirectUsb()

    val connection = manager.openDevice(usbDevice)
    if (connection == null) {
      logDiag("MidiManager", "[USB] No se pudo abrir ${usbName(usbDevice)}", "ERROR")
      return
    }
    val (iface, endpoint) = midi
    // Solo la interfaz MIDI: la de audio queda libre para el sistema
    if (!connection.claimInterface(iface, true)) {
      connection.close()
      logDiag("MidiManager", "[USB] No se pudo reclamar la interfaz MIDI", "ERROR")
      return
    }

    val session = DirectUsbSession(usbDevice, connection, iface, endpoint, usbName(usbDevice))
    session.thread = Thread({
      val buffer = ByteArray(endpoint.maxPacketSize.coerceAtLeast(64))
      while (session.running) {
        val start = System.nanoTime()
        val n = connection.bulkTransfer(endpoint, buffer, buffer.size, 200)
        if (n > 0) {
          parseUsbMidiPackets(buffer, n)
        } else if (n < 0 && System.nanoTime() - start < 20_000_000L) {
          // Error inmediato (no timeout): evitar bucle ocupado hasta que llegue DETACHED
          try { Thread.sleep(20) } catch (e: InterruptedException) { break }
        }
      }
    }, "UsbMidiReader").apply {
      priority = Thread.MAX_PRIORITY
      isDaemon = true
      start()
    }
    directUsb = session
    logDiag("MidiManager", "[USB] Driver directo activo para ${session.name}")
  }

  private fun parseUsbMidiPackets(buffer: ByteArray, count: Int) {
    forEachUsbMidiMessage(buffer, count) { s, a, b -> dispatch(s, a, b) }
  }

  private fun closeDirectUsb() {
    val session = directUsb ?: return
    directUsb = null
    session.running = false
    listener?.onDeviceLost()
    try {
      session.thread?.join(500)
      session.connection.releaseInterface(session.iface)
      session.connection.close()
    } catch (e: Exception) {
      Log.w("MidiManager", "Error cerrando USB directo:", e)
    }
  }

  // ---------------------------------------------------------------
  // Diagnóstico y desconexión
  // ---------------------------------------------------------------
  fun getDiagnosticsMap(): Map<String, Any> {
    val sysDevices = mutableListOf<Map<String, Any>>()
    try {
      systemMidiManager?.devices?.forEach { dev ->
        val props = dev.properties
        sysDevices.add(mapOf(
          "id" to "sys_${dev.id}",
          "sysId" to dev.id,
          "name" to deviceName(dev),
          "manufacturer" to (props.getString(MidiDeviceInfo.PROPERTY_MANUFACTURER) ?: "Genérico"),
          "product" to (props.getString(MidiDeviceInfo.PROPERTY_PRODUCT) ?: "N/A"),
          "type" to if (dev.type == MidiDeviceInfo.TYPE_BLUETOOTH) "BLUETOOTH" else "USB",
          "inputPorts" to dev.inputPortCount,
          "outputPorts" to dev.outputPortCount,
          "isOpen" to openDevices.containsKey(dev.id)
        ))
      }
    } catch (e: Exception) {}

    val usbDevices = mutableListOf<Map<String, Any>>()
    try {
      usbManager?.deviceList?.values?.forEach { dev ->
        usbDevices.add(mapOf(
          "name" to dev.deviceName,
          "vendorId" to dev.vendorId,
          "productId" to dev.productId,
          "manufacturerName" to (dev.manufacturerName ?: "N/A"),
          "productName" to (dev.productName ?: "N/A"),
          "hasPermission" to (usbManager.hasPermission(dev)),
          "interfaceCount" to dev.interfaceCount
        ))
      }
    } catch (e: Exception) {}

    val names = openDevices.values.map { it.name } + listOfNotNull(directUsb?.name)
    return mapOf(
      "systemMidiDevices" to sysDevices,
      "usbHostDevices" to usbDevices,
      "isDirectUsbActive" to (directUsb != null),
      "openPortCount" to openDevices.values.sumOf { it.ports.size },
      "connectedDeviceName" to (if (names.isEmpty()) "Ninguno" else names.joinToString(", "))
    )
  }

  fun requestUsbPermissionExplicit(vendorId: Int? = null) {
    usbManager?.deviceList?.values?.forEach { dev ->
      if ((vendorId == null || dev.vendorId == vendorId) && findMidiInterface(dev) != null && !usbManager.hasPermission(dev)) {
        requestUsbPermission(dev)
      }
    }
  }

  /** Desconexión manual: cierra todo y olvida el teclado Bluetooth. */
  fun disconnect() {
    prefs.edit().remove("last_ble_address").apply()
    bleReconnectAttempts = 0
    openDevices.values.forEach { closeQuietly(it) }
    openDevices.clear()
    closeDirectUsb()
    logDiag("MidiManager", "Todos los dispositivos MIDI desconectados")
  }
}
