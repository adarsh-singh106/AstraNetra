import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { getLogger } from '../output/Logger.js';
import config from '../config/astranetra.config.js';

const logger   = getLogger();
const platform = process.platform;
const home     = os.homedir();

const STANDARD_PATHS = {
  linux:  ['/usr/bin', '/usr/local/bin', '/bin', '/sbin', '/usr/sbin', '/usr/local/sbin'],
  darwin: ['/usr/bin', '/usr/local/bin', '/bin', '/sbin', '/usr/sbin', '/opt/homebrew/bin'],
  win32:  ['C:\\Windows\\System32', 'C:\\Windows', 'C:\\Windows\\System32\\Wbem'],
};

const SEPARATOR = platform === 'win32' ? ';' : ':';

function analyzePath(rawPath) {
  const entries = rawPath.split(SEPARATOR).filter(Boolean);
  return entries.map((entry, i) => {
    const trimmed    = entry.trim();
    const standards  = STANDARD_PATHS[platform] || [];
    const isStandard = standards.some(s => trimmed.toLowerCase().startsWith(s.toLowerCase()));
    const isTmp      = /tmp|temp/i.test(trimmed);
    const isHome     = trimmed.startsWith(home);
    const exists     = (() => { try { return fs.existsSync(trimmed); } catch { return false; } })();

    let flag = '✓ standard';
    if (!exists)    flag = '✗ does not exist';
    else if (isTmp) flag = '🚨 SUSPICIOUS — temp directory';
    else if (!isStandard && isHome) flag = '⚠  non-standard (user home)';
    else if (!isStandard) flag = '⚠  non-standard';

    return { index: i + 1, path: trimmed, isStandard, isTmp, isHome, exists, flag };
  });
}

// ── SHOW PATH ─────────────────────────────────────────────────────────────────
export function showPath() {
  const raw     = process.env.PATH || '';
  const entries = analyzePath(raw);

  console.log('\n\x1b[35m━━━ PATH ANALYSIS ━━━\x1b[0m');
  console.log(`Platform: ${platform} | Separator: "${SEPARATOR}" | Entries: ${entries.length}\n`);

  for (const e of entries) {
    const color = e.flag.startsWith('🚨') ? '\x1b[31m'
                : e.flag.startsWith('⚠')  ? '\x1b[33m'
                : e.flag.startsWith('✗')  ? '\x1b[90m'
                : '\x1b[32m';
    console.log(`  [${String(e.index).padStart(2)}] ${color}${e.flag}\x1b[0m`);
    console.log(`       ${e.path}`);
  }

  const suspicious = entries.filter(e => e.isTmp || (!e.isStandard && !e.isHome && e.exists));
  if (suspicious.length) {
    console.log(`\n\x1b[31m⚠  ${suspicious.length} suspicious entries found!\x1b[0m`);
  }

  logger.info('PathManipulator', 'PATH_ANALYZED', { entries: entries.length });
  return entries;
}

// ── PATH HIJACK DEMO (session-scoped) ────────────────────────────────────────
export async function pathHijackDemo() {
  const demoDir  = path.join(process.cwd(), 'injected_demo');
  const fakeGit  = path.join(demoDir, platform === 'win32' ? 'git.cmd' : 'git');

  fs.mkdirSync(demoDir, { recursive: true });

  const fakeScript = platform === 'win32'
    ? `@echo off\necho [ASTRANETRA PATH HIJACK] You ran 'git' but this is our version!\necho Real git is blocked. Type 'node index.js path --revert' to restore.\n`
    : `#!/bin/sh\necho "[ASTRANETRA PATH HIJACK] You ran 'git' but this is our version!"\necho "Real git is blocked. Type 'node index.js path --revert' to restore."\n`;

  fs.writeFileSync(fakeGit, fakeScript, 'utf8');
  if (platform !== 'win32') {
    fs.chmodSync(fakeGit, 0o755);
  }

  // Prepend demo dir to PATH for this process
  process.env.PATH = demoDir + SEPARATOR + process.env.PATH;

  logger.warn('PathManipulator', 'PATH_HIJACK_DEMO_ACTIVE', { injectedDir: demoDir });

  console.log('\n\x1b[35m━━━ PATH HIJACK DEMO ━━━\x1b[0m');
  console.log(`\x1b[31m[INJECTED]\x1b[0m ${demoDir} → prepended to PATH`);
  console.log('\x1b[33mType \'git\' in this process to see the hijack in action.\x1b[0m');
  console.log(`\x1b[36mFake git located at: ${fakeGit}\x1b[0m`);
  console.log('\x1b[90mThis is session-scoped only — closes when the process exits.\x1b[0m\n');

  // Demonstrate immediately
  try {
    const result = execSync(platform === 'win32' ? 'git' : 'git', {
      encoding: 'utf8',
      env: { ...process.env },
      timeout: 2000,
    });
    console.log('\x1b[31m[DEMO OUTPUT]\x1b[0m', result);
  } catch (e) {
    if (e.stdout) console.log('\x1b[31m[DEMO OUTPUT]\x1b[0m', e.stdout);
  }

  return { injectedDir: demoDir, fakeScript: fakeGit };
}

// ── INJECT (permanent) ────────────────────────────────────────────────────────
export function injectPath(dirToAdd) {
  const dirResolved = path.resolve(dirToAdd);
  const exportLine  = `\nexport PATH="$PATH:${dirResolved}"  # astranetra-injected\n`;

  if (platform === 'win32') {
    try {
      const current = execSync('echo %PATH%', { encoding: 'utf8' }).trim();
      execSync(`setx PATH "${current};${dirResolved}"`, { encoding: 'utf8' });
      logger.info('PathManipulator', 'PATH_INJECTED_WIN32', { dir: dirResolved });
      console.log(`\x1b[32m✓ Injected into Windows PATH:\x1b[0m ${dirResolved}`);
    } catch (e) {
      console.log(`\x1b[31m✗ Failed:\x1b[0m ${e.message}`);
    }
    return;
  }

  const shellConfigs = config.persistence.pathShellConfigs[platform] || [];
  for (const cfg of shellConfigs) {
    try {
      if (fs.existsSync(cfg) && fs.readFileSync(cfg, 'utf8').includes('# astranetra-injected')) {
        console.log(`\x1b[36mAlready injected in ${cfg}\x1b[0m`);
        continue;
      }
      fs.appendFileSync(cfg, exportLine, 'utf8');
      console.log(`\x1b[32m✓ Injected into ${cfg}\x1b[0m`);
      logger.info('PathManipulator', 'PATH_INJECTED', { file: cfg, dir: dirResolved });
    } catch (e) {
      console.log(`\x1b[31m✗ ${cfg}: ${e.message}\x1b[0m`);
    }
  }
}

// ── REVERT injected PATH entries ─────────────────────────────────────────────
export function revertPath() {
  const shellConfigs = config.persistence.pathShellConfigs[platform] || [];
  let count = 0;

  for (const cfg of shellConfigs) {
    try {
      if (!fs.existsSync(cfg)) continue;
      const content = fs.readFileSync(cfg, 'utf8');
      const cleaned = content.split('\n')
        .filter(line => !line.includes('# astranetra'))
        .join('\n');
      if (cleaned !== content) {
        fs.writeFileSync(cfg, cleaned, 'utf8');
        console.log(`\x1b[32m✓ Removed PATH injection from ${cfg}\x1b[0m`);
        logger.info('PathManipulator', 'PATH_REVERTED', { file: cfg });
        count++;
      }
    } catch (e) {
      console.log(`\x1b[31m✗ ${cfg}: ${e.message}\x1b[0m`);
    }
  }

  // Remove demo dir
  const demoDir = path.join(process.cwd(), 'injected_demo');
  if (fs.existsSync(demoDir)) {
    fs.rmSync(demoDir, { recursive: true, force: true });
    console.log(`\x1b[32m✓ Removed demo dir: ${demoDir}\x1b[0m`);
    count++;
  }

  console.log(`\n\x1b[32m✓ PATH revert done — ${count} changes cleaned.\x1b[0m`);
  return { reverted: count };
}
