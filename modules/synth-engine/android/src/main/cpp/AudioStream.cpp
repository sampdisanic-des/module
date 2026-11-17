#include "AudioStream.h"
#include <android/log.h>
#include <thread>
#include <chrono>

#define LOG_TAG "AudioStream"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

AudioStream::AudioStream()
    : mStream(nullptr),
      mIsRunning(false),
      mWantRunning(false),
      mRestartPending(false),
      mSampleRate(44100),
      mRestartCount(0),
      mRequestedSampleRate(44100) {}

AudioStream::~AudioStream() {
    stop();
}

aaudio_data_callback_result_t AudioStream::dataCallback(
    AAudioStream *stream,
    void *userData,
    void *audioData,
    int32_t numFrames
) {
    AudioStream *self = static_cast<AudioStream *>(userData);
    float *floatBuffer = static_cast<float *>(audioData);
    if (self && self->mAudioCallback) {
        self->mAudioCallback(floatBuffer, numFrames);
        return AAUDIO_CALLBACK_RESULT_CONTINUE;
    }
    // Sin callback: entregar silencio en lugar de basura
    for (int i = 0; i < numFrames * 2; i++) floatBuffer[i] = 0.0f;
    return AAUDIO_CALLBACK_RESULT_CONTINUE;
}

void AudioStream::errorCallback(AAudioStream *stream, void *userData, aaudio_result_t error) {
    AudioStream *self = static_cast<AudioStream *>(userData);
    LOGE("AAudio error callback: %s", AAudio_convertResultToText(error));
    if (self && error == AAUDIO_ERROR_DISCONNECTED) {
        // No se puede cerrar/reabrir dentro del callback: delegar a otro hilo
        self->restartAsync();
    }
}

bool AudioStream::start(AudioCallback callback, int sampleRate) {
    std::lock_guard<std::mutex> lock(mControlMutex);
    if (mIsRunning.load()) return true;
    mAudioCallback = callback;
    mRequestedSampleRate = sampleRate;
    mWantRunning = true;
    bool ok = openAndStartLocked();
    if (!ok) {
        // P. ej. AAUDIO_ERROR_DISCONNECTED si la ruta de audio cambia durante el arranque:
        // reintentar en segundo plano en lugar de quedar sin sonido
        closeLocked();
        restartAsync();
    }
    return ok;
}

bool AudioStream::openAndStartLocked() {
    AAudioStreamBuilder *builder = nullptr;
    aaudio_result_t result = AAudio_createStreamBuilder(&builder);
    if (result != AAUDIO_OK) {
        LOGE("Error al crear AAudioStreamBuilder: %s", AAudio_convertResultToText(result));
        return false;
    }

    AAudioStreamBuilder_setDirection(builder, AAUDIO_DIRECTION_OUTPUT);
    AAudioStreamBuilder_setSharingMode(builder, AAUDIO_SHARING_MODE_SHARED);
    AAudioStreamBuilder_setPerformanceMode(builder, AAUDIO_PERFORMANCE_MODE_LOW_LATENCY);
    AAudioStreamBuilder_setFormat(builder, AAUDIO_FORMAT_PCM_FLOAT);
    AAudioStreamBuilder_setChannelCount(builder, 2);
    AAudioStreamBuilder_setSampleRate(builder, mRequestedSampleRate);
    AAudioStreamBuilder_setDataCallback(builder, dataCallback, this);
    AAudioStreamBuilder_setErrorCallback(builder, errorCallback, this);

    result = AAudioStreamBuilder_openStream(builder, &mStream);
    AAudioStreamBuilder_delete(builder);

    if (result != AAUDIO_OK) {
        LOGE("Error al abrir stream AAudio: %s", AAudio_convertResultToText(result));
        mStream = nullptr;
        return false;
    }

    int actualRate = AAudioStream_getSampleRate(mStream);
    int previousRate = mSampleRate.exchange(actualRate);

    // Buffer doble del burst: menor latencia sin underruns
    int32_t burst = AAudioStream_getFramesPerBurst(mStream);
    if (burst > 0) {
        AAudioStream_setBufferSizeInFrames(mStream, burst * 2);
    }

    if (actualRate != previousRate && mSampleRateListener) {
        mSampleRateListener(actualRate);
    }

    result = AAudioStream_requestStart(mStream);
    if (result != AAUDIO_OK) {
        LOGE("Error al iniciar stream AAudio: %s", AAudio_convertResultToText(result));
        AAudioStream_close(mStream);
        mStream = nullptr;
        return false;
    }

    mIsRunning = true;
    LOGI("[OK] AAudio Stream iniciado a %d Hz (burst %d frames)", actualRate, burst);
    return true;
}

void AudioStream::closeLocked() {
    if (mStream) {
        AAudioStream_requestStop(mStream);
        AAudioStream_close(mStream);
        mStream = nullptr;
    }
    mIsRunning = false;
}

void AudioStream::restartAsync() {
    bool expected = false;
    if (!mRestartPending.compare_exchange_strong(expected, true)) return;

    std::thread([this]() {
        // Pequeña espera para que el sistema termine el cambio de ruta de audio
        std::this_thread::sleep_for(std::chrono::milliseconds(150));
        {
            std::lock_guard<std::mutex> lock(mControlMutex);
            closeLocked();
        }
        // Reintentos con espera creciente hasta que el sistema entregue una salida válida
        for (int attempt = 0; attempt < 40 && mWantRunning.load(); attempt++) {
            bool ok;
            {
                std::lock_guard<std::mutex> lock(mControlMutex);
                if (mIsRunning.load()) break;
                ok = openAndStartLocked();
                if (!ok) closeLocked();
            }
            if (ok) {
                mRestartCount++;
                LOGI("AAudio reabierto (reinicio #%d, intento %d)", mRestartCount.load(), attempt + 1);
                break;
            }
            std::this_thread::sleep_for(std::chrono::milliseconds(attempt < 5 ? 200 : 1000));
        }
        mRestartPending = false;
    }).detach();
}

void AudioStream::stop() {
    std::lock_guard<std::mutex> lock(mControlMutex);
    mWantRunning = false;
    closeLocked();
    LOGI("AAudio Stream detenido");
}
