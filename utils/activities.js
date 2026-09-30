/**
 * Vitra — definisi aktivitas.
 *
 * `met` dan rumus kalori sama dengan App.js lama.
 * `gps` = profil filter untuk merapikan jejak (lihat utils/gps.js):
 *  - maxAccuracy  : titik dengan akurasi lebih buruk dari ini (meter) dibuang
 *  - maxSpeed     : kecepatan maksimum masuk akal (m/s); di atasnya dianggap lonjakan GPS
 *  - processNoise : perkiraan seberapa cepat posisi bisa berubah (m/s) untuk filter Kalman.
 *                   Makin kecil = jejak makin halus tetapi lebih lambat mengikuti belokan
 *  - minStep      : jarak minimum (meter) dari titik terakhir sebelum titik baru digambar
 */

export const DEFAULT_WEIGHT_KG = 65;

/** Aktivitas di bawah jarak ini (meter) tetap menampilkan ringkasan, tetapi tidak disimpan ke riwayat. */
export const MIN_SAVE_DISTANCE_M = 20;

export const ACTIVITIES = [
  {
    key: 'run',
    label: 'Lari',
    icon: 'walk',
    met: 9.8,
    gps: { maxAccuracy: 25, maxSpeed: 9, processNoise: 3, minStep: 5 },
  },
  {
    key: 'bike',
    label: 'Bersepeda',
    icon: 'bicycle',
    met: 7.5,
    gps: { maxAccuracy: 25, maxSpeed: 20, processNoise: 6, minStep: 6 },
  },
  {
    key: 'swim',
    label: 'Berenang',
    icon: 'water',
    met: 6.0,
    gps: { maxAccuracy: 35, maxSpeed: 3, processNoise: 1.5, minStep: 5 },
  },
];

export const getActivity = (key) => ACTIVITIES.find((a) => a.key === key) || ACTIVITIES[0];

/** kkal = MET x berat (kg) x jam */
export const calculateCalories = (met, weightKg, durationSec) =>
  Math.round(met * weightKg * (durationSec / 3600));