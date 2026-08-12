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

### 2. Ubicación Recomendada del SDK (Permisos)
Instalar o copiar el Android SDK en la carpeta local de usuario para evitar bloqueos de permisos de Administrador en Windows:
- Ruta: `C:\Users\<TU_USUARIO>\AppData\Local\Android\Sdk`
- Configurar variable de entorno `ANDROID_HOME`: `C:\Users\<TU_USUARIO>\AppData\Local\Android\Sdk`
- Añadir al `PATH`:
  - `%JAVA_HOME%\bin`
  - `%ANDROID_HOME%\platform-tools`
  - `%ANDROID_HOME%\cmdline-tools\latest\bin`

### 3. Pasos de Configuración del Proyecto
1. **Instalar dependencias de Node**:
   ```bash
   npm install
   ```

2. **Crear archivo de propiedades locales del SDK**:
   Crear el archivo `android/local.properties` con la ruta de tu SDK:
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

5. **Compilar el APK Nativo (C++ NDK + Kotlin + Synth Engine)**:
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
- **Alineación ELF 16 KB**: En `modules/synth-engine/android/build.gradle`, se deben mantener las banderas CMake `-Wl,-z,max-page-size=16384` para compatibilidad con versiones recientes de Android.

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
  - **4 Canales Faders Independientes:** Cada fader de voz (`CFX Piano`, `Ambient Pad`, `Syn Strings`, `Synth Lead`) en su propia tarjeta separada.
  - **Borde de Selección Cyan:** Al presionar o arrastrar un canal, se resalta con borde azul cyan brillante (`#00E5FF`).
  - **VU Meters Dinámicos:** Medidores LED verticales que reaccionan al volumen real de reproducción.
  - **Faders Rectos 3D Delgados:** Sin botones `-` ni `+`, con captura gestual fluida por toque directo (`onStartShouldSetPanResponderCapture`).
  - **Controles Inferiores `OCTAVE` y `TRANSPOSE`:**
    - `OCTAVE`: `- [ OCT 0 ] +` (rango -3 a +3 octavas).
    - `TRANSPOSE`: `- [ TRP 0 ] +` (rango -12 a +12 semitonos).
    - Botones con latencia 0ms (`delayPressIn={0}`).
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

### 2. Optimización de Latencia Táctil
- Todos los elementos presionables (`TouchableOpacity`) utilizan `delayPressIn={0}` y `delayPressOut={0}` para respuesta inmediata de 0ms sin pérdida de clics rápidos.

### 3. Módulos Nativos Específicos
- **`expo-battery`**: Módulo nativo autolinked para lectura real de la batería del dispositivo.
- **`react-native-svg`**: Versión 15.2.0 para renderizado vectorial de curvas ADSR.
- **`synth-engine`**: Módulo local en `modules/synth-engine/` compilado vía NDK C++ con `JNI_OnLoad`.

## Roadmap de Lógica a Implementar en Próximas Sesiones

### Fase 1: Motor de Audio C++ DSP y SoundFonts (`modules/synth-engine`)
- **Archivos SoundFont `.sf2`:** Colocar archivos de audio multimuestra en `android/app/src/main/assets/soundfonts/`.
- **Decodificador `tsf.h` (TinySoundFont):** Integrar la cabecera C++ ligera en `modules/synth-engine/android/src/main/cpp/` para renderizado multitimbre SF2.
- **Procesamiento DSP Real:** Conectar Cutoff y Resonancia a filtros Low-Pass Biquad en C++, y envolvente ADSR de 4 etapas a la ganancia de notas.
- **Flujo Oboe/AAudio:** Transmitir audio estéreo a 44.1/48 kHz con buffers de latencia < 5ms.

### Fase 2: Conectividad MIDI USB OTG (`src/hooks/useMidiDevices.ts`)
- **Recepción MIDI Físico:** Conectar controladores MIDI / Yamaha PSR-E463 por USB-C OTG.
- **Mapeo de Eventos:** Procesar `NoteOn`, `NoteOff`, `PitchBend` y `ControlChange` (Sustain Pedal CC64, Modulation Wheel CC1).

### Fase 3: Arranger de Ritmos Yamaha `.STY` (`src/hooks/useArranger.ts`)
- **Parser `.STY` (SFF1 / SFF2):** Decodificar pistas de batería, bajo y acompañamiento armónico.
- **Reconocimiento de Acordes C++ (`ChordRecognizer.cpp`):** Clasificar acordes de mano izquierda (`Major`, `Minor`, `7th`, `Dim`) para transposición armónica en vivo.
- **Sincronización BPM Clock:** Reloj de tiempo real para variaciones `INTRO A..D`, `MAIN A..D` y `ENDING`.

### Fase 4: Sistema de Bancos de Memoria y Presets (`BANK 1..8`)
- **Guardado/Carga Instantánea:** Almacenar combinaciones completas de voz, volúmenes, filtros, tempo y ritmo en Async Storage / SQLite.

