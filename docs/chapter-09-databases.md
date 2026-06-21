# Astranetra: Core CS Concepts

---

# Chapter 9 — Databases: Structured Persistence

> **Reading time:** ~20 minutes
> **Prerequisites:** Chapter 2 (Filesystem)
> **Next chapter:** Chapter 10 — Putting It Together

---

## The Hook

Astranetra scans your system and finds 50,000 files, 200 sensitive credentials, and 8GB of data across 12 directories. It successfully exfiltrates this massive payload to the attacker's server. 

The server needs to save it. You might think: *"Easy. Just `JSON.stringify()` the data and write it to `scans.json`."*

For one scan, that works. But what about the *second* scan? The tenth? The ten-thousandth?

What if the attacker wants to ask the server: *"Find all `.pem` files discovered in the last 5 scans from Windows machines, sorted by file size."* 

Try doing *that* with a 40GB JSON file. Your server would crash instantly. This catastrophic failure of plain text files is exactly why Databases were invented.

---

## The Mental Model — The Filing Cabinet

A JSON file is like throwing all your company's paperwork into a giant cardboard box. It's technically all there. But if you want to find John's tax return from 2021, you have to dump the entire box on the floor and read every single piece of paper until you find it.

A database is a heavy-duty, steel **Filing Cabinet**. 
- It has labeled drawers (Tables). 
- It forces you to put specific forms in specific folders (Schemas).
- Most importantly, it has an **Index Card System** at the front. The index says: "Looking for John? Go straight to Drawer 3, Folder J." You find it instantly without touching the rest of the paperwork.

---

## The Mechanism — Why Not JSON?

Let's break down exactly why writing to a JSON file fails at scale. Here are five real problems:

1. **No Indexing:** To search a JSON file, the OS must read the *entire* file from the hard drive into RAM. If the file is 50GB and you have 16GB of RAM, your program crashes with an Out Of Memory (OOM) error.
2. **No Concurrent Access:** What if two infected computers send data at the exact same millisecond? Node.js tries to write both to `scans.json` simultaneously. The file gets corrupted. Half of computer A's JSON is mixed with half of computer B's JSON.
3. **No Schema Enforcement:** If one version of the malware sends `{ "hostname": "PC-1" }` and another sends `{ "host_name": "PC-1" }`, the JSON file accepts both blindly. Your data is now a chaotic mess.
4. **No Partial Reads:** If you just want to update *one* user's status out of 100,000, you have to parse the entire JSON file, change the one value, stringify all 100,000 users, and rewrite the whole file. 
5. **No Transactions:** If the power goes out while you are in the middle of rewriting that JSON file... the file is destroyed. Everything is gone.

### The Relational Model (Codd, 1970)

In 1970, Edgar F. Codd solved this by inventing the Relational Database. Data is organized strictly into **Tables** (relations). Tables have **Columns** (attributes like `hostname`, `platform`) and **Rows** (tuples, the actual data). 

Every row must have a unique identifier called a **Primary Key** (usually an auto-incrementing ID).

### Enter SQLite

Astranetra uses **SQLite**. Unlike huge enterprise databases like PostgreSQL or MySQL that run as separate background processes on dedicated servers, SQLite is an *embedded* database. 

It has no server. It runs entirely *inside* your Node.js process as a C library, and it stores the entire database in a single file on your hard drive (e.g., `astranetra.db`). Because it requires zero installation or configuration, it's the favorite database of mobile apps, embedded systems, and malware.

In Astranetra, we use `sql.js`, which is the SQLite C code compiled into WebAssembly. This allows us to run a full SQL database engine directly in Node.js without compiling native C bindings.

### SQL Basics

SQL (Structured Query Language) is how we talk to the database. Let's look at Astranetra's actual SQL:

**1. Defining the Structure (Schema):**
```sql
CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scanned_at TEXT,
    hostname TEXT,
    platform TEXT,
    total_files INTEGER,
    total_size INTEGER,
    hidden_count INTEGER,
    sensitive_count INTEGER,
    full_payload TEXT
);
```

**2. Inserting Data:**
```sql
INSERT INTO scans VALUES (
    NULL, 
    '2026-10-24T10:00:00Z', 
    'Adarsh-Laptop', 
    'win32', 
    14500, 
    1024000, 
    45, 
    3, 
    '{"files": [...] }'
);
```

**3. Querying Data:**
```sql
SELECT hostname, sensitive_count 
FROM scans 
WHERE platform = 'win32' 
ORDER BY sensitive_count DESC 
LIMIT 5;
```

### ACID Properties

Databases protect your data using ACID guarantees:

- **Atomicity:** A transaction is "all or nothing." If you are transferring money, you deduct from Account A and add to Account B. If the server crashes after the deduction but before the addition, the database rolls back the *entire* transaction. You never get stuck in a half-finished state.
- **Consistency:** The database strictly enforces its rules (like "total_files must be an integer"). It refuses invalid data.
- **Isolation:** If two users write at the exact same time, the database sequences them so they don't corrupt each other.
- **Durability:** Once the database says "OK, saved," it is written to the physical disk. A power outage 1 millisecond later will not erase it.

### B-Tree Indexing

How do databases find data so fast? Through a data structure called a **B-Tree** (Balanced Tree). 

Instead of searching from row 1 to row 1,000,000 (which takes `O(n)` time), the index organizes the data in a tree. The database asks: "Is the ID greater or less than 500,000?" Less. "Greater or less than 250,000?" Greater. 

By splitting the search space in half each time, it can find any record among millions in just 20 or 30 jumps (`O(log n)` time). This is why a database can query a 100GB table in milliseconds, while a JSON file would take minutes.

---

## The Experiment — Memory vs DB Speed

Let's test the speed difference between querying an array and querying SQLite.

Create `db_speed.js`:

```javascript
import initSqlJs from 'sql.js';

async function run() {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    
    // 1. Setup DB
    db.run("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, score INTEGER)");
    db.run("CREATE INDEX idx_score ON users(score)"); // The magic B-Tree!
    
    // 2. Setup Array
    const jsonArray = [];
    
    console.log("Generating 100,000 records...");
    
    // Insert 100k records into both
    db.run("BEGIN TRANSACTION");
    for(let i=0; i<100000; i++) {
        const score = Math.floor(Math.random() * 100000);
        db.run(`INSERT INTO users (username, score) VALUES ('user${i}', ${score})`);
        jsonArray.push({ id: i, username: `user${i}`, score: score });
    }
    db.run("COMMIT");
    
    // We want to find the exact record with a specific score
    const targetScore = 42042;
    
    // Test Array (Linear Search O(n))
    console.time("JSON Array Search");
    const foundArr = jsonArray.find(u => u.score === targetScore);
    console.timeEnd("JSON Array Search");
    
    // Test SQLite (B-Tree Index Search O(log n))
    console.time("SQLite Index Search");
    const result = db.exec(`SELECT * FROM users WHERE score = ${targetScore}`);
    console.timeEnd("SQLite Index Search");
}
run();
```

Run it. The SQLite search should be significantly faster, and as you increase the records to 10 million, the Array search will slow down linearly, while the SQLite search will remain almost instant.

---

## The Astranetra Connection

Astranetra uses dual-storage for exfiltration. In `core/ExfilEngine.js`, when data is collected, two things happen:

1. `postToServer()` (L55): It sends the data over the network via HTTP.
2. `writeToDb()` (L98): It saves it locally in SQLite.

Let's look at how Astranetra creates the DB:

```javascript
// core/ExfilEngine.js
async function getDb() {
    // ...
    // Because sql.js is a CommonJS module, we use createRequire 
    // to load it into our ESModule project
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const initSqlJs = require('sql.js');
    // ...
    
    const dbPath = config.exfil.dbPath; // 'db/astranetra.db'
    
    if (fs.existsSync(dbPath)) {
        const filebuffer = fs.readFileSync(dbPath);
        db = new SQL.Database(filebuffer); // Load existing DB from disk
    } else {
        db = new SQL.Database(); // Create new in-memory DB
        db.run(`CREATE TABLE scans (...)`); // Define Schema
    }
    return db;
}
```

Notice the `fs.readFileSync(dbPath)`. `sql.js` runs entirely in memory. To make it persistent (so it survives restarts), Astranetra must explicitly write the memory buffer back to the disk file (`saveDb()` at L48) after every insert! 

If you run Astranetra's CLI, you can interact with the DB directly:
- `node index.js db --list` (Executes the `SELECT` query at L130)
- `node index.js db --clear` (Executes the `DELETE` query at L143)

---

## The Deeper Questions

1. **Concurrency Limits:** SQLite locks the entire database file when writing. It doesn't handle thousands of simultaneous writes well. How do client-server databases like PostgreSQL solve this? (Look up Row-Level Locking).
2. **SQL Injection:** If Astranetra took input directly from a user and pasted it into a SQL string: `SELECT * FROM users WHERE name = '${userInput}'`, what happens if the user types `' OR 1=1; --`? How do "Prepared Statements" prevent this attack?
3. **Write-Ahead Logging (WAL):** When you write to a database, it doesn't immediately write to the main table. It writes to an append-only log file first. Why? How does this protect against power failures?

---

## Challenge Problem

Astranetra currently stores the entire filesystem scan as a giant JSON string inside the `full_payload` TEXT column. 

This violates the first rule of relational databases: **First Normal Form (1NF)**. You shouldn't store complex data structures inside a single column, because you can't query inside it.

Design (on paper or in SQL) a better schema. 
Create a `scans` table, a `directories` table, and a `files` table. Use Foreign Keys to link them together so that `files` belong to `directories`, and `directories` belong to `scans`. 

Write a `JOIN` query that finds all `.pem` files belonging to the scan ID 5.

---

> **Next Chapter: Putting It Together: How a Real Virus Works**
>
> You now know the individual pieces: System calls, the VFS layer, processes, threads, registries, PATH variables, hashing, HTTP, and SQL. Ten chapters of theory. In the grand finale, we trace a single execution of Astranetra, connecting every single concept from Chapter 1 to Chapter 9 into one devastating, automated pipeline.
