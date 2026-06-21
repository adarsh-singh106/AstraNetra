import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, CRITICAL: 4 };
const COLORS = {
  DEBUG:    '\x1b[36m',  // cyan
  INFO:     '\x1b[32m',  // green
  WARN:     '\x1b[33m',  // yellow
  ERROR:    '\x1b[31m',  // red
  CRITICAL: '\x1b[35m',  // magenta
  RESET:    '\x1b[0m',
};

class Logger {
  constructor(logDir) {
    this.logDir = logDir;
    this.listeners = [];
    this._ensureDir();
    this._streams = {};
    this._openStreams();
  }

  _ensureDir() {
    fs.mkdirSync(this.logDir, { recursive: true });
  }

  _openStreams() {
    const files = {
      main:        'astranetra.log.json',
      pretty:      'astranetra.log.txt',
      crud:        'crud.log.json',
      persistence: 'persistence.log.json',
      exfil:       'exfil.log.json',
      integrity:   'integrity.log.json',
    };
    for (const [key, file] of Object.entries(files)) {
      this._streams[key] = fs.createWriteStream(
        path.join(this.logDir, file),
        { flags: 'a', encoding: 'utf8' }
      );
    }
  }

  _write(stream, data) {
    if (this._streams[stream]) {
      this._streams[stream].write(data + '\n');
    }
  }

  log(level, module, event, meta = {}) {
    if (!LEVELS.hasOwnProperty(level)) level = 'INFO';

    const entry = {
      ts:     new Date().toISOString(),
      level,
      module,
      event,
      ...meta,
    };

    const json = JSON.stringify(entry);
    this._write('main', json);

    // pretty txt
    const color = COLORS[level] || '';
    const pretty = `${COLORS.RESET}[${entry.ts}] ${color}${level.padEnd(8)}${COLORS.RESET} [${module}] ${event}${meta.path ? ' → ' + meta.path : ''}`;
    this._write('pretty', pretty);

    // module-specific logs
    if (module === 'CRUDEngine')        this._write('crud', json);
    if (module === 'PersistenceEngine') this._write('persistence', json);
    if (module === 'ExfilEngine')       this._write('exfil', json);
    if (module === 'IntegrityMonitor')  this._write('integrity', json);

    // emit to live listeners (terminal dashboard)
    for (const fn of this.listeners) fn(entry);

    return entry;
  }

  debug(module, event, meta)    { return this.log('DEBUG',    module, event, meta); }
  info(module, event, meta)     { return this.log('INFO',     module, event, meta); }
  warn(module, event, meta)     { return this.log('WARN',     module, event, meta); }
  error(module, event, meta)    { return this.log('ERROR',    module, event, meta); }
  critical(module, event, meta) { return this.log('CRITICAL', module, event, meta); }

  onLog(fn) { this.listeners.push(fn); }

  flush() {
    for (const s of Object.values(this._streams)) {
      try { s.end(); } catch (_) {}
    }
  }
}

// Singleton
let _instance = null;
export function getLogger(logDir) {
  if (!_instance) {
    _instance = new Logger(logDir || path.join(process.cwd(), 'logs'));
  }
  return _instance;
}
export default Logger;
