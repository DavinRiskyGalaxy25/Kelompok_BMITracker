// screens/splashscreen.js
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';

export default function SplashScreen({ theme: t }) {
  // Animasi untuk memunculkan logo perlahan
  const opacity = useRef(new Animated.Value(0)).current;
  // Animasi untuk garis putih yang berjalan (loading bar)
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Munculkan logo
    Animated.timing(opacity, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // 2. Jalankan garis putih dari kiri ke kanan berulang kali
    Animated.loop(
      Animated.sequence([
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false, // Tidak pakai native driver karena animasi lebar (width)
        }),
        Animated.timing(progressAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [opacity, progressAnim]);

  // Interpolasi lebar garis dari 0% ke 100%
  const lineWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoContainer, { opacity }]}>
        <Image
          // Pastikan gambar ini sesuai dengan nama file logo baru Anda
          source={require('../assets/images/android-icon-foreground.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        
        {/* Garis putih indikator loading di bawah logo */}
        <View style={styles.progressBarContainer}>
          <Animated.View style={[styles.progressBar, { width: lineWidth }]} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // Latar belakang hitam pekat sesuai permintaan
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 40, // Jarak antara logo dan garis loading
  },
  progressBarContainer: {
    width: 120, // Lebar wadah garis loading
    height: 3,  // Ketebalan garis
    backgroundColor: 'rgba(255, 255, 255, 0.2)', // Garis dasar agak transparan
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FFFFFF', // Warna garis berjalan putih solid
  },
});