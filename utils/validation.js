/**
 * vstride — validasi form (dipakai LoginScreen dan RegisterScreen).
 *
 * Validasi di sisi klien hanya untuk UX. Saat backend tersedia, aturan yang sama
 * WAJIB diulang di server; jangan pernah mengandalkan validasi klien untuk keamanan.
 */

export const EMAIL_MAX_LENGTH = 254; // batas praktis RFC 5321
export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 60;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();

export const normalizeName = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');

export const isValidEmail = (email) => email.length <= EMAIL_MAX_LENGTH && EMAIL_REGEX.test(email);

const toTitleCase = (text) => text.replace(/\b\p{L}/gu, (char) => char.toUpperCase());

/** "budi.santoso@mail.com" -> "Budi Santoso" */
export const nameFromEmail = (email) => {
  const local = String(email ?? '').split('@')[0].replace(/[._-]+/g, ' ').trim();
  return local ? toTitleCase(local) : '';
};

/**
 * Validasi form login. Mengembalikan pesan error, atau null bila valid.
 */
export const validateLogin = ({ email, password }) => {
  if (!email) return 'Email belum diisi.';
  if (!isValidEmail(email)) return 'Format email tidak valid.';
  if (!password) return 'Kata sandi belum diisi.';
  return null;
};

/**
 * Validasi form pendaftaran. Mengembalikan pesan error, atau null bila valid.
 */
export const validateRegister = ({ name, email, password, confirmPassword }) => {
  if (!name) return 'Nama belum diisi.';
  if (name.length < NAME_MIN_LENGTH) return `Nama minimal ${NAME_MIN_LENGTH} karakter.`;
  if (name.length > NAME_MAX_LENGTH) return `Nama maksimal ${NAME_MAX_LENGTH} karakter.`;
  if (!email) return 'Email belum diisi.';
  if (!isValidEmail(email)) return 'Format email tidak valid.';
  if (!password) return 'Kata sandi belum diisi.';
  if (password.length < PASSWORD_MIN_LENGTH) return `Kata sandi minimal ${PASSWORD_MIN_LENGTH} karakter.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `Kata sandi maksimal ${PASSWORD_MAX_LENGTH} karakter.`;
  if (password !== confirmPassword) return 'Konfirmasi kata sandi tidak sama.';
  return null;
};