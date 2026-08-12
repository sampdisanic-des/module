#ifndef BIQUAD_FILTER_H
#define BIQUAD_FILTER_H

#include <math.h>

class BiquadFilter {
public:
    BiquadFilter()
        : mSampleRate(44100.0f),
          mCutoffHz(1000.0f),
          mResonance(1.0f),
          a0(1), a1(0), a2(0), b1(0), b2(0),
          z1_l(0), z2_l(0), z1_r(0), z2_r(0) {
        updateCoefficients();
    }

    void setSampleRate(float sampleRate) {
        mSampleRate = sampleRate > 0.0f ? sampleRate : 44100.0f;
        updateCoefficients();
    }

    void setCutoff(float cutoffHz) {
        // Limit cutoff between 20 Hz and 20000 Hz
        float clamped = cutoffHz < 20.0f ? 20.0f : (cutoffHz > 20000.0f ? 20000.0f : cutoffHz);
        if (fabsf(mCutoffHz - clamped) > 0.1f) {
            mCutoffHz = clamped;
            updateCoefficients();
        }
    }

    void setResonance(float Q) {
        // Limit Q between 0.1 and 10.0
        float clamped = Q < 0.1f ? 0.1f : (Q > 10.0f ? 10.0f : Q);
        if (fabsf(mResonance - clamped) > 0.01f) {
            mResonance = clamped;
            updateCoefficients();
        }
    }

    void processStereo(float* left, float* right) {
        float inL = *left;
        float outL = inL * a0 + z1_l;
        z1_l = inL * a1 + z2_l - b1 * outL;
        z2_l = inL * a2 - b2 * outL;
        *left = outL;

        float inR = *right;
        float outR = inR * a0 + z1_r;
        z1_r = inR * a1 + z2_r - b1 * outR;
        z2_r = inR * a2 - b2 * outR;
        *right = outR;
    }

private:
    void updateCoefficients() {
        // RBJ Low Pass Filter Biquad formulation
        float w0 = 2.0f * 3.1415926535f * mCutoffHz / mSampleRate;
        float cosw0 = cosf(w0);
        float alpha = sinf(w0) / (2.0f * mResonance);

        float b0_raw = (1.0f - cosw0) / 2.0f;
        float b1_raw = 1.0f - cosw0;
        float b2_raw = (1.0f - cosw0) / 2.0f;
        float a0_raw = 1.0f + alpha;
        float a1_raw = -2.0f * cosw0;
        float a2_raw = 1.0f - alpha;

        a0 = b0_raw / a0_raw;
        a1 = b1_raw / a0_raw;
        a2 = b2_raw / a0_raw;
        b1 = a1_raw / a0_raw;
        b2 = a2_raw / a0_raw;
    }

    float mSampleRate;
    float mCutoffHz;
    float mResonance;

    float a0, a1, a2, b1, b2;
    float z1_l, z2_l;
    float z1_r, z2_r;
};

#endif // BIQUAD_FILTER_H
