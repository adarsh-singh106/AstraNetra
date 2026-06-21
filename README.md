<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=800&size=28&duration=3000&pause=1000&color=A855F7&center=true&vCenter=true&width=600&lines=⚡+ASTRANETRA;Astra+%C2%B7+Weapon;Netra+%C2%B7+Eye;A+Watching+Weapon." alt="ASTRANETRA" />

<br/>

**The only malware simulator that shows you exactly what it's doing — and lets you undo it.**

<br/>

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/Windows%20·%20Linux%20·%20macOS-supported-4f46e5?style=for-the-badge&logo=github&logoColor=white)](#platform-support)
[![License](https://img.shields.io/badge/License-MIT-f59e0b?style=for-the-badge)](LICENSE)
[![Hackathon](https://img.shields.io/badge/Thunder%20Hackathon-3.0-ef4444?style=for-the-badge&logo=lightning&logoColor=white)](#)
[![GitHub](https://img.shields.io/badge/Clone%20on-GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/adarsh-singh106/AstraNetra.git)

<br/>

> *"Some programs copy themselves to other folders, register in PATH, and survive deletion attempts. How?"*
> — Your professor, probably.
>
> **ASTRANETRA answers that question in working code.**

</div>

---

## What Is ASTRANETRA?

ASTRANETRA is an **educational malware behavior simulator** built entirely in Node.js. It doesn't just explain how viruses work — it *demonstrates* every technique live in your terminal, with full transparency and a one-command undo.

Built for **Thunder Hackathon 3.0** under the theme *"Create a Virus in JS."*

The goal wasn't to build something dangerous. It was to build something that makes the dangerous **understandable**.

| What it IS | What it is NOT |
|---|---|
| ✅ A local educational simulator | ❌ No external network calls |
| ✅ Fully transparent — every action is printed live | ❌ No reading of sensitive file contents |
| ✅ Completely reversible with one command | ❌ No keylogging, screen capture, or process injection |
| ✅ Cross-platform working code | ❌ No permanent damage — everything reverts |

---

## Quick Start

**Requires Node.js ≥ 18** — [Download here](https://nodejs.org/)

```bash
# 1. Clone the repository
git clone https://github.com/adarsh-singh106/AstraNetra.git
cd AstraNetra

# 2. Run setup (installs deps + registers `astra` globally)
bash setup.sh          # Linux / macOS
.\setup.bat              # Windows 

# 3. Launch
astra                  # Linux / macOS / Command Prompt
.\astra                # Windows PowerShell
```

> **Note:** If `astra` isn't recognized (e.g. you skipped setup or PATH failed), you can always just use `node index.js` instead.
> Example: `node index.js recon` is exactly the same as `astra recon`.

When you're done, **undo every single change** with:

```bash
astra revert --all
```

That's it. One command in, one command out.

---

## The 5 Phases

ASTRANETRA walks through 5 distinct malware behaviors — each one explained as it executes.

```
Phase 1 ──── System Reconnaissance     Maps the target environment
Phase 2 ──── Filesystem Mapping        Finds what's worth stealing
Phase 3 ──── File Access Demo          Reads real files (safely)
Phase 4 ──── Exfiltration              Sends data to a local C2 server
Phase 5 ──── Reporting & Dashboard     Packages everything for review
```

### Phase 1 — System Reconnaissance
*Malware technique: environment fingerprinting*

Uses the `os` module and `child_process` to fully profile the host — OS, CPU per-core load, RAM, disk volumes, network interfaces, environment variables, and Node.js internals. Everything a real attacker would want before acting.

### Phase 2 — Filesystem Mapping
*Malware technique: target enumeration*

Spawns a `worker_threads` pool to traverse your entire home directory without ever blocking the terminal UI. Tracks total files, hidden files, extension frequency, and the top 20 largest files. Sensitive filenames (`.env`, `id_rsa`, `.npmrc`, `.pem`) are **flagged by path only — their contents are never read.**

### Phase 3 — File Access Demonstration
*Malware technique: document and credential discovery*

Finds and reads real, harmless files (`package.json`, `.bashrc`, `hosts`). Displays content in bordered terminal frames with SHA-256 hashes — exactly how a credential-harvesting payload would stage its findings.

### Phase 4 — Exfiltration
*Malware technique: C2 data exfiltration*

Spins up an Express server on `localhost:4444`. POSTs the full payload over HTTP. Simultaneously writes to SQLite using `sql.js` (pure WebAssembly — no build tools, no `node-gyp`). Open `http://localhost:4444` in a browser while it runs to watch payloads arrive in real time.

### Phase 5 — Reporting & Dashboard
*Malware technique: intelligence packaging*

Generates four output formats from the same internal data model:

| File | Format | Use |
|---|---|---|
| `dashboard.html` | Self-contained HTML | Open in browser — dark theme, Chart.js charts |
| `reports/report.json` | JSON | Full structured data, pretty-printed |
| `reports/report.md` | Markdown | Human-readable with tables |
| `reports/report.csv` | CSV | Import directly into Excel or Sheets |

---

## Everything It Can Do

> **PowerShell users:** prefix all commands with `.\` (e.g. `.\astra persist`)

```bash
# ── Full Pipeline ───────────────────────────────────────────────────
astra                               # All 5 phases in sequence

# ── Individual Phases ───────────────────────────────────────────────
astra recon                         # System fingerprinting only
astra scan                          # Filesystem scan + hidden file detection
astra exfil                         # POST to localhost:4444 + SQLite write
astra exfil --server-only           # Keep the server alive after run
astra exfil --db-only               # SQLite only, skip server

# ── Persistence ─────────────────────────────────────────────────────
astra persist                       # Self-copy to startup + PATH entry
astra persist --revert              # Undo all persistence changes

# ── PATH Hijacking ──────────────────────────────────────────────────
astra path                          # Analyze PATH, flag suspicious entries
astra path --demo                   # Session-scoped PATH hijack (fake git)
astra path --inject <dir>           # Add a directory to PATH
astra path --revert                 # Remove all injected entries

# ── File Integrity ──────────────────────────────────────────────────
astra integrity --baseline          # SHA-256 snapshot of current directory
astra integrity --diff              # Diff the latest two snapshots
astra integrity --watch             # Real-time tamper detection

# ── File CRUD Demos ─────────────────────────────────────────────────
astra crud create <path> "content"
astra crud read <path>
astra crud update <path> "content" --mode append
astra crud delete <path> --confirm
astra crud corrupt sandbox/test.txt --demo   # Ransomware simulation
astra crud move <src> <dest>

# ── Database ────────────────────────────────────────────────────────
astra db --list                     # Show all stored scans
astra db --clear                    # Wipe all stored data

# ── Reports & Dashboard ─────────────────────────────────────────────
astra dashboard                     # Regenerate dashboard.html
astra report --format json
astra report --format md
astra report --format csv

# ── Nuclear Option ──────────────────────────────────────────────────
astra revert --all                  # Undo EVERYTHING ASTRANETRA ever did
```

---

## Malware Behavior Mapping

Every feature maps to a documented, real-world malware technique.

| ASTRANETRA Feature | Real Malware Technique | Node.js Mechanism |
|---|---|---|
| `recon` | Environment fingerprinting | `os`, `child_process` |
| `scan` | Target enumeration + hidden file detection | `fs.readdir`, `worker_threads` |
| Phase 3 file reads | Credential discovery staging | `fs.readFileSync`, `crypto` |
| `exfil` → local server | C2 channel data exfiltration | `http`, `express` |
| `exfil` → SQLite | Persistent intelligence storage | `sql.js` |
| `persist` (startup copy) | Survives reboots | `fs`, `child_process` |
| `persist` (PATH entry) | Command hijacking setup | Shell configs / `setx` |
| `path --demo` | PATH hijacking attack | `child_process`, `process.env` |
| `crud corrupt` | Ransomware / data destruction simulation | `fs`, `crypto.randomBytes` |
| `integrity --watch` | Tamper detection awareness | `crypto`, `chokidar` |
| `revert --all` | Evidence removal on exit | All of the above |

---

## Architecture

```
index.js  (CLI Orchestrator)
  ├── core/SystemRecon.js        →  OS, CPU, RAM, disk, network, env vars
  ├── core/FileScanner.js
  │     └── workers/scanWorker.js   →  parallel directory traversal
  ├── core/ExfilEngine.js
  │     ├── server/exfilServer.js  →  localhost:4444 live web UI
  │     └── sql.js                 →  db/astranetra.db (pure WebAssembly SQLite)
  ├── core/PersistenceEngine.js  →  startup entry + PATH line + state log
  ├── core/PathManipulator.js    →  session-scoped PATH hijack demo
  ├── core/CRUDEngine.js         →  sandbox/ + .astranetra_trash/
  ├── core/IntegrityMonitor.js
  │     └── workers/hashWorker.js  →  snapshots/<timestamp>.json
  ├── output/DashboardGenerator.js →  dashboard.html (self-contained)
  ├── output/ReportExporter.js     →  report.json / .md / .csv
  └── output/Logger.js             →  6 structured log files
```

Every module is independently runnable. Every output is logged. Every system change has an exact revert path.

---

## Key Technical Decisions

**Why `sql.js` instead of `better-sqlite3`?**
`better-sqlite3` requires `node-gyp` and platform build tools (Visual Studio / Xcode / GCC). `sql.js` compiles SQLite to WebAssembly — pure JavaScript, installs in seconds, works on every OS with `npm install`.

**Why `worker_threads` for filesystem scanning?**
Scanning 1M+ files means 1M+ filesystem calls. Running this on the main thread freezes the terminal UI completely. Workers handle the I/O in parallel — the main thread only receives progress events and updates the progress bar.

**Why atomic writes for CRUD?**
Every file write goes to a `.tmp` file first, then `fs.rename` swaps it in. If the process is interrupted mid-write, the original file is untouched. No corruption.

---

## Platform Support

| Feature | Windows | Linux | macOS |
|---|---|---|---|
| System Recon | ✅ | ✅ | ✅ |
| Disk Info | ✅ PowerShell `Get-PSDrive` | ✅ `df -k` | ✅ `df -k` |
| File Scan + Hidden Files | ✅ | ✅ | ✅ |
| Exfil Server + SQLite | ✅ | ✅ | ✅ |
| Persistence — Startup | ✅ `%APPDATA%\...\Startup\` | ✅ `~/.config/autostart/` | ✅ `~/Library/LaunchAgents/` |
| Persistence — PATH | ✅ `setx` | ✅ `.bashrc` + `.zshrc` | ✅ `.zshrc` + `.bash_profile` |
| PATH Hijack Demo | ✅ `.cmd` fake script | ✅ `sh` fake script | ✅ `sh` fake script |
| Integrity Monitor | ✅ | ✅ | ✅ |
| Dashboard + Reports | ✅ | ✅ | ✅ |

> **Windows 11 note:** `wmic` was removed in Windows 11 24H2. ASTRANETRA uses PowerShell `Get-PSDrive` for all disk queries — tested across all Windows versions.

---

## Output Files

Everything generated at runtime:

```
dashboard.html                ← open this first — dark theme, Chart.js charts
reports/report.json           ← full structured data, pretty-printed
reports/report.md             ← human-readable with tables
reports/report.csv            ← import into Excel or Sheets
db/astranetra.db              ← SQLite, queryable with: astra db --list
logs/astranetra.log.json      ← all events, machine-readable
logs/astranetra.log.txt       ← human-readable with timestamps
logs/persistence_state.json   ← exactly what was changed (confirm revert here)
logs/crud.log.json            ← CRUD operations log
logs/exfil.log.json           ← every POST and DB write
logs/integrity.log.json       ← hash operations and file changes
snapshots/<timestamp>.json    ← SHA-256 baseline for integrity diff
```

---

## Tech Stack

**npm packages:**

| Package | Purpose |
|---|---|
| `express` | Local C2 receiver server |
| `sql.js` | Pure-JS WebAssembly SQLite — zero native compilation |
| `chokidar` | Real-time filesystem watching |
| `cli-progress` | Animated scan progress bars |
| `chalk` | Terminal colors |
| `ora` | Terminal spinners |
| `blessed` + `blessed-contrib` | Terminal UI panels and dashboard widgets |
| `systeminformation` | Deep hardware metrics fallback |
| `open` | Cross-platform file/URL opener |

**Node.js built-ins (no install needed):**
`fs` · `os` · `crypto` · `child_process` · `path` · `http` · `worker_threads` · `readline` · `url`

---

## Project Structure

```
astranetra/
├── index.js                       CLI entry point + terminal orchestrator
├── package.json
├── config/
│   └── astranetra.config.js       All tunable parameters, cross-platform paths
├── core/
│   ├── SystemRecon.js             OS, CPU, RAM, network, env var collection
│   ├── FileScanner.js             Recursive async scan, worker_threads pool
│   ├── CRUDEngine.js              Create / read / update / delete / corrupt / move
│   ├── PersistenceEngine.js       Self-copy to startup + PATH registration
│   ├── ExfilEngine.js             POST to local server + SQLite write
│   ├── IntegrityMonitor.js        SHA-256 snapshots + diff + chokidar watch
│   └── PathManipulator.js         PATH read / analyze / demo / inject / revert
├── server/
│   └── exfilServer.js             Express C2 receiver on localhost:4444
├── output/
│   ├── Logger.js                  Structured JSON + pretty logs, 6 targets
│   ├── DashboardGenerator.js      Self-contained dark HTML dashboard
│   └── ReportExporter.js          JSON / Markdown / CSV writer
├── workers/
│   ├── scanWorker.js              Parallel directory traversal thread
│   └── hashWorker.js              Parallel SHA-256 computation thread
├── sandbox/                       Safe zone for CRUD and corruption demos
└── .astranetra_trash/             Deleted files park here before hard delete
```

---

## Configuration

Fine-tune behavior in `config/astranetra.config.js`:

```javascript
scan: {
  workerCount: 4,                 // increase on fast SSDs
  sensitivePatterns: [
    '.env', '.pem', '.key', 'id_rsa', 'id_ed25519',
    '.p12', 'credentials', '.netrc', '.npmrc', 'htpasswd',
  ],
},
exfil: {
  serverPort: 4444,               // change if port is in use
},
persistence: {
  revertOnExit: false,            // set true to auto-revert on process exit
},
crud: {
  requireConfirmForDelete: true,
  atomicWrites: true,
},
```

---

## Error Handling

- **Version check** — Node.js version verified before any module loads
- **Timeouts** — all `child_process` calls use 3–8 second timeouts to prevent hangs
- **Graceful degradation** — inaccessible paths are logged and skipped, never thrown; missing env vars fall back to `'unknown'`
- **SIGINT / SIGTERM** — handlers flush all log streams and stop the exfil server cleanly
- **Sandbox enforcement** — `corruptFile` only operates inside `sandbox/`; `--force` required to override
- **Atomic writes** — write-to-`.tmp`-then-`fs.rename` prevents corruption on interrupted writes
- **Port conflict** — if `localhost:4444` is taken, the server is skipped with a warning; the SQLite write still succeeds

---

## Known Limitations

- **Windows PATH length** — `setx` has a 1024-character limit. If your PATH exceeds it, PATH injection is skipped with a warning. Everything else runs normally.
- **Windows hidden files** — Detection uses the dot-prefix heuristic. `FILE_ATTRIBUTE_HIDDEN` (right-click → Properties → Hidden) is not queried via the Windows API.
- **Large drives** — Scanning 500K+ files takes several minutes. This is expected — the progress bar shows an accurate ETA.
- **Dashboard offline** — Chart.js loads from CDN. The page renders offline but charts require internet.
- **Docker / CI** — Some recon values (`username`, `shell`) may show as `'unknown'` in containers with minimal `/etc/passwd`.

---

## License

[MIT](LICENSE) — Educational use only.

---

<div align="center">

**Built for Thunder Hackathon 3.0** · *"Create a Virus in JS"*

*ASTRANETRA is an educational tool. It operates entirely on your local machine.*

*The eye watches only what you show it.*

<br/>

[![Clone](https://img.shields.io/badge/git%20clone-AstraNetra-A855F7?style=for-the-badge&logo=github&logoColor=white)](https://github.com/adarsh-singh106/AstraNetra.git)

</div>