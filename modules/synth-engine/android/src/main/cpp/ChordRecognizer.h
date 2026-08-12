#ifndef CHORDRECOGNIZER_H
#define CHORDRECOGNIZER_H

#include <string>
#include <vector>
#include <set>
#include <mutex>
#include <android/log.h>

struct ChordInfo {
    std::string name;       // Ej: "C", "Am", "G7", "Fmaj7"
    std::string rootNote;   // Ej: "C", "A", "G"
    std::string type;       // Ej: "Maj", "Min", "7", "Maj7", "dim"
    int rootPitchClass;     // 0 = C, 1 = C#, 2 = D ... 11 = B
};

class ChordRecognizer {
public:
    ChordRecognizer();
    ~ChordRecognizer();

    void addNote(int midiNote);
    void removeNote(int midiNote);
    void clearNotes();

    ChordInfo detectChord();
    std::string getActiveNotesString() const;

private:
    std::set<int> mActiveNotes;
    mutable std::mutex mMutex;

    static const std::vector<std::string> NOTE_NAMES;
};

#endif // CHORDRECOGNIZER_H
