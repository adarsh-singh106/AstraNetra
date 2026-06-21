import { workerData, parentPort } from 'worker_threads';
import fs from 'fs';
import crypto from 'crypto';

const { filePaths, algorithm } = workerData;

async function hashFile(filePath) {
  return new Promise((resolve) => {
    const hash   = crypto.createHash(algorithm || 'sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('error', (e) => {
      resolve({ path: filePath, hash: null, error: e.code || e.message });
    });

    stream.on('data', (chunk) => hash.update(chunk));

    stream.on('end', () => {
      resolve({ path: filePath, hash: hash.digest('hex'), error: null });
    });
  });
}

(async () => {
  for (const filePath of filePaths) {
    const result = await hashFile(filePath);
    parentPort.postMessage(result);
  }
  parentPort.postMessage({ done: true });
})();
