#!/usr/bin/env node

// ── Runtime version check ────────────────────────────────────────────────────
const [__major] = process.versions.node.split('.').map(Number);
if (__major < 18) {
  console.error(
    `\x1b[31m[ASTRANETRA] Node.js >= 18.0.0 is required.\x1b[0m\n` +
    `  Current: ${process.version}\n` +
    `  Download: https://nodejs.org/\n`
  );
  process.exit(1);
}

/**
 * ASTRANETRA — The Watching Weapon
 * Astra (weapon) · Netra (eye)
 *
 * Enhanced Terminal UI — chalk, gradient-string, boxen, ora, cli-progress,
 * blessed-contrib live dashboard, Matrix rain, glitch text, and more.
 */

import path    from 'path';
import fs      from 'fs';
import os      from 'os';
import crypto  from 'crypto';
import open    from 'open';
import chalk   from 'chalk';
import gradient from 'gradient-string';
import boxen   from 'boxen';

// ── TerminalUI Effects ───────────────────────────────────────────────────────
import {
  NEON_GREEN, NEON_CYAN, NEON_MAGENTA, NEON_RED, NEON_YELLOW, NEON_BLUE,
  NEON_ORANGE, GHOST_WHITE, DIM_GREEN, DARK_BG,
  GRADIENTS,
  sleep, stripAnsi, centerText, W,
  matrixRain, glitchText, typeWrite, hackerType, decryptReveal,
  scanLineTransition, phaseTransition, pulseText, countdown, particleBurst,
  progressBar, animatedProgressBar, styledBox, tableRow, countUp,
  separator, badge, tag,
  STATUS, animatedStep, exfilStep,
} from './output/TerminalUI.js';

// ── Bootstrap ────────────────────────────────────────────────────────────────
import { getLogger } from './output/Logger.js';
const logger = getLogger(path.join(process.cwd(), 'logs'));

for (const d of ['logs','snapshots','reports','sandbox','db','.astranetra_trash']) {
  try {
    fs.mkdirSync(path.join(process.cwd(), d), { recursive: true });
  } catch (e) {
    console.error(chalk.hex(NEON_YELLOW)(`[WARN] Could not create directory '${d}': ${e.message}`));
  }
}

// ── BANNER ────────────────────────────────────────────────────────────────────
async function printBanner() {
  console.clear();

  // Matrix rain intro
  await matrixRain(1500, 0.35);

  console.log();

  const art = [
    '░█████╗░░██████╗████████╗██████╗░░█████╗░███╗░░██╗███████╗████████╗██████╗░░█████╗░',
    '██╔══██╗██╔════╝╚══██╔══╝██╔══██╗██╔══██╗████╗░██║██╔════╝╚══██╔══╝██╔══██╗██╔══██╗',
    '███████║╚█████╗░░░░██║░░░██████╔╝███████║██╔██╗██║█████╗░░░░░██║░░░██████╔╝███████║',
    '██╔══██║░╚═══██╗░░░██║░░░██╔══██╗██╔══██║██║╚████║██╔══╝░░░░░██║░░░██╔══██╗██╔══██║',
    '██║░░██║██████╔╝░░░██║░░░██║░░██║██║░░██║██║░╚███║███████╗░░░██║░░░██║░░██║██║░░██║',
    '╚═╝░░╚═╝╚═════╝░░░╚═╝░░░╚═╝░░╚═╝╚═╝░░╚═╝╚═╝░░╚══╝╚══════╝░░░╚═╝░░░╚═╝░░╚═╝╚═╝░░╚═╝',
  ];

  // Display ASCII art with gradient
  const cyberGrad = gradient(['#00FF87', '#60EFFF', '#7C3AED']);
  const artStr = art.join('\n');
  const gradArt = cyberGrad.multiline(artStr);
  for (const line of gradArt.split('\n')) {
    console.log(centerText(line));
    await sleep(50);
  }

  console.log();

  // Glitch effect on subtitle
  await glitchText('ASTRA (weapon) · NETRA (eye) — The Watching Weapon', 14, 55);

  // Styled info line
  const infoGrad = gradient(['#888888', '#60EFFF']);
  console.log(centerText(
    infoGrad(`Platform: ${process.platform}  ·  Node: ${process.version}  ·  PID: ${process.pid}  ·  Host: ${os.hostname()}`)
  ));

  console.log(centerText(chalk.hex('#333333')('━'.repeat(Math.min(80, W())))));
  console.log();

  await sleep(300);
}

// ── RECON DISPLAY ─────────────────────────────────────────────────────────────
async function displayRecon(data) {
  const o = data.os; const c = data.cpu; const r = data.ram;

  // Target acquired with decrypt reveal
  await decryptReveal(`TARGET ACQUIRED — ${o.hostname}`, 12, 35);
  console.log();

  // System profile box
  const profileRows = [
    tableRow('OS',        `${o.name} ${o.release}`,    14, '#666666', NEON_GREEN),
    tableRow('ARCH',      o.arch,                      14, '#666666', NEON_YELLOW),
    tableRow('HOSTNAME',  o.hostname,                  14, '#666666', NEON_CYAN),
    tableRow('USERNAME',  o.username,                  14, '#666666', NEON_RED),
    tableRow('SHELL',     o.shell || 'N/A',            14, '#666666', NEON_GREEN),
    tableRow('UPTIME',    o.uptime,                    14, '#666666', NEON_GREEN),
    tableRow('HOME DIR',  o.homedir,                   14, '#666666', GHOST_WHITE),
    tableRow('NODE.JS',   data.node.nodeVersion,       14, '#666666', NEON_YELLOW),
    tableRow('V8',        data.node.v8Version,         14, '#666666', NEON_YELLOW),
    tableRow('NPM',       data.node.npmVersion,        14, '#666666', NEON_YELLOW),
    tableRow('PID',       String(data.node.pid),       14, '#666666', NEON_CYAN),
  ].join('\n');

  console.log(styledBox(profileRows, {
    title: '⬡ SYSTEM PROFILE',
    borderColor: NEON_CYAN,
    borderStyle: 'round',
  }));

  // CPU section
  console.log();
  console.log(`  ${tag('CPU', NEON_YELLOW)} ${chalk.white(c.model)}  ${chalk.hex('#888888')(`${c.cores} cores @ ${c.speedGHz} GHz`)}`);
  console.log();

  const loads = c.loadPerCore || [];
  for (let i = 0; i < loads.length; i++) {
    const pct   = loads[i];
    const color = pct > 80 ? NEON_RED : pct > 50 ? NEON_YELLOW : NEON_GREEN;
    const coreBar = progressBar(pct, 25, {
      colorStart: color,
      colorEnd: pct > 80 ? '#FF6666' : pct > 50 ? '#FFAA00' : NEON_CYAN,
    });
    console.log(`  ${chalk.hex('#666666')(`Core ${String(i).padStart(2)}`)}  ${coreBar}`);
    await sleep(40);
  }

  // RAM section
  console.log();
  console.log(`  ${tag('RAM', NEON_MAGENTA)} ${chalk.white(r.usedHuman)} ${chalk.hex('#888888')('used of')} ${chalk.white(r.totalHuman)}  ${chalk.hex('#666666')(`(${r.freeHuman} free)`)}`);

  const ramColor = r.usedPercent > 85 ? NEON_RED : r.usedPercent > 65 ? NEON_YELLOW : NEON_GREEN;
  console.log(`  ${progressBar(r.usedPercent, 50, { colorStart: ramColor, colorEnd: NEON_CYAN })}`);

  // Disk
  if (data.disk?.length) {
    console.log();
    console.log(`  ${tag('DISK', NEON_BLUE)}`);
    for (const d of data.disk) {
      const dc = d.usedPercent > 85 ? NEON_RED : d.usedPercent > 65 ? NEON_YELLOW : NEON_GREEN;
      const diskBar = progressBar(d.usedPercent, 30, { colorStart: dc, colorEnd: NEON_CYAN });
      console.log(`  ${chalk.hex('#888888')(d.mount.padEnd(6))} ${diskBar}  ${chalk.hex('#888888')(`${d.usedHuman} / ${d.totalHuman}`)}`);
      await sleep(40);
    }
  }

  // Network
  if (data.network?.length) {
    console.log();
    console.log(`  ${tag('NETWORK', NEON_CYAN)}`);
    const nets = data.network.filter(n => !n.internal && n.family === 'IPv4').slice(0, 5);
    for (const n of nets) {
      console.log(`  ${chalk.hex('#888888')((n.adapter||'').padEnd(16))} ${chalk.hex(NEON_GREEN)(n.address.padEnd(18))} ${chalk.hex('#888888')('MAC:')} ${chalk.hex(NEON_YELLOW)(n.mac)}`);
      await sleep(30);
    }
  }

  // ENV snapshot
  if (data.env && Object.keys(data.env).length) {
    console.log();
    console.log(`  ${tag('ENVIRONMENT', NEON_RED)}`);
    const termW = W();
    for (const [k, v] of Object.entries(data.env)) {
      if (k === 'PATH') continue;
      const display = (v || '').slice(0, termW - 30);
      console.log(`  ${chalk.hex(NEON_RED).bold(k.padEnd(18))} ${chalk.hex(NEON_YELLOW)(display)}${(v||'').length > termW-30 ? chalk.hex('#555555')('…') : ''}`);
      await sleep(25);
    }
    // PATH
    if (data.env.PATH) {
      const sep = process.platform === 'win32' ? ';' : ':';
      const entries = data.env.PATH.split(sep).slice(0, 8);
      console.log(`  ${chalk.hex(NEON_RED).bold('PATH')}`);
      for (const e of entries) {
        console.log(`    ${chalk.hex('#555555')('→')} ${chalk.hex(NEON_YELLOW)(e)}`);
        await sleep(15);
      }
      const totalPathEntries = data.env.PATH.split(sep).length;
      if (totalPathEntries > 8) {
        console.log(`    ${chalk.hex('#555555')(`(+${totalPathEntries - 8} more entries)`)}`);
      }
    }
  }
}

// ── SCAN DISPLAY ──────────────────────────────────────────────────────────────
async function displayScan(data) {
  console.log();

  // Stats panel with styled box
  const statLines = [
    tableRow('TOTAL FILES',    (data.totalFiles||0).toLocaleString(),       16, '#666666', NEON_GREEN),
    tableRow('DIRECTORIES',    (data.totalDirectories||0).toLocaleString(), 16, '#666666', NEON_CYAN),
    tableRow('TOTAL SIZE',     data.totalSizeHuman||'—',                    16, '#666666', NEON_BLUE),
    tableRow('HIDDEN FILES',   `${(data.hiddenFileCount||0).toLocaleString()} ${chalk.hex('#555555')('← dotfiles & hidden attrs')}`, 16, '#666666', NEON_YELLOW),
    tableRow('SENSITIVE FLAGS', `${chalk.hex(NEON_RED).bold((data.sensitiveFlags||[]).length.toString())} ${chalk.hex('#555555')('← .env, .key, id_rsa, .pem…')}`, 16, '#666666', NEON_RED),
    tableRow('INACCESSIBLE',   `${(data.inaccessiblePaths||[]).length} ${chalk.hex('#555555')('← permission denied')}`, 16, '#666666', '#888888'),
    tableRow('SCAN TIME',      `${((data.scanDurationMs||0)/1000).toFixed(2)}s`, 16, '#666666', NEON_GREEN),
  ].join('\n');

  console.log(styledBox(statLines, {
    title: '◈ SCAN RESULTS',
    borderColor: NEON_CYAN,
    borderStyle: 'round',
  }));

  // Animated counter for total files
  await countUp('Files Discovered:', data.totalFiles || 0, 500, NEON_GREEN);

  // Extension chart
  if (data.topExtensions?.length) {
    console.log();
    console.log(`  ${badge('FILE TYPES', NEON_CYAN)}`);
    const top = data.topExtensions.slice(0, 12);
    const max = top[0]?.count || 1;
    for (const e of top) {
      const pct  = Math.round((e.count / max) * 100);
      const ext  = (e.ext || '(none)').padEnd(10);
      const cnt  = String(e.count).padStart(7);
      const fileBar = progressBar(pct, 28, { colorStart: NEON_GREEN, colorEnd: NEON_CYAN, bracket: false, showPercent: false });
      console.log(`  ${chalk.hex('#888888')(ext)} ${fileBar} ${chalk.hex(NEON_YELLOW)(cnt)}`);
      await sleep(30);
    }
  }

  // Sensitive flags
  if (data.sensitiveFlags?.length) {
    console.log();
    console.log(`  ${chalk.hex(NEON_RED).bold('⚠  SENSITIVE FILES DETECTED')}`);
    console.log(`  ${chalk.hex('#888888')('These matched patterns: .env .key .pem id_rsa .p12 credentials')}`);
    console.log(`  ${chalk.hex('#888888')('Paths only — contents NOT read')}`);
    console.log();
    for (const fp of data.sensitiveFlags.slice(0, 20)) {
      await sleep(40);
      console.log(STATUS.flag(fp));
    }
    if (data.sensitiveFlags.length > 20) {
      console.log(`  ${chalk.hex('#555555')(`  … and ${data.sensitiveFlags.length - 20} more (see reports/report.json)`)}`);
    }
  }

  // Largest files
  if (data.largestFiles?.length) {
    console.log();
    console.log(`  ${badge('LARGEST FILES', NEON_MAGENTA)}`);
    for (const f of data.largestFiles.slice(0, 8)) {
      const name = path.basename(f.path);
      console.log(`  ${chalk.hex(NEON_GREEN)(f.sizeHuman.padEnd(12))} ${chalk.hex('#888888')(f.ext?.padEnd(8)||''.padEnd(8))} ${chalk.white(name)}`);
      console.log(`  ${chalk.hex('#555555')('             ' + f.path)}`);
      await sleep(35);
    }
  }

  // Size distribution
  if (data.sizeDistribution) {
    console.log();
    console.log(`  ${badge('SIZE DISTRIBUTION', NEON_BLUE)}`);
    const dist = [
      ['< 10 MB',     data.sizeDistribution.under10MB    || 0, NEON_GREEN],
      ['10–100 MB',   data.sizeDistribution['10MB_100MB']|| 0, NEON_CYAN],
      ['100 MB–1 GB', data.sizeDistribution['100MB_1GB'] || 0, NEON_YELLOW],
      ['1–5 GB',      data.sizeDistribution['1GB_5GB']   || 0, NEON_MAGENTA],
      ['> 5 GB',      data.sizeDistribution.over5GB      || 0, NEON_RED],
    ];
    const distMax = Math.max(...dist.map(d => d[1]), 1);
    for (const [label, count, color] of dist) {
      const pct = Math.round((count / distMax) * 100);
      const distBar = progressBar(pct, 32, { colorStart: color, colorEnd: color, bracket: false, showPercent: false });
      console.log(`  ${chalk.hex('#888888')(label.padEnd(12))} ${distBar} ${chalk.hex(color)(count.toLocaleString())}`);
      await sleep(40);
    }
  }
}

// ── READ & DISPLAY actual file content ───────────────────────────────────────
async function displayFileContents() {
  console.log();
  await hackerType('  ⚡ READING REAL FILES FROM YOUR SYSTEM', 6);
  console.log(`  ${chalk.hex('#888888')('Demonstrating file access — this is what a virus does first')}`);
  console.log();

  const targets = [];

  // Collect real readable files
  const candidates = [
    path.join(os.homedir(), 'Desktop'),
    path.join(os.homedir(), '.bashrc'),
    path.join(os.homedir(), '.zshrc'),
    path.join(os.homedir(), '.profile'),
    path.join(os.homedir(), '.npmrc'),
    path.join(os.homedir(), 'Documents'),
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'Desktop') : null,
    'C:\\Windows\\System32\\drivers\\etc\\hosts',
    '/etc/hostname',
    '/etc/shells',
    '/etc/timezone',
    path.join(process.cwd(), 'package.json'),
    path.join(process.cwd(), 'README.md'),
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      const stat = fs.statSync(p);
      if (stat.isFile() && stat.size > 0 && stat.size < 8000) {
        targets.push(p);
      }
    } catch (_) {}
    if (targets.length >= 4) break;
  }

  // Also grab first .txt or .log in home
  try {
    const homeFiles = fs.readdirSync(os.homedir(), { withFileTypes: true });
    for (const f of homeFiles) {
      if (f.isFile() && (f.name.endsWith('.txt') || f.name.endsWith('.log'))) {
        const fp = path.join(os.homedir(), f.name);
        const st = fs.statSync(fp);
        if (st.size > 0 && st.size < 4000) { targets.push(fp); break; }
      }
    }
  } catch (_) {}

  if (targets.length === 0) {
    targets.push(path.join(process.cwd(), 'package.json'));
  }

  const borderGrad = gradient([NEON_CYAN, NEON_MAGENTA]);

  for (const fp of targets) {
    try {
      const content = fs.readFileSync(fp, 'utf8');
      const lines   = content.split('\n').slice(0, 12);

      // Top border with gradient
      console.log(`  ${borderGrad('╔══')} ${chalk.bold.white('READING:')} ${chalk.hex(NEON_YELLOW)(fp)}`);
      console.log(`  ${chalk.hex(NEON_CYAN)('║')}`);
      for (const l of lines) {
        await sleep(18);
        console.log(`  ${chalk.hex(NEON_CYAN)('║')}  ${chalk.hex('#888888')(l.slice(0, W() - 8))}`);
      }
      if (content.split('\n').length > 12) {
        console.log(`  ${chalk.hex(NEON_CYAN)('║')}  ${chalk.hex('#555555')(`… (${content.split('\n').length - 12} more lines)`)}`);
      }

      const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
      console.log(`  ${borderGrad('╚══')} ${chalk.hex(NEON_GREEN)('✓ READ COMPLETE')}  ${chalk.hex('#888888')(`${content.length} bytes`)}  ${chalk.hex('#555555')('SHA-256:')} ${chalk.hex(NEON_CYAN)(hash)}${chalk.hex('#555555')('…')}`);
      console.log();
      await sleep(300);
    } catch (e) {
      console.log(`  ${chalk.hex(NEON_RED)('✗')} Could not read: ${chalk.hex('#888888')(fp)}`);
    }
  }
}

// ── EXFIL DISPLAY ─────────────────────────────────────────────────────────────
async function displayExfil(result) {
  console.log();

  // Countdown before exfil
  await countdown(3);

  await typeWrite('  INITIATING DATA EXFILTRATION SEQUENCE…', 15, NEON_RED);
  await sleep(200);

  const steps = [
    ['Serializing recon payload',   120],
    ['Compressing file scan data',  90],
    ['Establishing local C2 link',  200],
    ['Authenticating to receiver',  150],
    ['Transmitting payload',        180],
    ['Writing to persistent store', 100],
    ['Verifying receipt',           80],
  ];

  for (const [step, delay] of steps) {
    await exfilStep(step, delay);
  }

  console.log();

  // Completion box with styled content
  const exfilContent = [
    tableRow('Server',  'http://localhost:4444',   10, '#888888', NEON_CYAN),
    tableRow('DB',      'db/astranetra.db',        10, '#888888', NEON_YELLOW),
    tableRow('Payload', `${String(result?.payload ? JSON.stringify(result.payload).length : '—').padEnd(8)} bytes`, 10, '#888888', NEON_MAGENTA),
  ].join('\n');

  console.log(styledBox(exfilContent, {
    title: '✓ EXFIL COMPLETE',
    borderColor: NEON_GREEN,
    borderStyle: 'double',
  }));
}

// ── PERSIST DISPLAY ───────────────────────────────────────────────────────────
async function displayPersist(result) {
  console.log();
  await typeWrite('  ESTABLISHING PERSISTENCE…', 15, NEON_RED);
  await sleep(200);

  const steps = [
    `Locating startup directory for ${process.platform}`,
    'Copying payload to startup location',
    'Registering in PATH via shell config',
    'Verifying persistence entries',
    'Confirming reboot survival',
  ];

  for (const step of steps) {
    await exfilStep(step, 120);
  }

  console.log();
  if (result?.copyTarget) {
    console.log(STATUS.flag('STARTUP COPY:'));
    console.log(`    ${chalk.hex(NEON_GREEN)(result.copyTarget)}`);
  }
  if (result?.pathResult?.configs?.length) {
    console.log(STATUS.flag('PATH INJECTION:'));
    for (const c of result.pathResult.configs) {
      console.log(`    ${chalk.hex(NEON_GREEN)(c)}`);
    }
  }
  console.log();
  console.log(`  ${chalk.hex('#888888')('To undo:')} ${chalk.hex(NEON_CYAN)('astra persist --revert')}`);
}

// ── SUMMARY ───────────────────────────────────────────────────────────────────
async function displaySummary(recon, scan) {
  console.log();
  console.log();

  // Aurora gradient header
  const headerText = '  ⚡  MISSION COMPLETE — ASTRANETRA  ⚡  ';
  console.log(separator('double', NEON_GREEN));
  console.log(centerText(GRADIENTS.aurora(headerText)));
  console.log(separator('double', NEON_GREEN));
  console.log();

  // Summary in a styled box
  const summaryLines = [
    tableRow('TARGET HOST',      recon?.os?.hostname || '—',                       18, '#888888', NEON_GREEN),
    tableRow('OPERATING SYSTEM', `${recon?.os?.name||'—'} ${recon?.os?.release||''}`, 18, '#888888', NEON_GREEN),
    tableRow('ARCHITECTURE',     recon?.os?.arch||'—',                              18, '#888888', NEON_YELLOW),
    tableRow('CURRENT USER',     recon?.os?.username||'—',                          18, '#888888', NEON_RED),
    tableRow('FILES MAPPED',     (scan?.totalFiles||0).toLocaleString(),            18, '#888888', NEON_GREEN),
    tableRow('TOTAL DATA',       scan?.totalSizeHuman||'—',                         18, '#888888', NEON_CYAN),
    tableRow('HIDDEN FILES',     (scan?.hiddenFileCount||0).toLocaleString(),       18, '#888888', NEON_YELLOW),
    tableRow('SENSITIVE FLAGS',  (scan?.sensitiveFlags||[]).length.toString(),      18, '#888888', NEON_RED),
    tableRow('DASHBOARD',        'dashboard.html',                                  18, '#888888', NEON_CYAN),
    tableRow('EXFIL VIEWER',     'http://localhost:4444',                           18, '#888888', NEON_CYAN),
    tableRow('UNDO ALL',         'astra revert --all',                              18, '#888888', '#888888'),
  ].join('\n');

  console.log(styledBox(summaryLines, {
    title: '⬡ MISSION REPORT',
    borderColor: NEON_GREEN,
    borderStyle: 'double',
  }));

  console.log();
  console.log(separator('double', NEON_GREEN));
  await pulseText('The eye watches only what you show it.', 3, 180);
  console.log(separator('double', NEON_GREEN));
  console.log();
}

// ── MODULE LOADER ─────────────────────────────────────────────────────────────
async function loadModules() {
  const [
    { runSystemRecon },
    { runFileScanner },
    { runExfil, listScans, clearDb },
    { persist, revert: persistRevert },
    { showPath, pathHijackDemo, injectPath, revertPath },
    { createBaseline, diffLatest, watchDir },
    { createFile, readFile, updateFile, deleteFile, moveFile, corruptFile },
    { generateDashboard },
    { exportJson, exportMarkdown, exportCsv, exportAll },
    { startExfilServer, stopExfilServer },
  ] = await Promise.all([
    import('./core/SystemRecon.js'),
    import('./core/FileScanner.js'),
    import('./core/ExfilEngine.js'),
    import('./core/PersistenceEngine.js'),
    import('./core/PathManipulator.js'),
    import('./core/IntegrityMonitor.js'),
    import('./core/CRUDEngine.js'),
    import('./output/DashboardGenerator.js'),
    import('./output/ReportExporter.js'),
    import('./server/exfilServer.js'),
  ]);
  return { runSystemRecon, runFileScanner, runExfil, listScans, clearDb,
           persist, persistRevert, showPath, pathHijackDemo, injectPath, revertPath,
           createBaseline, diffLatest, watchDir, createFile, readFile, updateFile,
           deleteFile, moveFile, corruptFile, generateDashboard,
           exportJson, exportMarkdown, exportCsv, exportAll,
           startExfilServer, stopExfilServer };
}

// ── FULL PIPELINE ─────────────────────────────────────────────────────────────
async function runFullPipeline(mods) {
  await printBanner();

  // 1 — RECON
  await phaseTransition(1, 'System Reconnaissance', '◉');
  await typeWrite('  Fingerprinting target environment…', 12, '#888888');
  await sleep(200);
  const recon = await animatedStep('Collecting system metrics', () => mods.runSystemRecon());
  await displayRecon(recon);

  // 2 — FILE SCAN
  await phaseTransition(2, 'Filesystem Mapping', '◈');
  await typeWrite('  Enumerating all files including hidden…', 12, '#888888');
  console.log();
  const scan = await mods.runFileScanner();
  await displayScan(scan);

  // 3 — READ FILES
  await phaseTransition(3, 'File Access Demonstration', '⚠');
  await displayFileContents();

  // 3.5 — CRUD DEMO
  await phaseTransition(3.5, 'CRUD Operations Demo', '✎');
  console.log();
  console.log(`  ${chalk.hex('#888888')('Demonstrating file manipulation inside sandbox/ — all reversible')}`);
  console.log();
  {
    const demoFile = path.join(process.cwd(), 'sandbox', 'demo_target.txt');

    // CREATE
    const createBorder = gradient([NEON_CYAN, NEON_GREEN]);
    console.log(`  ${createBorder('┌─── CREATE ───────────────────────────────────────┐')}`);
    const cRes = await mods.createFile(demoFile, 'Hello from ASTRANETRA! Original content.\n', 'utf8', true);
    console.log(`  ${chalk.hex(NEON_CYAN)('│')}  ${cRes.success ? chalk.hex(NEON_GREEN)('✓ Created:') : chalk.hex(NEON_RED)('✗ Failed:')} ${chalk.hex(GHOST_WHITE)(demoFile)}`);
    console.log(`  ${chalk.hex(NEON_CYAN)('│')}  ${chalk.hex('#555555')(`Operation: createFile()  Duration: ${cRes.durationMs}ms`)}`);
    console.log(`  ${createBorder('└──────────────────────────────────────────────────┘')}`);
    await sleep(400);

    // READ
    const readBorder = gradient([NEON_GREEN, NEON_CYAN]);
    console.log(`  ${readBorder('┌─── READ ─────────────────────────────────────────┐')}`);
    const rRes = await mods.readFile(demoFile);
    console.log(`  ${chalk.hex(NEON_GREEN)('│')}  ${rRes.success ? chalk.hex(NEON_GREEN)('✓ Read:') : chalk.hex(NEON_RED)('✗ Failed:')} ${chalk.hex(GHOST_WHITE)(demoFile)}`);
    if (rRes.content) console.log(`  ${chalk.hex(NEON_GREEN)('│')}  ${chalk.hex('#888888')(`Content: "${rRes.content.trim()}"`)}`);
    console.log(`  ${chalk.hex(NEON_GREEN)('│')}  ${chalk.hex('#555555')(`Operation: readFile()  Duration: ${rRes.durationMs}ms`)}`);
    console.log(`  ${readBorder('└──────────────────────────────────────────────────┘')}`);
    await sleep(400);

    // UPDATE
    const updateBorder = gradient([NEON_YELLOW, NEON_ORANGE]);
    console.log(`  ${updateBorder('┌─── UPDATE ───────────────────────────────────────┐')}`);
    const uRes = await mods.updateFile(demoFile, '\n[MODIFIED BY ASTRANETRA] Payload injected.\n', 'append');
    console.log(`  ${chalk.hex(NEON_YELLOW)('│')}  ${uRes.success ? chalk.hex(NEON_GREEN)('✓ Updated:') : chalk.hex(NEON_RED)('✗ Failed:')} ${chalk.hex(GHOST_WHITE)(demoFile)}`);
    const vRes = await mods.readFile(demoFile);
    if (vRes.content) console.log(`  ${chalk.hex(NEON_YELLOW)('│')}  ${chalk.hex('#888888')(`Content now: "${vRes.content.trim()}"`)}`);
    console.log(`  ${chalk.hex(NEON_YELLOW)('│')}  ${chalk.hex('#555555')(`Operation: updateFile(append)  Duration: ${uRes.durationMs}ms`)}`);
    console.log(`  ${updateBorder('└──────────────────────────────────────────────────┘')}`);
    await sleep(400);

    // DELETE
    const deleteBorder = gradient([NEON_RED, NEON_MAGENTA]);
    console.log(`  ${deleteBorder('┌─── DELETE ───────────────────────────────────────┐')}`);
    const dRes = await mods.deleteFile(demoFile, false, true);
    console.log(`  ${chalk.hex(NEON_RED)('│')}  ${dRes.success ? chalk.hex(NEON_GREEN)('✓ Deleted:') : chalk.hex(NEON_RED)('✗ Failed:')} ${chalk.hex(GHOST_WHITE)(demoFile)}`);
    if (dRes.dest) console.log(`  ${chalk.hex(NEON_RED)('│')}  ${chalk.hex('#888888')(`Moved to trash: ${dRes.dest}`)}`);
    console.log(`  ${chalk.hex(NEON_RED)('│')}  ${chalk.hex('#555555')(`Operation: deleteFile(trash)  Duration: ${dRes.durationMs}ms`)}`);
    console.log(`  ${deleteBorder('└──────────────────────────────────────────────────┘')}`);
    console.log();
    console.log(`  ${chalk.hex(NEON_GREEN).bold('✓ CRUD CYCLE COMPLETE')}  ${chalk.hex('#888888')('All 4 operations demonstrated safely in sandbox/')}`);
  }

  // 4 — EXFIL
  await phaseTransition(4, 'Exfiltration', '▶');
  await mods.startExfilServer();
  const exfilResult = await mods.runExfil(recon, scan);
  await displayExfil(exfilResult);

  // 5 — REPORTS + DASHBOARD
  await phaseTransition(5, 'Generating Reports & Dashboard', '◇');
  const allData = { recon, scan, exfil: exfilResult };
  await animatedProgressBar('Writing JSON report',     400, 30);
  await mods.exportJson(allData);
  await animatedProgressBar('Writing Markdown report', 350, 30);
  await mods.exportMarkdown(allData);
  await animatedProgressBar('Writing CSV report',      300, 30);
  await mods.exportCsv(allData);
  await animatedProgressBar('Generating dashboard',    500, 30);
  await mods.generateDashboard(allData);

  // 6 — SUMMARY
  await displaySummary(recon, scan);

  // 7 — AUTO-LAUNCH BROWSERS
  console.log(`  ${chalk.hex('#888888')('Auto-launching dashboards in default browser...')}\n`);
  try {
    await open(path.join(process.cwd(), 'dashboard.html'));
    await sleep(1500);
    await open('http://localhost:4444');
  } catch (e) {
    // Silently ignore if running headless
  }
}

// ── HELP ──────────────────────────────────────────────────────────────────────
function printHelp() {
  console.log();

  // Gradient title
  const titleArt = GRADIENTS.cyber('⚡ ASTRANETRA') + chalk.hex('#888888')(' — Astra (weapon) · Netra (eye)');
  console.log(`  ${titleArt}`);
  console.log();

  // Commands section
  const commands = [
    ['astra',                          'Full pipeline (all phases)'],
    ['astra recon',                    'System reconnaissance only'],
    ['astra scan',                     'File system scan only'],
    ['astra exfil',                    'Exfil to local server + DB'],
    ['astra persist',                  'Self-copy + PATH registration'],
    ['astra persist --revert',         'Undo persistence'],
    ['astra path',                     'PATH analysis'],
    ['astra path --demo',              'PATH hijack demo'],
    ['astra integrity --baseline',     'SHA-256 snapshot'],
    ['astra integrity --diff',         'Diff latest snapshots'],
    ['astra integrity --watch',        'Real-time watch mode'],
    ['astra crud corrupt <f> --demo',  'File corruption demo'],
    ['astra db --list',                'List stored scans'],
    ['astra dashboard',                'Regenerate dashboard.html'],
    ['astra dashboard --live',         'Interactive terminal dashboard'],
    ['astra revert --all',             'Undo ALL changes'],
  ];

  let cmdContent = chalk.hex(NEON_YELLOW).bold('COMMANDS:\n\n');
  for (const [cmd, desc] of commands) {
    cmdContent += `  ${chalk.hex(NEON_GREEN)(cmd.padEnd(35))} ${chalk.hex(GHOST_WHITE)(desc)}\n`;
  }

  console.log(boxen(cmdContent.trim(), {
    padding: { top: 1, bottom: 1, left: 2, right: 2 },
    margin: { left: 2, right: 2 },
    borderStyle: 'round',
    borderColor: '#555555',
  }));

  console.log();
}

// ── GRACEFUL SHUTDOWN ─────────────────────────────────────────────────────────
function setupShutdown(mods) {
  const shutdown = () => {
    console.log(`\n${chalk.hex('#888888')('[ASTRANETRA] Shutting down gracefully…')}`);
    logger.flush();
    if (mods?.stopExfilServer) mods.stopExfilServer();
    process.exit(0);
  };
  process.on('SIGINT',  shutdown);
  process.on('SIGTERM', shutdown);
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  const args    = process.argv.slice(2);
  const command = args[0] || '';
  const flags   = new Set(args);
  const positionals = args.filter(a => !a.startsWith('--'));

  if (flags.has('--help') || command === 'help') { printHelp(); return; }

  const mods = await loadModules();
  setupShutdown(mods);

  if (!command) { await runFullPipeline(mods); return; }

  if (command === 'recon') {
    await printBanner();
    await phaseTransition(1, 'System Reconnaissance', '◉');
    const r = await animatedStep('Collecting metrics', () => mods.runSystemRecon());
    await displayRecon(r);
    return;
  }

  if (command === 'scan') {
    await printBanner();
    await phaseTransition(1, 'Filesystem Scan', '◈');
    const s = await mods.runFileScanner();
    await displayScan(s);
    return;
  }

  if (command === 'exfil') {
    const r = await mods.runSystemRecon();
    const s = await mods.runFileScanner();
    await mods.startExfilServer();
    const res = await mods.runExfil(r, s, {
      serverOnly: flags.has('--server-only'),
      dbOnly:     flags.has('--db-only'),
    });
    await displayExfil(res);
    return;
  }

  if (command === 'persist') {
    await printBanner();
    await phaseTransition(1, 'Persistence Engine', '⚑');
    if (flags.has('--revert')) {
      await mods.persistRevert();
    } else {
      const res = await mods.persist();
      await displayPersist(res);
    }
    return;
  }

  if (command === 'path') {
    if (flags.has('--demo'))    { await mods.pathHijackDemo(); }
    else if (flags.has('--revert')) { mods.revertPath(); }
    else if (flags.has('--inject')) {
      const dir = positionals[1];
      if (dir) mods.injectPath(dir);
    }
    else { mods.showPath(); }
    return;
  }

  if (command === 'integrity') {
    if (flags.has('--baseline')) {
      const dir = positionals[1] || process.cwd();
      await mods.createBaseline(dir);
    } else if (flags.has('--diff')) {
      mods.diffLatest();
    } else if (flags.has('--watch')) {
      const dir = positionals[1] || process.cwd();
      await mods.watchDir(dir);
      await new Promise(() => {});
    }
    return;
  }

  if (command === 'crud') {
    const sub  = args[1]; const a2 = args[2]; const a3 = args[3];
    const mode = args.find(a => a.startsWith('--mode='))?.split('=')[1] || 'overwrite';
    if (sub === 'create')  { const r = await mods.createFile(a2, a3||''); console.log(r.success ? chalk.hex(NEON_GREEN)('✓ Created') : chalk.hex(NEON_RED)(`✗ ${r.error}`)); }
    else if (sub === 'read')    { const r = await mods.readFile(a2); if (r.success) console.log(r.content); else console.log(chalk.hex(NEON_RED)(`✗ ${r.error}`)); }
    else if (sub === 'update')  { const r = await mods.updateFile(a2, a3||'', mode); console.log(r.success ? chalk.hex(NEON_GREEN)('✓ Updated') : chalk.hex(NEON_RED)(`✗ ${r.error}`)); }
    else if (sub === 'delete')  { const r = await mods.deleteFile(a2, flags.has('--permanent'), !flags.has('--confirm')); console.log(r.success ? chalk.hex(NEON_GREEN)('✓ Deleted') : chalk.hex(NEON_RED)(`✗ ${r.error||r.reason}`)); }
    else if (sub === 'corrupt') {
      if (!flags.has('--demo')) { console.log(chalk.hex(NEON_RED)('Requires --demo flag')); return; }
      const target = a2 || path.join(process.cwd(),'sandbox','test.txt');
      if (!fs.existsSync(target)) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, 'ASTRANETRA corrupt demo target file.\n', 'utf8');
      }
      const r = await mods.corruptFile(target, flags.has('--force'));
      console.log(r.success ? chalk.hex(NEON_GREEN)('✓ Corrupted') : chalk.hex(NEON_RED)(`✗ ${r.error}`));
    }
    else if (sub === 'move') { const r = await mods.moveFile(a2, a3); console.log(r.success ? chalk.hex(NEON_GREEN)('✓ Moved') : chalk.hex(NEON_RED)(`✗ ${r.error}`)); }
    return;
  }

  if (command === 'db') {
    if (flags.has('--list')) {
      const scans = await mods.listScans();
      if (!scans.length) { console.log(chalk.hex(NEON_YELLOW)('No scans stored.')); return; }
      console.log(`\n${chalk.hex(NEON_CYAN)('Stored Scans:')}`);
      scans.forEach(s => console.log(`  ${chalk.hex(NEON_GREEN)(`#${s.id}`)} ${chalk.hex(GHOST_WHITE)(s.scanned_at)} ${chalk.hex('#888888')('·')} ${chalk.hex(GHOST_WHITE)(s.hostname)} ${chalk.hex('#888888')('·')} ${chalk.hex(NEON_YELLOW)((s.total_files||0).toLocaleString())} files`));
    } else if (flags.has('--clear')) {
      await mods.clearDb();
    }
    return;
  }

  if (command === 'dashboard') {
    // Live interactive dashboard mode
    if (flags.has('--live')) {
      const { createLiveDashboard } = await import('./output/LiveDashboard.js');
      console.log(chalk.hex(NEON_CYAN)('  Loading live dashboard...'));
      const r = await mods.runSystemRecon();
      const s = await mods.runFileScanner();
      createLiveDashboard(r, s);
      await new Promise(() => {}); // Keep alive
      return;
    }

    await printBanner();
    await phaseTransition(1, 'Generating Dashboard', '◇');
    const r = await animatedStep('Collecting metrics', () => mods.runSystemRecon());
    console.log();
    const s = await mods.runFileScanner();
    mods.generateDashboard({ recon: r, scan: s, exfil: {} });
    console.log(`\n  ${chalk.hex('#888888')('Auto-launching...')}`);
    try { await open(path.join(process.cwd(), 'dashboard.html')); } catch(e){}
    return;
  }

  if (command === 'report') {
    await printBanner();
    await phaseTransition(1, 'Generating Reports', '◇');
    const r = await animatedStep('Collecting metrics', () => mods.runSystemRecon());
    console.log();
    const s = await mods.runFileScanner();
    const all = { recon: r, scan: s, exfil: {} };
    const fmt = args.find(a => a.startsWith('--format='))?.split('=')[1]
             || (flags.has('--format') ? args[args.indexOf('--format')+1] : 'all');
    if (fmt==='json') mods.exportJson(all);
    else if (fmt==='md') mods.exportMarkdown(all);
    else if (fmt==='csv') mods.exportCsv(all);
    else mods.exportAll(all);
    return;
  }

  if (command === 'revert' && flags.has('--all')) {
    console.log(`\n${chalk.hex(NEON_YELLOW)('Reverting all ASTRANETRA changes…')}`);
    await mods.persistRevert();
    mods.revertPath();
    console.log(`\n${chalk.hex(NEON_GREEN)('✓ All changes reverted.')}`);
    return;
  }

  console.log(chalk.hex(NEON_RED)(`Unknown command: ${command}`));
  printHelp();
}

main().catch(err => {
  console.error(chalk.hex(NEON_RED)('[FATAL]'), err.message);
  logger.critical('ASTRANETRA', 'FATAL_ERROR', { error: err.message });
  process.exit(1);
});
