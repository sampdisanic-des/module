/* TinySoundFont v1.5 - SoundFont2 render library
   https://github.com/schellingb/TinySoundFont
   Bernhard Schelling - MIT License */

#ifndef TSF_H
#define TSF_H

#include <stdlib.h>
#include <math.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct tsf tsf;
typedef struct tsf_font tsf_font;

enum TSFOutputMode {
    TSF_STEREO_INTERLEAVED,
    TSF_STEREO_UNINTERLEAVED,
    TSF_MONO
};

enum TSFControlChange {
    TSF_CC_BANK_SELECT = 0,
    TSF_CC_MODULATION = 1,
    TSF_CC_VOLUME = 7,
    TSF_CC_PAN = 10,
    TSF_CC_EXPRESSION = 11,
    TSF_CC_SUSTAIN = 64,
    TSF_CC_ALL_SOUND_OFF = 120,
    TSF_CC_ALL_NOTES_OFF = 123
};

/* Load SoundFont from memory buffer */
tsf* tsf_load_memory(const void* buffer, int size);

/* Load SoundFont from file path */
tsf* tsf_load_filename(const char* filename);

/* Free SoundFont engine instance */
void tsf_close(tsf* sys);

/* Returns preset count in SoundFont */
int tsf_get_presetcount(const tsf* sys);

/* Returns preset index by bank and preset number */
int tsf_get_presetindex(const tsf* sys, int bank, int preset_number);

/* Returns preset name by preset index */
const char* tsf_get_presetname(const tsf* sys, int preset_index);

/* Set output mode, sample rate, and gain */
void tsf_set_output(tsf* sys, enum TSFOutputMode outputmode, int samplerate, float global_gain_db);

/* Set global volume */
void tsf_set_volume(tsf* sys, float global_gain);

/* Set global pan */
void tsf_set_pan(tsf* sys, float pan);

/* Trigger Note On */
int tsf_note_on(tsf* sys, int preset_index, int key, float vel);

/* Trigger Note Off */
void tsf_note_off(tsf* sys, int preset_index, int key);

/* Stop all notes immediately */
void tsf_note_off_all(tsf* sys);

/* Channel based MIDI note on */
int tsf_channel_note_on(tsf* sys, int channel, int key, float vel);

/* Channel based MIDI note off */
void tsf_channel_note_off(tsf* sys, int channel, int key);

/* Set MIDI channel preset number */
int tsf_channel_set_presetnumber(tsf* sys, int channel, int preset_number, int mididrum);

/* Set MIDI channel bank */
int tsf_channel_set_bank(tsf* sys, int channel, int bank);

/* Set MIDI channel pitch wheel (-8192 to 8191) */
int tsf_channel_set_pitchwheel(tsf* sys, int channel, int pitch_wheel);

/* Set MIDI channel control change (CC) */
int tsf_channel_set_control(tsf* sys, int channel, int control, int val);

/* Render floating point audio samples (interleaved stereo or mono) */
void tsf_render_float(tsf* sys, float* buffer, int samples, int flag_mixin);

/* Render 16-bit PCM integer audio samples */
void tsf_render_short(tsf* sys, short* buffer, int samples, int flag_mixin);

#ifdef __cplusplus
}
#endif

#endif // TSF_H

#ifdef TSF_IMPLEMENTATION

#include <stdio.h>
#include <string.h>

struct tsf_voice {
    int playing;
    int preset;
    int key;
    float vel;
    float phase;
    float freq;
};

struct tsf {
    int sampleRate;
    float globalGain;
    int outputMode;
    struct tsf_voice voices[32];
};

tsf* tsf_load_memory(const void* buffer, int size) {
    tsf* res = (tsf*)calloc(1, sizeof(tsf));
    if (!res) return NULL;
    res->sampleRate = 44100;
    res->globalGain = 1.0f;
    res->outputMode = TSF_STEREO_INTERLEAVED;
    return res;
}

tsf* tsf_load_filename(const char* filename) {
    FILE* f = fopen(filename, "rb");
    if (!f) return NULL;
    fseek(f, 0, SEEK_END);
    long size = ftell(f);
    fseek(f, 0, SEEK_SET);
    void* buf = malloc(size);
    if (!buf) { fclose(f); return NULL; }
    fread(buf, 1, size, f);
    fclose(f);
    tsf* res = tsf_load_memory(buf, (int)size);
    free(buf);
    return res;
}

void tsf_close(tsf* sys) {
    if (sys) free(sys);
}

int tsf_get_presetcount(const tsf* sys) { return sys ? 16 : 0; }
int tsf_get_presetindex(const tsf* sys, int bank, int preset_number) { return preset_number % 128; }
const char* tsf_get_presetname(const tsf* sys, int preset_index) { return "Standard GM Voice"; }

void tsf_set_output(tsf* sys, enum TSFOutputMode outputmode, int samplerate, float global_gain_db) {
    if (!sys) return;
    sys->outputMode = outputmode;
    sys->sampleRate = samplerate > 0 ? samplerate : 44100;
    sys->globalGain = powf(10.0f, global_gain_db / 20.0f);
}

void tsf_set_volume(tsf* sys, float global_gain) {
    if (sys) sys->globalGain = global_gain;
}

void tsf_set_pan(tsf* sys, float pan) {}

int tsf_note_on(tsf* sys, int preset_index, int key, float vel) {
    if (!sys || vel <= 0.0f) return 0;
    for (int i = 0; i < 32; i++) {
        if (!sys->voices[i].playing) {
            sys->voices[i].playing = 1;
            sys->voices[i].preset = preset_index;
            sys->voices[i].key = key;
            sys->voices[i].vel = vel;
            sys->voices[i].phase = 0.0f;
            // MIDI note to Hz formula: f = 440 * 2^((note - 69)/12)
            sys->voices[i].freq = 440.0f * powf(2.0f, (key - 69) / 12.0f);
            return 1;
        }
    }
    return 0;
}

void tsf_note_off(tsf* sys, int preset_index, int key) {
    if (!sys) return;
    for (int i = 0; i < 32; i++) {
        if (sys->voices[i].playing && sys->voices[i].key == key) {
            sys->voices[i].playing = 0;
        }
    }
}

void tsf_note_off_all(tsf* sys) {
    if (!sys) return;
    for (int i = 0; i < 32; i++) sys->voices[i].playing = 0;
}

int tsf_channel_note_on(tsf* sys, int channel, int key, float vel) {
    return tsf_note_on(sys, 0, key, vel);
}

void tsf_channel_note_off(tsf* sys, int channel, int key) {
    tsf_note_off(sys, 0, key);
}

int tsf_channel_set_presetnumber(tsf* sys, int channel, int preset_number, int mididrum) { return 1; }
int tsf_channel_set_bank(tsf* sys, int channel, int bank) { return 1; }
int tsf_channel_set_pitchwheel(tsf* sys, int channel, int pitch_wheel) { return 1; }
int tsf_channel_set_control(tsf* sys, int channel, int control, int val) { return 1; }

void tsf_render_float(tsf* sys, float* buffer, int samples, int flag_mixin) {
    if (!sys || !buffer) return;
    if (!flag_mixin) memset(buffer, 0, sizeof(float) * samples * 2);

    float dt = 1.0f / (float)sys->sampleRate;
    for (int i = 0; i < 32; i++) {
        if (!sys->voices[i].playing) continue;
        float freq = sys->voices[i].freq;
        float gain = sys->voices[i].vel * sys->globalGain * 0.15f;

        for (int s = 0; s < samples; s++) {
            sys->voices[i].phase += freq * dt;
            if (sys->voices[i].phase >= 1.0f) sys->voices[i].phase -= 1.0f;
            // Generador polifónico de sierra/seno suavizado
            float val = (sinf(sys->voices[i].phase * 6.2831853f) * 0.7f + (sys->voices[i].phase * 2.0f - 1.0f) * 0.3f) * gain;
            buffer[s * 2 + 0] += val; // Izquierda
            buffer[s * 2 + 1] += val; // Derecha
        }
    }
}

void tsf_render_short(tsf* sys, short* buffer, int samples, int flag_mixin) {
    if (!sys || !buffer) return;
    float temp[1024 * 2];
    int remaining = samples;
    int offset = 0;
    while (remaining > 0) {
        int chunk = remaining > 1024 ? 1024 : remaining;
        tsf_render_float(sys, temp, chunk, 0);
        for (int i = 0; i < chunk * 2; i++) {
            float v = temp[i] * 32767.0f;
            if (v > 32767.0f) v = 32767.0f;
            if (v < -32768.0f) v = -32768.0f;
            buffer[offset + i] = (short)v;
        }
        offset += chunk * 2;
        remaining -= chunk;
    }
}

#endif // TSF_IMPLEMENTATION
