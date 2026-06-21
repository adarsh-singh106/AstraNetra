# Astranetra: Core CS Concepts

Welcome to the Astranetra Educational Series.

This documentation isn't just about how to use Astranetra. It is a deep-dive, first-principles exploration of the **Core Computer Science concepts** that make software—and malware—work at the silicon and OS level. 

We don't do surface-level explanations here. We don't hand-wave and say "the OS does it." If you are a curious, hungry computer science student who wants to know exactly *how* a Node.js script can map your hardware, steal your files, and survive a reboot, you are in the right place.

## Teaching Philosophy
- **First Principles:** We start with the hardware and the kernel, not the JavaScript.
- **Deep Mechanisms:** We explain inodes, system calls, virtual memory, and TCP handshakes.
- **Real Code Connections:** Every theoretical concept is directly tied to the actual `astranetra` source code with file paths and line numbers.
- **Experiments:** Every chapter includes a small, runnable script to prove the concepts on your own machine.

---

## 📚 Table of Contents

### Foundational Concepts
* **[Chapter 0: It's Not Magic](./chapter-00-its-not-magic.md)**
  Programs, OS, intent vs mechanism, and the compilation pipeline. Why a "virus" is literally just a text file.
* **[Chapter 1: The Conversation Between Code and Hardware](./chapter-01-system-calls.md)**
  System calls, kernel space vs user space, context switches, and how `os.cpus()` actually reaches your silicon.
* **[Chapter 2: The Filesystem Is a Lie](./chapter-02-filesystem.md)**
  Inodes, file descriptors, directory entries, and the VFS layer. Why folders don't really exist.

### Execution & Concurrency
* **[Chapter 3: Everything Is a Process](./chapter-03-processes.md)**
  Process Control Blocks, memory isolation, PIDs, `fork()`/`exec()`, and how the OS juggles 200 programs on 8 cores.
* **[Chapter 4: Threads Are Not Magic Either](./chapter-04-threads.md)**
  The single-threaded Event Loop vs OS-level `worker_threads`, message passing, and why true parallelism is hard.

### System Exploitation & Persistence
* **[Chapter 5: Persistence — How Programs Survive Reboots](./chapter-05-persistence.md)**
  The boot sequence, autostart registries, LaunchAgents, and how malware ensures it outlives a restart.
* **[Chapter 6: The PATH Variable Is a Security Hole](./chapter-06-path-hijacking.md)**
  Environment variables, command resolution order, and how manipulating PATH can intercept legitimate commands.

### Data Security & Exfiltration
* **[Chapter 7: Hashing — Fingerprinting Data](./chapter-07-hashing.md)**
  SHA-256, the avalanche effect, streaming hashes, and mathematically proving data integrity.
* **[Chapter 8: Networking Isn't Magic Either](./chapter-08-networking.md)**
  The OSI model, sockets, TCP three-way handshakes, and the anatomy of the HTTP requests that steal your data.
* **[Chapter 9: Databases — Structured Persistence](./chapter-09-databases.md)**
  SQLite, the relational model, B-tree indexing, ACID properties, and why JSON files fail at scale.

### The Grand Finale
* **[Chapter 10: Putting It Together — How a Real Virus Works](./chapter-10-putting-it-together.md)**
  Tracing the complete Astranetra pipeline: Reconnaissance → Scanning → Data Exfiltration → Persistence. The heist in motion.

---

*Written for the coder army. Step up to the next level.*
