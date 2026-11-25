# Fractional Knapsack Problem Using Greedy Algorithm in C

A complete college-level **Design and Analysis of Algorithms (DAA)** project that implements the **Fractional Knapsack** problem using a **Greedy Algorithm in C**, with an interactive web-based simulator and visualization.

## Problem Statement

Implement a greedy algorithm to solve the Fractional Knapsack problem. Analyze its performance and discuss how it contrasts with the 0/1 Knapsack problem in terms of complexity and solution approach. Write down real-time scenarios where this problem statement can be applicable.

## Project Title

**Fractional Knapsack Problem Using Greedy Algorithm in C**

## Technologies Used

1. **Core Algorithm:** C
2. **Frontend:** HTML, CSS, JavaScript
3. **UI Design:** Modern CSS (dark blue/purple gradient theme, responsive, animations, light/dark mode)
4. **Charts:** Chart.js
5. **Backend Integration:** Local backend (`server.py`) executes the compiled C program; browser deployment can use a **WebAssembly build compiled from the same `main.c`** source
6. **Compiler:** GCC
7. **Version Control:** Git and GitHub
8. **Deployment:** GitHub Pages for the frontend (via GitHub Actions workflow)

> **Important:** The core Fractional Knapsack algorithm is implemented in **C** (`main.c`). The web UI does not use fake calculations or a JavaScript reimplementation of the algorithm; it executes the C implementation via the local backend (compiled binary) or via WebAssembly built from the same C source.

## Project Objectives

- Implement the Fractional Knapsack algorithm in C using a greedy strategy.
- Accept knapsack capacity and item details, compute value-to-weight ratios, sort by ratio, and select whole/fractional items.
- Display selected items, fractions, total weight, and maximum profit.
- Provide an interactive, professional UI with visualization, explanations, comparison, performance analysis, and real-time applications.
- Contrast Fractional Knapsack with 0/1 Knapsack in approach, complexity, optimality, and applications.

## Algorithm Description (Greedy)

1. For each item, compute `ratio = value / weight`.
2. Sort items in **descending order** of ratio.
3. Initialize remaining capacity and total profit.
4. For each item in sorted order:
   - If the whole item fits, take it completely (`fraction = 1`).
   - Otherwise, take only the fraction needed to fill remaining capacity and stop.
5. Output selections, total weight used, remaining capacity, and maximum profit.

**Why it works:** Because items are divisible, choosing the highest value-per-unit capacity at each step (greedy choice by ratio) yields a globally optimal solution.

## C Implementation (`main.c`)

The C program is modular and documented, and includes:

- **Structure (`Item`)**: item number, name, weight, value, value-to-weight ratio, fraction selected, weight taken, profit gained
- **Input function (`inputItems`)**: reads capacity, number of items, names, weights, values (stdin or interactive mode)
- **Ratio function (`calculateRatios`)**: computes value/weight ratios
- **Sorting function (`sortItemsByRatio`)**: sorts items in descending order of ratio
- **Greedy function (`fractionalKnapsack`)**: selects full/partial items and computes maximum profit
- **Output functions (`printJsonResults`, `displayResults`)**: reports selected items, fractions, total weight, remaining capacity, and maximum profit
- **`main` function**: coordinates the workflow

### Input/Output Modes

- **Programmatic mode (default):** reads from `stdin` and prints **JSON to stdout** (used by backend/WASM integration).
  - Input format:
    ```
    <capacity>
    <n>
    <name> <weight> <value>
    ... (n lines)
    ```
- **Interactive mode:** `--interactive` prompts the user and prints a formatted summary to `stderr` and JSON to `stdout`.

## Build and Run (GCC)

### Compile

**Windows (MinGW/GCC):**
```bash
gcc -O2 -std=c11 -o main.exe main.c
```

**Linux/macOS:**
```bash
gcc -O2 -std=c11 -o main main.c
```

### Run with sample input (Example 1)

Create an input file or pipe input matching the format:

```text
50
3
A 10 60
B 20 100
C 30 120
```

Example:
```bash
# Windows PowerShell
Get-Content input.txt | .\main.exe

# Linux/macOS
./main < input.txt
```

**Expected result:** maximum profit **240** (A full, B full, 2/3 of C).

### Interactive mode

```bash
./main.exe --interactive
```

## Local Web Application (executes compiled C program)

The frontend (`index.html`, `style.css`, `script.js`) can call a local backend that runs the compiled C executable and returns its actual JSON output.

1. Compile `main.c` with GCC (see above) so `main.exe`/`main` exists in the project folder.
2. Start the local server:
   ```bash
   python server.py
   ```
   (Requires Python 3)
3. Open: [http://127.0.0.1:8000](http://127.0.0.1:8000)
4. Use the **Fractional Knapsack Simulator** to enter inputs or load sample datasets and click **Calculate Maximum Profit**.

The server executes the compiled C program (`main.c` build) per request and the UI displays its output.

## Browser / GitHub Pages Deployment (WebAssembly from same C source)

Native executables cannot run directly in the browser. For static deployment (e.g., GitHub Pages), compile the **same `main.c`** to WebAssembly using **Emscripten** so the frontend can execute the C algorithm in-browser.

### Build WebAssembly (Emscripten)

```bash
emcc main.c -O2 -std=c11 -s WASM=1 -s INVOKE_RUN=0 -s EXIT_RUNTIME=0 -s NO_EXIT_RUNTIME=1 \
  -s EXPORTED_RUNTIME_METHODS='["callMain"]' -s FORCE_FILESYSTEM=1 \
  -o knapsack.js
```

This produces `knapsack.js` and `knapsack.wasm` alongside the frontend files. The web app detects and uses the WASM build when the local native backend is unavailable.

A GitHub Actions workflow (`.github/workflows/deploy.yml`) is included to deploy the frontend to **GitHub Pages** and attempt a WASM build from `main.c` during deployment.

## Project Structure

```text
.
├── main.c                  # Core Fractional Knapsack algorithm (C, GCC)
├── index.html              # Frontend UI (all required sections/pages)
├── style.css               # Modern responsive UI styling (light/dark mode)
├── script.js               # Interactive simulator, visualization, C integration
├── server.py               # Local backend to execute compiled C program
├── sample_inputs.txt       # Sample test cases and input format examples
├── README.md               # Project documentation
└── .github/
    └── workflows/
        └── deploy.yml      # GitHub Pages deployment workflow (with optional WASM build)
```

## Web Application Sections

1. **Home Page:** Title, problem statement, introductions, objectives, technologies, and "Start Simulation" button
2. **Simulator:** Capacity/items input, add/remove items, load samples, reset, calculate (runs C implementation), results display
3. **C Language Implementation:** Structure, functions, compile/run details
4. **Visualization:** Original vs sorted items, ratios, selections, status colors (green/yellow/gray), animated progress bars, capacity/profit charts
5. **Algorithm Explanation:** Greedy steps, pseudocode, flowchart, and ratio-based rationale
6. **Fractional vs 0/1 Knapsack:** Comparison table and explanation of greedy optimality
7. **Performance Analysis:** Best/average/worst time, time/space complexity, and charts
8. **Real-Time Applications:** Cargo loading, resource allocation, budget allocation, food distribution, cloud computing, investment allocation (simplified divisible/proportional models)
9. **Sample Test Cases:** Multiple examples including the required case (capacity 50, A/B/C → expected profit 240)
10. **About Project:** Problem statement, objectives, algorithm, implementation, results, conclusion

## Sample Test Cases

| Case | Capacity | Items (Weight, Value) | Expected Maximum Profit |
|------|----------|------------------------|-------------------------|
| 1 (Required) | 50 | A(10,60), B(20,100), C(30,120) | **240** |
| 2 | 100 | Gold(20,100), Silver(30,120), Bronze(10,60) | **280** (all fit) |
| 3 | 15 | X(10,60), Y(20,100), Z(30,120) | **85** (X full, 1/4 of Y) |
| 4 | 60 | 5 items (mixed ratios) | Computed by C algorithm |
| 5 | 5 | A(10,100) | **50** (50% of A) |

See `sample_inputs.txt` for input blocks and additional details.

## Complexity Analysis

### Fractional Knapsack (Greedy)
- **Sorting:** O(n log n)
- **Selection:** O(n)
- **Overall Time:** **O(n log n)** (best/average/worst dominated by sorting in this implementation)
- **Space:** O(n) for item storage (plus auxiliary space depending on sort)

### 0/1 Knapsack (Dynamic Programming, for contrast)
- **Time:** O(nW)
- **Space:** O(nW), optimizable to O(W)

**Key difference:** Greedy by value/weight ratio is optimal for **Fractional Knapsack** because items are divisible; it is **not** guaranteed optimal for **0/1 Knapsack** due to indivisibility.

## Real-Time Applications (Simplified Models)

1. **Cargo loading:** divisible goods loaded by value density to maximize profit
2. **Resource allocation:** distribute limited divisible resources to highest benefit-per-unit tasks
3. **Budget allocation:** allocate funds to options with best return per dollar (partial funding allowed)
4. **Food distribution:** portion divisible supplies to maximize nutritional/relief value
5. **Cloud computing:** allocate divisible compute/bandwidth to highest value workloads
6. **Investment allocation:** split capital across divisible opportunities by return per unit

*Note: These assume divisibility and proportional benefits; real scenarios may require additional constraints/models.*

## Results

- Correct greedy selection by value-to-weight ratio, including fractional selection when capacity is insufficient.
- Accurate reporting of selected items, fractions, total weight, remaining capacity, and maximum profit.
- Required example verified conceptually: capacity 50 with A(10,60), B(20,100), C(30,120) yields **240**.

## Conclusion

The Fractional Knapsack problem highlights how a greedy strategy can achieve an optimal solution when the problem exhibits the greedy-choice property (enabled here by divisibility). Comparing it with 0/1 Knapsack demonstrates why algorithm choice must match problem constraints: fractional selection favors greedy optimization, while indivisible choices require dynamic programming for guaranteed optimality.

## Git / GitHub

If GitHub authentication is available, you can initialize, commit, and push this repository. Example commands:

```bash
git init
git add .
git commit -m "Add Fractional Knapsack DAA project (C + web UI)"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

Enable **GitHub Pages** in repository settings (Source: GitHub Actions) to deploy the frontend using the included workflow.
