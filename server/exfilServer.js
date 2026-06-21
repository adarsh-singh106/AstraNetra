import express from 'express';
import { getLogger } from '../output/Logger.js';

const logger = getLogger();
let server   = null;
const receivedPayloads = [];

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const app = express();
app.use(express.json({ limit: '50mb' }));

// ── RECEIVE EXFIL DATA ───────────────────────────────────────────────────────
app.post('/exfil', (req, res) => {
  const payload = {
    receivedAt: new Date().toISOString(),
    ip:         req.ip,
    size:       JSON.stringify(req.body).length,
    data:       req.body,
  };
  receivedPayloads.push(payload);
  logger.info('ExfilServer', 'PAYLOAD_RECEIVED', {
    receivedAt: payload.receivedAt,
    sizeBytes:  payload.size,
  });
  res.json({ status: 'received', ts: payload.receivedAt });
});

// ── WEB VIEWER ───────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>ASTRANETRA — Exfil Receiver</title>
  <style>
    body { background: #0a0e1a; color: #00ff9f; font-family: 'JetBrains Mono', monospace; padding: 2rem; }
    h1   { color: #00ff9f; border-bottom: 1px solid #1a2840; padding-bottom: 0.5rem; }
    .payload { background: #0d1424; border: 1px solid #1a2840; border-radius: 4px;
               padding: 1rem; margin: 1rem 0; }
    .ts  { color: #ff6b35; font-size: 0.8rem; }
    pre  { color: #a0cfb0; font-size: 0.8rem; overflow: auto; max-height: 400px; }
    .badge { background: #00ff9f; color: #0a0e1a; padding: 2px 8px; border-radius: 2px;
             font-size: 0.75rem; font-weight: bold; }
  </style>
</head>
<body>
  <h1>⚡ ASTRANETRA · Exfil Receiver <span class="badge">${receivedPayloads.length} payloads</span></h1>
  <p style="color:#888">Running on localhost — no external transmission.</p>
  ${receivedPayloads.length === 0
    ? '<p style="color:#666">No payloads received yet. Run <code>node index.js exfil</code></p>'
    : receivedPayloads.map((p, i) => `
    <div class="payload">
      <div class="ts">#${i + 1} · ${p.receivedAt} · ${p.size} bytes</div>
      <pre>${escapeHtml(JSON.stringify(p.data, null, 2).slice(0, 3000))}${JSON.stringify(p.data).length > 3000 ? '\n... (truncated)' : ''}</pre>
    </div>`).join('')}
  <script>setTimeout(() => location.reload(), 5000);</script>
</body>
</html>`;
  res.send(html);
});

app.get('/payloads', (req, res) => {
  res.json(receivedPayloads);
});

// ── START / STOP ─────────────────────────────────────────────────────────────
export function startExfilServer(port = 4444, host = 'localhost') {
  return new Promise((resolve, reject) => {
    server = app.listen(port, host, () => {
      logger.info('ExfilServer', 'SERVER_STARTED', { url: `http://${host}:${port}` });
      console.log(`\x1b[32m[EXFIL SERVER]\x1b[0m Running at http://${host}:${port}`);
      resolve(server);
    });
    server.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        logger.warn('ExfilServer', 'PORT_IN_USE', { port });
        console.log(`\x1b[33m[EXFIL SERVER]\x1b[0m Port ${port} in use — server may already be running.`);
        resolve(null); // non-fatal
      } else {
        reject(e);
      }
    });
  });
}

export function stopExfilServer() {
  if (server) {
    server.close();
    logger.info('ExfilServer', 'SERVER_STOPPED');
  }
}

export function getReceivedPayloads() {
  return receivedPayloads;
}
