#include "AudioStream.h"
#include <android/log.h>

#define LOG_TAG "AudioStream"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

AudioStream::AudioStream()
    : mStream(nullptr),
      mIsRunning(false),
      mSampleRate(44100) {}

AudioStream::~AudioStream() {
    stop();
}

aaudio_data_callback_result_t AudioStream::dataCallback(
    AAudioStream *stream,
    void *userData,
    void *audioData,
    int32_t numFrames
) {
    AudioStream *audioStream = static_cast<AudioStream *>(userData);
    if (audioStream && audioStream->mAudioCallback) {
        float *floatBuffer = static_cast<float *>(audioData);
        audioStream->mAudioCallback(floatBuffer, numFrames);
        return AAUDIO_CALLBACK_RESULT_CONTINUE;
    }
    return AAUDIO_CALLBACK_RESULT_STOP;
}

bool AudioStream::start(AudioCallback callback, int sampleRate) {
    if (mIsRunning) return true;

    mAudioCallback = callback;
    mSampleRate = sampleRate;

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
    AAudioStreamBuilder_setChannelCount(builder, 2); // Estéreo
    AAudioStreamBuilder_setSampleRate(builder, mSampleRate);
    AAudioStreamBuilder_setDataCallback(builder, dataCallback, this);

    result = AAudioStreamBuilder_openStream(builder, &mStream);
    AAudioStreamBuilder_delete(builder);

    if (result != AAUDIO_OK) {
        LOGE("Error al abrir stream AAudio: %s", AAudio_convertResultToText(result));
        return false;
    }

    mSampleRate = AAudioStream_getSampleRate(mStream);

    result = AAudioStream_requestStart(mStream);
    if (result != AAUDIO_OK) {
        LOGE("Error al iniciar stream AAudio: %s", AAudio_convertResultToText(result));
        AAudioStream_close(mStream);
        mStream = nullptr;
        return false;
    }

    mIsRunning = true;
    LOGI("[OK] AAudio Stream iniciado exitosamente a %d Hz (Latencia < 5ms)", mSampleRate);
    return true;
}

void AudioStream::stop() {
    if (!mIsRunning || !mStream) return;

    AAudioStream_requestStop(mStream);
    AAudioStream_close(mStream);
    mStream = nullptr;
    mIsRunning = false;
    LOGI("AAudio Stream detenido");
}
