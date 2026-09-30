/**
 * SplashScreen — Vitra
 *
 * Props:
 *  - theme  token tema Vitra dari App.js
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';

const APP_NAME = 'Vitra';
const TAGLINE = 'Lacak aktivitas, pahami kesehatan Anda';

export default function SplashScreen({ theme: t }) {
  const s = useMemo(() => createStyles(t), [t]);

  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]);

    animation.start();
    return () => animation.stop();
  }, [scale, opacity]);

  return (
    <View style={s.container}>
      <Animated.View style={[s.center, { opacity, transform: [{ scale }] }]}>
        <Text style={s.brand}>{APP_NAME}</Text>
        <Text style={s.tagline}>{TAGLINE}</Text>
      </Animated.View>

      <View style={s.bottom}>
        <ActivityIndicator size="small" color={t.primary} />
        <Text style={s.loadingText}>Menyiapkan aplikasi…</Text>
      </View>
    </View>
  );
}

const createStyles = (t) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' },
    center: { alignItems: 'center' },
    brand: {
      fontSize: 44,
      fontWeight: '800',
      letterSpacing: -1,
      fontFamily: t.fontBrand,
      color: t.text,
    },
    tagline: { fontSize: 14, color: t.sub, marginTop: 8, textAlign: 'center' },
    bottom: { position: 'absolute', bottom: 56, alignItems: 'center', gap: 10 },
    loadingText: { fontSize: 12, color: t.sub },
  });