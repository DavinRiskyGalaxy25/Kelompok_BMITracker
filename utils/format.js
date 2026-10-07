/**
 * vstride — helper format tampilan (dipindah dari App.js lama).
 */

const pad = (n) => String(n).padStart(2, '0');

export const formatDuration = (sec) => {
  const total = Math.max(0, Math.floor(Number(sec) || 0));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
};

const MAX_PACE_SEC = 99 * 60 + 59;

export const formatPace = (durationSec, km) => {
  if (!(km >= 0.01)) return '--:--';
  const total = Math.round(durationSec / km);
  if (!Number.isFinite(total) || total > MAX_PACE_SEC) return '--:--';
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export const formatDateTime = (dateStr) => {
  let d = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(d.getTime()) && typeof dateStr === 'string') {
    // Attempt to parse common localized strings like DD/MM/YYYY or DD-MM-YYYY
    const parts = dateStr.match(/(\d+)[-/](\d+)[-/](\d+)/);
    if (parts) {
      // Assuming DD/MM/YYYY
      d = new Date(`${parts[3]}-${parts[2]}-${parts[1]}T12:00:00Z`);
    }
  }
  if (isNaN(d.getTime())) {
    d = new Date(); // If all else fails, use today so it never shows invalid
  }
  
  const day = pad(d.getDate());
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${day} ${month} ${year}, ${hours}.${minutes}`;
};