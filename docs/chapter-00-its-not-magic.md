# Astranetra: Core CS Concepts

---

# Chapter 0 — It's Not Magic

> **Reading time:** ~22 minutes
> **Prerequisites:** None. This is where it starts.
> **Next chapter:** Chapter 1 — The Conversation Between Code and Hardware

---

## The Hook

You hear the word *virus* and you imagine something alive. Something intelligent.
Something that slithers into your computer through cracks you can't see, thinks
about how to hurt you, and hides in places you'll never find.

It doesn't. It's a text file. The same kind of text file as your homework assignment.

Astranetra — the project you're about to study — is a "virus-behavior simulator."
It scans your files, reads your CPU info, copies itself to startup folders, and
exfiltrates data to a server. Sounds terrifying, right?

Here's what it actually is: a 753-line JavaScript file that imports some modules
and calls some functions. The same `import`, the same `function`, the same
`console.log` you used in your last lab assignment. There is no secret API for
malware. There is no "dark mode" in Node.js that unlocks forbidden powers.

The tools a virus uses are *identical* to the tools your calculator app uses.
Same language. Same runtime. Same operating system calls. Same CPU instructions.

The only difference? **Intent.**

And that single word — intent — is what separates a backup script from ransomware,
a file organizer from a data thief, a startup helper from a persistence mechanism.

This chapter is about stripping away the mystique. By the end, you'll understand
what a program actually *is* — not metaphorically, not "at a high level," but
literally, physically, at the silicon level. And you'll see that the "scary virus"
is just a program. The same kind of program you've been writing since first year.

---

## The Mental Model — The Restaurant Kitchen

You walk into a restaurant. You look at the menu, pick a dish, and tell the waiter.
The waiter walks into the kitchen, tells the chef. The chef doesn't invent the dish
on the spot — there's a recipe card. The chef reads the recipe, follows it step by
step: chop onions, heat oil, add spices, cook for 10 minutes. The dish arrives.

You didn't cook. You didn't enter the kitchen. You don't even know what brand of
stove they use. You just *expressed intent* — "I want butter chicken" — and a chain
of intermediaries turned that intent into physical action.

A program works the same way.

- **You** = the programmer writing source code
- **The menu** = the programming language (JavaScript, Python, C)
- **The waiter** = the interpreter or compiler
- **The recipe card** = machine code (the actual instructions the CPU can read)
- **The chef** = the CPU
- **The kitchen** = the hardware (RAM, disk, network card)
- **The restaurant owner who controls access** = the Operating System

You write `console.log("hello")`. That's you ordering from the menu. You have no
idea how the terminal actually displays pixels on your screen. You don't need to.
Layers of software between you and the hardware translate your intent into physical
electrical signals that toggle specific pixels on your display.

This analogy holds up under pressure. The chef (CPU) can only read recipe cards
(machine code). If you hand the chef a poem (your `.js` file), the chef stares at
it blankly. Someone has to translate the poem into a recipe card first. That's what
the Node.js runtime does.

---

## The Mechanism — What a Program Actually Is

### Level 0: It's a File

Let's start at the bottom. Before a program runs, it's a **file on disk**. Bytes.
A sequence of numbers stored magnetically on a spinning platter (HDD) or in
electrical charges in flash memory cells (SSD).

Your Astranetra `index.js`? It's 34,138 bytes. That's 34,138 numbers, each between
0 and 255, stored on your disk. When you open it in VS Code, your text editor reads
those bytes and interprets them as UTF-8 characters — letters, symbols, whitespace.
But the file itself has no opinion about what it is. It's just bytes.

This is the first misconception to kill: **a program is not special.** On disk, it's
the same kind of thing as a JPEG, a PDF, or a text file with your grocery list.
The difference is what happens when you *ask the operating system to execute it*.

### Level 1: What IS a CPU Instruction?

Your CPU — the Intel or AMD chip inside your laptop — does not understand JavaScript.
It does not understand Python, Java, C++, or English. It understands exactly one
thing: **machine code**.

Machine code is a sequence of binary numbers (usually represented in hexadecimal for
human readability) that encode specific operations. Each operation is called an
**instruction**.

Here's what a real x86 instruction looks like:

```
Machine code (hex):   B8 05 00 00 00
What it means:        MOV EAX, 5
What it does:         "Put the number 5 into the CPU register called EAX"
```

That's it. That's what your CPU does. It reads a number (`B8 05 00 00 00`), decodes
it into an operation ("move the value 5 into register EAX"), and executes it. Then
it moves to the next instruction. Over and over. Billions of times per second.

This is called the **fetch-decode-execute cycle**:

```
┌──────────────────────────────────────────────────────────────────┐
│                    THE FETCH-DECODE-EXECUTE CYCLE                │
│                                                                  │
│   ┌─────────┐      ┌─────────┐      ┌─────────┐                │
│   │  FETCH   │ ───► │ DECODE  │ ───► │ EXECUTE │ ──┐            │
│   └─────────┘      └─────────┘      └─────────┘   │            │
│        ▲                                            │            │
│        │            (repeat forever)                │            │
│        └────────────────────────────────────────────┘            │
│                                                                  │
│   FETCH:   Read the next instruction from memory                │
│   DECODE:  Figure out what operation it represents              │
│   EXECUTE: Do the operation (arithmetic, memory access, etc.)   │
│                                                                  │
│   Your CPU does this ~4 billion times per second (at 4 GHz)     │
└──────────────────────────────────────────────────────────────────┘
```

A **register** is a tiny storage slot inside the CPU itself — not RAM, not disk,
but physically on the silicon chip. Modern x86 CPUs have about 16 general-purpose
registers, each holding 64 bits (8 bytes) of data. Registers are the fastest memory
in your entire computer — accessing one takes less than 1 nanosecond.

Here's the key insight: **every program you have ever run — every app, every game,
every virus — eventually becomes a stream of these tiny instructions.** JavaScript
doesn't run on the CPU. Machine code runs on the CPU. Something has to convert your
JavaScript into machine code first.

### Level 2: From JavaScript to Machine Code — The Full Pipeline

When you type `node index.js` in your terminal and press Enter, here is *exactly*
what happens. Not approximately. Exactly.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    WHAT HAPPENS WHEN YOU TYPE: node index.js           │
│                                                                         │
│  1. SHELL PARSES COMMAND                                                │
│     Your terminal shell (bash, zsh, PowerShell, cmd) reads the text    │
│     "node index.js" and splits it into: program = "node",              │
│     argument = "index.js"                                               │
│                                                                         │
│  2. SHELL ASKS OS TO FIND "node"                                        │
│     The shell searches your PATH variable (a list of directories)      │
│     for an executable file named "node" (or "node.exe" on Windows)     │
│                                                                         │
│  3. OS LOADS THE NODE.JS BINARY INTO MEMORY                             │
│     The OS reads the Node.js executable file, which is in ELF format (Linux) or PE format (Windows). It maps the binary into     │
│     a new region of RAM, sets up the stack and heap, and points the    │
│     CPU's instruction pointer to the entry point.                       │
│                                                                         │
│  4. NODE.JS (C++ program) STARTS EXECUTING                              │
│     V8 JavaScript engine initializes                                    │
│     libuv event loop initializes                                        │
│     Node.js built-in modules (fs, os, path, etc.) are registered       │
│                                                                         │
│  5. NODE.JS READS YOUR index.js FILE FROM DISK                          │
│     This itself is a system call (open + read)                          │
│                                                                         │
│  6. V8 PARSES YOUR JAVASCRIPT INTO AN AST                               │
│     AST = Abstract Syntax Tree — a tree data structure representing    │
│     the grammatical structure of your code                              │
│                                                                         │
│  7. V8 COMPILES AST TO BYTECODE (via Ignition)                          │
│     Bytecode is an intermediate format — not machine code yet,         │
│     but more compact and faster to interpret than raw JS text          │
│                                                                         │
│  8. V8 INTERPRETS THE BYTECODE                                          │
│     Ignition (V8's interpreter) executes bytecode instructions         │
│     one by one. If a function runs many times ("hot code"), V8 marks   │
│     it for optimization.                                                │
│                                                                         │
│  9. V8 JIT-COMPILES HOT CODE TO MACHINE CODE (via TurboFan)             │
│     JIT = Just-In-Time compilation. TurboFan takes hot bytecode and    │
│     compiles it into actual x86/ARM machine code that runs directly    │
│     on your CPU. No more interpretation.                                │
│                                                                         │
│  10. CPU EXECUTES THE MACHINE CODE                                       │
│      fetch → decode → execute → repeat                                 │
│      Your "console.log" is now electrical signals in silicon.           │
└─────────────────────────────────────────────────────────────────────────┘
```

Let's unpack the parts that most explanations skip.

**Step 3 — What does "load the binary" actually mean?**

An executable file isn't just machine code dumped into a file. It has structure.
On Windows, executables use the **PE (Portable Executable)** format. On Linux,
they use **ELF (Executable and Linkable Format)**. On macOS, **Mach-O**.

These formats are like envelopes. The envelope contains:
- A **header** that tells the OS: "I'm an executable, I was compiled for x86-64,
  my code starts at byte offset 4096, I need 200 MB of RAM, load these shared
  libraries (DLLs/.so files) before I start."
- **Sections**: `.text` (the actual machine code), `.data` (global variables),
  `.bss` (uninitialized variables), `.rodata` (read-only constants like strings)
- A **symbol table** for debugging

The OS reads this header, allocates virtual memory for the process (more on this
in Chapter 3), maps each section to the right memory address, and then sets the
CPU's **instruction pointer** (a register called `RIP` on x86-64) to the **entry
point** — the first instruction to execute.

When the OS does this for `node.exe`, it's launching a C++ program. Node.js is
not a mystical JavaScript engine — it's a compiled C++ binary, about 70 MB in size,
that happens to contain Google's V8 engine inside it.

**Step 6 — What's an AST?**

When V8 reads your JavaScript source code, it doesn't execute it character by
character. It first **parses** it into a tree structure called an **Abstract Syntax
Tree** (AST). This is the same technique every programming language uses.

Your code:
```javascript
const x = 5 + 3;
```

Becomes something like:
```
        VariableDeclaration
        ├── name: "x"
        └── init: BinaryExpression
             ├── operator: "+"
             ├── left: Literal(5)
             └── right: Literal(3)
```

The parser checks syntax, catches errors (`SyntaxError: Unexpected token`), and
produces this tree. The tree is then walked by the compiler to produce bytecode.

**Step 7-9 — Bytecode vs Machine Code vs JIT**

This is where JavaScript differs from C or Rust. In C, you compile your source code
into machine code *before* running it (ahead-of-time compilation). The `gcc` compiler
produces a binary that the CPU can execute directly.

JavaScript uses a hybrid approach:

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐
│  Your .js   │───►│  V8 Parser   │───►│   Ignition   │───►│ TurboFan │
│  source     │    │  (makes AST) │    │ (bytecode +  │    │  (JIT →  │
│  code       │    │              │    │  interpreter) │    │ machine  │
│             │    │              │    │              │    │  code)   │
└─────────────┘    └──────────────┘    └──────────────┘    └──────────┘
                                             │                    │
                                        runs cold code       runs hot code
                                        (used once)          (used many times)
```

**Bytecode** is a set of intermediate instructions that V8's Ignition interpreter
understands. It's not machine code — your CPU can't execute it directly. But it's
much more compact and structured than raw JavaScript text, so interpreting it is fast.

**JIT (Just-In-Time) compilation** is V8's performance trick: if a function is called
hundreds of times, V8's TurboFan compiler takes the bytecode and compiles it into
raw machine code — the same kind of code that `gcc` produces from C. This machine
code runs directly on your CPU with zero interpretation overhead.

This is why JavaScript can be fast despite being a "scripting language." Hot loops
eventually run as native machine code, identical in form to compiled C.

### Level 3: The Operating System — The Bouncer Between You and the Hardware

Your program, no matter what language it's written in, cannot talk directly to
hardware. It cannot read a file from disk, send a packet over the network, or even
print a character to the terminal without going through the **Operating System**.

The OS is a **resource manager**. It controls:
- **CPU time**: which program runs, for how long, before being swapped out
- **Memory**: which program gets which chunk of RAM, preventing one program from
  reading another program's memory
- **Disk**: which program can read/write which files, enforcing permissions
- **Network**: which program can open which ports, send which packets
- **Devices**: keyboard input, display output, USB, audio — all go through the OS

**Why?** Because if any program could directly access hardware, one buggy program
could crash your entire computer. One malicious program could read every other
program's memory. The OS exists to enforce boundaries.

This means: when Astranetra calls `fs.readdir()` to scan your files, it's not
reaching into your SSD and reading sectors. It's asking the OS: "Hey, give me the
list of files in this directory." The OS checks permissions, reads the filesystem
data structures (we'll cover this in Chapter 2), and hands back the list.

When Astranetra calls `os.cpus()` to fingerprint your system, it's not probing
your Intel chip. It's asking the OS: "What CPU do you see?" The OS already knows
because it enumerated hardware at boot time. It just returns cached data.

### Level 4: The Difference Between a "Virus" and a "Normal Program"

Here it is, the punchline of this chapter:

**There is no difference.**

At the technical level — the CPU level, the OS level, the system call level —
there is zero distinction between a virus and any other program. They use the
same instructions. They make the same system calls. They run in the same user
space with the same privileges.

| Action | "Normal" program | Astranetra |
|--------|-----------------|------------|
| Read CPU info | `os.cpus()` | `os.cpus()` |
| List files | `fs.readdir()` | `fs.readdir()` |
| Read file contents | `fs.readFileSync()` | `fs.readFileSync()` |
| Copy itself | `fs.copyFileSync()` | `fs.copyFileSync()` |
| Run at startup | Startup entry in registry/shell config | Startup entry in registry/shell config |
| Send data over network | `http.request()` | `http.request()` |

Same functions. Same OS. Same CPU. The *only* difference is **what the programmer
intended** when they wrote the code.

A backup tool copies your files to a safe location. Ransomware encrypts your files
and demands payment. Both call `fs.readFileSync()` and `fs.writeFileSync()`. The
CPU doesn't know the difference. The OS doesn't know the difference. Only you —
the human reading the source code — can tell.

This is why understanding programs at this level matters. If you can't distinguish
a virus from a normal program by looking at the technology it uses, you have to
understand *what the code actually does* to make that judgment. And that requires
understanding every layer: the language, the runtime, the OS, the hardware.

---

## The Experiment — Write Your First "Virus"

Don't panic. You're going to write a script that does exactly what a virus does:
**reads its own source code and copies itself to another location.** This is called
**self-replication** — the defining behavior of a computer virus since the 1980s.

Create a file called `replicator.js`:

```javascript
// replicator.js — a self-replicating script
// This is literally what early computer viruses did.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ── Step 1: Figure out where I am ──────────────────────────────────────────
// import.meta.url gives this file's location as a file:// URL
// fileURLToPath converts that to a normal filesystem path
const __filename = fileURLToPath(import.meta.url);
const mySource = fs.readFileSync(__filename, 'utf8');
// ↑ I just read my own source code. The OS didn't stop me.
// Any program can read its own file — there's no rule against it.

// ── Step 2: Pick a new location ────────────────────────────────────────────
const copyPath = path.join(path.dirname(__filename), 'replica_copy.js');

// ── Step 3: Copy myself ────────────────────────────────────────────────────
fs.writeFileSync(copyPath, mySource, 'utf8');
// ↑ I just wrote an exact copy of myself to a new file.
// fs.writeFileSync makes a system call (write) to the OS kernel.
// The kernel writes bytes to disk. Done.

console.log(`I just replicated.`);
console.log(`Original: ${__filename}`);
console.log(`Copy:     ${copyPath}`);
console.log(`\nBoth files are ${mySource.length} bytes.`);
console.log(`They are identical: ${fs.readFileSync(copyPath, 'utf8') === mySource}`);
```

Run it: `node replicator.js`

You should see output like:

```
I just replicated.
Original: /home/you/replicator.js
Copy:     /home/you/replica_copy.js

Both files are 912 bytes.
They are identical: true
```

Congratulations. You just wrote a self-replicating program. That's literally what
a virus does. The "dark magic" is `fs.readFileSync` and `fs.writeFileSync` — the
same functions you've been using since your first Node.js tutorial.

Now open `replica_copy.js`. Run it: `node replica_copy.js`. It will create
*another* copy. The copy can copy itself. That's replication.

**The discomforting realization:** the OS didn't stop you. No security warning. No
permission dialog. Your program read its own source and wrote a file in the same
directory, and the OS said "sure." Because from the OS's perspective, that's a
perfectly normal thing for a program to do. It's the same system calls your text
editor uses when you click "Save As."

*Clean up after yourself:* delete `replica_copy.js` when you're done.

---

## The Astranetra Connection

Open `index.js`. All 753 lines. You might expect something sinister — encrypted
payloads, obfuscated shellcode, raw memory manipulation. Here's what you'll
actually find:

**The first 10 lines:**

```javascript
// index.js — Lines 1-11 (annotated)
#!/usr/bin/env node                    // ← shebang line: tells Unix "use Node.js to run me"
/**
 * ASTRANETRA — The Watching Weapon
 * Astra (weapon) · Netra (eye)
 */

import path   from 'path';            // ← standard library: file path manipulation
import fs     from 'fs';              // ← standard library: file system operations
import os     from 'os';              // ← standard library: operating system info
import crypto from 'crypto';          // ← standard library: cryptographic functions
```

Four imports. All from Node.js standard library. No hacking tools. No dark web
modules. `path`, `fs`, `os`, `crypto` — you've probably used at least two of
these in your college assignments.

**The `loadModules()` function (Lines 498-528):**

This is where Astranetra loads its "weapons." Look at what they actually are:

```javascript
// index.js — Lines 498-528 (annotated)
async function loadModules() {
  const [
    { runSystemRecon },          // ← calls os.cpus(), os.totalmem(), etc.
    { runFileScanner },          // ← calls fs.readdir() recursively
    { runExfil, listScans },     // ← sends HTTP POST to localhost:4444
    { persist, revert },         // ← copies a file to a startup folder
    { showPath, pathHijackDemo },// ← reads and modifies process.env.PATH
    { createBaseline, diffLatest, watchDir },  // ← computes SHA-256 hashes
    { createFile, readFile, updateFile, deleteFile, moveFile, corruptFile },
    { generateDashboard },       // ← writes an HTML file
    { exportJson, exportMarkdown, exportCsv, exportAll },  // ← writes report files
    { startExfilServer },        // ← starts an Express.js HTTP server
  ] = await Promise.all([
    import('./core/SystemRecon.js'),       // dynamic import — loaded at runtime
    import('./core/FileScanner.js'),
    import('./core/ExfilEngine.js'),
    import('./core/PersistenceEngine.js'),
    import('./core/PathManipulator.js'),
    import('./core/IntegrityMonitor.js'),
    import('./core/CRUDEngine.js'),
    import('./output/DashboardGenerator.js'),
    import('./output/ReportExporter.js'),
    import('./server/exfilServer.js'),
  ]);
  // ...
}
```

`Promise.all()` with dynamic `import()` statements. That's advanced JavaScript,
sure — but it's not magic. It's loading ten modules in parallel instead of
sequentially. The same pattern you'd use in a web app to lazy-load components.

**The full pipeline (Lines 531-568):**

This is the "scary" part — the full virus pipeline. Read it carefully:

```javascript
// index.js — Lines 531-568 (annotated)
async function runFullPipeline(mods) {
  // 1 — RECON: calls os.cpus(), os.totalmem(), os.networkInterfaces()
  const recon = await mods.runSystemRecon();

  // 2 — FILE SCAN: calls fs.readdir() recursively with worker_threads
  const scan = await mods.runFileScanner();

  // 3 — EXFIL: sends recon + scan data via HTTP POST to localhost
  await mods.startExfilServer();
  const exfilResult = await mods.runExfil(recon, scan);

  // 4 — REPORTS: writes .json, .md, .csv files and an HTML dashboard
  mods.exportJson(allData);
  mods.exportMarkdown(allData);
  mods.exportCsv(allData);
  mods.generateDashboard(allData);
}
```

Gather info → find files → send data → write reports. That's the entire "virus."
No buffer overflows. No privilege escalation. No zero-day exploits. It's a Node.js
script that calls standard library functions in a specific order.

**The `main()` function — the CLI router (Lines 607-752):**

The last 145 lines of `index.js` are a CLI (Command-Line Interface) router. It
reads what you typed after `node index.js`, and calls the appropriate function:

```javascript
// index.js — Lines 607-618 (annotated)
async function main() {
  const args    = process.argv.slice(2);  // ← everything after "node index.js"
  const command = args[0] || '';           // ← the first word is the command

  if (!command) { await runFullPipeline(mods); return; }
  // ↑ No command? Run the full pipeline.

  if (command === 'recon')   { /* run system recon only */ }
  if (command === 'scan')    { /* run file scanner only */ }
  if (command === 'exfil')   { /* run exfiltration only */ }
  if (command === 'persist') { /* run persistence only  */ }
  // ... and so on for every subcommand
}
```

This is a **switch/case** pattern. Parse the command-line arguments, match the
first word to a handler, call the handler. It's the same pattern behind `git`
(`git commit`, `git push`, `git pull`) and `npm` (`npm install`, `npm run`).

**The entire Astranetra codebase is:** import modules → parse CLI arguments →
call the matching function → print output. That's it. That's the virus.

---

## The Deeper Questions

These are things this chapter deliberately didn't answer:

**1. If a virus uses the same system calls as any other program, how does
antivirus software detect it?**
Not by looking at which system calls it uses — that's identical. Antivirus tools
use **heuristic analysis** (pattern matching on known malicious behaviors),
**signature databases** (checksums of known malware files), and **behavioral
monitoring** (flagging unusual patterns like "this program just read 10,000 files
in 2 seconds and opened a network connection"). The cat-and-mouse game between
malware authors and antivirus developers is one of the deepest problems in computer
security. We'll touch on this when we cover hashing in Chapter 7.

**2. You said the OS controls everything. But Astranetra reads files, copies itself
to startup folders, and sends data over the network — and the OS lets it. Why
doesn't the OS stop it?**
Because from the OS's perspective, Astranetra is doing *normal things*. Reading
files? Your text editor does that. Writing to startup folders? Your auto-updater
does that. Sending HTTP requests? Your browser does that millions of times a day.
The OS enforces *permissions* (can this user access this file?) but not *intent*
(is this access malicious?). Chapter 5 (Persistence) goes deep on how startup
folders work and why the OS treats them as ordinary directories.

**3. You said JavaScript becomes machine code via JIT compilation. Does that mean
JavaScript is as fast as C?**
Almost, for hot code paths. V8's TurboFan produces highly optimized machine code
that can match C in tight loops. But JavaScript has overhead that C doesn't:
garbage collection (automatic memory management that pauses execution to clean up),
dynamic typing (V8 has to check types at runtime), and the JIT warmup period
(code runs interpreted before it gets compiled). In practice, well-written
JavaScript is typically 1.5-3x slower than equivalent C. For Astranetra's use
case — filesystem I/O and network requests — this doesn't matter because the
bottleneck is the OS (system calls), not the CPU.

---

## Challenge Problem

Write a script called `inspector.js` that answers this question: **how many layers
of abstraction are between your JavaScript code and the hardware?**

Your script should:
1. Print the JavaScript source code of a simple operation (e.g., `1 + 2`)
2. Print the V8 bytecode for that operation (hint: run Node.js with
   `node --print-bytecode --filter=yourFunctionName inspector.js`)
3. Print the machine code for that operation (hint: `node --print-opt-code
   --filter=yourFunctionName inspector.js` — you may need to run the function
   thousands of times in a loop to trigger JIT compilation)
4. Compare the three representations: how many bytes is each? How many
   instructions does the CPU actually execute for `1 + 2`?

No solution given. But if the machine code output surprises you by its length,
you're learning something real.

---

> **Next Chapter: The Conversation Between Code and Hardware**
>
> You now know that your program can't touch hardware directly — it goes through
> the OS. But *how* does it talk to the OS? Not with a polite email. With a
> very specific, very low-level mechanism called a **system call** — where the CPU
> physically switches from user mode to kernel mode, your program's state is
> frozen, the kernel does its work, and control returns. Chapter 1 explains this
> mechanism in detail, and shows you exactly how `os.cpus()` in Astranetra
> triggers a cascade through five layers of software before touching silicon.
