#!/bin/bash

set -eux

export OPTIMIZE="-O3"
BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIR"' EXIT

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
    -o "$BUILD_DIR/pugixml.o"
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
    -o "$BUILD_DIR/camaro.js" \
    -Wno-deprecated-register \
    -Wno-writable-strings \
    --closure 1 \
    "$BUILD_DIR/pugixml.o" \
    src/camaro.cpp \
    src/json_writer.cpp \
    src/template_parser.cpp
)

mv "$BUILD_DIR/camaro.js" "$BUILD_DIR/camaro.wasm" dist/

echo "DONE!"
