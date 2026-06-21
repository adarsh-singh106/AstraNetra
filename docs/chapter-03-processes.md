# Astranetra: Core CS Concepts

---

# Chapter 3 — Everything Is a Process

> **Reading time:** ~22 minutes
> **Prerequisites:** Chapter 1 (System Calls), Chapter 2 (The Filesystem)
> **Next chapter:** Chapter 4 — Threads Are Not Magic Either

---

## The Hook

Right now, your computer is running 200+ programs simultaneously. Open Task Manager
on Windows or `htop` on Linux — you'll see hundreds of entries. Your browser alone
might account for 30 of them.

But your CPU only has 8 cores. Maybe 12 if you're lucky. So how are 200 programs
running on 8 cores?

They're not.

They're taking turns so fast you can't tell. Your operating system is a juggler,
switching between programs millions of times per second, and you — sitting there
watching YouTube — have absolutely no idea it's happening.

But it gets deeper. Each of those programs thinks it has the *entire* computer to
itself. It thinks it owns all of memory. It has no idea other programs exist. And
if it tries to peek at another program's data, the CPU itself — the hardware —
will shut it down.

How does this illusion work? What *is* a program once it's running? And what does
this have to do with `process.pid` in Astranetra?

Everything.

---

## The Mental Model — The Restaurant Kitchen

Imagine a restaurant kitchen with one head chef (the CPU). Orders are pouring in
— pasta, steak, soup, dessert, more pasta. Each order is a **process**.

The chef can only cook one dish at a time. But customers expect all dishes to
arrive quickly. So the chef works on the pasta for 10 seconds, sets it aside,
starts the steak, sets it aside after 10 seconds, checks the soup, back to the
pasta. This rapid switching between dishes is **context switching**.

Now here's the crucial part: each order has its own **prep station** — its own
cutting board, its own ingredients, its own plate. The steak's prep area has raw
beef and a grill. The pasta's prep area has noodles and sauce. They do not share
ingredients. The steak order cannot reach over and grab the pasta's sauce. Each
prep station is completely isolated.

That's **process memory isolation**.

If a new order comes in that says "make mushroom risotto," the chef doesn't
improvise. The chef reads the recipe (the program) and creates a fresh prep
station for it (the new process). The recipe is the file on disk. The prep station
— with its allocated counter space, ingredients, and cooking tools — is the
process. One recipe can produce many prep stations (you can run the same program
multiple times — each is a separate process).

And every order has a ticket number. That's the **PID** — the Process ID.

Let's now drop the analogy and look at what's actually happening inside your machine.

---

## The Mechanism — What Actually Happens

### What IS a Process?

A program is a file on disk. A text file with instructions. It does nothing until
you run it. When you run it, the OS creates a **process** — a living, breathing
instance of that program in memory.

A process is not just "the code running." It's a bundle of everything needed to
execute that code:

```
┌────────────────────────────────────────────────────────────┐
│                     A PROCESS IN MEMORY                    │
├────────────────────────────────────────────────────────────┤
│                                                            │
│   ┌──────────┐  Code (Text) Segment                       │
│   │ compiled │  The actual machine instructions.           │
│   │ code     │  Read-only — the OS prevents modification.  │
│   └──────────┘                                             │
│                                                            │
│   ┌──────────┐  Data Segment                               │
│   │ global   │  Global and static variables.               │
│   │ vars     │  Initialized data (.data) + uninitialized   │
│   └──────────┘  data (.bss, zeroed on start).              │
│                                                            │
│   ┌──────────┐  Heap                                       │
│   │ dynamic  │  Memory allocated at runtime (new, malloc). │
│   │ memory   │  Grows UPWARD toward higher addresses.      │
│   │    ↓     │                                             │
│   └──────────┘                                             │
│                                                            │
│       ...        (free space between heap and stack)        │
│                                                            │
│   ┌──────────┐  Stack                                      │
│   │    ↑     │  Function call frames, local variables,     │
│   │ function │  return addresses. Grows DOWNWARD toward     │
│   │ calls    │  lower addresses. Fixed max size.           │
│   └──────────┘                                             │
│                                                            │
│   ┌──────────┐  Kernel Metadata (not directly accessible)  │
│   │ PCB      │  The Process Control Block — the OS's       │
│   │          │  bookkeeping for this process.               │
│   └──────────┘                                             │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

When you type `node index.js` to run Astranetra, the OS creates a process with
all of these segments. The V8 engine's compiled bytecode goes in the code segment.
Your JavaScript objects live on the heap. Function calls push frames onto the stack.
And the kernel maintains a PCB to track it all.

### The Process Control Block (PCB)

The kernel needs to track hundreds of processes. For each one, it maintains a data
structure called the **Process Control Block** (PCB). This is the kernel's record
of everything about your process:

| Field | What it stores | Astranetra example |
|---|---|---|
| **PID** | Unique process identifier | `process.pid` returns this exact value |
| **State** | Running, Ready, Blocked, Zombie, etc. | Your Node.js process is "Running" when executing JS, "Blocked" when waiting for disk I/O |
| **CPU Registers** | Saved values of all CPU registers | When the OS pauses your process to run another, it saves all register values here |
| **Program Counter** | Which instruction to execute next | The exact byte offset into V8's compiled code |
| **Memory Maps** | Virtual → physical address mappings | Page table entries for this process's address space |
| **Open File Descriptors** | List of open files, sockets, pipes | Every `fs.open()` in Astranetra adds an entry here |
| **Parent PID (PPID)** | Who created this process | When Astranetra spawns PowerShell via `execSync`, the child's PPID = Astranetra's PID |
| **User/Group ID** | Which user owns this process | Determines file access permissions |
| **Signal Handlers** | How to handle SIGINT, SIGTERM, etc. | `process.on('SIGINT', shutdown)` in index.js registers a handler |

When you call `process.pid` in Node.js, you're reading one field from this exact
kernel data structure. It's not a JavaScript invention — it's a number the kernel
assigned when your process was born.

### Process States — The Lifecycle

A process doesn't just "run." It goes through states:

```
                    ┌─────────────────────────────────┐
                    │                                 │
                    ▼                                 │
┌─────┐     ┌───────────┐     ┌─────────┐     ┌─────┴──────┐
│ New │────►│   Ready   │────►│ Running │────►│ Terminated │
└─────┘     └───────────┘     └────┬────┘     └────────────┘
               ▲                   │
               │                   │
               │              ┌────▼────┐
               └──────────────│ Blocked │
                              └─────────┘
```

- **New**: The OS is creating the process (allocating memory, setting up the PCB).
- **Ready**: The process is loaded and can run, but the CPU is busy with another process. It's in a **ready queue**, waiting for its turn.
- **Running**: The process is actively executing instructions on a CPU core. Only as many processes can be Running as there are CPU cores.
- **Blocked** (Waiting): The process asked for something slow — disk read, network response, user input — and is waiting. It can't use the CPU until the I/O completes. When Astranetra calls `execSync('powershell ...')`, the parent process enters Blocked state while the child executes.
- **Terminated**: The process finished (or was killed). Resources are being cleaned up.

And then there's the weird one:

**Zombie state.** A process has finished executing, but its parent hasn't called
`waitpid()` to collect its exit status yet. The process is dead — it's not running,
it uses no CPU, its memory is freed — but its PCB still exists in the kernel's
process table because the exit code hasn't been collected. It's a corpse waiting
for someone to sign the death certificate.

Why does this exist? Because the parent might need to know *how* the child died.
Did it exit with code 0 (success)? Code 1 (error)? Was it killed by a signal?
The kernel keeps the PCB around until the parent asks. If the parent never asks
(or the parent itself dies), the zombie is "adopted" by PID 1 (init/systemd),
which periodically reaps zombies.

You can create zombies accidentally. If a Node.js script spawns child processes
with `child_process.spawn()` and never listens for the `'exit'` event, those
children become zombies when they finish. In a long-running server, this leaks
kernel resources.

### Process Creation: fork() and exec()

How does a new process come into existence? On Unix/Linux/macOS, through two
system calls that work together: `fork()` and `exec()`.

**`fork()` — Clone the parent**

When a process calls `fork()`, the kernel creates an almost-exact copy of the
calling process:

1. A new PID is assigned
2. The child gets a copy of the parent's memory (code, data, stack, heap)
3. The child gets copies of the parent's open file descriptors
4. The child's PPID is set to the parent's PID
5. `fork()` returns **twice** — once in the parent (returning the child's PID) and once in the child (returning 0)

But wait — copying all of a process's memory sounds expensive. A Node.js process
can use 100MB+ of heap. Does `fork()` copy all 100MB?

No. Modern kernels use **copy-on-write** (CoW). After `fork()`, both parent and
child point to the *same* physical memory pages. The pages are marked read-only.
If either process tries to *write* to a page, the MMU triggers a page fault, the
kernel copies just that one page, and gives the writing process its own copy.
Most pages are never written to (especially code pages), so they're never copied.
This makes `fork()` fast — typically microseconds, not the milliseconds you'd
expect from copying hundreds of megabytes.

**`exec()` — Replace the process image**

After `fork()`, you have two copies of the same program. That's rarely useful.
What you usually want is to run a *different* program in the child. That's what
`exec()` does — it replaces the current process's code, data, stack, and heap
with a new program loaded from disk. The PID stays the same. The process is the
same process, it just has new instructions now.

This two-step dance — `fork()` then `exec()` — is how every program on Unix gets
started. Even your terminal: when you type `ls`, your shell calls `fork()` to
create a child, then `exec("ls")` to replace that child with the `ls` program.

**Windows does it differently.** Windows doesn't have `fork()`. It has
`CreateProcess()`, which combines process creation and program loading into one
call. This is simpler conceptually but less flexible — Unix's separation means you
can set up the child's environment (redirect file descriptors, change directories,
set environment variables) between `fork()` and `exec()`.

### What execSync() Actually Does

When Astranetra calls:

```javascript
execSync('powershell -NoProfile -Command "..."', { encoding: 'utf8' });
```

This one JavaScript function call triggers **three** system calls:

```
Node.js (parent process, PID 1234)
   │
   │  1. fork()  ──────────────  Creates child process (PID 1235)
   │                              Child is a copy of Node.js
   │
   │  Parent calls waitpid()     Child calls exec("powershell ...")
   │  and BLOCKS ◄───────────    ──────────────────────────────────►
   │                              │
   │  (parent is now in          PowerShell loads and runs
   │   Blocked state,             the command
   │   consuming no CPU)          │
   │                              PowerShell exits (exit code 0)
   │                              │
   │  waitpid() returns  ◄───────┘
   │  with exit code
   │
   │  Parent resumes, returns output to JS
```

1. **`fork()`** — creates a child process (copy of the Node.js process)
2. **`exec()`** — in the child, replaces Node.js with PowerShell (or bash, or whatever command you specified)
3. **`waitpid()`** — in the parent, blocks until the child process terminates and collects its exit status

The "Sync" in `execSync` comes from step 3 — the parent process *synchronously*
waits for the child. This is why `execSync` freezes your Node.js program while
the command runs. The entire Node.js event loop stops. Nothing else happens until
the child exits.

This is also why Astranetra's `getDiskInfo()` on Windows is noticeably slow.
It's not just "running a PowerShell command" — it's creating an entirely new
process, loading the PowerShell runtime (~200ms startup), executing a WMI query,
serializing the output to JSON, and then the parent wakes up and parses it.

### The Process Tree

Every process has a parent. The only exception is PID 1 — on Linux, that's `init`
or `systemd`, the first process the kernel creates at boot. Everything else
descends from it.

```
PID 1: init/systemd (or System on Windows)
├── PID 485: sshd (remote login daemon)
│   └── PID 2001: bash (your SSH session)
│       └── PID 2050: node index.js (Astranetra)
│           ├── PID 2051: powershell -NoProfile -Command "..."
│           │              (spawned by execSync in getDiskInfo)
│           ├── PID 2052: npm --version
│           │              (spawned by execSync in getNodeInfo)
│           └── PID 2053: worker_thread
│                          (not a child process — Chapter 4)
├── PID 600: Xorg (display server)
│   └── PID 1200: gnome-shell
│       ├── PID 1500: firefox
│       │   ├── PID 1501: firefox (content process 1)
│       │   ├── PID 1502: firefox (content process 2)
│       │   └── PID 1503: firefox (GPU process)
│       └── PID 1600: code (VS Code)
│           ├── PID 1601: code (extension host)
│           └── PID 1602: code (renderer)
└── PID 700: cron (scheduled tasks)
```

When a parent process dies, its children don't die with it (usually). They become
**orphans** and are adopted by PID 1, which becomes their new parent. This is why
you can start a process in the background, close your terminal, and the process
keeps running — it was orphaned and adopted by init.

### Memory Isolation — The Hardware Firewall

Here's one of the most important concepts in operating systems: **process memory
isolation**.

Process A cannot read Process B's memory. Process A cannot write to Process B's
memory. Process A doesn't even know where Process B's memory is. This isn't
enforced by software — it's enforced by **hardware**, specifically the **MMU**
(Memory Management Unit), a physical component on the CPU die.

How? Through **virtual memory**.

Every process thinks its memory starts at address 0 and goes up to some large
number (on 64-bit systems, theoretically up to 2^64 bytes, though practical
limits are much lower). But these addresses are **virtual** — they're not real
physical RAM addresses.

```
 Process A (Node.js)               Process B (Firefox)
┌──────────────────┐              ┌──────────────────┐
│ Virtual Address  │              │ Virtual Address  │
│ 0x00400000: code │              │ 0x00400000: code │
│ 0x00600000: data │              │ 0x00600000: data │
│ 0x7FFF0000: stack│              │ 0x7FFF0000: stack│
└────────┬─────────┘              └────────┬─────────┘
         │                                 │
         │  Page Table A                   │  Page Table B
         │  (per-process)                  │  (per-process)
         ▼                                 ▼
   ┌────────────┐                    ┌────────────┐
   │ 0x00400000 │──► Phys 0x1A20000 │ 0x00400000 │──► Phys 0x3B80000
   │ 0x00600000 │──► Phys 0x1A40000 │ 0x00600000 │──► Phys 0x5C10000
   │ 0x7FFF0000 │──► Phys 0x2F00000 │ 0x7FFF0000 │──► Phys 0x7D50000
   └────────────┘                    └────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │     PHYSICAL RAM (8 GB)      │
         │                              │
         │  0x1A20000: Node.js code     │
         │  0x1A40000: Node.js data     │
         │  0x2F00000: Node.js stack    │
         │  0x3B80000: Firefox code     │
         │  0x5C10000: Firefox data     │
         │  0x7D50000: Firefox stack    │
         │  ...                         │
         └──────────────────────────────┘
```

Both processes use the *same* virtual addresses (0x00400000 for code, etc.), but
the MMU uses per-process **page tables** to map these to completely different
physical RAM locations. When the CPU switches from Process A to Process B, it also
switches which page table is active (by loading a new value into the CR3 register
on x86).

If Process A tries to access a virtual address that isn't in its page table —
for example, by trying to read Process B's physical memory — the MMU generates a
**page fault**. The kernel intercepts this fault and kills Process A with a
segmentation fault (SIGSEGV). The process didn't get the data. It got terminated.

This is why a bug in Chrome can't corrupt your Node.js process. They literally
cannot see each other's memory. The hardware won't allow it.

### Process Scheduling — Taking Turns

With 200 processes and 8 CPU cores, the OS must constantly decide which processes
get to run. This is the job of the **scheduler**.

Modern schedulers use **preemptive multitasking**. Each process gets a **time
quantum** (also called a time slice) — typically 1–10 milliseconds. When the
quantum expires, a hardware timer fires an interrupt, the kernel takes control,
saves the current process's state (registers, program counter) into its PCB, picks
the next process from the ready queue, loads that process's state, and resumes it.
This happens thousands of times per second.

The Linux kernel uses the **Completely Fair Scheduler** (CFS), which tracks how
much CPU time each process has received and prioritizes those that have gotten the
least — hence "completely fair." Windows uses a **priority-based round-robin**
scheduler with dynamic priority boosts for interactive processes (so your UI
stays responsive even under heavy load).

This is why a badly-behaved process can't freeze your entire computer on modern
systems. Even if a process enters an infinite loop, the scheduler will preempt it
after its time quantum and give other processes their turns.

### Process Signals — Talking to Processes

Processes communicate with the kernel and with each other through **signals** —
asynchronous notifications that interrupt a process's normal execution.

Common signals:

| Signal | Number | Default action | What sends it |
|---|---|---|---|
| `SIGINT` | 2 | Terminate | You pressing Ctrl+C in the terminal |
| `SIGTERM` | 15 | Terminate | `kill <pid>` command, or `process.kill(pid)` |
| `SIGKILL` | 9 | Terminate (cannot be caught) | `kill -9 <pid>` — the nuclear option |
| `SIGSEGV` | 11 | Terminate + core dump | Process accessed invalid memory |
| `SIGCHLD` | 17 | Ignored | Child process terminated — sent to parent |
| `SIGSTOP` | 19 | Stop (pause) process | Cannot be caught — process freezes |
| `SIGCONT` | 18 | Resume stopped process | Resumes after SIGSTOP |

When you press Ctrl+C while Astranetra is running, the terminal sends SIGINT to
the process. Astranetra catches it in `index.js` at line 602:

```javascript
process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);
```

Without this handler, SIGINT would kill the process immediately. With it,
Astranetra gets to flush logs and stop the exfil server gracefully.

`SIGKILL` (signal 9) is special — it **cannot be caught or ignored**. When you
`kill -9` a process, the kernel terminates it instantly. No cleanup, no handlers,
no graceful anything. The process is gone. This is why `kill -9` is the last
resort — the process can't save state or release resources.

---

## The Experiment — Write It Yourself

Create a file called `process_demo.mjs` and type this:

```javascript
import { fork } from 'child_process';
import { writeFileSync } from 'fs';

// ── Part 1: Who am I? ───────────────────────────────────────────────────────

console.log('=== PARENT PROCESS ===');
console.log(`My PID:       ${process.pid}`);
console.log(`My parent's PID (PPID): ${process.ppid}`);
console.log(`Platform:     ${process.platform}`);
console.log(`Node binary:  ${process.execPath}`);

// ── Part 2: Spawn a child and prove it's a separate process ──────────────────

// Create a temporary child script
const childCode = `
  console.log('=== CHILD PROCESS ===');
  console.log('My PID:       ' + process.pid);
  console.log('My parent PID (PPID): ' + process.ppid);
  console.log('Am I the same process as parent? ' + (process.pid === process.ppid ? 'YES' : 'NO — different PID!'));

  // Prove memory isolation: modify a "variable" and show parent is unaffected
  const childSecret = 'I am the child and parent cannot see this string';
  console.log('Child secret: ' + childSecret);

  // Send a message back to parent through IPC (inter-process communication)
  process.send({ childPid: process.pid, secret: childSecret });
`;
writeFileSync('_child_temp.mjs', childCode);

// fork() creates a child Node.js process running _child_temp.mjs
// fork() uses fork()+exec() under the hood — two system calls
const child = fork('_child_temp.mjs');

// ── Part 3: IPC — how processes talk when they can't see each other's memory ─

child.on('message', (msg) => {
  console.log('\n=== PARENT RECEIVED MESSAGE FROM CHILD ===');
  console.log(`Child's PID was: ${msg.childPid}`);
  console.log(`Child's secret:  ${msg.secret}`);
  console.log('Parent could NOT access this variable directly — it was sent via IPC.');
});

// ── Part 4: Process signals — kill the child ─────────────────────────────────

child.on('exit', (code, signal) => {
  console.log(`\n=== CHILD EXITED ===`);
  console.log(`Exit code: ${code}`);
  console.log(`Signal:    ${signal || 'none (normal exit)'}`);

  // Clean up
  import('fs').then(fs => fs.unlinkSync('_child_temp.mjs'));
});

// ── Part 5: Surprise — how many processes is this script running? ────────────

setTimeout(() => {
  console.log('\n=== SURPRISE ===');
  console.log(`Total processes spawned by this script: 2 (parent + child)`);
  console.log(`But if you used execSync('npm --version'), that would be 3 — `);
  console.log(`fork() + exec() for the child, and the parent waiting with waitpid().`);
  console.log(`Every execSync call in Astranetra's SystemRecon.js creates a whole new process.`);
  console.log(`getDiskInfo() alone spawns a PowerShell process with ~30MB memory footprint.`);
}, 1000);
```

Run it: `node process_demo.mjs`

**What you'll see:** The parent and child have different PIDs. The child's PPID
matches the parent's PID — proving the parent-child relationship. The child's
"secret" variable doesn't exist in the parent's memory space — it had to be sent
via IPC (inter-process communication channel). When the child exits, the parent
gets notified.

**The surprising part:** The parent and child ran *concurrently*. The child's
output might appear before or after the parent's `setTimeout` — you can't predict
the order because the OS scheduler decides who runs when.

---

## The Astranetra Connection

### SystemRecon.js — A Process Factory

Open `core/SystemRecon.js`. The `getDiskInfo()` function (lines 49–109) is a
process factory:

```javascript
// core/SystemRecon.js, line 49-58
function getDiskInfo() {
  const platform = process.platform;
  // ↑ process.platform reads from the kernel's PCB for this process.
  //   The kernel knows which OS it's running — your JS does not.

  if (platform === 'win32') {
    const ps = `Get-PSDrive -PSProvider FileSystem | ...`;
    const out = execSync(`powershell -NoProfile -Command "${ps}"`, {
      timeout: 8000, encoding: 'utf8',
    });
    // ↑ This single line:
    //   1. fork() — clones the Node.js process (copy-on-write, fast)
    //   2. exec("powershell") — replaces the clone with PowerShell
    //   3. waitpid() — parent blocks until PowerShell exits
    //   PowerShell itself makes ADDITIONAL system calls to WMI
    //   to query actual disk hardware. System calls spawning processes
    //   that make system calls. It's turtles all the way down.
  }
}
```

The `getNodeInfo()` function (lines 111–125) does it again:

```javascript
// core/SystemRecon.js, line 114
npmVersion = execSync('npm --version', { timeout: 3000, encoding: 'utf8' }).trim();
// ↑ Spawns an ENTIRE child process just to read a version string.
//   fork() + exec("npm") + waitpid(). Three system calls for five characters.
```

And notice line 122: `pid: process.pid`. This reads the PID field directly from
the kernel's PCB — the same number the OS uses to track this Node.js instance in
its process table.

### PathManipulator.js — Processes Running Fake Programs

In `core/PathManipulator.js`, the `pathHijackDemo()` function (line 67) creates
a fake `git` script and then executes it:

```javascript
// core/PathManipulator.js, lines 94-103
const result = execSync(platform === 'win32' ? 'git' : 'git', {
  encoding: 'utf8',
  env: { ...process.env },
  // ↑ process.env is copied from the parent's PCB into the child.
  //   The child gets its OWN copy of environment variables.
  //   Modifying process.env in the child does NOT affect the parent.
  timeout: 2000,
});
```

This spawns a child process that runs the *fake* git. The child process is a
completely separate process with its own PID, its own memory space, its own copy
of `PATH`. It searches `PATH` in order, finds the fake git first (because the
demo directory was prepended), and runs it. The child doesn't know it's running
a fake — it just executes whatever binary it finds.

### PersistenceEngine.js — Processes Modifying the System

In `core/PersistenceEngine.js`, `registerInPath()` (lines 99–144) uses `execSync`
to permanently modify the system PATH on Windows:

```javascript
// core/PersistenceEngine.js, lines 104-107
const current = execSync('echo %PATH%', { encoding: 'utf8' }).trim();
// ↑ Spawns cmd.exe as a child process to echo the PATH variable

execSync(`setx PATH "${current};${injectedDir}"`, { encoding: 'utf8' });
// ↑ Spawns ANOTHER child process running setx.exe
//   setx writes to the Windows Registry (a system call to NtSetValueKey)
//   Changes persist across reboots — this child process modified
//   the system permanently and then died. The process is gone,
//   but its effects remain.
```

Two `execSync` calls = two child processes = `fork()+exec()+waitpid()` × 2 = six
system calls minimum. And each child process makes its own system calls internally.

### index.js — Graceful Shutdown via Signals

Lines 594–604 of `index.js` are pure process signal handling:

```javascript
// index.js, lines 595-604
function setupShutdown(mods) {
  const shutdown = () => {
    console.log('\n[ASTRANETRA] Shutting down gracefully…');
    logger.flush();            // flush log buffers to disk (system calls!)
    if (mods?.stopExfilServer) mods.stopExfilServer(); // close network socket
    process.exit(0);           // exit with code 0 → process enters Terminated state
  };
  process.on('SIGINT',  shutdown);  // Ctrl+C → kernel sends SIGINT → this handler runs
  process.on('SIGTERM', shutdown);  // kill <pid> → kernel sends SIGTERM → this handler runs
}
```

Without these handlers, pressing Ctrl+C would terminate Astranetra immediately
— logs might be half-written, the exfil server socket might not be properly
closed (leaving a port in TIME_WAIT state), and the database might be corrupted
mid-write. Signals give the process a chance to clean up.

---

## The Deeper Questions

These are things this chapter didn't fully answer:

**1. If each process has its own memory space, how do processes share data?**
They can't share memory directly (by design). Instead, they use **Inter-Process
Communication** (IPC): pipes, sockets, shared memory segments, message queues, or
memory-mapped files. In Node.js, `child_process.fork()` creates an IPC channel
automatically — that's how the experiment above sent messages between parent and
child. Chapter 4 touches on this when we discuss worker threads, which share
memory within a single process.

**2. What's the difference between a process and a thread?**
A process has its own memory space. A thread shares memory with other threads in
the same process. Threads are cheaper to create and switch between, but they
introduce an entirely new class of bugs — race conditions, deadlocks, data
corruption from concurrent writes. This is exactly what Chapter 4 tackles, and
it's why Astranetra uses `worker_threads` instead of spawning separate processes
for file scanning.

**3. How does the scheduler decide which process gets the CPU next?**
We touched on CFS and priority-based scheduling, but the real answer involves
nice values, I/O priority classes, CPU affinity, cgroups (which let you limit how
much CPU a process group can use), and real-time scheduling policies. Scheduling
is one of the deepest rabbit holes in OS design — entire PhD theses exist on
scheduling algorithms for specific workloads.

---

## Challenge Problem

Write a script that measures the overhead of creating a child process.

Use `process.hrtime.bigint()` to measure nanosecond timestamps. Call
`execSync('echo hello')` in a loop 100 times and measure the total time. Then
compare that with calling `console.log('hello')` 100 times (no child process).

Calculate:
1. The average time to spawn a child process on your machine
2. How much slower `execSync('echo hello')` is compared to `console.log('hello')`
3. Based on Astranetra's `SystemRecon.js`, which calls `execSync` at least 2–3
   times during a full recon — estimate the total process-spawning overhead

Then try this: modify `getNodeInfo()` in `SystemRecon.js` to use
`require('child_process').execFileSync('npm', ['--version'])` instead of
`execSync('npm --version')`. `execFileSync` skips the shell — it calls `exec()`
directly without first spawning a shell process. Measure whether this is faster.

No solution provided. But if the difference between `execSync` and a direct
function call doesn't shock you, run the numbers again.

---

> **Next Chapter: Threads Are Not Magic Either**
>
> You now know that a process has its own memory space that no other process can
> touch. But Astranetra scans thousands of files in parallel using `worker_threads`.
> Those workers share the same memory space. Same process. Multiple execution
> contexts. That means they can step on each other's data. Chapter 4 explains how
> threads work, why JavaScript is "single-threaded" (and what that actually means),
> and how `scanWorker.js` and `hashWorker.js` parallelize work without corrupting
> shared state.
