# ASTRANETRA

> **"Astra"** (weapon) · **"Netra"** (eye) — *A watching weapon.*

An educational JavaScript tool that simulates how malware operates — reconnaissance, persistence, filesystem control, and data exfiltration — entirely on your local machine. Built to understand virus behavior from the inside, using Node.js built-ins.

**No actual malicious behavior. No remote transmission. No damage. Everything is reversible.**

---

## Setup

```bash
# 1. Clone / extract the project
cd astranetra

# 2. Install dependencies
npm install

# 3. Run
node index.js --help
```

**Requires:** Node.js ≥ 18. Works on Windows, Linux, macOS.

---

## Quick Start

```bash
# Full pipeline — recon + scan + exfil + dashboard
node index.js

# Individual commands
node index.js recon                        # System info
node index.js scan                         # File scan (includes hidden files)
node index.js exfil                        # Send data to localhost:4444 + SQLite
node index.js persist                      # Self-copy + PATH registration
node index.js path --demo                  # PATH hijack demo
node index.js integrity --baseline         # SHA-256 snapshot
node index.js crud corrupt sandbox/test.txt --demo   # File corruption demo
node index.js dashboard                    # Regenerate dashboard.html

# Undo everything
node index.js revert --all
```

---

## What Each Feature Demonstrates

| Feature | Virus Behavior It Simulates | Node.js Built-in |
|---|---|---|
| `recon` | Environment fingerprinting | `os`, `child_process` |
| `scan` (hidden files) | Target enumeration | `fs.readdir`, `worker_threads` |
| `exfil` → localhost server | C2 data exfiltration | `http`, `express` |
| `exfil` → SQLite | Persistent data storage | `sql.js` |
| `persist` (startup copy) | Survives reboots | `fs`, `child_process` |
| `persist` (PATH entry) | Command hijacking setup | Shell configs / `setx` |
| `path --demo` | PATH hijacking | `child_process`, `process.env` |
| `crud corrupt` | File destruction / ransomware | `fs`, `crypto` |
| `integrity` | Detecting modifications | `crypto`, `chokidar` |
| `revert --all` | Evidence removal / clean exit | All of the above |

---

## Code Flow

The execution follows a strict pipeline, orchestrated by the central CLI (`index.js`). Depending on the flags passed, the system runs through the following phases:

1. **Reconnaissance (`core/SystemRecon.js`):** Queries the OS using Node's built-in `os` and `child_process` modules to capture hostname, CPU architecture, environment variables, Node.js version, platform info, and user home directory. Handles missing values securely using safe fallbacks and `try/catch` blocks.
2. **Scanning (`core/FileScanner.js` & `workers/scanWorker.js`):** Offloads deep filesystem traversal to background worker threads to avoid blocking the main event loop, identifying sensitive files based on configurable patterns.
3. **Data Exfiltration (`core/ExfilEngine.js` & `server/exfilServer.js`):** Serializes the gathered intelligence (system info and file paths) into a structured JSON payload. Sends it via HTTP POST to a local Express server, which saves the payload securely into an SQLite database (`sql.js`).
4. **File Operations (`core/CRUDEngine.js`):** Enables direct CRUD operations (read, append, corrupt, rename) on files within the sandbox to demonstrate payload execution safely.
5. **Persistence (`core/PersistenceEngine.js` & `core/PathManipulator.js`):** Demonstrates self-replication by copying the payload into OS-specific startup folders and modifying the PATH variable to hijack future commands.
6. **Reporting (`output/DashboardGenerator.js`):** Formats and outputs the collected data either via beautifully rendered CLI components or by generating an interactive HTML dashboard.

---

## Strategy

The strategy behind Astranetra relies heavily on **safe local simulation** combined with **highly efficient concurrency**.

*   **Concurrency for Performance:** A key aspect of our strategy is using Node.js `worker_threads` for CPU-intensive tasks like hashing (`hashWorker.js`) and I/O-intensive tasks like deep directory scanning (`scanWorker.js`). This ensures that the main thread (and thus the terminal UI) remains perfectly responsive.
*   **Zero-Damage Educational Approach:** The strategy strictly confines file manipulation (CRUD) to the `sandbox/` directory. Reconnaissance is strictly read-only, and exfiltration targets a local `localhost:4444` server rather than an external IP address, ensuring 100% safety.
*   **Cross-Platform Adaptability:** Instead of hardcoding OS behaviors, the reconnaissance and persistence engines dynamically detect the platform (`win32`, `linux`, `darwin`) and execute the correct specific strategy (e.g., modifying `~/.bashrc` on Linux vs `setx PATH` on Windows).
*   **Graceful Degradation:** All system calls and shell commands are wrapped in strict timeouts and try/catch blocks. If a value (like an environment variable or disk mount) is missing or inaccessible, the code logs the failure internally and falls back to safe defaults without crashing the tool.

---

## Project Structure

```
astranetra/
├── core/
│   ├── SystemRecon.js        OS, CPU, RAM, network, env vars
│   ├── FileScanner.js        Recursive scan — visible + hidden files
│   ├── CRUDEngine.js         Safe, logged file operations
│   ├── PersistenceEngine.js  Self-copy + PATH registration
│   ├── ExfilEngine.js        POST to local server + SQLite
│   ├── IntegrityMonitor.js   SHA-256 snapshots + diff
│   └── PathManipulator.js    PATH read / demo / inject / revert
├── server/
│   └── exfilServer.js        Local Express server (localhost:4444)
├── output/
│   ├── Logger.js             Structured logging, all targets
│   ├── DashboardGenerator.js Self-contained HTML dashboard
│   └── ReportExporter.js     JSON / Markdown / CSV
├── workers/
│   ├── scanWorker.js         Parallel directory traversal
│   └── hashWorker.js         Parallel SHA-256 hashing
├── config/
│   └── astranetra.config.js  All tunable parameters
├── sandbox/                  Safe zone for CRUD demos
├── index.js                  CLI orchestrator — one script
└── package.json
```

---

## Platform Support

| Feature | Windows | Linux | macOS |
|---|---|---|---|
| System Recon | ✅ | ✅ | ✅ |
| File Scan | ✅ | ✅ | ✅ |
| Hidden Files | ✅ | ✅ | ✅ |
| Exfil Server + DB | ✅ | ✅ | ✅ |
| Persist (startup) | ✅ Startup folder | ✅ `.desktop` autostart | ✅ LaunchAgent `.plist` |
| Persist (PATH) | ✅ `setx` | ✅ `.bashrc` / `.zshrc` | ✅ `.zshrc` / `.bash_profile` |
| PATH Hijack Demo | ✅ | ✅ | ✅ |
| Integrity Monitor | ✅ | ✅ | ✅ |
| Dashboard | ✅ | ✅ | ✅ |

---

## Non-Goals

- ❌ No external network calls — exfil is `localhost` only
- ❌ No reading of sensitive file contents — paths are flagged, files are never opened
- ❌ No process injection, keylogging, or screen capture
- ❌ No permanent damage — every change has a documented revert

---

*ASTRANETRA is an educational tool. It operates entirely on your local machine. The eye watches only what you show it.*
