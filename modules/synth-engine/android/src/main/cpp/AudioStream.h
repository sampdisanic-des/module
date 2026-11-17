#ifndef AUDIO_STREAM_H
#define AUDIO_STREAM_H

#include <aaudio/AAudio.h>
#include <android/log.h>
#include <atomic>
#include <functional>
#include <mutex>

typedef std::function<void(float* buffer, int numFrames)> AudioCallback;
typedef std::function<void(int sampleRate)> SampleRateCallback;

// Salida AAudio de baja latencia con recuperación automática:
// si el dispositivo de salida cambia (audífonos, Bluetooth, USB) AAudio
// desconecta el stream; aquí se reabre en un hilo aparte sin reiniciar la app.
class AudioStream {
public:
    AudioStream();
    ~AudioStream();

    bool start(AudioCallback callback, int sampleRate = 44100);
    void stop();

    // Se invoca cuando el stream se reabre con una frecuencia distinta
    void setSampleRateListener(SampleRateCallback listener) { mSampleRateListener = listener; }

    bool isRunning() const { return mIsRunning.load(); }
    int getSampleRate() const { return mSampleRate.load(); }
    int getRestartCount() const { return mRestartCount.load(); }

private:
    static aaudio_data_callback_result_t dataCallback(
        AAudioStream *stream,
        void *userData,
        void *audioData,
        int32_t numFrames
    );
    static void errorCallback(AAudioStream *stream, void *userData, aaudio_result_t error);

    bool openAndStartLocked();
    void closeLocked();
    void restartAsync();

    std::mutex mControlMutex;
    AAudioStream *mStream;
    AudioCallback mAudioCallback;
    SampleRateCallback mSampleRateListener;
    std::atomic<bool> mIsRunning;
    std::atomic<bool> mWantRunning;
    std::atomic<bool> mRestartPending;
    std::atomic<int> mSampleRate;
    std::atomic<int> mRestartCount;
    int mRequestedSampleRate;
};

#endif // AUDIO_STREAM_H
