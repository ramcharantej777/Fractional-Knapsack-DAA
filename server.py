import http.server
import json
import os
import subprocess
import sys
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = int(os.environ.get("PORT", "8000"))

# Candidate compiled executables produced from main.c
EXE_CANDIDATES = [
    ROOT / "main.exe",
    ROOT / "main",
    ROOT / "a.exe",
    ROOT / "a.out",
    ROOT / "knapsack.exe",
    ROOT / "knapsack",
]


def find_executable():
    for p in EXE_CANDIDATES:
        if p.is_file():
            return p
    return None


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        # Helpful for local development
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/health":
            exe = find_executable()
            self.respond_json(200, {
                "status": "ok",
                "integration": "native-c",
                "executableFound": bool(exe),
                "executable": exe.name if exe else None,
            })
            return
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/run":
            self.handle_run()
        else:
            self.send_error(404, "Not Found")

    def handle_run(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(length) if length > 0 else b"{}"
            payload = json.loads(body.decode("utf-8"))

            capacity = float(payload.get("capacity", 0))
            items = payload.get("items", [])
            if not isinstance(items, list):
                raise ValueError("items must be a list")

            # Build stdin for main.c: capacity, n, then "name weight value" lines
            lines = [str(capacity), str(len(items))]
            for idx, it in enumerate(items, start=1):
                name = str(it.get("name", f"Item{idx}"))
                # sanitize whitespace in name for the simple scanf("%s") format
                name = "_".join(name.split()) or f"Item{idx}"
                weight = float(it.get("weight", 0))
                value = float(it.get("value", 0))
                lines.append(f"{name} {weight} {value}")
            input_text = "\n".join(lines) + "\n"

            exe = find_executable()
            if not exe:
                msg = (
                    "Compiled C executable not found. Please compile main.c with GCC first, e.g.\n"
                    "  gcc -O2 -std=c11 -o main.exe main.c   (Windows)\n"
                    "  gcc -O2 -std=c11 -o main main.c       (Linux/macOS)\n"
                    "Then restart this server."
                )
                self.respond_json(500, {"error": msg, "integration": "native-c-missing"})
                return

            proc = subprocess.run(
                [str(exe)],
                input=input_text,
                text=True,
                capture_output=True,
                timeout=10,
                cwd=str(ROOT),
            )

            stdout = proc.stdout.strip()
            stderr = proc.stderr.strip()

            if proc.returncode != 0:
                self.respond_json(500, {
                    "error": "C program execution failed.",
                    "returncode": proc.returncode,
                    "stderr": stderr,
                    "stdout": stdout,
                    "integration": "native-c"
                })
                return

            # main.c prints JSON to stdout
            try:
                result = json.loads(stdout) if stdout else {}
            except json.JSONDecodeError:
                self.respond_json(500, {
                    "error": "C program did not return valid JSON.",
                    "stdout": stdout,
                    "stderr": stderr,
                    "integration": "native-c"
                })
                return

            result["_integration"] = "native-c"
            result["_stderr"] = stderr
            result["_executable"] = exe.name
            self.respond_json(200, result)
        except Exception as e:
            self.respond_json(400, {"error": str(e)})

    def respond_json(self, status, obj):
        data = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - - [%s] %s\n" % (self.client_address[0], self.log_date_time_string(), fmt % args))


if __name__ == "__main__":
    os.chdir(ROOT)
    print(f"Serving Fractional Knapsack project at http://{HOST}:{PORT}")
    exe = find_executable()
    if exe:
        print(f"Found compiled C executable: {exe.name}")
    else:
        print("Warning: no compiled C executable found. Compile main.c with GCC to enable native execution.")
    print("Press Ctrl+C to stop.")
    with http.server.ThreadingHTTPServer((HOST, PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
