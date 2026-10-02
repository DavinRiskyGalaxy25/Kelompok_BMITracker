// screens/registerscreen.js
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

import ScreenHeader from '../components/ScreenHeaderTemp';
import { Btn, Card, Field, SectionTitle } from '../components/ui';
import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  normalizeEmail,
  normalizeName,
  validateRegister,
} from '../utils/validation';
import { supabase } from '../utils/supabase'; // <-- KONEKSI SUPABASE

export default function RegisterScreen({ theme: t, onBackToLogin }) {
  const s = useMemo(() => createStyles(t), [t]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleRegister = useCallback(async () => {
    if (loading) return;
    Keyboard.dismiss();

    const cleanName = normalizeName(name);
    const cleanEmail = normalizeEmail(email);
    const validationError = validateRegister({
      name: cleanName,
      email: cleanEmail,
      password,
      confirmPassword,
    });

    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setLoading(true);

    try {
      // PROSES PEMBUATAN AKUN KE SUPABASE
      const { error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: {
            name: cleanName, // Menyimpan nama ke database Supabase
          },
        },
      });

      if (signUpError) throw signUpError;
      // Jika berhasil, Supabase akan memicu event otomatis ke App.js
    } catch (e) {
      console.log('Register error:', e);
      let errorMsg = e.message;
      if (errorMsg.includes('User already registered')) {
        errorMsg = 'Email ini sudah terdaftar.';
      }
      if (mountedRef.current) setError(errorMsg || 'Gagal membuat akun. Coba lagi.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [name, email, password, confirmPassword, loading]);

  return (
    <View style={s.safe}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          contentContainerStyle={s.content} 
          keyboardShouldPersistTaps="handled" 
          showsVerticalScrollIndicator={false}
        >
          <ScreenHeader theme={t} title="Buat akun" onBack={onBackToLogin} />
          
          <Card theme={t}>
            <Field theme={t} label="Nama lengkap" icon="person-outline" value={name} onChangeText={setName} placeholder="Nama Anda" autoCapitalize="words" autoComplete="name" textContentType="name" maxLength={NAME_MAX_LENGTH} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => emailRef.current?.focus()} editable={!loading} />
            <Field ref={emailRef} theme={t} label="Email" icon="mail-outline" value={email} onChangeText={setEmail} placeholder="Masukkan email" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" maxLength={EMAIL_MAX_LENGTH} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => passwordRef.current?.focus()} editable={!loading} />
            <Field ref={passwordRef} theme={t} label="Kata sandi" icon="lock-closed-outline" value={password} onChangeText={setPassword} placeholder={`Minimal ${PASSWORD_MIN_LENGTH} karakter`} secure autoCapitalize="none" autoCorrect={false} autoComplete="password-new" textContentType="newPassword" maxLength={PASSWORD_MAX_LENGTH} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => confirmRef.current?.focus()} editable={!loading} />
            <Field ref={confirmRef} theme={t} label="Ulangi kata sandi" icon="lock-closed-outline" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Ketik ulang kata sandi" secure autoCapitalize="none" autoCorrect={false} autoComplete="password-new" textContentType="newPassword" maxLength={PASSWORD_MAX_LENGTH} returnKeyType="go" onSubmitEditing={handleRegister} editable={!loading} />

            {error ? <Text style={s.errorText}>{error}</Text> : null}

            <Btn theme={t} label="Buat akun" icon="person-add" onPress={handleRegister} loading={loading} />
          </Card>

          <View style={s.loginRow}>
            <Text style={s.loginText}>Sudah punya akun?</Text>
            <TouchableOpacity onPress={onBackToLogin} activeOpacity={0.7}>
              <Text style={s.link}>Masuk</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (t) => StyleSheet.create({ safe: { flex: 1, backgroundColor: t.bg }, flex: { flex: 1 }, content: { padding: 16, paddingBottom: 20 }, subtitle: { fontSize: 14, color: t.sub, marginTop: -8, marginBottom: 24, lineHeight: 20 }, errorText: { color: t.danger, fontSize: 13, fontWeight: '600', marginBottom: 12 }, loginRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24 }, loginText: { fontSize: 13, color: t.sub }, link: { fontSize: 13, fontWeight: '700', color: t.primary } });