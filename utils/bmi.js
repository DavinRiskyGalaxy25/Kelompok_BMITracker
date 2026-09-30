/**
 * Vitra — logika kalkulator IMT/BMI (dipindah dari App.js lama tanpa perubahan rumus).
 *
 * File ini murni logika (tanpa React, tanpa warna). Warna kategori diambil dari
 * `theme.bmi[category]` yang didefinisikan di App.js.
 */

/* --------------------------------- Konstanta --------------------------------- */

export const GENDERS = [
  { key: 'male', label: 'Pria', icon: 'male' },
  { key: 'female', label: 'Wanita', icon: 'female' },
];

export const LIMITS = {
  age: { min: 1, max: 120 },
  height: { min: 50, max: 250 },
  weight: { min: 10, max: 500 },
};

export const BMI_META = {
  underweight: {
    label: 'Kurus / Underweight',
    icon: 'barbell',
    title: 'Naikkan massa tubuh secara sehat',
    tips: [
      'Makan 5–6 kali sehari dengan porsi kecil namun padat kalori.',
      'Perbanyak protein: telur, dada ayam, ikan, tempe/tahu, susu, dan kacang-kacangan.',
      'Tambah lemak sehat dan karbohidrat kompleks: alpukat, kacang, nasi merah, oatmeal, ubi.',
      'Latihan angkat beban (squat, deadlift, bench press) 3–4x/minggu, batasi kardio berlebih, dan tidur cukup.',
    ],
  },
  normal: {
    label: 'Normal',
    icon: 'checkmark-circle',
    title: 'Pertahankan kondisi Anda',
    tips: [
      'Jaga pola makan seimbang: karbohidrat, protein, lemak sehat, sayur, dan buah.',
      'Olahraga rutin minimal 150 menit/minggu intensitas sedang, tambahkan 2x latihan kekuatan.',
      'Cukupi air putih dan tidur 7–9 jam per malam.',
      'Timbang berat badan berkala agar perubahan cepat terdeteksi.',
    ],
  },
  overweight: {
    label: 'Gemuk / Overweight',
    icon: 'flame',
    title: 'Turunkan berat badan bertahap',
    tips: [
      'Buat defisit kalori moderat (±300–500 kkal/hari) dari kebutuhan harian.',
      'Batasi gula tambahan, minuman manis, dan karbohidrat olahan; pilih karbohidrat berserat.',
      'Kardio intensitas sedang (jalan cepat, bersepeda, berenang) 30–45 menit, 4–5x/minggu.',
      'Perbanyak sayur, protein tanpa lemak, dan air putih.',
    ],
  },
  obese: {
    label: 'Obesitas',
    icon: 'warning',
    title: 'Mulai penurunan berat badan terarah',
    tips: [
      'Terapkan defisit kalori (±500 kkal/hari) dan batasi gula serta karbohidrat olahan secara ketat.',
      'Mulai kardio intensitas sedang low-impact (jalan cepat, berenang, sepeda) 30–60 menit, 5x/minggu.',
      'Naikkan durasi bertahap untuk melindungi sendi dan mencegah cedera.',
      'Konsultasikan dengan dokter atau ahli gizi untuk rencana yang aman dan terpantau.',
    ],
  },
};

/** Proporsi lebar tiap segmen pada bar skala (rentang tampilan BMI 15–40). */
export const BMI_SCALE = [
  { key: 'underweight', flex: 3.5 },
  { key: 'normal', flex: 6.5 },
  { key: 'overweight', flex: 5 },
  { key: 'obese', flex: 10 },
];

const SCALE_MIN = 15;
const SCALE_MAX = 40;

/* ---------------------------------- Helper ---------------------------------- */

/** Terima koma desimal ("65,5"). Mengembalikan NaN bila bukan angka. */
export const parseNum = (value) => {
  const n = parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

/** Sisakan digit, titik, dan koma saja. */
export const onlyNumeric = (value) => String(value ?? '').replace(/[^0-9.,]/g, '');

export const getBmiCategory = (bmi) => {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  return 'obese';
};

/** Posisi marker pada bar skala, 0–100 (nilai di luar 15–40 dijepit). */
export const getScaleMarkerPct = (bmi) =>
  ((Math.min(SCALE_MAX, Math.max(SCALE_MIN, bmi)) - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;

/* ---------------------------------- Hitung ---------------------------------- */

/**
 * @param {{ gender: 'male'|'female', age: string, height: string, weight: string }} input
 * @returns {{ error: string } | { result: { bmi:number, category:string, bmr:number, age:number, gender:string, height:number, weight:number } }}
 */
export const calculateBmi = ({ gender, age, height, weight }) => {
  const a = parseNum(age);
  const h = parseNum(height);
  const w = parseNum(weight);

  if (!(a >= LIMITS.age.min && a <= LIMITS.age.max)) {
    return { error: `Usia harus antara ${LIMITS.age.min}–${LIMITS.age.max} tahun.` };
  }
  if (!(h >= LIMITS.height.min && h <= LIMITS.height.max)) {
    return { error: `Tinggi badan harus antara ${LIMITS.height.min}–${LIMITS.height.max} cm.` };
  }
  if (!(w >= LIMITS.weight.min && w <= LIMITS.weight.max)) {
    return { error: `Berat badan harus antara ${LIMITS.weight.min}–${LIMITS.weight.max} kg.` };
  }

  const bmi = w / Math.pow(h / 100, 2);
  // Mifflin–St Jeor
  const bmr = 10 * w + 6.25 * h - 5 * a + (gender === 'male' ? 5 : -161);

  return {
    result: {
      bmi,
      category: getBmiCategory(bmi),
      bmr: Math.round(bmr),
      age: a,
      gender,
      height: h,
      weight: w,
    },
  };
};