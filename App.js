/**
 * Vitra — Root (Multi-Screen, state routing dengan Persistent Bottom Navigation Bar)
 */
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { BackHandler, Platform, StatusBar, StyleSheet, useColorScheme, View, Animated } from 'react-native';
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

// Kita hanya mengambil theme preference, sesi ditangani Supabase
import { getThemePreference, saveThemePreference } from './utils/storage';
import { supabase } from './utils/supabase'; // <-- KONEKSI SUPABASE

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
    bg: '#09090B', card: '#18181B', primary: '#FF2D95', text: '#FAFAFA', // MAGENTA
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

const SCREENS = {
  home: HomeScreen,
  stopwatch: StopwatchScreen,
  record: RecordScreen,
  bmi: BMIScreen,
  profile: ProfileScreen,
};

const buildTheme = (isDark) => {
  const base = isDark ? THEMES.dark : THEMES.light;
  return {
    ...base,
    isDark,
    bmi: BMI_COLORS,
    fontBrand: Platform.select({
      ios: 'HelveticaNeue-CondensedBlack',
      android: 'sans-serif-condensed',
    }),
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
  const [authView, setAuthView] = useState('login'); 
  const [activeScreen, setActiveScreen] = useState('home');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
  fadeAnim.setValue(0);
  Animated.timing(fadeAnim, {
    toValue: 1,
    duration: 350, // Durasi animasi 350ms
    useNativeDriver: true,
  }).start();
}, [activeScreen]);
  const [themeMode, setThemeMode] = useState(null);
  const darkMode = themeMode ? themeMode === 'dark' : systemScheme === 'dark';
  const theme = useMemo(() => buildTheme(darkMode), [darkMode]);

  const fontsSettled = fontsLoaded || Boolean(fontError);
  const ready = !booting && fontsSettled;

  /* ------------------------------ Bootstrap & Auth Listener ------------------------------ */

  useEffect(() => {
    let active = true;
    const splashDelay = new Promise((resolve) => setTimeout(resolve, MIN_SPLASH_MS));

    (async () => {
      try {
        // Tarik sesi Supabase dan preferensi tema bersamaan
        const [themeRes, sessionRes] = await Promise.all([
          getThemePreference(),
          supabase.auth.getSession()
        ]);

        if (!active) return;
        
        const session = sessionRes.data.session;
        if (session) {
          setUser({
            name: session.user.user_metadata?.name || DEFAULT_USER_NAME,
            email: session.user.email,
            id: session.user.id
          });
        }
        if (themeRes) setThemeMode(themeRes);
      } catch (error) {
        console.log('Initialize app error:', error);
      }

      await splashDelay;
      if (active) setBooting(false);
    })();

    // LISTENER SUPABASE: Deteksi otomatis saat User mendaftar, login, atau logout
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setUser({
          name: session.user.user_metadata?.name || DEFAULT_USER_NAME,
          email: session.user.email,
          id: session.user.id
        });
        setAuthView('login');
        setActiveScreen('home');
      } else {
        setUser(null);
      }
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
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

  // Memperbarui nama akun langsung ke database Supabase
  const handleUpdateUser = useCallback(async (patch) => {
    if (patch.name) {
      const { data, error } = await supabase.auth.updateUser({
        data: { name: patch.name }
      });
      if (!error) {
        setUser(prev => ({ ...prev, ...patch }));
      }
    }
  }, []);

  // Logout dari Supabase
  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    // setUser(null) otomatis dipanggil oleh onAuthStateChange di atas
  }, []);

  /* --------------------------------- Theme -------------------------------- */

  const handleDarkModeChange = useCallback(async (value) => {
    const mode = value ? 'dark' : 'light';
    setThemeMode(mode);
    await saveThemePreference(mode);
  }, []);

  // PERBAIKAN: Jika belum ready, langsung tampilkan SplashScreen (Jangan return null!)
  if (!ready) {
    return <SplashScreen theme={theme} />;
  }

  if (!user) {
    return (
      <SafeAreaProvider>
        <View style={[styles.root, { backgroundColor: theme.bg }]}>
          <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
          {authView === 'register' ? (
            <RegisterScreen theme={theme} onBackToLogin={() => setAuthView('login')} />
          ) : (
            <LoginScreen theme={theme} onRegister={() => setAuthView('register')} />
          )}
        </View>
      </SafeAreaProvider>
    );
  }


  const ActiveScreen = SCREENS[activeScreen] || HomeScreen;

  return (
    <SafeAreaProvider>
      <View style={[styles.root, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
        <TrackerProvider>
          <View style={styles.screenContainer}>
            <Animated.View style={[{ flex: 1, opacity: fadeAnim }]}>
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
            </Animated.View>
          </View>
          
          <BottomNavBar activeScreen={activeScreen} setActiveScreen={navigate} theme={theme} />
        </TrackerProvider>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screenContainer: { flex: 1 },
});