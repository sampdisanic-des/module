#include "ChordRecognizer.h"
#include <algorithm>
#include <sstream>

const std::vector<std::string> ChordRecognizer::NOTE_NAMES = {
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"
};

ChordRecognizer::ChordRecognizer() {}
ChordRecognizer::~ChordRecognizer() {}

void ChordRecognizer::addNote(int midiNote) {
    std::lock_guard<std::mutex> lock(mMutex);
    mActiveNotes.insert(midiNote);
}

void ChordRecognizer::removeNote(int midiNote) {
    std::lock_guard<std::mutex> lock(mMutex);
    mActiveNotes.erase(midiNote);
}

void ChordRecognizer::clearNotes() {
    std::lock_guard<std::mutex> lock(mMutex);
    mActiveNotes.clear();
}

bool ChordRecognizer::hasActiveNotes() const {
    std::lock_guard<std::mutex> lock(mMutex);
    return !mActiveNotes.empty();
}

namespace {
struct ChordTemplate {
    const char* type;      // identificador interno (usado por el armonizador)
    const char* suffix;    // sufijo visible
    int required[4];       // intervalos obligatorios (terminados en -1)
    int forbidden[4];      // intervalos que invalidan el acorde (terminados en -1)
};

// Orden: los acordes más específicos (4 notas) primero
const ChordTemplate kTemplates[] = {
    {"Maj7", "Maj7", {4, 7, 11, -1}, {3, 10, -1, -1}},
    {"7",    "7",    {4, 10, -1, -1}, {3, 11, -1, -1}},
    {"m7b5", "m7b5", {3, 6, 10, -1},  {4, 7, -1, -1}},
    {"m7",   "m7",   {3, 7, 10, -1},  {4, 11, -1, -1}},
    {"dim",  "dim",  {3, 6, -1, -1},  {4, 7, 10, -1}},
    {"aug",  "aug",  {4, 8, -1, -1},  {7, 3, -1, -1}},
    {"Maj",  "",     {4, 7, -1, -1},  {3, 10, 11, -1}},
    {"Min",  "m",    {3, 7, -1, -1},  {4, 10, 11, -1}},
    {"sus4", "sus4", {5, 7, -1, -1},  {3, 4, -1, -1}},
    {"sus2", "sus2", {2, 7, -1, -1},  {3, 4, 5, -1}},
    // Acordes incompletos de dos notas (quinta omitida)
    {"Maj",  "",     {4, -1, -1, -1}, {3, 6, 8, 10}},
    {"Min",  "m",    {3, -1, -1, -1}, {4, 6, 8, 10}},
};

bool matches(const ChordTemplate& t, const std::set<int>& intervals) {
    for (int i = 0; i < 4 && t.required[i] >= 0; i++) {
        if (!intervals.count(t.required[i])) return false;
    }
    for (int i = 0; i < 4 && t.forbidden[i] >= 0; i++) {
        if (intervals.count(t.forbidden[i])) return false;
    }
    return true;
}
} // namespace

ChordInfo ChordRecognizer::detectChord() {
    std::lock_guard<std::mutex> lock(mMutex);
    ChordInfo result = {"---", "N/A", "N/A", -1};

    if (mActiveNotes.empty()) {
        return result;
    }

    std::set<int> pitchClasses;
    for (int note : mActiveNotes) pitchClasses.insert(note % 12);

    // std::set está ordenado: el primero es la nota más grave (bajo)
    int bassPC = (*mActiveNotes.begin()) % 12;

    if (pitchClasses.size() == 1) {
        // Modo "single finger": una sola nota = acorde mayor de esa tónica
        result.name = NOTE_NAMES[bassPC];
        result.rootNote = NOTE_NAMES[bassPC];
        result.type = "Maj";
        result.rootPitchClass = bassPC;
        return result;
    }

    // Candidatos a tónica: primero el bajo (posición fundamental), luego el resto
    std::vector<int> candidates;
    candidates.push_back(bassPC);
    for (int pc : pitchClasses) {
        if (pc != bassPC) candidates.push_back(pc);
    }

    for (const auto& tmpl : kTemplates) {
        for (int root : candidates) {
            std::set<int> intervals;
            for (int pc : pitchClasses) intervals.insert((pc - root + 12) % 12);
            if (matches(tmpl, intervals)) {
                result.rootNote = NOTE_NAMES[root];
                result.type = tmpl.type;
                result.rootPitchClass = root;
                result.name = NOTE_NAMES[root] + tmpl.suffix;
                if (root != bassPC) {
                    result.name += "/" + NOTE_NAMES[bassPC];
                }
                return result;
            }
        }
    }

    // Sin coincidencia: el bajo define la tónica en mayor
    result.name = NOTE_NAMES[bassPC];
    result.rootNote = NOTE_NAMES[bassPC];
    result.type = "Maj";
    result.rootPitchClass = bassPC;
    return result;
}

std::string ChordRecognizer::getActiveNotesString() const {
    std::lock_guard<std::mutex> lock(mMutex);
    std::stringstream ss;
    bool first = true;
    for (int note : mActiveNotes) {
        if (!first) ss << ", ";
        ss << NOTE_NAMES[note % 12] << (note / 12 - 1);
        first = false;
    }
    return ss.str();
}
