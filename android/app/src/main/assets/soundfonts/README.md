# SoundFonts Directory (`.sf2`)

Coloca aquí tus archivos de muestras instrumentales `.sf2` (por ejemplo: `default.sf2` o `FluidR3_GM.sf2`).

El motor C++ nativo de **SYNTH CONNECT Pro** (`synthengine`) lee automáticamente los archivos SoundFont 2 desde este directorio usando `AAssetManager` de Android para renderizar timbres reales multimuestra a través de TinySoundFont (`tsf.h`).

Si no se coloca un archivo `.sf2`, el motor C++ activa automáticamente el sintetizador polifónico de respaldar incorporado.
