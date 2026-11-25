@echo off
REM Build WebAssembly from the same C source (main.c) using Emscripten.
REM Prerequisites: Emscripten SDK installed and activated (emsdk_env.bat).

emcc main.c -O2 -std=c11 -s WASM=1 -s INVOKE_RUN=0 -s EXIT_RUNTIME=0 -s NO_EXIT_RUNTIME=1 ^
  -s EXPORTED_RUNTIME_METHODS="['callMain']" -s FORCE_FILESYSTEM=1 ^
  -o knapsack.js

if %ERRORLEVEL% NEQ 0 (
  echo WASM build failed. Ensure Emscripten (emcc) is installed and on PATH.
  exit /b %ERRORLEVEL%
)

echo WASM build succeeded: knapsack.js and knapsack.wasm generated.
echo The frontend will use this build when the native backend is unavailable (e.g. GitHub Pages).
