#!/bin/bash

set -e

export OPTIMIZE="-Os"
export LDFLAGS="${OPTIMIZE}"
export CFLAGS="${OPTIMIZE}"
export CPPFLAGS="${OPTIMIZE}"

echo "============================================="
echo "Compiling pugixml"
echo "============================================="
(
  emcc \
    --bind \
    ${OPTIMIZE} \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s MODULARIZE=1 \
    -s 'EXPORT_NAME="pugixml"' \
    -I node_modules/pugixml/src \
    -c node_modules/pugixml/src/pugixml.cpp
)

echo "============================================="
echo "Compiling nlohmann/json"
echo "============================================="
(
  emcc \
    --bind \
    ${OPTIMIZE} \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s MODULARIZE=1 \
    -s 'EXPORT_NAME="json"' \
    -I node_modules/json/single_include/nlohmann \
    -c node_modules/json/single_include/nlohmann/json.hpp
)

echo "============================================="
echo "Compiling wasm module"
echo "============================================="
(
  emcc \
    --bind \
    ${OPTIMIZE} \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s MODULARIZE=1 \
    -s 'EXPORT_NAME="camaro"' \
    -I node_modules/pugixml/src \
    -I node_modules/json/single_include/nlohmann \
    -I node_modules/node-addon-api \
    -I node_modules/node-addon-api/src \
    -o ./camaro.js \
    --std=c++11 *.o \
    -x c++ \
    camaro.cpp
)
echo "============================================="
echo "Compiling wasm module done"
echo "============================================="

echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
echo "Did you update your docker image?"
echo "Run \`docker pull trzeci/emscripten\`"
echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
