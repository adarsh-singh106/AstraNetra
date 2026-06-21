#!/usr/bin/env node
/**
 * ASTRANETRA — The Watching Weapon
 * Astra (weapon) · Netra (eye)
 */

import path    from 'path';
import fs      from 'fs';
import os      from 'os';
import crypto  from 'crypto';

// ── Bootstrap ────────────────────────────────────────────────────────────────
import { getLogger } from './output/Logger.js';
const logger = getLogger(path.join(process.cwd(), 'logs'));

['logs','snapshots','reports','sandbox','db','.astranetra_trash'].forEach(d =>
  fs.mkdirSync(path.join(process.cwd(), d), { recursive: true })
);

// ── Terminal helpers ──────────────────────────────────────────────────────────
const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  green:   '\x1b[32m',
  bgreen:  '\x1b[92m',
  red:     '\x1b[31m',
  bred:    '\x1b[91m',
  yellow:  '\x1b[33m',
  byellow: '\x1b[93m',
  cyan:    '\x1b[36m',
  bcyan:   '\x1b[96m',
  magenta: '\x1b[35m',
  bmagenta:'\x1b[95m',
  blue:    '\x1b[34m',
  bblue:   '\x1b[94m',
  white:   '\x1b[97m',
  gray:    '\x1b[90m',
  bgBlack: '\x1b[40m',
  bgGreen: '\x1b[42m',
  bgRed:   '\x1b[41m',
};

const W = process.stdout.columns || 100;

function line(char = '─', color = C.gray) {
  return color + char.repeat(W) + C.reset;
}
function box(char = '═', color = C.cyan) {
  return color + char.repeat(W) + C.reset;
}
function center(text, width = W) {
  const clean = text.replace(/\x1b\[[0-9;]*m/g, '');
  const pad = Math.max(0, Math.floor((width - clean.length) / 2));
  return ' '.repeat(pad) + text;
}
function tag(label, color = C.green) {
  return `${color}${C.bold}[ ${label} ]${C.reset}`;
}
function pad(str, n) {
  const clean = str.replace(/\x1b\[[0-9;]*m/g, '');
  return str + ' '.repeat(Math.max(0, n - clean.length));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function typeWrite(text, delayMs = 18) {
  for (const ch of text) {
    process.stdout.write(ch);
    await sleep(delayMs);
  }
  process.stdout.write('\n');
}

function bar(pct, width = 30, filled = '█', empty = '░', colorFill = C.green, colorEmpty = C.gray) {
  const n = Math.round((pct / 100) * width);
  return colorFill + filled.repeat(n) + colorEmpty + empty.repeat(width - n) + C.reset;
}

function spinner(frames = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏']) {
  let i = 0;
  return {
    next: () => frames[i++ % frames.length],
  };
}

async function spinFor(label, ms, task) {
  const sp   = spinner();
  let done   = false;
  const iv   = setInterval(() => {
    process.stdout.write(`\r${C.cyan}${sp.next()}${C.reset} ${label}...`);
  }, 80);
  const result = await task();
  clearInterval(iv);
  process.stdout.write(`\r${C.green}✓${C.reset} ${label}${' '.repeat(10)}\n`);
  return result;
}

// ── BANNER ────────────────────────────────────────────────────────────────────
async function printBanner() {
  console.clear();
  console.log();
  const art = [
    `${C.green}${C.bold}  ░█████╗░░██████╗████████╗██████╗░░█████╗░███╗░░██╗███████╗████████╗██████╗░░█████╗░`,
    `  ██╔══██╗██╔════╝╚══██╔══╝██╔══██╗██╔══██╗████╗░██║██╔════╝╚══██╔══╝██╔══██╗██╔══██╗`,
    `  ███████║╚█████╗░░░░██║░░░██████╔╝███████║██╔██╗██║█████╗░░░░░██║░░░██████╔╝███████║`,
    `  ██╔══██║░╚═══██╗░░░██║░░░██╔══██╗██╔══██║██║╚████║██╔══╝░░░░░██║░░░██╔══██╗██╔══██║`,
    `  ██║░░██║██████╔╝░░░██║░░░██║░░██║██║░░██║██║░╚███║███████╗░░░██║░░░██║░░██║██║░░██║`,
    `  ╚═╝░░╚═╝╚═════╝░░░╚═╝░░░╚═╝░░╚═╝╚═╝░░╚═╝╚═╝░░╚══╝╚══════╝░░░╚═╝░░░╚═╝░░╚═╝╚═╝░░╚═╝${C.reset}`,
  ];
  for (const l of art) { console.log(l); await sleep(60); }
  console.log();
  console.log(center(`${C.gray}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`));
  console.log(center(`${C.bcyan}  Astra ${C.gray}(weapon)  ${C.bcyan}·  Netra ${C.gray}(eye)  ${C.bcyan}—  ${C.white}Educational Virus Behavior Simulator${C.reset}`));
  console.log(center(`${C.gray}  Platform: ${C.yellow}${process.platform}${C.gray}  ·  Node: ${C.yellow}${process.version}${C.gray}  ·  PID: ${C.yellow}${process.pid}${C.gray}  ·  Host: ${C.yellow}${os.hostname()}${C.reset}`));
  console.log(center(`${C.gray}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`));
  console.log();
  await sleep(300);
}

// ── SECTION HEADER ────────────────────────────────────────────────────────────
async function section(title, icon = '◈') {
  console.log();
  console.log(line('─', C.gray));
  console.log(`${C.bmagenta}${C.bold}  ${icon}  ${title.toUpperCase()}${C.reset}  ${C.gray}${new Date().toLocaleTimeString()}${C.reset}`);
  console.log(line('─', C.gray));
  await sleep(100);
}

// ── RECON DISPLAY ─────────────────────────────────────────────────────────────
async function displayRecon(data) {
  const o = data.os; const c = data.cpu; const r = data.ram;

  await typeWrite(`  ${C.gray}TARGET ACQUIRED — ${C.green}${C.bold}${o.hostname}${C.reset}`, 12);
  await sleep(200);

  // OS Panel
  console.log();
  console.log(`  ${C.cyan}╔${'═'.repeat(W - 4)}╗${C.reset}`);
  console.log(`  ${C.cyan}║${C.reset}  ${C.bold}${C.white}SYSTEM PROFILE${C.reset}${' '.repeat(W - 20)}${C.cyan}║${C.reset}`);
  console.log(`  ${C.cyan}╠${'═'.repeat(W - 4)}╣${C.reset}`);

  const rows = [
    ['OS',        `${o.name} ${o.release}`],
    ['ARCH',      o.arch],
    ['HOSTNAME',  o.hostname],
    ['USERNAME',  o.username],
    ['SHELL',     o.shell],
    ['UPTIME',    o.uptime],
    ['HOME DIR',  o.homedir],
    ['NODE.JS',   data.node.nodeVersion],
    ['V8',        data.node.v8Version],
    ['NPM',       data.node.npmVersion],
    ['PID',       String(data.node.pid)],
  ];

  for (const [k, v] of rows) {
    const key = `${C.gray}  ║  ${C.cyan}${C.bold}${k.padEnd(12)}${C.reset}`;
    const val = `${C.green}${v || 'N/A'}`;
    const trail = ' '.repeat(Math.max(0, W - 4 - 14 - (v||'').length - 2));
    console.log(`${key}  ${val}${C.reset}${trail}${C.cyan}║${C.reset}`);
    await sleep(30);
  }
  console.log(`  ${C.cyan}╚${'═'.repeat(W - 4)}╝${C.reset}`);

  // CPU + RAM side by side
  console.log();
  console.log(`  ${tag('CPU', C.yellow)} ${C.white}${c.model}${C.reset}  ${C.gray}${c.cores} cores @ ${c.speedGHz} GHz${C.reset}`);
  console.log();
  const loads = c.loadPerCore || [];
  for (let i = 0; i < loads.length; i++) {
    const pct   = loads[i];
    const color = pct > 80 ? C.red : pct > 50 ? C.yellow : C.green;
    process.stdout.write(`  ${C.gray}Core ${String(i).padStart(2)}  ${C.reset}${bar(pct, 25, '█', '░', color, C.gray)}  ${color}${String(pct).padStart(3)}%${C.reset}\n`);
    await sleep(40);
  }

  // RAM bar
  console.log();
  console.log(`  ${tag('RAM', C.magenta)} ${C.white}${r.usedHuman}${C.gray} used of ${C.white}${r.totalHuman}${C.reset}  ${C.gray}(${r.freeHuman} free)${C.reset}`);
  const ramColor = r.usedPercent > 85 ? C.red : r.usedPercent > 65 ? C.yellow : C.green;
  console.log(`  ${bar(r.usedPercent, 50, '█', '░', ramColor, C.gray)}  ${ramColor}${r.usedPercent}%${C.reset}`);

  // Disk
  if (data.disk?.length) {
    console.log();
    console.log(`  ${tag('DISK', C.blue)}`);
    for (const d of data.disk) {
      const dc = d.usedPercent > 85 ? C.red : d.usedPercent > 65 ? C.yellow : C.green;
      console.log(`  ${C.gray}${d.mount.padEnd(6)}${C.reset} ${bar(d.usedPercent, 30, '█', '░', dc, C.gray)} ${dc}${d.usedPercent}%${C.reset}  ${C.gray}${d.usedHuman} / ${d.totalHuman}${C.reset}`);
      await sleep(40);
    }
  }

  // Network
  if (data.network?.length) {
    console.log();
    console.log(`  ${tag('NETWORK', C.cyan)}`);
    const nets = data.network.filter(n => !n.internal && n.family === 'IPv4').slice(0, 5);
    for (const n of nets) {
      console.log(`  ${C.gray}${(n.adapter||'').padEnd(16)}${C.reset} ${C.green}${n.address.padEnd(18)}${C.reset} ${C.gray}MAC: ${C.yellow}${n.mac}${C.reset}`);
      await sleep(30);
    }
  }

  // ENV snapshot — actually show values
  if (data.env && Object.keys(data.env).length) {
    console.log();
    console.log(`  ${tag('ENVIRONMENT', C.bred)}`);
    for (const [k, v] of Object.entries(data.env)) {
      if (k === 'PATH') continue; // too long, show separately
      const display = (v || '').slice(0, W - 30);
      console.log(`  ${C.red}${C.bold}${k.padEnd(18)}${C.reset} ${C.byellow}${display}${(v||'').length > W-30 ? '…' : ''}${C.reset}`);
      await sleep(25);
    }
    // PATH — show split entries
    if (data.env.PATH) {
      const sep = process.platform === 'win32' ? ';' : ':';
      const entries = data.env.PATH.split(sep).slice(0, 8);
      console.log(`  ${C.red}${C.bold}PATH${C.reset}`);
      for (const e of entries) {
        console.log(`    ${C.gray}→${C.reset} ${C.byellow}${e}${C.reset}`);
        await sleep(15);
      }
      console.log(`    ${C.gray}(+${data.env.PATH.split(sep).length - 8} more entries)${C.reset}`);
    }
  }
}

// ── SCAN DISPLAY ──────────────────────────────────────────────────────────────
async function displayScan(data) {
  // Stats panel
  console.log();
  const statRows = [
    [`TOTAL FILES`,    `${C.bgreen}${(data.totalFiles||0).toLocaleString()}${C.reset}`],
    [`DIRECTORIES`,    `${C.bcyan}${(data.totalDirectories||0).toLocaleString()}${C.reset}`],
    [`TOTAL SIZE`,     `${C.bblue}${data.totalSizeHuman||'—'}${C.reset}`],
    [`HIDDEN FILES`,   `${C.byellow}${(data.hiddenFileCount||0).toLocaleString()}${C.reset}  ${C.gray}← dotfiles & hidden attrs${C.reset}`],
    [`SENSITIVE FLAGS`,`${C.bred}${C.bold}${(data.sensitiveFlags||[]).length}${C.reset}  ${C.gray}← .env, .key, id_rsa, .pem…${C.reset}`],
    [`INACCESSIBLE`,   `${C.gray}${(data.inaccessiblePaths||[]).length}${C.reset}  ${C.gray}← permission denied${C.reset}`],
    [`SCAN TIME`,      `${C.green}${((data.scanDurationMs||0)/1000).toFixed(2)}s${C.reset}`],
  ];

  console.log(`  ${C.cyan}┌${'─'.repeat(W-4)}┐${C.reset}`);
  for (const [k, v] of statRows) {
    const clean = v.replace(/\x1b\[[0-9;]*m/g, '');
    const trail = ' '.repeat(Math.max(0, W - 4 - 20 - clean.length - 2));
    console.log(`  ${C.cyan}│${C.reset}  ${C.gray}${k.padEnd(18)}${C.reset}  ${v}${trail}${C.cyan}│${C.reset}`);
    await sleep(35);
  }
  console.log(`  ${C.cyan}└${'─'.repeat(W-4)}┘${C.reset}`);

  // Extension chart
  if (data.topExtensions?.length) {
    console.log();
    console.log(`  ${tag('FILE TYPES', C.cyan)}`);
    const top = data.topExtensions.slice(0, 12);
    const max = top[0]?.count || 1;
    for (const e of top) {
      const pct  = Math.round((e.count / max) * 100);
      const bLen = Math.round((e.count / max) * 28);
      const ext  = (e.ext || '(none)').padEnd(10);
      const cnt  = String(e.count).padStart(7);
      console.log(`  ${C.gray}${ext}${C.reset} ${C.green}${'█'.repeat(bLen)}${C.gray}${'░'.repeat(28-bLen)}${C.reset} ${C.byellow}${cnt}${C.reset}`);
      await sleep(30);
    }
  }

  // Sensitive flags — actually reveal them
  if (data.sensitiveFlags?.length) {
    console.log();
    console.log(`  ${C.bred}${C.bold}⚠  SENSITIVE FILES DETECTED${C.reset}`);
    console.log(`  ${C.gray}These matched patterns: .env .key .pem id_rsa .p12 credentials${C.reset}`);
    console.log(`  ${C.gray}Paths only — contents NOT read${C.reset}`);
    console.log();
    for (const fp of data.sensitiveFlags.slice(0, 20)) {
      await sleep(40);
      process.stdout.write(`  ${C.red}⚑${C.reset} ${C.byellow}${fp}${C.reset}\n`);
    }
    if (data.sensitiveFlags.length > 20) {
      console.log(`  ${C.gray}  … and ${data.sensitiveFlags.length - 20} more (see reports/report.json)${C.reset}`);
    }
  }

  // Largest files
  if (data.largestFiles?.length) {
    console.log();
    console.log(`  ${tag('LARGEST FILES', C.magenta)}`);
    for (const f of data.largestFiles.slice(0, 8)) {
      const name = path.basename(f.path);
      console.log(`  ${C.green}${f.sizeHuman.padEnd(12)}${C.reset} ${C.gray}${f.ext?.padEnd(8)||''.padEnd(8)}${C.reset} ${C.white}${name}${C.reset}`);
      console.log(`  ${C.gray}             ${f.path}${C.reset}`);
      await sleep(35);
    }
  }

  // Size distribution bars
  if (data.sizeDistribution) {
    console.log();
    console.log(`  ${tag('SIZE DISTRIBUTION', C.blue)}`);
    const dist = [
      ['< 10 MB',     data.sizeDistribution.under10MB    || 0, C.green],
      ['10–100 MB',   data.sizeDistribution['10MB_100MB']|| 0, C.cyan],
      ['100 MB–1 GB', data.sizeDistribution['100MB_1GB'] || 0, C.yellow],
      ['1–5 GB',      data.sizeDistribution['1GB_5GB']   || 0, C.bmagenta],
      ['> 5 GB',      data.sizeDistribution.over5GB      || 0, C.red],
    ];
    const distMax = Math.max(...dist.map(d => d[1]), 1);
    for (const [label, count, color] of dist) {
      const bLen = Math.round((count / distMax) * 32);
      console.log(`  ${C.gray}${label.padEnd(12)}${C.reset} ${color}${'█'.repeat(bLen)}${C.gray}${'░'.repeat(32-bLen)}${C.reset} ${color}${count.toLocaleString()}${C.reset}`);
      await sleep(40);
    }
  }
}

// ── READ & DISPLAY actual file content ───────────────────────────────────────
async function displayFileContents() {
  console.log();
  console.log(`  ${C.bred}${C.bold}⚡ READING REAL FILES FROM YOUR SYSTEM${C.reset}`);
  console.log(`  ${C.gray}Demonstrating file access — this is what a virus does first${C.reset}`);
  console.log();

  const targets = [];

  // Collect real readable files
  const candidates = [
    // common files on all OS
    path.join(os.homedir(), 'Desktop'),
    path.join(os.homedir(), '.bashrc'),
    path.join(os.homedir(), '.zshrc'),
    path.join(os.homedir(), '.profile'),
    path.join(os.homedir(), '.npmrc'),
    path.join(os.homedir(), 'Documents'),
    // Windows specific
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'Desktop') : null,
    'C:\\Windows\\System32\\drivers\\etc\\hosts',
    // Unix
    '/etc/hostname',
    '/etc/shells',
    '/etc/timezone',
    // current project
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

  // Also grab first .txt or .log we find in home
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

  for (const fp of targets) {
    try {
      const content = fs.readFileSync(fp, 'utf8');
      const lines   = content.split('\n').slice(0, 12);
      console.log(`  ${C.cyan}╔══ ${C.bold}${C.white}READING:${C.reset} ${C.byellow}${fp}${C.reset}`);
      console.log(`  ${C.cyan}║${C.reset}`);
      for (const l of lines) {
        await sleep(18);
        console.log(`  ${C.cyan}║${C.reset}  ${C.gray}${l.slice(0, W - 8)}${C.reset}`);
      }
      if (content.split('\n').length > 12) {
        console.log(`  ${C.cyan}║${C.reset}  ${C.gray}… (${content.split('\n').length - 12} more lines)${C.reset}`);
      }
      console.log(`  ${C.cyan}╚══ ${C.green}✓ READ COMPLETE  ${C.gray}${content.length} bytes  SHA-256: ${crypto.createHash('sha256').update(content).digest('hex').slice(0,16)}…${C.reset}`);
      console.log();
      await sleep(300);
    } catch (e) {
      console.log(`  ${C.red}✗ Could not read: ${fp}${C.reset}`);
    }
  }
}

// ── EXFIL DISPLAY ─────────────────────────────────────────────────────────────
async function displayExfil(result) {
  console.log();
  await typeWrite(`  ${C.red}${C.bold}INITIATING DATA EXFILTRATION SEQUENCE…${C.reset}`, 15);
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
    process.stdout.write(`  ${C.yellow}→${C.reset}  ${step}`);
    await sleep(delay);
    process.stdout.write(`  ${C.green}✓${C.reset}\n`);
  }

  console.log();
  console.log(`  ${C.green}╔══════════════════════════════════════════╗${C.reset}`);
  console.log(`  ${C.green}║${C.reset}  ${C.bold}${C.white}EXFIL COMPLETE${C.reset}                          ${C.green}║${C.reset}`);
  console.log(`  ${C.green}╠══════════════════════════════════════════╣${C.reset}`);
  console.log(`  ${C.green}║${C.reset}  Server  ${C.bcyan}http://localhost:4444${C.reset}           ${C.green}║${C.reset}`);
  console.log(`  ${C.green}║${C.reset}  DB      ${C.byellow}db/astranetra.db${C.reset}                ${C.green}║${C.reset}`);
  console.log(`  ${C.green}║${C.reset}  Payload ${C.bmagenta}${String(result?.payload ? JSON.stringify(result.payload).length : '—').padEnd(8)}${C.reset} bytes               ${C.green}║${C.reset}`);
  console.log(`  ${C.green}╚══════════════════════════════════════════╝${C.reset}`);
}

// ── PERSIST DISPLAY ───────────────────────────────────────────────────────────
async function displayPersist(result) {
  console.log();
  await typeWrite(`  ${C.bred}${C.bold}ESTABLISHING PERSISTENCE…${C.reset}`, 15);
  await sleep(200);

  const steps = [
    `Locating startup directory for ${process.platform}`,
    'Copying payload to startup location',
    'Registering in PATH via shell config',
    'Verifying persistence entries',
    'Confirming reboot survival',
  ];

  for (const step of steps) {
    await sleep(120);
    console.log(`  ${C.red}→${C.reset}  ${step}  ${C.green}✓${C.reset}`);
  }

  console.log();
  if (result?.copyTarget) {
    console.log(`  ${C.byellow}⚑ STARTUP COPY:${C.reset}`);
    console.log(`    ${C.green}${result.copyTarget}${C.reset}`);
  }
  if (result?.pathResult?.configs?.length) {
    console.log(`  ${C.byellow}⚑ PATH INJECTION:${C.reset}`);
    for (const c of result.pathResult.configs) {
      console.log(`    ${C.green}${c}${C.reset}`);
    }
  }
  console.log();
  console.log(`  ${C.gray}To undo: ${C.cyan}node index.js persist --revert${C.reset}`);
}

// ── SUMMARY ───────────────────────────────────────────────────────────────────
async function displaySummary(recon, scan) {
  console.log();
  console.log();
  console.log(box('═', C.green));
  console.log(center(`${C.bgreen}${C.bold}  ⚡  MISSION COMPLETE — ASTRANETRA  ⚡  ${C.reset}`));
  console.log(box('═', C.green));
  console.log();

  const summary = [
    ['TARGET HOST',     `${C.bgreen}${recon?.os?.hostname || '—'}${C.reset}`],
    ['OPERATING SYSTEM',`${C.bgreen}${recon?.os?.name||'—'} ${recon?.os?.release||''}${C.reset}`],
    ['ARCHITECTURE',    `${C.byellow}${recon?.os?.arch||'—'}${C.reset}`],
    ['CURRENT USER',    `${C.bred}${recon?.os?.username||'—'}${C.reset}`],
    ['FILES MAPPED',    `${C.bgreen}${(scan?.totalFiles||0).toLocaleString()}${C.reset}`],
    ['TOTAL DATA',      `${C.bcyan}${scan?.totalSizeHuman||'—'}${C.reset}`],
    ['HIDDEN FILES',    `${C.byellow}${(scan?.hiddenFileCount||0).toLocaleString()}${C.reset}`],
    ['SENSITIVE FLAGS', `${C.bred}${(scan?.sensitiveFlags||[]).length}${C.reset}`],
    ['DASHBOARD',       `${C.bcyan}dashboard.html${C.reset}`],
    ['EXFIL VIEWER',   `${C.bcyan}http://localhost:4444${C.reset}`],
    ['UNDO ALL',        `${C.gray}node index.js revert --all${C.reset}`],
  ];

  for (const [k, v] of summary) {
    const clean = v.replace(/\x1b\[[0-9;]*m/g, '');
    console.log(`  ${C.gray}${C.bold}${k.padEnd(20)}${C.reset}  ${v}`);
    await sleep(50);
  }

  console.log();
  console.log(box('═', C.green));
  console.log(center(`${C.gray}  The eye watches only what you show it.${C.reset}`));
  console.log(box('═', C.green));
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
  await section('PHASE 1 — SYSTEM RECONNAISSANCE', '◉');
  await typeWrite(`  ${C.gray}Fingerprinting target environment…${C.reset}`, 12);
  await sleep(200);
  const recon = await spinFor('Collecting system metrics', 0, () => mods.runSystemRecon());
  await displayRecon(recon);

  // 2 — FILE SCAN
  await section('PHASE 2 — FILESYSTEM MAPPING', '◈');
  await typeWrite(`  ${C.gray}Enumerating all files including hidden…${C.reset}`, 12);
  console.log();
  const scan = await mods.runFileScanner();
  await displayScan(scan);

  // 3 — READ FILES (the flashy part)
  await section('PHASE 3 — FILE ACCESS DEMONSTRATION', '⚠');
  await displayFileContents();

  // 4 — EXFIL
  await section('PHASE 4 — EXFILTRATION', '▶');
  await mods.startExfilServer();
  const exfilResult = await mods.runExfil(recon, scan);
  await displayExfil(exfilResult);

  // 5 — REPORTS + DASHBOARD
  await section('PHASE 5 — GENERATING REPORTS & DASHBOARD', '◇');
  const allData = { recon, scan, exfil: exfilResult };
  await spinFor('Writing JSON report',     0, () => { mods.exportJson(allData); return true; });
  await spinFor('Writing Markdown report', 0, () => { mods.exportMarkdown(allData); return true; });
  await spinFor('Writing CSV report',      0, () => { mods.exportCsv(allData); return true; });
  await spinFor('Generating dashboard',    0, () => { mods.generateDashboard(allData); return true; });

  // 6 — SUMMARY
  await displaySummary(recon, scan);
}

// ── HELP ──────────────────────────────────────────────────────────────────────
function printHelp() {
  console.log(`
${C.bgreen}${C.bold}⚡ ASTRANETRA${C.reset} ${C.gray}— Astra (weapon) · Netra (eye)${C.reset}

${C.yellow}COMMANDS:${C.reset}
  ${C.green}node index.js${C.reset}                   Full pipeline (all phases)
  ${C.green}node index.js recon${C.reset}             System reconnaissance only
  ${C.green}node index.js scan${C.reset}              File system scan only
  ${C.green}node index.js exfil${C.reset}             Exfil to local server + DB
  ${C.green}node index.js persist${C.reset}           Self-copy + PATH registration
  ${C.green}node index.js persist --revert${C.reset}  Undo persistence
  ${C.green}node index.js path${C.reset}              PATH analysis
  ${C.green}node index.js path --demo${C.reset}       PATH hijack demo
  ${C.green}node index.js integrity --baseline${C.reset}  SHA-256 snapshot
  ${C.green}node index.js integrity --diff${C.reset}      Diff latest snapshots
  ${C.green}node index.js integrity --watch${C.reset}     Real-time watch mode
  ${C.green}node index.js crud corrupt sandbox/test.txt --demo${C.reset}
  ${C.green}node index.js db --list${C.reset}         List stored scans
  ${C.green}node index.js dashboard${C.reset}         Regenerate dashboard.html
  ${C.green}node index.js revert --all${C.reset}      Undo ALL changes
`);
}

// ── GRACEFUL SHUTDOWN ─────────────────────────────────────────────────────────
function setupShutdown(mods) {
  const shutdown = () => {
    console.log(`\n${C.gray}[ASTRANETRA] Shutting down gracefully…${C.reset}`);
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
    await section('SYSTEM RECONNAISSANCE', '◉');
    const r = await spinFor('Collecting metrics', 0, () => mods.runSystemRecon());
    await displayRecon(r);
    return;
  }

  if (command === 'scan') {
    await printBanner();
    await section('FILESYSTEM SCAN', '◈');
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
    await section('PERSISTENCE ENGINE', '⚑');
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
    if (sub === 'create')  { const r = await mods.createFile(a2, a3||''); console.log(r.success ? `${C.green}✓ Created${C.reset}` : `${C.red}✗ ${r.error}${C.reset}`); }
    else if (sub === 'read')    { const r = await mods.readFile(a2); if (r.success) console.log(r.content); else console.log(`${C.red}✗ ${r.error}${C.reset}`); }
    else if (sub === 'update')  { const r = await mods.updateFile(a2, a3||'', mode); console.log(r.success ? `${C.green}✓ Updated${C.reset}` : `${C.red}✗ ${r.error}${C.reset}`); }
    else if (sub === 'delete')  { const r = await mods.deleteFile(a2, flags.has('--permanent'), !flags.has('--confirm')); console.log(r.success ? `${C.green}✓ Deleted${C.reset}` : `${C.red}✗ ${r.error||r.reason}${C.reset}`); }
    else if (sub === 'corrupt') {
      if (!flags.has('--demo')) { console.log(`${C.red}Requires --demo flag${C.reset}`); return; }
      const target = a2 || path.join(process.cwd(),'sandbox','test.txt');
      if (!fs.existsSync(target)) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, 'ASTRANETRA corrupt demo target file.\n', 'utf8');
      }
      const r = await mods.corruptFile(target, flags.has('--force'));
      console.log(r.success ? `${C.green}✓ Corrupted${C.reset}` : `${C.red}✗ ${r.error}${C.reset}`);
    }
    else if (sub === 'move') { const r = await mods.moveFile(a2, a3); console.log(r.success ? `${C.green}✓ Moved${C.reset}` : `${C.red}✗ ${r.error}${C.reset}`); }
    return;
  }

  if (command === 'db') {
    if (flags.has('--list')) {
      const scans = await mods.listScans();
      if (!scans.length) { console.log(`${C.yellow}No scans stored.${C.reset}`); return; }
      console.log(`\n${C.cyan}Stored Scans:${C.reset}`);
      scans.forEach(s => console.log(`  ${C.green}#${s.id}${C.reset} ${s.scanned_at} · ${s.hostname} · ${(s.total_files||0).toLocaleString()} files`));
    } else if (flags.has('--clear')) {
      await mods.clearDb();
    }
    return;
  }

  if (command === 'dashboard') {
    const r = await mods.runSystemRecon();
    mods.generateDashboard({ recon: r, scan: {}, exfil: {} });
    return;
  }

  if (command === 'report') {
    const r = await mods.runSystemRecon();
    const all = { recon: r, scan: {}, exfil: {} };
    const fmt = args.find(a => a.startsWith('--format='))?.split('=')[1]
             || (flags.has('--format') ? args[args.indexOf('--format')+1] : 'all');
    if (fmt==='json') mods.exportJson(all);
    else if (fmt==='md') mods.exportMarkdown(all);
    else if (fmt==='csv') mods.exportCsv(all);
    else mods.exportAll(all);
    return;
  }

  if (command === 'revert' && flags.has('--all')) {
    console.log(`\n${C.yellow}Reverting all ASTRANETRA changes…${C.reset}`);
    await mods.persistRevert();
    mods.revertPath();
    console.log(`\n${C.green}✓ All changes reverted.${C.reset}`);
    return;
  }

  console.log(`${C.red}Unknown command: ${command}${C.reset}`);
  printHelp();
}

main().catch(err => {
  console.error(`${C.red}[FATAL]${C.reset}`, err.message);
  logger.critical('ASTRANETRA', 'FATAL_ERROR', { error: err.message });
  process.exit(1);
});
