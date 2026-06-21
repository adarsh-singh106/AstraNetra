import os from 'os';
import path from 'path';

const platform = process.platform; // 'win32' | 'linux' | 'darwin'
const home = os.homedir();

export default {
  platform,

  scan: {
    roots: {
      win32:  ['C:\\'],
      linux:  [home],
      darwin: [home],
    },
    excludePaths: [
      '/proc', '/sys', '/dev', '/run', '/snap',
      'node_modules', '.git', '$Recycle.Bin',
    ],
    includeHidden: true,
    followSymlinks: false,
    maxDepth: Infinity,
    workerCount: 4,
    sensitivePatterns: [
      '.env', '.pem', '.key', 'id_rsa', 'id_ed25519',
      '.p12', 'credentials', '.netrc', '.npmrc', 'htpasswd',
    ],
  },

  exfil: {
    serverPort: 4444,
    serverHost: 'localhost',
    dbPath: path.join(process.cwd(), 'db', 'astranetra.db'),
    autoStart: true,
  },

  persistence: {
    targets: {
      win32:  path.join(
        process.env.APPDATA || path.join(home, 'AppData', 'Roaming'),
        'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup'
      ),
      linux:  path.join(home, '.config', 'autostart'),
      darwin: path.join(home, 'Library', 'LaunchAgents'),
    },
    pathShellConfigs: {
      linux:  [
        path.join(home, '.bashrc'),
        path.join(home, '.zshrc'),
      ],
      darwin: [
        path.join(home, '.zshrc'),
        path.join(home, '.bash_profile'),
      ],
      win32: null, // uses setx
    },
    revertOnExit: false,
  },

  integrity: {
    algorithm: 'sha256',
    snapshotDir: path.join(process.cwd(), 'snapshots'),
    watchPaths: [],
  },

  output: {
    reportDir:     path.join(process.cwd(), 'reports'),
    logDir:        path.join(process.cwd(), 'logs'),
    dashboardPath: path.join(process.cwd(), 'dashboard.html'),
  },

  crud: {
    trashDir:               path.join(process.cwd(), '.astranetra_trash'),
    sandboxDir:             path.join(process.cwd(), 'sandbox'),
    requireConfirmForDelete: true,
    atomicWrites:           true,
  },

  terminal: {
    refreshIntervalMs: 1000,
    theme: 'dark',
  },
};
