import fs from 'fs';
import path from 'path';
import { getLogger } from './Logger.js';
import config from '../config/astranetra.config.js';

const logger = getLogger();

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// ── JSON ──────────────────────────────────────────────────────────────────────
export function exportJson(data) {
  ensureDir(config.output.reportDir);
  const file = path.join(config.output.reportDir, 'report.json');
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  logger.info('ReportExporter', 'JSON_EXPORTED', { file });
  console.log(`\x1b[32m✓ JSON report:\x1b[0m ${file}`);
  return file;
}

// ── MARKDOWN ──────────────────────────────────────────────────────────────────
export function exportMarkdown(data) {
  ensureDir(config.output.reportDir);
  const file = path.join(config.output.reportDir, 'report.md');
  const { recon = {}, scan = {}, exfil = {}, persistence = {} } = data;
  const os_ = recon.os || {};
  const cpu  = recon.cpu || {};
  const ram  = recon.ram || {};

  const lines = [
    '# ASTRANETRA — Scan Report',
    `> Generated: ${new Date().toISOString()}`,
    '',
    '## System Recon',
    `| Field | Value |`,
    `|---|---|`,
    `| Hostname | ${os_.hostname || 'N/A'} |`,
    `| OS | ${os_.name} ${os_.release} |`,
    `| Platform | ${os_.platform} |`,
    `| Architecture | ${os_.arch} |`,
    `| Uptime | ${os_.uptime} |`,
    `| CPU | ${cpu.model} (${cpu.cores} cores) |`,
    `| RAM | ${ram.usedHuman} / ${ram.totalHuman} (${ram.usedPercent}%) |`,
    '',
    '## File Scan',
    `| Field | Value |`,
    `|---|---|`,
    `| Total Files | ${scan.totalFiles?.toLocaleString() || 0} |`,
    `| Total Directories | ${scan.totalDirectories?.toLocaleString() || 0} |`,
    `| Total Size | ${scan.totalSizeHuman || 'N/A'} |`,
    `| Hidden Files | ${scan.hiddenFileCount?.toLocaleString() || 0} |`,
    `| Sensitive Flags | ${scan.sensitiveFlags?.length || 0} |`,
    `| Inaccessible Paths | ${scan.inaccessiblePaths?.length || 0} |`,
    '',
    '### Top Extensions',
    '| Extension | Count |',
    '|---|---|',
    ...(scan.topExtensions || []).map(e => `| \`${e.ext}\` | ${e.count} |`),
    '',
    '### Top 10 Largest Files',
    '| Path | Size | Extension |',
    '|---|---|---|',
    ...(scan.largestFiles || []).slice(0, 10).map(f =>
      `| \`${f.path}\` | ${f.sizeHuman} | ${f.ext || '—'} |`
    ),
    '',
    '## Sensitive File Flags',
    '> Paths only — file contents were NOT read.',
    '',
    ...(scan.sensitiveFlags || []).map(p => `- \`${p}\``),
    '',
    '## Persistence Status',
    persistence.copyTarget
      ? `- **Startup copy**: \`${persistence.copyTarget}\``
      : '- No persistence established.',
    '',
    '## Network Interfaces',
    '| Adapter | Family | Address | MAC |',
    '|---|---|---|---|',
    ...(recon.network || []).map(n =>
      `| ${n.adapter} | ${n.family} | ${n.address} | ${n.mac} |`
    ),
    '',
    '---',
    '*ASTRANETRA — Educational virus-behavior simulator. No external transmission.*',
  ];

  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  logger.info('ReportExporter', 'MD_EXPORTED', { file });
  console.log(`\x1b[32m✓ Markdown report:\x1b[0m ${file}`);
  return file;
}

// ── CSV ───────────────────────────────────────────────────────────────────────
export function exportCsv(data) {
  ensureDir(config.output.reportDir);
  const file  = path.join(config.output.reportDir, 'report.csv');
  const files = data.scan?.largestFiles || [];

  const header = 'path,sizeBytes,sizeHuman,extension,hidden,lastModified,sensitiveFlag';
  const sensitiveSet = new Set(data.scan?.sensitiveFlags || []);

  const rows = files.map(f => {
    const cols = [
      `"${f.path?.replace(/"/g, '""') || ''}"`,
      f.sizeBytes || 0,
      `"${f.sizeHuman || ''}"`,
      `"${f.ext || ''}"`,
      f.hidden ? 'true' : 'false',
      `"${f.lastModified || ''}"`,
      sensitiveSet.has(f.path) ? 'true' : 'false',
    ];
    return cols.join(',');
  });

  fs.writeFileSync(file, [header, ...rows].join('\n'), 'utf8');
  logger.info('ReportExporter', 'CSV_EXPORTED', { file });
  console.log(`\x1b[32m✓ CSV report:\x1b[0m ${file}`);
  return file;
}

// ── ALL THREE ─────────────────────────────────────────────────────────────────
export function exportAll(data) {
  console.log('\n\x1b[35m━━━ REPORT EXPORTER ━━━\x1b[0m');
  return {
    json: exportJson(data),
    md:   exportMarkdown(data),
    csv:  exportCsv(data),
  };
}
