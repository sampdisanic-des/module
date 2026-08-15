#define TSF_IMPLEMENTATION
#include "SynthEngine.h"
#include <algorithm>
#include <cmath>
#include <vector>
#include <cstring>
#include <cstdio>

static std::string cleanFilePath(const std::string& path) {
    if (path.empty()) return "";
    std::string clean = path;
    if (clean.rfind("file://", 0) == 0) {
        clean = clean.substr(7);
    }
    return clean;
}

// Limitador y Saturador Suave Analógico de Alta Fidelidad (Cero Distorsión Digital)
static inline float cleanSoftLimit(float x) {
    if (x > 3.0f) return 1.0f;
    if (x < -3.0f) return -1.0f;
    // Curva de compresión analógica suave con saturación gradual hiperbólica
    return tanhf(x * 0.90f);
}

SynthEngine& SynthEngine::getInstance() {
    static SynthEngine instance;
    return instance;
}

SynthEngine::SynthEngine()
    : mInitialized(false),
      mAssetManager(nullptr),
      mDefaultTsf(nullptr),
      mStyleTsf(nullptr),
      mAuditionTsf(nullptr),
      mStyleMasterVolume(0.85f),
      mGlobalTranspose(0),
      mSplitPoint(60), // C4 por defecto
      mStylePlaying(false),
      mAccompanimentOn(false),
      mBpm(105),
      mStylePpq(480),
      mCurrentBeat(1),
      mCurrentTick(0.0),
      mCurrentSection("MAIN_A") {
    LOGI("SynthEngine instanciado en C++ con Sonido de Alta Fidelidad y Efectos por Fader");

    mParameters["cutoff"] = 100.0f;    // 100% abierto por defecto
    mParameters["resonance"] = 20.0f;  // Escala UI (0..100)
    mParameters["volume"] = 0.90f;
    mParameters["attack"] = 0.0f;
    mParameters["decay"] = 45.0f;
    mParameters["sustain"] = 100.0f;
    mParameters["release"] = 30.0f;
    mParameters["modulation"] = 0.0f;

    // Configuración inicial de los 4 canales de faders
    mLayers[0].voiceName = "Yamaha CFX Grand";
    mLayers[0].presetIndex = 0; // Acoustic Grand Piano
    mLayers[0].volume = 0.80f;
    mLayers[0].octave = 0;

    mLayers[1].voiceName = "Ambient Pad Warm";
    mLayers[1].presetIndex = 89; // Warm Pad
    mLayers[1].volume = 0.65f;
    mLayers[1].octave = 0;

    mLayers[2].voiceName = "Syn Strings Symphony";
    mLayers[2].presetIndex = 48; // String Ensemble 1
    mLayers[2].volume = 0.50f;
    mLayers[2].octave = 0;

    mLayers[3].voiceName = "Synth Lead Moog Saw";
    mLayers[3].presetIndex = 81; // Lead 2 Sawtooth
    mLayers[3].volume = 0.75f;
    mLayers[3].octave = 0;

    for (int i = 0; i < 4; i++) {
        mChannelPeaks[i] = 0.0f;
        mLayers[i].filter.setCutoff(20000.0f);
        mLayers[i].filter.setResonance(1.0f);
        mLayers[i].adsr.setParameters(0.005f, 0.2f, 1.0f, 0.3f);
    }

    mMasterFilter.setCutoff(20000.0f);
    mMasterFilter.setResonance(1.0f);
}

SynthEngine::~SynthEngine() {
    mAudioStream.stop();
    for (int i = 0; i < 4; i++) {
        if (mLayers[i].tsfInstance) {
            tsf_close(mLayers[i].tsfInstance);
            mLayers[i].tsfInstance = nullptr;
        }
    }
    if (mStyleTsf) {
        tsf_close(mStyleTsf);
        mStyleTsf = nullptr;
    }
    if (mAuditionTsf) {
        tsf_close(mAuditionTsf);
        mAuditionTsf = nullptr;
    }
    if (mDefaultTsf) {
        tsf_close(mDefaultTsf);
        mDefaultTsf = nullptr;
    }
    LOGI("SynthEngine destruido");
}

bool SynthEngine::initialize(AAssetManager* assetManager) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    if (mInitialized) {
        return true;
    }

    LOGI("SynthEngine: Inicializando motor de audio AAudio y TinySoundFont GM...");

    mAssetManager = assetManager;

    if (assetManager) {
        loadSoundFontFromAsset(assetManager, "soundfonts/default.sf2");
    }

    // Iniciar stream nativo AAudio
    bool audioOk = mAudioStream.start([this](float* buffer, int numFrames) {
        renderAudioCallback(buffer, numFrames);
    }, 44100);

    if (audioOk) {
        float sr = mAudioStream.getSampleRate();
        mMasterFilter.setSampleRate(sr);
        for (int i = 0; i < 4; i++) {
            mLayers[i].filter.setSampleRate(sr);
            mLayers[i].adsr.setSampleRate(sr);
        }
    }

    mInitialized = true;
    LOGI("[OK] SynthEngine + AAudio Streaming + TinySoundFont GM inicializados!");
    return true;
}

bool SynthEngine::loadSoundFont(const std::string& fontPath) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    std::string clean = cleanFilePath(fontPath);
    
    if (!clean.empty() && clean[0] == '/') {
        tsf* newTsf = tsf_load_filename(clean.c_str());
        if (newTsf) {
            if (mDefaultTsf) tsf_close(mDefaultTsf);
            mDefaultTsf = newTsf;
            tsf_set_output(mDefaultTsf, TSF_STEREO_INTERLEAVED, 44100, -4.5f);
            updateChannelPresetsAndVolumes();
            LOGI("[OK] SoundFont SF2 cargado desde almacenamiento local: %s", clean.c_str());
            return true;
        } else {
            LOGE("Error al cargar SoundFont desde ruta local: %s", clean.c_str());
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
        LOGE("No se pudo abrir asset de SoundFont: %s", assetPath.c_str());
        return false;
    }

    off_t size = AAsset_getLength(asset);
    if (size <= 0) {
        AAsset_close(asset);
        LOGE("Asset de SoundFont vacio: %s", assetPath.c_str());
        return false;
    }

    std::vector<char> buffer(size);
    int bytesRead = AAsset_read(asset, buffer.data(), size);
    AAsset_close(asset);

    if (bytesRead > 0) {
        tsf* newTsf = tsf_load_memory(buffer.data(), bytesRead);
        if (newTsf) {
            if (mDefaultTsf) tsf_close(mDefaultTsf);
            mDefaultTsf = newTsf;
            tsf_set_output(mDefaultTsf, TSF_STEREO_INTERLEAVED, 44100, -4.5f);
            int pCount = tsf_get_presetcount(mDefaultTsf);
            LOGI("[OK] SoundFont SF2 GM cargado exitosamente: %s (%d bytes, %d presets disponibles)",
                 assetPath.c_str(), bytesRead, pCount);
            updateChannelPresetsAndVolumes();
            return true;
        } else {
            LOGE("Error al parsear estructura SoundFont desde memoria: %s", assetPath.c_str());
        }
    }

    return false;
}

void SynthEngine::updateChannelPresetsAndVolumes() {
    if (!mDefaultTsf) return;

    for (int l = 0; l < 4; l++) {
        if (!mLayers[l].isCustomFont) {
            if (mLayers[l].tsfInstance) {
                tsf_close(mLayers[l].tsfInstance);
                mLayers[l].tsfInstance = nullptr;
            }
            mLayers[l].tsfInstance = tsf_copy(mDefaultTsf);
            if (mLayers[l].tsfInstance) {
                tsf_set_output(mLayers[l].tsfInstance, TSF_STEREO_INTERLEAVED, 44100, -4.5f);
            }
        }
    }

    if (mStyleTsf) {
        tsf_close(mStyleTsf);
        mStyleTsf = nullptr;
    }
    mStyleTsf = tsf_copy(mDefaultTsf);
    if (mStyleTsf) {
        tsf_set_output(mStyleTsf, TSF_STEREO_INTERLEAVED, 44100, -4.5f);
    }

    if (mAuditionTsf) {
        tsf_close(mAuditionTsf);
        mAuditionTsf = nullptr;
    }
    mAuditionTsf = tsf_copy(mDefaultTsf);
    if (mAuditionTsf) {
        tsf_set_output(mAuditionTsf, TSF_STEREO_INTERLEAVED, 44100, -4.5f);
    }
}

void SynthEngine::setLayerMix(int layerIndex, float volume, bool mute, bool solo) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    if (layerIndex < 0 || layerIndex >= 4) return;

    mLayers[layerIndex].volume = std::max(0.0f, std::min(1.0f, volume));
    mLayers[layerIndex].mute = mute;
    mLayers[layerIndex].solo = solo;
}

bool SynthEngine::setLayerVoice(int layerIndex, const std::string& voiceName, int presetIndex, const std::string& fontPath) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    if (layerIndex < 0 || layerIndex >= 4) return false;

    // Si la voz, preset y ruta no han cambiado y ya tenemos una instancia válida, no recrear nada
    if (mLayers[layerIndex].voiceName == voiceName &&
        mLayers[layerIndex].presetIndex == presetIndex &&
        mLayers[layerIndex].fontPath == fontPath &&
        mLayers[layerIndex].tsfInstance != nullptr) {
        return true;
    }

    mLayers[layerIndex].voiceName = voiceName;
    mLayers[layerIndex].presetIndex = presetIndex >= 0 ? presetIndex : 0;
    mLayers[layerIndex].fontPath = fontPath;

    std::string clean = cleanFilePath(fontPath);

    if (!clean.empty() && clean[0] == '/') {
        if (mLayers[layerIndex].tsfInstance) {
            tsf_close(mLayers[layerIndex].tsfInstance);
            mLayers[layerIndex].tsfInstance = nullptr;
        }
        tsf* custom = tsf_load_filename(clean.c_str());
        if (custom) {
            tsf_set_output(custom, TSF_STEREO_INTERLEAVED, 44100, -4.5f);
            mLayers[layerIndex].tsfInstance = custom;
            mLayers[layerIndex].isCustomFont = true;
            LOGI("[setLayerVoice] Fader %d cargó SF2 personalizado: %s", layerIndex + 1, clean.c_str());
            return true;
        } else {
            mLayers[layerIndex].isCustomFont = false;
            LOGE("[setLayerVoice] Error cargando SF2 personalizado para Fader %d: %s", layerIndex + 1, clean.c_str());
            return false;
        }
    } else {
        if (mLayers[layerIndex].isCustomFont && mLayers[layerIndex].tsfInstance) {
            tsf_close(mLayers[layerIndex].tsfInstance);
            mLayers[layerIndex].tsfInstance = nullptr;
        }
        mLayers[layerIndex].isCustomFont = false;
        if (!mLayers[layerIndex].tsfInstance && mDefaultTsf) {
            mLayers[layerIndex].tsfInstance = tsf_copy(mDefaultTsf);
            if (mLayers[layerIndex].tsfInstance) {
                tsf_set_output(mLayers[layerIndex].tsfInstance, TSF_STEREO_INTERLEAVED, 44100, -4.5f);
            }
        }
        return true;
    }
}

void SynthEngine::setLayerOctave(int layerIndex, int octave) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    if (layerIndex >= 0 && layerIndex < 4) {
        mLayers[layerIndex].octave = std::max(-3, std::min(3, octave));
    }
}

void SynthEngine::setGlobalTranspose(int transpose) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    mGlobalTranspose = std::max(-12, std::min(12, transpose));
}

void SynthEngine::setLayerParam(int layerIndex, const std::string& paramName, float value) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    if (layerIndex < 0 || layerIndex >= 4) return;

    auto& layer = mLayers[layerIndex];
    if (paramName == "cutoff") {
        layer.cutoff = value;
        // Escala musical logarítmica / exponencial de 60 Hz a 20,000 Hz
        float norm = value / 100.0f;
        float cutoffHz = 60.0f * powf(20000.0f / 60.0f, norm);
        layer.filter.setCutoff(cutoffHz);
    } else if (paramName == "resonance") {
        layer.resonance = value;
        // Resonancia Q de 0.5 a 4.5
        float resVal = 0.5f + (value / 100.0f) * 4.0f;
        layer.filter.setResonance(resVal);
    } else if (paramName == "attack") {
        layer.attack = value;
    } else if (paramName == "decay") {
        layer.decay = value;
    } else if (paramName == "sustain") {
        layer.sustain = value;
    } else if (paramName == "release") {
        layer.release = value;
    }

    float aSec = (layer.attack / 100.0f) * 0.5f;
    float dSec = 0.05f + (layer.decay / 100.0f) * 4.95f;
    float sVal = layer.sustain / 100.0f;
    float rSec = 0.05f + (layer.release / 100.0f) * 4.95f;
    layer.adsr.setParameters(aSec, dSec, sVal, rSec);
}

void SynthEngine::getChannelLevels(float* outLevels) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    for (int i = 0; i < 4; i++) {
        outLevels[i] = mChannelPeaks[i];
    }
}

void SynthEngine::auditionVoice(int presetIndex, const std::string& fontPath, int note, int velocity) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    float normVel = velocity / 127.0f;

    std::string clean = cleanFilePath(fontPath);
    if (!clean.empty() && clean[0] == '/') {
        if (mAuditionTsf) {
            tsf_close(mAuditionTsf);
            mAuditionTsf = nullptr;
        }
        mAuditionTsf = tsf_load_filename(clean.c_str());
        if (mAuditionTsf) {
            tsf_set_output(mAuditionTsf, TSF_STEREO_INTERLEAVED, 44100, -4.5f);
            int pCount = tsf_get_presetcount(mAuditionTsf);
            int pIndex = (presetIndex >= 0 && presetIndex < pCount) ? presetIndex : 0;
            tsf_note_on(mAuditionTsf, pIndex, note, normVel);
            return;
        }
    }

    if (!mAuditionTsf && mDefaultTsf) {
        mAuditionTsf = tsf_copy(mDefaultTsf);
        if (mAuditionTsf) {
            tsf_set_output(mAuditionTsf, TSF_STEREO_INTERLEAVED, 44100, -4.5f);
        }
    }

    if (mAuditionTsf) {
        int pCount = tsf_get_presetcount(mAuditionTsf);
        int pIndex = (presetIndex >= 0 && presetIndex < pCount) ? presetIndex : 0;
        tsf_note_on(mAuditionTsf, pIndex, note, normVel);
    }
}

void SynthEngine::auditionStop(int note) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    if (mAuditionTsf) {
        tsf_note_off_all(mAuditionTsf);
    }
}

void SynthEngine::noteOn(int note, int velocity) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    
    if (velocity <= 0) {
        noteOff(note);
        return;
    }

    if (note < mSplitPoint) {
        mLeftHandChordRecognizer.addNote(note);
        mLatestChord = mLeftHandChordRecognizer.detectChord();
    }

    bool anySolo = false;
    for (int l = 0; l < 4; l++) {
        if (mLayers[l].solo) {
            anySolo = true;
            break;
        }
    }

    float normVel = velocity / 127.0f;

    for (int l = 0; l < 4; l++) {
        if (anySolo && !mLayers[l].solo) continue;
        if (mLayers[l].mute) continue;
        if (mLayers[l].volume <= 0.001f) continue;

        int layerTransposedNote = note + (mLayers[l].octave * 12) + mGlobalTranspose;
        if (layerTransposedNote < 0) layerTransposedNote = 0;
        if (layerTransposedNote > 127) layerTransposedNote = 127;

        mChannelPeaks[l] = std::max(mChannelPeaks[l], normVel * mLayers[l].volume);

        if (mLayers[l].tsfInstance) {
            int pCount = tsf_get_presetcount(mLayers[l].tsfInstance);
            int pIndex = (mLayers[l].presetIndex >= 0 && mLayers[l].presetIndex < pCount) ? mLayers[l].presetIndex : 0;
            
            // Guardar registro exacto de transposición para noteOff
            mLayers[l].activePlayingNotes[note].push_back({ layerTransposedNote, pIndex });
            tsf_note_on(mLayers[l].tsfInstance, pIndex, layerTransposedNote, normVel);
            
            mLayers[l].activeNotes++;
            mLayers[l].adsr.gateOn();
        }
    }
}

void SynthEngine::noteOff(int note) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    
    if (note < mSplitPoint) {
        mLeftHandChordRecognizer.removeNote(note);
        mLatestChord = mLeftHandChordRecognizer.detectChord();
    }

    for (int l = 0; l < 4; l++) {
        if (!mLayers[l].tsfInstance) continue;

        auto it = mLayers[l].activePlayingNotes.find(note);
        if (it != mLayers[l].activePlayingNotes.end() && !it->second.empty()) {
            for (const auto& noteInfo : it->second) {
                tsf_note_off(mLayers[l].tsfInstance, noteInfo.presetIndex, noteInfo.transposedNote);
            }
            mLayers[l].activePlayingNotes.erase(it);
        } else {
            // Fallback
            int layerTransposedNote = note + (mLayers[l].octave * 12) + mGlobalTranspose;
            if (layerTransposedNote < 0) layerTransposedNote = 0;
            if (layerTransposedNote > 127) layerTransposedNote = 127;
            int pCount = tsf_get_presetcount(mLayers[l].tsfInstance);
            int pIndex = (mLayers[l].presetIndex >= 0 && mLayers[l].presetIndex < pCount) ? mLayers[l].presetIndex : 0;
            tsf_note_off(mLayers[l].tsfInstance, pIndex, layerTransposedNote);
        }

        mLayers[l].activeNotes = std::max(0, mLayers[l].activeNotes - 1);
        if (mLayers[l].activeNotes <= 0) {
            mLayers[l].activeNotes = 0;
            mLayers[l].adsr.gateOff();
        }
    }
}

// -------------------------------------------------------------
// SECUENCIADOR NATIVO C++ DE ESTILOS (.STY) A 0.00ms JITTER
// -------------------------------------------------------------
void SynthEngine::clearStyleData() {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    mStyleSections.clear();
    mActiveStyleNotes.clear();
    mCurrentTick = 0.0;
    mCurrentBeat = 1;
    LOGI("[Sequencer C++] Datos de estilo reiniciados");
}

void SynthEngine::setStylePpq(int ppq) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    if (ppq > 0) {
        mStylePpq = ppq;
        LOGI("[Sequencer C++] PPQ actualizado a %d", mStylePpq);
    }
}

void SynthEngine::loadStyleSectionEvents(const std::string& sectionName, int totalTicks, const std::string& eventsData) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    NativeStyleSectionData sec;
    sec.totalTicks = totalTicks > 0 ? totalTicks : 1920;

    if (!eventsData.empty()) {
        const char* p = eventsData.c_str();
        while (*p) {
            int tick = 0, dur = 0, ch = 0, note = 0, vel = 0, prg = -1, isDrumInt = 0;
            if (sscanf(p, "%d,%d,%d,%d,%d,%d,%d", &tick, &dur, &ch, &note, &vel, &prg, &isDrumInt) >= 5) {
                sec.events.push_back({ tick, dur, ch, note, vel, prg, isDrumInt != 0 });
            }
            const char* next = strchr(p, ';');
            if (!next) break;
            p = next + 1;
        }
    }
    mStyleSections[sectionName] = std::move(sec);
    LOGI("[Sequencer C++] Seccion %s cargada con %zu eventos (totalTicks: %d, ppq: %d)",
         sectionName.c_str(), mStyleSections[sectionName].events.size(), totalTicks, mStylePpq);
}

void SynthEngine::startStylePlayback(int bpm, bool accompanimentOn) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    mBpm = bpm > 0 ? bpm : 105;
    mAccompanimentOn = accompanimentOn;
    mCurrentTick = 0.0;
    mCurrentBeat = 1;
    mActiveStyleNotes.clear();
    mStylePlaying = true;
    LOGI("[Sequencer C++] Reproducción iniciada a %d BPM (PPQ: %d) | ACMP: %s", mBpm, mStylePpq, accompanimentOn ? "ON" : "OFF");
}

void SynthEngine::stopStylePlayback() {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    mStylePlaying = false;
    mCurrentTick = 0.0;
    mCurrentBeat = 1;
    mActiveStyleNotes.clear();
    styleAllNotesOff();
    LOGI("[Sequencer C++] Reproducción detenida");
}

void SynthEngine::setStyleAccompaniment(bool enabled) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    mAccompanimentOn = enabled;
    LOGI("[Sequencer C++] Acompañamiento ACMP: %s", enabled ? "ACTIVADO" : "DESACTIVADO");
}

void SynthEngine::setStyleBpm(int bpm) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    if (bpm > 30 && bpm < 300) {
        mBpm = bpm;
    }
}

void SynthEngine::setStyleSection(const std::string& section) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    mCurrentSection = section;
    mCurrentTick = 0.0;
    mCurrentBeat = 1;
    mActiveStyleNotes.clear();
    styleAllNotesOff();
}

void SynthEngine::queueNextStyleSection(const std::string& section) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    mQueuedSection = section;
}

// -------------------------------------------------------------
// MOTOR DE ARMONIZACIÓN EN TIEMPO REAL (YAMAHA STYLE ENGINE)
// -------------------------------------------------------------
int SynthEngine::transposeHarmonicallyNative(int baseNote, const ChordInfo& chord) {
    if (chord.name.empty() || chord.name == "---") {
        return baseNote;
    }

    int basePitchClass = baseNote % 12;
    int baseOctave = baseNote / 12;
    int chordRoot = chord.rootPitchClass;

    int interval = (basePitchClass - chordRoot + 12) % 12;
    int mappedInterval = interval;

    if (chord.type == "m" || chord.type == "m7") {
        if (interval == 4) mappedInterval = 3;  // 3ra mayor -> 3ra menor
        if (interval == 11 && chord.type == "m") mappedInterval = 10;
    } else if (chord.type == "7") {
        if (interval == 11) mappedInterval = 10; // 7ma mayor -> 7ma dominante
    } else if (chord.type == "dim") {
        if (interval == 4) mappedInterval = 3;
        if (interval == 7) mappedInterval = 6;
    } else if (chord.type == "aug") {
        if (interval == 7) mappedInterval = 8;
    } else if (chord.type == "sus4") {
        if (interval == 4) mappedInterval = 5;
    }

    int transposedNote = (baseOctave * 12) + chordRoot + mappedInterval;
    while (transposedNote < 24) transposedNote += 12;
    while (transposedNote > 108) transposedNote -= 12;

    return transposedNote;
}

void SynthEngine::styleNoteOn(int channel, int note, int velocity, int program) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    if (!mStyleTsf) return;
    if (program >= 0) {
        tsf_channel_set_presetnumber(mStyleTsf, channel, program, (channel == 9 || channel == 10) ? 1 : 0);
    }
    float normVel = velocity / 127.0f;
    tsf_channel_note_on(mStyleTsf, channel, note, normVel);
}

void SynthEngine::styleNoteOff(int channel, int note) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    if (!mStyleTsf) return;
    tsf_channel_note_off(mStyleTsf, channel, note);
}

void SynthEngine::setStyleMasterVolume(float volume) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    mStyleMasterVolume = std::max(0.0f, std::min(1.0f, volume));
}

void SynthEngine::styleAllNotesOff() {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    if (!mStyleTsf) return;
    for (int ch = 0; ch < 16; ch++) {
        tsf_channel_note_off_all(mStyleTsf, ch);
    }
}

void SynthEngine::setParam(const std::string& paramName, float value) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    mParameters[paramName] = value;

    if (paramName == "cutoff") {
        float norm = value / 100.0f;
        float cutoffHz = 60.0f * powf(20000.0f / 60.0f, norm);
        mMasterFilter.setCutoff(cutoffHz);
    } else if (paramName == "resonance") {
        float resVal = 0.5f + (value / 100.0f) * 4.0f;
        mMasterFilter.setResonance(resVal);
    }
}

float SynthEngine::getParam(const std::string& paramName) const {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    auto it = mParameters.find(paramName);
    if (it != mParameters.end()) {
        return it->second;
    }
    return 0.0f;
}

void SynthEngine::controlChange(int channel, int cc, int value) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    if (cc == 7) {
        mParameters["volume"] = value / 127.0f;
    } else if (cc == 74) {
        float cutoffHz = 60.0f * powf(20000.0f / 60.0f, value / 127.0f);
        mMasterFilter.setCutoff(cutoffHz);
    } else if (cc == 1) {
        mParameters["modulation"] = (value / 127.0f) * 100.0f;
    } else if (cc == 64) {
        bool sustainOn = (value >= 64);
        mParameters["sustain_pedal"] = sustainOn ? 1.0f : 0.0f;
        for (int l = 0; l < 4; l++) {
            if (mLayers[l].tsfInstance) {
                tsf_channel_set_sustain(mLayers[l].tsfInstance, 0, sustainOn ? 1 : 0);
            }
        }
    }
}

void SynthEngine::programChange(int channel, int program) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    if (channel >= 0 && channel < 4) {
        mLayers[channel].presetIndex = program;
    }
}

void SynthEngine::pitchBend(int channel, int pitch) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    if (channel >= 0 && channel < 4 && mLayers[channel].tsfInstance) {
        tsf_channel_set_pitchwheel(mLayers[channel].tsfInstance, 0, pitch);
    }
}

std::string SynthEngine::getDetectedChord() {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    ChordInfo chord = mLeftHandChordRecognizer.detectChord();
    return chord.name;
}

void SynthEngine::setSplitPoint(int note) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    mSplitPoint = note;
    mLeftHandChordRecognizer.clearNotes();
    mLatestChord = ChordInfo();
}

void SynthEngine::setBpm(int bpm) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    mBpm = bpm;
}

// -------------------------------------------------------------
// CALLBACK DE AUDIO DE TIEMPO REAL NATIVO AAUDIO
// -------------------------------------------------------------
void SynthEngine::renderAudioCallback(float* buffer, int numFrames) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    
    memset(buffer, 0, sizeof(float) * numFrames * 2);

    // 0. Procesar el Secuenciador Nativo C++ si el ritmo está activo
    if (mStylePlaying && !mStyleSections.empty()) {
        auto it = mStyleSections.find(mCurrentSection);
        if (it == mStyleSections.end()) {
            it = mStyleSections.find("MAIN_A");
        }

        if (it != mStyleSections.end()) {
            const auto& secData = it->second;
            double ticksPerSample = (double)(mBpm * mStylePpq) / (60.0 * 44100.0);
            double startTick = mCurrentTick;
            double endTick = startTick + (ticksPerSample * (double)numFrames);

            int beatIndex = (int)(mCurrentTick / (double)mStylePpq);
            mCurrentBeat = (beatIndex % 4) + 1;

            // Apagar notas expiradas
            for (auto noteIt = mActiveStyleNotes.begin(); noteIt != mActiveStyleNotes.end(); ) {
                if (endTick >= noteIt->offTick) {
                    styleNoteOff(noteIt->channel, noteIt->note);
                    noteIt = mActiveStyleNotes.erase(noteIt);
                } else {
                    ++noteIt;
                }
            }

            // Disparar notas dentro del bloque de frames
            for (const auto& evt : secData.events) {
                if (evt.tick >= startTick && evt.tick < endTick) {
                    bool isDrum = evt.isDrum || evt.channel == 9 || evt.channel == 10;
                    if (!mAccompanimentOn && !isDrum) continue;

                    int noteToPlay = evt.note;
                    if (!isDrum) {
                        noteToPlay = transposeHarmonicallyNative(evt.note, mLatestChord);
                    }
                    styleNoteOn(evt.channel, noteToPlay, evt.velocity, evt.program);
                    mActiveStyleNotes.push_back({ evt.channel, noteToPlay, (double)(evt.tick + evt.durationTicks) });
                }
            }

            mCurrentTick = endTick;

            // Al completar el ciclo de compases de la sección
            if (mCurrentTick >= (double)secData.totalTicks) {
                mCurrentTick = 0.0;
                mCurrentBeat = 1;
                if (!mQueuedSection.empty()) {
                    mCurrentSection = mQueuedSection;
                    mQueuedSection.clear();
                } else if (mCurrentSection.rfind("INTRO_", 0) == 0) {
                    mCurrentSection = "MAIN_A";
                } else if (mCurrentSection.rfind("FILL_", 0) == 0) {
                    std::string var = mCurrentSection.substr(5);
                    mCurrentSection = "MAIN_" + var;
                } else if (mCurrentSection.rfind("ENDING_", 0) == 0) {
                    mStylePlaying = false;
                    mCurrentSection = "MAIN_A";
                    mCurrentTick = 0.0;
                    mCurrentBeat = 1;
                    styleAllNotesOff();
                }
            }
        }
    }

    // 1. Renderizar ritmo de estilo en mStyleTsf
    if (mStyleTsf && mStylePlaying) {
        float styleBuf[numFrames * 2];
        memset(styleBuf, 0, sizeof(float) * numFrames * 2);
        tsf_render_float(mStyleTsf, styleBuf, numFrames, 0);
        float styleVol = mStyleMasterVolume;
        for (int i = 0; i < numFrames * 2; i++) {
            buffer[i] += styleBuf[i] * styleVol;
        }
    }

    // 2. Renderizar cada capa de Fader (F1..F4) de forma totalmente independiente
    bool anySolo = false;
    for (int l = 0; l < 4; l++) {
        if (mLayers[l].solo) {
            anySolo = true;
            break;
        }
    }

    float layerBuf[numFrames * 2];
    for (int l = 0; l < 4; l++) {
        auto& layer = mLayers[l];
        if (!layer.tsfInstance) continue;

        float effectiveVol = layer.volume;
        if (anySolo && !layer.solo) effectiveVol = 0.0f;
        if (layer.mute) effectiveVol = 0.0f;

        memset(layerBuf, 0, sizeof(float) * numFrames * 2);
        tsf_render_float(layer.tsfInstance, layerBuf, numFrames, 0);

        if (effectiveVol > 0.0001f) {
            for (int i = 0; i < numFrames; i++) {
                float left = layerBuf[i * 2 + 0];
                float right = layerBuf[i * 2 + 1];

                // Filtro individual (Cutoff y Resonancia) por capa
                layer.filter.processStereo(&left, &right);

                // Envolvente ADSR individual por capa
                float env = layer.adsr.getNextSample();
                left *= effectiveVol * env;
                right *= effectiveVol * env;

                buffer[i * 2 + 0] += left;
                buffer[i * 2 + 1] += right;
            }
        }
    }

    // 3. Renderizar SF2 de audición individual si está activo
    if (mAuditionTsf) {
        tsf_render_float(mAuditionTsf, buffer, numFrames, 1);
    }

    // 4. Decaimiento balístico natural del VU Meter exclusivo de cada capa tocada
    for (int l = 0; l < 4; l++) {
        if (mLayers[l].mute || (anySolo && !mLayers[l].solo) || mLayers[l].volume <= 0.001f) {
            mChannelPeaks[l] = 0.0f;
        } else {
            mChannelPeaks[l] *= 0.93f;
            if (mChannelPeaks[l] < 0.005f) mChannelPeaks[l] = 0.0f;
        }
    }

    // 5. Procesamiento Master de Alta Fidelidad: Modulación, Filtro Master y Limitador Suave
    float masterVol = mParameters["volume"];
    float modVal = mParameters["modulation"] / 100.0f; // 0.0 .. 1.0

    // Modulación LFO suave (~5.5 Hz) si modVal > 0
    static float lfoPhase = 0.0f;
    float lfoStep = 2.0f * 3.14159265f * 5.5f / 44100.0f;

    for (int i = 0; i < numFrames; i++) {
        float left = buffer[i * 2 + 0];
        float right = buffer[i * 2 + 1];

        if (modVal > 0.01f) {
            float lfo = sinf(lfoPhase) * 0.15f * modVal;
            left *= (1.0f + lfo);
            right *= (1.0f + lfo);
            lfoPhase += lfoStep;
            if (lfoPhase > 2.0f * 3.14159265f) lfoPhase -= 2.0f * 3.14159265f;
        }

        // Filtro master
        mMasterFilter.processStereo(&left, &right);

        // Limitador analógico suave sin saturación digital
        float outL = cleanSoftLimit(left * masterVol);
        float outR = cleanSoftLimit(right * masterVol);

        buffer[i * 2 + 0] = outL;
        buffer[i * 2 + 1] = outR;
    }
}
