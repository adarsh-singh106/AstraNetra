# Astranetra: Core CS Concepts

---

# Chapter 5 — Persistence: How Programs Survive Reboots

> **Reading time:** ~22 minutes
> **Prerequisites:** Chapter 1 (System Calls), Chapter 2 (The Filesystem Is a Lie), Chapter 3 (Everything Is a Process)
> **Next chapter:** Chapter 6 — The PATH Variable Is a Security Hole

---

## The Hook

You restart your computer. RAM is wiped clean — every variable, every running
program, every open file handle — gone. The slate is blank. Your CPU is sitting
at address zero with nothing to do.

Yet when Windows loads, Discord pops up. Steam appears. Your antivirus starts
scanning. OneDrive begins syncing. Nobody clicked on them. Nobody double-clicked
an icon, nobody ran a command. They just... appeared.

How did they know to start?

You might say: *"They're in the startup folder."* Okay. But what IS the startup
folder? Who checks it? When? What happens if you put YOUR script in it?

And more importantly — what stops **anything** from adding itself to that list?

Because here's the thing that should make you uncomfortable: there is no
approval process. There is no "Are you sure you want this program to run every
time you boot?" dialog. Any program with write access to the right folder — or
the right registry key — can register itself to run on boot. Silently. Without
asking. And that is exactly what Astranetra's `PersistenceEngine.js` does.

This chapter explains the mechanisms that make this possible — the physics of
why RAM forgets, the boot chain that rebuilds your world from nothing, and the
surprisingly simple lists that decide which programs come back to life.

---

## The Mental Model — The Hotel Wake-Up Call List

Imagine a hotel. Every evening, the front desk keeps a wake-up call list —
a clipboard with room numbers and times. At 6:00 AM, the hotel opens for the
day. The receptionist picks up the phone, reads the list, and calls every
room on it, one by one.

Room 204: *ring*. Room 317: *ring*. Room 512: *ring*.

Now here's the important part: the receptionist doesn't verify whether you
SHOULD be on the list. She doesn't check if you're a legitimate guest or if
someone snuck in and wrote a room number that doesn't even exist. She just
calls every number on the list. If you're on it, you get woken up. Period.

That clipboard is your operating system's **startup registry**.

- **The hotel** = your OS
- **Opening for the day** = booting up
- **The wake-up call list** = startup folder / registry keys / systemd units
- **Each room** = a program registered to autostart
- **The receptionist** = the init system (Explorer on Windows, systemd on Linux, launchd on macOS)
- **Writing your room number on the list** = what `PersistenceEngine.js` does

Anyone can walk up to the front desk and add themselves to the list. The hotel
doesn't verify identity. It doesn't ask *why* you want to be woken up. It
doesn't even confirm that you're a paying guest. If your number is on the
clipboard, you get the call.

This is not a design flaw. It's a design choice that prioritizes flexibility
over security — and it's the reason both legitimate software and malware use
the exact same persistence mechanisms.

---

## The Mechanism — How It Actually Works

### Part 1: Why RAM Forgets Everything

Before we talk about how programs come back, we need to understand why they
die in the first place.

Your RAM — the 8 or 16 GB stick inside your computer — is made of a specific
type of silicon chip called **DRAM** (Dynamic Random-Access Memory). Each bit
of data in DRAM is stored as an electrical charge in a tiny capacitor. A charged
capacitor = 1. A discharged capacitor = 0. That's it. Every variable you create,
every object in memory, every function call stack — it's all just billions of
tiny capacitors either holding a charge or not.

Here's the problem: capacitors leak. The charge drains away naturally, like
water seeping out of a cup with microscopic cracks. Within milliseconds, the
charge drops below the threshold where the circuitry can reliably read it.

So DRAM has a **refresh circuit** — a component that reads every capacitor and
rewrites its charge thousands of times per second (typically every 64
milliseconds for DDR4). Your RAM is not passively storing data. It is actively,
frantically rewriting itself 15+ times per second just to avoid forgetting.

Pull the power plug? The refresh circuit stops. The capacitors drain. Within
a fraction of a second, every bit decays to an unreadable state. Your data
is gone. Not deleted — dissolved. This is why RAM is called **volatile memory**.

**Your SSD is different.** SSDs use NAND flash memory, which stores data by
trapping electrons in an insulated gate (called a floating gate or charge trap).
The insulation is good enough that electrons stay trapped for years without
power. Hard drives are different again — they magnetize tiny regions of a
spinning metal platter. Magnetic orientation doesn't fade when you unplug it.
Both are **non-volatile**: they retain data without power.

```
VOLATILE (needs power):            NON-VOLATILE (keeps data):
┌──────────────────────┐           ┌──────────────────────────┐
│  DRAM (your RAM)     │           │  NAND Flash (your SSD)   │
│  ● Capacitor-based   │           │  ● Charge-trap gates     │
│  ● Refreshed ~15x/s  │           │  ● Retains for years     │
│  ● Lost on power-off │           │  ● Survives power-off    │
│                      │           │                          │
│  SRAM (CPU cache)    │           │  Magnetic disk (HDD)     │
│  ● Flip-flop gates   │           │  ● Magnetized platters   │
│  ● Faster, smaller   │           │  ● Retains for decades   │
│  ● Also volatile     │           │  ● Survives power-off    │
└──────────────────────┘           └──────────────────────────┘
```

So every program, every process, every piece of state that was living in RAM
when you hit the power button — it's gone. Forever. The OS itself was in RAM.
It's gone too. When you press the power button again, your computer starts from
absolute zero. And yet, 30 seconds later, you're looking at your desktop with
programs already running.

How? The boot chain.

### Part 2: The Boot Chain — Power Button to Desktop

When you press the power button, a precise sequence of events unfolds. Each
stage loads the next, like a chain of dominoes:

```
┌────────────────────────────────────────────────────────────────────┐
│                    THE BOOT CHAIN                                  │
│                                                                    │
│  ① POWER ON                                                       │
│     └─→ Motherboard sends electrical signal to CPU                 │
│         CPU begins executing at a hardcoded address (reset vector) │
│                                                                    │
│  ② BIOS / UEFI (firmware, stored on a flash chip on motherboard)  │
│     └─→ POST (Power-On Self-Test): checks RAM, CPU, disks exist   │
│     └─→ Finds the boot device (SSD/HDD) from boot order config    │
│     └─→ Loads the bootloader from the boot sector of that disk     │
│                                                                    │
│  ③ BOOTLOADER (GRUB on Linux, Windows Boot Manager on Windows)    │
│     └─→ Reads filesystem enough to find the kernel binary          │
│     └─→ Loads the kernel into RAM                                  │
│     └─→ Hands control to the kernel                                │
│                                                                    │
│  ④ KERNEL LOADS                                                    │
│     └─→ Initializes memory management (page tables, virtual mem)   │
│     └─→ Initializes device drivers (disk, display, keyboard, etc.) │
│     └─→ Mounts the root filesystem (so files become accessible)    │
│     └─→ Starts the first process: init / systemd (PID 1)          │
│                                                                    │
│  ⑤ INIT SYSTEM (PID 1)                                            │
│     └─→ Reads its configuration to know what to start              │
│     └─→ Starts system services (networking, display manager, etc.) │
│     └─→ Reaches the "user session" target/runlevel                 │
│                                                                    │
│  ⑥ USER SESSION                                                    │
│     └─→ Login screen appears → user logs in                        │
│     └─→ Desktop environment loads (Explorer, GNOME, Aqua)          │
│     └─→ ★ AUTOSTART PROGRAMS ARE LAUNCHED HERE ★                   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

Notice where autostart happens: at the very end. Step 6. After the kernel,
after the init system, after the user logs in. The entire OS has to rebuild
itself from firmware before any "startup program" gets a chance to run.

**BIOS vs UEFI:** BIOS (Basic Input/Output System) is the legacy firmware from
the 1980s. UEFI (Unified Extensible Firmware Interface) is its modern
replacement, used on virtually all machines sold after 2012. UEFI supports
larger disks (GPT partition tables), faster boot, Secure Boot (verifying the
bootloader's digital signature), and a graphical setup interface. Both serve
the same role: they're the first software to run, stored in a flash chip on
the motherboard, not on your SSD.

**PID 1:** On Linux, the first process the kernel starts is PID 1 — historically
`init`, now almost universally `systemd`. It is the ancestor of every other
process on the system. If PID 1 dies, the kernel panics. On Windows, the
equivalent is `smss.exe` (Session Manager Subsystem), which starts `csrss.exe`
and `wininit.exe`. On macOS, it's `launchd`.

### Part 3: Where Autostart Programs Are Registered

Now you understand the chain. The OS boots, reaches the user session, and then
checks a list of programs to launch automatically. But where is that list?

The answer depends on the OS — and there isn't just one list. There are many,
and they're checked at different stages.

#### Windows Autostart Mechanisms

**1. The Startup Folder**

```
%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
```

This is the simplest mechanism. When Explorer (the shell process, `explorer.exe`)
starts your user session, it enumerates every file in this folder and launches
it. Drop an `.exe`, `.bat`, `.lnk` (shortcut), or `.js` file here, and it runs
on next login. No questions asked.

There's also a system-wide startup folder at:
```
%ProgramData%\Microsoft\Windows\Start Menu\Programs\Startup
```
Files here run for ALL users — but writing here requires admin privileges.

**2. Registry Run Keys**

The Windows Registry is a **hierarchical database** that the OS uses to store
configuration. Not a file in the normal sense — it's a binary hive mapped into
kernel memory, accessed through specific API calls (`RegOpenKeyEx`, `RegSetValueEx`).
Think of it as a giant tree of key-value pairs that everything from your desktop
wallpaper to your network settings lives in.

The relevant keys for autostart:
```
HKCU\Software\Microsoft\Windows\CurrentVersion\Run
HKLM\Software\Microsoft\Windows\CurrentVersion\Run
```

- **HKCU** = "HKEY_CURRENT_USER" — per-user settings. Any program can write here
  without admin rights.
- **HKLM** = "HKEY_LOCAL_MACHINE" — system-wide. Requires admin.

Each value under these keys is a name-value pair where the value is a path to
an executable. When a user logs in, Windows reads every value under these keys
and executes them. You can see them with `regedit.exe` or from the command line:

```
reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Run"
```

**3. Task Scheduler**

The most powerful mechanism. `schtasks` lets you create scheduled tasks with
triggers: at boot, at login, at a specific time, or when a specific Windows
event occurs. Tasks can run as any user, including SYSTEM. They persist across
reboots because the task definitions are stored in XML files under
`%SystemRoot%\System32\Tasks\`.

```
schtasks /create /tn "MyTask" /tr "notepad.exe" /sc onlogon
```

That one command creates a task that runs Notepad on every login. No user
prompt. No consent dialog.

**4. Windows Services**

Services run as SYSTEM — the highest-privilege built-in account — and they
start *before* any user logs in. They're managed with `sc.exe`:

```
sc create MyService binPath= "C:\path\to\my.exe" start= auto
```

This creates a service that starts automatically on boot. Your antivirus,
Windows Update, and most background processes are services.

#### Linux Autostart Mechanisms

**1. systemd Units**

The modern init system on Linux. Service definitions live as `.service` files:
- System-wide: `/etc/systemd/system/`
- Per-user: `~/.config/systemd/user/`

A unit file looks like:
```ini
[Unit]
Description=My autostart program

[Service]
ExecStart=/usr/bin/node /path/to/script.js
Restart=on-failure

[Install]
WantedBy=default.target
```

`WantedBy=default.target` means: start this when the system reaches its
default operating state (equivalent to "fully booted"). Enable it with
`systemctl enable myservice` — this creates a symlink in the target's
`.wants` directory, which is how systemd knows to start it.

**2. XDG Autostart (.desktop files)**

For graphical desktop environments. Files in `~/.config/autostart/` follow
the `.desktop` file format — an INI-style plaintext format with a
`[Desktop Entry]` header section:

```ini
[Desktop Entry]
Type=Application
Name=astranetra
Exec=node /home/user/astranetra/index.js
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
```

The key fields:
- `Type=Application` — tells the DE this is a launchable program
- `Exec=` — the command to run (equivalent to typing this in a terminal)
- `Hidden=false` — if true, the entry is silently ignored
- `X-GNOME-Autostart-enabled=true` — GNOME-specific flag; other DEs may ignore it

When your desktop environment starts (GNOME, KDE, XFCE), it reads every
`.desktop` file in `~/.config/autostart/` and launches the `Exec=` command
for any entry that isn't hidden or disabled. This is the mechanism Astranetra
uses on Linux.

**3. Shell Configuration Files**

These don't run at boot — they run every time you open a terminal:

- `~/.bashrc` — sourced by Bash on every interactive non-login shell
- `~/.zshrc` — sourced by Zsh on every interactive shell
- `~/.profile` — sourced by login shells (once per session)
- `~/.bash_profile` — Bash-specific login shell config

Technically these are "persistence" in the broader sense — any command you
put here will run repeatedly. Astranetra's `registerInPath()` appends an
`export PATH=...` line to `.bashrc` and `.zshrc` — not to run on boot, but
to ensure the PATH modification is active in every future terminal session.

**4. crontab @reboot**

The cron daemon supports a special `@reboot` trigger:
```
@reboot /usr/bin/node /path/to/script.js
```
This runs once at system boot (specifically when the cron daemon starts).

#### macOS: LaunchAgents vs LaunchDaemons

macOS uses `launchd` (PID 1) for all process management. Autostart is
configured via **plist** (Property List) files — XML documents:

- **LaunchAgents** (user-level): `~/Library/LaunchAgents/`
- **LaunchDaemons** (system-level): `/Library/LaunchDaemons/`

A LaunchAgent plist looks like:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>         <string>com.astranetra</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/Users/you/astranetra/index.js</string>
  </array>
  <key>RunAtLoad</key>     <true/>
  <key>KeepAlive</key>     <false/>
</dict>
</plist>
```

Key fields:
- `Label` — unique identifier (reverse-DNS convention)
- `ProgramArguments` — array of [executable, arg1, arg2, ...]
- `RunAtLoad` — if `<true/>`, runs when the plist is loaded (at login)
- `KeepAlive` — if `<true/>`, `launchd` restarts the process if it exits

LaunchDaemons run as root, before any user logs in (like Windows Services).
LaunchAgents run per-user, after login (like the Startup folder).

### Part 4: Why Self-COPY, Not Self-MOVE

This is a subtle but critical detail. When Astranetra persists, it **copies**
itself to the startup folder. It does NOT move itself.

Why? Think about it:

1. User downloads Astranetra to `~/Downloads/astranetra/`
2. Astranetra copies `index.js` to the Startup folder
3. User notices the download and deletes `~/Downloads/astranetra/`
4. On next boot, the Startup folder copy still runs — the deletion didn't
   affect it because it's an independent copy, not a reference or shortcut

If Astranetra had **moved** instead of copied, the original would be gone.
A single location. Delete that one file, and persistence is broken. By
copying, there are now two independent copies. The user would have to find
and delete BOTH to fully remove it.

Real malware takes this further — copying to multiple locations, using
multiple persistence mechanisms simultaneously (Startup folder AND registry
key AND scheduled task), and giving copies randomized names so they're harder
to identify. Astranetra uses only one mechanism per platform to keep things
educational and reversible.

---

## The Experiment — Write It Yourself

Don't run Astranetra's persistence engine. Build your own, from scratch. This
script creates a safe, harmless autostart entry that writes a timestamp to a
log file — proving it ran without you clicking anything.

**On Windows**, save this as `persistence_demo.js`:

```javascript
import fs from 'fs';
import path from 'path';
import os from 'os';

// ── Where the Startup folder actually is ────────────────────────────────────

const startupDir = path.join(
  process.env.APPDATA,  // e.g., C:\Users\YourName\AppData\Roaming
  'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup'
);

console.log('=== PERSISTENCE DEMO ===');
console.log(`Startup folder: ${startupDir}`);

// ── Create a tiny batch script that writes a timestamp to a log ─────────────

const logFile    = path.join(os.homedir(), 'persistence_demo_log.txt');
const batContent = `@echo off
echo [PERSISTENCE DEMO] Ran at: %date% %time% >> "${logFile}"
`;

const batPath = path.join(startupDir, 'persistence_demo.bat');

// ── Write it to the Startup folder ──────────────────────────────────────────

fs.writeFileSync(batPath, batContent, 'utf8');
console.log(`\nCreated: ${batPath}`);
console.log(`Log file will be: ${logFile}`);
console.log('\nNow restart your computer (or log out and log back in).');
console.log('After login, check the log file — it will have a timestamp.');
console.log('You never clicked anything. The OS did it.\n');

// ── Tell the student how to clean up ────────────────────────────────────────

console.log('=== TO REMOVE ===');
console.log(`Delete: ${batPath}`);
console.log(`Delete: ${logFile}`);
```

**On Linux**, the equivalent:

```javascript
import fs from 'fs';
import path from 'path';
import os from 'os';

// ── Where XDG autostart entries live ────────────────────────────────────────

const autostartDir = path.join(os.homedir(), '.config', 'autostart');
fs.mkdirSync(autostartDir, { recursive: true });

console.log('=== PERSISTENCE DEMO ===');
console.log(`Autostart dir: ${autostartDir}`);

// ── Create a .desktop file that writes a timestamp ──────────────────────────

const logFile = path.join(os.homedir(), 'persistence_demo_log.txt');
const desktopContent = `[Desktop Entry]
Type=Application
Name=PersistenceDemo
Exec=bash -c 'echo "[PERSISTENCE DEMO] Ran at: $(date)" >> ${logFile}'
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
`;

const desktopPath = path.join(autostartDir, 'persistence_demo.desktop');

// ── Write it ────────────────────────────────────────────────────────────────

fs.writeFileSync(desktopPath, desktopContent, 'utf8');
console.log(`\nCreated: ${desktopPath}`);
console.log(`Log file will be: ${logFile}`);
console.log('\nLog out and back in (or reboot).');
console.log('The .desktop file will execute without you doing anything.\n');

console.log('=== TO REMOVE ===');
console.log(`Delete: ${desktopPath}`);
console.log(`Delete: ${logFile}`);
```

Run it: `node persistence_demo.js`

Then restart your computer (or just log out and log back in). When you return,
check the log file. There will be a timestamp — written by a program that
nobody clicked on. The OS saw your script in the autostart list and ran it,
no questions asked.

**The surprising part:** You didn't need admin rights. You didn't need to
install anything. You wrote a file to a specific directory, and the OS treated
it as a command to execute on every login. That's how thin the line is.

---

## The Astranetra Connection

Open `core/PersistenceEngine.js`. This is one of the most instructive files
in the entire codebase because it does something most programs do silently —
but does it visibly, with logging, state tracking, and a clean undo mechanism.

### loadState() / saveState() — Tracking What You Did (Lines 19–31)

```javascript
// core/PersistenceEngine.js — Lines 19-31

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      // STATE_FILE = logs/persistence_state.json
      // This tracks every persistence action so revert() can undo them
    }
  } catch (_) {}
  return { copies: [], pathEntries: [], shellLines: [] };
  // Default state: nothing persisted yet
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  // Writes the state as formatted JSON — human-readable for debugging
}
```

This is the undo log. Every action `PersistenceEngine` takes — every file
it copies, every shell config it modifies — gets recorded here. This is what
makes Astranetra educational rather than destructive: you can always revert.

### selfCopy() — Platform-Specific Autostart (Lines 34–96)

This is the core persistence function. It reads the target directory from
`config.persistence.targets[platform]` and does something different on each OS:

**Windows (Lines 46–51):**
```javascript
if (platform === 'win32') {
  const dest = path.join(targetDir, 'astranetra.js');
  fs.copyFileSync(srcScript, dest);
  // targetDir = %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
  // fs.copyFileSync is a system call: it asks the kernel to read the source
  // file's bytes and write them to the destination path. One call, two
  // kernel operations (read + write).
  copyResult = dest;
}
```

Simple. Copy `index.js` to the Startup folder with a new name. Explorer will
launch it on next login.

**Linux (Lines 53–69):**
```javascript
} else if (platform === 'linux') {
  const desktopPath = path.join(targetDir, 'astranetra.desktop');
  const desktop = [
    '[Desktop Entry]',          // INI-style section header
    'Type=Application',          // This is a launchable application
    'Name=astranetra',           // Human-readable name
    `Exec=node ${srcScript}`,    // The command to run — node + script path
    'Hidden=false',              // Not hidden from autostart managers
    'NoDisplay=false',           // Show in application menus
    'X-GNOME-Autostart-enabled=true',  // GNOME-specific: yes, really run this
  ].join('\n');
  fs.writeFileSync(desktopPath, desktop, 'utf8');
  // Doesn't copy the script — creates a LAUNCHER that points to it
  // The desktop environment reads this file and runs the Exec command
}
```

Notice the difference: on Windows, the actual script is copied. On Linux, a
`.desktop` launcher is created that references the script's original location.
If you delete the original script, the `.desktop` entry will fail silently on
next login (the `Exec` path won't resolve).

**macOS (Lines 71–93):**
```javascript
} else if (platform === 'darwin') {
  const plistPath = path.join(targetDir, 'com.astranetra.plist');
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>         <string>com.astranetra</string>
  <key>ProgramArguments</key>
  <array>
    <string>${process.execPath}</string>   <!-- Full path to node binary -->
    <string>${srcScript}</string>          <!-- Full path to index.js -->
  </array>
  <key>RunAtLoad</key>     <true/>         <!-- Run when this plist loads -->
  <key>KeepAlive</key>     <false/>        <!-- Don't restart if it exits -->
</dict>
</plist>`;
  fs.writeFileSync(plistPath, plist, 'utf8');
  // launchd reads this plist at login and executes ProgramArguments
}
```

Three operating systems, three completely different file formats, three
different init systems reading them — all achieving the same goal: run this
program when the user logs in.

### registerInPath() — Secondary Persistence (Lines 99–144)

`selfCopy()` makes Astranetra run on boot. `registerInPath()` does something
different: it ensures the `astranetra` command works from any terminal.

**Windows (Lines 103–116):**
```javascript
execSync(`setx PATH "${current};${injectedDir}"`, { encoding: 'utf8' });
// setx writes to the Windows Registry permanently
// HKCU\Environment\PATH — this is the user's persistent PATH variable
// Unlike 'set' (which is session-only), setx survives reboots
// This is a PERMANENT change to the user's environment
```

**Unix (Lines 119–143):**
```javascript
const exportLine = `\nexport PATH="$PATH:${injectedDir}"  # astranetra\n`;
fs.appendFileSync(shellConfig, exportLine, 'utf8');
// Appends to ~/.bashrc and ~/.zshrc
// Every time the user opens a new terminal, this line executes
// Note the comment marker: "# astranetra" — this is crucial for revert()
```

The `# astranetra` comment marker is a design pattern worth studying. It has
no effect on the shell command itself — but it acts as a tag that `revert()`
can search for later when removing these lines.

### revert() — The Clean Undo (Lines 175–217)

```javascript
// Remove copied files
for (const copyPath of state.copies) {
  if (fs.existsSync(copyPath)) {
    fs.unlinkSync(copyPath);
    // fs.unlinkSync = system call to delete a file
    // On Unix, this literally removes the directory entry (the "link")
    // to the inode — Chapter 2 explained why this is called "unlink"
  }
}

// Remove PATH entries from shell configs
for (const shellConfig of state.shellLines) {
  const content = fs.readFileSync(shellConfig, 'utf8');
  const cleaned = content.split('\n')
    .filter(line => !line.includes('# astranetra'))
    // ↑ This is why the comment marker exists — it's a search tag
    // Every line containing "# astranetra" is removed, everything else stays
    .join('\n');
  fs.writeFileSync(shellConfig, cleaned, 'utf8');
}

// Reset state file
saveState({ copies: [], pathEntries: [], shellLines: [] });
```

This is responsible engineering. Real malware has no `revert()` function. It
has no state file. It doesn't leave a `# malware` comment in your `.bashrc`
for easy removal. The fact that Astranetra tracks its own actions and provides
a one-command undo (`node index.js persist --revert`) is what separates
education from exploitation.

### Config: persistence.targets (astranetra.config.js)

```javascript
// config/astranetra.config.js — Lines 37-57

persistence: {
  targets: {
    win32:  path.join(process.env.APPDATA, 'Microsoft', 'Windows',
            'Start Menu', 'Programs', 'Startup'),
    linux:  path.join(home, '.config', 'autostart'),
    darwin: path.join(home, 'Library', 'LaunchAgents'),
  },
  pathShellConfigs: {
    linux:  [path.join(home, '.bashrc'), path.join(home, '.zshrc')],
    darwin: [path.join(home, '.zshrc'), path.join(home, '.bash_profile')],
    win32:  null, // uses setx instead of shell configs
  },
}
```

Every platform-specific path is centralized in config. If macOS changes its
LaunchAgents directory in a future version (unlikely, but possible), you
change one line in config — not scattered `if` blocks throughout the code.

---

## The Deeper Questions

**1. How do you DETECT unwanted startup entries?**

On Windows, Microsoft's **Autoruns** (`autoruns.exe`, free from Sysinternals)
is the gold standard. It shows EVERY autostart location — the Startup folder,
registry Run keys, scheduled tasks, services, shell extensions, browser
helpers, Winlogon entries, and dozens more. There are over 30 autostart
locations on Windows. We only covered 4.

On Linux: `systemctl list-unit-files --state=enabled` shows all enabled
systemd services. `ls ~/.config/autostart/` shows XDG autostart entries.
`crontab -l` shows scheduled cron jobs. `grep -r "# suspicious" ~/.bashrc
~/.zshrc` can find injected lines — if they were polite enough to leave
a comment (most malware is not).

**2. If persistence is this easy, what actually STOPS malware?**

Not file scanning. Not antivirus signature databases alone. Modern endpoint
protection uses **behavior analysis**: monitoring what a program DOES in real
time. Writing to the Startup folder? Flagged. Modifying `.bashrc`? Logged.
Creating a scheduled task with a hidden executable? Blocked.

The key insight: adding yourself to startup isn't illegal. It's what Discord,
Steam, and OneDrive all do. The OS can't block it without breaking legitimate
software. So security tools watch for suspicious PATTERNS: a program that
copies itself to startup AND scans the filesystem AND opens network connections
AND reads SSH keys is exhibiting a pattern consistent with malware — even
though each individual action is perfectly legal.

**3. What about UEFI rootkits — persistence that survives OS reinstallation?**

Some advanced malware writes itself into the UEFI firmware flash chip. Since
UEFI runs before the OS loads, this kind of persistence survives formatting
your drive and reinstalling Windows. The malware injects itself during the
boot chain at Step 2, before the OS even exists. This is extremely rare and
extremely sophisticated — but it exists. Secure Boot was designed specifically
to prevent this by requiring bootloaders to have a valid digital signature.

---

## Challenge Problem

Write a script that enumerates ALL autostart entries on your system.

On Windows: read the Startup folder contents with `fs.readdirSync()`, AND
query the registry Run key with `execSync('reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run"')`.
Print both lists side by side.

On Linux: read `~/.config/autostart/` for `.desktop` files, AND run
`systemctl list-unit-files --user --state=enabled` for user services, AND
read your `~/.bashrc` for any lines containing `export PATH`.

Compare what you find with what you expected. How many programs registered
themselves to autostart without you knowing? Were any of them programs you
don't use anymore? Could you remove them?

No solution given. But if the number of autostart entries surprises you,
that's the point.

---

> **Next Chapter: The PATH Variable Is a Security Hole**
>
> You type `node` in your terminal and Node.js runs. But you didn't tell your
> terminal WHERE `node` lives. It searched a list of directories — in order —
> until it found a match. That list is `PATH`. And the order matters. Because
> if someone puts a malicious `node` executable in a directory that's checked
> FIRST, your terminal runs the fake one instead of the real one. Chapter 6
> explains how PATH resolution actually works, why it's a security hole, and
> how Astranetra's `registerInPath()` exploits it.
