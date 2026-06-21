import fs from 'fs';
import path from 'path';
import { getLogger } from './Logger.js';
import config from '../config/astranetra.config.js';

const logger = getLogger();

export function generateDashboard(data) {
  const outPath = config.output.dashboardPath;
  const { recon = {}, scan = {}, exfil = {}, persistence = {}, integrity = {} } = data;
  const os_  = recon.os  || {};
  const cpu   = recon.cpu || {};
  const ram   = recon.ram || {};
  const disk  = (recon.disk || []).slice(0, 3);
  const net   = (recon.network || []).filter(n => !n.internal).slice(0, 10);

  const topExts = (scan.topExtensions || []).slice(0, 10);
  const sensFlags = scan.sensitiveFlags || [];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ASTRANETRA — Intelligence Report</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg:       #0a0e1a;
      --bg2:      #0d1424;
      --bg3:      #111827;
      --border:   #1a2840;
      --green:    #00ff9f;
      --orange:   #ff6b35;
      --blue:     #3b82f6;
      --red:      #ef4444;
      --muted:    #4b6476;
      --text:     #c8d8e4;
      --mono:     'JetBrains Mono', monospace;
      --sans:     'Inter', sans-serif;
    }
    html { scroll-behavior: smooth; }
    body { background: var(--bg); color: var(--text); font-family: var(--sans); min-height: 100vh; }

    /* NAV */
    nav {
      position: sticky; top: 0; z-index: 100;
      background: rgba(10,14,26,0.95); backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--border);
      padding: 0.75rem 2rem;
      display: flex; align-items: center; justify-content: space-between;
    }
    .nav-brand { font-family: var(--mono); font-size: 1.1rem; font-weight: 700; color: var(--green); letter-spacing: 0.1em; }
    .nav-sub   { font-family: var(--mono); font-size: 0.7rem; color: var(--muted); }
    .nav-ts    { font-family: var(--mono); font-size: 0.7rem; color: var(--muted); }

    /* LAYOUT */
    .container { max-width: 1400px; margin: 0 auto; padding: 2rem; }
    .section   { margin-bottom: 3rem; }
    .section-title {
      font-family: var(--mono); font-size: 0.75rem; font-weight: 600;
      color: var(--green); letter-spacing: 0.15em; text-transform: uppercase;
      border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; margin-bottom: 1.5rem;
    }

    /* GRID */
    .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
    @media (max-width: 900px) { .grid-3, .grid-4 { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 600px) { .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; } }

    /* CARD */
    .card {
      background: var(--bg2); border: 1px solid var(--border);
      border-radius: 6px; padding: 1.25rem;
      transition: border-color 0.2s;
    }
    .card:hover { border-color: #2a3850; }
    .card-label { font-family: var(--mono); font-size: 0.65rem; color: var(--muted); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 0.4rem; }
    .card-value { font-family: var(--mono); font-size: 1.6rem; font-weight: 700; color: var(--green); }
    .card-sub   { font-size: 0.75rem; color: var(--muted); margin-top: 0.25rem; }

    /* HERO */
    .hero {
      background: var(--bg2); border: 1px solid var(--border);
      border-radius: 8px; padding: 2rem; margin-bottom: 2rem;
      display: flex; align-items: center; gap: 2rem;
    }
    .hero-title  { font-family: var(--mono); font-size: 2rem; font-weight: 700; color: var(--green); }
    .hero-sub    { font-family: var(--mono); font-size: 0.85rem; color: var(--muted); margin-top: 0.25rem; }
    .hero-badge  {
      display: inline-block; padding: 0.2rem 0.6rem;
      border-radius: 3px; font-family: var(--mono); font-size: 0.7rem; font-weight: 700;
      background: var(--green); color: var(--bg); margin-right: 0.5rem;
    }
    .badge-orange { background: var(--orange); }
    .badge-red    { background: var(--red); }

    /* TABLE */
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-family: var(--mono); font-size: 0.78rem; }
    th { background: var(--bg3); color: var(--muted); text-align: left; padding: 0.5rem 0.75rem;
         font-weight: 600; letter-spacing: 0.05em; border-bottom: 1px solid var(--border); }
    td { padding: 0.45rem 0.75rem; border-bottom: 1px solid var(--border); color: var(--text); vertical-align: middle; }
    tr:hover td { background: rgba(255,255,255,0.02); }
    .td-path { color: var(--green); word-break: break-all; }
    .td-warn { color: var(--orange); }
    .td-danger { color: var(--red); font-weight: 600; }

    /* CHART CONTAINER */
    .chart-box { background: var(--bg2); border: 1px solid var(--border); border-radius: 6px; padding: 1.25rem; }
    .chart-box canvas { max-height: 260px; }

    /* EXFIL */
    .exfil-status {
      display: flex; align-items: center; gap: 0.5rem;
      font-family: var(--mono); font-size: 0.8rem;
    }
    .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .dot-green  { background: var(--green); box-shadow: 0 0 6px var(--green); }
    .dot-orange { background: var(--orange); }
    .dot-red    { background: var(--red); }

    /* SENSITIVE FLAGS */
    .flag-item {
      display: flex; align-items: flex-start; gap: 0.5rem;
      padding: 0.4rem 0.6rem; background: rgba(239,68,68,0.07);
      border: 1px solid rgba(239,68,68,0.2); border-radius: 4px;
      margin-bottom: 0.4rem; font-family: var(--mono); font-size: 0.75rem; color: var(--orange);
      word-break: break-all;
    }

    /* FOOTER */
    footer {
      border-top: 1px solid var(--border); padding: 1.5rem 2rem;
      text-align: center; font-family: var(--mono); font-size: 0.7rem; color: var(--muted);
    }

    /* DOWNLOAD BTNS */
    .btn {
      display: inline-block; padding: 0.5rem 1rem;
      background: transparent; border: 1px solid var(--green);
      color: var(--green); font-family: var(--mono); font-size: 0.75rem;
      border-radius: 4px; cursor: pointer; text-decoration: none;
      transition: background 0.15s;
    }
    .btn:hover { background: rgba(0,255,159,0.1); }
    .btn-gap { display: flex; gap: 0.75rem; flex-wrap: wrap; }
  </style>
</head>
<body>

<nav>
  <div>
    <div class="nav-brand">⚡ ASTRANETRA</div>
    <div class="nav-sub">Astra (weapon) · Netra (eye) — Educational virus-behavior simulator</div>
  </div>
  <div class="nav-ts">${new Date().toISOString()}</div>
</nav>

<div class="container">

  <!-- HERO -->
  <div class="hero">
    <div style="flex:1">
      <div class="hero-title">${os_.hostname || 'Unknown Host'}</div>
      <div class="hero-sub">${os_.name || ''} ${os_.release || ''} · ${os_.arch || ''} · ${os_.platform || ''}</div>
      <div style="margin-top:1rem">
        <span class="hero-badge">${os_.platform || 'unknown'}</span>
        <span class="hero-badge badge-orange">${scan.totalFiles?.toLocaleString() || 0} files</span>
        ${sensFlags.length > 0 ? `<span class="hero-badge badge-red">🚨 ${sensFlags.length} sensitive</span>` : ''}
      </div>
    </div>
    <div style="text-align:right; font-family:var(--mono); font-size:0.8rem; color:var(--muted)">
      <div>Node ${recon.node?.nodeVersion || ''}</div>
      <div>Uptime: ${os_.uptime || 'N/A'}</div>
      <div>User: ${os_.username || 'N/A'}</div>
    </div>
  </div>

  <!-- SYSTEM VITALS -->
  <div class="section">
    <div class="section-title">System Vitals</div>
    <div class="grid-4">
      <div class="card">
        <div class="card-label">RAM Used</div>
        <div class="card-value">${ram.usedPercent || 0}%</div>
        <div class="card-sub">${ram.usedHuman || '—'} / ${ram.totalHuman || '—'}</div>
      </div>
      <div class="card">
        <div class="card-label">CPU Cores</div>
        <div class="card-value">${cpu.cores || 0}</div>
        <div class="card-sub">${cpu.speedGHz || '—'} GHz · ${cpu.model?.slice(0, 28) || '—'}</div>
      </div>
      ${disk.map(d => `
      <div class="card">
        <div class="card-label">Disk ${d.mount}</div>
        <div class="card-value">${d.usedPercent || 0}%</div>
        <div class="card-sub">${d.usedHuman || '—'} / ${d.totalHuman || '—'}</div>
      </div>`).join('')}
    </div>
  </div>

  <!-- FILE INTELLIGENCE -->
  <div class="section">
    <div class="section-title">File Intelligence</div>
    <div class="grid-4" style="margin-bottom:1.5rem">
      <div class="card">
        <div class="card-label">Total Files</div>
        <div class="card-value">${(scan.totalFiles || 0).toLocaleString()}</div>
        <div class="card-sub">${scan.totalSizeHuman || '—'} total size</div>
      </div>
      <div class="card">
        <div class="card-label">Hidden Files</div>
        <div class="card-value" style="color:var(--orange)">${(scan.hiddenFileCount || 0).toLocaleString()}</div>
        <div class="card-sub">dotfiles + hidden attrs</div>
      </div>
      <div class="card">
        <div class="card-label">Sensitive Flags</div>
        <div class="card-value" style="color:var(--red)">${sensFlags.length}</div>
        <div class="card-sub">paths only — contents not read</div>
      </div>
      <div class="card">
        <div class="card-label">Scan Duration</div>
        <div class="card-value" style="font-size:1.2rem">${scan.scanDurationMs ? (scan.scanDurationMs / 1000).toFixed(1) + 's' : '—'}</div>
        <div class="card-sub">${(scan.inaccessiblePaths || []).length} paths inaccessible</div>
      </div>
    </div>
    <div class="grid-2">
      <div class="chart-box">
        <div class="card-label" style="margin-bottom:1rem">Top File Extensions</div>
        <canvas id="extChart"></canvas>
      </div>
      <div class="chart-box">
        <div class="card-label" style="margin-bottom:1rem">Size Distribution</div>
        <canvas id="sizeChart"></canvas>
      </div>
    </div>
  </div>

  <!-- SENSITIVE FLAGS -->
  ${sensFlags.length > 0 ? `
  <div class="section">
    <div class="section-title">🚨 Sensitive File Flags (${sensFlags.length})</div>
    <p style="font-size:0.8rem; color:var(--muted); margin-bottom:1rem">
      These file paths matched sensitive patterns (.env, .pem, .key, id_rsa, etc.).
      <strong style="color:var(--orange)">File contents were NOT read — paths only.</strong>
    </p>
    ${sensFlags.map(p => `<div class="flag-item">🔑 ${p}</div>`).join('')}
  </div>` : ''}

  <!-- NETWORK -->
  <div class="section">
    <div class="section-title">Network Interfaces</div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Adapter</th><th>Family</th><th>Address</th><th>MAC</th><th>CIDR</th><th>Internal</th></tr></thead>
        <tbody>
          ${(recon.network || []).map(n => `
          <tr>
            <td class="td-path">${n.adapter}</td>
            <td>${n.family}</td>
            <td style="color:var(--green)">${n.address}</td>
            <td style="color:var(--muted)">${n.mac}</td>
            <td style="color:var(--muted)">${n.cidr || '—'}</td>
            <td>${n.internal ? '<span style="color:var(--muted)">yes</span>' : '<span style="color:var(--orange)">no</span>'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- LARGEST FILES -->
  <div class="section">
    <div class="section-title">Top 20 Largest Files</div>
    <div class="table-wrap">
      <table id="filesTable">
        <thead><tr><th>#</th><th>Path</th><th>Size</th><th>Extension</th><th>Modified</th></tr></thead>
        <tbody>
          ${(scan.largestFiles || []).slice(0, 20).map((f, i) => `
          <tr>
            <td style="color:var(--muted)">${i + 1}</td>
            <td class="td-path">${f.path}</td>
            <td style="color:var(--green)">${f.sizeHuman}</td>
            <td><code>${f.ext || '—'}</code></td>
            <td style="color:var(--muted)">${f.lastModified ? f.lastModified.slice(0, 10) : '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- EXFIL + PERSISTENCE -->
  <div class="section">
    <div class="section-title">Exfil & Persistence Status</div>
    <div class="grid-2">
      <div class="card">
        <div class="card-label">Exfiltration Engine</div>
        <div style="margin-top:0.75rem; display:flex; flex-direction:column; gap:0.5rem">
          <div class="exfil-status">
            <span class="dot dot-green"></span>
            Local server: <span style="color:var(--green)">http://localhost:${config.exfil.serverPort}</span>
          </div>
          <div class="exfil-status">
            <span class="dot dot-green"></span>
            SQLite DB: <span style="color:var(--green); word-break:break-all">${config.exfil.dbPath}</span>
          </div>
          <div style="margin-top:0.5rem; font-family:var(--mono); font-size:0.7rem; color:var(--muted)">
            No external network calls — everything stays on localhost.
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-label">Persistence Engine</div>
        <div style="margin-top:0.75rem; font-family:var(--mono); font-size:0.8rem">
          ${persistence.copyTarget
            ? `<div style="color:var(--orange)">📁 Startup copy: ${persistence.copyTarget}</div>
               <div style="margin-top:0.4rem; color:var(--muted); font-size:0.7rem">Revert: <code>node index.js persist --revert</code></div>`
            : `<div style="color:var(--muted)">No persistence established yet.</div>
               <div style="margin-top:0.4rem; color:var(--muted); font-size:0.7rem">Run: <code>node index.js persist</code></div>`}
        </div>
      </div>
    </div>
  </div>

  <!-- ENVIRONMENT -->
  <div class="section">
    <div class="section-title">Environment Snapshot</div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Variable</th><th>Value</th></tr></thead>
        <tbody>
          ${Object.entries(recon.env || {}).map(([k, v]) => `
          <tr>
            <td style="color:var(--orange)">${k}</td>
            <td class="td-path" style="word-break:break-all;max-width:600px">${v?.slice(0, 200) || '—'}${(v?.length || 0) > 200 ? '...' : ''}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- EXPORT CONTROLS -->
  <div class="section">
    <div class="section-title">Export</div>
    <div class="btn-gap">
      <button class="btn" onclick="downloadJson()">⬇ Download JSON</button>
      <a class="btn" href="reports/report.md" download>⬇ Download Markdown</a>
      <a class="btn" href="reports/report.csv" download>⬇ Download CSV</a>
    </div>
  </div>

</div><!-- /container -->

<footer>
  ASTRANETRA · Educational virus-behavior simulator · No external transmission · Everything is reversible
</footer>

<script>
window.__ASTRANETRA_DATA__ = ${JSON.stringify(data, null, 2).replace(/<\//g, '<\\/')};

// ── CHARTS ────────────────────────────────────────────────────────────────────
const CHART_DEFAULTS = {
  color: '#c8d8e4',
  borderColor: '#1a2840',
  backgroundColor: 'rgba(0,255,159,0.12)',
};

// Extension chart
const extData = ${JSON.stringify(topExts)};
if (extData.length && document.getElementById('extChart')) {
  new Chart(document.getElementById('extChart'), {
    type: 'bar',
    data: {
      labels: extData.map(e => e.ext || '(none)'),
      datasets: [{
        label: 'Files',
        data:  extData.map(e => e.count),
        backgroundColor: 'rgba(0,255,159,0.3)',
        borderColor:     '#00ff9f',
        borderWidth: 1,
        borderRadius: 2,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#4b6476' }, grid: { color: '#1a2840' } },
        y: { ticks: { color: '#4b6476' }, grid: { color: '#1a2840' } },
      },
    },
  });
}

// Size distribution chart
const sizeDist = ${JSON.stringify(scan.sizeDistribution || {})};
if (document.getElementById('sizeChart')) {
  new Chart(document.getElementById('sizeChart'), {
    type: 'doughnut',
    data: {
      labels: ['< 10 MB', '10–100 MB', '100 MB–1 GB', '1–5 GB', '> 5 GB'],
      datasets: [{
        data: [
          sizeDist.under10MB || 0,
          sizeDist['10MB_100MB'] || 0,
          sizeDist['100MB_1GB'] || 0,
          sizeDist['1GB_5GB']   || 0,
          sizeDist.over5GB      || 0,
        ],
        backgroundColor: ['#00ff9f','#3b82f6','#ff6b35','#f59e0b','#ef4444'],
        borderColor: '#0d1424',
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#4b6476', padding: 12, font: { size: 11 } } },
      },
    },
  });
}

// ── JSON DOWNLOAD ─────────────────────────────────────────────────────────────
function downloadJson() {
  const blob = new Blob([JSON.stringify(window.__ASTRANETRA_DATA__, null, 2)], { type: 'application/json' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'astranetra-report.json';
  a.click();
}
</script>
</body>
</html>`;

  fs.writeFileSync(outPath, html, 'utf8');
  logger.info('DashboardGenerator', 'DASHBOARD_GENERATED', { path: outPath });
  console.log(`\x1b[32m✓ Dashboard:\x1b[0m ${outPath}`);
  return outPath;
}
