@echo off
REM Build the Fractional Knapsack C program with GCC (Windows)
REM Requires GCC (MinGW-w64 or similar) in PATH.

gcc -O2 -std=c11 -Wall -Wextra -o main.exe main.c
if %ERRORLEVEL% NEQ 0 (
  echo Build failed.
  exit /b %ERRORLEVEL%
)

echo Build succeeded: main.exe
echo Run interactively with: main.exe --interactive
echo Run programmatically by piping stdin input (see README.md / sample_inputs.txt)
