#include <jni.h>
#include <string>
#include "SynthEngine.h"

extern "C" {

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void* reserved) {
    LOGI("JNI_OnLoad: libsynthengine.so cargado y registrado exitosamente en el sistema");
    return JNI_VERSION_1_6;
}

JNIEXPORT jboolean JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeInitialize(JNIEnv* env, jobject thiz) {
    LOGI("JNI: Invocando nativeInitialize()");
    return SynthEngine::getInstance().initialize();
}

JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeNoteOn(JNIEnv* env, jobject thiz, jint note, jint velocity) {
    SynthEngine::getInstance().noteOn(note, velocity);
}

JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeNoteOff(JNIEnv* env, jobject thiz, jint note) {
    SynthEngine::getInstance().noteOff(note);
}

JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeSetParam(JNIEnv* env, jobject thiz, jstring param_name, jfloat value) {
    const char* nativeString = env->GetStringUTFChars(param_name, 0);
    SynthEngine::getInstance().setParam(std::string(nativeString), value);
    env->ReleaseStringUTFChars(param_name, nativeString);
}

JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeControlChange(JNIEnv* env, jobject thiz, jint channel, jint cc, jint value) {
    SynthEngine::getInstance().controlChange(channel, cc, value);
}

JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeProgramChange(JNIEnv* env, jobject thiz, jint channel, jint program) {
    SynthEngine::getInstance().programChange(channel, program);
}

JNIEXPORT jstring JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeGetDetectedChord(JNIEnv* env, jobject thiz) {
    std::string chord = SynthEngine::getInstance().getDetectedChord();
    return env->NewStringUTF(chord.c_str());
}

JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeSetSplitPoint(JNIEnv* env, jobject thiz, jint note) {
    SynthEngine::getInstance().setSplitPoint(note);
}

JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeSetBpm(JNIEnv* env, jobject thiz, jint bpm) {
    SynthEngine::getInstance().setBpm(bpm);
}

JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeSetStyleSection(JNIEnv* env, jobject thiz, jstring section) {
    const char* nativeString = env->GetStringUTFChars(section, 0);
    SynthEngine::getInstance().setStyleSection(std::string(nativeString));
    env->ReleaseStringUTFChars(section, nativeString);
}

}
