#ifndef SYNTHENGINE_H
#define SYNTHENGINE_H

#include <string>
#include <vector>
#include <unordered_map>
#include <mutex>
#include <cmath>
#include <android/log.h>
#include <android/asset_manager.h>
#include "ChordRecognizer.h"
#include "BiquadFilter.h"
#include "AudioStream.h"
#include "tsf.h"

#define LOG_TAG "SynthEngine"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)
#define LOGD(...) __android_log_print(ANDROID_LOG_DEBUG, LOG_TAG, __VA_ARGS__)

// Capa / Fader (F1..F4). Cada capa tiene su propia instancia TSF y toca
// siempre en el canal 0 de esa instancia, de modo que sustain, pitch bend,
// vibrato y envolvente funcionen por voz (no por capa).
struct LayerStem {
    std::string voiceName;
    std::string fontPath;      // "" = SoundFont por defecto (GM)
    int program = 0;           // Número de programa GM (o índice en SF2 personalizado)
    int resolvedPreset = 0;    // Índice real del preset dentro del SF2
    float volume = 0.8f;       // 0..1
    bool mute = false;
    bool solo = false;
    int octave = 0;            // -3..+3

    // Parámetros de usuario (escala UI 0..100)
    float cutoff = 100.0f;
    float resonance = 20.0f;
    float attack = 0.0f;
    float decay = 45.0f;       // 45 = neutro (respeta el SF2)
    float sustain = 100.0f;    // 100 = neutro
    float release = 30.0f;

    BiquadFilter filter;
    tsf* tsfInstance = nullptr;

    // Nota física -> notas transpuestas que sonaron en esta capa.
    // Garantiza Note Off exacto aunque cambie octava/transposición con la tecla presionada.
    std::unordered_map<int, std::vector<int>> heldNotes;
};

// Evento de nota del secuenciador de estilos (canal 1..16, como en el .STY)
struct NativeStyleEvent {
    int tick;
    int durationTicks;
    int channel;
    int note;
    int velocity;
    int program;
    bool isDrum;
};

struct NativeStyleSectionData {
    int totalTicks = 1920;
    std::vector<NativeStyleEvent> events; // ordenados por tick
};

struct ActiveStyleNote {
    int tsfChannel;   // 0..15
    int sourceNote;   // nota original del patrón (en C)
    int playedNote;   // nota armonizada que está sonando
    int velocity;
    bool isDrum;
    double offTick;   // relativo a la posición actual del secuenciador
};

class SynthEngine {
public:
    static SynthEngine& getInstance();

    bool initialize(AAssetManager* assetManager = nullptr);
    bool loadSoundFont(const std::string& assetPath);

    // Capas (F1..F4)
    void setLayerMix(int layerIndex, float volume, bool mute, bool solo);
    bool setLayerVoice(int layerIndex, const std::string& voiceName, int program, const std::string& fontPath);
    void setLayerOctave(int layerIndex, int octave);
    void setGlobalTranspose(int transpose);
    void setLayerParam(int layerIndex, const std::string& paramName, float value);

    void getChannelLevels(float* outLevels);

    // Preescucha de voces
    void auditionVoice(int program, const std::string& fontPath, int note, int velocity);
    void auditionStop(int note);

    // Interpretación
    void noteOn(int note, int velocity);
    void noteOff(int note);
    void allNotesOff();
    void setParam(const std::string& paramName, float value);
    float getParam(const std::string& paramName) const;

    // Acompañamiento manual
    void styleNoteOn(int channel, int note, int velocity, int program);
    void styleNoteOff(int channel, int note);
    void setStyleMasterVolume(float volume);
    void styleAllNotesOff();

    // Secuenciador nativo de estilos
    void clearStyleData();
    void setStylePpq(int ppq);
    void loadStyleSectionEvents(const std::string& sectionName, int totalTicks, const std::string& eventsData);
    void startStylePlayback(int bpm, bool accompanimentOn);
    void stopStylePlayback();
    void setStyleAccompaniment(bool enabled);
    void setStyleBpm(int bpm);
    void setStyleSection(const std::string& section);
    void queueNextStyleSection(const std::string& section);
    void setSyncStart(bool armed);

    bool isStylePlaying() const;
    bool isSyncStartArmed() const;
    int getCurrentBeat() const;
    std::string getCurrentSection() const;
    std::string getQueuedSection() const;

    // MIDI extendido
    void controlChange(int channel, int cc, int value);
    void programChange(int channel, int program);
    void pitchBend(int channel, int pitch);

    // Acordes
    std::string getDetectedChord();
    void setSplitPoint(int note);
    int getSplitPoint() const;

    void setBpm(int bpm);
    int getBpm() const;

    bool isInitialized() const;
    int getSampleRate() const;

    // ---- Hooks de prueba (engine_tests.cpp); no se usan desde la app ----
    void renderForTest(float* buffer, int numFrames) { renderAudioCallback(buffer, numFrames); }
    void setSampleRateForTest(int sr) { onSampleRateChanged(sr); }
    int harmonizeForTest(int sourceNote) {
        std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
        return harmonizeLocked(sourceNote, 0);
    }
    std::vector<ActiveStyleNote> activeStyleNotesForTest() {
        std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
        return mActiveStyleNotes;
    }
    double currentTickForTest() {
        std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
        return mCurrentTick;
    }
    std::string layerPresetNameForTest(int layer) {
        std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
        if (layer < 0 || layer > 3 || !mLayers[layer].tsfInstance) return "";
        const char* n = tsf_get_presetname(mLayers[layer].tsfInstance, mLayers[layer].resolvedPreset);
        return n ? n : "";
    }

private:
    SynthEngine();
    ~SynthEngine();

    SynthEngine(const SynthEngine&) = delete;
    SynthEngine& operator=(const SynthEngine&) = delete;

    // Audio
    void renderAudioCallback(float* buffer, int numFrames);
    void renderBlock(float* out, int numFrames);
    void onSampleRateChanged(int sampleRate);

    // SoundFonts
    tsf* loadFontFileUnlocked(const std::string& cleanPath);
    tsf* acquireFontCopyLocked(const std::string& cleanPath);
    void installDefaultFontLocked(tsf* newDefault);
    void setupLayerInstanceLocked(LayerStem& layer);
    void applyLayerEnvelopeLocked(LayerStem& layer);
    void setupStyleInstanceLocked();
    void releaseLayerNotesLocked(LayerStem& layer);
    void pruneFontCacheLocked();
    bool layerAudibleLocked(int index, bool anySolo) const;

    // Secuenciador
    const NativeStyleSectionData* currentSectionDataLocked() const;
    bool sectionExistsLocked(const std::string& name) const;
    void enterSectionLocked(const std::string& name, double startTick);
    void onSectionEndLocked();
    void advanceSequencerLocked(int frames);
    void fireStyleEventLocked(const NativeStyleEvent& evt);
    void seekEventCursorLocked();
    void startStyleLocked();
    void stopStyleLocked();
    void releaseActiveStyleNotesLocked();
    void reharmonizeActiveNotesLocked();
    int harmonizeLocked(int sourceNote, int tsfChannel) const;
    int barTicksLocked() const { return mStylePpq * 4; }
    double posInBarLocked() const { return fmod(mGlobalTick, (double)barTicksLocked()); }

    bool mInitialized;
    mutable std::recursive_mutex mEngineMutex;
    AAssetManager* mAssetManager;
    int mSampleRate;

    tsf* mDefaultTsf;
    tsf* mStyleTsf;
    tsf* mAuditionTsf;
    std::string mAuditionFontPath;
    std::unordered_map<std::string, tsf*> mFontCache; // ruta -> instancia maestra

    LayerStem mLayers[4];
    float mChannelPeaks[4];

    // Mezcla maestra y controladores
    float mMasterVolume;
    float mExpression;
    float mModulation;     // 0..1 (rueda de modulación o fader)
    float mVibratoPhase;
    bool mVibratoActive;
    bool mSustainPedal;
    int mPitchWheel;
    int mGlobalTranspose;
    float mStyleMasterVolume;
    std::unordered_map<std::string, float> mParameters; // solo para getParam/compatibilidad

    AudioStream mAudioStream;
    BiquadFilter mMasterFilter;

    // Buffers preasignados (el callback de audio no reserva memoria)
    std::vector<float> mStyleBuf;
    std::vector<float> mLayerBuf;

    // Acordes
    ChordRecognizer mLeftHandChordRecognizer;
    ChordInfo mLatestChord;
    int mSplitPoint;

    // Estado del secuenciador
    bool mStylePlaying;
    bool mAccompanimentOn;
    bool mSyncStartArmed;
    int mBpm;
    int mStylePpq;
    int mCurrentBeat;
    double mCurrentTick;   // posición dentro de la sección actual
    double mGlobalTick;    // ticks desde START (rejilla de compases, independiente de la sección)
    size_t mEventCursor;
    std::string mCurrentSection;
    std::string mQueuedSection;
    std::string mLastMainSection;
    std::unordered_map<std::string, NativeStyleSectionData> mStyleSections;
    std::vector<ActiveStyleNote> mActiveStyleNotes;
    int mStyleChannelProgram[16];
};

#endif // SYNTHENGINE_H
