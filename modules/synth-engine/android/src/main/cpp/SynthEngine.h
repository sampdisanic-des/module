#ifndef SYNTHENGINE_H
#define SYNTHENGINE_H

#include <string>
#include <unordered_map>
#include <mutex>
#include <android/log.h>
#include "ChordRecognizer.h"

#define LOG_TAG "SynthEngine"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)
#define LOGD(...) __android_log_print(ANDROID_LOG_DEBUG, LOG_TAG, __VA_ARGS__)

class SynthEngine {
public:
    static SynthEngine& getInstance();

    bool initialize();
    void noteOn(int note, int velocity);
    void noteOff(int note);
    void setParam(const std::string& paramName, float value);
    float getParam(const std::string& paramName) const;

    // Métodos MIDI Extendidos
    void controlChange(int channel, int cc, int value);
    void programChange(int channel, int program);

    // Motor de Acompañamiento (Arranger / Styles)
    std::string getDetectedChord();
    void setSplitPoint(int note);
    int getSplitPoint() const { return mSplitPoint; }
    
    void setBpm(int bpm);
    int getBpm() const { return mBpm; }
    
    void setStyleSection(const std::string& section);
    std::string getStyleSection() const { return mCurrentSection; }

    bool isInitialized() const { return mInitialized; }

private:
    SynthEngine();
    ~SynthEngine();

    SynthEngine(const SynthEngine&) = delete;
    SynthEngine& operator=(const SynthEngine&) = delete;

    bool mInitialized;
    mutable std::mutex mEngineMutex;
    std::unordered_map<std::string, float> mParameters;

    // Arranger state
    ChordRecognizer mLeftHandChordRecognizer;
    int mSplitPoint; // Punto de división de teclado (por defecto: 60 = C4)
    int mBpm;
    std::string mCurrentSection; // "INTRO", "MAIN_A", "MAIN_B", "FILL_IN", "ENDING"
};

#endif // SYNTHENGINE_H
