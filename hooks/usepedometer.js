// ============================================================
// hooks/usepedometer.js
// Custom Hook untuk Menghitung Langkah Kaki (Pedometer)
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { Pedometer } from 'expo-sensors';

export default function usePedometer() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [steps, setSteps] = useState(0);
  const [loading, setLoading] = useState(true);
  const subscriptionRef = useRef(null);

  // Cek ketersediaan sensor pedometer pada perangkat
  useEffect(() => {
    let isMounted = true;

    async function checkAvailability() {
      try {
        const available = await Pedometer.isAvailableAsync();
        if (isMounted) {
          setIsAvailable(available);
        }
      } catch (error) {
        if (isMounted) {
          setIsAvailable(false);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    checkAvailability();

    return () => {
      isMounted = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
      }
    };
  }, []);

  // Mulai melacak perhitungan langkah kaki
  const startTracking = useCallback(async () => {
    try {
      const available = await Pedometer.isAvailableAsync();
      if (!available) return;

      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
      }

      setSteps(0);

      const sub = Pedometer.watchStepCount((result) => {
        setSteps(result.steps);
      });

      subscriptionRef.current = sub;
    } catch (error) {
      console.log('Gagal mengaktifkan pedometer:', error);
    }
  }, []);

  // Menghentikan pelacakan langkah kaki
  const stopTracking = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
  }, []);

  return {
    steps,
    isAvailable,
    loading,
    startTracking,
    stopTracking,
  };
}