#ifndef AUDIO_STREAM_H
#define AUDIO_STREAM_H

#include <aaudio/AAudio.h>
#include <android/log.h>
#include <functional>

typedef std::function<void(float* buffer, int numFrames)> AudioCallback;

class AudioStream {
public:
    AudioStream();
    ~AudioStream();

    bool start(AudioCallback callback, int sampleRate = 44100);
    void stop();

    bool isRunning() const { return mIsRunning; }
    int getSampleRate() const { return mSampleRate; }

private:
    static aaudio_data_callback_result_t dataCallback(
        AAudioStream *stream,
        void *userData,
        void *audioData,
        int32_t numFrames
    );

    AAudioStream *mStream;
    AudioCallback mAudioCallback;
    bool mIsRunning;
    int mSampleRate;
};

#endif // AUDIO_STREAM_H
