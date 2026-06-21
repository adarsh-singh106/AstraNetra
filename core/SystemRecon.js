import os from 'os';
import { execSync } from 'child_process';
import { getLogger } from '../output/Logger.js';

const logger = getLogger();

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}

function humanBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function getCpuLoad() {
  const cpus = os.cpus();
  return cpus.map(cpu => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
    const idle  = cpu.times.idle;
    return Math.round(((total - idle) / total) * 100);
  });
}

function getNetworkInterfaces() {
  const raw = os.networkInterfaces();
  const result = [];
  for (const [name, addrs] of Object.entries(raw)) {
    for (const addr of addrs) {
      result.push({
        adapter:  name,
        family:   addr.family,
        address:  addr.address,
        mac:      addr.mac,
        internal: addr.internal,
        cidr:     addr.cidr || null,
      });
    }
  }
  return result;
}

function getDiskInfo() {
  const platform = process.platform;
  const disks = [];
  try {
    if (platform === 'win32') {
      // Use PowerShell — wmic removed in Windows 11 24H2+
      const ps = `Get-PSDrive -PSProvider FileSystem | Select-Object Name,Used,Free | ConvertTo-Json`;
      const out = execSync(`powershell -NoProfile -Command "${ps}"`, {
        timeout: 8000, encoding: 'utf8',
      });
      let drives = JSON.parse(out.trim());
      if (!Array.isArray(drives)) drives = [drives];
      for (const d of drives) {
        const used  = Number(d.Used)  || 0;
        const free  = Number(d.Free)  || 0;
        const total = used + free;
        if (total > 0) {
          disks.push({
            mount:       d.Name + ':',
            totalBytes:  total,
            usedBytes:   used,
            freeBytes:   free,
            totalHuman:  humanBytes(total),
            usedHuman:   humanBytes(used),
            freeHuman:   humanBytes(free),
            usedPercent: Math.round((used / total) * 100),
          });
        }
      }
    } else {
      const out = execSync("df -k / 2>/dev/null || df /", {
        timeout: 5000, encoding: 'utf8',
      });
      const lines = out.trim().split('\n').slice(1);
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 6) {
          const total = parseInt(parts[1]) * 1024 || 0;
          const used  = parseInt(parts[2]) * 1024 || 0;
          const free  = parseInt(parts[3]) * 1024 || 0;
          const mount = parts[5];
          if (total > 0) {
            disks.push({
              mount,
              totalBytes:  total,
              usedBytes:   used,
              freeBytes:   free,
              totalHuman:  humanBytes(total),
              usedHuman:   humanBytes(used),
              freeHuman:   humanBytes(free),
              usedPercent: Math.round((used / total) * 100),
            });
          }
        }
      }
    }
  } catch (e) {
    logger.warn('SystemRecon', 'DISK_INFO_FAILED', { error: e.message });
  }
  return disks;
}

function getNodeInfo() {
  let npmVersion = 'unknown';
  try {
    npmVersion = execSync('npm --version', { timeout: 3000, encoding: 'utf8' }).trim();
  } catch (_) {}
  return {
    nodeVersion: process.version,
    v8Version:   process.versions.v8,
    npmVersion,
    platform:    process.platform,
    arch:        process.arch,
    pid:         process.pid,
    execPath:    process.execPath,
  };
}

function getEnvSnapshot() {
  const whitelist = ['PATH', 'HOME', 'USER', 'USERNAME', 'SHELL',
                     'LANG', 'TERM', 'USERPROFILE', 'COMPUTERNAME',
                     'LOGNAME', 'HOSTNAME'];
  const result = {};
  for (const key of whitelist) {
    if (process.env[key]) result[key] = process.env[key];
  }
  return result;
}

export async function runSystemRecon() {
  logger.info('SystemRecon', 'RECON_START');
  const start = Date.now();

  const totalMem = os.totalmem();
  const freeMem  = os.freemem();
  const usedMem  = totalMem - freeMem;
  const cpus     = os.cpus();

  const result = {
    scannedAt: new Date().toISOString(),
    durationMs: 0,
    os: {
      name:     os.type(),
      release:  os.release(),
      version:  os.version?.() || os.release(),
      arch:     os.arch(),
      platform: process.platform,
      uptime:   formatUptime(os.uptime()),
      uptimeSec: os.uptime(),
      hostname: os.hostname(),
      homedir:  os.homedir(),
      tmpdir:   os.tmpdir(),
      username: os.userInfo().username,
      shell:    os.userInfo().shell || process.env.SHELL || process.env.COMSPEC || 'unknown',
    },
    cpu: {
      model:      cpus[0]?.model || 'unknown',
      cores:      os.cpus().length,
      speedMHz:   cpus[0]?.speed || 0,
      speedGHz:   ((cpus[0]?.speed || 0) / 1000).toFixed(2),
      loadPerCore: getCpuLoad(),
    },
    ram: {
      totalBytes:  totalMem,
      usedBytes:   usedMem,
      freeBytes:   freeMem,
      totalHuman:  humanBytes(totalMem),
      usedHuman:   humanBytes(usedMem),
      freeHuman:   humanBytes(freeMem),
      usedPercent: Math.round((usedMem / totalMem) * 100),
    },
    network:  getNetworkInterfaces(),
    disk:     getDiskInfo(),
    node:     getNodeInfo(),
    env:      getEnvSnapshot(),
  };

  result.durationMs = Date.now() - start;
  logger.info('SystemRecon', 'RECON_COMPLETE', {
    durationMs: result.durationMs,
    hostname: result.os.hostname,
  });
  return result;
}

export { humanBytes, formatUptime };
