# Astranetra: Core CS Concepts

---

# Chapter 4 — Threads Are Not Magic Either

> **Reading time:** ~25 minutes
> **Prerequisites:** Chapter 1 (System Calls), Chapter 3 (Processes)
> **Next chapter:** Chapter 5 — Persistence: How Programs Survive Reboots

---

## The Hook

JavaScript is single-threaded. You've heard this a hundred times. Maybe a thousand.
Every tutorial, every interview question, every Stack Overflow answer — "JavaScript
is single-threaded."

Okay. Fine.

But Astranetra scans your **entire filesystem** — millions of files — and it doesn't
freeze. It runs a progress bar while computing SHA-256 hashes. The progress bar
animates smoothly while, somewhere, cryptographic math is grinding through gigabytes
of file data.

How?

If JavaScript can only do one thing at a time, how is it doing two things at once?

You might say: *"async/await."* Wrong. `async/await` doesn't create threads. It
doesn't run code in parallel. It does something much more specific, and much more
limited, than you think.

You might say: *"The event loop."* Closer. But the event loop is not a magic
parallelism machine. It's a single-threaded scheduler. It can juggle tasks, but it
can't chew two pieces of food at the same time.

The real answer involves something most JavaScript developers never touch:
**`worker_threads`** — actual OS-level threads running separate V8 instances. And
understanding them requires understanding what a thread actually is, why parallelism
is genuinely hard, and why Node.js was designed to be single-threaded in the first
place.

This chapter will take you from "JavaScript is single-threaded" to "I understand
exactly when and why Astranetra breaks that rule."

---

## The Mental Model — The Restaurant

Think of a restaurant.

There's one **head waiter**. Just one. This person takes every order, delivers every
plate, handles every complaint, processes every payment. One human, doing everything
front-of-house.

This waiter is your **event loop**.

Here's the key: the waiter never cooks. The waiter takes your order, walks it to the
kitchen window, pins it up, and immediately walks to the next table. The waiter
doesn't stand at the stove waiting for your pasta to boil.

The **kitchen staff** are the worker threads.

When the food is ready, a bell rings. The waiter hears it (that's a callback), picks
up the plate, and delivers it. But at no point does the waiter stop taking orders to
cook something. And at no point do the kitchen staff walk out to serve tables.

This model works beautifully — until someone orders something the waiter has to
prepare tableside. Say, a flambé dessert. The waiter must stand at the table, pour
brandy, light a match, wait for the flames, plate it. During that entire time, every
other table is ignored. No orders taken. No food delivered. Nobody gets a refill.

**That is what happens when you run CPU-intensive code on the main thread.**

Hashing a file with SHA-256? That's a tableside flambé. The event loop — your waiter
— stands there doing math, and everything else freezes.

The solution: hire a second cook who can do tableside service in the back kitchen.
That cook is a `worker_thread`. The waiter sends the dessert order to the kitchen,
the cook does the flambé where nobody's waiting is affected, and sends the finished
plate back when it's done.

---

## The Mechanism — How It Actually Works

### Thread vs. Process: The Fundamental Distinction

In Chapter 3, you learned what a process is: an independent program with its own
memory space, its own PID, its own everything. When you spawn a child process, the OS
creates a whole new environment — it's like opening a second restaurant.

A **thread** is different. Threads exist *inside* a process. They share the same
memory space — the same heap, the same global variables, the same file descriptors.
But each thread gets its own **call stack** (its own track of which function it's
currently inside) and its own **program counter** (which line of code it's executing
right now).

```
┌─────────────────────── PROCESS (one restaurant) ───────────────────────┐
│                                                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                    │
│  │  Thread 1   │  │  Thread 2   │  │  Thread 3   │                    │
│  │             │  │             │  │             │                    │
│  │ Own stack   │  │ Own stack   │  │ Own stack   │                    │
│  │ Own counter │  │ Own counter │  │ Own counter │                    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                    │
│         │                │                │                            │
│         ▼                ▼                ▼                            │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                    SHARED MEMORY (heap)                        │    │
│  │         variables, objects, file descriptors, buffers          │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**Why does this matter?**

| | Process | Thread |
|---|---|---|
| Memory | Own address space | Shares parent's address space |
| Creation cost | Heavy (~10ms) | Light (~1ms) |
| Communication | IPC (pipes, sockets) | Direct shared memory |
| Crash impact | Other processes survive | Can corrupt entire process |
| Context switch cost | Expensive | Cheaper |

Threads are lighter. Faster to create, faster to switch between. But that shared
memory is a double-edged sword — it's the source of nearly every concurrency bug
in the history of computing.

### The Event Loop — Actually Understanding It

You've heard "the event loop" a thousand times too. But what is it *actually*?

It's a `while(true)` loop. Seriously. Conceptually, it looks like this:

```
while (there_is_work_to_do) {
    1. Execute everything on the CALL STACK (your synchronous JS code)
    2. Drain the MICROTASK QUEUE (Promise .then/.catch callbacks, queueMicrotask)
    3. Pick ONE task from the MACROTASK QUEUE (setTimeout, setInterval, I/O callbacks)
    4. Go back to step 1
}
```

But that's the simplified version. The real event loop in Node.js (powered by libuv)
has **six phases**, and they run in this exact order on every tick:

```
   ┌───────────────────────────┐
┌─►│         TIMERS            │  ← setTimeout, setInterval callbacks
│  └─────────────┬─────────────┘
│  ┌─────────────▼─────────────┐
│  │     PENDING CALLBACKS     │  ← I/O callbacks deferred from previous tick
│  └─────────────┬─────────────┘
│  ┌─────────────▼─────────────┐
│  │       IDLE / PREPARE      │  ← internal use only (libuv housekeeping)
│  └─────────────┬─────────────┘
│  ┌─────────────▼─────────────┐
│  │          POLL             │  ← retrieve new I/O events; execute I/O callbacks
│  │                           │     (fs.read, net.connect, etc.)
│  │  (will BLOCK here if      │     This is where Node spends most of its time
│  │   nothing else to do)     │     waiting for I/O to complete.
│  └─────────────┬─────────────┘
│  ┌─────────────▼─────────────┐
│  │          CHECK            │  ← setImmediate() callbacks
│  └─────────────┬─────────────┘
│  ┌─────────────▼─────────────┐
│  │      CLOSE CALLBACKS      │  ← socket.on('close'), cleanup handlers
│  └─────────────┬─────────────┘
│                │
└────────────────┘  ← loop back to TIMERS
```

Between **every** phase transition, Node drains the **microtask queue** — all
resolved Promise callbacks, all `process.nextTick()` callbacks. This is why a
`Promise.resolve().then(...)` fires before a `setTimeout(..., 0)`: Promises are
microtasks, `setTimeout` is a macrotask (timers phase). Microtasks always get
priority.

**The critical insight:** all six phases run on a **single thread**. One. If any
callback in any phase takes 500ms to complete, the entire loop stalls for 500ms.
No timers fire. No I/O callbacks execute. No progress bars update.

### Why Node.js Is Single-Threaded — By Design

This seems like a bug. Why would you design a server runtime with one thread?

Because multi-threaded code is a **nightmare**.

In languages like Java or C++, when multiple threads share memory, you get three
categories of terrifying bugs:

**1. Race Conditions** — When two threads read and write the same variable, and the
result depends on which one gets there first.

```
// Thread A:                    // Thread B:
counter = counter + 1;          counter = counter + 1;

// If counter starts at 0, you'd expect it to be 2.
// But both threads might READ 0, then both WRITE 1.
// Result: 1, not 2. This is called a "lost update."
```

**2. Deadlocks** — When Thread A holds Lock X and waits for Lock Y, while Thread B
holds Lock Y and waits for Lock X. Neither can proceed. Forever.

```
Thread A: lock(X) → wants lock(Y) → BLOCKED (B has Y)
Thread B: lock(Y) → wants lock(X) → BLOCKED (A has X)

Both threads freeze. Your program hangs. Forever. No error. No crash.
Just silence.
```

**3. Starvation** — When one thread gets so much priority that other threads never
get to run. Like a restaurant where one table keeps calling the waiter and no one
else ever gets served.

Node.js avoids all three by having **one thread for your JS code**. No shared
mutable state, no locks, no deadlocks, no race conditions. Your code runs top to
bottom, one operation at a time, deterministically.

But this creates a new problem.

### The Problem: CPU-Bound Work

File I/O? Not a problem. When you call `fs.readFile()`, Node hands the request to
libuv, which uses the OS's async I/O mechanisms (or its own thread pool of 4 threads
for operations that don't have native async support). The event loop doesn't wait —
it moves on, and gets called back when the data is ready.

But what about hashing?

SHA-256 is **pure math**. It takes a block of data and runs it through 64 rounds of
bitwise operations — shifts, rotations, XORs, additions. There is no I/O to wait for.
There is no kernel request. It's just the CPU grinding through an algorithm.

When you call `crypto.createHash('sha256').update(data).digest('hex')`, the V8
engine is executing math operations on the main thread. For a small file, this takes
microseconds. For 10,000 files? Your event loop is doing nothing but math. For
seconds. Maybe minutes.

During that time:
- Your progress bar doesn't update
- Your `setTimeout` callbacks don't fire
- Your server can't accept new connections
- Your CLI appears frozen

```
Main Thread (BLOCKED):

    ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
    │ hash    │ │ hash    │ │ hash    │ │ hash    │ . . . × 10,000
    │ file 1  │ │ file 2  │ │ file 3  │ │ file 4  │
    └─────────┘ └─────────┘ └─────────┘ └─────────┘
    ──────────────── ALL OTHER WORK FROZEN ─────────────────────►
                                                           time
```

This is the tableside flambé problem. The waiter is doing math at your table, and
the whole restaurant grinds to a halt.

### The Solution: `worker_threads`

Node.js 10.5 introduced the `worker_threads` module. It lets you spawn **actual
OS-level threads** that run **separate V8 instances**.

Read that again: *separate V8 instances*. Each worker thread has its own V8 engine,
its own call stack, its own event loop. Your JavaScript in the worker is fully
isolated from the main thread. This is not like Java threads sharing the same heap.

```
┌───────────────────── Node.js Process ─────────────────────────┐
│                                                                │
│  ┌──────────────────┐          ┌──────────────────┐           │
│  │   MAIN THREAD    │          │   WORKER THREAD   │           │
│  │                  │  message  │                  │           │
│  │  Your app code   │◄────────►│  Heavy CPU work   │           │
│  │  Event loop      │ passing   │  Own V8 instance  │           │
│  │  Progress bar    │          │  Own event loop   │           │
│  │  User I/O        │          │  Own call stack   │           │
│  │                  │          │                  │           │
│  └──────────────────┘          └──────────────────┘           │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              SHARED PROCESS MEMORY                     │    │
│  │    (SharedArrayBuffer only — not default)              │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

Now your main thread stays free. The waiter keeps taking orders. The heavy work
happens in the kitchen.

### Message Passing: How Threads Talk

Workers don't share variables with the main thread by default. They communicate
through **message passing**: `postMessage()` to send, `on('message', ...)` to
receive.

When you call `postMessage(data)`, Node doesn't just hand over a pointer. It uses
the **structured clone algorithm** — a deep-copy mechanism that:

1. Recursively copies the object and all nested objects
2. Handles `Date`, `RegExp`, `Map`, `Set`, `ArrayBuffer`, and more
3. Does NOT copy functions (they can't be serialized)
4. Does NOT copy class instances with methods
5. Creates an entirely independent copy in the receiving thread's memory

This means every message has a cost. Sending a 100MB buffer as a message means
copying 100MB. For large data, you can use `SharedArrayBuffer` — a special buffer
that genuinely lives in shared memory and both threads can read/write — but then
you're back in race-condition territory and need `Atomics` for synchronization.

Astranetra uses regular message passing (not SharedArrayBuffer), keeping things safe
and simple.

### Why Parallelism Is Genuinely Hard

Even with worker threads, parallelism introduces fundamental problems that
single-threaded code never has.

**Splitting work evenly is non-trivial.** If you have 10,000 files and 4 workers,
you might give 2,500 files to each. But what if Worker 1's files are all 10GB and
Worker 3's are all 1KB? Worker 3 finishes in milliseconds while Worker 1 grinds for
minutes. The total time equals the slowest worker. This is called **load imbalance**.

**Coordination has overhead.** Spawning a worker costs time (~1ms). Sending messages
costs time (structured clone). If the work per item is tiny (like adding two
numbers), the coordination overhead exceeds the work itself. You'd be faster doing
it single-threaded.

**Amdahl's Law.** This is a mathematical reality that sets a hard ceiling on
parallelism speedups. If your program is 50% parallelizable (and 50% must run
sequentially — like reading config, setting up, printing results), then:

```
                    1
Speedup = ─────────────────────
           (1 - P) + P / N

Where:
  P = fraction of work that's parallelizable (0.5)
  N = number of threads

With P = 0.5, N = 4:   Speedup = 1 / (0.5 + 0.5/4) = 1 / 0.625 = 1.6x
With P = 0.5, N = 16:  Speedup = 1 / (0.5 + 0.5/16) = 1 / 0.53125 ≈ 1.88x
With P = 0.5, N = ∞:   Speedup = 1 / 0.5 = 2x (absolute maximum!)
```

Even with infinite threads, if half your code is serial, you can never go faster
than 2x. Adding 4 threads gives you 1.6x, not 4x. Adding 16 gives you 1.88x.
Diminishing returns hit fast.

This is why Astranetra uses 4 workers by default for hashing — not 16, not 64.
Beyond 4, the speedup is marginal on most machines, and you're consuming extra
memory for each V8 instance.

---

## The Experiment — See It Yourself

Create a file called `thread_demo.js`:

```javascript
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';

// ── CPU-heavy work: count primes up to N ────────────────────────────────────
function countPrimes(max) {
  let count = 0;
  for (let n = 2; n <= max; n++) {
    let isPrime = true;
    for (let d = 2; d * d <= n; d++) {
      if (n % d === 0) { isPrime = false; break; }
    }
    if (isPrime) count++;
  }
  return count;
}

// ── WORKER MODE: if this file is loaded as a worker, do work and exit ───────
if (!isMainThread) {
  const result = countPrimes(workerData.max);
  parentPort.postMessage({ result });
  process.exit(0);  // not strictly needed, but explicit
}

// ── MAIN THREAD ─────────────────────────────────────────────────────────────
const MAX = 2_000_000;  // count primes up to 2 million

console.log('=== PART 1: CPU-heavy work ON the main thread ===\n');

// Start a "progress" interval — this SHOULD print every 200ms
const interval1 = setInterval(() => {
  process.stdout.write('.');  // this proves the event loop is alive
}, 200);

const t1 = performance.now();
const result1 = countPrimes(MAX);
const t2 = performance.now();

clearInterval(interval1);
console.log(`\n\nPrimes found: ${result1}`);
console.log(`Time: ${(t2 - t1).toFixed(0)} ms`);
console.log(`Dots printed while working: ZERO (the event loop was BLOCKED)\n`);

// ── PART 2: Same work, but on a WORKER THREAD ──────────────────────────────
console.log('=== PART 2: CPU-heavy work on a WORKER THREAD ===\n');

const t3 = performance.now();

// Start the same "progress" interval
const interval2 = setInterval(() => {
  process.stdout.write('.');  // the event loop should be FREE now
}, 200);

// Spawn a worker running THIS SAME FILE, but it'll enter the !isMainThread branch
const worker = new Worker(fileURLToPath(import.meta.url), {
  workerData: { max: MAX },
});

worker.on('message', (msg) => {
  const t4 = performance.now();
  clearInterval(interval2);
  console.log(`\n\nPrimes found: ${msg.result}`);
  console.log(`Time: ${(t4 - t3).toFixed(0)} ms`);
  console.log(`Dots printed while working: MANY (the event loop stayed RESPONSIVE)`);
  console.log(`\nSame work. Same result. But this time the main thread was free.`);
});

worker.on('error', (e) => {
  clearInterval(interval2);
  console.error('Worker error:', e);
});
```

Run it: `node thread_demo.js`

**What you'll see:**

In Part 1, the dots *never print*. The `setInterval` callback is sitting in the
macrotask queue, but `countPrimes()` is on the call stack, grinding through two
million numbers. The event loop never gets a chance to process the interval.

In Part 2, dots print smoothly every 200ms while the worker crunches the same
numbers in a separate thread. The main thread's event loop is free. The progress
indicator works. The CLI stays responsive.

Same result. Same time. But the user experience is completely different.

---

## The Astranetra Connection

### `workers/scanWorker.js` — The Filesystem Crawler

Open `workers/scanWorker.js` (84 lines). This is where Astranetra's filesystem
scanning actually happens — not on the main thread.

```javascript
// workers/scanWorker.js — annotated

import { workerData, parentPort } from 'worker_threads';
// workerData: received from the main thread when this worker is spawned
// parentPort: the communication channel BACK to the main thread

const { rootDir, excludePaths, followSymlinks, sensitivePatterns } = workerData;
// The main thread passes configuration as plain data — no shared references

async function* walk(dir, depth = 0) {
  // async generator: yields nothing, but sends messages as side effects
  if (isExcluded(dir)) return;

  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
    // readdir is async I/O — the WORKER's event loop handles this efficiently
  } catch (e) {
    parentPort.postMessage({ type: 'inaccessible', path: dir, reason: e.code });
    // Can't read this directory? Tell the main thread, keep going
    return;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      parentPort.postMessage({ type: 'dir', path: fullPath, hidden });
      // Tell main thread: "found a directory"
      yield* walk(fullPath, depth + 1);
      // Recursion: dive deeper
    } else {
      const stat = await fs.promises.stat(fullPath);
      parentPort.postMessage({
        type: 'file',
        path: fullPath,
        name: entry.name,
        ext: path.extname(entry.name).toLowerCase(),
        sizeBytes: stat.size,
        mtimeMs: stat.mtimeMs,
        hidden,
        sensitive,
        symlink: false,
      });
      // Each file discovered = one message to main thread
    }
  }
}

// kick off
(async () => {
  for await (const _ of walk(rootDir)) {}
  parentPort.postMessage({ type: 'done' });
  // Final message: "I'm finished scanning"
})();
```

**The message protocol is simple:** every `postMessage` sends an object with a
`type` field. The main thread switches on this type:

| Message Type | Meaning | Data Included |
|---|---|---|
| `dir` | Found a directory | `path`, `hidden` |
| `file` | Found a file | `path`, `name`, `ext`, `sizeBytes`, `mtimeMs`, `hidden`, `sensitive`, `symlink` |
| `inaccessible` | Couldn't read a path | `path`, `reason` (error code) |
| `done` | Finished scanning | (nothing) |

This is a classic **producer-consumer** pattern. The worker produces file discovery
events. The main thread consumes them — updating stats, feeding the progress bar,
logging sensitive files.

### `workers/hashWorker.js` — The Hashing Engine

Open `workers/hashWorker.js` (31 lines). This is lean by design.

```javascript
// workers/hashWorker.js — annotated

import { workerData, parentPort } from 'worker_threads';
import fs from 'fs';
import crypto from 'crypto';

const { filePaths, algorithm } = workerData;
// Receives: an array of file paths to hash, and which algorithm to use

async function hashFile(filePath) {
  return new Promise((resolve) => {
    const hash   = crypto.createHash(algorithm || 'sha256');
    // Creates a Hash object — this is a Transform stream internally
    const stream = fs.createReadStream(filePath);
    // STREAMING: never loads the full file into memory
    // A 4GB file gets read in 64KB chunks — memory usage stays constant

    stream.on('error', (e) => {
      resolve({ path: filePath, hash: null, error: e.code || e.message });
      // File unreadable? Return null hash, don't crash the worker
    });

    stream.on('data', (chunk) => hash.update(chunk));
    // Each chunk gets fed into the SHA-256 state machine
    // This is the CPU-intensive part: 64 rounds of bitwise math per 512-bit block

    stream.on('end', () => {
      resolve({ path: filePath, hash: hash.digest('hex'), error: null });
      // Final hash: 64 hex characters (256 bits)
    });
  });
}

(async () => {
  for (const filePath of filePaths) {
    const result = await hashFile(filePath);
    parentPort.postMessage(result);
    // Each completed hash = one message to main thread
  }
  parentPort.postMessage({ done: true });
  // All files hashed — signal completion
})();
```

**Why streaming matters:** If `hashWorker` read entire files into memory with
`fs.readFileSync()`, hashing a 2GB video file would allocate 2GB of RAM. With
streaming (`createReadStream`), it reads 64KB at a time. The memory footprint is
constant regardless of file size. The worker can hash a 50GB file with 1MB of memory.

**Why the hashing is sequential *within* the worker:** Look at the `for` loop —
it `await`s each file before moving to the next. Why not hash all files in parallel?
Because hashing is CPU-bound. Running 100 concurrent hash operations on one thread
doesn't make them faster — they'd just compete for the same CPU core, thrashing the
cache, and each one would take longer.

### `core/FileScanner.js` — Spawning Scan Workers

Open `core/FileScanner.js`. Look at lines 56-64:

```javascript
// core/FileScanner.js — the spawning logic

await Promise.all(roots.map(rootDir => new Promise((resolve) => {
  const worker = new Worker(workerPath, {
    workerData: {
      rootDir,                                    // e.g., 'C:\\'
      excludePaths:      config.scan.excludePaths, // ['/proc', 'node_modules', ...]
      followSymlinks:    config.scan.followSymlinks,
      sensitivePatterns: config.scan.sensitivePatterns,
    },
  });
  // Each root directory gets its OWN worker thread
  // On Windows with roots: ['C:\\'] → one worker
  // On a multi-drive system → one worker per drive

  worker.on('message', (msg) => {
    // Main thread processes messages from all workers here
    // Updates stats, progress bar, logging — all on the main thread
    // This is lightweight work — just incrementing counters and updating UI
  });
})));
```

**Design decision:** One worker per root directory. On most systems, `roots` is
`['C:\\']` (Windows) or `['/home/username']` (Linux) — so that's just one scan
worker. The scanning itself is I/O-bound (reading directories from disk), not
CPU-bound, so one thread is sufficient. The disk is the bottleneck, not the CPU.

### `core/IntegrityMonitor.js` — True Parallelism

This is where it gets interesting. Open `core/IntegrityMonitor.js`, lines 31-54:

```javascript
// core/IntegrityMonitor.js — hashFilesParallel()

async function hashFilesParallel(filePaths, algorithm, workerCount = 4) {
  const chunkSize = Math.ceil(filePaths.length / workerCount);
  // 10,000 files ÷ 4 workers = 2,500 files per worker
  const chunks = [];
  for (let i = 0; i < filePaths.length; i += chunkSize) {
    chunks.push(filePaths.slice(i, i + chunkSize));
  }
  // chunks = [[file1..file2500], [file2501..file5000], ...]

  const results = {};

  await Promise.all(chunks.map(chunk => new Promise((resolve) => {
    const worker = new Worker(workerPath, {
      workerData: { filePaths: chunk, algorithm },
      // Each worker gets its SUBSET of files
    });
    worker.on('message', msg => {
      if (msg.done) return resolve();
      results[msg.path] = msg.hash;
      // Collect results from all workers into one object
    });
    worker.on('error', resolve);
    worker.on('exit', resolve);
  })));

  return results;
}
```

**THIS is true parallelism.** Four OS threads, each running its own V8 instance,
each crunching SHA-256 hashes on a different subset of files, all at the same time
on different CPU cores.

With 10,000 files and 4 workers, the total hashing time is approximately:

```
Time (parallel) ≈ Time (single-threaded) / 4 + overhead
```

In practice, it's closer to a 3–3.5x speedup due to:
- Worker spawn time (~1ms each)
- Message passing overhead (structured clone for each result)
- Uneven file sizes (some workers finish earlier)
- I/O contention (all workers reading from the same disk)

The config at `config/astranetra.config.js` line 23 sets the default:

```javascript
workerCount: 4,
```

Why 4? Most consumer CPUs have 4–8 cores. Using `os.cpus().length` workers sounds
smart, but on an 8-core machine, 8 workers would use 8 V8 instances, each consuming
~30MB of memory. That's 240MB just for workers. Diminishing returns from Amdahl's
Law means the speedup from 4→8 workers is marginal. Four is the pragmatic sweet spot.

---

## The Deeper Questions

### "Wait — isn't `async/await` threading?"

No. `async/await` is **cooperative scheduling on a single thread**.

When you write:

```javascript
const data = await fs.promises.readFile('big.txt');
```

The `await` pauses the *function*, not the thread. The event loop continues processing
other callbacks. When the file read completes (the OS signals libuv), the event loop
picks up the continuation (the code after `await`) and runs it.

At no point is a second JavaScript function executing simultaneously. It's like the
head waiter putting down Table 5's order form and picking up Table 8's. One human,
many tasks, no actual parallelism. Just very efficient juggling.

`worker_threads` is different: two V8 engines, two call stacks, two sets of code
running at the *exact same nanosecond* on two CPU cores.

### How Does libuv's Thread Pool Work?

libuv maintains a default pool of **4 threads** (configurable via the
`UV_THREADPOOL_SIZE` environment variable, max 1024). These threads handle operations
that don't have native async OS support:

- DNS lookups (`dns.lookup`)
- File system operations (`fs.readFile`, `fs.stat`, etc.)
- Some `crypto` operations
- `zlib` compression

When you call `fs.readFile()`, libuv may delegate it to a pool thread, which performs
the blocking `read()` system call, and then posts the result back to the event loop.
This is why Node "feels" async for file I/O even though file I/O on most OS's is
actually blocking at the kernel level.

**This is not the same as `worker_threads`.** libuv's pool threads run C code, not
JavaScript. You can't control them. They don't run your JS. `worker_threads` run
full V8 instances executing your JavaScript code.

### What Is a `SharedArrayBuffer`?

A `SharedArrayBuffer` is a fixed-size block of raw binary memory that can be
accessed by multiple threads simultaneously — both the main thread and any worker
threads. Unlike regular `postMessage`, no copy is made. Both threads see the same
bytes at the same memory address.

This is powerful but dangerous. Without coordination, two threads writing to the
same byte at the same time causes undefined behavior. That's why JavaScript provides
the `Atomics` object — functions like `Atomics.load()`, `Atomics.store()`,
`Atomics.wait()`, and `Atomics.notify()` that guarantee atomic (indivisible)
operations on shared memory.

Astranetra doesn't use `SharedArrayBuffer`. The message-passing model is simpler,
safer, and sufficient for its workload. But if you were building something like a
real-time physics engine in Node.js (unlikely, but bear with me), shared memory
would be essential for performance.

---

## Challenge Problem

Write a script that benchmarks the **actual speedup** of `worker_threads` for
hashing.

1. Generate 1,000 temporary files (each ~100KB of random data) in a temp directory
2. Hash all 1,000 files on the **main thread** sequentially — measure the time
3. Hash all 1,000 files using **2 workers** — measure the time
4. Hash all 1,000 files using **4 workers** — measure the time
5. Hash all 1,000 files using **8 workers** — measure the time
6. Print a table showing: worker count, total time, speedup ratio vs single-threaded

Then answer these questions from your results:
- Is the speedup linear? (Hint: it won't be. Why?)
- At what worker count do you stop seeing meaningful improvement?
- Does the speedup match what Amdahl's Law predicts?
- What happens if you increase file count to 10,000 but decrease size to 1KB?
  Does the overhead-to-work ratio change?

No solution provided. But if your 4-worker run is exactly 4x faster, something is
wrong with your benchmark.

---

> **Next Chapter: Persistence — How Programs Survive Reboots**
>
> You turn off your computer every night. Yet some programs are there again when you
> boot up. You didn't launch them. Nobody clicked anything. They just... started.
> How? The answer involves startup folders, registry keys, shell configs, and
> LaunchAgents — and Astranetra's `PersistenceEngine.js` demonstrates every one of
> them. Chapter 5 shows you exactly where programs hide to survive a reboot, and
> why your OS lets them.
