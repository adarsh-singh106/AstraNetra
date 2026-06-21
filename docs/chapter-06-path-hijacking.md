# Astranetra: Core CS Concepts

---

# Chapter 6 — The PATH Variable Is a Security Hole

> **Reading time:** ~22 minutes
> **Prerequisites:** Chapter 0 (It's Not Magic), Chapter 1 (System Calls), Chapter 5 (Persistence)
> **Next chapter:** Chapter 7 — Hashing: Fingerprinting Data

---

## The Hook

You type `python` in your terminal and Python opens. You type `git` and Git runs.
You type `node` and Node.js starts.

But you never told the terminal WHERE those programs live on your hard drive.
You didn't type `C:\Program Files\Python39\python.exe`. You didn't type
`/usr/local/bin/node`. You just typed `python`. You just typed `node`.

How does the OS find it?

You might say: *"The terminal just knows."* It doesn't. Your terminal is a program
like any other — it has no built-in catalog of every executable on your machine.

You might say: *"It searches the whole hard drive."* It doesn't. That would take
minutes. You get a result in milliseconds.

The answer is a single environment variable called `PATH`. It's a short list of
directories the OS checks, in order, every time you type a command. And the trick
is in the words **"in order."**

Because if someone puts a FAKE `python` — a malicious script with the same name —
in a directory that the OS checks FIRST, your terminal will run the fake one.
You'll never see an error. You'll never get a warning. The wrong program runs,
and you have no idea.

This is called **PATH hijacking**, and Astranetra demonstrates exactly how it
works. This chapter explains the mechanism behind it — and why a variable you've
never thought about is one of the most exploitable things on your computer.

---

## The Mental Model — The Phone Contact List

Imagine your phone's contact list. You have an entry called "Mom." When you say
"call Mom," your phone doesn't search every phone number in the world. It looks
through YOUR contact list, top to bottom, and calls the first "Mom" it finds.

Now imagine someone borrows your phone and adds a new "Mom" entry at the very
top of your list — but with a different phone number. A stranger's number.

Next time you say "call Mom," your phone finds that fake entry first. It dials
the stranger. You hear someone answer and you start talking, thinking it's your
mom. The real entry still exists, further down the list. But the phone never
gets there. First match wins.

That's exactly how PATH works:

- **Your contact list** = the PATH variable (an ordered list of directories)
- **"Mom"** = the command you typed (like `git` or `python`)
- **Each contact entry** = a directory the OS searches for that command
- **The fake entry at the top** = a malicious directory prepended to PATH
- **First match wins** = the OS runs the first matching executable it finds

The attack is simple: put a directory with a fake `git` at the front of the
contact list. The OS will never look far enough to find the real one.

---

## The Mechanism — What Actually Happens

### What ARE Environment Variables?

Before we talk about PATH specifically, you need to understand what environment
variables are in general — because most students have a vague idea at best.

An environment variable is a **key-value pair stored in your process's memory
block**. Not on disk. Not in a config file (though config files can SET them).
They live in RAM, as part of your running process.

```
┌──────────────────────────────────────────────────────────┐
│                     PROCESS MEMORY                        │
│                                                           │
│   ┌─────────────────────────────────────────────────┐    │
│   │ Code (your program's instructions)               │    │
│   ├─────────────────────────────────────────────────┤    │
│   │ Stack (local variables, function calls)           │    │
│   ├─────────────────────────────────────────────────┤    │
│   │ Heap (dynamically allocated memory)               │    │
│   ├─────────────────────────────────────────────────┤    │
│   │ ENVIRONMENT BLOCK  ← here                        │    │
│   │   PATH=C:\Windows\System32;C:\Windows;...        │    │
│   │   HOME=C:\Users\adarsh                           │    │
│   │   TEMP=C:\Users\adarsh\AppData\Local\Temp        │    │
│   │   NODE_ENV=development                           │    │
│   │   ... (dozens more)                              │    │
│   └─────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

When you open a terminal, that terminal is a process. It has its own environment
block. When the terminal spawns a child process (you type `node myScript.js`),
the OS **copies** the parent's entire environment block into the child.

This is critical: the child gets a **copy**, not a reference. If the child
modifies its `PATH`, the parent's `PATH` is unaffected. If the parent changes
its `PATH` after spawning the child, the child doesn't see the change.

### How Environment Inheritance Works

On Unix, when you run a program, the kernel performs a `fork()` system call
(which clones the parent process), followed by `execve()` (which replaces the
clone's code with the new program). The `execve()` call receives the environment
as one of its arguments — literally an array of strings like
`["PATH=/usr/bin:/bin", "HOME=/home/user", ...]`.

On Windows, the `CreateProcess()` Win32 API call has an `lpEnvironment`
parameter. If you pass `NULL`, the child inherits the parent's environment. If
you pass a custom block, the child gets that instead.

```
Terminal (bash/cmd/PowerShell)
  │
  │  fork() + execve()           ← Unix
  │  CreateProcess()             ← Windows
  │
  ├──► node myScript.js          (gets COPY of terminal's env)
  │     │
  │     ├──► child_process.exec("git status")   (gets COPY of node's env)
  │     │
  │     └──► worker_thread       (shares process env — same memory!)
  │
  └──► python other.py           (gets SEPARATE copy of terminal's env)
```

**You might think:** *"So if I change `PATH` inside my Node.js script, it
changes globally?"*

No. You changed the copy. The terminal that spawned your script still has its
original `PATH`. But — and this is the attack vector — any child processes
YOUR script spawns will inherit YOUR modified `PATH`. So if your Node.js
script prepends a malicious directory to `PATH` and then calls
`execSync('git status')`, that `git` call uses the poisoned `PATH`.

### The PATH Variable Specifically

`PATH` is just one environment variable, but it's special because the shell
uses it every time you type a command. It's an **ordered list of directories**,
separated by:

- **`:`** (colon) on Unix/Linux/macOS
- **`;`** (semicolon) on Windows

Example on Linux:
```
PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/home/user/.local/bin
```

Example on Windows:
```
PATH=C:\Windows\System32;C:\Windows;C:\Program Files\nodejs;C:\Python39
```

Each entry is a directory. When you type a command, the shell searches these
directories **left to right** (or equivalently, first to last). The first
executable it finds with a matching name — that's the one it runs.

### The Command Resolution Algorithm

Here is the exact sequence your shell follows when you type a command like
`git status`:

```
You type: git status
       │
       ▼
┌─ Step 1: Is "git" a shell BUILTIN? ─────────────────┐
│  (builtins: cd, echo, export, alias, exit, etc.)     │
│  If yes → run the builtin directly, no file needed.  │
│  If no  → continue.                                  │
└──────────────────────────────────────────────────────┘
       │ no
       ▼
┌─ Step 2: Is "git" an ALIAS? ────────────────────────┐
│  (aliases: user-defined shortcuts in .bashrc etc.)   │
│  alias git='hub'  → would resolve "git" to "hub"    │
│  If yes → expand the alias, re-start resolution.     │
│  If no  → continue.                                  │
└──────────────────────────────────────────────────────┘
       │ no
       ▼
┌─ Step 3: Is "git" a FUNCTION? ──────────────────────┐
│  (shell functions defined in the current session)    │
│  If yes → run the function.                          │
│  If no  → continue.                                  │
└──────────────────────────────────────────────────────┘
       │ no
       ▼
┌─ Step 4: Search PATH directories LEFT → RIGHT ──────┐
│                                                       │
│  PATH = /usr/local/bin : /usr/bin : /bin              │
│                                                       │
│  Check /usr/local/bin/git  → exists?  NO              │
│  Check /usr/bin/git        → exists?  YES → RUN IT   │
│  (never checks /bin/git — first match wins)           │
│                                                       │
│  If NO match in any PATH dir → "command not found"    │
└──────────────────────────────────────────────────────┘
```

**On Windows, two additional things happen:**

**First: the current directory is searched BEFORE PATH.** If you have a file
called `git.exe` in the folder where your terminal is open, Windows will run
THAT one — even if the real Git is in `C:\Program Files\Git\cmd`. This is a
security problem unique to Windows. On Unix, the current directory is NOT
searched unless you explicitly type `./git`. This design difference has caused
real security vulnerabilities.

**Second: Windows appends PATHEXT extensions.** When you type `git`, Windows
doesn't just look for a file literally named `git`. It also looks for:

```
git.COM    (oldest DOS executable format)
git.EXE    (standard Windows executable)
git.BAT    (batch script)
git.CMD    (command script — like .bat but for cmd.exe)
git.VBS    (VBScript — yes, still checked)
git.VBE    (encoded VBScript)
git.JS     (JScript — Windows Script Host, NOT Node.js)
git.JSE    (encoded JScript)
git.WSF    (Windows Script File)
git.WSH    (Windows Script Host settings)
git.MSC    (Microsoft Management Console snap-in)
git.PS1    (PowerShell script — only in some configs)
```

The full list is stored in the `PATHEXT` environment variable:
```
PATHEXT=.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC
```

This means that on Windows, if an attacker drops a file called `git.cmd` into
a directory that's searched early, it will run instead of `git.exe` from the
real Git installation. The attacker doesn't even need to create a `.exe` file —
a plain text `.cmd` file is enough.

### How `which` and `where` Work

You can ask the OS which executable will actually run when you type a command:

- **Unix:** `which git` → prints the full path (e.g., `/usr/bin/git`)
- **Windows:** `where git` → prints all matching paths, in search order

`which` on Unix searches the PATH directories left to right and prints the first
match — exactly what the shell would do. It's essentially a dry run of command
resolution. Some shells have a builtin `type` command that also tells you if
something is an alias, function, or builtin.

`where` on Windows shows ALL matches, not just the first. This is useful for
debugging: if you see two entries, the top one is the one that would execute.
If the top one is in `C:\Users\hacker\evil\`, you have a problem.

### Why PATH Order Matters — The Attack

The attack is embarrassingly simple:

1. Create a directory: `/tmp/evil/`
2. Put a script called `git` in it (a shell script that does whatever you want)
3. Make it executable: `chmod +x /tmp/evil/git`
4. Prepend it to PATH: `export PATH=/tmp/evil:$PATH`
5. Now type `git status`

The shell searches `/tmp/evil` first. Finds `git`. Runs it. Your malicious
script executes. The real `git` in `/usr/bin` is never reached.

The victim sees no error. The command might even do its normal job (the fake
script can call the real `git` after doing its malicious work), making the
hijack invisible.

### Where PATH Is Stored Permanently

Modifying PATH in a running terminal only lasts for that session. When you close
the terminal, the change is gone. To make PATH changes survive reboots:

**On Unix/Linux/macOS:**
- **Session-scoped:** `export PATH="/new/dir:$PATH"` — gone when the terminal closes
- **Permanent (per-user):** Add the export line to shell config files:
  - `~/.bashrc` or `~/.bash_profile` (Bash)
  - `~/.zshrc` (Zsh — default on modern macOS)
  - `~/.profile` (generic, read by login shells)
- **Permanent (system-wide):** Edit `/etc/environment` or add a file in `/etc/profile.d/`
- These files are just text files. Any program with write access to them can
  silently add a PATH entry. No admin password needed for per-user files.

**On Windows:**
- **Session-scoped:** `set PATH=C:\new\dir;%PATH%` in CMD, or `$env:PATH = "C:\new\dir;$env:PATH"` in PowerShell — gone when the terminal closes
- **Permanent (per-user):** Stored in the Windows Registry at:
  ```
  HKEY_CURRENT_USER\Environment
      PATH = C:\Users\you\AppData\Local\Programs;...
  ```
  Modified via `setx PATH "new;value"` or the System Properties GUI.
- **Permanent (system-wide):** Stored in the Registry at:
  ```
  HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Session Manager\Environment
      Path = C:\Windows\System32;C:\Windows;...
  ```
  Requires administrator privileges to modify.
- **Important:** `setx` writes to the Registry but does NOT update the current
  session's `PATH`. You need to open a new terminal to see the change. This
  confuses almost everyone the first time.

### How Real Attackers Use This

This isn't theoretical. PATH hijacking is used in real attacks:

- **Malicious npm packages:** A package's `postinstall` script runs automatically
  when you `npm install`. That script can modify your `.bashrc` or call `setx`
  to permanently add a malicious directory to your PATH. Next time you open a
  terminal and type `git push`, it runs the attacker's `git` instead.
- **Supply chain attacks:** An attacker compromises a popular library. The
  compromised version adds a PATH entry during installation. Thousands of
  developers install it and never notice.
- **Privilege escalation:** On shared servers, if a low-privilege user can write
  to a directory that's in another user's PATH, they can hijack commands that
  the other user runs — potentially commands run by root.

---

## The Experiment — Write It Yourself

Don't run Astranetra yet. Write this from scratch in a new file called
`path_hijack_demo.js`:

```javascript
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// ── Part 1: See your current PATH ──────────────────────────────────────────

const sep = process.platform === 'win32' ? ';' : ':';
const dirs = process.env.PATH.split(sep);

console.log('=== YOUR PATH (first 5 entries) ===');
for (let i = 0; i < Math.min(5, dirs.length); i++) {
  console.log(`  [${i + 1}] ${dirs[i]}`);
}
console.log(`  ... (${dirs.length} total entries)\n`);

// ── Part 2: Create a fake command ──────────────────────────────────────────

const fakeDir = path.join(process.cwd(), '_hijack_test');
fs.mkdirSync(fakeDir, { recursive: true });

// We'll hijack "echo" on Unix or create a fake "hello" on Windows
const isWin = process.platform === 'win32';
const cmdName = isWin ? 'hello.cmd' : 'echo';
const cmdPath = path.join(fakeDir, cmdName);

const fakeScript = isWin
  ? '@echo off\necho [HIJACKED] This is NOT the real command! You have been tricked.'
  : '#!/bin/sh\necho "[HIJACKED] This is NOT the real echo! You have been tricked."';

fs.writeFileSync(cmdPath, fakeScript, 'utf8');
if (!isWin) fs.chmodSync(cmdPath, 0o755);  // make executable on Unix

console.log(`Created fake command at: ${cmdPath}\n`);

// ── Part 3: Run the REAL command first ─────────────────────────────────────

console.log('=== BEFORE HIJACK ===');
try {
  const realCmd = isWin ? 'echo Normal echo works fine' : 'echo Normal echo works fine';
  const realResult = execSync(realCmd, { encoding: 'utf8' }).trim();
  console.log(`  Output: ${realResult}\n`);
} catch (e) {
  console.log(`  Error: ${e.message}\n`);
}

// ── Part 4: Prepend our fake directory to PATH ─────────────────────────────

const originalPath = process.env.PATH;
process.env.PATH = fakeDir + sep + originalPath;
// ↑ This ONLY modifies this process's copy. Your real terminal PATH is safe.

console.log('=== AFTER HIJACK (prepended fake dir to PATH) ===');

// On Unix, "echo" is usually a shell builtin, so we use "which" to show
// that PATH resolution would find our fake version first.
// On Windows, we run our custom "hello" command.
try {
  if (isWin) {
    const result = execSync('hello', { encoding: 'utf8', env: process.env }).trim();
    console.log(`  Output: ${result}`);
  } else {
    // "which echo" shows which file the shell WOULD execute
    const which = execSync('which echo', {
      encoding: 'utf8',
      env: process.env,
    }).trim();
    console.log(`  "which echo" now resolves to: ${which}`);
    // Run our fake echo directly
    const result = execSync(cmdPath, { encoding: 'utf8' }).trim();
    console.log(`  Output: ${result}`);
  }
} catch (e) {
  if (e.stdout) console.log(`  Output: ${e.stdout.trim()}`);
  else console.log(`  Error: ${e.message}`);
}

// ── Part 5: Restore and clean up ───────────────────────────────────────────

process.env.PATH = originalPath;  // restore the original PATH

console.log('\n=== AFTER RESTORING PATH ===');
try {
  const restoredCmd = isWin
    ? 'echo Normal echo is back!'
    : 'echo "Normal echo is back!"';
  const result = execSync(restoredCmd, { encoding: 'utf8' }).trim();
  console.log(`  Output: ${result}`);
} catch (e) {
  console.log(`  Error: ${e.message}`);
}

// Clean up
fs.rmSync(fakeDir, { recursive: true, force: true });
console.log(`\nCleaned up: removed ${fakeDir}`);
console.log('\n💡 Key insight: we never touched the REAL command.');
console.log('   We just put a fake one where the OS looks FIRST.');
```

Run it: `node path_hijack_demo.js`

**The surprising output:** Your script created a fake command, put it at the
front of PATH, and the OS ran the fake one without complaint. No permissions
error. No warning. No confirmation dialog. The OS blindly ran whatever file
it found first with the matching name. Then when you restored PATH, the real
command came back — it was there all along, just shadowed.

This is the fundamental problem: PATH-based resolution is a trust system with
no verification.

---

## The Astranetra Connection

Open `core/PathManipulator.js`. This entire module is an exercise in PATH
manipulation — from analyzing your current PATH to demonstrating a live hijack.

### The Constants (Lines 12–18)

```javascript
// core/PathManipulator.js — annotated

const STANDARD_PATHS = {
  linux:  ['/usr/bin', '/usr/local/bin', '/bin', '/sbin', '/usr/sbin', '/usr/local/sbin'],
  darwin: ['/usr/bin', '/usr/local/bin', '/bin', '/sbin', '/usr/sbin', '/opt/homebrew/bin'],
  win32:  ['C:\\Windows\\System32', 'C:\\Windows', 'C:\\Windows\\System32\\Wbem'],
};
// ↑ These are the "known safe" directories. Any PATH entry NOT in this list
//   is flagged as non-standard — and might be suspicious.

const SEPARATOR = platform === 'win32' ? ';' : ':';
// ↑ Windows uses semicolons, Unix uses colons. Get this wrong and your
//   entire PATH parsing breaks — you'd treat the whole string as one directory.
```

### analyzePath() — PATH Forensics (Lines 20–38)

```javascript
function analyzePath(rawPath) {
  const entries = rawPath.split(SEPARATOR).filter(Boolean);
  // ↑ Split the PATH string into individual directory paths.
  //   filter(Boolean) removes empty strings from doubled separators (;;)

  return entries.map((entry, i) => {
    const trimmed    = entry.trim();
    const standards  = STANDARD_PATHS[platform] || [];
    const isStandard = standards.some(s =>
      trimmed.toLowerCase().startsWith(s.toLowerCase())
    );
    // ↑ Case-insensitive comparison — Windows paths are case-insensitive

    const isTmp  = /tmp|temp/i.test(trimmed);
    // ↑ Any path containing "tmp" or "temp" is immediately suspicious.
    //   Attackers love temp directories because they're world-writable.

    const exists = (() => {
      try { return fs.existsSync(trimmed); } catch { return false; }
    })();
    // ↑ Does this directory even exist? A nonexistent PATH entry is a
    //   different kind of suspicious — it might be a leftover from
    //   uninstalled software, or an attacker probing for writeable dirs.

    let flag = '✓ standard';
    if (!exists)    flag = '✗ does not exist';
    else if (isTmp) flag = '🚨 SUSPICIOUS — temp directory';
    else if (!isStandard && isHome) flag = '⚠  non-standard (user home)';
    else if (!isStandard) flag = '⚠  non-standard';
    // ↑ Triage system: standard = safe, non-standard = warning,
    //   temp = red alert, nonexistent = gray flag.

    return { index: i + 1, path: trimmed, isStandard, isTmp, isHome, exists, flag };
  });
}
```

This function is doing something real security tools do: **PATH auditing**.
Enterprise security scanners check for temp directories in PATH, for
non-standard entries that might indicate compromise, and for directories
that don't exist (potential injection points — if an attacker can CREATE
that directory, they own that PATH slot).

### pathHijackDemo() — The Live Attack (Lines 67–106)

This is the heart of the chapter's concept, running as real code:

```javascript
export async function pathHijackDemo() {
  const demoDir = path.join(process.cwd(), 'injected_demo');
  const fakeGit = path.join(demoDir, platform === 'win32' ? 'git.cmd' : 'git');
  // ↑ On Windows: git.cmd (a batch script). On Unix: git (a shell script).
  //   Windows will find git.cmd because of PATHEXT resolution.

  fs.mkdirSync(demoDir, { recursive: true });
  // ↑ Create the attack directory.

  const fakeScript = platform === 'win32'
    ? `@echo off\necho [ASTRANETRA PATH HIJACK] You ran 'git' but this is our version!\n...`
    : `#!/bin/sh\necho "[ASTRANETRA PATH HIJACK] You ran 'git' but this is our version!"\n...`;

  fs.writeFileSync(fakeGit, fakeScript, 'utf8');
  if (platform !== 'win32') {
    fs.chmodSync(fakeGit, 0o755);
    // ↑ On Unix, files aren't executable by default. chmod 755 sets the
    //   execute permission. Without this, the OS would refuse to run it.
    //   On Windows, .cmd files are always "executable" — no chmod needed.
  }

  // THE CRITICAL LINE:
  process.env.PATH = demoDir + SEPARATOR + process.env.PATH;
  // ↑ Prepend our attack directory to PATH. Now when this process (or any
  //   child process it spawns) looks for "git", it checks injected_demo/
  //   FIRST — before /usr/bin or C:\Program Files\Git\cmd.

  // Prove it works:
  const result = execSync(platform === 'win32' ? 'git' : 'git', {
    encoding: 'utf8',
    env: { ...process.env },  // pass the poisoned PATH to the child
    timeout: 2000,
  });
  // ↑ This runs "git" — but because injected_demo/ is first in PATH,
  //   the OS finds and runs our FAKE git, not the real one.
}
```

**What breaks if you remove this?** The entire PATH hijacking demonstration
disappears — which is the point. But more importantly, `injectPath()` (line
109) uses the same technique to do it PERMANENTLY. It calls `setx` on Windows
or appends to `.bashrc`/`.zshrc` on Unix — meaning the poisoned PATH survives
reboots. That's the escalation from "demo" to "persistence."

### The PersistenceEngine Connection (Lines 99–144)

`core/PersistenceEngine.js` has a `registerInPath()` function that makes
PATH injection permanent:

```javascript
// core/PersistenceEngine.js — registerInPath() (annotated)

async function registerInPath() {
  const injectedDir = CWD;  // Astranetra's own directory
  const exportLine  = `\nexport PATH="$PATH:${injectedDir}"  # astranetra\n`;
  // ↑ The "# astranetra" comment is a marker — revertPath() searches for
  //   this string to know which lines to remove during cleanup.

  if (platform === 'win32') {
    const current = execSync('echo %PATH%', { encoding: 'utf8' }).trim();
    execSync(`setx PATH "${current};${injectedDir}"`, { encoding: 'utf8' });
    // ↑ setx writes directly to the Windows Registry at:
    //   HKEY_CURRENT_USER\Environment\PATH
    //   This change takes effect in NEW terminals, not the current one.
    //   No admin password required for user-level PATH.
  }

  // Unix: write to shell config files
  const configs = config.persistence.pathShellConfigs[platform] || [];
  for (const shellConfig of configs) {
    // e.g., ~/.bashrc, ~/.zshrc
    fs.appendFileSync(shellConfig, exportLine, 'utf8');
    // ↑ Appends one line to your shell config. Next time you open a
    //   terminal, bash/zsh reads this file and adds the directory to PATH.
    //   The user never sees this happen. It's a one-line file write.
  }
}
```

Notice the subtlety: on Unix, the injection marker is `# astranetra`. The
`revertPath()` function in `PathManipulator.js` (line 142) filters out any
line containing `# astranetra`. This is how Astranetra cleans up after itself
— but a real attacker wouldn't leave such a convenient marker.

---

## The Deeper Questions

These are things this chapter didn't answer. You'll want to know:

**1. If PATH hijacking is so easy, why don't operating systems fix it?**
Because PATH is a feature, not a bug. The whole point of PATH is to let you
run commands by name instead of full paths. The alternative — typing full
paths every time — is unusable. Some mitigation exists: Unix doesn't search
the current directory by default (Windows does — and that's a known weakness).
macOS Gatekeeper and Windows SmartScreen can block unsigned executables, but
they don't help with `.cmd` or shell scripts. The truth is: there's no perfect
fix that doesn't break the convenience PATH provides.

**2. Astranetra writes to `.bashrc`. What IS `.bashrc`, and why does the shell
trust it unconditionally?**
`.bashrc` is a script that Bash executes every time you open a new interactive
terminal. It's in your home directory. It's your file — you own it. The shell
trusts it because it's supposed to contain YOUR preferences. But if malware
can write to your home directory (and it can — it runs as your user), it can
append anything to `.bashrc`. This is a fundamental trust boundary problem:
your shell config is only as safe as your user account. Chapter 5 explored
this in the persistence context; Chapter 10 ties it all together.

**3. Can you hijack commands for OTHER users on a shared system?**
Potentially. If a system-wide PATH directory (like `/usr/local/bin`) is
writable by non-root users — which is a common misconfiguration — then any
user can place executables there. Since `/usr/local/bin` is typically before
`/usr/bin` in PATH, the hijacked command runs for everyone. This is a real
privilege escalation vector on misconfigured Linux servers.

---

## Challenge Problem

Write a Node.js script that acts as a PATH security auditor. It should:

1. Parse the current `PATH` into individual directories
2. For each directory, check:
   - Does it exist?
   - Is it writable by the current user? (`fs.accessSync(dir, fs.constants.W_OK)`)
   - Does it contain any files that shadow commands in later PATH directories?
     (i.e., same filename exists in a later PATH directory)
3. Print a security report showing:
   - Which directories are writable (an attacker could add files there)
   - Which commands are "shadowed" (same name exists in multiple PATH directories)
   - Specifically flag if any writable directory comes BEFORE a system directory

Hint: `fs.readdirSync(dir)` lists files in a directory. Build a Map of
`filename → [directories where it appears]`. Any filename appearing in multiple
directories is a potential shadow. If the FIRST directory is writable by the
current user, that's a hijackable command.

No solution given. But if your auditor finds shadowed commands on your own
machine — and it will — you'll understand why PATH is a security hole.

---

> **Next Chapter: Hashing — Fingerprinting Data**
>
> You've seen Astranetra modify files, copy itself, and hijack commands.
> But how does it know if a file has been changed? How can you detect
> tampering? The answer is a one-way mathematical function called a **hash**.
> SHA-256 takes any input — a 1 KB text file or a 4 GB video — and produces
> a fixed 64-character fingerprint. Change one byte of input, and the
> fingerprint changes completely. Chapter 7 explains how this works, why
> it's irreversible, and how Astranetra's `IntegrityMonitor.js` uses it
> to watch for file tampering in real time.
