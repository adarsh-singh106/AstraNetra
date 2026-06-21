import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import readline from 'readline';
import { getLogger } from '../output/Logger.js';
import config from '../config/astranetra.config.js';

const logger = getLogger();

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function confirm(message) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(`\x1b[33m⚠  ${message} [yes/no]: \x1b[0m`, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'yes');
    });
  });
}

function makeResult(success, path_, operation, durationMs, extra = {}) {
  return { success, path: path_, operation, durationMs, ...extra };
}

// ── CREATE ──────────────────────────────────────────────────────────────────
export async function createFile(filePath, content = '', encoding = 'utf8', force = false) {
  const start = Date.now();
  try {
    ensureDir(path.dirname(filePath));
    if (fs.existsSync(filePath) && !force) {
      throw new Error('File already exists. Use --force to overwrite.');
    }
    const tmp = filePath + '.tmp_' + Date.now();
    await fs.promises.writeFile(tmp, content, encoding);
    await fs.promises.rename(tmp, filePath);
    logger.info('CRUDEngine', 'FILE_CREATED', { path: filePath });
    return makeResult(true, filePath, 'create', Date.now() - start);
  } catch (e) {
    logger.error('CRUDEngine', 'CREATE_FAILED', { path: filePath, error: e.message });
    return makeResult(false, filePath, 'create', Date.now() - start, { error: e.message });
  }
}

// ── READ ─────────────────────────────────────────────────────────────────────
export async function readFile(filePath, encoding = 'utf8') {
  const start = Date.now();
  try {
    const content = await fs.promises.readFile(filePath, encoding);
    logger.info('CRUDEngine', 'FILE_READ', { path: filePath });
    return makeResult(true, filePath, 'read', Date.now() - start, { content });
  } catch (e) {
    logger.error('CRUDEngine', 'READ_FAILED', { path: filePath, error: e.message });
    return makeResult(false, filePath, 'read', Date.now() - start, { error: e.message });
  }
}

// ── UPDATE ───────────────────────────────────────────────────────────────────
export async function updateFile(filePath, content, mode = 'overwrite', encoding = 'utf8') {
  const start = Date.now();
  try {
    if (!fs.existsSync(filePath)) throw new Error('File does not exist.');
    let finalContent = content;
    if (mode === 'append') {
      const existing = await fs.promises.readFile(filePath, encoding);
      finalContent = existing + content;
    } else if (mode === 'prepend') {
      const existing = await fs.promises.readFile(filePath, encoding);
      finalContent = content + existing;
    }
    if (config.crud.atomicWrites) {
      const tmp = filePath + '.tmp_' + Date.now();
      await fs.promises.writeFile(tmp, finalContent, encoding);
      await fs.promises.rename(tmp, filePath);
    } else {
      await fs.promises.writeFile(filePath, finalContent, encoding);
    }
    logger.info('CRUDEngine', 'FILE_UPDATED', { path: filePath, mode });
    return makeResult(true, filePath, `update:${mode}`, Date.now() - start);
  } catch (e) {
    logger.error('CRUDEngine', 'UPDATE_FAILED', { path: filePath, error: e.message });
    return makeResult(false, filePath, 'update', Date.now() - start, { error: e.message });
  }
}

// ── DELETE ───────────────────────────────────────────────────────────────────
export async function deleteFile(filePath, permanent = false, skipConfirm = false) {
  const start = Date.now();
  try {
    if (!fs.existsSync(filePath)) throw new Error('File does not exist.');
    if (config.crud.requireConfirmForDelete && !skipConfirm) {
      const ok = await confirm(`Delete "${filePath}"?`);
      if (!ok) return makeResult(false, filePath, 'delete', Date.now() - start, { reason: 'cancelled' });
    }
    if (!permanent) {
      ensureDir(config.crud.trashDir);
      const dest = path.join(config.crud.trashDir, path.basename(filePath) + '_' + Date.now());
      await fs.promises.rename(filePath, dest).catch(async () => {
        // Cross-device: copy then delete
        await fs.promises.copyFile(filePath, dest);
        await fs.promises.unlink(filePath);
      });
      logger.warn('CRUDEngine', 'FILE_TRASHED', { path: filePath, dest });
      return makeResult(true, filePath, 'delete:trash', Date.now() - start, { dest });
    } else {
      await fs.promises.unlink(filePath);
      logger.warn('CRUDEngine', 'FILE_DELETED_PERMANENT', { path: filePath });
      return makeResult(true, filePath, 'delete:permanent', Date.now() - start);
    }
  } catch (e) {
    logger.error('CRUDEngine', 'DELETE_FAILED', { path: filePath, error: e.message });
    return makeResult(false, filePath, 'delete', Date.now() - start, { error: e.message });
  }
}

// ── RENAME ───────────────────────────────────────────────────────────────────
export async function renameFile(oldPath, newPath) {
  const start = Date.now();
  try {
    await fs.promises.rename(oldPath, newPath).catch(async () => {
      await fs.promises.copyFile(oldPath, newPath);
      await fs.promises.unlink(oldPath);
    });
    logger.info('CRUDEngine', 'FILE_RENAMED', { from: oldPath, to: newPath });
    return makeResult(true, newPath, 'rename', Date.now() - start, { from: oldPath });
  } catch (e) {
    logger.error('CRUDEngine', 'RENAME_FAILED', { error: e.message });
    return makeResult(false, oldPath, 'rename', Date.now() - start, { error: e.message });
  }
}

// ── MOVE ─────────────────────────────────────────────────────────────────────
export async function moveFile(src, dest) {
  return renameFile(src, dest);
}

// ── CORRUPT (DEMO ONLY) ──────────────────────────────────────────────────────
export async function corruptFile(filePath, force = false) {
  const start = Date.now();
  try {
    const sandboxDir = path.resolve(config.crud.sandboxDir);
    const targetPath = path.resolve(filePath);

    if (!targetPath.startsWith(sandboxDir) && !force) {
      throw new Error(
        `corruptFile only works inside sandbox/ by default.\n` +
        `Target: ${targetPath}\nSandbox: ${sandboxDir}\n` +
        `Use --force to override (dangerous).`
      );
    }

    if (!fs.existsSync(targetPath)) throw new Error('File does not exist.');

    // Backup original
    const backupPath = targetPath + '.backup_' + Date.now();
    await fs.promises.copyFile(targetPath, backupPath);

    // Replace with random bytes
    const size    = (await fs.promises.stat(targetPath)).size;
    const garbage = crypto.randomBytes(Math.max(size, 64));
    await fs.promises.writeFile(targetPath, garbage);

    logger.warn('CRUDEngine', 'FILE_CORRUPTED', { path: targetPath, backupPath });
    console.log(`\x1b[31m[CORRUPT DEMO]\x1b[0m Replaced "${targetPath}" with ${garbage.length} random bytes.`);
    console.log(`\x1b[33m[BACKUP]\x1b[0m Original saved at: ${backupPath}`);

    return makeResult(true, targetPath, 'corrupt', Date.now() - start, { backupPath });
  } catch (e) {
    logger.error('CRUDEngine', 'CORRUPT_FAILED', { path: filePath, error: e.message });
    return makeResult(false, filePath, 'corrupt', Date.now() - start, { error: e.message });
  }
}

// ── BATCH DELETE ─────────────────────────────────────────────────────────────
export async function batchDelete(pathsArray, dryRun = true) {
  console.log(`\x1b[33m[BATCH DELETE]\x1b[0m ${dryRun ? 'DRY RUN — ' : ''}${pathsArray.length} files:`);
  pathsArray.forEach(p => console.log(`  - ${p}`));
  if (dryRun) {
    console.log('\x1b[36mDry run complete. Pass dryRun=false to execute.\x1b[0m');
    return pathsArray.map(p => ({ path: p, status: 'dry-run' }));
  }
  const results = [];
  for (const p of pathsArray) {
    results.push(await deleteFile(p, false, false));
  }
  return results;
}
