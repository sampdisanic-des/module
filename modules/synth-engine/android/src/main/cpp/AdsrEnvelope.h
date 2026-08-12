#ifndef ADSR_ENVELOPE_H
#define ADSR_ENVELOPE_H

#include <math.h>

enum AdsrState {
    ADSR_IDLE = 0,
    ADSR_ATTACK,
    ADSR_DECAY,
    ADSR_SUSTAIN,
    ADSR_RELEASE
};

class AdsrEnvelope {
public:
    AdsrEnvelope()
        : mState(ADSR_IDLE),
          mSampleRate(44100.0f),
          mCurrentLevel(0.0f),
          mAttackTimeSec(0.05f),
          mDecayTimeSec(0.2f),
          mSustainLevel(0.8f),
          mReleaseTimeSec(0.3f) {}

    void setSampleRate(float sampleRate) {
        mSampleRate = sampleRate > 0.0f ? sampleRate : 44100.0f;
    }

    void setParameters(float attackSec, float decaySec, float sustainVal, float releaseSec) {
        mAttackTimeSec = attackSec > 0.001f ? attackSec : 0.001f;
        mDecayTimeSec = decaySec > 0.001f ? decaySec : 0.001f;
        mSustainLevel = sustainVal < 0.0f ? 0.0f : (sustainVal > 1.0f ? 1.0f : sustainVal);
        mReleaseTimeSec = releaseSec > 0.001f ? releaseSec : 0.001f;
    }

    void gateOn() {
        mState = ADSR_ATTACK;
    }

    void gateOff() {
        if (mState != ADSR_IDLE) {
            mState = ADSR_RELEASE;
        }
    }

    float getNextSample() {
        float attackStep = 1.0f / (mAttackTimeSec * mSampleRate);
        float decayStep = (1.0f - mSustainLevel) / (mDecayTimeSec * mSampleRate);
        float releaseStep = mSustainLevel / (mReleaseTimeSec * mSampleRate);

        switch (mState) {
            case ADSR_IDLE:
                mCurrentLevel = 0.0f;
                break;

            case ADSR_ATTACK:
                mCurrentLevel += attackStep;
                if (mCurrentLevel >= 1.0f) {
                    mCurrentLevel = 1.0f;
                    mState = ADSR_DECAY;
                }
                break;

            case ADSR_DECAY:
                mCurrentLevel -= decayStep;
                if (mCurrentLevel <= mSustainLevel) {
                    mCurrentLevel = mSustainLevel;
                    mState = ADSR_SUSTAIN;
                }
                break;

            case ADSR_SUSTAIN:
                mCurrentLevel = mSustainLevel;
                break;

            case ADSR_RELEASE:
                mCurrentLevel -= releaseStep;
                if (mCurrentLevel <= 0.0f) {
                    mCurrentLevel = 0.0f;
                    mState = ADSR_IDLE;
                }
                break;
        }

        return mCurrentLevel;
    }

    bool isActive() const {
        return mState != ADSR_IDLE;
    }

private:
    AdsrState mState;
    float mSampleRate;
    float mCurrentLevel;
    float mAttackTimeSec;
    float mDecayTimeSec;
    float mSustainLevel;
    float mReleaseTimeSec;
};

#endif // ADSR_ENVELOPE_H
