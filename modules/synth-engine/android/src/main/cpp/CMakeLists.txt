cmake_minimum_required(VERSION 3.22.1)
project(synthengine LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}
)

find_library(LOG_LIB log)

add_library(
    synthengine
    SHARED
    OnLoad.cpp
    SynthEngine.cpp
    AudioStream.cpp
    ChordRecognizer.cpp
)

target_link_libraries(
    synthengine
    ${LOG_LIB}
    aaudio
    android
)
