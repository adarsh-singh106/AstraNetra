/**
 * ASTRANETRA — Shared Utilities
 * Common helper functions used across multiple modules.
 */

/**
 * Convert a byte count to a human-readable string (e.g., '1.50 GB').
 * @param {number} bytes - The number of bytes.
 * @returns {string} Human-readable size string.
 */
export function humanBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

/**
 * Format seconds into a human-readable uptime string (e.g., '2d 5h 30m 15s').
 * @param {number} seconds - Uptime in seconds.
 * @returns {string} Formatted uptime string.
 */
export function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}
