#ifndef ADSR_ENVELOPE_H
#define ADSR_ENVELOPE_H

#include <math.h>
#include <algorithm>

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
          mReleaseStartLevel(1.0f),
          mAttackTimeSec(0.005f),
          mDecayTimeSec(0.2f),
          mSustainLevel(1.0f),
          mReleaseTimeSec(0.3f) {}

    void setSampleRate(float sampleRate) {
        mSampleRate = sampleRate > 0.0f ? sampleRate : 44100.0f;
    }

    void setParameters(float attackSec, float decaySec, float sustainVal, float releaseSec) {
        mAttackTimeSec = std::max(0.001f, attackSec);
        mDecayTimeSec = std::max(0.001f, decaySec);
        mSustainLevel = std::max(0.0f, std::min(1.0f, sustainVal));
        mReleaseTimeSec = std::max(0.001f, releaseSec);
    }

    void gateOn() {
        mState = ADSR_ATTACK;
        if (mAttackTimeSec <= 0.005f) {
            mCurrentLevel = 1.0f;
            mState = (mSustainLevel < 0.999f) ? ADSR_DECAY : ADSR_SUSTAIN;
        }
    }

    void gateOff() {
        if (mState != ADSR_IDLE) {
            mReleaseStartLevel = std::max(0.01f, mCurrentLevel);
            mState = ADSR_RELEASE;
        }
    }

    float getNextSample() {
        switch (mState) {
            case ADSR_IDLE:
                mCurrentLevel = 0.0f;
                break;

            case ADSR_ATTACK: {
                float attackStep = 1.0f / (mAttackTimeSec * mSampleRate);
                mCurrentLevel += attackStep;
                if (mCurrentLevel >= 1.0f) {
                    mCurrentLevel = 1.0f;
                    mState = (mSustainLevel < 0.999f) ? ADSR_DECAY : ADSR_SUSTAIN;
                }
                break;
            }

            case ADSR_DECAY: {
                float decayStep = (1.0f - mSustainLevel) / (mDecayTimeSec * mSampleRate);
                mCurrentLevel -= decayStep;
                if (mCurrentLevel <= mSustainLevel) {
                    mCurrentLevel = mSustainLevel;
                    mState = ADSR_SUSTAIN;
                }
                break;
            }

            case ADSR_SUSTAIN:
                mCurrentLevel = mSustainLevel;
                break;

            case ADSR_RELEASE: {
                float releaseStep = mReleaseStartLevel / (mReleaseTimeSec * mSampleRate);
                mCurrentLevel -= releaseStep;
                if (mCurrentLevel <= 0.0001f) {
                    mCurrentLevel = 0.0f;
                    mState = ADSR_IDLE;
                }
                break;
            }
        }

        return mCurrentLevel;
    }

    bool isActive() const {
        return mState != ADSR_IDLE;
    }

    void reset() {
        mState = ADSR_IDLE;
        mCurrentLevel = 0.0f;
    }

private:
    AdsrState mState;
    float mSampleRate;
    float mCurrentLevel;
    float mReleaseStartLevel;
    float mAttackTimeSec;
    float mDecayTimeSec;
    float mSustainLevel;
    float mReleaseTimeSec;
};

#endif // ADSR_ENVELOPE_H
