import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { getLogger } from '../output/Logger.js';
import config from '../config/astranetra.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const logger     = getLogger();
const platform   = process.platform;
const home       = os.homedir();
const CWD        = process.cwd();

// Where we track what we've done (for revert)
const STATE_FILE = path.join(CWD, 'logs', 'persistence_state.json');

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (_) {}
  return { copies: [], pathEntries: [], shellLines: [] };
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

// ── STEP 1: SELF COPY ────────────────────────────────────────────────────────
async function selfCopy() {
  const targetDir = config.persistence.targets[platform];
  if (!targetDir) {
    logger.warn('PersistenceEngine', 'NO_TARGET_FOR_PLATFORM', { platform });
    return null;
  }

  fs.mkdirSync(targetDir, { recursive: true });

  // 1. Drop the payload folder in the user's home directory
  const dropDir = path.join(home, '.astranetra_payload');
  try {
    fs.cpSync(CWD, dropDir, {
      recursive: true,
      force: true,
      filter: (src) => {
        const basename = path.basename(src);
        return !['.git', 'logs', 'reports', 'db', 'snapshots', '.astranetra_trash', 'sandbox', 'temp'].includes(basename);
      }
    });
    
    // Create global command wrappers so it can be run from anywhere via PATH
    const batWrapper = `@echo off\ncd /d "%~dp0"\nnode "index.js" %*\n`;
    const shWrapper = `#!/bin/sh\ncd "$(dirname "$0")"\nnode "index.js" "$@"\n`;
    
    fs.writeFileSync(path.join(dropDir, 'astra.bat'), batWrapper, 'utf8');
    fs.writeFileSync(path.join(dropDir, 'astra'), shWrapper, 'utf8');
    try { fs.chmodSync(path.join(dropDir, 'astra'), 0o755); } catch(e) {}

    console.log(`\x1b[32m[PERSIST]\x1b[0m Dropped hidden payload folder at: ${dropDir}`);
  } catch (err) {
    logger.warn('PersistenceEngine', 'PAYLOAD_DROP_FAILED', { error: err.message });
  }

  const droppedScript = path.join(dropDir, 'index.js');
  let copyResult  = null;

  if (platform === 'win32') {
    const dest = path.join(targetDir, 'astranetra.bat');
    fs.writeFileSync(dest, `@echo off\nnode "${droppedScript}"\n`, 'utf8');
    copyResult = dest;
    logger.info('PersistenceEngine', 'SELF_COPY_WIN32', { dest });
    console.log(`\x1b[32m[PERSIST]\x1b[0m Created startup trigger: ${dest}`);

  } else if (platform === 'linux') {
    const desktopPath = path.join(targetDir, 'astranetra.desktop');
    const desktop = [
      '[Desktop Entry]',
      'Type=Application',
      'Name=astranetra',
      `Exec=node ${droppedScript}`,
      'Hidden=false',
      'NoDisplay=false',
      'X-GNOME-Autostart-enabled=true',
    ].join('\n');
    fs.writeFileSync(desktopPath, desktop, 'utf8');
    copyResult = desktopPath;
    logger.info('PersistenceEngine', 'SELF_COPY_LINUX', { dest: desktopPath });
    console.log(`\x1b[32m[PERSIST]\x1b[0m Created autostart entry: ${desktopPath}`);

  } else if (platform === 'darwin') {
    const plistPath = path.join(targetDir, 'com.astranetra.plist');
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>         <string>com.astranetra</string>
  <key>ProgramArguments</key>
  <array>
    <string>${process.execPath}</string>
    <string>${droppedScript}</string>
  </array>
  <key>RunAtLoad</key>     <true/>
  <key>KeepAlive</key>     <false/>
</dict>
</plist>`;
    fs.writeFileSync(plistPath, plist, 'utf8');
    copyResult = plistPath;
    logger.info('PersistenceEngine', 'SELF_COPY_DARWIN', { dest: plistPath });
    console.log(`\x1b[32m[PERSIST]\x1b[0m Created LaunchAgent: ${plistPath}`);
  }

  return { copyResult, dropDir };
}

// ── STEP 2: PATH REGISTRATION ────────────────────────────────────────────────
async function registerInPath(dropDir) {
  const injectedDir = dropDir || CWD;
  const exportLine  = `\nexport PATH="$PATH:${injectedDir}"  # astranetra\n`;

  if (platform === 'win32') {
    try {
      const current = process.env.PATH || '';
      if (!current.includes(injectedDir)) {
        const newPath = `${current};${injectedDir}`;
        if (newPath.length > 1024) {
          logger.warn('PersistenceEngine', 'PATH_TOO_LONG', { length: newPath.length, limit: 1024 });
          console.log(`\x1b[33m[PATH]\x1b[0m PATH too long for setx (${newPath.length} > 1024 chars). Skipping to avoid truncation.`);
        } else {
          execSync(`setx PATH "${newPath}"`, { encoding: 'utf8' });
          logger.info('PersistenceEngine', 'PATH_REGISTERED_WIN32', { dir: injectedDir });
          console.log(`\x1b[32m[PATH]\x1b[0m Registered hidden payload in user PATH via setx: ${injectedDir}`);
          console.log(`\x1b[36m[PATH] You can now type 'astra' from ANY terminal to run the virus!\x1b[0m`);
        }
      } else {
        console.log(`\x1b[36m[PATH]\x1b[0m Already in PATH.`);
      }
    } catch (e) {
      logger.error('PersistenceEngine', 'PATH_REGISTER_FAILED', { error: e.message });
    }
    return { method: 'setx', dir: injectedDir };
  }

  // Unix: write to shell config files
  const configs = config.persistence.pathShellConfigs[platform] || [];
  const written = [];

  for (const shellConfig of configs) {
    try {
      // Read existing content
      let existing = '';
      if (fs.existsSync(shellConfig)) {
        existing = fs.readFileSync(shellConfig, 'utf8');
      }
      if (existing.includes('# astranetra')) {
        console.log(`\x1b[36m[PATH]\x1b[0m Already in ${shellConfig}`);
        continue;
      }
      fs.appendFileSync(shellConfig, exportLine, 'utf8');
      written.push(shellConfig);
      logger.info('PersistenceEngine', 'PATH_REGISTERED_UNIX', { file: shellConfig, dir: injectedDir });
      console.log(`\x1b[32m[PATH]\x1b[0m Appended to ${shellConfig}`);
      console.log(`\x1b[36m[PATH] Open a new terminal and type 'astra' to run it from anywhere!\x1b[0m`);
    } catch (e) {
      logger.warn('PersistenceEngine', 'SHELL_CONFIG_WRITE_FAILED', { file: shellConfig, error: e.message });
    }
  }

  return { method: 'shell_config', configs: written, dir: injectedDir, line: exportLine };
}

// ── PERSIST (main entry) ─────────────────────────────────────────────────────
export async function persist() {
  console.log('\n\x1b[35m━━━ PERSISTENCE ENGINE ━━━\x1b[0m');
  console.log('\x1b[33mThis demonstrates how programs survive reboots and register in PATH.\x1b[0m\n');

  const state = loadState();

  const selfCopyRes = await selfCopy();
  const copyTarget = selfCopyRes?.copyResult;
  const dropDir = selfCopyRes?.dropDir;
  
  const pathResult = await registerInPath(dropDir);

  const entry = {
    ts:          new Date().toISOString(),
    platform,
    copyTarget,
    dropDir,
    pathResult,
    revertCmd:   'node index.js persist --revert',
  };

  if (copyTarget) state.copies.push(copyTarget);
  if (dropDir) state.copies.push(dropDir);
  if (pathResult?.configs) state.shellLines.push(...pathResult.configs);
  saveState(state);

  logger.info('PersistenceEngine', 'PERSIST_COMPLETE', entry);
  console.log(`\n\x1b[32m✓ Persistence established.\x1b[0m`);
  console.log(`\x1b[36m  To undo: node index.js persist --revert\x1b[0m\n`);
  return entry;
}

// ── REVERT ───────────────────────────────────────────────────────────────────
export async function revert() {
  console.log('\n\x1b[35m━━━ PERSISTENCE REVERT ━━━\x1b[0m');
  const state = loadState();
  let reverted = 0;

  // Remove copied files and payload folder
  for (const copyPath of state.copies) {
    if (!copyPath) continue;
    try {
      if (fs.existsSync(copyPath)) {
        const stats = fs.statSync(copyPath);
        if (stats.isDirectory()) {
          fs.rmSync(copyPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(copyPath);
        }
        console.log(`\x1b[32m✓ Removed:\x1b[0m ${copyPath}`);
        logger.info('PersistenceEngine', 'REVERT_COPY_REMOVED', { path: copyPath });
        reverted++;
      }
    } catch (e) {
      logger.warn('PersistenceEngine', 'REVERT_COPY_FAILED', { path: copyPath, error: e.message });
    }
  }

  // Remove PATH entries from shell configs
  for (const shellConfig of state.shellLines) {
    try {
      if (!fs.existsSync(shellConfig)) continue;
      const content  = fs.readFileSync(shellConfig, 'utf8');
      const cleaned  = content.split('\n')
        .filter(line => !line.includes('# astranetra'))
        .join('\n');
      fs.writeFileSync(shellConfig, cleaned, 'utf8');
      console.log(`\x1b[32m✓ Cleaned PATH entry from:\x1b[0m ${shellConfig}`);
      logger.info('PersistenceEngine', 'REVERT_PATH_CLEANED', { file: shellConfig });
      reverted++;
    } catch (e) {
      logger.warn('PersistenceEngine', 'REVERT_PATH_FAILED', { file: shellConfig, error: e.message });
    }
  }

  // Clear state
  saveState({ copies: [], pathEntries: [], shellLines: [] });

  console.log(`\n\x1b[32m✓ Revert complete — ${reverted} changes undone.\x1b[0m\n`);
  return { reverted };
}

// ── READ EXISTING PERSISTENCE ────────────────────────────────────────────────
export function getPersistenceStatus() {
  return loadState();
}
