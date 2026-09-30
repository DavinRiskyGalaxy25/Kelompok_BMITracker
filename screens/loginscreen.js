/**
 * LoginScreen — Vitra
 *
 * Props:
 *  - theme       token tema Vitra dari App.js
 *  - onLogin     async ({ name, email }) => void   (password TIDAK diteruskan)
 *  - onRegister  () => void                         (pindah ke form pendaftaran)
 *
 * STATUS: autentikasi masih stub (prototype lokal). Semua kombinasi email/password yang
 * lolos validasi format akan membuat sesi. Ganti isi `handleLogin` dengan panggilan
 * ke authService/backend sebelum rilis; simpan token di expo-secure-store.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Btn, Card, Field, SectionTitle } from '../components/ui';
import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  nameFromEmail,
  normalizeEmail,
  validateLogin,
} from '../utils/validation';

const APP_NAME = 'Vitra';
const DEFAULT_USER_NAME = 'Vitra User';

// Hanya untuk development. Blok yang memakainya dibungkus __DEV__ sehingga
// dihapus dari build produksi dan kredensial ini tidak ikut terkirim.
const DEMO_ACCOUNT = { email: 'demo@vitra.app', password: 'demo12345' };

export default function LoginScreen({ theme: t, onLogin, onRegister }) {
  const s = useMemo(() => createStyles(t), [t]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleLogin = useCallback(async () => {
    if (loading) return;
    Keyboard.dismiss();

    const cleanEmail = normalizeEmail(email);
    const validationError = validateLogin({ email: cleanEmail, password });

    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Password sengaja tidak dikirim ke sesi. Verifikasi kredensial = tugas backend.
      await onLogin({
        name: nameFromEmail(cleanEmail) || DEFAULT_USER_NAME,
        email: cleanEmail,
      });
    } catch (e) {
      console.log('Login error:', e);
      if (mountedRef.current) setError('Gagal masuk. Coba lagi.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [email, password, loading, onLogin]);

  const handleForgotPassword = () => {
    setError('Reset kata sandi akan tersedia setelah sistem akun terhubung.');
  };

  const fillDemoAccount = () => {
    setEmail(DEMO_ACCOUNT.email);
    setPassword(DEMO_ACCOUNT.password);
    setError('');
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.safe}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.header}>
            <Text style={s.appName}>{APP_NAME}</Text>
            <Text style={s.tagline}>Masuk untuk melanjutkan aktivitas Anda.</Text>
          </View>

          <SectionTitle theme={t} icon="log-in" title="Masuk" />

          <Card theme={t}>
            <Field
              theme={t}
              label="Email"
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              placeholder="Masukkan email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              maxLength={EMAIL_MAX_LENGTH}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!loading}
            />

            <Field
              ref={passwordRef}
              theme={t}
              label="Kata sandi"
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              placeholder="Masukkan kata sandi"
              secure
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              textContentType="password"
              maxLength={PASSWORD_MAX_LENGTH}
              returnKeyType="go"
              onSubmitEditing={handleLogin}
              editable={!loading}
            />

            <TouchableOpacity
              onPress={handleForgotPassword}
              activeOpacity={0.7}
              style={s.forgot}
              accessibilityRole="button"
            >
              <Text style={s.link}>Lupa kata sandi?</Text>
            </TouchableOpacity>

            {error ? (
              <Text style={s.errorText} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}

            <View style={s.actions}>
              <Btn theme={t} label="Masuk" icon="log-in" onPress={handleLogin} loading={loading} />
              {__DEV__ ? (
                <Btn
                  theme={t}
                  label="Isi akun demo (dev)"
                  icon="flash"
                  variant="soft"
                  onPress={fillDemoAccount}
                  disabled={loading}
                />
              ) : null}
            </View>
          </Card>

          <View style={s.registerRow}>
            <Text style={s.registerText}>Belum punya akun?</Text>
            <TouchableOpacity onPress={onRegister} activeOpacity={0.7} accessibilityRole="button">
              <Text style={s.link}>Buat akun</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (t) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    flex: { flex: 1 },
    content: { flexGrow: 1, justifyContent: 'center', padding: 16, paddingBottom: 48 },

    header: { marginBottom: 28 },
    appName: {
      fontSize: 32,
      fontWeight: '900',
      fontFamily: t.fontBrand, // Otomatis Strava style di Android & iPhone
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color: t.text,
    },
    tagline: { fontSize: 14, color: t.sub, marginTop: 6 },

    forgot: { alignSelf: 'flex-end', marginTop: -4, marginBottom: 12 },
    link: { fontSize: 13, fontWeight: '700', color: t.primary },
    errorText: { color: t.danger, fontSize: 13, fontWeight: '600', marginBottom: 12 },

    actions: { gap: 10 },

    registerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 24,
    },
    registerText: { fontSize: 13, color: t.sub },
  });