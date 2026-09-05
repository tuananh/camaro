#!/bin/bash

set -eux

export OPTIMIZE="-O3"
BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIR"' EXIT

CORE_FLAGS=(
  -std=gnu++98
  -fno-exceptions
  -fno-rtti
  -Wall
  -Wextra
  -Wshadow
)

echo "1/3 Compiling pugixml and native core"
cp src/pugiconfig.hpp node_modules/pugixml/src/pugiconfig.hpp

emcc \
  "${CORE_FLAGS[@]}" \
  ${OPTIMIZE} \
  -flto \
  -msimd128 \
  -DNDEBUG \
  -I node_modules/pugixml/src \
  -c node_modules/pugixml/src/pugixml.cpp \
  -o "$BUILD_DIR/pugixml.o"

for source in src/camaro.cpp src/json_writer.cpp src/template_parser.cpp; do
  emcc \
    "${CORE_FLAGS[@]}" \
    ${OPTIMIZE} \
    -flto \
    -msimd128 \
    -DNDEBUG \
    -I node_modules/pugixml/src \
    -I src \
    -c "$source" \
    -o "$BUILD_DIR/$(basename "${source%.cpp}").o"
done

echo "2/3 Compiling modern Embind adapter"
emcc \
  -std=gnu++17 \
  -Wall \
  -Wextra \
  -Wshadow \
  ${OPTIMIZE} \
  -flto \
  -msimd128 \
  -DNDEBUG \
  -I src \
  -c src/camaro_bindings.cpp \
  -o "$BUILD_DIR/camaro_bindings.o"

echo "3/3 Linking camaro wasm bindings"
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
  -s 'EXPORT_NAME="pugixml"' \
  -o "$BUILD_DIR/camaro.js" \
  -Wno-deprecated-register \
  -Wno-writable-strings \
  --closure 1 \
  "$BUILD_DIR/pugixml.o" \
  "$BUILD_DIR/camaro.o" \
  "$BUILD_DIR/json_writer.o" \
  "$BUILD_DIR/template_parser.o" \
  "$BUILD_DIR/camaro_bindings.o"

mv "$BUILD_DIR/camaro.js" "$BUILD_DIR/camaro.wasm" dist/

echo "DONE!"
