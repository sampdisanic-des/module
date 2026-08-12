#include "SynthEngine.h"

SynthEngine& SynthEngine::getInstance() {
    static SynthEngine instance;
    return instance;
}

SynthEngine::SynthEngine()
    : mInitialized(false),
      mSplitPoint(60), // C4 por defecto como split point
      mBpm(120),
      mCurrentSection("MAIN_A") {
    LOGI("SynthEngine instanciado en C++ (Arranger Enabled)");
    mParameters["cutoff"] = 1000.0f;
    mParameters["resonance"] = 1.0f;
    mParameters["volume"] = 0.8f;
    mParameters["reverb"] = 0.2f;
}

SynthEngine::~SynthEngine() {
    LOGI("SynthEngine destruido");
}

bool SynthEngine::initialize() {
    std::lock_guard<std::mutex> lock(mEngineMutex);
    if (mInitialized) {
        return true;
    }

    LOGI("SynthEngine Fase 2: Inicializando motor de síntesis y reconocedor de acordes...");
    mInitialized = true;
    LOGI("[OK] SynthEngine + Arranger + MIDI activados en C++!");
    return true;
}

void SynthEngine::noteOn(int note, int velocity) {
    std::lock_guard<std::mutex> lock(mEngineMutex);
    
    // Si la nota está por debajo del Split Point, se envía al reconocedor de acordes de la mano izquierda
    if (note < mSplitPoint) {
        mLeftHandChordRecognizer.addNote(note);
        ChordInfo chord = mLeftHandChordRecognizer.detectChord();
        LOGI("[ARRANGER C++] Acorde Mano Izquierda: %s (Nota: %d)", chord.name.c_str(), note);
    } else {
        LOGI("[SYNTH C++] Solo Mano Derecha | Note: %d | Vel: %d", note, velocity);
    }
}

void SynthEngine::noteOff(int note) {
    std::lock_guard<std::mutex> lock(mEngineMutex);
    
    if (note < mSplitPoint) {
        mLeftHandChordRecognizer.removeNote(note);
    }
    LOGI("[JSI -> C++] NoteOFF | Note: %d", note);
}

void SynthEngine::setParam(const std::string& paramName, float value) {
    std::lock_guard<std::mutex> lock(mEngineMutex);
    mParameters[paramName] = value;
    LOGI("[JSI -> C++] setParam | %s = %.2f", paramName.c_str(), value);
}

float SynthEngine::getParam(const std::string& paramName) const {
    std::lock_guard<std::mutex> lock(mEngineMutex);
    auto it = mParameters.find(paramName);
    if (it != mParameters.end()) {
        return it->second;
    }
    return 0.0f;
}

void SynthEngine::controlChange(int channel, int cc, int value) {
    std::lock_guard<std::mutex> lock(mEngineMutex);
    LOGI("[MIDI CC C++] Ch: %d | CC: %d | Val: %d", channel, cc, value);
    
    // Asignación rápida de controles MIDI del Yamaha PSR-E463 / Mvave
    if (cc == 7) { // Volume CC
        mParameters["volume"] = value / 127.0f;
    } else if (cc == 74) { // Brightness / Cutoff
        mParameters["cutoff"] = 100.0f + (value / 127.0f) * 11900.0f;
    }
}

void SynthEngine::programChange(int channel, int program) {
    std::lock_guard<std::mutex> lock(mEngineMutex);
    LOGI("[MIDI ProgramChange C++] Ch: %d | Program: %d", channel, program);
}

std::string SynthEngine::getDetectedChord() {
    std::lock_guard<std::mutex> lock(mEngineMutex);
    ChordInfo chord = mLeftHandChordRecognizer.detectChord();
    return chord.name;
}

void SynthEngine::setSplitPoint(int note) {
    std::lock_guard<std::mutex> lock(mEngineMutex);
    mSplitPoint = note;
    mLeftHandChordRecognizer.clearNotes();
    LOGI("[ARRANGER C++] Split Point actualizado a nota: %d", note);
}

void SynthEngine::setBpm(int bpm) {
    std::lock_guard<std::mutex> lock(mEngineMutex);
    mBpm = bpm;
    LOGI("[ARRANGER C++] Tempo BPM: %d", bpm);
}

void SynthEngine::setStyleSection(const std::string& section) {
    std::lock_guard<std::mutex> lock(mEngineMutex);
    mCurrentSection = section;
    LOGI("[ARRANGER C++] Sección de Estilo cambiada a: %s", section.c_str());
}
