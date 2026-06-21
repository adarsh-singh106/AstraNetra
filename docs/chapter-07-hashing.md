# Astranetra: Core CS Concepts

---

# Chapter 7 — Hashing: Fingerprinting Data

> **Reading time:** ~20 minutes
> **Prerequisites:** Chapter 1 (System Calls), Chapter 4 (Threads)
> **Next chapter:** Chapter 8 — Networking Isn't Magic Either

---

## The Hook

How do you know a file hasn't been tampered with? 

You can't memorize its contents. You can't compare it byte-by-byte every time, especially if it's a 4GB video file or a massive database backup. What if there was a way to take any file—no matter how large—and compress its entire essence into a tiny, 64-character string? A string that changes completely if even *one single byte* in the original file is altered?

That's a hash. And it's mathematically impossible to reverse.

When you run Astranetra's `integrity` command, it doesn't store copies of all your files to check if they change. It stores their *hashes*. This mathematical trick is the foundation of modern cybersecurity, passwords, blockchain, and digital forensics. It's time to understand how it works.

---

## The Mental Model — The Digital Fingerprint

Imagine a crime scene investigator taking a suspect's fingerprint. 

A fingerprint has unique properties:
1. Every person has a different fingerprint. (Practically speaking).
2. It's a tiny piece of information compared to the entire human body.
3. **Most importantly:** You cannot reconstruct the entire human being just from looking at the fingerprint.

A hash function is a digital fingerprint for data. 

You pass a file (the human) through a mathematical algorithm (the ink pad), and it outputs a fixed-length string (the fingerprint). You can't rebuild the original file from the hash. But if you have the file again tomorrow, you can run it through the algorithm and verify that it produces the *exact same* fingerprint. If the fingerprint is different, it's not the same person. If the hash is different, the file has been changed.

---

## The Mechanism — What Actually Happens

### What is a Hash Function?

In computer science, a hash function is any mathematical function that maps data of arbitrary size (like a 10-byte text file or a 50-gigabyte game) to fixed-size values (like exactly 256 bits).

But a **cryptographic** hash function is special. It must have five specific properties to be considered secure:

1. **Deterministic:** The same input must *always* produce the exact same output. No randomness.
2. **Avalanche Effect:** A tiny change in the input (like changing `Hello.` to `Hello!`) should change approximately 50% of the output bits. The outputs should look completely unrelated.
3. **Pre-image Resistance (One-Way):** If I give you a hash output, it should be computationally infeasible for you to guess the input that created it.
4. **Second Pre-image Resistance:** If I give you an input `A`, you cannot find a different input `B` that produces the same hash as `A`.
5. **Collision Resistance:** You cannot find *any* two different inputs that produce the same hash.

### Enter SHA-256

Astranetra uses **SHA-256** (Secure Hash Algorithm, 256-bit), designed by the NSA. It produces a 256-bit (32-byte) output, typically represented as 64 hexadecimal characters.

How does it work under the hood?

```
INPUT FILE → [Padding] → [Break into 512-bit Blocks]
                              │
                              ▼
                        [Block 1]
                              │
                   ┌──────────▼──────────┐
[Initial State] → │  64 Rounds of Math  │ → [New State]
                   └──────────┬──────────┘
                              │
                        [Block 2]
                              │
                   ┌──────────▼──────────┐
[New State]     → │  64 Rounds of Math  │ → [Next State]
                   └──────────┬──────────┘
                              ... (Repeats for all blocks)
                              │
                              ▼
                   FINAL 256-BIT HASH VALUE
```

1. **Padding:** The input data is padded so its length is a multiple of 512 bits.
2. **Blocks:** It's broken into 512-bit chunks.
3. **The Core Loop:** For each block, the algorithm takes the current "state" (starting with 8 hardcoded 32-bit constants) and mixes it with the block using 64 rounds of bitwise operations: `AND`, `OR`, `XOR`, bit-shifting, and modular addition.

### Why is it "One-Way"?

Why can't you just reverse the math? 

Because hashing **destroys information**. When you do modular addition (like adding numbers on a clock face: 10 + 4 = 2), you lose the original numbers. If I tell you the answer is 2, did I add 10+4? Or 1+1? Or 11+3? You can't know. 

Encryption is a two-way street (lossless). Hashing is a blender (lossy). You can't un-blend a smoothie back into a banana and an apple.

### Streaming: How to Hash a 100GB File on a 4GB RAM Laptop

If you want to hash a massive file, you can't load it all into memory first. Remember the SHA-256 diagram? It processes data in 512-bit chunks. 

This means you only need to load 512 bits of the file into memory at a time, mix it into the state, discard the 512 bits, and read the next chunk. This is called a **streaming hash**. It uses a constant amount of memory regardless of the file size.

### The Birthday Paradox and Collisions

Wait, if there are infinite possible files, but only a fixed number of SHA-256 hashes (2^256), doesn't that mean two files *must* share the same hash eventually?

Yes! This is called the Pigeonhole Principle. A collision *must* exist.

But 2^256 is an unfathomably large number. It's roughly the number of atoms in the known universe. To have a 50% chance of finding a collision (due to the Birthday Paradox), you would need to generate 2^128 hashes. That is 340,282,366,920,938,463,463,374,607,431,768,211,456 hashes. Even if every computer on Earth hashed a billion files a second for the lifetime of the universe, we wouldn't find one.

---

## The Experiment — The Avalanche Effect

Let's see it in action. Create a file called `hash_demo.js`:

```javascript
import crypto from 'crypto';

function hashText(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
}

console.log("=== THE AVALANCHE EFFECT ===");
const text1 = "Astranetra is an educational project.";
const text2 = "Astranetra is an educational project!"; // Changed the period to an exclamation mark

console.log(`Input 1: "${text1}"`);
console.log(`Hash 1:  ${hashText(text1)}\n`);

console.log(`Input 2: "${text2}"`);
console.log(`Hash 2:  ${hashText(text2)}\n`);

// Notice how literally EVERY character in the output changed, 
// even though we only changed 1 bit in the input.
```

Run it with `node hash_demo.js`. 

Look at the two hashes. They look completely unrelated. This is the avalanche effect. If an attacker modifies even a single byte of malware to try and bypass a signature detection, the hash completely transforms.

---

## The Astranetra Connection

Astranetra relies heavily on hashes for its `IntegrityMonitor.js` core module. 

When you run Astranetra, it needs to know if files on the system have been modified (or corrupted).

### 1. Streaming Hashes
In `workers/hashWorker.js` (lines 7-22), we use Node's `fs.createReadStream()` connected directly to the `crypto.createHash()` stream. 

```javascript
// workers/hashWorker.js snippet
function hashFile(filePath) {
    return new Promise((resolve) => {
        const hash = crypto.createHash(workerData.algorithm);
        // We do NOT use fs.readFileSync()! We stream it.
        const stream = fs.createReadStream(filePath);
        
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve({ path: filePath, hash: hash.digest('hex') }));
        // ...
    });
}
```
This is why Astranetra can hash massive log files without crashing your computer's RAM.

### 2. Parallel Distribution
Hashing is pure math. It is **CPU-bound**. If we hashed 10,000 files on the main thread, the Event Loop would freeze (as discussed in Chapter 4). 

In `core/IntegrityMonitor.js` (lines 31-54, `hashFilesParallel`), Astranetra splits the list of files into chunks and sends them to multiple background workers simultaneously. 

### 3. File Corruption Detection
If you use Astranetra's `crud corrupt` command (`CRUDEngine.js` line 140), it overwrites a file with random bytes. If you take a baseline snapshot before and after, `IntegrityMonitor.js` uses `diffSnapshots()` (line 115) to compare the JSON hash maps. It instantly detects the corruption because the SHA-256 hash changed.

---

## The Deeper Questions

1. **Password Storage:** You never store passwords in plaintext; you store their hashes. But if I know your hash is `5e884...` and I know `5e884...` is the hash for "password", I can guess it. How do modern systems protect against these "rainbow table" lookup attacks? (Hint: look up "password salting").
2. **Speed is bad:** SHA-256 is incredibly fast. For file verification, fast is good. For password verification, fast is *terrible*, because a hacker can guess billions of passwords a second. Why do systems use slow algorithms like `bcrypt` or `Argon2` instead of SHA-256 for passwords?
3. **Collisions:** MD5 and SHA-1 used to be the gold standard. Now they are considered "broken" because researchers found ways to intentionally create collisions. How does a hash function "break", and what does that mean for old software?

---

## Challenge Problem

Write a script that creates a "Proof of Work" system, similar to how Bitcoin mining works.

Using Node.js's `crypto` module, write a loop that tries to find a number (a "nonce") which, when appended to the string `"Astranetra_Block_1_"`, produces a SHA-256 hash that **starts with four zeros** (e.g., `0000a4f...`).

Example input to hash: `"Astranetra_Block_1_1"`, `"Astranetra_Block_1_2"`, etc.

Print the nonce that works, the resulting hash, and how long it took your CPU to find it. You've just performed mining.

---

> **Next Chapter: Networking Isn't Magic Either**
>
> Astranetra can scan your computer and find secrets. But stealing them means getting them *off* your computer. How does data actually travel from your JavaScript variable, through the operating system, out the network card, and across the world to an attacker's server? In Chapter 8, we trace a single HTTP POST request.
