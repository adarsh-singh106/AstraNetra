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

  const srcScript = path.join(CWD, 'index.js');
  let copyResult  = null;

  if (platform === 'win32') {
    const dest = path.join(targetDir, 'astranetra.js');
    fs.copyFileSync(srcScript, dest);
    copyResult = dest;
    logger.info('PersistenceEngine', 'SELF_COPY_WIN32', { dest });
    console.log(`\x1b[32m[PERSIST]\x1b[0m Copied to startup folder: ${dest}`);

  } else if (platform === 'linux') {
    // Create a .desktop file for autostart
    const desktopPath = path.join(targetDir, 'astranetra.desktop');
    const desktop = [
      '[Desktop Entry]',
      'Type=Application',
      'Name=astranetra',
      `Exec=node ${srcScript}`,
      'Hidden=false',
      'NoDisplay=false',
      'X-GNOME-Autostart-enabled=true',
    ].join('\n');
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(desktopPath, desktop, 'utf8');
    copyResult = desktopPath;
    logger.info('PersistenceEngine', 'SELF_COPY_LINUX', { dest: desktopPath });
    console.log(`\x1b[32m[PERSIST]\x1b[0m Created autostart entry: ${desktopPath}`);

  } else if (platform === 'darwin') {
    // Create a LaunchAgent .plist
    const plistPath = path.join(targetDir, 'com.astranetra.plist');
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>         <string>com.astranetra</string>
  <key>ProgramArguments</key>
  <array>
    <string>${process.execPath}</string>
    <string>${srcScript}</string>
  </array>
  <key>RunAtLoad</key>     <true/>
  <key>KeepAlive</key>     <false/>
</dict>
</plist>`;
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(plistPath, plist, 'utf8');
    copyResult = plistPath;
    logger.info('PersistenceEngine', 'SELF_COPY_DARWIN', { dest: plistPath });
    console.log(`\x1b[32m[PERSIST]\x1b[0m Created LaunchAgent: ${plistPath}`);
  }

  return copyResult;
}

// ── STEP 2: PATH REGISTRATION ────────────────────────────────────────────────
async function registerInPath() {
  const injectedDir = CWD;
  const exportLine  = `\nexport PATH="$PATH:${injectedDir}"  # astranetra\n`;

  if (platform === 'win32') {
    try {
      const current = execSync('echo %PATH%', { encoding: 'utf8' }).trim();
      if (!current.includes(injectedDir)) {
        execSync(`setx PATH "${current};${injectedDir}"`, { encoding: 'utf8' });
        logger.info('PersistenceEngine', 'PATH_REGISTERED_WIN32', { dir: injectedDir });
        console.log(`\x1b[32m[PATH]\x1b[0m Registered in user PATH via setx: ${injectedDir}`);
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

  const copyTarget = await selfCopy();
  const pathResult = await registerInPath();

  const entry = {
    ts:          new Date().toISOString(),
    platform,
    copyTarget,
    pathResult,
    revertCmd:   'node index.js persist --revert',
  };

  state.copies.push(copyTarget);
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

  // Remove copied files
  for (const copyPath of state.copies) {
    if (!copyPath) continue;
    try {
      if (fs.existsSync(copyPath)) {
        fs.unlinkSync(copyPath);
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
