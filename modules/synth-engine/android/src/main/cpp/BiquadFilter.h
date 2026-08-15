#ifndef BIQUAD_FILTER_H
#define BIQUAD_FILTER_H

#include <cmath>

class BiquadFilter {
public:
    BiquadFilter()
        : mSampleRate(44100.0f),
          mCutoffHz(20000.0f),
          mResonance(1.0f),
          mBypass(true),
          a0(1.0f), a1(0.0f), a2(0.0f), b1(0.0f), b2(0.0f),
          z1_l(0.0f), z2_l(0.0f), z1_r(0.0f), z2_r(0.0f) {
        updateCoefficients();
    }

    void setSampleRate(float sampleRate) {
        mSampleRate = sampleRate > 0.0f ? sampleRate : 44100.0f;
        updateCoefficients();
    }

    void setCutoff(float cutoffHz) {
        float maxCutoff = mSampleRate * 0.45f;
        float clamped = cutoffHz < 30.0f ? 30.0f : (cutoffHz > maxCutoff ? maxCutoff : cutoffHz);
        if (std::abs(mCutoffHz - clamped) > 0.1f) {
            mCutoffHz = clamped;
            mBypass = (mCutoffHz >= 17000.0f && mResonance <= 1.05f);
            updateCoefficients();
        }
    }

    void setResonance(float Q) {
        float clamped = Q < 0.2f ? 0.2f : (Q > 8.0f ? 8.0f : Q);
        if (std::abs(mResonance - clamped) > 0.01f) {
            mResonance = clamped;
            mBypass = (mCutoffHz >= 17000.0f && mResonance <= 1.05f);
            updateCoefficients();
        }
    }

    inline void processStereo(float* left, float* right) {
        if (mBypass) return;

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

    void reset() {
        z1_l = z2_l = z1_r = z2_r = 0.0f;
    }

private:
    void updateCoefficients() {
        if (mBypass) return;

        // Formulación RBJ Low Pass Filter Biquad
        float w0 = 2.0f * 3.14159265358979323846f * mCutoffHz / mSampleRate;
        float cosw0 = cosf(w0);
        float alpha = sinf(w0) / (2.0f * mResonance);

        float b0_raw = (1.0f - cosw0) * 0.5f;
        float b1_raw = 1.0f - cosw0;
        float b2_raw = (1.0f - cosw0) * 0.5f;
        float a0_raw = 1.0f + alpha;
        float a1_raw = -2.0f * cosw0;
        float a2_raw = 1.0f - alpha;

        if (std::abs(a0_raw) > 1e-6f) {
            a0 = b0_raw / a0_raw;
            a1 = b1_raw / a0_raw;
            a2 = b2_raw / a0_raw;
            b1 = a1_raw / a0_raw;
            b2 = a2_raw / a0_raw;
        }
    }

    float mSampleRate;
    float mCutoffHz;
    float mResonance;
    bool mBypass;

    float a0, a1, a2, b1, b2;
    float z1_l, z2_l;
    float z1_r, z2_r;
};

#endif // BIQUAD_FILTER_H
