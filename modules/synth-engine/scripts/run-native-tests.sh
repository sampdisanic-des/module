#!/usr/bin/env bash
# Compila las pruebas nativas del motor con el NDK y las ejecuta en el
# dispositivo Android conectado por adb.
#   bash modules/synth-engine/scripts/run-native-tests.sh            # compilar + ejecutar
#   bash modules/synth-engine/scripts/run-native-tests.sh --build-only
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SDK="${ANDROID_HOME:-$LOCALAPPDATA/Android/Sdk}"
SDK="${SDK//\\//}"
NDK="${ANDROID_NDK_HOME:-$SDK/ndk/26.1.10909125}"
ADB="${ADB:-$SDK/platform-tools/adb}"
ABI_TRIPLE="${ABI_TRIPLE:-aarch64-linux-android26}"

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) HOST=windows-x86_64; EXT=.cmd ;;
  Darwin) HOST=darwin-x86_64; EXT= ;;
  *) HOST=linux-x86_64; EXT= ;;
esac
CXX="$NDK/toolchains/llvm/prebuilt/$HOST/bin/${ABI_TRIPLE}-clang++$EXT"

CPP="$ROOT/modules/synth-engine/android/src/main/cpp"
TEST="$ROOT/modules/synth-engine/android/src/test/cpp/engine_tests.cpp"
OUT="$ROOT/modules/synth-engine/android/build/native-tests"
mkdir -p "$OUT"

echo "[build] $ABI_TRIPLE"
"$CXX" -std=c++17 -O2 -Wall -Wno-unused-parameter -Wno-unused-function -fPIE -pie \
  -I"$CPP" "$TEST" "$CPP/SynthEngine.cpp" "$CPP/ChordRecognizer.cpp" "$CPP/AudioStream.cpp" \
  -static-libstdc++ -laaudio -llog -landroid -o "$OUT/engine_tests"
echo "[build] OK -> $OUT/engine_tests"

if [[ "${1:-}" == "--build-only" ]]; then exit 0; fi

# MSYS_NO_PATHCONV: evita que Git Bash convierta /data/local/tmp en una ruta de Windows;
# por eso las rutas locales se pasan ya en formato nativo (cygpath -w).
native() { if command -v cygpath >/dev/null; then cygpath -w "$1"; else echo "$1"; fi; }

MSYS_NO_PATHCONV=1 "$ADB" push "$(native "$OUT/engine_tests")" /data/local/tmp/engine_tests >/dev/null
MSYS_NO_PATHCONV=1 "$ADB" push "$(native "$ROOT/android/app/src/main/assets/soundfonts/default.sf2")" /data/local/tmp/default.sf2 >/dev/null
MSYS_NO_PATHCONV=1 "$ADB" shell chmod 755 /data/local/tmp/engine_tests
MSYS_NO_PATHCONV=1 "$ADB" shell /data/local/tmp/engine_tests /data/local/tmp/default.sf2
