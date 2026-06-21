# Astranetra: Core CS Concepts

---

# Chapter 1 — The Conversation Between Code and Hardware

> **Reading time:** ~18 minutes
> **Prerequisites:** Chapter 0 (It's Not Magic)
> **Next chapter:** Chapter 2 — The Filesystem Is a Lie

---

## The Hook

You write this:

```javascript
import os from 'os';
console.log(os.cpus().length);
```

And your terminal prints `8`.

Now think about what just happened. Your JavaScript file is a text file. It's letters
and symbols saved on disk. It has no idea what "CPU" means. It has no way to reach
inside your laptop and count the physical cores soldered onto a silicon chip.

So how did it work?

You might say: *"Node.js did it."* Okay. But how did Node.js do it?

You might say: *"The operating system."* Okay. But how does the OS know? And how did
your JavaScript script — a text file — reach the OS in the first place?

This gap — between the code you write and the hardware that runs it — is where most
CS education stops explaining. This chapter goes into that gap.

Understanding it will change how you read every line of Astranetra. Because when
Astranetra "scans your filesystem" or "reads your CPU load," it's not doing anything
mysterious. It's making very specific, very formal requests through a very specific
channel. And that channel has a name: **the system call**.

---

## The Mental Model — The Government Office

Imagine your city has a government building. Inside that building, the government
controls everything important: water supply, electricity grid, hospital records,
property ownership.

You — a regular citizen — cannot walk into the control room and flip switches. You
don't have clearance. But you need things. You need to know if your water bill is
paid. You need a property document.

So there's a counter at the front. You walk up, fill a form, hand it over. A
government employee takes your request into the back, does the thing, comes out, and
hands you the result. You never enter the control room. You never touch the actual
systems. You go through the counter.

That counter is the **system call interface**.

- **You** = your JavaScript code
- **The counter** = the system call interface (in Node.js, this is managed by `libuv`)
- **The government employee** = the OS kernel
- **The control room** = kernel space (where actual hardware access happens)
- **You outside** = user space (where all your programs live)

Every program on your computer — your browser, Spotify, VS Code, and Astranetra — is
a regular citizen. None of them get direct hardware access. All of them go through
the counter.

---

## The Mechanism — What Actually Happens

### Two Worlds: User Space and Kernel Space

Your CPU has privilege levels. Not metaphorically — physically, in the hardware, there
are different modes the processor can operate in.

```
┌─────────────────────────────────────────────────────┐
│                    USER SPACE                        │
│                                                      │
│   Your JS code   Node.js   Chrome   VS Code   etc.  │
│                                                      │
│   (restricted — cannot touch hardware directly)      │
├─────────────────────────────────────────────────────┤
│              SYSTEM CALL INTERFACE                   │
│          ← the only legal crossing point →           │
├─────────────────────────────────────────────────────┤
│                   KERNEL SPACE                       │
│                                                      │
│   OS Kernel   Device Drivers   Memory Manager        │
│   Process Scheduler   Filesystem Driver   etc.       │
│                                                      │
│   (privileged — can talk to actual hardware)         │
├─────────────────────────────────────────────────────┤
│                    HARDWARE                          │
│                                                      │
│        CPU    RAM    Disk    Network Card            │
└─────────────────────────────────────────────────────┘
```

On x86 processors (Intel/AMD — what most Windows and Linux machines run), these are
called **Ring 0** (kernel, full access) and **Ring 3** (user programs, restricted).
Your JavaScript runs in Ring 3. The kernel runs in Ring 0.

**You might think:** *"So what? My JS clearly gets CPU info, so it must have access."*

That's wrong. It doesn't get direct access. It asks. Here's the actual sequence:

### The Journey of `os.cpus()`

```
Your JS            Node.js (C++)         libuv            OS Kernel
   │                    │                   │                  │
   │  os.cpus()         │                   │                  │
   │ ─────────────────► │                   │                  │
   │                    │  uv_cpu_info()    │                  │
   │                    │ ──────────────── ►│                  │
   │                    │                   │  syscall()       │
   │                    │                   │ ────────────────►│
   │                    │                   │                  │ reads /proc/cpuinfo
   │                    │                   │                  │ (Linux) or calls
   │                    │                   │                  │ NtQuerySystemInfo
   │                    │                   │                  │ (Windows)
   │                    │                   │  ◄──────────────│
   │                    │  ◄────────────────│                  │
   │  ◄─────────────────│                   │                  │
   [{ model, speed, times }, ...]
```

Four hops. Five if you count the hardware read. For one line of JavaScript.

### The Context Switch — The Expensive Part

When a system call happens, the CPU doesn't just "ask nicely." It performs a
**context switch** from user mode to kernel mode. This involves:

1. Saving the current state of all CPU registers (where was this program, what
   variables was it using, where does it return to)
2. Switching the CPU privilege level (Ring 3 → Ring 0)
3. The kernel does its work
4. Saving the kernel's state
5. Switching back (Ring 0 → Ring 3)
6. Restoring the original program's state
7. Resuming where the JS left off

This is called a **context switch**, and it costs time — typically 1–10 microseconds.
That sounds small. But if your code does 10,000 file reads in a loop, you've just
spent potentially 100 milliseconds on context switching alone. This is why
Astranetra uses `worker_threads` and async I/O instead of reading files one by one
in a loop — we'll come back to this in Chapter 4.

### What Node.js Is Actually Doing

Node.js is not a JavaScript interpreter that magically talks to hardware. It is a
**C++ program** that:

1. Embeds Google's V8 engine (also C++) to parse and execute your JavaScript
2. Exposes JavaScript bindings to a C library called **`libuv`**
3. `libuv` handles all the actual system calls in a cross-platform way

So when you write `os.cpus()`, the real call chain is:

```
JavaScript (your code)
  → V8 (executes JS, hits the os.cpus binding)
    → Node.js C++ binding (node_os.cc)
      → libuv (uv_cpu_info)
        → OS system call
          → kernel reads hardware
        ← returns data to libuv
      ← returns to Node.js C++ binding
    ← C++ converts to JS object
  ← V8 returns to your JS
← your variable now has the value
```

Your one-liner triggered a cascade through four different pieces of software before
touching hardware.

### Platform Differences — Why Cross-Platform Is Hard

This is where Astranetra's Windows/Linux/macOS support gets interesting.

The system call for getting CPU info is **different on every OS**:

| OS | How it gets CPU info |
|---|---|
| Linux | Reads `/proc/cpuinfo` (a virtual file the kernel exposes) |
| macOS | Calls `sysctlbyname("hw.physicalcpu", ...)` |
| Windows | Calls `NtQuerySystemInformation(SystemProcessorInformation, ...)` |

`libuv` wraps all three behind a single `uv_cpu_info()` call. Node.js wraps that
behind `os.cpus()`. You write one line that works everywhere — but underneath,
three completely different kernel interfaces are being called.

This is also why some things in Astranetra are platform-specific. Getting disk info
via PowerShell on Windows vs `df` on Linux isn't a design quirk — it's because the
underlying system calls are fundamentally different and there's no `libuv` abstraction
for disk listing.

---

## The Experiment — Write It Yourself

Don't run Astranetra yet. Write this from scratch in a new file called `syscall_demo.js`:

```javascript
import os from 'os';
import { execSync } from 'child_process';

// ── Part 1: What Node.js gives you ──────────────────────────────────────────

const cpus = os.cpus();

console.log('=== VIA NODE.JS os MODULE ===');
console.log(`Cores:     ${cpus.length}`);
console.log(`Model:     ${cpus[0].model}`);
console.log(`Speed:     ${cpus[0].speed} MHz`);

// cpus[0].times shows how the CPU has spent its time (in milliseconds)
// user   = time spent running user programs (your apps)
// nice   = time spent on lower-priority user programs  
// sys    = time spent on kernel operations (system calls!)
// idle   = time doing nothing
// irq    = time handling hardware interrupts (keyboard press, network packet, etc.)
console.log(`\nCPU time breakdown for Core 0:`);
console.log(cpus[0].times);

// ── Part 2: Ask the OS directly (Linux/macOS only) ──────────────────────────

if (process.platform !== 'win32') {
  console.log('\n=== VIA DIRECT OS QUERY (bypassing Node abstractions) ===');
  
  try {
    // On Linux, /proc/cpuinfo is a virtual file the kernel writes in real-time
    // It doesn't exist on disk — the kernel generates it fresh every time you read it
    const raw = execSync('cat /proc/cpuinfo 2>/dev/null || sysctl -n machdep.cpu.brand_string',
      { encoding: 'utf8' }
    );
    const lines = raw.split('\n').slice(0, 10); // first 10 lines only
    console.log(lines.join('\n'));
  } catch (e) {
    console.log('Could not read directly:', e.message);
  }
}

// ── Part 3: The surprising part ─────────────────────────────────────────────

console.log('\n=== WHAT IS YOUR NODE.JS PROCESS DOING RIGHT NOW? ===');
console.log(`PID (Process ID):    ${process.pid}`);
console.log(`Memory used by Node: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
console.log(`Platform:            ${process.platform}`);
console.log(`Node version:        ${process.version}`);

// process.cpuUsage() measures how much CPU THIS process has consumed
// user = time your code ran, system = time spent on system calls
const usage = process.cpuUsage();
console.log(`\nThis process's CPU usage (microseconds):`);
console.log(`  User space:   ${usage.user} μs`);
console.log(`  Kernel space: ${usage.system} μs`);  
// ↑ This is how much time your program spent inside the kernel, making system calls
```

Run it: `node syscall_demo.js`

**The surprising output:** Look at `cpuUsage().system`. Even running this tiny script,
your program spent time in kernel space. Those are system calls happening — for
reading the file from disk, printing to the terminal, even just starting Node.js.

On Linux, also look at `/proc/cpuinfo` output. That "file" doesn't exist on your
hard drive. The kernel writes it from memory every single time you read it. The
filesystem is already weirder than you thought. (Chapter 2 goes deep on this.)

---

## The Astranetra Connection

Open `core/SystemRecon.js`. The entire `runSystemRecon()` function is an exercise
in system calls:

```javascript
// core/SystemRecon.js — annotated

import os from 'os';
import { execSync } from 'child_process';

function getCpuLoad() {
  const cpus = os.cpus();
  // os.cpus() → system call → kernel reads CPU scheduler data
  // Each call returns a SNAPSHOT — the times are cumulative since boot
  // To get "current" load %, you'd need two snapshots and calculate the delta
  
  return cpus.map(cpu => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
    const idle  = cpu.times.idle;
    // (total - idle) / total = fraction of time NOT idle = CPU load
    return Math.round(((total - idle) / total) * 100);
  });
}

function getDiskInfo() {
  if (process.platform === 'win32') {
    // Windows: must use PowerShell because wmic was removed in Windows 11
    // PowerShell itself makes system calls to WMI (Windows Management Instrumentation)
    // which in turn talks to the kernel's disk driver
    const ps  = `Get-PSDrive -PSProvider FileSystem | Select-Object Name,Used,Free | ConvertTo-Json`;
    const out = execSync(`powershell -NoProfile -Command "${ps}"`, {
      timeout: 8000, encoding: 'utf8',
    });
    // execSync spawns a child process — that's ANOTHER system call (fork/exec on Unix,
    // CreateProcess on Windows) — just to query disk info
    return JSON.parse(out.trim());
  } else {
    // Linux/macOS: df reads from the kernel's VFS (Virtual Filesystem) layer
    const out = execSync("df -k /", { encoding: 'utf8' });
    // ...
  }
}
```

Notice `execSync` in the disk function. That's not a polite request — it's
spawning a whole new OS process just to get disk data. That process itself makes
system calls. System calls spawning processes that make system calls.

This is why `SystemRecon.js` runs noticeably slower on first execution — it's doing
a lot of kernel round-trips, especially on Windows where PowerShell startup alone
takes ~200ms.

**What breaks if you remove system calls?** Everything. `os.cpus()` returns nothing.
`fs.readdir()` cannot list files. `process.env` is empty. The entire Astranetra
codebase is a thin JavaScript layer over a dense network of system calls. Without
them, it's just variables with no values.

---

## The Deeper Questions

These are things this chapter didn't answer. You'll want to know:

**1. If everything goes through the kernel, can the kernel see everything my program does?**
Yes. The kernel is the ultimate supervisor. It can log, intercept, or block any
system call any program makes. This is how antivirus software works — it hooks into
the kernel and inspects system calls before they complete. Chapter 3 touches on this
when we talk about process isolation.

**2. `os.cpus()` gives CPU times since boot. How does Astranetra calculate *current* load?**
It takes two snapshots with a time delay and computes the delta. The current
implementation in `SystemRecon.js` is actually a snapshot — meaning it shows
lifetime averages, not current load. Real monitoring tools like `htop` poll every
second and subtract. Can you modify `getCpuLoad()` to show true current load?

**3. System calls are expensive (context switches). Astranetra scans 1 million files —
that's 1 million+ system calls. How does it not take forever?**
Two answers: async I/O and worker threads. Async I/O batches kernel requests so
the CPU doesn't sit idle waiting. Worker threads parallelize across CPU cores.
Chapter 4 covers this in detail — it's one of the most important things to
understand about how Astranetra's file scanner achieves its speed.

---

## Challenge Problem

Write a script that measures how long a single system call takes on your machine.

Hint: `process.hrtime.bigint()` gives nanosecond-precision timestamps.
Compare the time before and after a single `fs.statSync()` call (which makes
one system call to get file metadata). Then call it 10,000 times in a loop and
measure the total. Calculate: what percentage of that time is pure JavaScript vs
kernel round-trips?

No solution given. But if your number surprises you, you're doing it right.

---

> **Next Chapter: The Filesystem Is a Lie**
>
> You've been saving files your whole life thinking they go into "folders."
> They don't. A folder doesn't exist. What actually exists is a data structure
> called an **inode**, and the "file" you think you're opening is just a number
> that points to it. Chapter 2 explains what a file actually is — and why hidden
> files (the ones Astranetra hunts for) aren't really "hidden" at all.
