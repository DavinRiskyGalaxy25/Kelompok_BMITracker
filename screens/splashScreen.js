// screens/splashscreen.js
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';

export default function SplashScreen({ theme: t }) {
  const s = useMemo(() => createStyles(t), [t]);

  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]);

    animation.start();
    return () => animation.stop();
  }, [scale, opacity]);

  return (
    <View style={s.container}>
      <Animated.View style={{ opacity, transform: [{ scale }] }}>
        <Image
          source={require('../assets/images/icon.jpeg')}
          style={s.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const createStyles = (t) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000000',
      alignItems: 'center',
      justifyContent: 'center',
    },
    logo: {
      width: 110,
      height: 110,
      borderRadius: 24,
    },
  });