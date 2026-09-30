/**
 * Vitra — Root (Multi-Screen, state routing dengan Persistent Bottom Navigation Bar)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Platform, StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Syne_800ExtraBold } from '@expo-google-fonts/syne';

import SplashScreen from './screens/splashscreen';
import LoginScreen from './screens/loginscreen';
import RegisterScreen from './screens/registerscreen';

import HomeScreen from './screens/homescreen';
import StopwatchScreen from './screens/stopwatchscreen';
import RecordScreen from './screens/activityscreen';
import BMIScreen from './screens/bmiscreen';
import ProfileScreen from './screens/profilescreen';

import BottomNavBar from './components/BottomNavBar';
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

const BMI_COLORS = {
  underweight: '#0EA5E9',
  normal: '#22C55E',
  overweight: '#F59E0B',
  obese: '#EF4444',
};

// Daftar 5 menu utama aplikasi
const SCREENS = {
  home: HomeScreen,
  stopwatch: StopwatchScreen,
  record: RecordScreen,
  bmi: BMIScreen,
  profile: ProfileScreen,
};

// Di App.js
const buildTheme = (isDark) => {
  const base = isDark ? THEMES.dark : THEMES.light;

  return {
    ...base,
    isDark,
    bmi: BMI_COLORS,

    // 1. Font Judul Brand (Mirip Strava, tegas & sporty, bawaan sistem tanpa perlu install)
    fontBrand: Platform.select({
      ios: 'HelveticaNeue-CondensedBlack',
      android: 'sans-serif-condensed',
    }),

    // 2. Font Monospace untuk seluruh teks aplikasi (Bawaan sistem)
    fontMono: Platform.select({
      ios: 'Courier',
      android: 'monospace',
    }),

    fontRegular: Platform.select({
      ios: 'Courier',
      android: 'monospace',
    }),
  };
};

/* --------------------------------- App --------------------------------- */

export default function App() {
  const systemScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({ Syne_800ExtraBold });

  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [authView, setAuthView] = useState('login'); // 'login' | 'register'
  const [activeScreen, setActiveScreen] = useState('home');
  const [themeMode, setThemeMode] = useState(null);

  const darkMode = themeMode ? themeMode === 'dark' : systemScheme === 'dark';
  const theme = useMemo(() => buildTheme(darkMode), [darkMode]);

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

  if (!ready) {
    return fontsSettled ? <SplashScreen theme={theme} /> : null;
  }

  if (!user) {
    return (
      <SafeAreaProvider>
        <View style={[styles.root, { backgroundColor: theme.bg }]}>
          <StatusBar
            barStyle={darkMode ? 'light-content' : 'dark-content'}
            backgroundColor={theme.bg}
          />
          {authView === 'register' ? (
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
          )}
        </View>
      </SafeAreaProvider>
    );
  }

  const ActiveScreen = SCREENS[activeScreen] || HomeScreen;

  return (
    <SafeAreaProvider>
      <View style={[styles.root, { backgroundColor: theme.bg }]}>
        <StatusBar
          barStyle={darkMode ? 'light-content' : 'dark-content'}
          backgroundColor={theme.bg}
        />
        <TrackerProvider>
          {/* Viewport Konten Layar Aktif */}
          <View style={styles.screenContainer}>
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
          </View>

          {/* PERSISTENT BOTTOM NAVBAR (Terkunci di bawah, tidak berkedip) */}
          <BottomNavBar
            activeScreen={activeScreen}
            setActiveScreen={navigate}
            theme={theme}
          />
        </TrackerProvider>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screenContainer: { flex: 1 },
});