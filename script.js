// Fractional Knapsack Web UI
// IMPORTANT: Calculations are performed by the C implementation (main.c)
// via local backend execution of the compiled program, or via a WebAssembly
// build compiled from the same C source when available. No JS reimplementation.

(function () {
  "use strict";

  const state = {
    integration: "unknown", // "native-c" | "wasm-c" | "none"
    lastResult: null,
    charts: { profit: null, ratio: null, complexity: null },
    wasmReadyPromise: null,
  };

  const sampleTests = {
    1: {
      capacity: 50,
      items: [
        { name: "A", weight: 10, value: 60 },
        { name: "B", weight: 20, value: 100 },
        { name: "C", weight: 30, value: 120 },
      ],
    },
    2: {
      capacity: 100,
      items: [
        { name: "Gold", weight: 20, value: 100 },
        { name: "Silver", weight: 30, value: 120 },
        { name: "Bronze", weight: 10, value: 60 },
      ],
    },
    3: {
      capacity: 15,
      items: [
        { name: "X", weight: 10, value: 60 },
        { name: "Y", weight: 20, value: 100 },
        { name: "Z", weight: 30, value: 120 },
      ],
    },
    4: {
      capacity: 60,
      items: [
        { name: "Item1", weight: 10, value: 60 },
        { name: "Item2", weight: 20, value: 100 },
        { name: "Item3", weight: 30, value: 120 },
        { name: "Item4", weight: 15, value: 75 },
        { name: "Item5", weight: 25, value: 50 },
      ],
    },
    5: {
      capacity: 5,
      items: [
        { name: "A", weight: 10, value: 100 },
      ],
    },
  };

  // ---------- DOM helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function setMessage(text, type = "") {
    const el = $("#formMessage");
    if (!el) return;
    el.textContent = text || "";
    el.className = "form-message" + (type ? " " + type : "");
  }

  function setIntegrationStatus(text, cls) {
    const el = $("#integrationStatus");
    if (!el) return;
    el.textContent = text;
    el.className = "status-pill" + (cls ? " " + cls : "");
  }

  function fmt(n, digits = 4) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return "-";
    const num = Number(n);
    const s = num.toFixed(digits);
    return s.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ---------- Items table ----------
  function createItemRow(index, item = { name: `Item${index + 1}`, weight: "", value: "" }) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="row-index">${index + 1}</td>
      <td><input type="text" class="item-name" value="${escapeHtml(item.name ?? "")}" placeholder="Name" /></td>
      <td><input type="number" class="item-weight" min="0" step="any" value="${item.weight ?? ""}" placeholder="Weight" /></td>
      <td><input type="number" class="item-value" min="0" step="any" value="${item.value ?? ""}" placeholder="Value" /></td>
      <td><button type="button" class="btn btn-ghost remove-item-btn">Remove</button></td>
    `;
    tr.querySelector(".remove-item-btn").addEventListener("click", () => {
      tr.remove();
      renumberRows();
      syncNumItemsField();
    });
    return tr;
  }

  function renumberRows() {
    $$("#itemsBody tr").forEach((tr, i) => {
      const idx = tr.querySelector(".row-index");
      if (idx) idx.textContent = String(i + 1);
    });
  }

  function syncNumItemsField() {
    const count = $$("#itemsBody tr").length;
    const num = $("#numItems");
    if (num) num.value = String(count);
  }

  function setItems(items) {
    const body = $("#itemsBody");
    if (!body) return;
    body.innerHTML = "";
    items.forEach((it, i) => body.appendChild(createItemRow(i, it)));
    syncNumItemsField();
  }

  function addItem(item) {
    const body = $("#itemsBody");
    const i = body.children.length;
    body.appendChild(createItemRow(i, item || { name: `Item${i + 1}`, weight: "", value: "" }));
    syncNumItemsField();
  }

  function getInputData() {
    const capacityRaw = $("#capacity").value;
    const capacity = Number(capacityRaw);
    const rows = $$("#itemsBody tr");
    const items = rows.map((tr, i) => {
      const name = tr.querySelector(".item-name").value.trim() || `Item${i + 1}`;
      const weight = Number(tr.querySelector(".item-weight").value);
      const value = Number(tr.querySelector(".item-value").value);
      return { name, weight, value };
    });
    return { capacity, items };
  }

  function validateInput(data) {
    if (!Number.isFinite(data.capacity) || data.capacity < 0) {
      return "Please enter a valid non-negative knapsack capacity.";
    }
    if (!Array.isArray(data.items) || data.items.length === 0) {
      return "Please add at least one item.";
    }
    for (let i = 0; i < data.items.length; i++) {
      const it = data.items[i];
      if (!Number.isFinite(it.weight) || it.weight < 0) {
        return `Item ${i + 1} has an invalid weight.`;
      }
      if (!Number.isFinite(it.value) || it.value < 0) {
        return `Item ${i + 1} has an invalid value.`;
      }
      if (!it.name) {
        return `Item ${i + 1} must have a name.`;
      }
    }
    return null;
  }

  function buildStdinInput(data) {
    // Must match main.c non-interactive input format
    const lines = [String(data.capacity), String(data.items.length)];
    data.items.forEach((it, idx) => {
      const safeName = String(it.name || `Item${idx + 1}`).replace(/\s+/g, "_");
      lines.push(`${safeName} ${it.weight} ${it.value}`);
    });
    return lines.join("\n") + "\n";
  }

  // ---------- C integration (backend / WASM) ----------
  async function detectIntegration() {
    // Prefer local backend if available (executes compiled native C)
    try {
      const resp = await fetch("/api/health", { method: "GET", cache: "no-store" });
      if (resp.ok) {
        state.integration = "native-c";
        setIntegrationStatus("C integration: local backend ready", "status-ok");
        return;
      }
    } catch (_) { /* ignore */ }

    // Try WASM (compiled from same C source) if present
    if (await canUseWasm()) {
      state.integration = "wasm-c";
      setIntegrationStatus("C integration: WebAssembly (compiled from main.c)", "status-ok");
      return;
    }

    state.integration = "none";
    setIntegrationStatus("C integration unavailable: compile main.c and run server.py, or add WASM build", "status-warn");
  }

  async function canUseWasm() {
    // We support either a custom exported function `run_knapsack` or an Emscripten module script `knapsack.js`.
    if (typeof window.run_knapsack === "function") return true;
    try {
      const resp = await fetch("knapsack.wasm", { method: "HEAD", cache: "no-store" });
      if (resp.ok) return true;
    } catch (_) { /* ignore */ }
    try {
      const resp = await fetch("knapsack.js", { method: "HEAD", cache: "no-store" });
      if (resp.ok) return true;
    } catch (_) { /* ignore */ }
    return false;
  }

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-dynamic-src="${src}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
        if (existing.dataset.loaded === "1") resolve();
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.dataset.dynamicSrc = src;
      s.onload = () => { s.dataset.loaded = "1"; resolve(); };
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(s);
    });
  }

  async function runWithWasm(stdinText) {
    // If a direct exported function exists, prefer it.
    if (typeof window.run_knapsack === "function") {
      const out = window.run_knapsack(stdinText);
      return typeof out === "string" ? out : JSON.stringify(out);
    }

    // Emscripten-compiled main.c path: load knapsack.js with stdin/stdout capture.
    // Build hint (README): emcc main.c -O2 -std=c11 -s WASM=1 -s INVOKE_RUN=0 -s EXIT_RUNTIME=0 \
    //   -s EXPORTED_RUNTIME_METHODS='["callMain"]' -s FORCE_FILESYSTEM=1 -o knapsack.js
    if (!state.wasmReadyPromise) {
      state.wasmReadyPromise = (async () => {
        if (typeof window.createKnapsackModule === "function") {
          return "factory";
        }
        await loadScriptOnce("knapsack.js");
        return "loaded";
      })();
    }
    await state.wasmReadyPromise;

    let inputIndex = 0;
    const inputBytes = Array.from(new TextEncoder().encode(stdinText));
    let stdout = "";
    let stderr = "";

    const moduleConfig = {
      noInitialRun: true,
      noExitRuntime: true,
      stdin: function () {
        if (inputIndex < inputBytes.length) return inputBytes[inputIndex++];
        return null;
      },
      print: function (text) { stdout += String(text) + "\n"; },
      printErr: function (text) { stderr += String(text) + "\n"; },
    };

    // Factory-style modularized build
    if (typeof window.createKnapsackModule === "function") {
      const mod = await window.createKnapsackModule(moduleConfig);
      if (typeof mod.callMain === "function") mod.callMain([]);
      else if (typeof mod._main === "function") mod._main();
      return { stdout, stderr };
    }

    // Global Module style: configure and re-init if possible
    if (typeof window.Module === "object" && window.Module) {
      Object.assign(window.Module, moduleConfig);
      // Reset input cursor for subsequent runs
      if (typeof window.Module.callMain === "function") {
        window.Module.callMain([]);
        return { stdout, stderr };
      }
    }

    throw new Error("WASM module loaded but could not be invoked. Ensure knapsack.js is built from main.c with callMain exported (INVOKE_RUN=0)."
    );
  }

  async function runCAlgorithm(inputData) {
    const stdinText = buildStdinInput(inputData);

    // Try native backend first (executes compiled C program)
    try {
      const resp = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputData),
      });
      const text = await resp.text();
      let payload;
      try { payload = JSON.parse(text); } catch { payload = { error: "Invalid JSON response from backend", raw: text }; }
      if (!resp.ok) {
        throw new Error(payload.error || `Backend error (${resp.status})`);
      }
      payload._integration = payload._integration || "native-c";
      return payload;
    } catch (backendErr) {
      // Fallback to WASM if backend unavailable
      if (await canUseWasm()) {
        try {
          const wasmOut = await runWithWasm(stdinText);
          const stdout = typeof wasmOut === "string" ? wasmOut : (wasmOut.stdout || "");
          const stderr = typeof wasmOut === "string" ? "" : (wasmOut.stderr || "");
          const trimmed = stdout.trim();
          const result = JSON.parse(trimmed);
          result._integration = "wasm-c";
          if (stderr.trim()) result._stderr = stderr.trim();
          return result;
        } catch (wasmErr) {
          throw new Error(`Native backend unavailable (${backendErr.message}). WASM execution failed: ${wasmErr.message}`);
        }
      }
      throw new Error(
        `Unable to execute C algorithm. ${backendErr.message}\n\n` +
        "To run locally: compile with GCC (e.g. 'gcc -O2 -std=c11 -o main.exe main.c') and start 'python server.py'. " +
        "For browser-only deployment, build WebAssembly from the same main.c using Emscripten (see README)."
      );
    }
  }

  // ---------- Rendering ----------
  function statusBadge(status) {
    if (status === "full") return '<span class="badge badge-full">Completely selected</span>';
    if (status === "partial") return '<span class="badge badge-partial">Partially selected</span>';
    return '<span class="badge badge-none">Not selected</span>';
  }

  function renderSummary(result) {
    const el = $("#resultsSummary");
    if (!el) return;
    const integration = result._integration === "wasm-c"
      ? "WebAssembly build of main.c"
      : (result._integration === "native-c" ? "Compiled native C program (via backend)" : "C implementation");
    el.classList.remove("muted");
    el.innerHTML = `
      <p><strong>Executed by:</strong> ${escapeHtml(integration)}${result._executable ? ` (<code>${escapeHtml(result._executable)}</code>)` : ""}</p>
      <div class="summary-grid">
        <div class="summary-item"><span class="label">Knapsack Capacity</span><strong>${fmt(result.capacity, 4)}</strong></div>
        <div class="summary-item"><span class="label">Maximum Profit</span><strong>${fmt(result.maxProfit, 4)}</strong></div>
        <div class="summary-item"><span class="label">Total Weight Used</span><strong>${fmt(result.totalWeightUsed, 4)}</strong></div>
        <div class="summary-item"><span class="label">Remaining Capacity</span><strong>${fmt(result.remainingCapacity, 4)}</strong></div>
      </div>
    `;
  }

  function renderResultsTable(result) {
    const body = $("#resultsBody");
    if (!body) return;
    const items = result.sortedItems || [];
    if (!items.length) {
      body.innerHTML = '<tr><td colspan="8" class="muted">No items.</td></tr>';
      return;
    }
    body.innerHTML = items.map((it) => `
      <tr>
        <td>${escapeHtml(it.name)} (#${it.itemNumber})</td>
        <td>${fmt(it.weight, 4)}</td>
        <td>${fmt(it.value, 4)}</td>
        <td>${fmt(it.ratio, 6)}</td>
        <td>${fmt(it.fractionSelected, 6)}</td>
        <td>${fmt(it.weightTaken, 4)}</td>
        <td>${fmt(it.profitGained, 4)}</td>
        <td>${statusBadge(it.status)}</td>
      </tr>
    `).join("");
  }

  function renderItemCards(containerId, items, includeSelection = false) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!items || !items.length) {
      el.classList.add("muted");
      el.textContent = "No data.";
      return;
    }
    el.classList.remove("muted");
    el.innerHTML = items.map((it) => {
      const status = includeSelection ? (it.status || "none") : "";
      const cls = status ? ` status-${status}` : "";
      const sel = includeSelection
        ? `<p>Fraction: <strong>${fmt(it.fractionSelected, 4)}</strong> | Taken: <strong>${fmt(it.weightTaken, 4)}</strong> | Profit: <strong>${fmt(it.profitGained, 4)}</strong> ${statusBadge(status)}</p>`
        : "";
      return `
        <div class="item-chip${cls}">
          <h4>${escapeHtml(it.name)} <span class="muted">(#${it.itemNumber})</span></h4>
          <p>Weight: <strong>${fmt(it.weight, 4)}</strong> | Value: <strong>${fmt(it.value, 4)}</strong> | Ratio: <strong>${fmt(it.ratio, 6)}</strong></p>
          ${sel}
        </div>
      `;
    }).join("");
  }

  function renderProgressBars(result) {
    const el = $("#progressBars");
    if (!el) return;
    const items = result.sortedItems || [];
    if (!items.length) {
      el.classList.add("muted");
      el.textContent = "No items to visualize.";
      return;
    }
    el.classList.remove("muted");
    el.innerHTML = items.map((it, idx) => {
      const pct = Math.max(0, Math.min(100, Number(it.fractionSelected || 0) * 100));
      const fillClass = it.status === "full" ? "fill-full" : it.status === "partial" ? "fill-partial" : "fill-none";
      return `
        <div class="progress-row">
          <div class="row-head"><span>${escapeHtml(it.name)} (ratio ${fmt(it.ratio, 4)})</span><span>${fmt(pct, 2)}%</span></div>
          <div class="progress-track"><div class="progress-fill ${fillClass}" data-target="${pct}" style="width:0%"></div></div>
        </div>
      `;
    }).join("");

    // animate after paint
    requestAnimationFrame(() => {
      $$("#progressBars .progress-fill").forEach((bar, i) => {
        const target = bar.getAttribute("data-target") || "0";
        setTimeout(() => { bar.style.width = target + "%"; }, 80 * i);
      });
    });
  }

  function renderCapacityMeter(result) {
    const cap = Number(result.capacity || 0);
    const used = Number(result.totalWeightUsed || 0);
    const pct = cap > 0 ? Math.max(0, Math.min(100, (used / cap) * 100)) : 0;
    const fill = $("#capacityMeterFill");
    const label = $("#capacityUsedLabel");
    const rem = $("#remainingCapacityText");
    const profit = $("#totalProfitText");
    if (label) label.textContent = `${fmt(used, 4)} / ${fmt(cap, 4)}`;
    if (rem) rem.textContent = fmt(result.remainingCapacity, 4);
    if (profit) profit.textContent = fmt(result.maxProfit, 4);
    if (fill) {
      fill.style.width = "0%";
      requestAnimationFrame(() => { fill.style.width = pct + "%"; });
    }
  }

  function destroyChart(chart) { if (chart) { try { chart.destroy(); } catch (_) {} } }

  function renderCharts(result) {
    if (typeof Chart === "undefined") return;
    const items = result.sortedItems || [];
    const labels = items.map((it) => it.name);
    const profits = items.map((it) => Number(it.profitGained || 0));
    const ratios = items.map((it) => Number(it.ratio || 0));
    const colors = items.map((it) => it.status === "full" ? "rgba(34,197,94,0.7)" : it.status === "partial" ? "rgba(245,158,11,0.7)" : "rgba(107,114,128,0.6)");
    const borders = items.map((it) => it.status === "full" ? "rgba(34,197,94,1)" : it.status === "partial" ? "rgba(245,158,11,1)" : "rgba(107,114,128,1)");

    destroyChart(state.charts.profit);
    destroyChart(state.charts.ratio);

    const profitCtx = $("#profitChart");
    const ratioCtx = $("#ratioChart");
    if (profitCtx) {
      state.charts.profit = new Chart(profitCtx, {
        type: "bar",
        data: {
          labels,
          datasets: [{ label: "Profit Gained", data: profits, backgroundColor: colors, borderColor: borders, borderWidth: 1 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } }, scales: { y: { beginAtZero: true } } }
      });
    }
    if (ratioCtx) {
      state.charts.ratio = new Chart(ratioCtx, {
        type: "bar",
        data: {
          labels,
          datasets: [{ label: "Value/Weight Ratio", data: ratios, backgroundColor: "rgba(124,92,255,0.6)", borderColor: "rgba(124,92,255,1)", borderWidth: 1 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } }, scales: { y: { beginAtZero: true } } }
      });
    }
  }

  function renderComplexityChart() {
    if (typeof Chart === "undefined") return;
    const ctx = $("#complexityChart");
    if (!ctx) return;
    destroyChart(state.charts.complexity);
    const ns = [1,2,3,4,5,6,7,8,9,10,12,14,16,18,20];
    const nlogn = ns.map(n => n * Math.log2(n));
    const dp = ns.map(n => n * n); // illustrative n*W with W~n
    state.charts.complexity = new Chart(ctx, {
      type: "line",
      data: {
        labels: ns.map(String),
        datasets: [
          { label: "Fractional Knapsack O(n log n)", data: nlogn, borderColor: "rgba(34,211,238,1)", backgroundColor: "rgba(34,211,238,0.15)", tension: 0.25, fill: true },
          { label: "0/1 Knapsack DP O(nW) (illustrative)", data: dp, borderColor: "rgba(124,92,255,1)", backgroundColor: "rgba(124,92,255,0.12)", tension: 0.25, fill: true }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true }, tooltip: { mode: "index", intersect: false } },
        scales: { x: { title: { display: true, text: "n (items)" } }, y: { title: { display: true, text: "Relative growth" }, beginAtZero: true } }
      }
    });
  }

  function renderAll(result) {
    state.lastResult = result;
    $("#rawOutput").textContent = JSON.stringify(result, null, 2);
    renderSummary(result);
    renderResultsTable(result);
    renderItemCards("originalItemsView", result.originalItems || [], false);
    renderItemCards("sortedItemsView", result.sortedItems || [], true);
    renderProgressBars(result);
    renderCapacityMeter(result);
    renderCharts(result);
  }

  // ---------- Events ----------
  function loadTestCase(id) {
    const t = sampleTests[id];
    if (!t) return;
    $("#capacity").value = String(t.capacity);
    setItems(t.items.map(it => ({ ...it })));
    setMessage(`Loaded sample test case ${id}. Click "Calculate Maximum Profit" to run the C algorithm.`, "success");
    window.location.hash = "#simulator";
  }

  function resetInputs() {
    $("#capacity").value = "50";
    setItems([
      { name: "A", weight: 10, value: 60 },
      { name: "B", weight: 20, value: 100 },
      { name: "C", weight: 30, value: 120 },
    ]);
    $("#resultsBody").innerHTML = "";
    $("#resultsSummary").classList.add("muted");
    $("#resultsSummary").textContent = "Run the simulation to see selected items, fractions, total weight, and maximum profit.";
    $("#originalItemsView").classList.add("muted");
    $("#originalItemsView").textContent = "No data yet.";
    $("#sortedItemsView").classList.add("muted");
    $("#sortedItemsView").textContent = "No data yet.";
    $("#progressBars").classList.add("muted");
    $("#progressBars").textContent = "Run the simulation to animate selections.";
    $("#capacityMeterFill").style.width = "0%";
    $("#capacityUsedLabel").textContent = "0 / 0";
    $("#remainingCapacityText").textContent = "-";
    $("#totalProfitText").textContent = "-";
    $("#rawOutput").textContent = "(no output yet)";
    destroyChart(state.charts.profit); state.charts.profit = null;
    destroyChart(state.charts.ratio); state.charts.ratio = null;
    setMessage("Inputs reset.", "");
  }

  async function onCalculate(e) {
    e.preventDefault();
    const data = getInputData();
    const err = validateInput(data);
    if (err) { setMessage(err, "error"); return; }

    const btn = $("#calculateBtn");
    btn.disabled = true;
    setMessage("Executing C algorithm (main.c)…", "");
    try {
      const result = await runCAlgorithm(data);
      renderAll(result);
      const src = result._integration === "wasm-c" ? "WebAssembly (same C source)" : "compiled native C program";
      setMessage(`Calculation complete using ${src}. Maximum profit: ${fmt(result.maxProfit, 4)}.`, "success");
    } catch (ex) {
      console.error(ex);
      setMessage(String(ex.message || ex), "error");
      $("#rawOutput").textContent = String(ex.stack || ex.message || ex);
    } finally {
      btn.disabled = false;
    }
  }

  function initTheme() {
    const saved = localStorage.getItem("fk-theme");
    if (saved === "light") document.body.classList.add("light");
    $("#themeToggle")?.addEventListener("click", () => {
      document.body.classList.toggle("light");
      localStorage.setItem("fk-theme", document.body.classList.contains("light") ? "light" : "dark");
      // re-render charts for contrast if needed (defaults are fine)
      if (state.lastResult) renderCharts(state.lastResult);
      renderComplexityChart();
    });
  }

  function init() {
    // Default items (Example 1)
    setItems(sampleTests[1].items.map(it => ({ ...it })));
    $("#capacity").value = String(sampleTests[1].capacity);

    $("#addItemBtn")?.addEventListener("click", () => addItem());
    $("#resetBtn")?.addEventListener("click", resetInputs);
    $("#loadSampleBtn")?.addEventListener("click", () => loadTestCase(1));
    $("#simulatorForm")?.addEventListener("submit", onCalculate);
    $("#applyCountBtn")?.addEventListener("click", () => {
      const n = Math.max(1, Math.min(100, parseInt($("#numItems").value || "1", 10)));
      const current = getInputData().items;
      const next = [];
      for (let i = 0; i < n; i++) next.push(current[i] || { name: `Item${i + 1}`, weight: "", value: "" });
      setItems(next);
      setMessage(`Item count set to ${n}.`, "");
    });

    $$(".load-test-btn").forEach((btn) => {
      btn.addEventListener("click", () => loadTestCase(btn.getAttribute("data-test")));
    });

    initTheme();
    renderComplexityChart();
    detectIntegration();

    // If opened as file://, hint about server
    if (location.protocol === "file:") {
      setIntegrationStatus("Opened as file: run 'python server.py' and use http://localhost:8000 for native C execution", "status-warn");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
