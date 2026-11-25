# Fractional Knapsack Project - Build Configuration
# Core algorithm is implemented in C (main.c) and compiled with GCC.

CC ?= gcc
CFLAGS ?= -O2 -std=c11 -Wall -Wextra
TARGET ?= main
SRC = main.c

.PHONY: all clean run test

all: $(TARGET)

$(TARGET): $(SRC)
	$(CC) $(CFLAGS) -o $(TARGET) $(SRC)

# Example run (requires an input file, e.g. input.txt)
run: $(TARGET)
	./$(TARGET)

# Build WebAssembly from the same C source (requires Emscripten/emcc)
wasm:
	emcc $(SRC) -O2 -std=c11 -s WASM=1 -s INVOKE_RUN=0 -s EXIT_RUNTIME=0 -s NO_EXIT_RUNTIME=1 \
		-s EXPORTED_RUNTIME_METHODS='["callMain"]' -s FORCE_FILESYSTEM=1 \
		-o knapsack.js

clean:
	rm -f $(TARGET) $(TARGET).exe knapsack.js knapsack.wasm
