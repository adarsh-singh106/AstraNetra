import { workerData, parentPort } from 'worker_threads';
import fs from 'fs';
import path from 'path';

const { rootDir, excludePaths, followSymlinks, sensitivePatterns } = workerData;

function isExcluded(filePath) {
  return excludePaths.some(ex =>
    filePath === ex ||
    filePath.startsWith(ex + path.sep) ||
    filePath.includes(path.sep + 'node_modules' + path.sep)
  );
}

function isHidden(name, filePath) {
  if (process.platform !== 'win32') {
    return name.startsWith('.');
  }
  // On Windows, check name prefix as basic heuristic
  return name.startsWith('.');
}

function isSensitive(name) {
  const lower = name.toLowerCase();
  return sensitivePatterns.some(p => lower.includes(p.toLowerCase()));
}

async function* walk(dir, depth = 0) {
  if (isExcluded(dir)) return;

  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (e) {
    parentPort.postMessage({ type: 'inaccessible', path: dir, reason: e.code || e.message });
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (isExcluded(fullPath)) continue;

    const hidden    = isHidden(entry.name, fullPath);
    const sensitive = isSensitive(entry.name);

    if (entry.isSymbolicLink() && !followSymlinks) {
      parentPort.postMessage({ type: 'file', path: fullPath, symlink: true, hidden, sensitive, sizeBytes: 0, ext: path.extname(entry.name), name: entry.name });
      continue;
    }

    if (entry.isDirectory()) {
      parentPort.postMessage({ type: 'dir', path: fullPath, hidden });
      yield* walk(fullPath, depth + 1);
    } else {
      let sizeBytes = 0;
      let mtimeMs   = 0;
      try {
        const stat = await fs.promises.stat(fullPath);
        sizeBytes = stat.size;
        mtimeMs   = stat.mtimeMs;
      } catch (_) {}

      parentPort.postMessage({
        type:      'file',
        path:      fullPath,
        name:      entry.name,
        ext:       path.extname(entry.name).toLowerCase(),
        sizeBytes,
        mtimeMs,
        hidden,
        sensitive,
        symlink:   false,
      });
    }
  }
}

// kick off
(async () => {
  for await (const _ of walk(rootDir)) {}
  parentPort.postMessage({ type: 'done' });
})();
