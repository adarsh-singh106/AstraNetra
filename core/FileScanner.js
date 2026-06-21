import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import cliProgress from 'cli-progress';
import { getLogger } from '../output/Logger.js';
import config from '../config/astranetra.config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logger    = getLogger();

function humanBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

export async function runFileScanner(onProgress = null) {
  logger.info('FileScanner', 'SCAN_START');
  const start = Date.now();

  const platform  = process.platform;
  const roots     = config.scan.roots[platform] || [process.env.HOME || '/'];
  const workerPath = path.join(__dirname, '..', 'workers', 'scanWorker.js');

  const stats = {
    totalFiles:        0,
    totalDirectories:  0,
    totalSizeBytes:    0,
    hiddenFileCount:   0,
    extensionMap:      {},
    sensitiveFlags:    [],
    largestFiles:      [],
    inaccessiblePaths: [],
    sizeDistribution: {
      under10MB:     0,
      '10MB_100MB':  0,
      '100MB_1GB':   0,
      '1GB_5GB':     0,
      over5GB:       0,
    },
    scanDurationMs: 0,
    totalSizeHuman: '',
  };

  const bar = new cliProgress.SingleBar({
    format: ' Scanning |{bar}| {value} files | {currentDir}',
    barCompleteChar:   '█',
    barIncompleteChar: '░',
    hideCursor: true,
  }, cliProgress.Presets.shades_classic);

  bar.start(100, 0, { currentDir: roots[0] });
  let fileCount = 0;

  await Promise.all(roots.map(rootDir => new Promise((resolve) => {
    const worker = new Worker(workerPath, {
      workerData: {
        rootDir,
        excludePaths:      config.scan.excludePaths,
        followSymlinks:    config.scan.followSymlinks,
        sensitivePatterns: config.scan.sensitivePatterns,
      },
    });

    worker.on('message', (msg) => {
      if (msg.type === 'done') return resolve();

      if (msg.type === 'inaccessible') {
        stats.inaccessiblePaths.push({ path: msg.path, reason: msg.reason });
        logger.warn('FileScanner', 'INACCESSIBLE', { path: msg.path, reason: msg.reason });
        return;
      }

      if (msg.type === 'dir') {
        stats.totalDirectories++;
        return;
      }

      if (msg.type === 'file') {
        stats.totalFiles++;
        stats.totalSizeBytes += msg.sizeBytes || 0;
        fileCount++;

        // Extension map
        const ext = msg.ext || '(none)';
        stats.extensionMap[ext] = (stats.extensionMap[ext] || 0) + 1;

        // Hidden
        if (msg.hidden) stats.hiddenFileCount++;

        // Sensitive
        if (msg.sensitive) {
          stats.sensitiveFlags.push(msg.path);
          logger.warn('FileScanner', 'SENSITIVE_FLAG', {
            path:   msg.path,
            action: 'path_logged_only',
          });
        }

        // Size distribution
        const mb = (msg.sizeBytes || 0) / (1024 * 1024);
        if      (mb < 10)              stats.sizeDistribution.under10MB++;
        else if (mb < 100)             stats.sizeDistribution['10MB_100MB']++;
        else if (mb < 1024)            stats.sizeDistribution['100MB_1GB']++;
        else if (mb < 5120)            stats.sizeDistribution['1GB_5GB']++;
        else                           stats.sizeDistribution.over5GB++;

        // Track largest files (keep top 20)
        stats.largestFiles.push({
          path:         msg.path,
          sizeBytes:    msg.sizeBytes || 0,
          sizeHuman:    humanBytes(msg.sizeBytes || 0),
          ext:          msg.ext,
          lastModified: msg.mtimeMs ? new Date(msg.mtimeMs).toISOString() : null,
        });
        if (stats.largestFiles.length > 100) {
          stats.largestFiles.sort((a, b) => b.sizeBytes - a.sizeBytes);
          stats.largestFiles = stats.largestFiles.slice(0, 20);
        }

        // Update progress bar every 50 files
        if (fileCount % 50 === 0) {
          bar.update(fileCount % 100, { currentDir: msg.path.slice(-60) });
          if (onProgress) onProgress({ fileCount, currentPath: msg.path });
        }
      }
    });

    worker.on('error', (e) => {
      logger.error('FileScanner', 'WORKER_ERROR', { error: e.message, rootDir });
      resolve();
    });

    worker.on('exit', resolve);
  })));

  bar.stop();

  // Sort and finalize
  stats.largestFiles.sort((a, b) => b.sizeBytes - a.sizeBytes);
  stats.largestFiles = stats.largestFiles.slice(0, 20);
  stats.totalSizeHuman = humanBytes(stats.totalSizeBytes);
  stats.scanDurationMs = Date.now() - start;

  // Top extensions sorted
  stats.topExtensions = Object.entries(stats.extensionMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([ext, count]) => ({ ext, count }));

  logger.info('FileScanner', 'SCAN_COMPLETE', {
    totalFiles:      stats.totalFiles,
    totalSizeHuman:  stats.totalSizeHuman,
    sensitiveFlags:  stats.sensitiveFlags.length,
    durationMs:      stats.scanDurationMs,
  });

  return stats;
}
