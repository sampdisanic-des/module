#define TSF_IMPLEMENTATION
#include "SynthEngine.h"
#include <algorithm>
#include <cmath>
#include <vector>
#include <cstring>
#include <cstdio>
#include <cstdlib>

namespace {

constexpr int kMaxBlockFrames = 2048;   // tamaño de bloque interno (buffers preasignados)
constexpr int kSequencerChunk = 64;     // resolución temporal del secuenciador (~1.4 ms)
constexpr int kMaxVoicesPerFont = 128;  // voces preasignadas por instancia TSF
constexpr float kFontGainDb = -4.5f;    // headroom por instancia
constexpr int kLayerChannel = 0;        // canal TSF usado por cada capa
constexpr float kPi = 3.14159265358979f;

std::string cleanFilePath(const std::string& path) {
    if (path.rfind("file://", 0) == 0) return path.substr(7);
    return path;
}

bool isAbsolutePath(const std::string& p) { return !p.empty() && p[0] == '/'; }

// Limitador suave: transparente en niveles normales, evita clipping duro
inline float softLimit(float x) {
    if (x > 3.0f) return 1.0f;
    if (x < -3.0f) return -1.0f;
    return tanhf(x * 0.9f);
}

inline float clampf(float v, float lo, float hi) { return v < lo ? lo : (v > hi ? hi : v); }
inline int clampi(int v, int lo, int hi) { return v < lo ? lo : (v > hi ? hi : v); }

float cutoffPercentToHz(float v) {
    return 60.0f * powf(20000.0f / 60.0f, clampf(v, 0.0f, 100.0f) / 100.0f);
}

// 0 -> Q plano (0.707), 100 -> Q 6 (resonancia marcada)
float resonancePercentToQ(float v) {
    return 0.707f + (clampf(v, 0.0f, 100.0f) / 100.0f) * 5.3f;
}

bool isDrumChannel(int channel1Based) { return channel1Based == 9 || channel1Based == 10; }

// Busca el preset por número de programa GM; si no existe (SF2 personalizado
// con numeración propia) usa el valor como índice directo.
int resolvePresetIndex(tsf* f, int program, bool drums) {
    if (!f) return 0;
    int count = tsf_get_presetcount(f);
    if (count <= 0) return 0;
    int idx = tsf_get_presetindex(f, drums ? 128 : 0, program);
    if (idx < 0 && drums) idx = tsf_get_presetindex(f, 128, 0);
    if (idx < 0 && program >= 0 && program < count) idx = program;
    return idx < 0 ? 0 : idx;
}

// Mapea un intervalo del patrón fuente (escrito en CMaj7) al tipo de acorde destino.
// Devuelve semitonos desde la tónica (0..12).
int mapSourceInterval(int pc, const std::string& type) {
    bool minorThird = (type == "Min" || type == "m7" || type == "dim" || type == "m7b5");
    switch (pc) {
        case 4: // tercera
            if (minorThird) return 3;
            if (type == "sus4") return 5;
            if (type == "sus2") return 2;
            return 4;
        case 7: // quinta
            if (type == "dim" || type == "m7b5") return 6;
            if (type == "aug") return 8;
            return 7;
        case 11: // séptima
            if (type == "Maj7") return 11;
            if (type == "7" || type == "m7" || type == "m7b5") return 10;
            if (type == "dim") return 9;
            return 12; // triadas: la séptima mayor del patrón dobla la tónica
        case 3:
            return minorThird ? 3 : 4;
        default:
            return pc;
    }
}

} // namespace

// -------------------------------------------------------------
// Ciclo de vida
// -------------------------------------------------------------
SynthEngine& SynthEngine::getInstance() {
    static SynthEngine instance;
    return instance;
}

SynthEngine::SynthEngine()
    : mInitialized(false),
      mAssetManager(nullptr),
      mSampleRate(48000),
      mDefaultTsf(nullptr),
      mStyleTsf(nullptr),
      mAuditionTsf(nullptr),
      mMasterVolume(0.9f),
      mExpression(1.0f),
      mModulation(0.0f),
      mVibratoPhase(0.0f),
      mVibratoActive(false),
      mSustainPedal(false),
      mPitchWheel(8192),
      mGlobalTranspose(0),
      mStyleMasterVolume(0.85f),
      mLatestChord({"---", "N/A", "N/A", -1}),
      mSplitPoint(60),
      mStylePlaying(false),
      mAccompanimentOn(false),
      mSyncStartArmed(false),
      mBpm(100),
      mStylePpq(480),
      mCurrentBeat(1),
      mCurrentTick(0.0),
      mGlobalTick(0.0),
      mEventCursor(0),
      mCurrentSection("MAIN_A"),
      mLastMainSection("MAIN_A") {
    const char* names[4] = {"Yamaha CFX Grand", "Ambient Pad Warm", "Syn Strings Symphony", "Synth Lead Moog Saw"};
    const int programs[4] = {0, 89, 48, 81};
    const float volumes[4] = {0.8f, 0.65f, 0.5f, 0.75f};
    for (int i = 0; i < 4; i++) {
        mLayers[i].voiceName = names[i];
        mLayers[i].program = programs[i];
        mLayers[i].volume = volumes[i];
        mLayers[i].filter.setSampleRate((float)mSampleRate);
        mLayers[i].filter.setCutoff(20000.0f);
        mLayers[i].filter.setResonance(0.707f);
        mChannelPeaks[i] = 0.0f;
    }
    mMasterFilter.setSampleRate((float)mSampleRate);
    mMasterFilter.setCutoff(20000.0f);
    mMasterFilter.setResonance(0.707f);

    mParameters["volume"] = mMasterVolume;
    mParameters["modulation"] = 0.0f;
    mParameters["cutoff"] = 100.0f;
    mParameters["resonance"] = 0.0f;

    mStyleBuf.assign(kMaxBlockFrames * 2, 0.0f);
    mLayerBuf.assign(kMaxBlockFrames * 2, 0.0f);
    mActiveStyleNotes.reserve(512);
    for (int i = 0; i < 16; i++) mStyleChannelProgram[i] = -1;
}

SynthEngine::~SynthEngine() {
    mAudioStream.stop();
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    for (auto& layer : mLayers) {
        if (layer.tsfInstance) tsf_close(layer.tsfInstance);
        layer.tsfInstance = nullptr;
    }
    if (mStyleTsf) tsf_close(mStyleTsf);
    if (mAuditionTsf) tsf_close(mAuditionTsf);
    for (auto& kv : mFontCache) tsf_close(kv.second);
    if (mDefaultTsf) tsf_close(mDefaultTsf);
}

static tsf* loadTsfFromAsset(AAssetManager* am, const std::string& assetPath) {
    if (!am) return nullptr;
    AAsset* asset = AAssetManager_open(am, assetPath.c_str(), AASSET_MODE_BUFFER);
    if (!asset) {
        LOGE("No se pudo abrir asset de SoundFont: %s", assetPath.c_str());
        return nullptr;
    }
    const void* data = AAsset_getBuffer(asset);
    off_t size = AAsset_getLength(asset);
    tsf* result = nullptr;
    if (data && size > 0) {
        result = tsf_load_memory(data, (int)size);
    }
    AAsset_close(asset);
    if (!result) LOGE("SoundFont inválido en asset: %s", assetPath.c_str());
    return result;
}

bool SynthEngine::initialize(AAssetManager* assetManager) {
    {
        std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
        if (mInitialized) return true;
        mAssetManager = assetManager;
    }

    // Carga pesada fuera del lock
    tsf* defaultFont = loadTsfFromAsset(assetManager, "soundfonts/default.sf2");

    mAudioStream.setSampleRateListener([this](int sr) { onSampleRateChanged(sr); });
    // 0 = frecuencia nativa del dispositivo (permite la ruta rápida de baja latencia)
    bool audioOk = mAudioStream.start([this](float* buffer, int numFrames) {
        renderAudioCallback(buffer, numFrames);
    }, 0);

    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    if (audioOk) onSampleRateChanged(mAudioStream.getSampleRate());
    if (defaultFont) installDefaultFontLocked(defaultFont);
    mInitialized = true;
    LOGI("[OK] SynthEngine inicializado (audio %s, %d Hz, SF2 %s)",
         audioOk ? "OK" : "ERROR", mSampleRate, defaultFont ? "OK" : "no encontrado");
    return true;
}

void SynthEngine::onSampleRateChanged(int sampleRate) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    if (sampleRate <= 0) return;
    mSampleRate = sampleRate;
    auto apply = [this](tsf* f) {
        if (f) tsf_set_output(f, TSF_STEREO_INTERLEAVED, mSampleRate, kFontGainDb);
    };
    apply(mDefaultTsf);
    apply(mStyleTsf);
    apply(mAuditionTsf);
    for (auto& layer : mLayers) {
        apply(layer.tsfInstance);
        layer.filter.setSampleRate((float)mSampleRate);
        layer.filter.setCutoff(cutoffPercentToHz(layer.cutoff));
    }
    mMasterFilter.setSampleRate((float)mSampleRate);
    LOGI("Frecuencia de muestreo del motor: %d Hz", mSampleRate);
}

bool SynthEngine::isInitialized() const {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    return mInitialized;
}

int SynthEngine::getSampleRate() const {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    return mSampleRate;
}

// -------------------------------------------------------------
// SoundFonts
// -------------------------------------------------------------
tsf* SynthEngine::loadFontFileUnlocked(const std::string& cleanPath) {
    tsf* f = tsf_load_filename(cleanPath.c_str());
    if (!f) LOGE("Error cargando SoundFont: %s", cleanPath.c_str());
    return f;
}

// Devuelve una copia (comparte muestras) de una fuente ya cacheada; nullptr si no está
tsf* SynthEngine::acquireFontCopyLocked(const std::string& cleanPath) {
    if (cleanPath.empty()) return mDefaultTsf ? tsf_copy(mDefaultTsf) : nullptr;
    auto it = mFontCache.find(cleanPath);
    if (it == mFontCache.end()) return nullptr;
    return tsf_copy(it->second);
}

void SynthEngine::pruneFontCacheLocked() {
    for (auto it = mFontCache.begin(); it != mFontCache.end();) {
        bool used = (it->first == mAuditionFontPath);
        for (auto& layer : mLayers) {
            if (cleanFilePath(layer.fontPath) == it->first) used = true;
        }
        if (!used) {
            tsf_close(it->second); // las copias mantienen las muestras vivas (refCount)
            it = mFontCache.erase(it);
        } else {
            ++it;
        }
    }
}

void SynthEngine::installDefaultFontLocked(tsf* newDefault) {
    if (mDefaultTsf) tsf_close(mDefaultTsf);
    mDefaultTsf = newDefault;
    tsf_set_output(mDefaultTsf, TSF_STEREO_INTERLEAVED, mSampleRate, kFontGainDb);
    LOGI("SoundFont por defecto: %d presets", tsf_get_presetcount(mDefaultTsf));

    for (auto& layer : mLayers) {
        if (!isAbsolutePath(cleanFilePath(layer.fontPath))) {
            releaseLayerNotesLocked(layer);
            if (layer.tsfInstance) tsf_close(layer.tsfInstance);
            layer.tsfInstance = tsf_copy(mDefaultTsf);
            setupLayerInstanceLocked(layer);
        }
    }

    if (mStyleTsf) tsf_close(mStyleTsf);
    mStyleTsf = tsf_copy(mDefaultTsf);
    mActiveStyleNotes.clear();
    setupStyleInstanceLocked();

    if (mAuditionFontPath.empty()) {
        if (mAuditionTsf) tsf_close(mAuditionTsf);
        mAuditionTsf = tsf_copy(mDefaultTsf);
        if (mAuditionTsf) {
            tsf_set_output(mAuditionTsf, TSF_STEREO_INTERLEAVED, mSampleRate, kFontGainDb);
            tsf_set_max_voices(mAuditionTsf, 32);
            tsf_channel_set_presetindex(mAuditionTsf, 0, 0);
        }
    }
}

void SynthEngine::setupLayerInstanceLocked(LayerStem& layer) {
    tsf* f = layer.tsfInstance;
    if (!f) return;
    tsf_set_output(f, TSF_STEREO_INTERLEAVED, mSampleRate, kFontGainDb);
    tsf_set_max_voices(f, kMaxVoicesPerFont);
    layer.resolvedPreset = resolvePresetIndex(f, layer.program, false);
    tsf_channel_set_presetindex(f, kLayerChannel, layer.resolvedPreset);
    tsf_channel_set_pitchrange(f, kLayerChannel, 2.0f);
    tsf_channel_set_pitchwheel(f, kLayerChannel, mPitchWheel);
    tsf_channel_set_sustain(f, kLayerChannel, mSustainPedal ? 1 : 0);
    applyLayerEnvelopeLocked(layer);
}

// Envolvente por voz: se aplica a cada nota nueva dentro de TSF
void SynthEngine::applyLayerEnvelopeLocked(LayerStem& layer) {
    tsf* f = layer.tsfInstance;
    if (!f) return;
    float a = clampf(layer.attack, 0.0f, 100.0f) / 100.0f;
    float d = clampf(layer.decay, 0.0f, 100.0f);
    float s = clampf(layer.sustain, 0.0f, 100.0f) / 100.0f;
    float r = clampf(layer.release, 0.0f, 100.0f) / 100.0f;
    f->envOverrideEnabled = 1;
    f->envOverrideAttack = a * a * 3.0f;                                   // 0 .. 3 s (mínimo)
    f->envOverrideDecayScale = (d >= 45.0f) ? powf(4.0f, (d - 45.0f) / 55.0f)
                                            : powf(4.0f, (d - 45.0f) / 45.0f); // x0.25 .. x4
    f->envOverrideSustainScale = s;                                        // x0 .. x1
    f->envOverrideRelease = 0.02f + r * r * 6.0f;                          // 0.02 .. 6 s
}

void SynthEngine::setupStyleInstanceLocked() {
    if (!mStyleTsf) return;
    tsf_set_output(mStyleTsf, TSF_STEREO_INTERLEAVED, mSampleRate, kFontGainDb);
    tsf_set_max_voices(mStyleTsf, 160);
    // Inicializar los 16 canales: sin esto tsf_channel_note_on descarta las notas
    for (int ch = 0; ch < 16; ch++) {
        bool drums = isDrumChannel(ch + 1);
        tsf_channel_set_presetnumber(mStyleTsf, ch, 0, drums ? 1 : 0);
        mStyleChannelProgram[ch] = -1;
    }
}

void SynthEngine::releaseLayerNotesLocked(LayerStem& layer) {
    if (layer.tsfInstance) tsf_channel_note_off_all(layer.tsfInstance, kLayerChannel);
    layer.heldNotes.clear();
}

bool SynthEngine::loadSoundFont(const std::string& fontPath) {
    std::string clean = cleanFilePath(fontPath);
    tsf* loaded = nullptr;
    AAssetManager* am;
    {
        std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
        am = mAssetManager;
    }
    if (isAbsolutePath(clean)) {
        loaded = loadFontFileUnlocked(clean);
    } else {
        loaded = loadTsfFromAsset(am, clean);
    }
    if (!loaded) return false;

    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    installDefaultFontLocked(loaded);
    return true;
}

// -------------------------------------------------------------
// Capas
// -------------------------------------------------------------
void SynthEngine::setLayerMix(int layerIndex, float volume, bool mute, bool solo) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    if (layerIndex < 0 || layerIndex >= 4) return;
    mLayers[layerIndex].volume = clampf(volume, 0.0f, 1.0f);
    mLayers[layerIndex].mute = mute;
    mLayers[layerIndex].solo = solo;
}

bool SynthEngine::setLayerVoice(int layerIndex, const std::string& voiceName, int program, const std::string& fontPath) {
    if (layerIndex < 0 || layerIndex >= 4) return false;
    std::string clean = cleanFilePath(fontPath);
    bool custom = isAbsolutePath(clean);
    std::string effectivePath = custom ? clean : "";
    program = program < 0 ? 0 : program;

    {
        std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
        LayerStem& layer = mLayers[layerIndex];
        bool sameFont = (cleanFilePath(layer.fontPath) == effectivePath) && layer.tsfInstance;
        layer.voiceName = voiceName;
        if (sameFont) {
            if (layer.program != program) {
                // Mismo SF2: solo cambiar el preset (las notas sostenidas siguen sonando)
                layer.program = program;
                layer.resolvedPreset = resolvePresetIndex(layer.tsfInstance, program, false);
                tsf_channel_set_presetindex(layer.tsfInstance, kLayerChannel, layer.resolvedPreset);
            }
            return true;
        }
        // Fuente ya disponible (por defecto o en caché): cambio inmediato
        tsf* copy = acquireFontCopyLocked(effectivePath);
        if (copy || !custom) {
            releaseLayerNotesLocked(layer);
            if (layer.tsfInstance) tsf_close(layer.tsfInstance);
            layer.tsfInstance = copy;
            layer.fontPath = effectivePath;
            layer.program = program;
            setupLayerInstanceLocked(layer);
            pruneFontCacheLocked();
            return copy != nullptr;
        }
    }

    // SF2 personalizado no cacheado: cargar del disco SIN bloquear el audio
    tsf* master = loadFontFileUnlocked(clean);
    if (!master) return false;

    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    auto it = mFontCache.find(clean);
    if (it == mFontCache.end()) {
        mFontCache[clean] = master;
    } else {
        tsf_close(master); // otro hilo lo cargó mientras tanto
    }
    LayerStem& layer = mLayers[layerIndex];
    releaseLayerNotesLocked(layer);
    if (layer.tsfInstance) tsf_close(layer.tsfInstance);
    layer.tsfInstance = tsf_copy(mFontCache[clean]);
    layer.fontPath = clean;
    layer.program = program;
    setupLayerInstanceLocked(layer);
    pruneFontCacheLocked();
    LOGI("[setLayerVoice] F%d cargó SF2 personalizado: %s", layerIndex + 1, clean.c_str());
    return layer.tsfInstance != nullptr;
}

void SynthEngine::setLayerOctave(int layerIndex, int octave) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    if (layerIndex >= 0 && layerIndex < 4) {
        mLayers[layerIndex].octave = clampi(octave, -3, 3);
        LOGI("Octava F%d = %d", layerIndex + 1, mLayers[layerIndex].octave);
    }
}

void SynthEngine::setGlobalTranspose(int transpose) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    mGlobalTranspose = clampi(transpose, -12, 12);
}

void SynthEngine::setLayerParam(int layerIndex, const std::string& paramName, float value) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    if (layerIndex < 0 || layerIndex >= 4) return;
    LayerStem& layer = mLayers[layerIndex];
    value = clampf(value, 0.0f, 100.0f);
    if (paramName == "cutoff") {
        layer.cutoff = value;
        layer.filter.setCutoff(cutoffPercentToHz(value));
    } else if (paramName == "resonance") {
        layer.resonance = value;
        layer.filter.setResonance(resonancePercentToQ(value));
    } else if (paramName == "attack") {
        layer.attack = value;
    } else if (paramName == "decay" || paramName == "delay") {
        layer.decay = value;
    } else if (paramName == "sustain") {
        layer.sustain = value;
    } else if (paramName == "release") {
        layer.release = value;
    } else {
        return;
    }
    applyLayerEnvelopeLocked(layer);
}

void SynthEngine::getChannelLevels(float* outLevels) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    for (int i = 0; i < 4; i++) outLevels[i] = mChannelPeaks[i];
}

bool SynthEngine::layerAudibleLocked(int index, bool anySolo) const {
    const LayerStem& l = mLayers[index];
    if (!l.tsfInstance || l.mute || l.volume <= 0.001f) return false;
    if (anySolo && !l.solo) return false;
    return true;
}

// -------------------------------------------------------------
// Preescucha
// -------------------------------------------------------------
void SynthEngine::auditionVoice(int program, const std::string& fontPath, int note, int velocity) {
    std::string clean = cleanFilePath(fontPath);
    std::string effectivePath = isAbsolutePath(clean) ? clean : "";
    note = clampi(note, 0, 127);
    float vel = clampi(velocity, 1, 127) / 127.0f;

    bool needsLoad;
    {
        std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
        needsLoad = !effectivePath.empty() && mFontCache.find(effectivePath) == mFontCache.end();
    }
    if (needsLoad) {
        // Carga del disco fuera del lock para no interrumpir el audio
        tsf* loadedMaster = loadFontFileUnlocked(effectivePath);
        if (!loadedMaster) return;
        std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
        if (mFontCache.find(effectivePath) == mFontCache.end()) mFontCache[effectivePath] = loadedMaster;
        else tsf_close(loadedMaster);
    }

    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    if (!mAuditionTsf || mAuditionFontPath != effectivePath) {
        tsf* copy = acquireFontCopyLocked(effectivePath);
        if (!copy) return;
        if (mAuditionTsf) tsf_close(mAuditionTsf);
        mAuditionTsf = copy;
        mAuditionFontPath = effectivePath;
        tsf_set_output(mAuditionTsf, TSF_STEREO_INTERLEAVED, mSampleRate, kFontGainDb);
        tsf_set_max_voices(mAuditionTsf, 32);
        pruneFontCacheLocked();
    }
    tsf_channel_sounds_off_all(mAuditionTsf, 0);
    tsf_channel_set_presetindex(mAuditionTsf, 0, resolvePresetIndex(mAuditionTsf, program, false));
    tsf_channel_note_on(mAuditionTsf, 0, note, vel);
}

void SynthEngine::auditionStop(int note) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    if (mAuditionTsf) tsf_channel_note_off_all(mAuditionTsf, 0);
}

// -------------------------------------------------------------
// Interpretación en vivo
// -------------------------------------------------------------
void SynthEngine::noteOn(int note, int velocity) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    if (velocity <= 0) {
        noteOff(note);
        return;
    }
    note = clampi(note, 0, 127);
    bool lowerZone = note < mSplitPoint;

    if (lowerZone) {
        mLeftHandChordRecognizer.addNote(note);
        ChordInfo chord = mLeftHandChordRecognizer.detectChord();
        // El acorde solo cambia al tocar (memoria de acorde como en un arreglista)
        if (chord.rootPitchClass >= 0 &&
            (chord.rootPitchClass != mLatestChord.rootPitchClass || chord.type != mLatestChord.type ||
             chord.name != mLatestChord.name)) {
            mLatestChord = chord;
            reharmonizeActiveNotesLocked();
        }
    }

    if (mSyncStartArmed && !mStylePlaying && (lowerZone || !mAccompanimentOn)) {
        mSyncStartArmed = false;
        startStyleLocked();
    }

    // Con ACMP activo la mano izquierda solo controla los acordes
    if (lowerZone && mAccompanimentOn) return;

    bool anySolo = false;
    for (auto& l : mLayers) anySolo |= l.solo;

    float normVel = velocity / 127.0f;
    for (int l = 0; l < 4; l++) {
        if (!layerAudibleLocked(l, anySolo)) continue;
        LayerStem& layer = mLayers[l];
        int playedNote = clampi(note + layer.octave * 12 + mGlobalTranspose, 0, 127);
        tsf_channel_note_on(layer.tsfInstance, kLayerChannel, playedNote, normVel);
        layer.heldNotes[note].push_back(playedNote);
    }
}

void SynthEngine::noteOff(int note) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    note = clampi(note, 0, 127);
    if (note < mSplitPoint) {
        mLeftHandChordRecognizer.removeNote(note);
    }
    // Apagar exactamente lo que sonó, aunque la capa se haya silenciado después
    for (auto& layer : mLayers) {
        auto it = layer.heldNotes.find(note);
        if (it == layer.heldNotes.end()) continue;
        if (layer.tsfInstance) {
            for (int played : it->second) {
                tsf_channel_note_off(layer.tsfInstance, kLayerChannel, played);
            }
        }
        layer.heldNotes.erase(it);
    }
}

void SynthEngine::allNotesOff() {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    // También suelta el pedal: si el teclado se desconecta con el pedal pisado
    // el sustain quedaría activo para siempre.
    mSustainPedal = false;
    mPitchWheel = 8192;
    for (auto& layer : mLayers) {
        if (layer.tsfInstance) {
            tsf_channel_set_sustain(layer.tsfInstance, kLayerChannel, 0);
            tsf_channel_set_pitchwheel(layer.tsfInstance, kLayerChannel, mPitchWheel);
            tsf_channel_note_off_all(layer.tsfInstance, kLayerChannel);
        }
        layer.heldNotes.clear();
    }
    mLeftHandChordRecognizer.clearNotes();
    if (mAuditionTsf) tsf_channel_note_off_all(mAuditionTsf, 0);
    // El ritmo en curso sigue sonando; solo se limpian notas si está detenido
    if (!mStylePlaying) styleAllNotesOff();
}

void SynthEngine::setParam(const std::string& paramName, float value) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    mParameters[paramName] = value;
    if (paramName == "volume") {
        mMasterVolume = clampf(value, 0.0f, 1.5f);
    } else if (paramName == "modulation") {
        mModulation = clampf(value, 0.0f, 100.0f) / 100.0f;
    } else if (paramName == "cutoff") {
        mMasterFilter.setCutoff(cutoffPercentToHz(value));
    } else if (paramName == "resonance") {
        mMasterFilter.setResonance(resonancePercentToQ(value));
    }
}

float SynthEngine::getParam(const std::string& paramName) const {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    auto it = mParameters.find(paramName);
    return it != mParameters.end() ? it->second : 0.0f;
}

void SynthEngine::controlChange(int channel, int cc, int value) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    value = clampi(value, 0, 127);
    switch (cc) {
        case 1: // rueda de modulación -> vibrato
            mModulation = value / 127.0f;
            mParameters["modulation"] = mModulation * 100.0f;
            break;
        case 7:
            mMasterVolume = value / 127.0f;
            mParameters["volume"] = mMasterVolume;
            break;
        case 11:
            mExpression = value / 127.0f;
            break;
        case 64: { // pedal de sustain
            bool on = value >= 64;
            if (on == mSustainPedal) break;
            mSustainPedal = on;
            for (auto& layer : mLayers) {
                if (layer.tsfInstance) tsf_channel_set_sustain(layer.tsfInstance, kLayerChannel, on ? 1 : 0);
            }
            break;
        }
        case 74:
            mMasterFilter.setCutoff(cutoffPercentToHz(value / 1.27f));
            break;
        case 120: // all sound off
        case 123: // all notes off
            allNotesOff();
            break;
        default:
            break;
    }
}

void SynthEngine::programChange(int channel, int program) {
    // Los cambios de programa del teclado no reasignan los faders: la voz de cada
    // fader la decide la app (evita que la UI muestre una voz distinta a la que suena).
    LOGD("Program Change ignorado (canal %d, programa %d)", channel, program);
}

void SynthEngine::pitchBend(int channel, int pitch) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    mPitchWheel = clampi(pitch, 0, 16383);
    for (auto& layer : mLayers) {
        if (layer.tsfInstance) tsf_channel_set_pitchwheel(layer.tsfInstance, kLayerChannel, mPitchWheel);
    }
}

// -------------------------------------------------------------
// Acordes
// -------------------------------------------------------------
std::string SynthEngine::getDetectedChord() {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    return mLatestChord.rootPitchClass >= 0 ? mLatestChord.name : "---";
}

void SynthEngine::setSplitPoint(int note) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    mSplitPoint = clampi(note, 0, 127);
    mLeftHandChordRecognizer.clearNotes();
    mLatestChord = ChordInfo{"---", "N/A", "N/A", -1};
}

int SynthEngine::getSplitPoint() const {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    return mSplitPoint;
}

int SynthEngine::harmonizeLocked(int sourceNote, int tsfChannel) const {
    if (mLatestChord.rootPitchClass < 0) return sourceNote;
    int pc = sourceNote % 12;
    int octaveBase = sourceNote - pc;
    int mapped = mapSourceInterval(pc, mLatestChord.type);
    // Transponer al registro más cercano (-5..+6 semitonos) para no saltar de octava
    int shift = mLatestChord.rootPitchClass;
    if (shift > 6) shift -= 12;
    int out = octaveBase + mapped + shift;
    while (out < 0) out += 12;
    while (out > 127) out -= 12;
    return out;
}

void SynthEngine::reharmonizeActiveNotesLocked() {
    if (!mStyleTsf || !mStylePlaying) return;
    for (auto& n : mActiveStyleNotes) {
        if (n.isDrum) continue;
        int newNote = harmonizeLocked(n.sourceNote, n.tsfChannel);
        if (newNote == n.playedNote) continue;
        tsf_channel_note_off(mStyleTsf, n.tsfChannel, n.playedNote);
        tsf_channel_note_on(mStyleTsf, n.tsfChannel, newNote, n.velocity / 127.0f);
        n.playedNote = newNote;
    }
}

// -------------------------------------------------------------
// Acompañamiento manual
// -------------------------------------------------------------
void SynthEngine::styleNoteOn(int channel, int note, int velocity, int program) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    if (!mStyleTsf) return;
    int ch = clampi(channel - 1, 0, 15);
    if (program >= 0 && mStyleChannelProgram[ch] != program) {
        tsf_channel_set_presetnumber(mStyleTsf, ch, program, isDrumChannel(channel) ? 1 : 0);
        mStyleChannelProgram[ch] = program;
    }
    tsf_channel_note_on(mStyleTsf, ch, clampi(note, 0, 127), clampi(velocity, 1, 127) / 127.0f);
}

void SynthEngine::styleNoteOff(int channel, int note) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    if (!mStyleTsf) return;
    tsf_channel_note_off(mStyleTsf, clampi(channel - 1, 0, 15), clampi(note, 0, 127));
}

void SynthEngine::setStyleMasterVolume(float volume) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    mStyleMasterVolume = clampf(volume, 0.0f, 1.0f);
}

void SynthEngine::styleAllNotesOff() {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    mActiveStyleNotes.clear();
    if (!mStyleTsf) return;
    for (int ch = 0; ch < 16; ch++) tsf_channel_note_off_all(mStyleTsf, ch);
}

// -------------------------------------------------------------
// Secuenciador de estilos
// -------------------------------------------------------------
void SynthEngine::clearStyleData() {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    stopStyleLocked();
    mStyleSections.clear();
    mCurrentTick = 0.0;
    mEventCursor = 0;
    mCurrentBeat = 1;
    mQueuedSection.clear();
    for (int i = 0; i < 16; i++) mStyleChannelProgram[i] = -1;
    if (mStyleTsf) setupStyleInstanceLocked();
}

void SynthEngine::setStylePpq(int ppq) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    if (ppq > 0 && ppq <= 15360) mStylePpq = ppq;
}

void SynthEngine::loadStyleSectionEvents(const std::string& sectionName, int totalTicks, const std::string& eventsData) {
    // Parseo fuera del lock (puede haber miles de eventos)
    NativeStyleSectionData sec;
    sec.totalTicks = totalTicks > 0 ? totalTicks : 1920;
    const char* p = eventsData.c_str();
    while (*p) {
        int tick = 0, dur = 0, ch = 0, note = 0, vel = 0, prg = -1, drum = 0;
        int n = sscanf(p, "%d,%d,%d,%d,%d,%d,%d", &tick, &dur, &ch, &note, &vel, &prg, &drum);
        if (n >= 5 && tick >= 0 && note >= 0 && note <= 127 && vel > 0) {
            if (n < 6) prg = -1;
            if (n < 7) drum = 0;
            sec.events.push_back({tick, dur > 0 ? dur : 1, clampi(ch, 1, 16), note, clampi(vel, 1, 127),
                                  prg, drum != 0 || isDrumChannel(ch)});
        }
        const char* next = strchr(p, ';');
        if (!next) break;
        p = next + 1;
    }
    std::stable_sort(sec.events.begin(), sec.events.end(),
                     [](const NativeStyleEvent& a, const NativeStyleEvent& b) { return a.tick < b.tick; });
    // Asegurar que la sección cubra todos sus eventos
    if (!sec.events.empty() && sec.events.back().tick >= sec.totalTicks) {
        sec.totalTicks = sec.events.back().tick + 1;
    }
    size_t count = sec.events.size();

    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    mStyleSections[sectionName] = std::move(sec);
    if (sectionName == mCurrentSection) seekEventCursorLocked();
    LOGI("[Sequencer] Sección %s: %zu eventos, %d ticks (ppq %d)", sectionName.c_str(), count, totalTicks, mStylePpq);
}

bool SynthEngine::sectionExistsLocked(const std::string& name) const {
    auto it = mStyleSections.find(name);
    return it != mStyleSections.end() && !it->second.events.empty();
}

const NativeStyleSectionData* SynthEngine::currentSectionDataLocked() const {
    auto it = mStyleSections.find(mCurrentSection);
    if (it != mStyleSections.end()) return &it->second;
    return nullptr;
}

void SynthEngine::seekEventCursorLocked() {
    mEventCursor = 0;
    const NativeStyleSectionData* sec = currentSectionDataLocked();
    if (!sec) return;
    auto it = std::lower_bound(sec->events.begin(), sec->events.end(), mCurrentTick,
                               [](const NativeStyleEvent& e, double t) { return (double)e.tick < t; });
    mEventCursor = (size_t)(it - sec->events.begin());
}

// Entra a una sección resolviendo las que no existan en el estilo cargado
void SynthEngine::enterSectionLocked(const std::string& requested, double startTick) {
    std::string name = requested;
    if (!sectionExistsLocked(name)) {
        if (name.rfind("FILL_", 0) == 0) {
            // Estilo sin ese fill: pasar a la variación destino en la próxima barra
            mQueuedSection = "MAIN_" + name.substr(5);
            return;
        } else if (name.rfind("INTRO_", 0) == 0) {
            name = mLastMainSection;
            startTick = 0.0;
        } else if (name.rfind("ENDING_", 0) == 0) {
            stopStyleLocked();
            return;
        }
        if (!sectionExistsLocked(name)) name = "MAIN_A";
        if (!sectionExistsLocked(name)) {
            for (const auto& kv : mStyleSections) {
                if (!kv.second.events.empty()) { name = kv.first; break; }
            }
        }
    }
    if (name.rfind("MAIN_", 0) == 0) mLastMainSection = name;

    const NativeStyleSectionData* target = nullptr;
    auto it = mStyleSections.find(name);
    if (it != mStyleSections.end()) target = &it->second;
    if (target && startTick >= target->totalTicks) startTick = 0.0;

    // Las notas activas conservan su duración restante en la nueva línea de tiempo
    double delta = startTick - mCurrentTick;
    for (auto& n : mActiveStyleNotes) n.offTick += delta;

    mCurrentSection = name;
    mCurrentTick = startTick;
    seekEventCursorLocked();
}

void SynthEngine::onSectionEndLocked() {
    const std::string cur = mCurrentSection;
    if (!mQueuedSection.empty()) {
        std::string next = mQueuedSection;
        mQueuedSection.clear();
        enterSectionLocked(next, 0.0);
    } else if (cur.rfind("ENDING_", 0) == 0) {
        stopStyleLocked();
    } else if (cur.rfind("INTRO_", 0) == 0) {
        enterSectionLocked(mLastMainSection, 0.0);
    } else if (cur.rfind("FILL_", 0) == 0) {
        // Un fill corto puede terminar a mitad de compás: la MAIN retoma en la
        // misma posición del compás para no descuadrar el ritmo
        enterSectionLocked("MAIN_" + cur.substr(5), posInBarLocked());
    } else {
        enterSectionLocked(cur, 0.0); // loop de MAIN
    }
}

void SynthEngine::fireStyleEventLocked(const NativeStyleEvent& evt) {
    if (!mStyleTsf) return;
    bool drum = evt.isDrum;
    if (!mAccompanimentOn && !drum) return; // ACMP OFF = solo ritmo
    int ch = evt.channel - 1;
    if (evt.program >= 0 && mStyleChannelProgram[ch] != evt.program) {
        tsf_channel_set_presetnumber(mStyleTsf, ch, evt.program, drum ? 1 : 0);
        mStyleChannelProgram[ch] = evt.program;
    }
    int played = drum ? evt.note : harmonizeLocked(evt.note, ch);
    // Re-disparo de la misma nota en el mismo canal: cerrar la anterior
    for (auto it = mActiveStyleNotes.begin(); it != mActiveStyleNotes.end(); ++it) {
        if (it->tsfChannel == ch && it->playedNote == played) {
            tsf_channel_note_off(mStyleTsf, ch, played);
            mActiveStyleNotes.erase(it);
            break;
        }
    }
    tsf_channel_note_on(mStyleTsf, ch, played, evt.velocity / 127.0f);
    mActiveStyleNotes.push_back({ch, evt.note, played, evt.velocity, drum,
                                 (double)evt.tick + (double)evt.durationTicks});
}

void SynthEngine::advanceSequencerLocked(int frames) {
    double ticksLeft = (double)mBpm * (double)mStylePpq / (60.0 * (double)mSampleRate) * frames;
    int guard = 0;
    while (ticksLeft > 1e-9 && mStylePlaying && guard++ < 16) {
        const NativeStyleSectionData* sec = currentSectionDataLocked();
        if (!sec) {
            enterSectionLocked(mCurrentSection, 0.0);
            sec = currentSectionDataLocked();
            if (!sec) { stopStyleLocked(); return; }
        }
        double total = (double)sec->totalTicks;
        double segEnd = std::min(mCurrentTick + ticksLeft, total);

        // Cambio de sección en cola: ocurre en la siguiente barra de compás (rejilla global)
        bool barSwitch = false;
        if (!mQueuedSection.empty()) {
            double toBar = (double)barTicksLocked() - posInBarLocked();
            if (toBar < 1e-6) toBar = (double)barTicksLocked();
            double nextBar = mCurrentTick + toBar;
            if (nextBar < total - 1e-9 && nextBar <= segEnd) {
                segEnd = nextBar;
                barSwitch = true;
            }
        }

        // Note Off vencidos
        for (size_t i = 0; i < mActiveStyleNotes.size();) {
            if (mActiveStyleNotes[i].offTick <= segEnd) {
                tsf_channel_note_off(mStyleTsf, mActiveStyleNotes[i].tsfChannel, mActiveStyleNotes[i].playedNote);
                mActiveStyleNotes[i] = mActiveStyleNotes.back();
                mActiveStyleNotes.pop_back();
            } else {
                i++;
            }
        }

        // Note On dentro del segmento
        while (mEventCursor < sec->events.size() && (double)sec->events[mEventCursor].tick < segEnd) {
            fireStyleEventLocked(sec->events[mEventCursor]);
            mEventCursor++;
        }

        double consumed = segEnd - mCurrentTick;
        ticksLeft -= consumed;
        mGlobalTick += consumed;
        mCurrentTick = segEnd;
        mCurrentBeat = ((int)(posInBarLocked() / (double)mStylePpq + 1e-6) % 4) + 1;

        if (barSwitch) {
            std::string next = mQueuedSection;
            mQueuedSection.clear();
            enterSectionLocked(next, 0.0);
        } else if (mCurrentTick >= total - 1e-9) {
            onSectionEndLocked();
        }
    }
}

void SynthEngine::releaseActiveStyleNotesLocked() {
    if (mStyleTsf) {
        for (const auto& n : mActiveStyleNotes) tsf_channel_note_off(mStyleTsf, n.tsfChannel, n.playedNote);
    }
    mActiveStyleNotes.clear();
}

void SynthEngine::startStyleLocked() {
    mStylePlaying = true;
    mSyncStartArmed = false;
    mCurrentTick = 0.0;
    mGlobalTick = 0.0;
    mCurrentBeat = 1;
    releaseActiveStyleNotesLocked();
    enterSectionLocked(mCurrentSection, 0.0);
    LOGI("[Sequencer] Inicio %s a %d BPM | ACMP %s", mCurrentSection.c_str(), mBpm, mAccompanimentOn ? "ON" : "OFF");
}

void SynthEngine::stopStyleLocked() {
    mStylePlaying = false;
    mQueuedSection.clear();
    styleAllNotesOff();
    mCurrentTick = 0.0;
    mCurrentBeat = 1;
    // Tras un ENDING (o al detener) volver a la variación principal en uso
    if (mCurrentSection.rfind("MAIN_", 0) != 0) mCurrentSection = mLastMainSection;
    mEventCursor = 0;
}

void SynthEngine::startStylePlayback(int bpm, bool accompanimentOn) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    if (bpm >= 20 && bpm <= 300) mBpm = bpm;
    mAccompanimentOn = accompanimentOn;
    startStyleLocked();
}

void SynthEngine::stopStylePlayback() {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    stopStyleLocked();
}

void SynthEngine::setStyleAccompaniment(bool enabled) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    if (mAccompanimentOn == enabled) return;
    mAccompanimentOn = enabled;
    if (!enabled && mStyleTsf) {
        // Apagar las partes armónicas que estaban sonando (la batería sigue)
        for (size_t i = 0; i < mActiveStyleNotes.size();) {
            if (!mActiveStyleNotes[i].isDrum) {
                tsf_channel_note_off(mStyleTsf, mActiveStyleNotes[i].tsfChannel, mActiveStyleNotes[i].playedNote);
                mActiveStyleNotes[i] = mActiveStyleNotes.back();
                mActiveStyleNotes.pop_back();
            } else {
                i++;
            }
        }
    }
}

void SynthEngine::setStyleBpm(int bpm) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    if (bpm >= 20 && bpm <= 300) mBpm = bpm;
}

void SynthEngine::setStyleSection(const std::string& section) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    if (!mStylePlaying) {
        // Detenido: solo preseleccionar INTRO/MAIN para el próximo inicio
        if (section.rfind("FILL_", 0) == 0 || section.rfind("ENDING_", 0) == 0) return;
        mCurrentSection = section;
        if (section.rfind("MAIN_", 0) == 0) mLastMainSection = section;
        mQueuedSection.clear();
        mCurrentTick = 0.0;
        mCurrentBeat = 1;
        mEventCursor = 0;
        return;
    }
    if (section.rfind("FILL_", 0) == 0) {
        // El fill entra de inmediato en la posición actual del compás. Si es más
        // corto que lo que resta, se alinea para terminar justo en la barra.
        mQueuedSection.clear();
        double posInBar = posInBarLocked();
        double startTick = posInBar;
        auto it = mStyleSections.find(section);
        if (it != mStyleSections.end()) {
            double fillLen = (double)it->second.totalTicks;
            if (startTick >= fillLen) {
                startTick = fillLen - ((double)barTicksLocked() - posInBar);
                if (startTick < 0.0) startTick = 0.0;
            }
        }
        enterSectionLocked(section, startTick);
    } else {
        mQueuedSection = section;
    }
}

void SynthEngine::queueNextStyleSection(const std::string& section) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    if (!mStylePlaying) {
        setStyleSection(section);
        return;
    }
    if (section.rfind("FILL_", 0) == 0) {
        setStyleSection(section);
    } else {
        mQueuedSection = section;
    }
}

void SynthEngine::setSyncStart(bool armed) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    mSyncStartArmed = armed && !mStylePlaying;
}

bool SynthEngine::isStylePlaying() const {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    return mStylePlaying;
}

bool SynthEngine::isSyncStartArmed() const {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    return mSyncStartArmed;
}

int SynthEngine::getCurrentBeat() const {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    return mCurrentBeat;
}

std::string SynthEngine::getCurrentSection() const {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    return mCurrentSection;
}

std::string SynthEngine::getQueuedSection() const {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    return mQueuedSection;
}

void SynthEngine::setBpm(int bpm) {
    setStyleBpm(bpm);
}

int SynthEngine::getBpm() const {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    return mBpm;
}

// -------------------------------------------------------------
// Callback de audio (hilo de tiempo real de AAudio)
// -------------------------------------------------------------
void SynthEngine::renderAudioCallback(float* buffer, int numFrames) {
    std::lock_guard<std::recursive_mutex> lock(mEngineMutex);
    int offset = 0;
    while (offset < numFrames) {
        int n = std::min(kMaxBlockFrames, numFrames - offset);
        renderBlock(buffer + offset * 2, n);
        offset += n;
    }
}

void SynthEngine::renderBlock(float* out, int numFrames) {
    const int samples = numFrames * 2;
    memset(out, 0, sizeof(float) * samples);
    const float sr = (float)mSampleRate;

    // 1. Estilo: el secuenciador avanza en sub-bloques para precisión temporal.
    //    Se renderiza siempre para que las colas de release terminen tras STOP.
    if (mStyleTsf) {
        float* styleBuf = mStyleBuf.data();
        int pos = 0;
        while (pos < numFrames) {
            int chunk = std::min(kSequencerChunk, numFrames - pos);
            if (mStylePlaying) advanceSequencerLocked(chunk);
            tsf_render_float(mStyleTsf, styleBuf + pos * 2, chunk, 0);
            pos += chunk;
        }
        for (int i = 0; i < samples; i++) out[i] += styleBuf[i] * mStyleMasterVolume;
    }

    // 2. Vibrato (rueda de modulación / fader MODULATION) aplicado como afinación por capa
    if (mModulation > 0.01f) {
        float tuning = sinf(mVibratoPhase) * 0.35f * mModulation; // hasta +-35 cents
        for (auto& layer : mLayers) {
            if (layer.tsfInstance) tsf_channel_set_tuning(layer.tsfInstance, kLayerChannel, tuning);
        }
        mVibratoPhase += 2.0f * kPi * 5.5f * numFrames / sr;
        if (mVibratoPhase > 2.0f * kPi) mVibratoPhase = fmodf(mVibratoPhase, 2.0f * kPi);
        mVibratoActive = true;
    } else if (mVibratoActive) {
        for (auto& layer : mLayers) {
            if (layer.tsfInstance) tsf_channel_set_tuning(layer.tsfInstance, kLayerChannel, 0.0f);
        }
        mVibratoActive = false;
        mVibratoPhase = 0.0f;
    }

    // 3. Capas F1..F4 con filtro propio y medición real de nivel
    bool anySolo = false;
    for (auto& l : mLayers) anySolo |= l.solo;
    const float meterDecay = expf(-(float)numFrames / (0.12f * sr));
    float* layerBuf = mLayerBuf.data();

    for (int l = 0; l < 4; l++) {
        LayerStem& layer = mLayers[l];
        float peak = 0.0f;
        if (layer.tsfInstance) {
            // Renderizar siempre (aunque esté en mute) para que las voces avancen
            tsf_render_float(layer.tsfInstance, layerBuf, numFrames, 0);
            float vol = layerAudibleLocked(l, anySolo) ? layer.volume : 0.0f;
            if (vol > 0.0001f) {
                for (int i = 0; i < numFrames; i++) {
                    float left = layerBuf[i * 2];
                    float right = layerBuf[i * 2 + 1];
                    layer.filter.processStereo(&left, &right);
                    left *= vol;
                    right *= vol;
                    out[i * 2] += left;
                    out[i * 2 + 1] += right;
                    float a = fabsf(left) > fabsf(right) ? fabsf(left) : fabsf(right);
                    if (a > peak) peak = a;
                }
            }
        }
        // Escala visual: ~-12 dBFS llena el medidor
        float level = clampf(peak * 4.0f, 0.0f, 1.0f);
        mChannelPeaks[l] = std::max(level, mChannelPeaks[l] * meterDecay);
        if (mChannelPeaks[l] < 0.003f) mChannelPeaks[l] = 0.0f;
    }

    // 4. Preescucha
    if (mAuditionTsf) tsf_render_float(mAuditionTsf, out, numFrames, 1);

    // 5. Master: filtro, volumen, expresión y limitador suave
    const float gain = mMasterVolume * mExpression;
    for (int i = 0; i < numFrames; i++) {
        float left = out[i * 2];
        float right = out[i * 2 + 1];
        mMasterFilter.processStereo(&left, &right);
        out[i * 2] = softLimit(left * gain);
        out[i * 2 + 1] = softLimit(right * gain);
    }
}
