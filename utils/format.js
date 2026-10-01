/**
 * vstride — helper format tampilan (dipindah dari App.js lama).
 */

const pad = (n) => String(n).padStart(2, '0');

/** Detik -> "mm:ss" (menit tidak dibatasi 59, mis. 75:12 untuk 1 jam 15 menit). */
export const formatDuration = (sec) => {
  const total = Math.max(0, Math.floor(Number(sec) || 0));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
};

const MAX_PACE_SEC = 99 * 60 + 59;

/** Pace "m:ss" per km. Mengembalikan "--:--" bila jarak terlalu kecil atau pace tidak masuk akal. */
export const formatPace = (durationSec, km) => {
  if (!(km >= 0.01)) return '--:--';
  const total = Math.round(durationSec / km);
  if (!Number.isFinite(total) || total > MAX_PACE_SEC) return '--:--';
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
};

/** "30 Sep 2026, 14.05" (locale id-ID) */
export const formatDateTime = (date = new Date()) =>
  new Date(date).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });