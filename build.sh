#!/bin/bash

set -eux

export OPTIMIZE="-O3"

echo "1/2 Compiling pugixml"

cp src/pugiconfig.hpp node_modules/pugixml/src/pugiconfig.hpp

(
  emcc \
    --bind \
    ${OPTIMIZE} \
    -flto \
    -msimd128 \
    -DNDEBUG \
    -s 'ALLOW_MEMORY_GROWTH=1' \
    -s 'EXPORT_NAME="pugixml"' \
    -I node_modules/pugixml/src \
    -c node_modules/pugixml/src/pugixml.cpp \
    -o ./dist/pugixml.o
)

echo "2/2 Compiling camaro wasm bindings"
(
  emcc \
    --bind \
    ${OPTIMIZE} \
    -flto \
    -msimd128 \
    -DNDEBUG \
    -s 'MALLOC="emmalloc"' \
    -s EXPORTED_FUNCTIONS='["_malloc","_free"]' \
    -s 'EXPORTED_RUNTIME_METHODS=[HEAPU8]' \
    -s 'ALLOW_MEMORY_GROWTH=1' \
    -I node_modules/pugixml/src \
    -I src \
    -o dist/camaro.js \
    -Wno-deprecated-register \
    -Wno-writable-strings \
    --closure 1 \
    dist/*.o \
    src/camaro.cpp \
    src/json_writer.cpp \
    src/template_parser.cpp
)

echo "DONE!"

echo "Run \`docker pull emscripten/emsdk\` to get latest docker image"
