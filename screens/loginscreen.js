// screens/loginscreen.js
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
import { EMAIL_MAX_LENGTH, PASSWORD_MAX_LENGTH, normalizeEmail, validateLogin } from '../utils/validation';
import { supabase } from '../utils/supabase'; // <-- KONEKSI SUPABASE

const APP_NAME = 'VITASTRIDE';

export default function LoginScreen({ theme: t, onRegister }) {
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
      // PROSES LOGIN KE SUPABASE
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      if (signInError) throw signInError;
      // Jika berhasil, Supabase akan memicu event otomatis ke App.js
    } catch (e) {
      console.log('Login error:', e);
      let errorMsg = e.message;
      if (errorMsg.includes('Invalid login credentials')) {
        errorMsg = 'Email atau kata sandi yang Anda masukkan salah.';
      }
      if (mountedRef.current) setError(errorMsg || 'Gagal masuk. Coba lagi.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [email, password, loading]);

  const handleForgotPassword = () => {
    setError('Fitur reset kata sandi sedang dalam pengembangan.');
  };

  return (
    <View style={s.safe}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          contentContainerStyle={s.content} 
          keyboardShouldPersistTaps="handled" 
          keyboardDismissMode="on-drag" 
          showsVerticalScrollIndicator={false}
        >
          <View style={s.header}>
            <Text style={s.appName}>{APP_NAME}</Text>
          </View>
          <SectionTitle theme={t} icon="log-in" title="Masuk" />

          <Card theme={t}>
            <Field theme={t} label="Email" icon="mail-outline" value={email} onChangeText={setEmail} placeholder="Masukkan email" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" maxLength={EMAIL_MAX_LENGTH} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => passwordRef.current?.focus()} editable={!loading} />
            <Field ref={passwordRef} theme={t} label="Kata sandi" icon="lock-closed-outline" value={password} onChangeText={setPassword} placeholder="Masukkan kata sandi" secure autoCapitalize="none" autoCorrect={false} autoComplete="password" textContentType="password" maxLength={PASSWORD_MAX_LENGTH} returnKeyType="go" onSubmitEditing={handleLogin} editable={!loading} />

            <TouchableOpacity onPress={handleForgotPassword} activeOpacity={0.7} style={s.forgot}>
              <Text style={s.link}>Lupa kata sandi?</Text>
            </TouchableOpacity>

            {error ? <Text style={s.errorText}>{error}</Text> : null}

            <View style={s.actions}>
              <Btn theme={t} label="Masuk" icon="log-in" onPress={handleLogin} loading={loading} />
            </View>
          </Card>

          <View style={s.registerRow}>
            <Text style={s.registerText}>Belum punya akun?</Text>
            <TouchableOpacity onPress={onRegister} activeOpacity={0.7}>
              <Text style={s.link}>Buat akun</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (t) => StyleSheet.create({ 
  safe: { flex: 1, backgroundColor: t.bg }, 
  flex: { flex: 1 }, 
  content: { flexGrow: 1, justifyContent: 'center', padding: 16, paddingBottom: 20 }, 
  header: { marginBottom: 28 }, 
  // PERBAIKAN: Memastikan warna teks mengikuti tema t.text dan t.sub secara absolut
  appName: { fontSize: 32, fontWeight: '900', fontFamily: t.fontBrand, letterSpacing: 1.5, textTransform: 'uppercase', color: t.text }, 
  tagline: { fontSize: 14, color: t.sub, marginTop: 6 }, 
  forgot: { alignSelf: 'flex-end', marginTop: -4, marginBottom: 12 }, 
  link: { fontSize: 13, fontWeight: '700', color: t.primary }, 
  errorText: { color: t.danger, fontSize: 13, fontWeight: '600', marginBottom: 12 }, 
  actions: { gap: 10 }, 
  registerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24 }, 
  registerText: { fontSize: 13, color: t.sub } 
});