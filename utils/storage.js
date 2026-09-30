/**
 * Vitra — Storage helper (AsyncStorage)
 *
 * Install:
 *   npx expo install @react-native-async-storage/async-storage
 *
 * Semua nilai disimpan sebagai JSON. Fungsi di file ini tidak pernah melempar
 * error: kegagalan dicatat ke console dan mengembalikan nilai fallback,
 * sehingga alur UI tidak crash karena storage.
 *
 * Catatan keamanan: AsyncStorage TIDAK terenkripsi. Simpan hanya data non-rahasia
 * (nama, email, preferensi). Jika nanti ada token/kredensial dari backend,
 * simpan di `expo-secure-store`, bukan di sini. Jangan pernah menyimpan password.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

/* --------------------------------- Keys --------------------------------- */

export const STORAGE_KEYS = {
  session: '@vitra_session',
  theme: '@vitra_theme',
  bmiHistory: '@vitra_bmi_history_v1',
  activityHistory: '@vitra_activity_history_v1',
};

const VALID_THEMES = ['light', 'dark'];

/* ------------------------------ Generic API ------------------------------ */

export async function saveData(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.log(`[storage] saveData("${key}") gagal:`, error);
    return false;
  }
}

export async function getData(key, fallback = null) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    // Termasuk JSON korup: kembalikan fallback agar app tetap berjalan.
    console.log(`[storage] getData("${key}") gagal:`, error);
    return fallback;
  }
}

export async function removeData(key) {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (error) {
    console.log(`[storage] removeData("${key}") gagal:`, error);
    return false;
  }
}

/* --------------------------------- Session -------------------------------- */

export async function getSession() {
  const session = await getData(STORAGE_KEYS.session, null);
  const isValid = session !== null && typeof session === 'object' && !Array.isArray(session);
  return isValid ? session : null;
}

export const saveSession = (session) => saveData(STORAGE_KEYS.session, session);

export const removeSession = () => removeData(STORAGE_KEYS.session);

/* ---------------------------------- Theme --------------------------------- */

/** @returns {Promise<'light' | 'dark' | null>} null = belum pernah dipilih (ikuti sistem) */
export async function getThemePreference() {
  const value = await getData(STORAGE_KEYS.theme, null);
  return VALID_THEMES.includes(value) ? value : null;
}

export async function saveThemePreference(mode) {
  if (!VALID_THEMES.includes(mode)) return false;
  return saveData(STORAGE_KEYS.theme, mode);
}

/* ------------------------------ Riwayat (read) ------------------------------ */

async function getList(key) {
  const value = await getData(key, []);
  return Array.isArray(value) ? value : [];
}

/** Riwayat BMI, terbaru di index 0. */
export const getBmiHistory = () => getList(STORAGE_KEYS.bmiHistory);

const BMI_HISTORY_LIMIT = 30;

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const BMI_DEDUPE_FIELDS = ['bmi', 'age', 'gender', 'height', 'weight'];

/**
 * Simpan hasil hitung BMI (terbaru di index 0, maksimal 30 entri).
 * Entri dengan input identik dengan entri terbaru dilewati agar riwayat tidak terduplikasi
 * saat tombol Hitung ditekan berulang.
 */
export async function addBmiEntry(entry) {
  const list = await getBmiHistory();
  const latest = list[0];

  if (latest && BMI_DEDUPE_FIELDS.every((key) => latest[key] === entry[key])) {
    return list;
  }

  const next = [{ id: newId(), date: new Date().toISOString(), ...entry }, ...list].slice(0, BMI_HISTORY_LIMIT);
  await saveData(STORAGE_KEYS.bmiHistory, next);
  return next;
}

export async function deleteBmiEntry(id) {
  const next = (await getBmiHistory()).filter((item) => item?.id !== id);
  await saveData(STORAGE_KEYS.bmiHistory, next);
  return next;
}

export const clearBmiHistory = () => removeData(STORAGE_KEYS.bmiHistory);

/** Riwayat aktivitas. Setiap item minimal punya `date` (ISO string). */
export const getActivityHistory = () => getList(STORAGE_KEYS.activityHistory);

const ACTIVITY_HISTORY_LIMIT = 100;

/**
 * Simpan aktivitas selesai (terbaru di index 0, maksimal 100 entri).
 * Bentuk entri: { id, date(ISO), activity, label, km, durationSec, calories, pace, speed, route:[[lat,lng]] }
 * @returns {Promise<boolean>} true bila berhasil tersimpan
 */
export async function addActivityEntry(entry) {
  const list = await getActivityHistory();
  const next = [{ id: newId(), date: new Date().toISOString(), ...entry }, ...list].slice(0, ACTIVITY_HISTORY_LIMIT);
  return saveData(STORAGE_KEYS.activityHistory, next);
}

export async function deleteActivityEntry(id) {
  const next = (await getActivityHistory()).filter((item) => item?.id !== id);
  await saveData(STORAGE_KEYS.activityHistory, next);
  return next;
}

export const clearActivityHistory = () => removeData(STORAGE_KEYS.activityHistory);

/** Berat terakhir dari kalkulator BMI (untuk hitung kalori), atau null bila belum pernah dihitung. */
export async function getLatestWeightKg() {
  const [latest] = await getBmiHistory();
  const weight = Number(latest?.weight);
  return Number.isFinite(weight) && weight >= 10 && weight <= 500 ? weight : null;
}