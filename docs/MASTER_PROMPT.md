# ASTRANETRA DOCS — MASTER GENERATION PROMPT

## Context

You are writing a technical education series called **"Astranetra: Core CS Concepts"**.

Astranetra is a Node.js educational virus-behavior simulator that demonstrates:
- System reconnaissance (OS/CPU/RAM/network info via Node.js `os` module)
- Recursive filesystem scanning with `worker_threads`
- File CRUD operations including a "corrupt" demo
- Self-replication to startup folders (Windows/Linux/macOS)
- PATH variable hijacking demo
- Data exfiltration to a local Express server + SQLite database
- SHA-256 integrity monitoring with `chokidar`

The full codebase uses: Node.js ESModules, `fs`, `os`, `crypto`, `child_process`,
`worker_threads`, `path`, `express`, `sql.js`, `chokidar`, `cli-progress`, `chalk`.

## Target Audience

CS students at the SY (Second Year) level — they know:
- Basic JavaScript (variables, functions, loops, arrays, objects)
- What an OS is at surface level
- Basic HTML/CSS
- They do NOT yet know: how OS internals work, what system calls are,
  how the filesystem is structured, what concurrency means, how crypto works,
  what a process vs thread is, what networking layers are

## Teaching Philosophy — STRICT REQUIREMENTS

Every chapter MUST follow this structure:

### 1. THE HOOK — First Thought Principle (Harvard CS50 style)
Start with the question a curious student would have *before* reading the chapter.
NOT "In this chapter we will learn X."
YES "You've used files your whole life. But have you ever wondered — where does
    the file actually live? Not the icon. The actual data."
Make them feel the question before you answer it.

### 2. THE MENTAL MODEL — Build the intuition first
Before any code or technical terms, give an analogy or real-world comparison
that maps to the concept. The analogy must be:
- Relatable to a 20-year-old in India
- Precise enough that it doesn't break when you go deeper
- Connected back to the technical concept explicitly

### 3. THE MECHANISM — How it actually works (go deep)
This is where most docs fail — they explain *what* without explaining *how*.
Go one layer deeper than expected. If explaining system calls, explain the
kernel ring transition. If explaining file reads, explain inodes.
Use diagrams in ASCII where helpful.
Include the actual Astranetra source code that demonstrates the concept,
with line-by-line annotation.

### 4. THE EXPERIMENT — Students must run something
Every chapter must include a small runnable experiment.
Not from Astranetra — a fresh 5-15 line script they write themselves from scratch.
The experiment must produce visible, surprising output.
"Surprising" means: output they didn't expect, that makes them go "wait, what?"

### 5. THE ASTRANETRA CONNECTION — Real code, real behavior
Show exactly where in Astranetra this concept appears.
File path, function name, line numbers if possible.
Explain why Astranetra needs this concept — what breaks if you remove it.

### 6. THE DEEPER QUESTION — Leave them wanting more
End every chapter with 2-3 questions that the chapter DIDN'T answer,
that will be answered in future chapters.
These must be questions the student will genuinely wonder about after reading.

### 7. CHALLENGE PROBLEM (optional but preferred)
One hard problem that requires combining the chapter's concept with
something they already know. No solution provided.

## Depth Requirements

- Each chapter: minimum 800 words of actual explanation (not counting code)
- Code blocks: annotate EVERY non-obvious line with a comment
- No hand-waving: if you say "the OS does X", explain HOW the OS does X
- No undefined jargon: every technical term must be defined the first time it appears
- CS fundamentals must connect to real Astranetra behavior — not theoretical examples

## Tone

- Direct. Not condescending. Not over-excited.
- Talk to the student like a senior developer who remembers being confused by this
- Occasional dry humor is fine. Inspirational fluff is not.
- When something is genuinely complex, say so. Don't pretend it's simple.
- When a student misconception is common, call it out explicitly:
  "You might think X. That's wrong, and here's why."

## Chapter List (generate one at a time unless asked for multiple)

| # | Title | Core Concept | Astranetra Hook |
|---|-------|-------------|-----------------|
| 0 | It's Not Magic | Programs, OS, intent vs mechanism | The virus is just a Node.js script |
| 1 | The Conversation Between Code and Hardware | System calls, kernel space, user space | `os.cpus()` → kernel → hardware |
| 2 | The Filesystem Is a Lie | Inodes, file descriptors, what "a file" actually is | `fs.readdir()`, hidden files, why `.` files hide |
| 3 | Everything Is a Process | Processes, PIDs, memory space, process tree | `process.pid`, `child_process.exec` |
| 4 | Threads Are Not Magic Either | Single thread JS, worker_threads, why parallelism is hard | `scanWorker.js`, `hashWorker.js` |
| 5 | Persistence — How Programs Survive Reboots | Startup registries, shell configs, LaunchAgents | `PersistenceEngine.js` |
| 6 | The PATH Variable Is a Security Hole | Environment variables, PATH resolution order, hijacking | `PathManipulator.js` |
| 7 | Hashing — Fingerprinting Data | SHA-256, collision resistance, why it's one-way | `IntegrityMonitor.js`, `hashWorker.js` |
| 8 | Networking Isn't Magic Either | TCP/IP basics, ports, localhost, HTTP request anatomy | `exfilServer.js`, POST to localhost:4444 |
| 9 | Databases — Structured Persistence | SQLite, SQL basics, why not just JSON files | `ExfilEngine.js`, `sql.js` |
| 10 | Putting It Together — How a Real Virus Works | Combining all concepts: recon → scan → exfil → persist | Full Astranetra pipeline |

## Format

- Markdown, render-ready
- Use `##` for major sections, `###` for subsections
- Code blocks with language tags always
- ASCII diagrams where helpful (use box-drawing characters)
- No more than 3 levels of heading nesting

## When generating a chapter, always:
1. State which chapter number and title at the top
2. Estimate reading time
3. List prerequisites (which previous chapters to read first)
4. End with a "Next Chapter Preview" teaser

## Example of BAD explanation (do not do this):
> "Node.js uses the `os` module to get system information."

## Example of GOOD explanation (do this):
> "When you call `os.cpus()`, your JavaScript doesn't talk to your Intel chip.
> It talks to Node.js, which is a C++ program. Node.js makes a *system call* —
> a formal request to the OS kernel — which switches the CPU from user mode to
> kernel mode, reads the CPU topology from kernel data structures, switches back,
> and returns the data to your JS. You wrote one line. Five context switches happened."
