# Rules for Agents

## Formatting and UI Guidelines
- **No Emojis**: Do NOT use emojis in agent responses, comments, documentation, or code/UI components.
- **Use Icons Only**: Use SVG icons, vector graphics, UI symbol glyphs, or standard clean text formatting instead of emojis.

## Guia de Instalación y Requisitos para Nuevos Equipos (Setup Guide)

Para clonar y continuar con el desarrollo de este proyecto en otro equipo de cómputo, se deben instalar y configurar los siguientes componentes:

### 1. Herramientas de Desarrollo Requeridas
- **Node.js**: Versión 18.x o 20.x LTS.
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
Dado que las carpetas de compilación pesadas (`node_modules/`, `android/build/`, `android/.gradle/`, `android/.cxx/`, `.expo/`) están ignoradas en Git para mantener el repositorio ultra liviano (< 1 MB), ejecuta los siguientes comandos al clonar:

1. **Instalar dependencias de Node**:
   ```bash
   npm install
   ```

2. **Crear archivo de propiedades locales del SDK**:
   Crear el archivo `android/local.properties` con la ruta local de tu SDK:
   ```properties
   sdk.dir=C\:\\Users\\<TU_USUARIO>\\AppData\\Local\\Android\\Sdk
   ```

3. **Ejecutar Autolinking de Expo Modules**:
   ```bash
   npx expo prebuild --platform android
   ```

4. **Empaquetar el Bundle Offline JavaScript**:
   ```bash
   npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res
   ```

5. **Compilar el APK Nativo (C++ NDK + AAudio + SoundFonts + Synth Engine)**:
   ```bash
   cd android
   gradlew.bat assembleDebug
   ```

6. **Instalar y Ejecutar en Dispositivo Físico o Emulador**:
   ```bash
   adb install -r android\app\build\outputs\apk\debug\app-debug.apk
   adb shell am start -n com.synthconnect.app/.MainActivity
   ```

### 4. Consideraciones Técnicas Nativas
- **Motor Sintetizador C++ NDK**: Se encuentra en `modules/synth-engine/android/src/main/cpp/`. Requiere el punto de entrada `JNI_OnLoad` en `OnLoad.cpp` para su registro en Android.
- **Alineación ELF 16 KB**: En `modules/synth-engine/android/build.gradle`, se mantienen las banderas CMake `-Wl,-z,max-page-size=16384` y `-DANDROID_PLATFORM=android-26` para compatibilidad con versiones recientes de Android y AAudio.
- **Ruta de SoundFonts `.sf2`**: Archivos de muestras en `android/app/src/main/assets/soundfonts/`.

---

## Estado Actual del Proyecto y Arquitectura del Código (Session Context)

### 1. Resumen de la Interfaz y Componentes Implementados (`App.tsx`)
- **Header Principal Centrado:**
  - **Izquierda:** Estado del instrumento MIDI detectado (`PSR-E463 USB OK | Local OFF`).
  - **Centro:** Nombre de la aplicación `SYNTH CONNECT Pro` perfectamente centrado.
  - **Derecha:** Hora real del dispositivo (`H:MM AM/PM`) que se actualiza automáticamente cada minuto y porcentaje real de batería consumiendo el módulo nativo `expo-battery`.
- **Panel Izquierdo (Styles Yamaha .STY):**
  - Lista interactiva de ritmos (`Cumbia Professional`, `Pop Rock Ballad`, etc.).
  - Slider horizontal **`STYLE VOLUME`** 3D con soporte de arrastre gestual continuo (`PanResponder`).
  - 8 Botones circulares de sección (`INTRO A..D`, `MAIN A..D`).
  - Botones de transporte (`INTRO`, `START/STOP` gigante con resplandor, `ENDING`).
- **Panel Central (Performance Layers):**
  - **Header con Menú Hamburguesa `≡`:** Abre la consola modal a pantalla completa para selección de sonidos/voces.
  - **4 Canales Faders Independientes:** Cada fader de voz (`Yamaha CFX Grand`, `Ambient Pad Warm`, `Syn Strings Symphony`, `Synth Lead Moog Saw`) en su propia tarjeta separada.
  - **Borde de Selección Cyan:** Al presionar o arrastrar un canal, se resalta con borde azul cyan brillante (`#00E5FF`).
  - **VU Meters Dinámicos:** Medidores LED verticales que reaccionan al volumen real de reproducción.
  - **Faders Rectos 3D Delgados:** Sin botones `-` ni `+`, con captura gestual fluida por toque directo (`onStartShouldSetPanResponderCapture`).
  - **Controles Inferiores `OCTAVE` y `TRANSPOSE`:**
    - `OCTAVE`: `- [ OCT 0 ] +` (rango -3 a +3 octavas).
    - `TRANSPOSE`: `- [ TRP 0 ] +` (rango -12 a +12 semitonos).
    - Botones con latencia 0ms (`delayPressIn={0}`).
- **Modal a Pantalla Completa `PERFORMANCE VOICE SELECTOR`:**
  - Selector de canal de destino (`F1`, `F2`, `F3`, `F4`).
  - Filtro por categorías (`ALL`, `PIANO`, `PADS`, `STRINGS`, `LEADS`, `BRASS`, `ORGAN`, `BASS`).
  - Tarjetas de voces instrumentales con indicación de preset SoundFont y audición táctil inmediata.
- **Panel Derecho (Consola Digital ADSR + Filtros + Tempo + Bancos + Modulación):**
  - **Tarjeta ENVELOPE (ADSR):**
    - **Gráfica Dinámica SVG (220x70):** Curva interactiva de envelope que ocupa de extremo a extremo la tarjeta con cuadrícula y 4 nodos interactivos resaltados (`A` Attack, `D` Delay, `S` Sustain, `R` Release).
    - **Perilla Maestra ADSR (Izquierda):** Dial concéntrico 3D naranja para ajustar el valor del parámetro seleccionado.
    - **Fader Vertical CUTOFF (Derecha):** Control vertical delgado de 68px de alto para el corte de frecuencia de filtro.
    - **4 Botones de Parámetros ADSR:** Pills (`ATTACK`, `DELAY`, `SUSTAIN`, `RELEASE`) con valor numérico en tiempo real.
  - **Tarjeta Independiente `TEMPO CONTROL`:**
    - Ubicada directamente debajo de los 4 botones de ADSR.
    - Botones gigantes `-` y `+` con respuesta ultrarrápida (0ms latencia).
  - **Fader Horizontal `RESONANCE`:**
    - Tarjeta independiente ubicada en el espacio libre debajo de Tempo Control y arriba de Modulación.
  - **Tarjeta `MEMORY BANKS` (Columna Derecha):**
    - 8 Bancos de Memoria (`BANK 1` a `BANK 8`) ocupando en 2 columnas x 4 filas toda la altura del panel derecho.
  - **Fader Horizontal `MODULATION`:**
    - Ubicado al fondo del panel derecho abarcando el 100% del ancho con cabezal máster 3D.

### 2. Módulos y Motor Nativo C++ Implementados
- **`expo-battery`**: Módulo nativo autolinked para lectura real de la batería del dispositivo.
- **`react-native-svg`**: Renderizado vectorial de curvas ADSR.
- **`synth-engine` (C++ NDK / AAudio / TSF / Dual MIDI Driver)**:
  - **Audio API Nativa**: `AAudio` (Android API 26+) para streaming en tiempo real estéreo PCM float a 44100 Hz con latencia ultrabaja (<5ms).
  - **SoundFont Engine**: TinySoundFont (`tsf.h`) para decodificación y sintetizado multimuestra SF2.
  - **Lector de Assets**: Carga directa mediante `AAssetManager` de archivos en `android/app/src/main/assets/soundfonts/`.
  - **Sintetizador de Respaldar**: Motor sintético incorporado en C++ cuando no hay SF2 disponible.
  - **DSP Filter & Envelope**: Filtro pasa-bajas `BiquadFilter.h` (Cutoff & Resonance) y generador envolvente `AdsrEnvelope.h` de 4 etapas aplicados en el callback de audio.
  - **Controlador Dual MIDI (USB Host OTG + Bluetooth LE MIDI)**:
    - **Driver Directo USB Host**: Enumeración directa de `UsbManager` con hilos Bulk IN en Kotlin para baja latencia (0ms) sin depender exclusivamente del servicio MIDI del SO.
    - **Escáner BLE MIDI**: Soporte nativo para controladores inalámbricos M-VAVE / BLE MIDI vía UUID `03B80E5A-EDE8-4B33-A751-6CE34EC4C700`.
    - **Inicialización Diferida en Expo**: `getMidiManager()` asegura la instanciación una vez listo el `ReactContext` de Android.
    - **Alineación 16 KB**: Banderas `-Wl,-z,max-page-size=16384` en CMake para compatibilidad estricta con Android 15+.

---

## Roadmap de Lógica a Implementar en Próximas Sesiones

### Fase 1: Motor de Audio C++ DSP y SoundFonts (`modules/synth-engine`) [COMPLETADO]
- [x] **Archivos SoundFont `.sf2`:** Carga mediante `AAssetManager` desde `android/app/src/main/assets/soundfonts/`.
- [x] **Decodificador `tsf.h` (TinySoundFont):** Renderizado multitimbre SF2.
- [x] **Procesamiento DSP Real:** Filtros pasa-bajas Biquad C++ (Cutoff / Resonance) y envolvente ADSR de 4 etapas.
- [x] **Flujo AAudio:** Transmisión estéreo float a 44.1 kHz con latencia < 5ms.
- [x] **Selector Modal de Voces:** Menú hamburguesa `≡` en `App.tsx` para cambiar voces en faders.
- [x] **Gestión CRUD de SoundFonts (`.sf2` / `.sfz`):** Importación contextual por categoría (`+ IMPORTAR A PIANO`, `+ IMPORTAR A PADS`, etc.) con `expo-document-picker`, almacenamiento persistente local en `${FileSystem.documentDirectory}soundfonts/`, eliminación e índice JSON con soporte nativo de lectura C++ por rutas absolutas (`tsf_load_filename`).

### Fase 2: Conectividad MIDI USB OTG / BLE (`src/hooks/useMidiDevices.ts`) [COMPLETADO]
- [x] **Recepción MIDI Físico e Inalámbrico:** Soporte dual para controladores USB-C OTG (M-VAVE 25, Yamaha PSR-E463) y Bluetooth LE MIDI.
- [x] **Mapeo de Eventos:** Procesamiento nativo C++ de `NoteOn`, `NoteOff`, `PitchBend` y `ControlChange` (Sustain Pedal CC64, Modulation Wheel CC1).

### Fase 3: Arranger de Ritmos Yamaha `.STY` (`src/hooks/useArranger.ts`)
- **Parser `.STY` (SFF1 / SFF2):** Decodificar pistas de batería, bajo y acompañamiento armónico.
- **Reconocimiento de Acordes C++ (`ChordRecognizer.cpp`):** Clasificar acordes de mano izquierda (`Major`, `Minor`, `7th`, `Dim`) para transposición armónica en vivo.
- **Sincronización BPM Clock:** Reloj de tiempo real para variaciones `INTRO A..D`, `MAIN A..D` y `ENDING`.

### Fase 4: Sistema de Bancos de Memoria y Presets (`BANK 1..8`)
- **Guardado/Carga Instantánea:** Almacenar combinaciones completas de voz, volúmenes, filtros, tempo y ritmo en Async Storage / SQLite.
