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

ChordInfo ChordRecognizer::detectChord() {
    std::lock_guard<std::mutex> lock(mMutex);
    ChordInfo result = {"---", "N/A", "N/A", -1};

    if (mActiveNotes.empty()) {
        return result;
    }

    // Extraer Pitch Classes únicos (0 a 11)
    std::set<int> pitchClasses;
    int lowestNote = 128;
    for (int note : mActiveNotes) {
        pitchClasses.insert(note % 12);
        if (note < lowestNote) {
            lowestNote = note;
        }
    }

    if (pitchClasses.empty()) {
        return result;
    }

    int rootPC = lowestNote % 12;
    std::string rootName = NOTE_NAMES[rootPC];

    // Single note -> Single Note / Bass
    if (pitchClasses.size() == 1) {
        result.name = rootName;
        result.rootNote = rootName;
        result.type = "Single Note";
        result.rootPitchClass = rootPC;
        return result;
    }

    // Probar cada pitch class como posible tónica (Root)
    for (int possibleRoot : pitchClasses) {
        // Calcular intervalos relativos a la tónica
        std::set<int> intervals;
        for (int pc : pitchClasses) {
            int interval = (pc - possibleRoot + 12) % 12;
            intervals.insert(interval);
        }

        bool has3m = intervals.count(3) > 0;
        bool has3M = intervals.count(4) > 0;
        bool has5P = intervals.count(7) > 0;
        bool has5d = intervals.count(6) > 0;
        bool has5A = intervals.count(8) > 0;
        bool has7m = intervals.count(10) > 0;
        bool has7M = intervals.count(11) > 0;
        bool hasSus2 = intervals.count(2) > 0;
        bool hasSus4 = intervals.count(5) > 0;

        std::string pRootName = NOTE_NAMES[possibleRoot];

        // Mayor (0, 4, 7)
        if (has3M && has5P && !has7m && !has7M) {
            result.name = pRootName;
            result.rootNote = pRootName;
            result.type = "Maj";
            result.rootPitchClass = possibleRoot;
            return result;
        }
        // Menor (0, 3, 7)
        if (has3m && has5P && !has7m && !has7M) {
            result.name = pRootName + "m";
            result.rootNote = pRootName;
            result.type = "Min";
            result.rootPitchClass = possibleRoot;
            return result;
        }
        // Dominante 7 (0, 4, 7, 10)
        if (has3M && has7m) {
            result.name = pRootName + "7";
            result.rootNote = pRootName;
            result.type = "7";
            result.rootPitchClass = possibleRoot;
            return result;
        }
        // Mayor 7 (0, 4, 7, 11)
        if (has3M && has7M) {
            result.name = pRootName + "Maj7";
            result.rootNote = pRootName;
            result.type = "Maj7";
            result.rootPitchClass = possibleRoot;
            return result;
        }
        // Menor 7 (0, 3, 7, 10)
        if (has3m && has7m) {
            result.name = pRootName + "m7";
            result.rootNote = pRootName;
            result.type = "m7";
            result.rootPitchClass = possibleRoot;
            return result;
        }
        // Disminuido (0, 3, 6)
        if (has3m && has5d) {
            result.name = pRootName + "dim";
            result.rootNote = pRootName;
            result.type = "dim";
            result.rootPitchClass = possibleRoot;
            return result;
        }
        // Sus4 (0, 5, 7)
        if (hasSus4 && has5P) {
            result.name = pRootName + "sus4";
            result.rootNote = pRootName;
            result.type = "sus4";
            result.rootPitchClass = possibleRoot;
            return result;
        }
        // Sus2 (0, 2, 7)
        if (hasSus2 && has5P) {
            result.name = pRootName + "sus2";
            result.rootNote = pRootName;
            result.type = "sus2";
            result.rootPitchClass = possibleRoot;
            return result;
        }
    }

    // Fallback: usar la nota más grave como tónica
    result.name = rootName;
    result.rootNote = rootName;
    result.type = "Custom";
    result.rootPitchClass = rootPC;
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
