#include <jni.h>
#include <string>
#include <android/asset_manager_jni.h>
#include "SynthEngine.h"

extern "C" {

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void* reserved) {
    LOGI("JNI_OnLoad: libsynthengine.so cargado exitosamente");
    return JNI_VERSION_1_6;
}

JNIEXPORT jboolean JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeInitialize(JNIEnv* env, jobject thiz) {
    return SynthEngine::getInstance().initialize(nullptr);
}

JNIEXPORT jboolean JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeInitializeWithAssets(JNIEnv* env, jobject thiz, jobject assetManagerObj) {
    AAssetManager* assetManager = AAssetManager_fromJava(env, assetManagerObj);
    return SynthEngine::getInstance().initialize(assetManager);
}

JNIEXPORT jboolean JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeLoadSoundFont(JNIEnv* env, jobject thiz, jstring assetPath) {
    const char* nativeString = env->GetStringUTFChars(assetPath, 0);
    bool result = SynthEngine::getInstance().loadSoundFont(std::string(nativeString));
    env->ReleaseStringUTFChars(assetPath, nativeString);
    return result;
}

JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeSetLayerMix(JNIEnv* env, jobject thiz, jint layerIndex, jfloat volume, jboolean mute, jboolean solo) {
    SynthEngine::getInstance().setLayerMix(layerIndex, volume, mute, solo);
}

JNIEXPORT jboolean JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeSetLayerVoice(JNIEnv* env, jobject thiz, jint layerIndex, jstring voiceName, jint presetIndex, jstring fontPath) {
    const char* vName = env->GetStringUTFChars(voiceName, 0);
    const char* fPath = env->GetStringUTFChars(fontPath, 0);
    bool res = SynthEngine::getInstance().setLayerVoice(layerIndex, std::string(vName), presetIndex, std::string(fPath));
    env->ReleaseStringUTFChars(voiceName, vName);
    env->ReleaseStringUTFChars(fontPath, fPath);
    return res;
}

JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeSetLayerOctave(JNIEnv* env, jobject thiz, jint layerIndex, jint octave) {
    SynthEngine::getInstance().setLayerOctave(layerIndex, octave);
}

JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeSetGlobalTranspose(JNIEnv* env, jobject thiz, jint transpose) {
    SynthEngine::getInstance().setGlobalTranspose(transpose);
}

JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeSetLayerParam(JNIEnv* env, jobject thiz, jint layerIndex, jstring paramName, jfloat value) {
    const char* pName = env->GetStringUTFChars(paramName, 0);
    SynthEngine::getInstance().setLayerParam(layerIndex, std::string(pName), value);
    env->ReleaseStringUTFChars(paramName, pName);
}

JNIEXPORT jfloatArray JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeGetChannelLevels(JNIEnv* env, jobject thiz) {
    float levels[4];
    SynthEngine::getInstance().getChannelLevels(levels);
    jfloatArray result = env->NewFloatArray(4);
    env->SetFloatArrayRegion(result, 0, 4, levels);
    return result;
}

JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeAuditionVoice(JNIEnv* env, jobject thiz, jint presetIndex, jstring fontPath, jint note, jint velocity) {
    const char* fPath = env->GetStringUTFChars(fontPath, 0);
    SynthEngine::getInstance().auditionVoice(presetIndex, std::string(fPath), note, velocity);
    env->ReleaseStringUTFChars(fontPath, fPath);
}

JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeAuditionStop(JNIEnv* env, jobject thiz, jint note) {
    SynthEngine::getInstance().auditionStop(note);
}

JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeNoteOn(JNIEnv* env, jobject thiz, jint note, jint velocity) {
    SynthEngine::getInstance().noteOn(note, velocity);
}

JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeNoteOff(JNIEnv* env, jobject thiz, jint note) {
    SynthEngine::getInstance().noteOff(note);
}

// Métodos de Reproducción de Estilos Yamaha (.STY)
JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeStyleNoteOn(JNIEnv* env, jobject thiz, jint channel, jint note, jint velocity, jint program) {
    SynthEngine::getInstance().styleNoteOn(channel, note, velocity, program);
}

JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeStyleNoteOff(JNIEnv* env, jobject thiz, jint channel, jint note) {
    SynthEngine::getInstance().styleNoteOff(channel, note);
}

JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeSetStyleMasterVolume(JNIEnv* env, jobject thiz, jfloat volume) {
    SynthEngine::getInstance().setStyleMasterVolume(volume);
}

JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeStyleAllNotesOff(JNIEnv* env, jobject thiz) {
    SynthEngine::getInstance().styleAllNotesOff();
}

// Secuenciador Nativo C++
JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeClearStyleData(JNIEnv* env, jobject thiz) {
    SynthEngine::getInstance().clearStyleData();
}

JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeSetStylePpq(JNIEnv* env, jobject thiz, jint ppq) {
    SynthEngine::getInstance().setStylePpq(ppq);
}

JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeLoadStyleSectionEvents(JNIEnv* env, jobject thiz, jstring sectionName, jint totalTicks, jstring eventsData) {
    const char* secStr = env->GetStringUTFChars(sectionName, 0);
    const char* evtStr = env->GetStringUTFChars(eventsData, 0);
    SynthEngine::getInstance().loadStyleSectionEvents(std::string(secStr), totalTicks, std::string(evtStr));
    env->ReleaseStringUTFChars(sectionName, secStr);
    env->ReleaseStringUTFChars(eventsData, evtStr);
}

JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeStartStylePlayback(JNIEnv* env, jobject thiz, jint bpm, jboolean accompanimentOn) {
    SynthEngine::getInstance().startStylePlayback(bpm, accompanimentOn);
}

JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeStopStylePlayback(JNIEnv* env, jobject thiz) {
    SynthEngine::getInstance().stopStylePlayback();
}

JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeSetStyleAccompaniment(JNIEnv* env, jobject thiz, jboolean enabled) {
    SynthEngine::getInstance().setStyleAccompaniment(enabled);
}

JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeSetStyleBpm(JNIEnv* env, jobject thiz, jint bpm) {
    SynthEngine::getInstance().setStyleBpm(bpm);
}

JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeSetStyleSection(JNIEnv* env, jobject thiz, jstring section) {
    const char* secStr = env->GetStringUTFChars(section, 0);
    SynthEngine::getInstance().setStyleSection(std::string(secStr));
    env->ReleaseStringUTFChars(section, secStr);
}

JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeQueueNextStyleSection(JNIEnv* env, jobject thiz, jstring section) {
    const char* secStr = env->GetStringUTFChars(section, 0);
    SynthEngine::getInstance().queueNextStyleSection(std::string(secStr));
    env->ReleaseStringUTFChars(section, secStr);
}

JNIEXPORT jboolean JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeIsStylePlaying(JNIEnv* env, jobject thiz) {
    return SynthEngine::getInstance().isStylePlaying();
}

JNIEXPORT jint JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeGetCurrentBeat(JNIEnv* env, jobject thiz) {
    return SynthEngine::getInstance().getCurrentBeat();
}

JNIEXPORT jstring JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeGetCurrentSection(JNIEnv* env, jobject thiz) {
    std::string s = SynthEngine::getInstance().getCurrentSection();
    return env->NewStringUTF(s.c_str());
}

JNIEXPORT jstring JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeGetQueuedSection(JNIEnv* env, jobject thiz) {
    std::string s = SynthEngine::getInstance().getQueuedSection();
    return env->NewStringUTF(s.c_str());
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

JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativePitchBend(JNIEnv* env, jobject thiz, jint channel, jint pitch) {
    SynthEngine::getInstance().pitchBend(channel, pitch);
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
Java_expo_modules_synthengine_SynthEngineModule_nativeSetSyncStart(JNIEnv* env, jobject thiz, jboolean armed) {
    SynthEngine::getInstance().setSyncStart(armed);
}

JNIEXPORT jboolean JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeIsSyncStartArmed(JNIEnv* env, jobject thiz) {
    return SynthEngine::getInstance().isSyncStartArmed();
}

JNIEXPORT void JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeAllNotesOff(JNIEnv* env, jobject thiz) {
    SynthEngine::getInstance().allNotesOff();
}

JNIEXPORT jint JNICALL
Java_expo_modules_synthengine_SynthEngineModule_nativeGetSampleRate(JNIEnv* env, jobject thiz) {
    return SynthEngine::getInstance().getSampleRate();
}

}
