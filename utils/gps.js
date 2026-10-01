/**
 * vstride — pengolahan jejak GPS (murni logika, tanpa React/Expo, mudah diuji).
 *
 * MASALAH: GPS ponsel selalu "bergoyang" ±3–15 m walau pengguna diam. Filter lama hanya
 * membuang akurasi > 30 m dan langkah < 2 m, jadi goyangan itu ikut digambar sebagai
 * zigzag dan ikut menambah jarak.
 *
 * SOLUSI (dijalankan berurutan untuk setiap titik baru):
 *  1. Validasi        : koordinat valid, timestamp maju.
 *  2. Gerbang akurasi : buang titik dengan akurasi buruk.
 *  3. Deteksi lonjakan: buang titik yang mustahil (kecepatan tersirat terlalu tinggi).
 *  4. Filter Kalman   : haluskan posisi, dengan bobot sesuai akurasi tiap titik.
 *  5. Jarak minimum   : titik baru digambar hanya bila sudah cukup jauh dari titik
 *                       terakhir (mengikuti ketidakpastian filter), sehingga diam = garis diam.
 *  6. Sensor kecepatan: bila perangkat melaporkan kecepatan ~0, perpindahan kecil diabaikan.
 *
 * Saat aktivitas selesai, rute dirapikan lagi untuk tampilan (`toDisplayRoute`):
 * Douglas–Peucker membuang titik yang tidak perlu, lalu Chaikin membulatkan sudut.
 * Jarak total selalu dihitung dari titik hasil filter, bukan dari rute tampilan.
 */

/* --------------------------------- Dasar --------------------------------- */

const EARTH_RADIUS_M = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;

export const haversine = (a, b) => {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
};

export const DEFAULT_GPS_PROFILE = {
  maxAccuracy: 25, // m
  maxSpeed: 9, // m/s
  processNoise: 3, // m/s
  minStep: 5, // m
  stepSigmaFactor: 1.5, // langkah minimum = faktor x ketidakpastian estimasi (bila lebih besar dari minStep)
  stationarySpeed: 0.4, // m/s; di bawah ini (menurut sensor) dianggap diam
  spikeLimit: 3, // berapa lonjakan beruntun sebelum dianggap posisi baru yang sah
};

/* ------------------------------ Filter jejak ------------------------------ */

/**
 * @param {Partial<typeof DEFAULT_GPS_PROFILE>} profile
 * @returns {{
 *   push: (fix: {latitude:number, longitude:number, accuracy?:number|null, speed?:number|null, timestamp?:number}) =>
 *         ({ point: {latitude:number, longitude:number}, delta: number } | null),
 *   reset: () => void
 * }}
 *  `push` mengembalikan titik yang layak digambar beserta `delta` (meter dari titik sebelumnya),
 *  atau null bila titik diabaikan.
 */
export const createTrackFilter = (profile = {}) => {
  const cfg = { ...DEFAULT_GPS_PROFILE, ...profile };

  let state = null; // { lat, lng, variance, ts } - estimasi Kalman
  let last = null; // { latitude, longitude, ts } - titik terakhir yang diterima
  let lastTs = 0;
  let spikeStreak = 0;

  const reset = () => {
    state = null;
    last = null;
    lastTs = 0;
    spikeStreak = 0;
  };

  // Kalman 2D sederhana pada lat/lng. Varians tumbuh seiring waktu (posisi bisa berubah)
  // dan menyusut setiap ada pengukuran; titik dengan akurasi buruk berpengaruh kecil.
  const kalman = (lat, lng, accuracy, ts) => {
    const measurementVariance = accuracy * accuracy;

    if (!state) {
      state = { lat, lng, variance: measurementVariance, ts };
      return state;
    }

    const dtMs = ts - state.ts;
    if (dtMs > 0) {
      state.variance += (dtMs * cfg.processNoise * cfg.processNoise) / 1000;
    }

    const gain = state.variance / (state.variance + measurementVariance);
    state.lat += gain * (lat - state.lat);
    state.lng += gain * (lng - state.lng);
    state.variance = (1 - gain) * state.variance;
    state.ts = ts;
    return state;
  };

  const push = (fix) => {
    const { latitude, longitude, accuracy, speed, timestamp } = fix || {};

    // 1. Validasi
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

    const ts = Number.isFinite(timestamp) ? timestamp : Date.now();
    if (ts <= lastTs) return null; // basi atau tidak berurutan

    // 2. Gerbang akurasi (akurasi tidak diketahui dianggap sedang)
    const acc = Number.isFinite(accuracy) && accuracy > 0 ? accuracy : cfg.maxAccuracy / 2;
    if (acc > cfg.maxAccuracy) return null;

    lastTs = ts;

    // 3. Deteksi lonjakan: dibandingkan dengan titik mentah, dikurangi margin ketidakpastian.
    if (last) {
      const dt = Math.max((ts - last.ts) / 1000, 1);
      const rawDistance = haversine(last, { latitude, longitude });

      if (Math.max(0, rawDistance - acc) / dt > cfg.maxSpeed) {
        spikeStreak += 1;
        if (spikeStreak < cfg.spikeLimit) return null;

        // Posisi memang berpindah jauh (mis. GPS baru terkunci): mulai ulang filter di sini
        // dan JANGAN menambah jarak untuk lompatan tersebut.
        state = null;
        spikeStreak = 0;
        const restarted = kalman(latitude, longitude, acc, ts);
        last = { latitude: restarted.lat, longitude: restarted.lng, ts };
        return { point: { latitude: restarted.lat, longitude: restarted.lng }, delta: 0 };
      }

      spikeStreak = 0;
    }

    // 4. Kalman
    const estimate = kalman(latitude, longitude, acc, ts);
    const point = { latitude: estimate.lat, longitude: estimate.lng };

    if (!last) {
      last = { ...point, ts };
      return { point, delta: 0 };
    }

    // 5. Jarak minimum, mengikuti ketidakpastian estimasi saat ini
    const delta = haversine(last, point);
    const minStep = Math.max(cfg.minStep, cfg.stepSigmaFactor * Math.sqrt(estimate.variance));
    if (delta < minStep) return null;

    // 6. Sensor kecepatan perangkat (nilai negatif = tidak valid, mis. iOS memakai -1).
    //    Estimasi Kalman tetap belajar dari titik ini; hanya penggambarannya yang ditahan.
    const reportedSpeed = Number.isFinite(speed) && speed >= 0 ? speed : null;
    if (reportedSpeed !== null && reportedSpeed < cfg.stationarySpeed && delta < minStep * 2) {
      return null;
    }

    last = { ...point, ts };
    return { point, delta };
  };

  return { push, reset };
};

/* ------------------------------ Perataan rute ------------------------------ */

// Proyeksi datar lokal (akurat untuk rute aktivitas): derajat -> meter relatif titik pertama.
const projectLocal = (points) => {
  const origin = points[0];
  const metersPerDegLat = 110540;
  const metersPerDegLng = 111320 * Math.cos(toRad(origin.latitude));
  return points.map((p) => ({
    x: (p.longitude - origin.longitude) * metersPerDegLng,
    y: (p.latitude - origin.latitude) * metersPerDegLat,
  }));
};

const distanceToSegment = (p, a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);

  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

/**
 * Douglas–Peucker (iteratif, aman untuk rute panjang).
 * Membuang titik yang menyimpang kurang dari `epsilonM` meter dari garis lurus.
 */
export const simplifyRoute = (points, epsilonM = 3) => {
  const n = points.length;
  if (n < 3) return points.slice();

  const xy = projectLocal(points);
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;

  const stack = [[0, n - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop();
    let maxDistance = 0;
    let index = -1;

    for (let i = start + 1; i < end; i += 1) {
      const d = distanceToSegment(xy[i], xy[start], xy[end]);
      if (d > maxDistance) {
        maxDistance = d;
        index = i;
      }
    }

    if (index !== -1 && maxDistance > epsilonM) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }

  return points.filter((_, i) => keep[i] === 1);
};

/**
 * Chaikin corner-cutting: membulatkan sudut tajam. Titik awal dan akhir dipertahankan.
 */
export const smoothRoute = (points, iterations = 2) => {
  let current = points;

  for (let it = 0; it < iterations; it += 1) {
    if (current.length < 3) return current.slice();

    const next = [current[0]];
    for (let i = 0; i < current.length - 1; i += 1) {
      const a = current[i];
      const b = current[i + 1];
      next.push(
        {
          latitude: 0.75 * a.latitude + 0.25 * b.latitude,
          longitude: 0.75 * a.longitude + 0.25 * b.longitude,
        },
        {
          latitude: 0.25 * a.latitude + 0.75 * b.latitude,
          longitude: 0.25 * a.longitude + 0.75 * b.longitude,
        }
      );
    }
    next.push(current[current.length - 1]);
    current = next;
  }

  return current;
};

/** Rute untuk ditampilkan di peta setelah aktivitas selesai. */
export const toDisplayRoute = (points) =>
  points.length < 3 ? points.slice() : smoothRoute(simplifyRoute(points, 3), 2);

/**
 * Rute ringkas untuk disimpan di riwayat: maksimal `maxPoints` titik,
 * dalam bentuk [[lat, lng], ...] dengan 5 desimal (±1 m).
 */
export const compactRoute = (points, maxPoints = 300) => {
  let epsilon = 4;
  let simplified = simplifyRoute(points, epsilon);

  for (let i = 0; i < 8 && simplified.length > maxPoints; i += 1) {
    epsilon *= 2;
    simplified = simplifyRoute(points, epsilon);
  }

  return simplified
    .slice(0, maxPoints)
    .map((p) => [Number(p.latitude.toFixed(5)), Number(p.longitude.toFixed(5))]);
};