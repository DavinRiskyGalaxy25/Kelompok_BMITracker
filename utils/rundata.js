/**
 * vstride — data sementara antar-screen untuk sesi lari yang baru selesai.
 *
 * Karena routing memakai state (bukan expo-router), data seperti jumlah
 * langkah dan foto harus disimpan di luar React tree agar bisa diakses
 * oleh RunSummaryScreen setelah navigasi dari ActivityScreen.
 *
 * Data ini bersifat ephemeral — di-clear setiap kali aktivitas disimpan
 * atau dibuang.
 */

let _steps = 0;
let _photoUri = null;

export const setRunSteps = (n) => { _steps = typeof n === 'number' ? n : 0; };
export const getRunSteps = () => _steps;

export const setRunPhoto = (uri) => { _photoUri = uri || null; };
export const getRunPhoto = () => _photoUri;

export const clearRunData = () => {
  _steps = 0;
  _photoUri = null;
};

