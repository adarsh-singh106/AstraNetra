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
      --bg:       #050810;
      --bg2:      rgba(13, 20, 36, 0.4);
      --bg3:      rgba(17, 24, 39, 0.6);
      --border:   rgba(0, 255, 159, 0.15);
      --border-h: rgba(0, 255, 159, 0.4);
      --green:    #00ff9f;
      --orange:   #ff6b35;
      --blue:     #3b82f6;
      --red:      #ff2a2a;
      --muted:    #6b879c;
      --text:     #e2e8f0;
      --mono:     'JetBrains Mono', monospace;
      --sans:     'Inter', sans-serif;
    }
    
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes pulseGlow {
      0% { box-shadow: 0 0 10px rgba(255, 42, 42, 0.2); }
      50% { box-shadow: 0 0 20px rgba(255, 42, 42, 0.6); }
      100% { box-shadow: 0 0 10px rgba(255, 42, 42, 0.2); }
    }
    @keyframes scanline {
      0% { transform: translateY(-100%); }
      100% { transform: translateY(100vh); }
    }

    html { scroll-behavior: smooth; }
    body { 
      background: radial-gradient(circle at 50% 0%, #0d1424 0%, var(--bg) 60%);
      color: var(--text); font-family: var(--sans); min-height: 100vh;
      overflow-x: hidden;
    }
    body::after {
      content: ""; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: linear-gradient(to bottom, transparent 50%, rgba(0, 0, 0, 0.1) 51%);
      background-size: 100% 4px; pointer-events: none; z-index: 999; opacity: 0.2;
    }

    /* NAV */
    nav {
      position: sticky; top: 0; z-index: 100;
      background: rgba(5, 8, 16, 0.8); backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      padding: 1rem 2rem;
      display: flex; align-items: center; justify-content: space-between;
      box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5);
    }
    .nav-brand { font-family: var(--mono); font-size: 1.2rem; font-weight: 700; color: var(--green); letter-spacing: 0.15em; text-shadow: 0 0 10px rgba(0,255,159,0.4); }
    .nav-sub   { font-family: var(--mono); font-size: 0.75rem; color: var(--muted); margin-top: 0.2rem; }
    .nav-ts    { font-family: var(--mono); font-size: 0.75rem; color: var(--green); background: rgba(0,255,159,0.1); padding: 0.3rem 0.8rem; border-radius: 4px; border: 1px solid var(--border); }

    /* LAYOUT */
    .container { max-width: 1400px; margin: 0 auto; padding: 2.5rem 2rem; position: relative; z-index: 10; }
    .section   { margin-bottom: 3.5rem; animation: fadeUp 0.6s ease-out forwards; opacity: 0; }
    .section:nth-child(1) { animation-delay: 0.1s; }
    .section:nth-child(2) { animation-delay: 0.2s; }
    .section:nth-child(3) { animation-delay: 0.3s; }
    .section:nth-child(4) { animation-delay: 0.4s; }
    .section:nth-child(5) { animation-delay: 0.5s; }
    .section:nth-child(6) { animation-delay: 0.6s; }

    .section-title {
      font-family: var(--mono); font-size: 0.85rem; font-weight: 700;
      color: var(--green); letter-spacing: 0.2em; text-transform: uppercase;
      border-bottom: 1px solid var(--border); padding-bottom: 0.8rem; margin-bottom: 1.5rem;
      display: flex; align-items: center; gap: 0.5rem;
    }
    .section-title::before { content: "◈"; color: var(--green); font-size: 1rem; }

    /* GRID */
    .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; }
    @media (max-width: 900px) { .grid-3, .grid-4 { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 600px) { .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; } }

    /* CARD (Glassmorphism) */
    .card {
      background: var(--bg2); border: 1px solid var(--border);
      backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
      border-radius: 8px; padding: 1.5rem;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      position: relative; overflow: hidden;
    }
    .card::before {
      content: ""; position: absolute; top: 0; left: -100%; width: 50%; height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent);
      transition: all 0.5s;
    }
    .card:hover { border-color: var(--border-h); transform: translateY(-3px); box-shadow: 0 8px 30px rgba(0,255,159,0.1); }
    .card:hover::before { left: 200%; }

    .card-label { font-family: var(--mono); font-size: 0.7rem; color: var(--muted); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 0.5rem; }
    .card-value { font-family: var(--mono); font-size: 1.8rem; font-weight: 700; color: var(--green); text-shadow: 0 0 15px rgba(0,255,159,0.3); }
    .card-sub   { font-size: 0.8rem; color: var(--muted); margin-top: 0.4rem; }

    /* HERO */
    .hero {
      background: linear-gradient(135deg, rgba(13,20,36,0.8), rgba(5,8,16,0.9));
      border: 1px solid var(--border-h);
      box-shadow: 0 0 40px rgba(0,255,159,0.05), inset 0 0 20px rgba(0,255,159,0.05);
      border-radius: 12px; padding: 2.5rem; margin-bottom: 2.5rem;
      display: flex; align-items: center; gap: 2rem;
      backdrop-filter: blur(15px);
      animation: fadeUp 0.6s ease-out forwards;
    }
    .hero-title  { font-family: var(--mono); font-size: 2.5rem; font-weight: 700; color: var(--green); text-shadow: 0 0 20px rgba(0,255,159,0.4); letter-spacing: 0.05em; }
    .hero-sub    { font-family: var(--mono); font-size: 0.95rem; color: var(--muted); margin-top: 0.5rem; }
    .hero-badge  {
      display: inline-flex; align-items: center; padding: 0.3rem 0.8rem;
      border-radius: 4px; font-family: var(--mono); font-size: 0.75rem; font-weight: 700;
      background: rgba(0,255,159,0.1); border: 1px solid var(--green); color: var(--green); margin-right: 0.8rem;
    }
    .badge-orange { border-color: var(--orange); color: var(--orange); background: rgba(255,107,53,0.1); }
    .badge-red    { border-color: var(--red); color: var(--red); background: rgba(255,42,42,0.1); box-shadow: 0 0 15px rgba(255,42,42,0.3); }

    /* TABLE */
    .table-wrap { overflow-x: auto; background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; backdrop-filter: blur(10px); }
    table { width: 100%; border-collapse: collapse; font-family: var(--mono); font-size: 0.8rem; }
    th { background: rgba(0,255,159,0.03); color: var(--green); text-align: left; padding: 0.75rem 1rem;
         font-weight: 600; letter-spacing: 0.1em; border-bottom: 1px solid var(--border); text-transform: uppercase; }
    td { padding: 0.6rem 1rem; border-bottom: 1px solid rgba(26,40,64,0.5); color: var(--text); vertical-align: middle; }
    tr { transition: background 0.2s; }
    tr:hover { background: rgba(0,255,159,0.05); }
    .td-path { color: var(--text); word-break: break-all; }
    .td-warn { color: var(--orange); }
    .td-danger { color: var(--red); font-weight: 600; }

    /* CHART CONTAINER */
    .chart-box { background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; padding: 1.5rem; backdrop-filter: blur(10px); transition: border-color 0.3s; }
    .chart-box:hover { border-color: var(--border-h); }
    .chart-box canvas { max-height: 280px; }

    /* EXFIL */
    .exfil-status {
      display: flex; align-items: center; gap: 0.75rem;
      font-family: var(--mono); font-size: 0.85rem; padding: 0.4rem 0;
    }
    .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .dot-green  { background: var(--green); box-shadow: 0 0 10px var(--green); }
    .dot-orange { background: var(--orange); box-shadow: 0 0 10px var(--orange); }
    .dot-red    { background: var(--red); box-shadow: 0 0 10px var(--red); }

    /* SENSITIVE FLAGS */
    .flag-item {
      display: flex; align-items: flex-start; gap: 0.75rem;
      padding: 0.6rem 1rem; background: rgba(255,42,42,0.05);
      border: 1px solid rgba(255,42,42,0.3); border-left: 4px solid var(--red); border-radius: 4px;
      margin-bottom: 0.5rem; font-family: var(--mono); font-size: 0.8rem; color: #ff8a8a;
      word-break: break-all; transition: all 0.2s;
    }
    .flag-item:hover { background: rgba(255,42,42,0.1); transform: translateX(5px); }

    /* FOOTER */
    footer {
      border-top: 1px solid var(--border); padding: 2rem;
      text-align: center; font-family: var(--mono); font-size: 0.75rem; color: var(--muted);
      background: rgba(5,8,16,0.8);
    }

    /* DOWNLOAD BTNS */
    .btn {
      display: inline-flex; align-items: center; justify-content: center; padding: 0.6rem 1.2rem;
      background: rgba(0,255,159,0.05); border: 1px solid var(--green);
      color: var(--green); font-family: var(--mono); font-size: 0.8rem; font-weight: 600;
      border-radius: 6px; cursor: pointer; text-decoration: none;
      transition: all 0.2s; text-transform: uppercase; letter-spacing: 0.05em;
    }
    .btn:hover { background: rgba(0,255,159,0.15); box-shadow: 0 0 15px rgba(0,255,159,0.2); transform: translateY(-2px); }
    .btn-gap { display: flex; gap: 1rem; flex-wrap: wrap; }
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
