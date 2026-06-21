# Astranetra: Core CS Concepts

---

# Chapter 2 — The Filesystem Is a Lie

> **Reading time:** ~22 minutes
> **Prerequisites:** Chapter 1 (The Conversation Between Code and Hardware)
> **Next chapter:** Chapter 3 — Everything Is a Process

---

## The Hook

You've been saving files your whole life. You click Save, pick a folder, type a name.
Done. The file is "in" the folder now.

But where does the file actually go? Not the icon on your screen — the actual bytes.
The 1s and 0s. Where are they? And that folder you saved it "in" — is it a container?
Can you pour files into it? Does it have walls?

No. The folder doesn't exist. Not as a container, anyway. It doesn't "hold" anything.
What you think of as a folder is actually a very short file that contains a table. A
table of names. And each name points to a number. And that number points to your data.

The file's name isn't stored with the file. The file doesn't know its own name.

If that sounds wrong, good. By the end of this chapter, you'll understand exactly how
the filesystem works — from the bytes on disk to the `fs.readdirSync()` call in
JavaScript. And you'll understand why Astranetra's file scanner does what it does,
and why "hidden" files aren't hidden at all.

---

## The Mental Model — The Library

Imagine a large university library. Thousands of books on hundreds of shelves.

You want to find *Operating System Concepts* by Silberschatz. You don't wander the
aisles looking at every spine. You go to the **catalog system** — the computer at the
front desk. You type in the title. The catalog tells you: **Shelf 14, Position 7**.

Now notice something crucial:

- The **book itself** has no label saying "I am at Shelf 14, Position 7." The book is
  just pages. It doesn't know where it sits.
- The **catalog card** has the title, the shelf location, the page count, the author,
  the date of acquisition. The metadata is in the catalog, not on the book.
- The **shelf label** says "Shelf 14" — but the shelf is just a physical location. If
  someone moves the book to Shelf 9, the shelf doesn't care. Only the catalog needs
  to be updated.

Now the key insight: you can have **two catalog cards** pointing to the same book.
One says "Operating System Concepts → Shelf 14, Position 7." Another says
"Dinosaur Book → Shelf 14, Position 7." Two names. Same physical book.

This is exactly how a filesystem works:

- **Books** = the actual data blocks on your disk (the raw bytes of your file)
- **Catalog cards** = **inodes** (data structures that store all metadata about a file)
- **Shelf labels** = **directory entries** (names that point to inode numbers)
- **The catalog system** = the **VFS (Virtual Filesystem)** layer in the kernel

The book's title is not written on the book. The filename is not stored in the file.

---

## The Mechanism — How It Actually Works

### What Is an Inode?

An **inode** (index node) is a data structure stored on disk that contains everything
the OS needs to know about a file — except its name.

Here's what's actually inside an inode on a Linux ext4 filesystem:

```
┌──────────────────────────────────────────────────────────────┐
│                         INODE #48271                          │
├──────────────────────────────────────────────────────────────┤
│  mode        0100644  (regular file, rw-r--r--)              │
│  uid         1000     (owner's user ID)                      │
│  gid         1000     (owner's group ID)                     │
│  size        4096     (file size in bytes)                   │
│  link count  1        (how many directory entries point here)│
│                                                              │
│  atime       2025-06-20 14:30:22  (last ACCESS time)        │
│  mtime       2025-06-19 09:15:03  (last MODIFY time)        │
│  ctime       2025-06-19 09:15:03  (last STATUS CHANGE time) │
│                                                              │
│  block pointers:                                             │
│    direct[0]  → disk block 108442                            │
│    direct[1]  → disk block 108443                            │
│    direct[2]  → (empty)                                      │
│    ...                                                       │
│    indirect   → disk block 209001 (points to more blocks)   │
│    double_ind → (empty)                                      │
│    triple_ind → (empty)                                      │
│                                                              │
│  NOTICE: no filename stored here.                            │
└──────────────────────────────────────────────────────────────┘
```

Let's break this down field by field.

**`mode`** — This is a bitmask encoding two things: the file type (regular file,
directory, symlink, device, socket, pipe) and the permission bits (read/write/execute
for owner, group, others). The value `0100644` means: regular file (`0100000`),
owner can read and write (`6` = `rw-`), group and others can only read (`44` = `r--r--`).

**`uid` and `gid`** — The numeric user ID and group ID of the file's owner. Not the
username — the number. The mapping from numbers to usernames lives in `/etc/passwd`.

**`size`** — The file's size in bytes. When you right-click a file and see "4 KB," this
is where that number comes from.

**`link count`** — How many directory entries (hard links) point to this inode. This is
critical. When you "delete" a file, the OS decrements this count. The actual data blocks
are only freed when the link count reaches zero AND no process has the file open. We'll
come back to this when we talk about hard links.

### The Three Timestamps

Every inode has three timestamps, and most people confuse them:

- **`atime`** (access time) — Updated when the file's contents are READ. Even `cat`-ing
  a file updates atime. This is so expensive on busy filesystems that many Linux
  distributions mount with `noatime` or `relatime` to reduce disk writes.
- **`mtime`** (modification time) — Updated when the file's CONTENTS change. Writing
  new data to the file updates mtime. This is what `ls -l` shows by default.
- **`ctime`** (change time) — Updated when the file's METADATA changes. Renaming the
  file, changing permissions, changing ownership — these update ctime. Note: this is
  NOT "creation time." Linux ext4 traditionally had no creation time (there's now
  `btime`/birth time in ext4, but it's not widely exposed).

When Astranetra's scan worker calls `fs.promises.stat()` and reads `stat.mtimeMs`, it's
reading the mtime — the last time the file's contents were modified. This matters for
detecting recently changed files.

### Block Pointers — Where the Data Actually Lives

Your hard drive (or SSD) is divided into fixed-size **blocks** — typically 4096 bytes
(4 KB) each. A file's data is stored across one or more of these blocks. The inode's
block pointers tell the OS which specific blocks on disk contain this file's data.

For small files, the **direct pointers** (typically 12 of them) each point to one block.
12 × 4 KB = 48 KB. So files under 48 KB can be addressed directly.

For larger files, the inode uses **indirect pointers**:
- **Single indirect**: Points to a block that contains more block pointers. One
  block can hold ~1024 pointers (4096 bytes ÷ 4 bytes per pointer). That's another
  4 MB of data.
- **Double indirect**: Points to a block of pointers to blocks of pointers. ~4 GB.
- **Triple indirect**: Another level. ~4 TB.

```
  INODE
  ┌─────────────┐
  │ direct[0] ──────► [data block]
  │ direct[1] ──────► [data block]
  │ ...            │
  │ direct[11]─────► [data block]
  │               │
  │ indirect ──────► [pointer block] ──► [data block]
  │               │                  ──► [data block]
  │               │                  ──► [data block]
  │               │
  │ double_ind ───► [ptr block] ──► [ptr block] ──► [data block]
  │               │             ──► [ptr block] ──► [data block]
  │               │
  │ triple_ind ───► (same idea, one more level)
  └─────────────┘
```

This is how the OS knows which blocks on disk belong to which file. The inode is the
map. Without it, the blocks are just anonymous chunks of bytes with no structure.

### ext4 Block Groups — How the Disk Is Organized

On an ext4 filesystem (the most common Linux filesystem), the entire disk is divided
into **block groups**. Each block group contains:

1. A copy of the **superblock** (or a backup of it) — metadata about the entire
   filesystem: total size, block size, number of inodes, free block count
2. **Group descriptors** — where to find the bitmap and inode table for this group
3. A **block bitmap** — one bit per block, 1 = used, 0 = free
4. An **inode bitmap** — one bit per inode, 1 = used, 0 = free
5. The **inode table** — the actual array of inode structures for this group
6. The **data blocks** — the actual file content

This grouping is a performance optimization. By keeping a file's inode and its data
blocks in the same block group, the disk head (on HDDs) doesn't have to seek across
the entire disk to read a file. The inode and its data are physically close together.

### What Is a Directory?

Here's the misconception: **a directory is not a container.** A directory does not
"hold" files. A directory is a file. Specifically, it's a special type of file whose
contents are a table mapping names to inode numbers.

```
┌───────────────────────────────────────────────┐
│           DIRECTORY "/home/adarsh/projects"    │
│         (inode #1047, type: directory)         │
├─────────────────────┬─────────────────────────┤
│  Name               │  Inode Number            │
├─────────────────────┼─────────────────────────┤
│  .                  │  1047  (self)            │
│  ..                 │  1001  (parent)          │
│  readme.md          │  48271                   │
│  index.js           │  48272                   │
│  .env               │  48280                   │
│  .git               │  48300  (directory)      │
│  node_modules       │  49000  (directory)      │
└─────────────────────┴─────────────────────────┘
```

Every directory contains at least two special entries:
- `.` (dot) — points to the directory's own inode. This is why `cd .` takes you
  nowhere: you're "changing" to the same directory.
- `..` (dot-dot) — points to the parent directory's inode. This is how `cd ..` works:
  the kernel looks up `..` in the current directory's table to find the parent's inode.

When you "create a file" in a directory, what actually happens is:
1. The kernel allocates a new inode from the inode bitmap
2. The kernel allocates data blocks from the block bitmap
3. The kernel writes a new row into the directory's table: `("myfile.txt", inode_number)`
4. The directory's mtime is updated (its contents changed)

The file doesn't "go into" the directory. The directory gets a new row in its table
that points to the file's inode. The file's data can be anywhere on disk.

### What Is a File Descriptor?

When your program opens a file, the kernel doesn't hand you the inode directly. It
gives you a **file descriptor** — a small integer (like 3, 4, 5) that acts as a handle.

```
┌─────────────────────────────────────────────────────────────────────┐
│                     YOUR PROCESS (PID 4521)                         │
│                                                                     │
│  File Descriptor Table (per-process):                               │
│  ┌──────┬──────────────────────────────────────────────────────┐    │
│  │  FD  │  Points to (in kernel's open file table)             │    │
│  ├──────┼──────────────────────────────────────────────────────┤    │
│  │   0  │  stdin  (keyboard input)                             │    │
│  │   1  │  stdout (terminal output)                            │    │
│  │   2  │  stderr (error output)                               │    │
│  │   3  │  /home/adarsh/data.txt (read, offset=0, inode=48271)│    │
│  │   4  │  /tmp/log.txt (write, offset=1024, inode=91003)     │    │
│  └──────┴──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

File descriptors 0, 1, and 2 are always pre-opened: stdin, stdout, stderr. When you
call `console.log()`, Node.js writes to file descriptor 1. When your program opens a
file with `fs.openSync()`, the kernel returns the next available FD (usually 3).

The FD is process-local. FD 3 in your process might point to `data.txt`. FD 3 in
another process points to something completely different. The kernel maintains a
separate FD table for every running process.

Behind the FD, the kernel maintains two more tables:
- **Open file table** (system-wide): tracks the current read/write offset, access mode,
  and a pointer to the inode
- **Inode table** (in memory): cached copy of the on-disk inode

So: `FD (per-process) → open file entry (system-wide) → inode (on disk)`. Three levels
of indirection to read a file.

### The VFS — One Interface to Rule Them All

Your Linux machine might have an ext4 partition, an NTFS external drive, a `/proc`
virtual filesystem, and `/tmp` mounted as tmpfs (backed by RAM, not disk). All of these
are completely different. ext4 stores data in block groups. NTFS uses a Master File
Table. procfs has no disk at all — the kernel generates content on the fly. tmpfs
lives entirely in RAM.

But when you call `fs.readdirSync('/proc')`, it works the same as
`fs.readdirSync('/home')`. How?

The **VFS (Virtual Filesystem Switch)** is a layer in the kernel that defines a
standard interface — a set of operations every filesystem must implement:

```
┌─────────────────────────────────────────────────────┐
│               YOUR PROGRAM (Node.js)                 │
│                                                      │
│      fs.readdirSync()  fs.statSync()  fs.openSync()  │
│                         │                            │
├─────────────────────────┼────────────────────────────┤
│                    VFS LAYER                          │
│                                                      │
│   Defines standard operations:                       │
│   - lookup()  - readdir()  - read()  - write()      │
│   - stat()    - create()   - unlink() - mkdir()     │
│                         │                            │
├──────────┬──────────┬───┴───────┬───────────────────┤
│   ext4   │   NTFS   │  procfs   │   tmpfs            │
│  driver  │  driver  │  driver   │   driver           │
│          │          │           │                     │
│ (disk)   │ (disk)   │ (kernel   │  (RAM)             │
│          │          │  memory)  │                     │
└──────────┴──────────┴───────────┴───────────────────┘
```

Each filesystem driver implements the VFS operations in its own way. ext4's `readdir`
reads directory entries from disk blocks. procfs's `readdir` generates entries from
kernel data structures. tmpfs's `readdir` reads from RAM. But to your program, they
all look the same: you call `readdir()`, you get a list of names.

This is why Astranetra can scan `/proc` and `/home` with the same code. The VFS
abstracts the differences away.

### Hard Links vs Soft Links

**Hard link:** Two directory entries pointing to the SAME inode.

```
Directory /home/adarsh:              Directory /home/adarsh/backup:
┌──────────────┬────────┐           ┌──────────────┬────────┐
│ notes.txt    │ 48271  │           │ notes_bak    │ 48271  │
└──────────────┴────────┘           └──────────────┴────────┘
                   │                          │
                   └──────────┬───────────────┘
                              ▼
                    ┌─────────────────┐
                    │   INODE 48271   │
                    │   link_count: 2 │
                    │   size: 2048    │
                    │   blocks: ...   │
                    └─────────────────┘
```

Both names point to the same inode. The inode's link count is 2. If you delete
`notes.txt`, the link count drops to 1 — but the inode and its data blocks remain.
`notes_bak` still works perfectly. The data is only freed when the link count hits 0.

Hard links cannot cross filesystem boundaries (because inode numbers are
filesystem-local) and cannot point to directories (to prevent infinite loops in the
directory tree).

**Soft link (symbolic link):** A separate file whose contents are a path string.

```
Directory /home/adarsh:
┌──────────────┬────────┐
│ shortcut     │ 50100  │ ← different inode!
└──────────────┴────────┘
         │
         ▼
┌─────────────────────────┐
│    INODE 50100          │
│    type: symlink        │
│    data: "/home/adarsh/ │
│           notes.txt"    │
└─────────────────────────┘
         │ (kernel follows the path)
         ▼
┌─────────────────┐
│   INODE 48271   │
│   (actual data) │
└─────────────────┘
```

The symlink is its own file with its own inode. Its "contents" are just a path string.
When the kernel encounters a symlink, it reads the path and starts over. If the target
is deleted, the symlink becomes a **dangling link** — it points to nothing.

In Astranetra's scan worker (line 47-50), symlinks are detected but not followed by
default (`followSymlinks: false` in config). This prevents infinite loops — imagine a
symlink pointing to its parent directory. The walker would loop forever.

### What `fs.readdirSync()` Actually Does

When you call `fs.readdirSync('/home/adarsh/projects')`, here's the real sequence:

```
JavaScript                 Node.js (C++)           Kernel
   │                           │                      │
   │  fs.readdirSync(path)     │                      │
   │ ────────────────────────► │                      │
   │                           │  open() syscall      │
   │                           │ ───────────────────► │
   │                           │                      │ VFS looks up path
   │                           │                      │ component by component:
   │                           │                      │ "/" → inode 2
   │                           │                      │ "home" → inode 1001
   │                           │                      │ "adarsh" → inode 1042
   │                           │                      │ "projects" → inode 1047
   │                           │                      │
   │                           │  ◄─────────────────  │ returns FD
   │                           │                      │
   │                           │  getdents64() syscall│
   │                           │ ───────────────────► │
   │                           │                      │ reads inode 1047's data
   │                           │                      │ blocks (the directory table)
   │                           │                      │ returns entries:
   │                           │                      │ (".", 1047)
   │                           │                      │ ("..", 1001)
   │                           │                      │ ("readme.md", 48271)
   │                           │                      │ (".env", 48280)
   │                           │                      │ ...
   │                           │  ◄─────────────────  │
   │                           │                      │
   │                           │  close() syscall     │
   │                           │ ───────────────────► │
   │  ◄────────────────────────│                      │
   │                           │                      │
   │  ["readme.md", ".env", ...]                      │
   │  (Node strips "." and ".." and returns names)    │
```

The actual system call is `getdents64` on Linux (get directory entries, 64-bit). It
doesn't return file sizes, permissions, or any metadata — just names and inode numbers.
Node.js strips the inode numbers and `.`/`..` entries, and gives you a clean array of
name strings.

This is why `readdir()` is fast but you need a separate `stat()` call for each file to
get its size, timestamps, or permissions. Two different system calls, two different
purposes. `readdir` reads the directory table. `stat` reads the inode.

### Hidden Files — A Convention, Not a Feature

On Unix/Linux/macOS, a "hidden" file is any file whose name starts with `.` (a dot).
That's it. There's no hidden flag, no special attribute, no metadata bit. The file is
completely normal. The `ls` command simply skips names starting with `.` by default. Run
`ls -a` and they appear. They were always there.

This is a **convention** dating back to early Unix. Legend has it that `ls` was coded to
skip `.` and `..` (the current and parent directory entries), and the programmer used
`if (name[0] == '.')` to do it. This accidentally hid ALL dot-prefixed files. People
started using this as a feature, and it stuck.

On Windows, it's different. NTFS stores a **file attribute flag** in the Master File
Table (MFT) entry. The `FILE_ATTRIBUTE_HIDDEN` bit (0x2) is set in the file's metadata.
Explorer checks this bit to decide whether to show the file. This is a filesystem-level
feature, not a naming convention.

`fs.readdirSync()` returns ALL entries regardless of hidden status, on both platforms.
It doesn't care about naming conventions or attribute flags. It reads the directory
table and gives you everything. Hiding is a UI decision, not a filesystem one.

This is exactly why Astranetra can find your `.env` files, your `.ssh` keys, your
`.netrc` credentials. They're not hidden from programs. They're hidden from `ls` and
Explorer. Astranetra doesn't use `ls`. It uses `readdir`.

### Recursive Traversal — Walking the Tree

A filesystem is a tree of directories. Each directory is an inode whose data contains
a table of entries. Some of those entries point to other directories (more inodes with
more tables). Recursive traversal means: open a directory, read its entries, and for
every entry that is itself a directory, repeat the process.

```
  /home/adarsh/
       │
       ├── projects/           (inode 1047, type: dir)
       │     ├── app.js        (inode 48272, type: file)
       │     ├── .env          (inode 48280, type: file)
       │     └── src/          (inode 48290, type: dir)
       │           ├── main.js (inode 48291, type: file)
       │           └── utils/  (inode 48300, type: dir)
       │                 └── helper.js (inode 48301, type: file)
       │
       └── .ssh/               (inode 1050, type: dir)
             ├── id_rsa        (inode 1051, type: file)
             └── config        (inode 1052, type: file)

  Traversal order (depth-first):
  1. readdir("/home/adarsh/")         → [projects, .ssh]
  2. readdir("/home/adarsh/projects") → [app.js, .env, src]
  3. readdir(".../projects/src")      → [main.js, utils]
  4. readdir(".../src/utils")         → [helper.js]
  5. readdir("/home/adarsh/.ssh")     → [id_rsa, config]
```

Each `readdir` is a system call. Each `stat` for file metadata is another system call.
For a directory tree with 100,000 files, that's at least 200,000 system calls. This is
why Astranetra uses worker threads for scanning — to parallelize these kernel
round-trips across multiple CPU cores. (Chapter 4 covers this in depth.)

---

## The Experiment — Hard Links Are Mind-Blowing

Don't run Astranetra yet. Write this from scratch in a new file called `inode_demo.js`:

```javascript
import fs from 'fs';
import path from 'path';

// ── Part 1: Create a file and inspect its inode ─────────────────────────────

const testFile = path.join(process.cwd(), 'inode_test_original.txt');
fs.writeFileSync(testFile, 'Hello from the original file!\n');

const stat1 = fs.statSync(testFile);
console.log('=== ORIGINAL FILE ===');
console.log(`Path:       ${testFile}`);
console.log(`Inode:      ${stat1.ino}`);           // ← the actual inode number
console.log(`Size:       ${stat1.size} bytes`);
console.log(`Hard links: ${stat1.nlink}`);          // ← should be 1
console.log(`Modified:   ${stat1.mtime.toISOString()}`);  // ← mtime
console.log(`Changed:    ${stat1.ctime.toISOString()}`);  // ← ctime (metadata)

// ── Part 2: Create a hard link ──────────────────────────────────────────────

const hardLink = path.join(process.cwd(), 'inode_test_hardlink.txt');
fs.linkSync(testFile, hardLink);  // ← creates a hard link (new name, SAME inode)

const stat2 = fs.statSync(hardLink);
console.log('\n=== HARD LINK ===');
console.log(`Path:       ${hardLink}`);
console.log(`Inode:      ${stat2.ino}`);            // ← SAME inode number!
console.log(`Hard links: ${stat2.nlink}`);           // ← now 2

// Prove they share the same inode
console.log(`\nSame inode? ${stat1.ino === stat2.ino}`);  // true

// ── Part 3: Delete the original — the hard link STILL WORKS ─────────────────

fs.unlinkSync(testFile);  // "delete" the original
// ↑ unlink() just removes the directory entry and decrements the link count
// The inode and data blocks are NOT freed because link count is still 1

console.log('\n=== AFTER DELETING ORIGINAL ===');
console.log(`Original exists? ${fs.existsSync(testFile)}`);     // false
console.log(`Hard link exists? ${fs.existsSync(hardLink)}`);     // true!
console.log(`Hard link content: ${fs.readFileSync(hardLink, 'utf8').trim()}`);

const stat3 = fs.statSync(hardLink);
console.log(`Hard links remaining: ${stat3.nlink}`);              // back to 1

// ── Part 4: Clean up ────────────────────────────────────────────────────────

fs.unlinkSync(hardLink);
// NOW link count is 0, and the kernel frees the inode and data blocks
console.log('\nCleaned up. Both entries removed. Inode freed.');
```

Run it: `node inode_demo.js`

**The mind-blowing part:** After deleting the original file, the hard link still works.
You can read its contents. The data is still on disk. The "file" was never "in" the
original path — the path was just a name in a directory table that pointed to an inode.
Delete the name, the inode remains. Delete ALL names pointing to the inode (link count
reaches 0), and only then does the kernel free the data blocks.

Note: on Windows, `stat.ino` returns a value but hard links behave slightly differently
due to NTFS. The experiment still demonstrates the concept — the file persists after the
original name is removed.

---

## The Astranetra Connection

Open `workers/scanWorker.js`. This file is a masterclass in filesystem traversal.

### The Walk Function (Lines 28–77)

```javascript
// workers/scanWorker.js — annotated

async function* walk(dir, depth = 0) {
  // walk() is an async generator — it yields control after each entry,
  // allowing the event loop to breathe during deep traversals
  
  if (isExcluded(dir)) return;
  // ↑ Skip excluded paths (like /proc, /sys, node_modules) before even
  //   calling readdir. This saves system calls on paths we'll ignore.

  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
    // ↑ { withFileTypes: true } makes readdir return Dirent objects instead
    //   of plain strings. A Dirent tells you if the entry is a file, directory,
    //   or symlink WITHOUT needing a separate stat() call.
    //   This is a performance optimization — it avoids one syscall per entry.
  } catch (e) {
    parentPort.postMessage({ type: 'inaccessible', path: dir, reason: e.code });
    // ↑ Permission denied (EACCES) or path doesn't exist (ENOENT).
    //   The scanner doesn't crash — it reports the failure and moves on.
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    // ↑ Reconstruct full path: directory's path + entry's name.
    //   Remember: the directory table only stores names, not full paths.

    if (isExcluded(fullPath)) continue;

    const hidden    = isHidden(entry.name, fullPath);
    const sensitive = isSensitive(entry.name);

    if (entry.isDirectory()) {
      parentPort.postMessage({ type: 'dir', path: fullPath, hidden });
      yield* walk(fullPath, depth + 1);
      // ↑ Recursive call: open THIS directory's inode, read ITS table,
      //   and repeat for each subdirectory found. This is the tree walk.
    } else {
      let sizeBytes = 0;
      let mtimeMs   = 0;
      try {
        const stat = await fs.promises.stat(fullPath);
        // ↑ SEPARATE syscall to get the inode metadata.
        //   readdir gave us the name. stat gives us size, timestamps, etc.
        sizeBytes = stat.size;
        mtimeMs   = stat.mtimeMs;
      } catch (_) {}

      parentPort.postMessage({
        type: 'file', path: fullPath, name: entry.name,
        ext: path.extname(entry.name).toLowerCase(),
        sizeBytes, mtimeMs, hidden, sensitive, symlink: false,
      });
    }
  }
}
```

### The Hidden File Check (Lines 15–21)

```javascript
function isHidden(name, filePath) {
  if (process.platform !== 'win32') {
    return name.startsWith('.');
    // ↑ THIS is the Unix convention we just explained.
    //   It's literally just checking the first character of the name.
    //   No filesystem query. No attribute flag. Just a string check.
  }
  return name.startsWith('.');
  // ↑ On Windows, this is a heuristic — it catches .env, .git, .ssh
  //   but misses files hidden via the NTFS attribute flag.
  //   A thorough check would call fswin.getAttributes() or PowerShell.
}
```

### The Sensitive File Check (Lines 23–26)

```javascript
function isSensitive(name) {
  const lower = name.toLowerCase();
  return sensitivePatterns.some(p => lower.includes(p.toLowerCase()));
  // ↑ Checks against: .env, .pem, .key, id_rsa, id_ed25519,
  //   .p12, credentials, .netrc, .npmrc, htpasswd
  //   These are files that contain secrets — API keys, private keys,
  //   authentication tokens. They're often dotfiles (hidden by convention)
  //   which is exactly why they're dangerous: users forget they exist.
}
```

### The FileScanner Orchestrator (core/FileScanner.js, Lines 56–64)

```javascript
await Promise.all(roots.map(rootDir => new Promise((resolve) => {
  const worker = new Worker(workerPath, {
    workerData: {
      rootDir,                          // 'C:\\' on Windows, home dir on Linux
      excludePaths:      config.scan.excludePaths,
      followSymlinks:    config.scan.followSymlinks,
      sensitivePatterns: config.scan.sensitivePatterns,
    },
  });
  // ↑ One Worker thread per root directory.
  //   On Windows, rootDir is 'C:\\' — the scan starts at the root of the
  //   filesystem. On Linux/macOS, it starts at the user's home directory.
  //   Each worker runs its own walk() generator independently.
})));
```

The config in `astranetra.config.js` makes the platform difference explicit:

```javascript
scan: {
  roots: {
    win32:  ['C:\\'],      // scan the entire C: drive
    linux:  [home],        // scan user's home directory
    darwin: [home],        // scan user's home directory
  },
  sensitivePatterns: [
    '.env', '.pem', '.key', 'id_rsa', 'id_ed25519',
    '.p12', 'credentials', '.netrc', '.npmrc', 'htpasswd',
  ],
}
```

**What breaks if you remove the filesystem layer?** Everything. `readdir` can't list
files. `stat` can't get metadata. The walk function has nothing to walk. Astranetra's
entire scanning engine — the part that finds your hidden `.env` files, your SSH keys,
your credential files — is built on top of the exact inode→directory→readdir→stat
pipeline described in this chapter. Without understanding this pipeline, you can't
understand why the scanner is structured the way it is: why `readdir` and `stat` are
separate calls, why `withFileTypes` is an optimization, why symlinks need special
handling, why the scanner survives permission errors without crashing.

---

## The Deeper Questions

These are things this chapter didn't answer. You'll want to know:

**1. How does the OS know which blocks on disk belong to which file?**
We covered this — block pointers in the inode. But what happens when a file is
fragmented? When its blocks are scattered across the disk? ext4 uses **extents** (a more
efficient version of block pointers that stores contiguous ranges instead of individual
block addresses). On HDDs, fragmentation causes the read head to seek back and forth,
slowing reads. On SSDs, it barely matters because there's no physical read head. This
is why "defragmenting" an SSD is pointless and actually wears it out faster.

**2. What happens when two programs open the same file simultaneously?**
Each program gets its own file descriptor, its own entry in the open file table (with
its own read/write offset), but both entries point to the same inode. If one program
writes, the other sees the changes — but only after the write is flushed to disk. This
is the root cause of race conditions in file I/O, and it's why databases use file locks.
Chapter 3 touches on this when we talk about processes and their isolated memory spaces.

**3. Why can't you delete a file that's "in use" on Windows?**
On Windows, NTFS holds an **oplock** (opportunistic lock) on open files. The OS refuses
to delete a file while any process has an open handle to it — you get "file is in use by
another program." On Linux, this never happens. `unlink()` removes the directory entry
immediately. The inode (and its data) persists until the last file descriptor pointing
to it is closed. The program that had the file open can keep reading and writing to it
even after the name is gone. Two fundamentally different design philosophies.

---

## Challenge Problem

Write a script that measures the cost of `readdir()` vs `stat()`.

Use `process.hrtime.bigint()` for nanosecond precision. Scan a directory with at least
100 files. Measure: how long does one `readdirSync()` call take to get all names? Then
call `statSync()` on each returned name individually. Calculate: what fraction of the
total scan time is spent on `readdir` vs `stat`?

Then try `readdirSync(dir, { withFileTypes: true })` — this batches some metadata
retrieval into the readdir call itself. Is it faster than readdir + N separate stat
calls? By how much?

No solution given. But the ratio will tell you exactly why Astranetra uses
`{ withFileTypes: true }` instead of calling stat on every entry.

---

> **Next Chapter: Everything Is a Process**
>
> You know what a file is now. But who's reading it? When Astranetra scans your disk,
> "Astranetra" isn't doing the scanning — a **process** is. A process with a PID, a
> memory space, a file descriptor table (you just learned about those), and a limited
> lifetime. Chapter 3 explains what a process actually is, how the OS juggles thousands
> of them, and why `child_process.exec()` in Astranetra spawns an entirely separate
> instance of your operating system's shell just to run one command.
