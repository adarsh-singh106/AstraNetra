/**
 * TerminalUI.js — Premium terminal visual effects for ASTRANETRA
 * 
 * Provides: gradient banners, Matrix rain, glitch text, animated phase
 * transitions, styled boxes, pulsing text, decrypt animations, and more.
 */

import chalk from 'chalk';
import gradient from 'gradient-string';
import boxen from 'boxen';
import os from 'os';

// ── COLOR PALETTES ───────────────────────────────────────────────────────────
const NEON_GREEN   = '#39FF14';
const NEON_CYAN    = '#00FFFF';
const NEON_MAGENTA = '#FF00FF';
const NEON_RED     = '#FF3131';
const NEON_YELLOW  = '#FFE700';
const NEON_BLUE    = '#4D4DFF';
const NEON_ORANGE  = '#FF6B35';
const DARK_BG      = '#0D1117';
const DIM_GREEN    = '#1A5C2A';
const GHOST_WHITE  = '#C9D1D9';

// Gradient presets
const GRADIENTS = {
  cyber:    gradient(['#00FF87', '#60EFFF']),
  neon:     gradient([NEON_GREEN, NEON_CYAN, NEON_MAGENTA]),
  fire:     gradient(['#FF0000', '#FF6B00', '#FFD700']),
  ice:      gradient(['#00C9FF', '#92FE9D']),
  hacker:   gradient(['#00FF00', '#00CC00', '#009900', '#00FF00']),
  sunset:   gradient(['#FC466B', '#3F5EFB']),
  matrix:   gradient(['#003300', '#00FF00', '#003300']),
  warning:  gradient(['#FF0000', '#FF6600', '#FFFF00']),
  rainbow:  gradient.rainbow,
  passion:  gradient(['#FF512F', '#DD2476']),
  ocean:    gradient(['#2193b0', '#6dd5ed']),
  aurora:   gradient(['#00c6ff', '#0072ff', '#7C3AED', '#F472B6']),
};

// ── UTILITY HELPERS ──────────────────────────────────────────────────────────
const W = () => process.stdout.columns || 100;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '').replace(/\u001b\[.*?m/g, '');
}

function centerText(text, width) {
  const w = width || W();
  const clean = stripAnsi(text);
  const pad = Math.max(0, Math.floor((w - clean.length) / 2));
  return ' '.repeat(pad) + text;
}

function repeatChar(char, count) {
  return char.repeat(Math.max(0, count));
}

// ── MATRIX RAIN EFFECT ───────────────────────────────────────────────────────
const MATRIX_CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF<>{}[]|/\\!@#$%^&*';

async function matrixRain(durationMs = 1800, density = 0.4) {
  const width = W();
  const height = Math.min(process.stdout.rows || 24, 20);
  const columns = new Array(width).fill(0);
  const frames = Math.floor(durationMs / 50);

  // Hide cursor
  process.stdout.write('\x1b[?25l');

  for (let frame = 0; frame < frames; frame++) {
    let output = '';
    for (let y = 0; y < height; y++) {
      let row = '';
      for (let x = 0; x < width; x++) {
        if (columns[x] === y) {
          // Bright leading character
          const ch = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
          row += chalk.hex('#FFFFFF').bold(ch);
        } else if (columns[x] > y && columns[x] - y < 6) {
          // Trail — fading green
          const intensity = Math.max(0, 255 - (columns[x] - y) * 45);
          const ch = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
          row += chalk.rgb(0, intensity, 0)(ch);
        } else if (Math.random() < 0.02) {
          // Random dim flicker
          const ch = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
          row += chalk.hex(DIM_GREEN)(ch);
        } else {
          row += ' ';
        }
      }
      output += row + '\n';
    }

    // Move cursor up and overwrite
    if (frame > 0) process.stdout.write(`\x1b[${height}A`);
    process.stdout.write(output);

    // Advance columns
    for (let x = 0; x < width; x++) {
      if (Math.random() < density * 0.3) {
        columns[x]++;
        if (columns[x] > height + 8) {
          columns[x] = Math.random() < 0.5 ? 0 : -Math.floor(Math.random() * 5);
        }
      }
    }

    await sleep(50);
  }

  // Clear rain area
  process.stdout.write(`\x1b[${height}A`);
  for (let y = 0; y < height; y++) {
    process.stdout.write(' '.repeat(width) + '\n');
  }
  process.stdout.write(`\x1b[${height}A`);
  // Show cursor
  process.stdout.write('\x1b[?25h');
}

// ── GLITCH TEXT EFFECT ───────────────────────────────────────────────────────
const GLITCH_CHARS = '█▓▒░▀▄▌▐│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌';

async function glitchText(text, iterations = 12, delay = 60) {
  const clean = stripAnsi(text);
  const width = W();
  const padLeft = Math.max(0, Math.floor((width - clean.length) / 2));

  for (let i = 0; i < iterations; i++) {
    let glitched = '';
    const glitchIntensity = 1 - (i / iterations); // decreases over time

    for (let j = 0; j < clean.length; j++) {
      if (Math.random() < glitchIntensity * 0.5) {
        const gc = GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
        const colors = [NEON_GREEN, NEON_CYAN, NEON_MAGENTA, NEON_RED];
        const color = colors[Math.floor(Math.random() * colors.length)];
        glitched += chalk.hex(color)(gc);
      } else {
        glitched += chalk.hex(NEON_GREEN).bold(clean[j]);
      }
    }

    process.stdout.write('\r' + ' '.repeat(padLeft) + glitched + ' '.repeat(10));
    await sleep(delay);
  }

  // Final clean version with gradient
  process.stdout.write('\r' + ' '.repeat(width));
  process.stdout.write('\r' + ' '.repeat(padLeft) + GRADIENTS.cyber(clean));
  process.stdout.write('\n');
}

// ── TYPING WITH CURSOR EFFECT ────────────────────────────────────────────────
async function typeWrite(text, delayMs = 18, color = null) {
  const styled = color ? chalk.hex(color) : (t) => t;
  for (const ch of text) {
    process.stdout.write(styled(ch));
    await sleep(delayMs);
  }
  process.stdout.write('\n');
}

async function hackerType(text, delayMs = 8) {
  const clean = stripAnsi(text);
  for (let i = 0; i < clean.length; i++) {
    // Show random char first, then correct char
    if (Math.random() < 0.3 && clean[i] !== ' ') {
      const rnd = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
      process.stdout.write(chalk.hex(NEON_GREEN).dim(rnd));
      await sleep(delayMs);
      process.stdout.write('\b');
    }
    process.stdout.write(chalk.hex(NEON_GREEN)(clean[i]));
    await sleep(delayMs);
  }
  process.stdout.write('\n');
}

// ── DECRYPT ANIMATION ────────────────────────────────────────────────────────
async function decryptReveal(finalText, iterations = 15, delay = 40) {
  const clean = stripAnsi(finalText);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';

  for (let i = 0; i <= iterations; i++) {
    let revealed = '';
    const revealPoint = Math.floor((i / iterations) * clean.length);

    for (let j = 0; j < clean.length; j++) {
      if (j < revealPoint) {
        revealed += chalk.hex(NEON_GREEN).bold(clean[j]);
      } else if (clean[j] === ' ') {
        revealed += ' ';
      } else {
        const rc = chars[Math.floor(Math.random() * chars.length)];
        revealed += chalk.hex('#555555')(rc);
      }
    }

    process.stdout.write('\r  ' + revealed + '  ');
    await sleep(delay);
  }
  process.stdout.write('\n');
}

// ── ANIMATED PROGRESS BAR ────────────────────────────────────────────────────
function progressBar(pct, width = 30, opts = {}) {
  const {
    filledChar = '█',
    emptyChar = '░',
    colorStart = NEON_GREEN,
    colorEnd = NEON_CYAN,
    showPercent = true,
    bracket = true,
  } = opts;

  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;

  // Gradient fill
  let filledStr = '';
  for (let i = 0; i < filled; i++) {
    const ratio = i / width;
    const r = Math.round(parseInt(colorStart.slice(1, 3), 16) * (1 - ratio) + parseInt(colorEnd.slice(1, 3), 16) * ratio);
    const g = Math.round(parseInt(colorStart.slice(3, 5), 16) * (1 - ratio) + parseInt(colorEnd.slice(3, 5), 16) * ratio);
    const b = Math.round(parseInt(colorStart.slice(5, 7), 16) * (1 - ratio) + parseInt(colorEnd.slice(5, 7), 16) * ratio);
    filledStr += chalk.rgb(r, g, b)(filledChar);
  }

  const emptyStr = chalk.hex('#333333')(emptyChar.repeat(empty));
  const pctStr = showPercent ? chalk.hex(GHOST_WHITE)(` ${String(Math.round(pct)).padStart(3)}%`) : '';
  const left = bracket ? chalk.hex('#555555')('[') : '';
  const right = bracket ? chalk.hex('#555555')(']') : '';

  return `${left}${filledStr}${emptyStr}${right}${pctStr}`;
}

async function animatedProgressBar(label, durationMs = 800, width = 35) {
  const steps = 30;
  const stepDelay = durationMs / steps;

  process.stdout.write('\x1b[?25l'); // hide cursor

  for (let i = 0; i <= steps; i++) {
    const pct = (i / steps) * 100;
    const bar = progressBar(pct, width);
    const spinner = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'][i % 10];

    process.stdout.write(`\r  ${chalk.hex(NEON_CYAN)(spinner)} ${chalk.hex(GHOST_WHITE)(label)}  ${bar}`);
    await sleep(stepDelay);
  }

  process.stdout.write(`\r  ${chalk.hex(NEON_GREEN)('✓')} ${chalk.hex(GHOST_WHITE)(label)}  ${progressBar(100, width)}${' '.repeat(5)}\n`);
  process.stdout.write('\x1b[?25h'); // show cursor
}

// ── SCAN LINE EFFECT ─────────────────────────────────────────────────────────
async function scanLineTransition(color = NEON_CYAN) {
  const width = W();
  const chars = '━';

  // Forward sweep
  process.stdout.write('\n');
  for (let i = 0; i <= width; i += 3) {
    const line = chalk.hex(color)(chars.repeat(Math.min(i, width)));
    const remaining = ' '.repeat(Math.max(0, width - i));
    process.stdout.write(`\r${line}${remaining}`);
    await sleep(4);
  }

  // Flash
  process.stdout.write(`\r${chalk.hex(color).bold(chars.repeat(width))}`);
  await sleep(80);

  // Fade
  const fadeColors = [color, '#66CCCC', '#338888', '#1A4444', '#0D2222'];
  for (const fc of fadeColors) {
    process.stdout.write(`\r${chalk.hex(fc)(chars.repeat(width))}`);
    await sleep(30);
  }

  process.stdout.write(`\r${' '.repeat(width)}\r`);
  process.stdout.write('\n');
}

// ── PHASE TRANSITION ─────────────────────────────────────────────────────────
async function phaseTransition(phaseNum, title, icon = '◉') {
  const width = W();

  await scanLineTransition(NEON_CYAN);

  // Phase number with glow effect
  const phaseLabel = `PHASE ${phaseNum}`;
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });

  // Top border
  const topBorder = chalk.hex('#333333')('─'.repeat(width));
  console.log(topBorder);

  // Phase header with gradient
  const headerText = `  ${icon}  ${phaseLabel} — ${title.toUpperCase()}`;
  const timeText = `${timestamp}  `;
  const headerClean = stripAnsi(headerText);
  const spacing = ' '.repeat(Math.max(1, width - headerClean.length - timeText.length));

  console.log(
    GRADIENTS.aurora(headerText) +
    spacing +
    chalk.hex('#555555')(timeText)
  );

  // Bottom border with accent
  const accent = chalk.hex(NEON_CYAN)('━'.repeat(Math.min(20, width)));
  const rest = chalk.hex('#333333')('─'.repeat(Math.max(0, width - 20)));
  console.log(accent + rest);

  console.log();
  await sleep(150);
}

// ── STYLED BOX ───────────────────────────────────────────────────────────────
function styledBox(content, options = {}) {
  const {
    title = '',
    borderColor = NEON_CYAN,
    padding = 1,
    margin = { top: 0, bottom: 0, left: 2, right: 2 },
    borderStyle = 'round',
  } = options;

  return boxen(content, {
    title: title ? ` ${title} ` : undefined,
    titleAlignment: 'left',
    padding: { top: 0, bottom: 0, left: padding, right: padding },
    margin,
    borderStyle,
    borderColor,
    dimBorder: false,
  });
}

// ── STYLED TABLE ROW ─────────────────────────────────────────────────────────
function tableRow(key, value, keyWidth = 18, keyColor = '#888888', valueColor = NEON_GREEN) {
  return `  ${chalk.hex(keyColor).bold(key.padEnd(keyWidth))}  ${chalk.hex(valueColor)(value)}`;
}

// ── ANIMATED COUNTER ─────────────────────────────────────────────────────────
async function countUp(label, target, durationMs = 600, color = NEON_GREEN) {
  const steps = 20;
  const stepDelay = durationMs / steps;

  for (let i = 0; i <= steps; i++) {
    const current = Math.round((i / steps) * target);
    process.stdout.write(`\r  ${chalk.hex('#888888')(label)}  ${chalk.hex(color).bold(current.toLocaleString())}`);
    await sleep(stepDelay);
  }
  process.stdout.write('\n');
}

// ── STATUS INDICATORS ────────────────────────────────────────────────────────
const STATUS = {
  success: (text) => `  ${chalk.hex(NEON_GREEN)('✓')} ${chalk.hex(GHOST_WHITE)(text)}`,
  fail:    (text) => `  ${chalk.hex(NEON_RED)('✗')} ${chalk.hex('#FF6666')(text)}`,
  warn:    (text) => `  ${chalk.hex(NEON_YELLOW)('⚠')} ${chalk.hex('#FFDD57')(text)}`,
  info:    (text) => `  ${chalk.hex(NEON_CYAN)('ℹ')} ${chalk.hex(GHOST_WHITE)(text)}`,
  arrow:   (text) => `  ${chalk.hex(NEON_CYAN)('→')} ${chalk.hex(GHOST_WHITE)(text)}`,
  bullet:  (text) => `  ${chalk.hex('#555555')('●')} ${chalk.hex(GHOST_WHITE)(text)}`,
  flag:    (text) => `  ${chalk.hex(NEON_RED)('⚑')} ${chalk.hex(NEON_YELLOW)(text)}`,
};

// ── TAG / BADGE ──────────────────────────────────────────────────────────────
function badge(label, color = NEON_CYAN) {
  return chalk.hex(color).bold(`[ ${label} ]`);
}

function tag(label, bgColor = NEON_GREEN) {
  return chalk.hex('#000000').bgHex(bgColor).bold(` ${label} `);
}

// ── SEPARATOR LINES ──────────────────────────────────────────────────────────
function separator(style = 'thin', color = '#333333') {
  const width = W();
  const chars = {
    thin:   '─',
    thick:  '━',
    double: '═',
    dotted: '┄',
    dashed: '╌',
  };
  return chalk.hex(color)((chars[style] || chars.thin).repeat(width));
}

// ── PULSE / BLINK EFFECT ─────────────────────────────────────────────────────
async function pulseText(text, pulses = 3, delay = 200) {
  const clean = stripAnsi(text);
  const padLeft = Math.max(0, Math.floor((W() - clean.length) / 2));

  for (let p = 0; p < pulses; p++) {
    // Bright
    process.stdout.write('\r' + ' '.repeat(padLeft) + chalk.hex(NEON_GREEN).bold(clean));
    await sleep(delay);
    // Dim
    process.stdout.write('\r' + ' '.repeat(padLeft) + chalk.hex(DIM_GREEN)(clean));
    await sleep(delay);
  }
  // Final bright
  process.stdout.write('\r' + ' '.repeat(padLeft) + GRADIENTS.cyber(clean) + '\n');
}

// ── COUNTDOWN ────────────────────────────────────────────────────────────────
async function countdown(from = 3) {
  for (let i = from; i > 0; i--) {
    const text = String(i);
    process.stdout.write(`\r${centerText(chalk.hex(NEON_RED).bold(text))}`);
    await sleep(400);
    process.stdout.write(`\r${centerText(chalk.hex('#550000').dim(text))}`);
    await sleep(100);
  }
  process.stdout.write(`\r${centerText(chalk.hex(NEON_GREEN).bold('▶  GO'))}`);
  await sleep(300);
  process.stdout.write(`\r${' '.repeat(W())}\r`);
}

// ── PARTICLE EXPLOSION ──────────────────────────────────────────────────────
async function particleBurst(centerX, width = 40, frames = 8) {
  const particles = '✦✧⊹⋆∗·˚';
  const colors = [NEON_GREEN, NEON_CYAN, NEON_MAGENTA, NEON_YELLOW, '#FFFFFF'];

  for (let f = 0; f < frames; f++) {
    let line = ' '.repeat(width);
    const spread = f * 3;
    const numParticles = Math.max(1, 8 - f);

    for (let p = 0; p < numParticles; p++) {
      const offset = Math.floor(Math.random() * spread * 2) - spread + Math.floor(width / 2);
      if (offset >= 0 && offset < width) {
        const ch = particles[Math.floor(Math.random() * particles.length)];
        const color = colors[Math.floor(Math.random() * colors.length)];
        line = line.substring(0, offset) + chalk.hex(color)(ch) + line.substring(offset + 1);
      }
    }

    process.stdout.write(`\r  ${line}`);
    await sleep(60);
  }
  process.stdout.write(`\r${' '.repeat(width + 4)}\r`);
}

// ── STEP RUNNER (animated step with result) ──────────────────────────────────
async function animatedStep(label, task, opts = {}) {
  const { delay = 0, spinner: useSpinner = true } = opts;
  const frames = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
  let i = 0;
  let done = false;

  process.stdout.write('\x1b[?25l');

  const iv = useSpinner ? setInterval(() => {
    const frame = chalk.hex(NEON_CYAN)(frames[i++ % frames.length]);
    process.stdout.write(`\r  ${frame} ${chalk.hex(GHOST_WHITE)(label)}...`);
  }, 80) : null;

  if (delay) await sleep(delay);
  const result = await task();

  if (iv) clearInterval(iv);
  process.stdout.write(`\r  ${chalk.hex(NEON_GREEN)('✓')} ${chalk.hex(GHOST_WHITE)(label)}${' '.repeat(15)}\n`);
  process.stdout.write('\x1b[?25h');

  return result;
}

// ── EXFIL STEP ANIMATION ────────────────────────────────────────────────────
async function exfilStep(label, delay = 120) {
  const frames = ['◐','◓','◑','◒'];
  let i = 0;

  // Animate for the delay duration
  const startTime = Date.now();
  while (Date.now() - startTime < delay) {
    const frame = chalk.hex(NEON_RED)(frames[i++ % frames.length]);
    const dots = '.'.repeat((i % 4));
    process.stdout.write(`\r  ${frame} ${chalk.hex('#FF6666')(label)}${chalk.hex('#555555')(dots)}${' '.repeat(5)}`);
    await sleep(80);
  }

  process.stdout.write(`\r  ${chalk.hex(NEON_GREEN)('✓')} ${chalk.hex(GHOST_WHITE)(label)}${' '.repeat(15)}\n`);
}

// ── EXPORTS ──────────────────────────────────────────────────────────────────
export {
  // Color constants
  NEON_GREEN, NEON_CYAN, NEON_MAGENTA, NEON_RED, NEON_YELLOW, NEON_BLUE,
  NEON_ORANGE, DARK_BG, DIM_GREEN, GHOST_WHITE,
  GRADIENTS,

  // Utilities
  sleep, stripAnsi, centerText, repeatChar, W,

  // Major effects
  matrixRain,
  glitchText,
  typeWrite,
  hackerType,
  decryptReveal,
  scanLineTransition,
  phaseTransition,
  pulseText,
  countdown,
  particleBurst,

  // UI components
  progressBar,
  animatedProgressBar,
  styledBox,
  tableRow,
  countUp,
  separator,
  badge,
  tag,

  // Status helpers
  STATUS,

  // Animations
  animatedStep,
  exfilStep,
};
