#ifndef SYNTHENGINE_H
#define SYNTHENGINE_H

#include <string>
#include <vector>
#include <unordered_map>
#include <mutex>
#include <android/log.h>
#include <android/asset_manager.h>
#include "ChordRecognizer.h"
#include "BiquadFilter.h"
#include "AdsrEnvelope.h"
#include "AudioStream.h"
#include "tsf.h"

#define LOG_TAG "SynthEngine"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)
#define LOGD(...) __android_log_print(ANDROID_LOG_DEBUG, LOG_TAG, __VA_ARGS__)

struct PlayingNoteInfo {
    int transposedNote;
    int presetIndex;
};

// Estructura de Capa / Fader (F1..F4) con Efectos y Octava Propios
struct LayerStem {
    std::string voiceName = "Yamaha CFX Grand";
    std::string fontPath = "";
    int presetIndex = 0;      // 0..127 General MIDI Preset
    float volume = 0.8f;      // 0.0 .. 1.0
    bool mute = false;
    bool solo = false;
    int octave = 0;           // -3 .. +3 (Por Fader)
    
    // Parámetros DSP y Envolvente individuales
    float cutoff = 100.0f;    // 0..100%
    float resonance = 20.0f;  // 0..100%
    float attack = 0.0f;      // 0..100%
    float decay = 45.0f;      // 0..100%
    float sustain = 100.0f;   // 0..100%
    float release = 30.0f;    // 0..100%
    
    BiquadFilter filter;
    AdsrEnvelope adsr;
    tsf* tsfInstance = nullptr; // Instancia SoundFont dedicada independiente por fader
    bool isCustomFont = false;
    int activeNotes = 0;

    // Registro de notas activas para garantizar Note Off perfecto sin notas pegadas
    std::unordered_map<int, std::vector<PlayingNoteInfo>> activePlayingNotes;
};

// Estructura de Evento de Nota para el Secuenciador Nativo C++
struct NativeStyleEvent {
    int tick;
    int durationTicks;
    int channel; // 1..16
    int note;
    int velocity;
    int program;
    bool isDrum;
};

struct NativeStyleSectionData {
    int totalTicks = 1920;
    std::vector<NativeStyleEvent> events;
};

struct ActiveStyleNote {
    int channel;
    int note;
    double offTick;
};

class SynthEngine {
public:
    static SynthEngine& getInstance();

    bool initialize(AAssetManager* assetManager = nullptr);
    bool loadSoundFont(const std::string& assetPath);
    bool loadSoundFontFromAsset(AAssetManager* assetManager, const std::string& assetPath);

    // Control de Capas y Mezcla (F1..F4)
    void setLayerMix(int layerIndex, float volume, bool mute, bool solo);
    bool setLayerVoice(int layerIndex, const std::string& voiceName, int presetIndex, const std::string& fontPath);
    void setLayerOctave(int layerIndex, int octave);
    void setGlobalTranspose(int transpose);
    void setLayerParam(int layerIndex, const std::string& paramName, float value);

    // Medición de Niveles de Señal en Tiempo Real (VU Meters F1..F4)
    void getChannelLevels(float* outLevels);

    // Audición en solo de un sonido individual (Modal de Voces)
    void auditionVoice(int presetIndex, const std::string& fontPath, int note, int velocity);
    void auditionStop(int note);

    // Entrada de Teclado / Interpretación de Voces
    void noteOn(int note, int velocity);
    void noteOff(int note);
    void setParam(const std::string& paramName, float value);
    float getParam(const std::string& paramName) const;

    // Métodos de Control Rítmico de Estilos
    void styleNoteOn(int channel, int note, int velocity, int program);
    void styleNoteOff(int channel, int note);
    void setStyleMasterVolume(float volume);
    void styleAllNotesOff();

    // SECUENCIADOR NATIVO C++ DE PRECISIÓN DE MUESTRA (0.00ms JITTER)
    void clearStyleData();
    void setStylePpq(int ppq);
    void loadStyleSectionEvents(const std::string& sectionName, int totalTicks, const std::string& eventsData);
    void startStylePlayback(int bpm, bool accompanimentOn);
    void stopStylePlayback();
    void setStyleAccompaniment(bool enabled);
    void setStyleBpm(int bpm);
    void setStyleSection(const std::string& section);
    void queueNextStyleSection(const std::string& section);
    
    // Estado del Secuenciador en Tiempo Real
    bool isStylePlaying() const { return mStylePlaying; }
    int getCurrentBeat() const { return mCurrentBeat; }
    std::string getCurrentSection() const { return mCurrentSection; }
    std::string getQueuedSection() const { return mQueuedSection; }

    // Métodos MIDI Extendidos
    void controlChange(int channel, int cc, int value);
    void programChange(int channel, int program);
    void pitchBend(int channel, int pitch);

    // Motor de Acordes
    std::string getDetectedChord();
    void setSplitPoint(int note);
    int getSplitPoint() const { return mSplitPoint; }
    
    void setBpm(int bpm);
    int getBpm() const { return mBpm; }

    bool isInitialized() const { return mInitialized; }

private:
    SynthEngine();
    ~SynthEngine();

    SynthEngine(const SynthEngine&) = delete;
    SynthEngine& operator=(const SynthEngine&) = delete;

    void renderAudioCallback(float* buffer, int numFrames);
    void updateChannelPresetsAndVolumes();
    int transposeHarmonicallyNative(int baseNote, const ChordInfo& chord);

    bool mInitialized;
    mutable std::recursive_mutex mEngineMutex;
    std::unordered_map<std::string, float> mParameters;

    AAssetManager* mAssetManager;
    tsf* mDefaultTsf;
    tsf* mStyleTsf;
    tsf* mAuditionTsf;

    // 4 Capas Faders (F1, F2, F3, F4)
    LayerStem mLayers[4];
    float mChannelPeaks[4];

    // Volumen Maestro del Acompañamiento Rítmico .STY
    float mStyleMasterVolume;

    // Transposición global (Aplica a todos los faders)
    int mGlobalTranspose = 0;

    // Motor Audio Native AAudio Stream
    AudioStream mAudioStream;

    // Filtro Master DSP
    BiquadFilter mMasterFilter;

    // Reconocimiento de acordes
    ChordRecognizer mLeftHandChordRecognizer;
    ChordInfo mLatestChord;
    int mSplitPoint; // Punto de división de teclado (por defecto: 60 = C4)

    // Estado del Secuenciador Nativo C++
    bool mStylePlaying;
    bool mAccompanimentOn;
    int mBpm;
    int mStylePpq;
    int mCurrentBeat; // 1, 2, 3, 4
    double mCurrentTick;
    std::string mCurrentSection;
    std::string mQueuedSection;
    std::unordered_map<std::string, NativeStyleSectionData> mStyleSections;
    std::vector<ActiveStyleNote> mActiveStyleNotes;
};

#endif // SYNTHENGINE_H
