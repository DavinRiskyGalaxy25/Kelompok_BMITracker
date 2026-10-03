// screens/stopwatchscreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card } from '../components/ui';

export default function StopwatchScreen({ theme: t, setActiveScreen }) {
  const s = useMemo(() => createStyles(t), [t]);
  const insets = useSafeAreaInsets();

  const [isRunning, setIsRunning] = useState(false);
  const [time, setTime] = useState(0); // milidetik
  const [laps, setLaps] = useState([]);

  const timerRef = useRef(null);
  const startTimeRef = useRef(0);

  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = Date.now() - time;
      timerRef.current = setInterval(() => {
        setTime(Date.now() - startTimeRef.current);
      }, 30);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  const handleStartPause = useCallback(() => {
    setIsRunning((prev) => !prev);
  }, []);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    setTime(0);
    setLaps([]);
  }, []);

  const handleLap = useCallback(() => {
    if (time === 0) return;
    setLaps((prev) => [
      {
        id: prev.length + 1,
        time,
        splitTime: prev.length > 0 ? time - prev[0].time : time,
      },
      ...prev,
    ]);
  }, [time]);

  // Format mm:ss.SS
  const formatStopwatch = (ms) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const centis = Math.floor((ms % 1000) / 10);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
  };

  return (
    <View style={[s.safe, { paddingTop: insets.top }]}>
      <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />

      <View style={s.container}>
        {/* TAMPILAN ANGKA STOPWATCH UTAMA */}
        <View style={s.displayWrap}>
          <Text style={[s.timeText, { color: t.text }]}>{formatStopwatch(time)}</Text>
          <Text style={[s.timeSub, { color: t.sub }]}>MENIT : DETIK . MILIDETIK</Text>
        </View>

        {/* KONTROL TOMBOL UTAMA */}
        <View style={s.controlsRow}>
          {/* Tombol Lap / Reset */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={isRunning ? handleLap : handleReset}
            disabled={time === 0 && !isRunning}
            style={[
              s.secondaryBtn,
              { backgroundColor: t.input, borderColor: t.border },
              time === 0 && { opacity: 0.5 },
            ]}
          >
            <Text style={[s.controlBtnText, { color: t.text }]}>
              {isRunning ? 'Putaran' : 'Reset'}
            </Text>
          </TouchableOpacity>

          {/* Tombol Start / Stop */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleStartPause}
            style={[
              s.primaryBtn,
              { backgroundColor: isRunning ? t.danger : t.primary },
            ]}
          >
            <Ionicons
              name={isRunning ? 'pause' : 'play'}
              size={24}
              color={t.onPrimary}
              style={!isRunning ? { marginLeft: 2 } : {}}
            />
            <Text style={[s.controlBtnText, { color: t.onPrimary, marginLeft: 6 }]}>
              {isRunning ? 'Jeda' : 'Mulai'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* DAFTAR PUTARAN (LAPS) */}
        <View style={s.lapsHeader}>
          <Text style={[s.lapsTitle, { color: t.sub }]}>PUTARAN</Text>
          <Text style={[s.lapsTitle, { color: t.sub }]}>WAKTU</Text>
        </View>

        <FlatList
          data={laps}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            <Card theme={t} style={s.lapItem}>
              <Text style={[s.lapIndex, { color: t.text }]}>Putaran {item.id}</Text>
              <Text style={[s.lapTime, { color: t.primary }]}>
                {formatStopwatch(item.time)}
              </Text>
            </Card>
          )}
          ListEmptyComponent={
            <View style={s.emptyLaps}>
              <Ionicons name="timer-outline" size={36} color={t.sub} />
              <Text style={[s.emptyLapsText, { color: t.sub }]}>Belum ada catatan putaran.</Text>
            </View>
          }
        />
      </View>
    </View>
  );
}

const createStyles = (t) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    topHeader: {
      height: 50,
      alignItems: 'center',
      justifyContent: 'center',
      borderBottomWidth: 1,
    },
    headerTitle: { fontSize: 18, fontWeight: '800' },
    container: { flex: 1, paddingHorizontal: 20 },

    displayWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 36,
    },
    timeText: {
      fontSize: 54,
      fontWeight: '800',
      letterSpacing: -1,
      fontVariant: ['tabular-nums'],
    },
    timeSub: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 4 },

    controlsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 14,
      marginBottom: 28,
    },
    secondaryBtn: {
      flex: 1,
      height: 50,
      borderRadius: 14,
      borderWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtn: {
      flex: 1.4,
      height: 50,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
    },
    controlBtnText: { fontSize: 15, fontWeight: '800' },

    lapsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
      marginBottom: 10,
    },
    lapsTitle: { fontSize: 11, fontWeight: '700' },
    lapItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    lapIndex: { fontSize: 14, fontWeight: '700' },
    lapTime: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
    emptyLaps: { alignItems: 'center', paddingTop: 40, gap: 8 },
    emptyLapsText: { fontSize: 12 },
  });