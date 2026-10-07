/**
 * useTracker — state rekaman aktivitas GPS yang hidup di level App.
 *
 * Router memakai `key={activeScreen}` sehingga tiap screen di-unmount saat berpindah.
 * Karena state rekaman ada di provider ini (di atas screen), rekaman tetap berjalan ketika
 * pengguna pindah dari Aktivitas ke Peta atau Beranda.
 *
 * Pemakaian:
 *   <TrackerProvider> ...screen... </TrackerProvider>     (di App.js, hanya saat sudah login)
 *   const tracker = useTracker();
 *
 * Catatan: pelacakan memakai izin lokasi foreground. Android/iOS menghentikan pembaruan
 * GPS ketika aplikasi ke background; durasi tetap benar (berbasis jam), tetapi rute punya
 * jeda selama itu. Untuk background tracking dibutuhkan izin background + expo-task-manager.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';

import {
  DEFAULT_WEIGHT_KG,
  MIN_SAVE_DISTANCE_M,
  calculateCalories,
  getActivity,
} from '../utils/activities';
import { formatDateTime, formatPace } from '../utils/format';
import { compactRoute, createTrackFilter, toDisplayRoute } from '../utils/gps';
import { addActivityEntry, getLatestWeightKg, getLatestHeightCm } from '../utils/storage';

const DEFAULT_REGION = { latitude: -6.2088, longitude: 106.8456 };

const WATCH_OPTIONS = {
  accuracy: Location.Accuracy.BestForNavigation,
  distanceInterval: 1,
  timeInterval: 1000,
};

const TrackerContext = createContext(null);

export function TrackerProvider({ children }) {
  const [activityKey, setActivityKeyState] = useState('run');
  const [status, setStatus] = useState('idle'); // 'idle' | 'recording' | 'finished'
  const [starting, setStarting] = useState(false);
  const [route, setRoute] = useState([]);
  const [distance, setDistance] = useState(0); // meter
  const [elapsed, setElapsed] = useState(0); // detik
  const [steps, setSteps] = useState(0);
  const [permission, setPermission] = useState(null); // null = belum diketahui
  const [summary, setSummary] = useState(null);
  const [mapType, setMapType] = useState('standard'); // 'standard' | 'satellite'
  const [userLocation, setUserLocation] = useState(DEFAULT_REGION);
  const [gpsLoaded, setGpsLoaded] = useState(false);

  // Ref = sumber kebenaran untuk callback asinkron (watcher, timer) agar tidak basi.
  const mountedRef = useRef(true);
  const statusRef = useRef('idle');
  const startingRef = useRef(false);
  const activityKeyRef = useRef('run');
  const timerRef = useRef(null);
  const watchRef = useRef(null);
  const startTimeRef = useRef(0);
  const distanceRef = useRef(0);
  const routeRef = useRef([]);
  const filterRef = useRef(null);
  const weightRef = useRef(DEFAULT_WEIGHT_KG);
  const heightRef = useRef(170); // default height cm
  const stepsRef = useRef(0);

  const updateStatus = useCallback((next) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  /* ------------------------------ Pembersihan ------------------------------ */

  const stopTracking = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (watchRef.current) {
      try {
        watchRef.current.remove();
      } catch (e) {
        console.log('Remove watcher error:', e);
      }
      watchRef.current = null;
    }
  }, []);

  const clearSession = useCallback(() => {
    stopTracking();
    filterRef.current?.reset();
    filterRef.current = null;
    distanceRef.current = 0;
    stepsRef.current = 0;
    routeRef.current = [];
    setRoute([]);
    setDistance(0);
    setSteps(0);
    setElapsed(0);
    setSummary(null);
  }, [stopTracking]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopTracking();
    };
  }, [stopTracking]);

  /* --------------------------------- Izin ---------------------------------- */

  /**
   * Minta izin lokasi dan ambil posisi awal untuk memusatkan peta.
   * Dipanggil oleh screen yang menampilkan peta, bukan saat login.
   */
  const prepare = useCallback(async () => {
    try {
      const current = await Location.getForegroundPermissionsAsync();
      let granted = current.status === 'granted';

      if (!granted) {
        const requested = await Location.requestForegroundPermissionsAsync();
        granted = requested.status === 'granted';
      }

      if (!mountedRef.current) return;
      setPermission(granted);

      if (granted && statusRef.current !== 'recording') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (mountedRef.current && statusRef.current !== 'recording') {
          setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          setGpsLoaded(true);
        }
      }
    } catch (e) {
      console.log('Prepare location error:', e);
    }
  }, []);

  /* ------------------------------ Pembaruan GPS ------------------------------ */

  const handleLocation = useCallback((loc) => {
    if (statusRef.current !== 'recording' || !filterRef.current) return;

    const { latitude, longitude, accuracy, speed } = loc.coords;

    // Android melaporkan speed = 0 persis bila sensor tidak tersedia, sehingga tidak bisa
    // dibedakan dari "diam". Nilai itu dianggap tidak diketahui agar tidak salah menahan titik.
    const reliableSpeed = Platform.OS === 'android' && speed === 0 ? null : speed;

    const result = filterRef.current.push({
      latitude,
      longitude,
      accuracy,
      speed: reliableSpeed,
      timestamp: loc.timestamp,
    });
    if (!result) return;

    if (result.delta > 0) {
      distanceRef.current += result.delta;
      setDistance(distanceRef.current);
      const stepLengthCm = (heightRef.current || 170) * 0.414;
      const calcSteps = Math.floor((distanceRef.current * 100) / stepLengthCm);
      stepsRef.current = calcSteps;
      setSteps(calcSteps);
    }

    const nextRoute = routeRef.current.concat(result.point);
    routeRef.current = nextRoute;
    setRoute(nextRoute);
  }, []);

  /* --------------------------------- Aksi ---------------------------------- */

  const setActivityKey = useCallback((key) => {
    if (statusRef.current === 'recording' || startingRef.current) return;
    activityKeyRef.current = key;
    setActivityKeyState(key);
  }, []);

  const start = useCallback(async () => {
    if (statusRef.current === 'recording' || startingRef.current) return;

    startingRef.current = true;
    setStarting(true);

    try {
      const servicesOn = await Location.hasServicesEnabledAsync();
      if (!servicesOn) {
        Alert.alert('GPS nonaktif', 'Aktifkan layanan lokasi di perangkat, lalu tekan Start lagi.');
        return;
      }

      const { status: perm, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (perm !== 'granted') {
        setPermission(false);
        Alert.alert(
          'Izin lokasi diperlukan',
          'Izinkan akses lokasi agar rute dan jarak aktivitas dapat direkam.',
          canAskAgain
            ? [{ text: 'OK' }]
            : [
                { text: 'Batal', style: 'cancel' },
                { text: 'Buka Pengaturan', onPress: () => Linking.openSettings() },
              ]
        );
        return;
      }
      setPermission(true);

      // Sesi baru selalu mulai dari nol.
      clearSession();
      updateStatus('idle');

      const activity = getActivity(activityKeyRef.current);
      const filter = createTrackFilter(activity.gps);
      filterRef.current = filter;
      weightRef.current = (await getLatestWeightKg()) ?? DEFAULT_WEIGHT_KG;
      heightRef.current = (await getLatestHeightCm()) ?? 170;

      const first = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
      if (!mountedRef.current) return;

      // Titik awal ikut disaring; bila akurasinya buruk, rute mulai dari titik layak pertama.
      const seed = filter.push({
        latitude: first.coords.latitude,
        longitude: first.coords.longitude,
        accuracy: first.coords.accuracy,
        speed: first.coords.speed,
        timestamp: first.timestamp,
      });
      setUserLocation({ latitude: first.coords.latitude, longitude: first.coords.longitude });
      if (seed) {
        routeRef.current = [seed.point];
        setRoute(routeRef.current);
      }

      startTimeRef.current = Date.now();
      updateStatus('recording');
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      const subscription = await Location.watchPositionAsync(WATCH_OPTIONS, handleLocation);

      // Pengguna bisa menekan Stop/Reset atau meninggalkan app selagi menunggu watcher siap.
      if (!mountedRef.current || statusRef.current !== 'recording') {
        subscription.remove();
        return;
      }
      watchRef.current = subscription;
    } catch (e) {
      console.log('Start recording error:', e);
      clearSession();
      updateStatus('idle');
      Alert.alert('Gagal memulai rekaman', 'Tidak dapat mengakses GPS. Periksa izin dan pengaturan lokasi.');
    } finally {
      startingRef.current = false;
      if (mountedRef.current) setStarting(false);
    }
  }, [clearSession, handleLocation, updateStatus]);

  const stop = useCallback(async () => {
    if (statusRef.current !== 'recording') return;

    // Ubah status lebih dulu agar callback GPS yang terlambat diabaikan.
    updateStatus('finished');
    stopTracking();

    const durationSec = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000));
    const distanceM = distanceRef.current;
    const km = distanceM / 1000;
    const activity = getActivity(activityKeyRef.current);
    const calories = calculateCalories(weightRef.current, km);
    const pace = formatPace(durationSec, km);
    const speed = km > 0 ? km / (durationSec / 3600) : 0;
    const now = new Date();
    const rawRoute = routeRef.current;

    setElapsed(durationSec);
    setRoute(toDisplayRoute(rawRoute)); // hanya tampilan; jarak tetap dari titik hasil filter
    setSummary({
      activity,
      km,
      durationSec,
      calories,
      pace,
      speed,
      date: formatDateTime(now),
      saved: false,
    });

    if (distanceM < MIN_SAVE_DISTANCE_M) return;

    const saved = await addActivityEntry({
      activity: activity.key,
      label: activity.label,
      km: Number(km.toFixed(3)),
      durationSec,
      calories,
      pace,
      speed: Number(speed.toFixed(2)),
      steps: stepsRef.current,
      route: compactRoute(rawRoute),
      date: now.toISOString(),
    });

    if (saved && mountedRef.current) {
      setSummary((prev) => (prev ? { ...prev, saved: true } : prev));
    }
  }, [stopTracking, updateStatus]);

  const reset = useCallback(() => {
    clearSession();
    updateStatus('idle');
  }, [clearSession, updateStatus]);

  /* --------------------------------- Value --------------------------------- */

  const value = useMemo(
    () => ({
      activity: getActivity(activityKey),
      activityKey,
      setActivityKey,
      status,
      isRecording: status === 'recording',
      starting,
      route,
      distance, steps,
      elapsed,
      permission,
      summary,
      mapType,
      setMapType,
      userLocation,
      gpsLoaded,
      prepare,
      start,
      stop,
      reset,
    }),
    [
      activityKey, setActivityKey, status, starting, route, distance, steps, elapsed, permission,
      summary, mapType, userLocation, gpsLoaded, prepare, start, stop, reset,
    ]
  );

  return <TrackerContext.Provider value={value}>{children}</TrackerContext.Provider>;
}

export function useTracker() {
  const context = useContext(TrackerContext);
  if (!context) {
    throw new Error('useTracker harus dipakai di dalam <TrackerProvider>.');
  }
  return context;
}