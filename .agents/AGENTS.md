# Rules for Agents

## Formatting and UI Guidelines
- **No Emojis**: Do NOT use emojis in agent responses, comments, documentation, or code/UI components.
- **Use Icons Only**: Use SVG icons, vector graphics, UI symbol glyphs, or standard clean text formatting instead of emojis.

## Deployment and ADB Guidelines
- **WiFi ADB**: Always deploy APKs to the physical device via WiFi ADB at `192.168.1.11:5555`. Before deploying, always run `adb connect 192.168.1.11:5555` first.
- **ADB Path**: Use the full path `C:\Users\SMP\AppData\Local\Android\Sdk\platform-tools\adb.exe` for all ADB commands.
- **Deploy Flow**: The standard deploy sequence is: `adb connect` -> `adb install -r` -> `adb shell am start`.
- **Enable WiFi ADB**: If WiFi ADB is not active, connect the phone via USB and run `adb tcpip 5555` followed by `adb connect 192.168.1.11:5555`, then the USB cable can be removed.
- **Build Type**: Use `gradlew assembleRelease` for standalone, offline, zero-red-screen deployment. Release APK location: `android\app\build\outputs\apk\release\app-release.apk`.
- **CodeGraph**: In this repository indexed by CodeGraph (a `.codegraph/` directory exists), reach for CodeGraph BEFORE grep/find or reading files when exploring or locating code:
  - **MCP tool**: `codegraph_explore` answers symbol source and call paths in one call.
  - **Shell**: `codegraph explore "<query>"` or `codegraph node "<symbol>"`.

## Guia de Instalación y Requisitos para Nuevos Equipos (Setup Guide)

Para clonar y continuar con el desarrollo de este proyecto en otro equipo de cómputo, se deben instalar y configurar los siguientes componentes:

### 1. Herramientas de Desarrollo Requeridas
- **Node.js**: Versión 18.x o 20.x LTS.
- **CodeGraph CLI**: Herramienta de análisis estático e indexación de grafos (`codegraph`).
- **JDK (Java Development Kit)**: JDK 17 o JDK 21 (ejemplo: OpenJDK 21).
  - Configurar variable `JAVA_HOME`: `C:\Program Files\Android\openjdk\jdk-21.0.8` (o ruta equivalente).
- **Android SDK y NDK**:
  - Android SDK Platform 34 (`platforms;android-34`).
  - Android SDK Build-Tools 34.0.0 (`build-tools;34.0.0`).
  - Android NDK (versión `26.1.10909125` o superior).
  - CMake (versión `3.22.1`).
  - Android SDK Platform-Tools (`adb`).
  - **Mínima versión Android requerida (`minSdkVersion`)**: API 26 (Android 8.0 Oreo) para soporte de audio de baja latencia con la biblioteca `AAudio`.

### 2. Ubicación Recomendada del SDK (Permisos)
Instalar o copiar el Android SDK en la carpeta local de usuario para evitar bloqueos de permisos de Administrador en Windows:
- Ruta: `C:\Users\<TU_USUARIO>\AppData\Local\Android\Sdk`
- Configurar variable de entorno `ANDROID_HOME`: `C:\Users\<TU_USUARIO>\AppData\Local\Android\Sdk`
- Añadir al `PATH`:
  - `%JAVA_HOME%\bin`
  - `%ANDROID_HOME%\platform-tools`
  - `%ANDROID_HOME%\cmdline-tools\latest\bin`

### 3. Pasos de Sincronización y Configuración en una Nueva PC
Dado que las carpetas de compilación pesadas (`node_modules/`, `android/build/`, `android/.gradle/`, `android/.cxx/`, `.expo/`, `.codegraph/`) están ignoradas en Git para mantener el repositorio ultra liviano (< 1 MB), ejecuta los siguientes comandos al clonar:

1. **Instalar dependencias de Node**:
   ```bash
   npm install
   ```

2. **Crear archivo de propiedades locales del SDK**:
   Crear el archivo `android/local.properties` con la ruta local de tu SDK:
   ```properties
   sdk.dir=C\:\\Users\\<TU_USUARIO>\\AppData\\Local\\Android\\Sdk
   ```

3. **Inicializar e Indexar CodeGraph**:
   ```bash
   codegraph init
   ```

4. **Ejecutar Autolinking de Expo Modules**:
   ```bash
   npx expo prebuild --platform android
   ```

5. **Compilar el APK Release Standalone (C++ NDK + AAudio + SoundFonts + Synth Engine)**:
   ```bash
   cd android
   .\gradlew.bat assembleRelease
   ```

6. **Instalar y Ejecutar en Dispositivo Físico o Emulador**:
   ```bash
   adb install -r android\app\build\outputs\apk\release\app-release.apk
   adb shell am start -n com.synthconnect.app/.MainActivity
   ```

### 4. Consideraciones Técnicas Nativas
- **Motor Sintetizador C++ NDK**: Se encuentra en `modules/synth-engine/android/src/main/cpp/`. Requiere el punto de entrada `JNI_OnLoad` en `OnLoad.cpp` para su registro en Android.
- **Alineación ELF 16 KB**: En `modules/synth-engine/android/build.gradle`, se mantienen las banderas CMake `-Wl,-z,max-page-size=16384` y `-DANDROID_PLATFORM=android-26` para compatibilidad con versiones recientes de Android y AAudio.
- **Ruta de SoundFonts `.sf2`**: Archivos de muestras en `android/app/src/main/assets/soundfonts/`.
- **Dependencia Expo Obligatoria**: En `android/app/build.gradle` debe estar presente `implementation project(':expo')` para que `ExpoModulesPackageList` esté registrado en el runtime sin errores de `NullPointerException`.

---

## Estado Actual del Proyecto y Arquitectura del Código (Session Context)

### 1. Resumen de la Interfaz y Componentes Implementados (`App.tsx`)
- **Header Principal Fijo y Persistente:**
  - **Izquierda:** Estado de conectividad MIDI OTG (`PSR-E463 USB OK` o `BUSCANDO MIDI OTG`) y botón modal **BT MIDI** para escanear y conectar teclados Bluetooth LE inalámbricos (M-Vave).
  - **Centro:** Título de la aplicación `SYNTH CONNECT Pro` perfectamente centrado.
  - **Derecha:** Hora en tiempo real del dispositivo (`H:MM AM/PM`) y porcentaje de batería en vivo consumiendo `expo-battery`.
- **Arquitectura de Navegación Integrada a Pantalla Completa (Cero Popups Flotantes):**
  - **`currentView: 'MAIN' | 'STYLE_LIBRARY' | 'VOICE_LIBRARY'`**:
    - **`MAIN`**: Consola principal de 3 paneles (Arranger de ritmos, 4 Faders de voces, Consola ADSR/Filtros/Bancos).
    - **`STYLE_LIBRARY`**: Navegador a pantalla completa de la librería de ritmos (.STY).
    - **`VOICE_LIBRARY`**: Navegador a pantalla completa de instrumentos y SoundFonts (.SF2).
    - Botón superior `<BackArrowIcon />` (`28x28`) para regresar instantáneamente a la consola principal.
    - Soporte completo para el botón de retroceso de hardware / gestual de Android (`BackHandler`).
- **Iconografía Vectorial SVG Nativa (Cero Emojis):**
  - Componentes SVG limpios: `<SearchIcon />`, `<BackArrowIcon />`, `<PlusIcon />`, `<EditIcon />`, `<TrashIcon />`, `<AssignIcon />`, `<CloseIcon />`, `<BluetoothIcon />`.
- **Panel de Ritmos (.STY) y Transporte Rectangular:**
  - Lista de ritmos con selección táctil directa.
  - Slider horizontal `STYLE VOLUME` 3D con arrastre gestual continuo (`PanResponder`).
  - 8 Botones rectangulares de sección (`INTRO A..D`, `MAIN A..D`) con medidor de 4 beats en tiempo real.
  - Barra de transporte rectangular estilizada de 4 columnas:
    - `[ SYNC START ]`: Estado LED verde activo.
    - `[ ACMP ON/OFF ]`: Estado LED cyan activo.
    - `[ START / STOP ]`: Botón principal rectangular con estado dinámico (Cyan en STOP, Rojo en PLAYING).
    - `[ FILL IN ]`: Botón rectangular de remate de variación.
- **Librería de Ritmos (.STY):**
  - Barra de búsqueda con `<SearchIcon />` y botón `<CloseIcon />` para limpiar texto.
  - Selector de categorías con contador dinámico en tiempo real (`ALL (15)`, `LATIN (8)`...).
  - Botón de importar `<PlusIcon />` en Cyan brillante.
  - Tarjetas de ritmos enumeradas (`#01`, `#02`...) con selección táctil directa y botones de icono compactos `<EditIcon />` y `<TrashIcon />`.
- **Panel Central (Performance Layers):**
  - **Header con Menú Hamburguesa `≡`:** Abre la librería de voces a pantalla completa.
  - **4 Canales Faders Independientes:** Cada fader de voz (`Concert Grand Piano`, `Ambient Pad Warm`, `Syn Strings Symphony`, `Synth Lead Moog Saw`) en su tarjeta dedicada con VU meter LED dinámico.
  - **Borde de Selección Cyan:** Al presionar o arrastrar un canal, se resalta con borde azul cyan brillante (`#00E5FF`).
  - **Controles Inferiores `OCTAVE` y `TRANSPOSE`:**
    - `OCTAVE`: `- [ OCT 0 ] +` individual para el fader seleccionado (rango -3 a +3).
    - `TRANSPOSE`: `- [ TRP 0 ] +` global para todos los faders (rango -12 a +12 semitonos).
- **Librería de Voces & SoundFonts:**
  - Selector de canal destino (`F1`, `F2`, `F3`, `F4`).
  - Barra de búsqueda con `<SearchIcon />` y botón `<CloseIcon />`.
  - Categorías con contadores dinámicos (`ALL`, `PIANO`, `PADS`, `STRINGS`, `LEADS`, `BRASS`, `ORGAN`, `BASS`, `CUSTOM`).
  - Botón de importar .SF2 con `<PlusIcon />`.
  - Tarjetas de voces enumeradas (`#001`, `#002`...):
    - Toque directo en la tarjeta para audición táctil instantánea.
    - Botón compacto de asignación `<AssignIcon />` que se ilumina al estar asignado al fader destino.
    - Botón compacto de edición de nombre `<EditIcon />`.
    - Botón compacto de eliminación `<TrashIcon />`.
- **Panel Derecho (Consola Digital ADSR + Filtros + Tempo + Bancos + Modulación):**
  - **Tarjeta ENVELOPE (ADSR):**
    - Gráfica interactiva SVG (220x70) con 4 nodos coloreados (`A`, `D`, `S`, `R`).
    - Perilla maestra ADSR (Izquierda) para el parámetro seleccionado del fader activo.
    - Fader vertical `CUTOFF` (Derecha) para corte de frecuencia del fader activo.
    - 4 Botones ADSR (`ATTACK`, `DECAY`, `SUSTAIN`, `RELEASE`) con valor numérico en tiempo real.
  - **Tarjeta Independiente `TEMPO CONTROL`:** Botones `-` y `+` con 0ms de latencia.
  - **Fader Horizontal `RESONANCE`:** Control de resonancia del filtro del fader activo.
  - **Tarjeta `MEMORY BANKS`:** 8 Bancos de Memoria (`BANK 1` a `BANK 8`) con pulsación corta para cargar y pulsación de 1s para guardar toda la configuración.
  - **Fader Horizontal `MODULATION`:** Control máster de modulación al 100% de ancho.

### 2. Módulos y Motor Nativo C++ Implementados
- **`expo-battery`**: Módulo nativo para lectura real de la batería del dispositivo.
- **`react-native-svg`**: Renderizado vectorial de curvas ADSR e iconografía SVG del sistema.
- **`synth-engine` (C++ NDK / AAudio / TSF / Dual MIDI Driver)**:
  - **Audio API Nativa**: `AAudio` (API 26+) a la frecuencia nativa del dispositivo (sin remuestreo), buffer de 2 bursts. `AudioStream` reabre el stream automáticamente si cambia la salida (audífonos, Bluetooth, USB) mediante el error callback.
  - **Instancias TSF**: copia (`tsf_copy`) por fader (`mLayers[0..3]`), acompañamiento (`mStyleTsf`) y preescucha (`mAuditionTsf`). Cada capa toca en el canal 0 de su instancia (API de canales de TSF), por eso sustain, pitch bend y vibrato funcionan por voz. Los SF2 personalizados se cachean (`mFontCache`) y se cargan del disco fuera del lock para no cortar el audio.
  - **Presets**: el valor `sf2Preset` de la librería es un número de programa GM; se resuelve con `tsf_get_presetindex` (el índice interno del SF2 no coincide con el programa).
  - **Envolvente por voz**: `tsf.h` tiene un ajuste del amp envelope por instancia (`envOverride*`) aplicado en cada `tsf_note_on`. Mapeo (escala UI 0..100): attack mínimo 0..3 s, decay x0.25..x4 sobre el SF2 (45 = neutro), sustain x0..x1, release 0.02..6 s. `src/utils/adsrFormat.ts` muestra los mismos valores en la UI.
  - **Notas sin pegarse**: `LayerStem::heldNotes` guarda la nota transpuesta que sonó en cada capa; `noteOff` apaga exactamente esa nota aunque cambien octava, transposición o mute. Si un teclado se desconecta, `allNotesOff()` suelta notas y pedal.
  - **Controladores**: CC1 (vibrato), CC7 (volumen), CC11 (expresión), CC64 (sustain), CC74 (cutoff master), CC120/123 (all notes off), pitch bend en todas las capas. Program Change del teclado se ignora (la voz la decide la app).
  - **Hilos**: un `recursive_mutex` protege el estado; el callback de audio no reserva memoria (buffers preasignados, voces preasignadas por instancia).
  - **Secuenciador de estilos**: avanza en sub-bloques de 64 frames. Cambios de sección (MAIN/INTRO/ENDING) en la siguiente barra según una rejilla global de compás (`mGlobalTick`); los FILL entran de inmediato y, si son más cortos que lo que resta del compás, se alinean para terminar en la barra. Sync Start nativo (`setSyncStart`): arranca en el mismo Note On. Con ACMP activo la mano izquierda (bajo el split point) solo controla acordes.
  - **Armonización**: patrones fuente en C (CMaj7, como los .STY Yamaha). Tónica al registro más cercano, mapeo de 3ra/5ta/7ma por tipo de acorde. Memoria de acorde (solo cambia en Note On) y re-armonización de las notas sostenidas al cambiar de acorde. `ChordRecognizer` detecta Maj, Min, 7, Maj7, m7, m7b5, dim, aug, sus2, sus4 e inversiones (`C/E`).
  - **MIDI (`MidiManager.kt`)**: varios dispositivos a la vez. USB class-compliant y BLE por el servicio MIDI de Android; driver USB directo solo para teclados que el sistema no expone (reclama únicamente la interfaz MIDI Streaming). Parser MIDI con running status que tolera mensajes partidos (`MidiStreamParser`). BLE: el `MidiDevice` de `openBluetoothDevice` se conserva abierto (dueño de la conexión GATT) y se reconecta solo al último teclado usado.
  - **Alineación 16 KB**: Banderas `-Wl,-z,max-page-size=16384` en CMake para compatibilidad estricta con Android 15+.

## Pruebas

- `npm test`: parser de estilos .STY (`tests/styParser.test.js`) y chequeo de tipos TypeScript.
- Pruebas del parser MIDI (JVM): `cd android; .\gradlew.bat :synth-engine:testReleaseUnitTest`.
- Pruebas nativas del motor (en el teléfono por adb): `npm run test:native` (compila `modules/synth-engine/android/src/test/cpp/engine_tests.cpp` con el NDK, sube el binario y `default.sf2` a `/data/local/tmp` y lo ejecuta).
- Si `JAVA_HOME` apunta a una ruta inexistente, Gradle puede usar el JDK 17 que descargó en `%USERPROFILE%\.gradle\jdks\`.
