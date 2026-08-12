#define TSF_IMPLEMENTATION
#include "SynthEngine.h"

SynthEngine& SynthEngine::getInstance() {
    static SynthEngine instance;
    return instance;
}

SynthEngine::SynthEngine()
    : mInitialized(false),
      mTsfInstance(nullptr),
      mSplitPoint(60), // C4 por defecto
      mBpm(120),
      mCurrentSection("MAIN_A") {
    LOGI("SynthEngine instanciado en C++ (AAudio + TSF + Biquad Filter + ADSR Enabled)");
    mParameters["cutoff"] = 2500.0f;
    mParameters["resonance"] = 1.2f;
    mParameters["volume"] = 0.8f;
    mParameters["attack"] = 0.02f;
    mParameters["decay"] = 0.2f;
    mParameters["sustain"] = 0.85f;
    mParameters["release"] = 0.3f;

    mFilter.setCutoff(2500.0f);
    mFilter.setResonance(1.2f);
    mGlobalAdsr.setParameters(0.02f, 0.2f, 0.85f, 0.3f);
}

SynthEngine::~SynthEngine() {
    mAudioStream.stop();
    if (mTsfInstance) {
        tsf_close(mTsfInstance);
        mTsfInstance = nullptr;
    }
    LOGI("SynthEngine destruido");
}

bool SynthEngine::initialize(AAssetManager* assetManager) {
    std::lock_guard<std::mutex> lock(mEngineMutex);
    if (mInitialized) {
        return true;
    }

    LOGI("SynthEngine Fase 1: Inicializando motor de audio AAudio y TinySoundFont...");

    mAssetManager = assetManager;

    // Intentar cargar SoundFont por defecto si se pasa AAssetManager
    if (assetManager) {
        loadSoundFontFromAsset(assetManager, "soundfonts/default.sf2");
    }

    if (!mTsfInstance) {
        // Fallback a motor sintético incorporado
        mTsfInstance = tsf_load_memory(nullptr, 0);
        if (mTsfInstance) {
            tsf_set_output(mTsfInstance, TSF_STEREO_INTERLEAVED, 44100, 0.0f);
            LOGI("[OK] Motor sintético incorporado inicializado a 44100 Hz");
        }
    }

    // Iniciar stream nativo AAudio
    bool audioOk = mAudioStream.start([this](float* buffer, int numFrames) {
        renderAudioCallback(buffer, numFrames);
    }, 44100);

    if (audioOk) {
        mFilter.setSampleRate(mAudioStream.getSampleRate());
        mGlobalAdsr.setSampleRate(mAudioStream.getSampleRate());
    }

    mInitialized = true;
    LOGI("[OK] SynthEngine + AAudio Streaming + TSF + Arranger activados en C++!");
    return true;
}

bool SynthEngine::loadSoundFont(const std::string& fontPath) {
    std::lock_guard<std::mutex> lock(mEngineMutex);
    
    // Carga desde la memoria del dispositivo (ruta absoluta)
    if (!fontPath.empty() && fontPath[0] == '/') {
        tsf* newTsf = tsf_load_filename(fontPath.c_str());
        if (newTsf) {
            if (mTsfInstance) tsf_close(mTsfInstance);
            mTsfInstance = newTsf;
            tsf_set_output(mTsfInstance, TSF_STEREO_INTERLEAVED, 44100, 0.0f);
            LOGI("[OK] SoundFont SF2 cargado desde almacenamiento local: %s", fontPath.c_str());
            return true;
        } else {
            LOGE("Error al cargar SoundFont desde ruta local: %s", fontPath.c_str());
            return false;
        }
    }

    if (!mAssetManager) {
        LOGE("mAssetManager es nulo. No se puede cargar el SoundFont %s", fontPath.c_str());
        return false;
    }
    return loadSoundFontFromAsset(mAssetManager, fontPath);
}

bool SynthEngine::loadSoundFontFromAsset(AAssetManager* assetManager, const std::string& assetPath) {
    if (!assetManager) return false;

    AAsset* asset = AAssetManager_open(assetManager, assetPath.c_str(), AASSET_MODE_BUFFER);
    if (!asset) {
        LOGE("No se pudo abrir asset de SoundFont: %s (se utilizará motor sintético incorporado)", assetPath.c_str());
        return false;
    }

    off_t size = AAsset_getLength(asset);
    const void* buffer = AAsset_getBuffer(asset);

    if (buffer && size > 0) {
        tsf* newTsf = tsf_load_memory(buffer, (int)size);
        if (newTsf) {
            if (mTsfInstance) tsf_close(mTsfInstance);
            mTsfInstance = newTsf;
            tsf_set_output(mTsfInstance, TSF_STEREO_INTERLEAVED, 44100, 0.0f);
            LOGI("[OK] SoundFont SF2 cargado exitosamente desde asset: %s (%ld bytes)", assetPath.c_str(), (long)size);
            AAsset_close(asset);
            return true;
        }
    }

    AAsset_close(asset);
    LOGE("Error al procesar buffer de SoundFont asset: %s", assetPath.c_str());
    return false;
}

void SynthEngine::renderAudioCallback(float* buffer, int numFrames) {
    std::lock_guard<std::mutex> lock(mEngineMutex);
    if (!mTsfInstance) {
        memset(buffer, 0, sizeof(float) * numFrames * 2);
        return;
    }

    // 1. Renderizar TSF Float samples
    tsf_render_float(mTsfInstance, buffer, numFrames, 0);

    // 2. Procesar filtro Biquad (Cutoff / Resonance) y volumen máster sample a sample
    float volume = mParameters["volume"];
    for (int i = 0; i < numFrames; i++) {
        float adsrGain = mGlobalAdsr.getNextSample();
        float left = buffer[i * 2 + 0];
        float right = buffer[i * 2 + 1];

        // Filtro LPF en tiempo real
        mFilter.processStereo(&left, &right);

        // Ganancia de volumen y ADSR
        buffer[i * 2 + 0] = left * volume * adsrGain;
        buffer[i * 2 + 1] = right * volume * adsrGain;
    }
}

void SynthEngine::noteOn(int note, int velocity) {
    std::lock_guard<std::mutex> lock(mEngineMutex);
    
    if (note < mSplitPoint) {
        mLeftHandChordRecognizer.addNote(note);
        ChordInfo chord = mLeftHandChordRecognizer.detectChord();
        LOGI("[ARRANGER C++] Acorde Mano Izquierda: %s (Nota: %d)", chord.name.c_str(), note);
    } else {
        LOGI("[SYNTH C++] Solo Mano Derecha | Note: %d | Vel: %d", note, velocity);
    }

    if (mTsfInstance) {
        tsf_note_on(mTsfInstance, 0, note, velocity / 127.0f);
        mGlobalAdsr.gateOn();
    }
}

void SynthEngine::noteOff(int note) {
    std::lock_guard<std::mutex> lock(mEngineMutex);
    
    if (note < mSplitPoint) {
        mLeftHandChordRecognizer.removeNote(note);
    }

    if (mTsfInstance) {
        tsf_note_off(mTsfInstance, 0, note);
        mGlobalAdsr.gateOff();
    }
    LOGI("[SYNTH C++] NoteOFF | Note: %d", note);
}

void SynthEngine::setParam(const std::string& paramName, float value) {
    std::lock_guard<std::mutex> lock(mEngineMutex);
    mParameters[paramName] = value;

    if (paramName == "cutoff") {
        mFilter.setCutoff(value);
    } else if (paramName == "resonance") {
        mFilter.setResonance(value);
    } else if (paramName == "attack" || paramName == "decay" || paramName == "sustain" || paramName == "release") {
        mGlobalAdsr.setParameters(
            mParameters["attack"],
            mParameters["decay"],
            mParameters["sustain"],
            mParameters["release"]
        );
    }

    LOGI("[JNI -> C++] setParam | %s = %.2f", paramName.c_str(), value);
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
    
    if (cc == 7) { // Volume CC
        mParameters["volume"] = value / 127.0f;
    } else if (cc == 74) { // Brightness / Cutoff
        float cutoffHz = 100.0f + (value / 127.0f) * 11900.0f;
        mParameters["cutoff"] = cutoffHz;
        mFilter.setCutoff(cutoffHz);
    }
    if (mTsfInstance) {
        tsf_channel_set_control(mTsfInstance, channel, cc, value);
    }
}

void SynthEngine::programChange(int channel, int program) {
    std::lock_guard<std::mutex> lock(mEngineMutex);
    LOGI("[MIDI ProgramChange C++] Ch: %d | Program: %d", channel, program);
    if (mTsfInstance) {
        tsf_channel_set_presetnumber(mTsfInstance, channel, program, 0);
    }
}

void SynthEngine::pitchBend(int channel, int pitch) {
    std::lock_guard<std::mutex> lock(mEngineMutex);
    LOGI("[MIDI PitchBend C++] Ch: %d | Pitch: %d", channel, pitch);
    if (mTsfInstance) {
        tsf_channel_set_pitchwheel(mTsfInstance, channel, pitch);
    }
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
