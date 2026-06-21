/**
 * LiveDashboard.js — Full-screen interactive terminal dashboard for ASTRANETRA
 * 
 * Uses blessed + blessed-contrib to create a real-time hacker-style
 * monitoring dashboard with gauges, charts, logs, tables, and more.
 * 
 * Launch: `astra dashboard --live`
 */

import { createRequire } from 'module';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { getLogger } from './Logger.js';

const require = createRequire(import.meta.url);
const blessed = require('blessed');
const contrib = require('blessed-contrib');

// ── COLOR SCHEME ─────────────────────────────────────────────────────────────
const COLORS = {
  primary:   'green',
  secondary: 'cyan',
  accent:    'magenta',
  warning:   'yellow',
  danger:    'red',
  dim:       'gray',
  bright:    'white',
};

// ── CREATE DASHBOARD ─────────────────────────────────────────────────────────
export function createLiveDashboard(reconData, scanData) {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'ASTRANETRA — Live Dashboard',
    fullUnicode: true,
    dockBorders: true,
    autoPadding: true,
  });

  const grid = new contrib.grid({
    rows: 12,
    cols: 12,
    screen: screen,
  });

  // ── ROW 0-2: HEADER + CPU GAUGE + RAM DONUT ────────────────────────────
  
  // LCD Title Display
  const lcd = grid.set(0, 0, 2, 4, contrib.lcd, {
    label: ' ASTRANETRA ',
    segmentWidth: 0.06,
    segmentInterval: 0.11,
    strokeWidth: 0.1,
    elements: 8,
    display: 'ACTIVE',
    color: 'green',
    elementSpacing: 4,
    elementPadding: 2,
  });

  // CPU Gauge
  const cpuGauge = grid.set(0, 4, 2, 4, contrib.gauge, {
    label: ' CPU LOAD ',
    stroke: 'green',
    fill: 'white',
    border: { type: 'line', fg: 'cyan' },
  });

  // RAM Donut
  const ramDonut = grid.set(0, 8, 2, 4, contrib.donut, {
    label: ' MEMORY ',
    radius: 10,
    arcWidth: 3,
    yPadding: 1,
    border: { type: 'line', fg: 'cyan' },
    data: [
      { label: 'Used', percent: 0, color: 'green' },
    ],
  });

  // ── ROW 2-6: CPU SPARKLINE + FILE TYPE BAR CHART ───────────────────────

  // CPU History Sparkline  
  const cpuSparkline = grid.set(2, 0, 4, 6, contrib.sparkline, {
    label: ' CPU HISTORY (per core) ',
    tags: true,
    style: {
      fg: 'cyan',
      titleFg: 'white',
      border: { fg: 'cyan' },
    },
  });

  // File Type Bar Chart
  const fileTypeBar = grid.set(2, 6, 4, 6, contrib.bar, {
    label: ' FILE TYPES DISTRIBUTION ',
    barWidth: 6,
    barSpacing: 2,
    maxHeight: 15,
    style: { fg: 'green' },
    border: { type: 'line', fg: 'cyan' },
  });

  // ── ROW 6-9: OPERATION LOG + SENSITIVE FILES TABLE ─────────────────────

  // Live Operation Log
  const opLog = grid.set(6, 0, 3, 6, contrib.log, {
    label: ' OPERATION LOG ',
    fg: 'green',
    selectedFg: 'green',
    tags: true,
    border: { type: 'line', fg: 'green' },
    style: {
      fg: 'green',
      border: { fg: 'green' },
    },
    bufferLength: 50,
  });

  // Sensitive Files Table
  const sensitiveTable = grid.set(6, 6, 3, 6, contrib.table, {
    keys: true,
    fg: 'green',
    label: ' ⚠ SENSITIVE FILES DETECTED ',
    columnSpacing: 2,
    columnWidth: [35, 10, 8],
    border: { type: 'line', fg: 'red' },
    style: {
      fg: 'green',
      border: { fg: 'red' },
      header: { fg: 'red', bold: true },
    },
  });

  // ── ROW 9-12: DISK USAGE + SYSTEM INFO + NETWORK ──────────────────────

  // Disk Usage Gauge List
  const diskGauge = grid.set(9, 0, 3, 4, contrib.gaugeList, {
    label: ' DISK USAGE ',
    gauges: [],
    border: { type: 'line', fg: 'cyan' },
    style: { border: { fg: 'cyan' } },
  });

  // System Info Box
  const sysInfo = grid.set(9, 4, 3, 4, blessed.box, {
    label: ' SYSTEM PROFILE ',
    tags: true,
    border: { type: 'line', fg: 'cyan' },
    style: {
      fg: 'green',
      border: { fg: 'cyan' },
    },
    padding: { left: 1, right: 1, top: 0, bottom: 0 },
  });

  // Network Info Box
  const netInfo = grid.set(9, 8, 3, 4, blessed.box, {
    label: ' NETWORK ',
    tags: true,
    border: { type: 'line', fg: 'cyan' },
    style: {
      fg: 'green',
      border: { fg: 'cyan' },
    },
    padding: { left: 1, right: 1, top: 0, bottom: 0 },
  });

  // ── POPULATE DATA ──────────────────────────────────────────────────────

  function populateRecon(data) {
    if (!data) return;

    const o = data.os || {};
    const c = data.cpu || {};
    const r = data.ram || {};

    // CPU Gauge
    const avgLoad = c.loadPerCore?.length
      ? Math.round(c.loadPerCore.reduce((a, b) => a + b, 0) / c.loadPerCore.length)
      : 0;
    cpuGauge.setData(avgLoad);

    // RAM Donut
    ramDonut.setData([
      { label: `Used ${r.usedHuman || ''}`, percent: r.usedPercent || 0, color: (r.usedPercent || 0) > 80 ? 'red' : 'green' },
    ]);

    // CPU Sparkline
    if (c.loadPerCore?.length) {
      const labels = c.loadPerCore.map((_, i) => `Core ${i}`);
      const data = c.loadPerCore.map(load => {
        // Generate fake history around the current value for sparkline
        const history = [];
        for (let j = 0; j < 20; j++) {
          history.push(Math.max(0, Math.min(100, load + (Math.random() - 0.5) * 20)));
        }
        return history;
      });
      cpuSparkline.setData(labels, data);
    }

    // System Info
    sysInfo.setContent(
      `{green-fg}{bold}${o.hostname || 'Unknown'}{/bold}{/green-fg}\n` +
      `{gray-fg}OS:{/gray-fg}    {cyan-fg}${o.name || ''} ${o.release || ''}{/cyan-fg}\n` +
      `{gray-fg}ARCH:{/gray-fg}  {yellow-fg}${o.arch || ''}{/yellow-fg}\n` +
      `{gray-fg}USER:{/gray-fg}  {red-fg}${o.username || ''}{/red-fg}\n` +
      `{gray-fg}CPU:{/gray-fg}   {white-fg}${c.cores || 0} cores{/white-fg}\n` +
      `{gray-fg}SPEED:{/gray-fg} {white-fg}${c.speedGHz || 0} GHz{/white-fg}\n` +
      `{gray-fg}UP:{/gray-fg}    {green-fg}${o.uptime || ''}{/green-fg}`
    );

    // Network
    if (data.network?.length) {
      const nets = data.network.filter(n => !n.internal && n.family === 'IPv4').slice(0, 4);
      let netContent = '';
      for (const n of nets) {
        netContent += `{green-fg}${n.address || ''}{/green-fg}\n`;
        netContent += `{gray-fg}${(n.adapter || '').slice(0, 18)}{/gray-fg}\n`;
        netContent += `{yellow-fg}${n.mac || ''}{/yellow-fg}\n`;
        netContent += '\n';
      }
      netInfo.setContent(netContent);
    }

    // Disk
    if (data.disk?.length) {
      const gauges = data.disk.slice(0, 4).map(d => ({
        percent: d.usedPercent || 0,
        label: d.mount || '?',
        color: (d.usedPercent || 0) > 85 ? 'red' : (d.usedPercent || 0) > 65 ? 'yellow' : 'green',
      }));
      // gaugeList expects an array of gauge values
      diskGauge.setData(gauges.map(g => g.percent));
    }
  }

  function populateScan(data) {
    if (!data) return;

    // File type bar chart
    if (data.topExtensions?.length) {
      const top = data.topExtensions.slice(0, 10);
      fileTypeBar.setData({
        titles: top.map(e => e.ext || 'none'),
        data: top.map(e => e.count),
      });
    }

    // Sensitive files table
    if (data.sensitiveFlags?.length) {
      const tableData = data.sensitiveFlags.slice(0, 15).map(fp => {
        const ext = path.extname(fp) || '—';
        const name = path.basename(fp);
        return [name, ext, 'HIGH'];
      });
      sensitiveTable.setData({
        headers: ['FILENAME', 'TYPE', 'RISK'],
        data: tableData,
      });
    }
  }

  // ── LOGGER INTEGRATION ─────────────────────────────────────────────────
  const logger = getLogger(path.join(process.cwd(), 'logs'));

  // Initial log entries
  opLog.log('{green-fg}[INIT]{/green-fg} ASTRANETRA Live Dashboard started');
  opLog.log(`{cyan-fg}[INFO]{/cyan-fg} Node ${process.version} on ${process.platform}`);
  opLog.log(`{cyan-fg}[INFO]{/cyan-fg} PID: ${process.pid} | Host: ${os.hostname()}`);

  if (reconData) {
    opLog.log('{green-fg}[RECON]{/green-fg} System reconnaissance data loaded');
    populateRecon(reconData);
  }
  if (scanData) {
    opLog.log(`{green-fg}[SCAN]{/green-fg} File scan data loaded — ${(scanData.totalFiles || 0).toLocaleString()} files mapped`);
    populateScan(scanData);
  }

  // Live logger listener
  logger.onLog((entry) => {
    const levelColors = {
      DEBUG:    '{gray-fg}',
      INFO:     '{cyan-fg}',
      WARN:     '{yellow-fg}',
      ERROR:    '{red-fg}',
      CRITICAL: '{magenta-fg}',
    };
    const color = levelColors[entry.level] || '{white-fg}';
    const closeColor = color.replace('-fg}', '-fg}').replace('{', '{/');
    opLog.log(`${color}[${entry.level}]${closeColor} {gray-fg}[${entry.module}]{/gray-fg} ${entry.event}`);
    screen.render();
  });

  // ── LIVE UPDATES ───────────────────────────────────────────────────────
  let tickCount = 0;
  const updateInterval = setInterval(() => {
    tickCount++;

    // Update LCD display
    const displays = ['ACTIVE', 'SCAN  ', 'WATCH ', 'GUARD '];
    lcd.setDisplay(displays[tickCount % displays.length]);

    // Simulate CPU fluctuation for sparkline updates
    if (reconData?.cpu?.loadPerCore) {
      const labels = reconData.cpu.loadPerCore.map((_, i) => `Core ${i}`);
      const newData = reconData.cpu.loadPerCore.map(load => {
        const history = [];
        for (let j = 0; j < 20; j++) {
          history.push(Math.max(0, Math.min(100,
            load + (Math.random() - 0.5) * 30 + Math.sin(tickCount * 0.1 + j) * 10
          )));
        }
        return history;
      });
      cpuSparkline.setData(labels, newData);

      // Update CPU gauge with slight fluctuation
      const avgLoad = Math.round(
        reconData.cpu.loadPerCore.reduce((a, b) => a + b, 0) / reconData.cpu.loadPerCore.length
        + (Math.random() - 0.5) * 10
      );
      cpuGauge.setData(Math.max(0, Math.min(100, avgLoad)));
    }

    screen.render();
  }, 2000);

  // ── KEYBOARD SHORTCUTS ─────────────────────────────────────────────────
  screen.key(['escape', 'q', 'C-c'], () => {
    clearInterval(updateInterval);
    screen.destroy();
    console.log('\n\x1b[32m✓ ASTRANETRA Dashboard closed.\x1b[0m\n');
    process.exit(0);
  });

  // Help overlay
  screen.key(['h', '?'], () => {
    const helpBox = blessed.box({
      parent: screen,
      top: 'center',
      left: 'center',
      width: 50,
      height: 12,
      tags: true,
      border: { type: 'line', fg: 'cyan' },
      style: { fg: 'green', border: { fg: 'cyan' }, bg: 'black' },
      label: ' KEYBOARD SHORTCUTS ',
      padding: { left: 2, right: 2, top: 1, bottom: 1 },
      content:
        '{bold}{green-fg}ASTRANETRA Dashboard Controls{/green-fg}{/bold}\n\n' +
        '{cyan-fg}q / ESC{/cyan-fg}  — Quit dashboard\n' +
        '{cyan-fg}h / ?{/cyan-fg}    — Show this help\n' +
        '{cyan-fg}r{/cyan-fg}        — Refresh data\n' +
        '{cyan-fg}l{/cyan-fg}        — Toggle log focus\n',
    });

    screen.key(['escape'], () => {
      helpBox.destroy();
      screen.render();
    });

    screen.render();
  });

  // Refresh data
  screen.key(['r'], async () => {
    opLog.log('{yellow-fg}[REFRESH]{/yellow-fg} Reloading system data...');
    screen.render();
    // Re-run recon and update
    try {
      const { runSystemRecon } = await import('../core/SystemRecon.js');
      const newRecon = await runSystemRecon();
      populateRecon(newRecon);
      opLog.log('{green-fg}[REFRESH]{/green-fg} Data refreshed successfully');
    } catch (e) {
      opLog.log(`{red-fg}[ERROR]{/red-fg} Refresh failed: ${e.message}`);
    }
    screen.render();
  });

  // Initial render
  screen.render();

  return { screen, updateInterval };
}

export default createLiveDashboard;
