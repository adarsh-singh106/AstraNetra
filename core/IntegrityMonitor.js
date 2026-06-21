import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { getLogger } from '../output/Logger.js';
import config from '../config/astranetra.config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logger    = getLogger();

function humanBytes(b) {
  if (!b) return '0 B';
  const u = ['B','KB','MB','GB','TB'];
  const i = Math.floor(Math.log(Math.max(b,1)) / Math.log(1024));
  return `${(b/Math.pow(1024,i)).toFixed(2)} ${u[i]}`;
}

// ── HASH SINGLE FILE (stream, no full load) ───────────────────────────────────
function hashFile(filePath, algorithm = 'sha256') {
  return new Promise((resolve) => {
    const hash   = crypto.createHash(algorithm);
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => resolve(null));
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

// ── PARALLEL HASH via worker_threads ─────────────────────────────────────────
async function hashFilesParallel(filePaths, algorithm, workerCount = 4) {
  const workerPath = path.join(__dirname, '..', 'workers', 'hashWorker.js');
  const chunkSize  = Math.ceil(filePaths.length / workerCount);
  const chunks     = [];
  for (let i = 0; i < filePaths.length; i += chunkSize) {
    chunks.push(filePaths.slice(i, i + chunkSize));
  }

  const results = {};

  await Promise.all(chunks.map(chunk => new Promise((resolve) => {
    const worker = new Worker(workerPath, {
      workerData: { filePaths: chunk, algorithm },
    });
    worker.on('message', msg => {
      if (msg.done) return resolve();
      results[msg.path] = msg.hash;
    });
    worker.on('error', resolve);
    worker.on('exit', resolve);
  })));

  return results;
}

// ── WALK a directory recursively ──────────────────────────────────────────────
async function* walkDir(dir) {
  let entries;
  try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); }
  catch (_) { return; }

  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walkDir(full);
    else if (e.isFile()) yield full;
  }
}

// ── BASELINE SNAPSHOT ─────────────────────────────────────────────────────────
export async function createBaseline(targetDir) {
  const algorithm = config.integrity.algorithm;
  const snapDir   = config.integrity.snapshotDir;
  fs.mkdirSync(snapDir, { recursive: true });

  const dir = path.resolve(targetDir || process.cwd());
  logger.info('IntegrityMonitor', 'BASELINE_START', { dir, algorithm });
  console.log(`\x1b[35m[INTEGRITY]\x1b[0m Creating baseline for: ${dir}`);

  const filePaths = [];
  for await (const fp of walkDir(dir)) filePaths.push(fp);

  console.log(`\x1b[36m[INTEGRITY]\x1b[0m Hashing ${filePaths.length} files...`);
  const hashes = await hashFilesParallel(filePaths, algorithm, config.scan.workerCount);

  const entries = {};
  for (const fp of filePaths) {
    try {
      const stat = fs.statSync(fp);
      entries[fp] = {
        hash:         hashes[fp] || null,
        sizeBytes:    stat.size,
        lastModified: stat.mtime.toISOString(),
      };
    } catch (_) {}
  }

  const snapshot = {
    createdAt:  new Date().toISOString(),
    algorithm,
    targetDir:  dir,
    totalFiles: Object.keys(entries).length,
    entries,
  };

  const ts   = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(snapDir, `${ts}.snapshot.json`);
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 2), 'utf8');

  logger.info('IntegrityMonitor', 'BASELINE_CREATED', { file, totalFiles: snapshot.totalFiles });
  console.log(`\x1b[32m✓ Snapshot saved:\x1b[0m ${file}`);
  return { file, snapshot };
}

// ── DIFF TWO SNAPSHOTS ────────────────────────────────────────────────────────
export function diffSnapshots(snap1Path, snap2Path) {
  const s1 = JSON.parse(fs.readFileSync(snap1Path, 'utf8'));
  const s2 = JSON.parse(fs.readFileSync(snap2Path, 'utf8'));

  const e1 = s1.entries || {};
  const e2 = s2.entries || {};
  const all = new Set([...Object.keys(e1), ...Object.keys(e2)]);

  const diff = { newFiles: [], deletedFiles: [], modifiedFiles: [], unchanged: 0 };

  for (const fp of all) {
    if (!e1[fp]) {
      diff.newFiles.push({ path: fp, hash: e2[fp]?.hash, size: e2[fp]?.sizeBytes });
    } else if (!e2[fp]) {
      diff.deletedFiles.push({ path: fp, lastKnownHash: e1[fp].hash, lastKnownSize: e1[fp].sizeBytes });
    } else if (e1[fp].hash !== e2[fp].hash) {
      diff.modifiedFiles.push({
        path:      fp,
        oldHash:   e1[fp].hash,
        newHash:   e2[fp].hash,
        oldSize:   e1[fp].sizeBytes,
        newSize:   e2[fp].sizeBytes,
        sizeDelta: (e2[fp].sizeBytes || 0) - (e1[fp].sizeBytes || 0),
      });
    } else {
      diff.unchanged++;
    }
  }

  logger.info('IntegrityMonitor', 'DIFF_COMPLETE', {
    newFiles:      diff.newFiles.length,
    deletedFiles:  diff.deletedFiles.length,
    modifiedFiles: diff.modifiedFiles.length,
    unchanged:     diff.unchanged,
  });

  console.log('\n\x1b[35m━━━ INTEGRITY DIFF ━━━\x1b[0m');
  console.log(`\x1b[32m  New files:      ${diff.newFiles.length}\x1b[0m`);
  console.log(`\x1b[31m  Deleted files:  ${diff.deletedFiles.length}\x1b[0m`);
  console.log(`\x1b[33m  Modified files: ${diff.modifiedFiles.length}\x1b[0m`);
  console.log(`\x1b[90m  Unchanged:      ${diff.unchanged}\x1b[0m\n`);

  return diff;
}

// ── DIFF LATEST TWO ────────────────────────────────────────────────────────────
export function diffLatest() {
  const snapDir = config.integrity.snapshotDir;
  if (!fs.existsSync(snapDir)) {
    console.log('\x1b[31mNo snapshots found. Run: node index.js integrity --baseline\x1b[0m');
    return null;
  }
  const snaps = fs.readdirSync(snapDir)
    .filter(f => f.endsWith('.snapshot.json'))
    .sort()
    .map(f => path.join(snapDir, f));

  if (snaps.length < 2) {
    console.log('\x1b[33mNeed at least 2 snapshots to diff.\x1b[0m');
    return null;
  }

  return diffSnapshots(snaps[snaps.length - 2], snaps[snaps.length - 1]);
}

// ── WATCH MODE ────────────────────────────────────────────────────────────────
export async function watchDir(watchPath) {
  const { default: chokidar } = await import('chokidar');
  const algorithm = config.integrity.algorithm;
  const dir       = path.resolve(watchPath || process.cwd());

  console.log(`\x1b[35m[INTEGRITY WATCH]\x1b[0m Watching: ${dir}`);
  console.log('\x1b[90mPress Ctrl+C to stop.\x1b[0m\n');

  const watcher = chokidar.watch(dir, {
    ignored:    /(node_modules|\.git)/,
    persistent: true,
    ignoreInitial: true,
  });

  watcher.on('add', async (fp) => {
    const h = await hashFile(fp, algorithm);
    console.log(`\x1b[32m[+] NEW\x1b[0m ${fp} → ${h?.slice(0, 12)}...`);
    logger.info('IntegrityMonitor', 'FILE_ADDED', { path: fp, hash: h });
  });

  watcher.on('change', async (fp) => {
    const h = await hashFile(fp, algorithm);
    console.log(`\x1b[33m[~] MODIFIED\x1b[0m ${fp} → ${h?.slice(0, 12)}...`);
    logger.warn('IntegrityMonitor', 'FILE_MODIFIED', { path: fp, hash: h });
  });

  watcher.on('unlink', (fp) => {
    console.log(`\x1b[31m[-] DELETED\x1b[0m ${fp}`);
    logger.warn('IntegrityMonitor', 'FILE_DELETED', { path: fp });
  });

  return watcher;
}
