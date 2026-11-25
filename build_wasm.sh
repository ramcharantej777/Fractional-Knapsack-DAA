#!/usr/bin/env bash
# Build WebAssembly from the same C source (main.c) using Emscripten.
# Prerequisites: Emscripten SDK installed and activated (source emsdk_env.sh).

set -euo pipefail

emcc main.c -O2 -std=c11 -s WASM=1 -s INVOKE_RUN=0 -s EXIT_RUNTIME=0 -s NO_EXIT_RUNTIME=1 \
  -s EXPORTED_RUNTIME_METHODS='["callMain"]' -s FORCE_FILESYSTEM=1 \
  -o knapsack.js

echo "WASM build succeeded: knapsack.js and knapsack.wasm generated."
echo "The frontend will use this build when the native backend is unavailable (e.g. GitHub Pages)."
