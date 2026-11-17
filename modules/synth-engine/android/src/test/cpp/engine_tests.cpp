// Pruebas nativas del motor SynthConnect.
// Se compilan con el NDK y se ejecutan en el dispositivo vía adb:
//   bash modules/synth-engine/scripts/run-native-tests.sh
// Uso directo: engine_tests /data/local/tmp/default.sf2
#include "SynthEngine.h"
#include "ChordRecognizer.h"
#include <cmath>
#include <cstdio>
#include <string>
#include <vector>

static int gFailures = 0;
static int gChecks = 0;

#define CHECK(cond, msg)                                                      \
    do {                                                                      \
        gChecks++;                                                            \
        if (!(cond)) {                                                        \
            gFailures++;                                                      \
            printf("  [FALLA] %s  (%s:%d)\n", msg, __FILE__, __LINE__);       \
        }                                                                     \
    } while (0)

static const int SR = 48000;

static float renderRms(SynthEngine& e, int frames) {
    std::vector<float> buf(frames * 2);
    e.renderForTest(buf.data(), frames);
    double acc = 0;
    for (float v : buf) acc += (double)v * v;
    return (float)std::sqrt(acc / buf.size());
}

static void renderSeconds(SynthEngine& e, float seconds) {
    int frames = (int)(seconds * SR);
    std::vector<float> buf(512 * 2);
    for (int done = 0; done < frames; done += 512) e.renderForTest(buf.data(), 512);
}

static int ticksToFrames(double ticks, int bpm, int ppq) {
    return (int)std::ceil(ticks * 60.0 * SR / ((double)bpm * ppq));
}

static void renderTicks(SynthEngine& e, double ticks, int bpm = 120, int ppq = 480) {
    int frames = ticksToFrames(ticks, bpm, ppq);
    std::vector<float> buf(256 * 2);
    while (frames > 0) {
        int n = frames < 256 ? frames : 256;
        e.renderForTest(buf.data(), n);
        frames -= n;
    }
}

static ChordInfo chordOf(std::initializer_list<int> notes) {
    ChordRecognizer r;
    for (int n : notes) r.addNote(n);
    return r.detectChord();
}

static void testChordRecognizer() {
    printf("Reconocedor de acordes\n");
    CHECK(chordOf({48, 52, 55}).name == "C", "C E G = C");
    CHECK(chordOf({45, 48, 52}).name == "Am", "A C E = Am");
    CHECK(chordOf({45, 48, 52}).type == "Min", "Am tipo Min");
    CHECK(chordOf({52, 55, 60}).name == "C/E", "E G C = C/E (inversión)");
    CHECK(chordOf({52, 55, 60}).rootPitchClass == 0, "C/E tónica C");
    CHECK(chordOf({43, 47, 50, 53}).name == "G7", "G B D F = G7");
    CHECK(chordOf({48, 52, 55, 59}).name == "CMaj7", "C E G B = CMaj7");
    CHECK(chordOf({50, 53, 57, 60}).name == "Dm7", "D F A C = Dm7");
    CHECK(chordOf({47, 50, 53, 57}).name == "Bm7b5", "B D F A = Bm7b5");
    CHECK(chordOf({48, 51, 54}).name == "Cdim", "C Eb Gb = Cdim");
    CHECK(chordOf({48, 52, 56}).type == "aug", "C E G# = aumentado");
    CHECK(chordOf({48, 53, 55}).name == "Csus4", "C F G = Csus4");
    CHECK(chordOf({50}).name == "D", "una nota = mayor (single finger)");
    CHECK(chordOf({45, 48}).name == "Am", "A C = Am (sin quinta)");
    CHECK(chordOf({}).name == "---", "sin notas = ---");
}

static void testHarmonizer(SynthEngine& e) {
    printf("Armonizador (patrón en C)\n");
    e.setStyleAccompaniment(true);
    e.setSplitPoint(60);
    // Am
    e.noteOn(45, 100); e.noteOn(48, 100); e.noteOn(52, 100);
    CHECK(e.getDetectedChord() == "Am", "acorde detectado Am");
    CHECK(e.harmonizeForTest(60) % 12 == 9, "C -> A (tónica)");
    CHECK(e.harmonizeForTest(64) % 12 == 0, "E -> C (tercera menor)");
    CHECK(e.harmonizeForTest(67) % 12 == 4, "G -> E (quinta)");
    CHECK(std::abs(e.harmonizeForTest(60) - 60) <= 6, "registro cercano (sin saltar de octava)");
    e.noteOff(45); e.noteOff(48); e.noteOff(52);
    CHECK(e.getDetectedChord() == "Am", "memoria de acorde al soltar la mano");
    // G7
    e.noteOn(43, 100); e.noteOn(47, 100); e.noteOn(50, 100); e.noteOn(53, 100);
    CHECK(e.getDetectedChord() == "G7", "acorde detectado G7");
    CHECK(e.harmonizeForTest(71) % 12 == 5, "B (7ma mayor) -> F (7ma menor de G)");
    CHECK(e.harmonizeForTest(64) % 12 == 11, "E -> B (tercera de G)");
    e.noteOff(43); e.noteOff(47); e.noteOff(50); e.noteOff(53);
    e.setSplitPoint(60); // limpia el acorde
}

static std::string evt(int tick, int dur, int ch, int note, int vel = 100, int prog = -1, int drum = 0) {
    char b[96];
    snprintf(b, sizeof b, "%d,%d,%d,%d,%d,%d,%d;", tick, dur, ch, note, vel, prog, drum);
    return b;
}

static void loadTestStyle(SynthEngine& e) {
    e.clearStyleData();
    e.setStylePpq(480);
    std::string mainA, mainB, fillA, ending, intro;
    for (int bar = 0; bar < 4; bar++) {
        int b = bar * 1920;
        mainA += evt(b, 120, 10, 36, 100, -1, 1);
        mainA += evt(b + 960, 120, 10, 38, 100, -1, 1);
        mainA += evt(b, 1800, 12, 60, 90, 0);
        mainB += evt(b, 120, 10, 36, 100, -1, 1);
    }
    mainA += evt(7600, 480, 11, 36, 100, 33); // cruza el final del loop (7680)
    fillA += evt(0, 120, 10, 38) + evt(960, 120, 10, 38);
    ending += evt(0, 960, 12, 60) + evt(0, 120, 10, 49, 100, -1, 1);
    intro += evt(0, 120, 10, 37, 100, -1, 1);
    e.loadStyleSectionEvents("MAIN_A", 7680, mainA);
    e.loadStyleSectionEvents("MAIN_B", 7680, mainB);
    e.loadStyleSectionEvents("FILL_A", 1920, fillA);
    e.loadStyleSectionEvents("FILL_C", 960, evt(0, 120, 10, 38) + evt(480, 120, 10, 38)); // fill de 2 tiempos
    e.loadStyleSectionEvents("ENDING_A", 1920, ending);
    e.loadStyleSectionEvents("INTRO_A", 1920, intro);
    e.setStyleSection("MAIN_A");
}

static void testSequencer(SynthEngine& e) {
    printf("Secuenciador de estilos\n");
    loadTestStyle(e);
    e.setStyleAccompaniment(true);
    e.startStylePlayback(120, true);
    CHECK(e.isStylePlaying(), "reproduce tras START");
    CHECK(e.getCurrentSection() == "MAIN_A", "inicia en MAIN_A");

    renderTicks(e, 960 + 10);
    CHECK(e.getCurrentBeat() == 3, "beat 3 a mitad del compás");

    // Nota que cruza el loop: tick 7600 + 480 = 8080 -> debe apagarse en tick 400 del loop siguiente
    renderTicks(e, 7680 - 970 + 200);
    bool bassActive = false;
    for (auto& n : e.activeStyleNotesForTest()) bassActive |= (n.sourceNote == 36 && !n.isDrum);
    CHECK(bassActive, "bajo que cruza el loop sigue sonando justo después del reinicio");
    renderTicks(e, 300);
    bassActive = false;
    for (auto& n : e.activeStyleNotesForTest()) bassActive |= (n.sourceNote == 36 && !n.isDrum);
    CHECK(!bassActive, "bajo que cruza el loop se apaga a tiempo (sin notas pegadas)");

    // Cambio de variación: ocurre en la siguiente barra, no al final de la sección
    e.queueNextStyleSection("MAIN_B");
    CHECK(e.getQueuedSection() == "MAIN_B", "MAIN_B en cola");
    renderTicks(e, 1920);
    CHECK(e.getCurrentSection() == "MAIN_B", "MAIN_B entra en la siguiente barra");
    CHECK(e.getQueuedSection().empty(), "cola vacía tras el cambio");

    // Fill: entra de inmediato manteniendo la posición del compás y vuelve a MAIN_A
    e.setStyleSection("MAIN_A"); // en reproducción -> cola
    renderTicks(e, 1920);
    CHECK(e.getCurrentSection() == "MAIN_A", "regresa a MAIN_A");
    renderTicks(e, 500);
    double before = e.currentTickForTest();
    e.setStyleSection("FILL_A");
    CHECK(e.getCurrentSection() == "FILL_A", "FILL_A inmediato");
    CHECK(std::fabs(e.currentTickForTest() - std::fmod(before, 1920.0)) < 1.0, "fill conserva posición en el compás");
    renderTicks(e, 1920);
    CHECK(e.getCurrentSection() == "MAIN_A", "tras el fill vuelve a MAIN_A");

    // Fill corto (2 tiempos) tocado al final del compás: se alinea para terminar en la barra
    {
        double pos = std::fmod(e.currentTickForTest(), 1920.0);
        double toTarget = std::fmod(1680.0 - pos + 1920.0, 1920.0); // ir al tiempo 4.5 del compás
        renderTicks(e, toTarget < 1.0 ? toTarget + 1920.0 : toTarget);
        e.setStyleSection("FILL_C");
        CHECK(std::fabs(e.currentTickForTest() - 720.0) < 3.0, "fill corto se alinea para terminar en la barra");
        renderTicks(e, 250);
        CHECK(e.getCurrentSection() == "MAIN_C" || e.getCurrentSection() == "MAIN_A", "tras fill corto vuelve a una MAIN");
        CHECK(std::fmod(e.currentTickForTest(), 1920.0) < 20.0, "MAIN retoma al inicio del compás");
    }
    // Fill corto tocado al inicio del compás: la MAIN retoma a mitad de compás sin descuadrarse
    e.queueNextStyleSection("MAIN_A");
    renderTicks(e, 1920);
    {
        double pos = std::fmod(e.currentTickForTest(), 1920.0);
        renderTicks(e, 1920.0 - pos + 100.0);
        e.setStyleSection("FILL_C");
        renderTicks(e, 960);
        CHECK(e.getCurrentSection().rfind("MAIN_", 0) == 0, "fill corto terminó");
        CHECK(std::fabs(std::fmod(e.currentTickForTest(), 1920.0) - 1060.0) < 5.0, "MAIN conserva la rejilla del compás");
        CHECK(e.getCurrentBeat() == 3, "beat correcto tras fill corto");
    }
    e.queueNextStyleSection("MAIN_A");
    renderTicks(e, 1920);

    // Fill inexistente -> cambia a la variación destino en la próxima barra
    e.setStyleSection("FILL_B");
    renderTicks(e, 1920);
    CHECK(e.getCurrentSection() == "MAIN_B", "FILL_B inexistente lleva a MAIN_B");

    // Ending: suena y detiene el ritmo
    e.queueNextStyleSection("ENDING_A");
    renderTicks(e, 1920 * 2 + 50);
    CHECK(!e.isStylePlaying(), "ENDING detiene el ritmo");
    CHECK(e.activeStyleNotesForTest().empty(), "sin notas activas tras ENDING");
    CHECK(e.getCurrentSection() == "MAIN_B", "tras ENDING vuelve a la última MAIN");

    // Intro -> Main
    e.setStyleSection("INTRO_A");
    e.startStylePlayback(120, true);
    CHECK(e.getCurrentSection() == "INTRO_A", "inicia en INTRO_A");
    renderTicks(e, 1920 + 20);
    CHECK(e.getCurrentSection() == "MAIN_B", "INTRO pasa a la MAIN seleccionada");
    e.stopStylePlayback();
    CHECK(e.activeStyleNotesForTest().empty(), "STOP limpia notas activas");

    // Sync start
    e.setStyleAccompaniment(true);
    e.setSyncStart(true);
    CHECK(e.isSyncStartArmed(), "sync start armado");
    e.noteOn(72, 100); e.noteOff(72);
    CHECK(!e.isStylePlaying(), "con ACMP la mano derecha no dispara sync start");
    e.noteOn(48, 100);
    CHECK(e.isStylePlaying(), "nota de mano izquierda dispara sync start");
    CHECK(!e.isSyncStartArmed(), "sync start se desarma al iniciar");
    e.noteOff(48);
    e.stopStylePlayback();
    e.setSplitPoint(60);
}

static void quiet(SynthEngine& e) {
    e.allNotesOff();
    renderSeconds(e, 7.0f);
}

static void testLayersAndPedal(SynthEngine& e) {
    printf("Capas, pedal y envolvente\n");
    e.setStyleAccompaniment(false);
    for (int i = 0; i < 4; i++) e.setLayerMix(i, 0.8f, i != 0, false); // solo F1
    e.setLayerVoice(0, "Piano", 0, "");
    e.setLayerParam(0, "attack", 0);
    e.setLayerParam(0, "release", 30);
    quiet(e);

    CHECK(renderRms(e, 4800) < 1e-4f, "silencio inicial");
    e.noteOn(60, 110);
    float on = renderRms(e, 4800);
    CHECK(on > 1e-3f, "nota suena en F1");
    e.noteOff(60);
    renderSeconds(e, 2.0f);
    CHECK(renderRms(e, 4800) < 1e-4f, "sin pedal: la nota se apaga (sin notas pegadas)");

    // Pedal de sustain
    e.controlChange(0, 64, 127);
    e.noteOn(60, 110);
    renderRms(e, 4800);
    e.noteOff(60);
    renderSeconds(e, 1.0f);
    float held = renderRms(e, 4800);
    CHECK(held > 1e-4f, "con pedal: la nota sigue sonando tras soltar la tecla");
    e.controlChange(0, 64, 0);
    renderSeconds(e, 2.0f);
    CHECK(renderRms(e, 4800) < 1e-4f, "al soltar el pedal la nota termina");

    // Octava cambiada con la tecla presionada: el Note Off debe apagar la nota correcta
    e.noteOn(64, 110);
    e.setLayerOctave(0, 2);
    e.noteOff(64);
    e.setLayerOctave(0, 0);
    renderSeconds(e, 2.0f);
    CHECK(renderRms(e, 4800) < 1e-4f, "Note Off correcto tras cambiar octava");

    // Capa en mute después del Note On: igual se debe apagar
    e.noteOn(67, 110);
    e.setLayerMix(0, 0.8f, true, false);
    e.noteOff(67);
    e.setLayerMix(0, 0.8f, false, false);
    renderSeconds(e, 2.0f);
    CHECK(renderRms(e, 4800) < 1e-4f, "Note Off correcto aunque la capa se silenció");

    // Envolvente por voz: ataque lento reduce el inicio
    e.noteOn(60, 110);
    float fastStart = renderRms(e, 2400);
    e.noteOff(60);
    quiet(e);
    e.setLayerParam(0, "attack", 100);
    e.noteOn(60, 110);
    float slowStart = renderRms(e, 2400);
    e.noteOff(60);
    CHECK(slowStart < fastStart * 0.25f, "ATTACK lento suaviza el inicio de la nota");
    e.setLayerParam(0, "attack", 0);
    quiet(e);

    // Mano izquierda con ACMP: solo controla acordes
    e.setStyleAccompaniment(true);
    e.noteOn(48, 110);
    CHECK(renderRms(e, 4800) < 1e-4f, "con ACMP la mano izquierda no suena en los faders");
    e.noteOff(48);
    e.setStyleAccompaniment(false);
    e.noteOn(48, 110);
    CHECK(renderRms(e, 4800) > 1e-3f, "sin ACMP la mano izquierda suena");
    e.noteOff(48);
    quiet(e);

    // Resolución de presets por número GM
    e.setLayerVoice(1, "Warm Pad", 89, "");
    std::string pad = e.layerPresetNameForTest(1);
    printf("  preset GM 89 -> \"%s\"\n", pad.c_str());
    e.setLayerVoice(2, "Strings", 48, "");
    printf("  preset GM 48 -> \"%s\"\n", e.layerPresetNameForTest(2).c_str());
    CHECK(!pad.empty(), "preset GM 89 resuelto");

    // Nivel de los medidores VU
    e.noteOn(60, 120);
    renderRms(e, 2400);
    float levels[4];
    e.getChannelLevels(levels);
    CHECK(levels[0] > 0.05f, "medidor F1 refleja el audio");
    CHECK(levels[1] == 0.0f, "medidor F2 en mute queda en cero");
    e.noteOff(60);
    quiet(e);
}

static void testStylesAudio(SynthEngine& e) {
    printf("Audio del acompañamiento\n");
    for (int i = 0; i < 4; i++) e.setLayerMix(i, 0.8f, true, false);
    quiet(e);
    loadTestStyle(e);
    e.startStylePlayback(120, false);
    float drums = renderRms(e, 9600);
    CHECK(drums > 1e-3f, "la batería suena (canal de batería inicializado)");
    e.stopStylePlayback();
    renderSeconds(e, 3.0f);
    CHECK(renderRms(e, 4800) < 1e-4f, "STOP silencia el estilo");
}

static void testLongRunStability(SynthEngine& e) {
    printf("Estabilidad (60 s de ritmo + notas)\n");
    loadTestStyle(e);
    for (int i = 0; i < 4; i++) e.setLayerMix(i, 0.7f, false, false);
    e.startStylePlayback(140, true);
    std::vector<float> buf(192 * 2);
    float maxAbs = 0;
    bool nan = false;
    for (int block = 0; block < (60 * SR) / 192; block++) {
        if (block % 50 == 0) e.noteOn(40 + (block / 50) % 12, 100);
        if (block % 50 == 25) e.noteOff(40 + (block / 50) % 12);
        if (block % 70 == 0) e.noteOn(65 + (block / 70) % 12, 100);
        if (block % 70 == 35) e.noteOff(65 + (block / 70) % 12);
        e.renderForTest(buf.data(), 192);
        for (float v : buf) {
            if (std::isnan(v) || std::isinf(v)) nan = true;
            if (std::fabs(v) > maxAbs) maxAbs = std::fabs(v);
        }
    }
    CHECK(!nan, "sin NaN/Inf en la salida");
    CHECK(maxAbs <= 1.0f, "salida dentro de [-1, 1] (limitador)");
    CHECK(e.activeStyleNotesForTest().size() < 64, "notas activas acotadas");
    e.stopStylePlayback();
    e.allNotesOff();
}

int main(int argc, char** argv) {
    testChordRecognizer();

    const char* font = argc > 1 ? argv[1] : "/data/local/tmp/default.sf2";
    SynthEngine& e = SynthEngine::getInstance();
    e.setSampleRateForTest(SR);
    if (!e.loadSoundFont(font)) {
        printf("No se pudo cargar %s\n", font);
        return 2;
    }
    testHarmonizer(e);
    testSequencer(e);
    testLayersAndPedal(e);
    testStylesAudio(e);
    testLongRunStability(e);

    printf("\n%d verificaciones, %d fallas\n", gChecks, gFailures);
    return gFailures == 0 ? 0 : 1;
}
