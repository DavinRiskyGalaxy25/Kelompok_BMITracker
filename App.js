/**
 * Vitra — Root (Multi-Screen, state routing tanpa React Navigation)
 *
 * Install dependencies:
 *   npx expo install @react-native-async-storage/async-storage react-native-safe-area-context \
 *     @expo-google-fonts/syne expo-font @expo/vector-icons expo-location expo-sharing \
 *     react-native-webview react-native-view-shot
 *
 * Rekaman GPS: state ada di hooks/useTracker.js (TrackerProvider), bukan di screen.
 *
 * Navigasi: setiap screen menerima `setActiveScreen('home' | 'bmi' | 'activity' | 'map' | 'history' | 'profile')`.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Platform, StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Syne_800ExtraBold } from '@expo-google-fonts/syne';

import SplashScreen from './screens/splashscreen';
import LoginScreen from './screens/loginscreen';
import RegisterScreen from './screens/registerscreen';

import HomeScreen from './screens/homescreen';
import BMIScreen from './screens/bmiscreen';
import ActivityScreen from './screens/activityscreen';
import MapScreen from './screens/mapscreen';
import HistoryScreen from './screens/historyscreen';
import ProfileScreen from './screens/profilescreen';

import { TrackerProvider } from './hooks/usetracker';
import {
  getSession,
  getThemePreference,
  removeSession,
  saveSession,
  saveThemePreference,
} from './utils/storage';

/* ------------------------------ Constants ------------------------------ */

const MIN_SPLASH_MS = 1500;
const DEFAULT_USER_NAME = 'Vitra User';

const THEMES = {
  light: {
    bg: '#F8FAFC', card: '#FFFFFF', primary: '#2563EB', text: '#0F172A',
    sub: '#64748B', border: '#E2E8F0', input: '#F1F5F9', danger: '#DC2626',
    onPrimary: '#FFFFFF', shadow: '#0F172A',
  },
  dark: {
    bg: '#09090B', card: '#18181B', primary: '#F97316', text: '#FAFAFA',
    sub: '#A1A1AA', border: '#27272A', input: '#27272A', danger: '#EF4444',
    onPrimary: '#FFFFFF', shadow: '#000000',
  },
};

// Warna semantik kategori BMI (sama di mode terang/gelap). Dipakai lewat `theme.bmi[kategori]`.
const BMI_COLORS = {
  underweight: '#0EA5E9',
  normal: '#22C55E',
  overweight: '#F59E0B',
  obese: '#EF4444',
};

// Daftar screen yang valid. Key di sini = argumen setActiveScreen().
const SCREENS = {
  home: HomeScreen,
  bmi: BMIScreen,
  activity: ActivityScreen,
  map: MapScreen,
  history: HistoryScreen,
  profile: ProfileScreen,
};

/**
 * Token tema Vitra (bg, card, primary, text, sub, border, input, danger)
 * + token pendukung (onPrimary, shadow, isDark, fontBrand).
 */
const buildTheme = (isDark) => {
  const base = isDark ? THEMES.dark : THEMES.light;

  return {
    ...base,
    isDark,
    bmi: BMI_COLORS,
    // Sama dengan App.js lama: iOS memakai Avenir-Heavy, Android memakai Syne.
    // Ganti ke 'Syne_800ExtraBold' saja bila ingin Syne di semua platform.
    fontBrand: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'Syne_800ExtraBold',

    // LEGACY ALIAS — hanya agar screen lama (Splash/Login/Register/BMI/dst.) tetap
    // terbaca selama migrasi. Hapus blok ini setelah semua screen memakai token Vitra.
    background: base.bg,
    secondary: base.sub,
    cardSoft: base.input,
    pink: base.primary,
    pinkLight: base.primary,
    neon: base.primary,
  };
};

/* --------------------------------- App --------------------------------- */

export default function App() {
  // Semua hook dipanggil tanpa syarat di atas (tidak ada early return sebelum hook).
  const systemScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({ Syne_800ExtraBold });

  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [authView, setAuthView] = useState('login'); // 'login' | 'register'
  const [activeScreen, setActiveScreen] = useState('home');
  const [themeMode, setThemeMode] = useState(null); // null = ikuti tema sistem

  const darkMode = themeMode ? themeMode === 'dark' : systemScheme === 'dark';
  const theme = useMemo(() => buildTheme(darkMode), [darkMode]);

  // Bila font gagal dimuat, lanjut dengan font sistem daripada memblokir app.
  const fontsSettled = fontsLoaded || Boolean(fontError);
  const ready = !booting && fontsSettled;

  /* ------------------------------ Bootstrap ------------------------------ */

  useEffect(() => {
    let active = true;
    const splashDelay = new Promise((resolve) => setTimeout(resolve, MIN_SPLASH_MS));

    (async () => {
      try {
        const [session, savedTheme] = await Promise.all([getSession(), getThemePreference()]);
        if (!active) return;
        if (session) setUser(session);
        if (savedTheme) setThemeMode(savedTheme);
      } catch (error) {
        console.log('Initialize app error:', error);
      }

      await splashDelay;
      if (active) setBooting(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  /* ------------------------------- Routing ------------------------------- */

  const navigate = useCallback((screen) => {
    setActiveScreen(Object.prototype.hasOwnProperty.call(SCREENS, screen) ? screen : 'home');
  }, []);

  // Tombol back Android: kembali ke Home / Login, bukan langsung keluar app.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (user && activeScreen !== 'home') {
        setActiveScreen('home');
        return true;
      }
      if (!user && authView === 'register') {
        setAuthView('login');
        return true;
      }
      return false;
    });

    return () => subscription.remove();
  }, [user, activeScreen, authView]);

  /* -------------------------------- Session ------------------------------- */

  // Hanya name & email yang disimpan. Password tidak pernah masuk ke sesi.
  const startSession = useCallback(async (profile) => {
    const session = {
      name: String(profile?.name ?? '').trim() || DEFAULT_USER_NAME,
      email: String(profile?.email ?? '').trim().toLowerCase(),
    };

    await saveSession(session);
    setUser(session);
    setAuthView('login');
    setActiveScreen('home');
  }, []);

  const handleUpdateUser = useCallback(
    async (patch) => {
      const nextUser = { ...(user || {}), ...(patch || {}) };
      await saveSession(nextUser);
      setUser(nextUser);
    },
    [user]
  );

  const handleLogout = useCallback(async () => {
    await removeSession();
    setUser(null);
    setAuthView('login');
    setActiveScreen('home');
  }, []);

  /* --------------------------------- Theme -------------------------------- */

  const handleDarkModeChange = useCallback(async (value) => {
    const mode = value ? 'dark' : 'light';
    setThemeMode(mode);
    await saveThemePreference(mode);
  }, []);

  /* --------------------------------- Render -------------------------------- */

  let content;

  if (!ready) {
    // Splash baru dirender setelah font siap agar brand tampil dengan Syne sejak frame pertama.
    content = fontsSettled ? <SplashScreen theme={theme} /> : null;
  } else if (!user) {
    content =
      authView === 'register' ? (
        <RegisterScreen
          theme={theme}
          onRegister={startSession}
          onBackToLogin={() => setAuthView('login')}
        />
      ) : (
        <LoginScreen
          theme={theme}
          onLogin={startSession}
          onRegister={() => setAuthView('register')}
        />
      );
  } else {
    const ActiveScreen = SCREENS[activeScreen] || HomeScreen;

    // TrackerProvider berada di atas screen (tanpa `key`) sehingga rekaman GPS tetap berjalan
    // saat berpindah screen. Saat logout provider ikut di-unmount dan rekaman dihentikan.
    content = (
      <TrackerProvider>
        <ActiveScreen
          key={activeScreen}
          theme={theme}
          user={user}
          darkMode={darkMode}
          setDarkMode={handleDarkModeChange}
          onLogout={handleLogout}
          onUpdateUser={handleUpdateUser}
          setActiveScreen={navigate}
        />
      </TrackerProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={[styles.root, { backgroundColor: theme.bg }]}>
        <StatusBar
          barStyle={darkMode ? 'light-content' : 'dark-content'}
          backgroundColor={theme.bg}
        />
        {content}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});