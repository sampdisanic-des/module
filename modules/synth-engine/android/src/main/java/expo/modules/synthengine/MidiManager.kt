package expo.modules.synthengine

import android.app.PendingIntent
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.*
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.*
import android.media.midi.*
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import android.util.Log
import java.util.UUID

class MidiDeviceHandler(
  val id: String,
  val name: String,
  val type: String, // "USB" o "BLUETOOTH"
  val nativeMidiDevice: MidiDeviceInfo? = null,
  val nativeUsbDevice: UsbDevice? = null
)

class MidiManager(private val context: Context) {
  private val systemMidiManager: android.media.midi.MidiManager? =
    context.getSystemService(Context.MIDI_SERVICE) as? android.media.midi.MidiManager
  private val usbManager: UsbManager? =
    context.getSystemService(Context.USB_SERVICE) as? UsbManager
  private val bluetoothAdapter: BluetoothAdapter? by lazy {
    (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter
  }

  private val MIDI_SERVICE_UUID = ParcelUuid(UUID.fromString("03B80E5A-EDE8-4B33-A751-6CE34EC4C700"))

  private var openMidiDevice: MidiDevice? = null
  private val activeOutputPorts = mutableListOf<MidiOutputPort>()

  // Direct USB Host Driver state
  private var activeUsbConnection: UsbDeviceConnection? = null
  private var activeUsbInterface: UsbInterface? = null
  private var activeUsbEndpoint: UsbEndpoint? = null
  private var usbWorkerThread: Thread? = null
  @Volatile private var isReadingUsb: Boolean = false

  private val ACTION_USB_PERMISSION = "expo.modules.synthengine.USB_PERMISSION"

  interface MidiListener {
    fun onNoteOn(note: Int, velocity: Int)
    fun onNoteOff(note: Int)
    fun onControlChange(channel: Int, cc: Int, value: Int)
    fun onProgramChange(channel: Int, program: Int)
    fun onPitchBend(channel: Int, pitch: Int)
  }

  interface MidiLogListener {
    fun onLog(tag: String, message: String, level: String)
  }

  var listener: MidiListener? = null
  var logListener: MidiLogListener? = null

  fun logDiag(tag: String, message: String, level: String = "INFO") {
    when (level) {
      "ERROR" -> Log.e(tag, message)
      "WARN" -> Log.w(tag, message)
      else -> Log.i(tag, message)
    }
    logListener?.onLog(tag, message, level)
  }

  private val usbReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      val action = intent.action
      if (ACTION_USB_PERMISSION == action) {
        synchronized(this) {
          val device: UsbDevice? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
          } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)
          }
          if (intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) {
            device?.let {
              Log.i("MidiManager", "[Permiso USB Otorgado] Conectando a USB Direct: ${it.deviceName}")
              connectDirectUsbDevice(it)
            }
          } else {
            Log.w("MidiManager", "Permiso USB denegado para el dispositivo")
          }
        }
      } else if (UsbManager.ACTION_USB_DEVICE_ATTACHED == action) {
        Log.i("MidiManager", "[USB Plugged] Dispositivo USB OTG conectado físicamente")
        scanDevices()
      } else if (UsbManager.ACTION_USB_DEVICE_DETACHED == action) {
        Log.i("MidiManager", "[USB Unplugged] Dispositivo USB desconectado")
        disconnect()
      }
    }
  }

  data class BleDiscoveredDevice(
    val name: String,
    val address: String,
    val rssi: Int,
    val timestamp: Long = System.currentTimeMillis()
  )

  private val discoveredBleMap = java.util.concurrent.ConcurrentHashMap<String, BleDiscoveredDevice>()
  @Volatile private var isScanningBle: Boolean = false
  private var activeScanCallback: ScanCallback? = null
  private val scanTimeoutHandler = Handler(Looper.getMainLooper())

  init {
    try {
      systemMidiManager?.registerDeviceCallback(object : android.media.midi.MidiManager.DeviceCallback() {
        override fun onDeviceAdded(device: MidiDeviceInfo?) {
          Log.i("MidiManager", "[DeviceCallback] Dispositivo MIDI insertado en sistema: ${device?.id}")
          if (device != null) {
            connectToDevice(device) {}
          }
        }

        override fun onDeviceRemoved(device: MidiDeviceInfo?) {
          Log.i("MidiManager", "[DeviceCallback] Dispositivo MIDI removido de sistema: ${device?.id}")
          if (openMidiDevice?.info?.id == device?.id) {
            disconnect()
          }
        }
      }, Handler(Looper.getMainLooper()))

      systemMidiManager?.devices?.firstOrNull()?.let { firstDev ->
        Log.i("MidiManager", "[Init Auto-Connect] Conectando a dispositivo MIDI pre-existente: ${firstDev.id}")
        connectToDevice(firstDev) {}
      }
    } catch (e: Exception) {
      Log.w("MidiManager", "Error registrando DeviceCallback de Android MidiManager:", e)
    }

    try {
      val filter = IntentFilter().apply {
        addAction(ACTION_USB_PERMISSION)
        addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED)
        addAction(UsbManager.ACTION_USB_DEVICE_DETACHED)
      }
      if (Build.VERSION.SDK_INT >= 33) {
        context.registerReceiver(usbReceiver, filter, Context.RECEIVER_EXPORTED)
      } else {
        context.registerReceiver(usbReceiver, filter)
      }
    } catch (e: Exception) {
      Log.w("MidiManager", "Error registrando BroadcastReceiver de USB:", e)
    }
  }

  fun isBluetoothEnabled(): Boolean {
    return try {
      bluetoothAdapter?.isEnabled == true
    } catch (e: Exception) {
      false
    }
  }

  fun isBleScanning(): Boolean {
    return isScanningBle
  }

  fun startBleScanExplicit(): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val hasScan = context.checkSelfPermission(android.Manifest.permission.BLUETOOTH_SCAN) == android.content.pm.PackageManager.PERMISSION_GRANTED
      val hasConnect = context.checkSelfPermission(android.Manifest.permission.BLUETOOTH_CONNECT) == android.content.pm.PackageManager.PERMISSION_GRANTED
      if (!hasScan || !hasConnect) {
        logDiag("MidiManager", "[BLE] Permisos BLUETOOTH_SCAN / BLUETOOTH_CONNECT no concedidos.", "WARN")
        return false
      }
    }

    val scanner = bluetoothAdapter?.bluetoothLeScanner
    if (scanner == null) {
      logDiag("MidiManager", "[BLE] BluetoothLeScanner es null. Bluetooth apagado o no soportado.", "WARN")
      return false
    }

    stopBleScan()
    discoveredBleMap.clear()
    isScanningBle = true

    try {
      val settings = ScanSettings.Builder()
        .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
        .build()

      val callback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult?) {
          val bleDev = result?.device ?: return
          val rawName = try {
            bleDev.name ?: result.scanRecord?.deviceName ?: "Dispositivo Bluetooth"
          } catch (e: SecurityException) {
            "Dispositivo Bluetooth"
          }

          val address = bleDev.address ?: return
          val rssi = result.rssi

          discoveredBleMap[address] = BleDiscoveredDevice(rawName, address, rssi)
          logDiag("MidiManager", "[BLE Scan] Detectado: $rawName ($address) RSSI: $rssi dBm")
        }

        override fun onScanFailed(errorCode: Int) {
          logDiag("MidiManager", "[BLE Scan Failed] Código de error: $errorCode", "ERROR")
          isScanningBle = false
        }
      }

      activeScanCallback = callback
      scanner.startScan(emptyList(), settings, callback)
      logDiag("MidiManager", "[BLE Scan] Escaneo activo iniciado (amplio para M-Vave y teclados BLE)")

      scanTimeoutHandler.removeCallbacksAndMessages(null)
      scanTimeoutHandler.postDelayed({
        stopBleScan()
      }, 15000)

      return true
    } catch (e: Exception) {
      logDiag("MidiManager", "[BLE Scan Error] ${e.message}", "ERROR")
      isScanningBle = false
      return false
    }
  }

  fun stopBleScan(): Boolean {
    if (!isScanningBle && activeScanCallback == null) return true
    try {
      activeScanCallback?.let {
        bluetoothAdapter?.bluetoothLeScanner?.stopScan(it)
      }
    } catch (e: Exception) {
      logDiag("MidiManager", "[BLE Stop Error] ${e.message}", "WARN")
    }
    activeScanCallback = null
    isScanningBle = false
    logDiag("MidiManager", "[BLE Scan] Escaneo detenido.")
    return true
  }

  fun getDiscoveredBleDevices(): List<Map<String, Any>> {
    return discoveredBleMap.values.map {
      mapOf(
        "name" to it.name,
        "address" to it.address,
        "rssi" to it.rssi,
        "isConnected" to (openMidiDevice?.info?.properties?.getString(MidiDeviceInfo.PROPERTY_NAME)?.contains(it.name, ignoreCase = true) == true)
      )
    }
  }

  fun connectBleDeviceByAddress(address: String, onConnected: (Boolean) -> Unit) {
    stopBleScan()
    val bleAdapter = bluetoothAdapter
    if (bleAdapter == null) {
      logDiag("MidiManager", "[BLE Connect] BluetoothAdapter es null", "ERROR")
      onConnected(false)
      return
    }

    try {
      val bleDev = bleAdapter.getRemoteDevice(address)
      val devName = try { bleDev.name ?: address } catch (e: SecurityException) { address }
      logDiag("MidiManager", "[BLE Connect] Conectando a $devName ($address)...")

      systemMidiManager?.openBluetoothDevice(bleDev, { device ->
        if (device != null) {
          logDiag("MidiManager", "[BLE Connect OK] Android System MIDI reconoció $devName")
          connectToDevice(device.info) { success ->
            onConnected(success)
          }
        } else {
          logDiag("MidiManager", "[BLE Connect Error] openBluetoothDevice devolvió null para $address", "ERROR")
          onConnected(false)
        }
      }, Handler(Looper.getMainLooper()))
    } catch (e: Exception) {
      logDiag("MidiManager", "[BLE Connect Exception] ${e.message}", "ERROR")
      onConnected(false)
    }
  }

  fun startBleScan() {
    startBleScanExplicit()
  }

  fun scanDevices(): List<MidiDeviceHandler> {
    val result = mutableListOf<MidiDeviceHandler>()

    // 1. Escanear a través del servicio de Android System MidiManager
    if (systemMidiManager != null) {
      try {
        for (dev in systemMidiManager.devices) {
          val properties = dev.properties
          val name = properties.getString(MidiDeviceInfo.PROPERTY_NAME)
            ?: properties.getString(MidiDeviceInfo.PROPERTY_MANUFACTURER)
            ?: properties.getString(MidiDeviceInfo.PROPERTY_PRODUCT)
            ?: "Teclado MIDI System"

          val isUsb = dev.type == MidiDeviceInfo.TYPE_USB
          val typeStr = if (isUsb) "USB" else "BLUETOOTH"
          val id = "sys_midi_${dev.id}"

          Log.i("MidiManager", "[Android System MIDI] Encontrado: $name (id: $id)")
          result.add(MidiDeviceHandler(id, name, typeStr, nativeMidiDevice = dev))
        }
      } catch (e: Exception) {
        Log.w("MidiManager", "Error escaneando systemMidiManager:", e)
      }
    }

    // 2. Escanear a través de USB Host (UsbManager direct) para mandos M-VAVE y teclados OTG
    if (usbManager != null) {
      try {
        val deviceList = usbManager.deviceList
        Log.i("MidiManager", "[UsbManager] Dispositivos USB totales conectados: ${deviceList.size}")

        for ((_, usbDev) in deviceList) {
          val devName = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            usbDev.productName ?: usbDev.manufacturerName ?: "M-VAVE 25 USB MIDI"
          } else {
            "M-VAVE 25 USB MIDI"
          }

          Log.i("MidiManager", "[UsbManager Entry] DeviceName: ${usbDev.deviceName} | Name: $devName | VendorID: ${usbDev.vendorId} | ProductID: ${usbDev.productId} | Class: ${usbDev.deviceClass} | Interfaces: ${usbDev.interfaceCount}")

          // Solicitar permiso de USB explícito a Android si aún no fue concedido
          if (!usbManager.hasPermission(usbDev)) {
            logDiag("MidiManager", "Solicitando permiso de USB a Android para: $devName (VID:${usbDev.vendorId})", "INFO")
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
              PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            } else {
              PendingIntent.FLAG_UPDATE_CURRENT
            }
            val permissionIntent = PendingIntent.getBroadcast(context, 0, Intent(ACTION_USB_PERMISSION), flags)
            usbManager.requestPermission(usbDev, permissionIntent)
          }

          if (isMidiUsbDevice(usbDev)) {
            val id = "usb_direct_${usbDev.deviceId}"
            result.add(MidiDeviceHandler(id, "$devName (USB OTG)", "USB", nativeUsbDevice = usbDev))
          }
        }
      } catch (e: Exception) {
        Log.w("MidiManager", "Error escaneando UsbManager:", e)
      }
    }

    logDiag("MidiManager", "Total de dispositivos MIDI detectados: ${result.size}")

    // Auto-conectar al primer dispositivo detectado (Prioridad a System MIDI como BandLab)
    if (openMidiDevice == null && !isReadingUsb && result.isNotEmpty()) {
      val sysHandler = result.find { it.nativeMidiDevice != null }
      if (sysHandler != null && sysHandler.nativeMidiDevice != null) {
        logDiag("MidiManager", "[Auto-Connect System MIDI] Conectando a: ${sysHandler.name}")
        connectToDevice(sysHandler.nativeMidiDevice) {}
      } else {
        val usbHandler = result.find { it.nativeUsbDevice != null }
        if (usbHandler != null && usbHandler.nativeUsbDevice != null) {
          logDiag("MidiManager", "[Auto-Connect USB Direct Fallback] Conectando a: ${usbHandler.name}")
          connectDirectUsbDevice(usbHandler.nativeUsbDevice)
        }
      }
    }

    return result
  }

  private fun isMidiUsbDevice(usbDevice: UsbDevice): Boolean {
    if (usbDevice.deviceClass == UsbConstants.USB_CLASS_AUDIO || usbDevice.deviceClass == 0xFF) {
      return true
    }
    for (i in 0 until usbDevice.interfaceCount) {
      val iface = usbDevice.getInterface(i)
      val cls = iface.interfaceClass
      val subcls = iface.interfaceSubclass
      logDiag("MidiManager", "  Interface #$i -> Class: $cls | Subclass: $subcls | Endpoints: ${iface.endpointCount}")
      if (cls == UsbConstants.USB_CLASS_AUDIO || cls == 0xFF || subcls == 3 || subcls == 1 || subcls == 0) {
        return true
      }
      for (e in 0 until iface.endpointCount) {
        val ep = iface.getEndpoint(e)
        if (ep.direction == UsbConstants.USB_DIR_IN) {
          return true
        }
      }
    }
    return usbDevice.interfaceCount > 0
  }

  fun connectToDevice(deviceInfo: MidiDeviceInfo, onConnected: (Boolean) -> Unit) {
    if (systemMidiManager == null) {
      logDiag("MidiManager", "[ERROR] systemMidiManager es null", "ERROR")
      onConnected(false)
      return
    }

    disconnect()

    logDiag("MidiManager", "[System MIDI] Abriendo dispositivo Android System MIDI #${deviceInfo.id}...")
    systemMidiManager.openDevice(deviceInfo, { device ->
      if (device != null) {
        val info = device.info
        activeOutputPorts.clear()
        logDiag("MidiManager", "[System MIDI] Dispositivo abierto OK: ${info.id}. Total de puertos: ${info.ports.size}")

        for (portInfo in info.ports) {
          logDiag("MidiManager", "  Evaluando Puerto #${portInfo.portNumber} -> Tipo: ${if(portInfo.type == MidiDeviceInfo.PortInfo.TYPE_OUTPUT) "OUTPUT (Receiver)" else "INPUT"}")
          if (portInfo.type == MidiDeviceInfo.PortInfo.TYPE_OUTPUT) {
            try {
              val p = device.openOutputPort(portInfo.portNumber)
              if (p != null) {
                p.connect(MidiReceiverImpl())
                activeOutputPorts.add(p)
                logDiag("MidiManager", "[OK Multi-Port] Escuchando exitosamente en Puerto Output #${portInfo.portNumber}!")
              } else {
                logDiag("MidiManager", "[WARN] openOutputPort(#${portInfo.portNumber}) retornó null", "WARN")
              }
            } catch (e: Exception) {
              logDiag("MidiManager", "[ERROR] Excepción abriendo puerto #${portInfo.portNumber}: ${e.message}", "ERROR")
            }
          }
        }

        if (activeOutputPorts.isNotEmpty()) {
          openMidiDevice = device
          logDiag("MidiManager", "[ÉXITO TOTAL] Escuchando activamente en ${activeOutputPorts.size} puertos MIDI!")
          onConnected(true)
        } else {
          openMidiDevice = null
          logDiag("MidiManager", "[WARN] No se pudo abrir ningún puerto de salida MIDI en System MIDI. Intentando Direct USB Fallback...", "WARN")
          onConnected(false)

          // Fallback a Direct USB
          val usbList = usbManager?.deviceList
          if (!usbList.isNullOrEmpty()) {
            val firstUsb = usbList.values.firstOrNull { isMidiUsbDevice(it) }
            if (firstUsb != null) {
              logDiag("MidiManager", "[Fallback] Conectando mediante Direct USB Host a: ${firstUsb.deviceName}")
              connectDirectUsbDevice(firstUsb)
            }
          }
        }
      } else {
        openMidiDevice = null
        logDiag("MidiManager", "[ERROR] systemMidiManager.openDevice retornó null", "ERROR")
        onConnected(false)
      }
    }, Handler(Looper.getMainLooper()))
  }

  fun getDiagnosticsMap(): Map<String, Any> {
    val sysDevices = mutableListOf<Map<String, Any>>()
    if (systemMidiManager != null) {
      try {
        for (dev in systemMidiManager.devices) {
          val props = dev.properties
          val name = props.getString(MidiDeviceInfo.PROPERTY_NAME)
            ?: props.getString(MidiDeviceInfo.PROPERTY_MANUFACTURER)
            ?: props.getString(MidiDeviceInfo.PROPERTY_PRODUCT)
            ?: "Dispositivo MIDI"
          val manufacturer = props.getString(MidiDeviceInfo.PROPERTY_MANUFACTURER) ?: "Genérico"
          val product = props.getString(MidiDeviceInfo.PROPERTY_PRODUCT) ?: "N/A"

          val devMap = mapOf(
            "id" to "sys_${dev.id}",
            "sysId" to dev.id,
            "name" to name,
            "manufacturer" to manufacturer,
            "product" to product,
            "type" to if (dev.type == MidiDeviceInfo.TYPE_USB) "USB" else "BLUETOOTH",
            "inputPorts" to dev.inputPortCount,
            "outputPorts" to dev.outputPortCount,
            "isOpen" to (openMidiDevice?.info?.id == dev.id)
          )
          sysDevices.add(devMap)
        }
      } catch (e: Exception) {
        logDiag("MidiManager", "Error en getDiagnosticsMap systemMidiManager: ${e.message}", "ERROR")
      }
    }

    val usbDevices = mutableListOf<Map<String, Any>>()
    if (usbManager != null) {
      try {
        for ((_, dev) in usbManager.deviceList) {
          val hasPerm = usbManager.hasPermission(dev)
          val devMap = mapOf(
            "name" to dev.deviceName,
            "vendorId" to dev.vendorId,
            "productId" to dev.productId,
            "manufacturerName" to (dev.manufacturerName ?: "N/A"),
            "productName" to (dev.productName ?: "N/A"),
            "hasPermission" to hasPerm,
            "interfaceCount" to dev.interfaceCount
          )
          usbDevices.add(devMap)
        }
      } catch (e: Exception) {
        logDiag("MidiManager", "Error en getDiagnosticsMap usbManager: ${e.message}", "ERROR")
      }
    }

    val rawUsbNodes = mutableListOf<String>()
    try {
      val busDir = java.io.File("/dev/bus/usb")
      if (busDir.exists()) {
        busDir.walkTopDown().filter { it.isFile }.forEach { file ->
          rawUsbNodes.add("${file.absolutePath} (canRead:${file.canRead()})")
        }
      }
    } catch (e: Exception) {
      logDiag("MidiManager", "Error escaneando /dev/bus/usb: ${e.message}", "ERROR")
    }

    return mapOf(
      "systemMidiDevices" to sysDevices,
      "usbHostDevices" to usbDevices,
      "rawUsbNodes" to rawUsbNodes,
      "isDirectUsbActive" to isReadingUsb,
      "openPortCount" to activeOutputPorts.size,
      "connectedDeviceName" to (openMidiDevice?.info?.properties?.getString(MidiDeviceInfo.PROPERTY_NAME) ?: "Ninguno")
    )
  }

  fun requestUsbPermissionExplicit(vendorId: Int? = null) {
    if (usbManager == null) {
      logDiag("MidiManager", "UsbManager es null al solicitar permiso", "WARN")
      return
    }
    val devList = usbManager.deviceList
    if (devList.isEmpty()) {
      logDiag("MidiManager", "No hay dispositivos USB reconocidos en usbManager.deviceList", "WARN")
      return
    }

    for ((_, dev) in devList) {
      if (vendorId == null || dev.vendorId == vendorId) {
        logDiag("MidiManager", "Solicitando permiso USB explícito para: ${dev.deviceName} (VID:${dev.vendorId} PID:${dev.productId})", "INFO")
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        } else {
          PendingIntent.FLAG_UPDATE_CURRENT
        }
        val permissionIntent = PendingIntent.getBroadcast(context, 0, Intent(ACTION_USB_PERMISSION), flags)
        usbManager.requestPermission(dev, permissionIntent)
      }
    }
  }

  fun connectDirectUsbDevice(usbDevice: UsbDevice) {
    if (usbManager == null) return

    disconnect()

    if (!usbManager.hasPermission(usbDevice)) {
      Log.i("MidiManager", "Solicitando permiso USB a Android para: ${usbDevice.deviceName}")
      val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
      } else {
        PendingIntent.FLAG_UPDATE_CURRENT
      }
      val permissionIntent = PendingIntent.getBroadcast(context, 0, Intent(ACTION_USB_PERMISSION), flags)
      usbManager.requestPermission(usbDevice, permissionIntent)
      return
    }

    var midiInterface: UsbInterface? = null
    var midiEndpoint: UsbEndpoint? = null

    for (i in 0 until usbDevice.interfaceCount) {
      val iface = usbDevice.getInterface(i)
      for (e in 0 until iface.endpointCount) {
        val ep = iface.getEndpoint(e)
        if (ep.direction == UsbConstants.USB_DIR_IN) {
          midiInterface = iface
          midiEndpoint = ep
          break
        }
      }
      if (midiEndpoint != null) break
    }

    if (midiInterface == null || midiEndpoint == null) {
      Log.e("MidiManager", "No se encontró Endpoint de entrada USB MIDI en el dispositivo M-VAVE")
      return
    }

    val connection = usbManager.openDevice(usbDevice)
    if (connection == null) {
      Log.e("MidiManager", "No se pudo abrir UsbDeviceConnection con M-VAVE")
      return
    }

    for (i in 0 until usbDevice.interfaceCount) {
      try {
        connection.claimInterface(usbDevice.getInterface(i), true)
      } catch (e: Exception) {
        Log.w("MidiManager", "Excepción al reclamar interfaz #$i:", e)
      }
    }

    activeUsbConnection = connection
    activeUsbInterface = midiInterface
    activeUsbEndpoint = midiEndpoint
    isReadingUsb = true

    usbWorkerThread = Thread {
      Log.i("MidiManager", "[OK] Hilo de lectura Direct USB MIDI 1.0 activo para M-VAVE!")
      val buffer = ByteArray(64)
      while (isReadingUsb) {
        val bytesRead = connection.bulkTransfer(midiEndpoint, buffer, buffer.size, 100)
        if (bytesRead > 0) {
          parseUsbMidiBuffer(buffer, bytesRead)
        }
      }
      Log.i("MidiManager", "Hilo de lectura Direct USB MIDI finalizado")
    }.apply {
      priority = Thread.MAX_PRIORITY
      start()
    }
  }

  private fun parseUsbMidiBuffer(buffer: ByteArray, count: Int) {
    var i = 0
    while (i + 3 < count) {
      val b0 = buffer[i].toInt() and 0xFF
      val b1 = buffer[i + 1].toInt() and 0xFF
      val b2 = buffer[i + 2].toInt() and 0xFF
      val b3 = buffer[i + 3].toInt() and 0xFF

      val cin = b0 and 0x0F
      val command = b1 and 0xF0
      val channel = b1 and 0x0F

      when {
        cin == 0x09 || command == 0x90 -> {
          val note = b2 and 0x7F
          val vel = b3 and 0x7F
          if (vel > 0) {
            listener?.onNoteOn(note, vel)
          } else {
            listener?.onNoteOff(note)
          }
          i += 4
        }
        cin == 0x08 || command == 0x80 -> {
          val note = b2 and 0x7F
          listener?.onNoteOff(note)
          i += 4
        }
        cin == 0x0B || command == 0xB0 -> {
          val cc = b2 and 0x7F
          val valCC = b3 and 0x7F
          listener?.onControlChange(channel, cc, valCC)
          i += 4
        }
        cin == 0x0C || command == 0xC0 -> {
          val program = b2 and 0x7F
          listener?.onProgramChange(channel, program)
          i += 4
        }
        cin == 0x0E || command == 0xE0 -> {
          val lsb = b2 and 0x7F
          val msb = b3 and 0x7F
          val pitch = (msb shl 7) or lsb
          listener?.onPitchBend(channel, pitch)
          i += 4
        }
        else -> {
          i++
        }
      }
    }
  }

  fun disconnect() {
    isReadingUsb = false
    try {
      usbWorkerThread?.interrupt()
      activeUsbInterface?.let { activeUsbConnection?.releaseInterface(it) }
      activeUsbConnection?.close()
    } catch (e: Exception) {
      Log.w("MidiManager", "Error cerrando conexión USB direct:", e)
    }
    activeUsbConnection = null
    activeUsbInterface = null
    activeUsbEndpoint = null
    usbWorkerThread = null

    try {
      activeOutputPorts.forEach { it.close() }
      activeOutputPorts.clear()
      openMidiDevice?.close()
    } catch (e: Exception) {
      Log.w("MidiManager", "Error cerrando Android System MIDI:", e)
    }
    openMidiDevice = null
    Log.i("MidiManager", "Todos los dispositivos MIDI han sido desconectados")
  }

  private inner class MidiReceiverImpl : MidiReceiver() {
    private var runningStatus: Int = 0

    override fun onSend(data: ByteArray?, offset: Int, count: Int, timestamp: Long) {
      if (data == null || count <= 0) return

      var index = offset
      val end = offset + count

      while (index < end) {
        val b = data[index].toInt() and 0xFF

        val status: Int
        if (b >= 0x80) {
          if (b < 0xF0) {
            runningStatus = b
            index++
          } else if (b >= 0xF8) {
            // Mensaje de tiempo real MIDI (Clock, Active Sensing, etc.)
            index++
            continue
          } else {
            // SysEx u otro mensaje del sistema
            runningStatus = 0
            index++
            continue
          }
          status = runningStatus
        } else {
          status = runningStatus
        }

        if (status == 0) {
          index++
          continue
        }

        val command = status and 0xF0
        val channel = status and 0x0F

        when (command) {
          0x90 -> {
            if (index + 1 < end) {
              val note = data[index].toInt() and 0x7F
              val velocity = data[index + 1].toInt() and 0x7F
              if (velocity > 0) {
                listener?.onNoteOn(note, velocity)
              } else {
                listener?.onNoteOff(note)
              }
              index += 2
            } else break
          }
          0x80 -> {
            if (index + 1 < end) {
              val note = data[index].toInt() and 0x7F
              listener?.onNoteOff(note)
              index += 2
            } else break
          }
          0xB0 -> {
            if (index + 1 < end) {
              val cc = data[index].toInt() and 0x7F
              val value = data[index + 1].toInt() and 0x7F
              listener?.onControlChange(channel, cc, value)
              index += 2
            } else break
          }
          0xC0 -> {
            if (index < end) {
              val program = data[index].toInt() and 0x7F
              listener?.onProgramChange(channel, program)
              index += 1
            } else break
          }
          0xE0 -> {
            if (index + 1 < end) {
              val lsb = data[index].toInt() and 0x7F
              val msb = data[index + 1].toInt() and 0x7F
              val pitch = (msb shl 7) or lsb
              listener?.onPitchBend(channel, pitch)
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
