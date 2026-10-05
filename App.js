/**
 * Vitra — Root (Multi-Screen, state routing dengan Persistent Bottom Navigation Bar)
 * FIXED: SDK 57 Fake Splash Screen Bypass & Smooth Layout Transition
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Platform, StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { useFonts, Syne_800ExtraBold } from '@expo-google-fonts/syne';
import * as ExpoSplashScreen from 'expo-splash-screen'; 

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

import { getThemePreference, saveThemePreference } from './utils/storage';
import { supabase } from './utils/supabase'; 

/* --------------------------------- Kunci Splash Screen Native --------------------------------- */
ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

/* ------------------------------ Constants ------------------------------ */

const MIN_SPLASH_MS = 1800;
const DEFAULT_USER_NAME = 'Vitra User';

const THEMES = {
  light: {
    bg: '#F8FAFC', card: '#FFFFFF', primary: '#2563EB', text: '#0F172A',
    sub: '#64748B', border: '#E2E8F0', input: '#F1F5F9', danger: '#DC2626',
    onPrimary: '#FFFFFF', shadow: '#0F172A',
  },
  dark: {
    bg: '#09090B', card: '#18181B', primary: '#FF2D95', text: '#FAFAFA',
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
  const [themeMode, setThemeMode] = useState(null);
  const darkMode = themeMode ? themeMode === 'dark' : systemScheme === 'dark';
  const theme = useMemo(() => buildTheme(darkMode), [darkMode]);

  const fontsSettled = fontsLoaded || Boolean(fontError);
  const ready = !booting && fontsSettled;

  /* Callback khusus untuk menutup splash native hanya saat layout kustom sudah dirender */
  const hideNativeSplash = useCallback(() => {
    ExpoSplashScreen.hideAsync().catch(() => {});
  }, []);

  /* ------------------------------ Bootstrap & Auth Listener ------------------------------ */

  useEffect(() => {
    let active = true;
    const splashDelay = new Promise((resolve) => setTimeout(resolve, MIN_SPLASH_MS));

    (async () => {
      try {
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
      if (active) {
        setBooting(false); // hideAsync dihapus dari sini
      }
    })();

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

  /* ------------------------------ User Update & Logout ------------------------------ */

  const handleUpdateUser = useCallback(async (patch) => {
    if (patch.name) {
      const { error } = await supabase.auth.updateUser({
        data: { name: patch.name }
      });
      if (!error) {
        setUser(prev => ({ ...prev, ...patch }));
      }
    }
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  /* --------------------------------- Theme -------------------------------- */

  const handleDarkModeChange = useCallback(async (value) => {
    const mode = value ? 'dark' : 'light';
    setThemeMode(mode);
    await saveThemePreference(mode);
  }, []);

  /* ------------------- FAKE NATIVE SPLASH BYPASS ------------------- */
  if (!ready) {
    return (
      <View 
        style={[styles.fakeSplashContainer, { backgroundColor: '#000000' }]}
        onLayout={hideNativeSplash}
      >
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <SplashScreen theme={theme} />
      </View>
    );
  }

  /* --------------------------------- Auth Screen --------------------------------- */
  if (!user) {
    return (
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
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

  /* --------------------------------- Main App Screen --------------------------------- */
  const ActiveScreen = SCREENS[activeScreen] || HomeScreen;

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <View style={[styles.root, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
        <TrackerProvider>
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
          
          <BottomNavBar activeScreen={activeScreen} setActiveScreen={navigate} theme={theme} />
        </TrackerProvider>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screenContainer: { flex: 1 },
  fakeSplashContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
});