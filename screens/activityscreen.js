/**
 * ActivityScreen — Vitra (tracker aktivitas GPS)
 *
 * Props:
 *  - theme            token tema Vitra dari App.js
 *  - setActiveScreen  fungsi routing; tombol kembali menuju 'home'
 *
 * Seluruh state rekaman ada di TrackerProvider (hooks/useTracker.js), sehingga rekaman tetap
 * berjalan bila pengguna berpindah screen. Hasil aktivitas otomatis masuk Riwayat saat Stop.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

import ScreenHeader from '../components/ScreenHeader';
import TrackerMap from '../components/TrackerMap';
import { Btn, Card, Chip, Stat } from '../components/ui';
import { useTracker } from '../hooks/useTracker';
import { ACTIVITIES, MIN_SAVE_DISTANCE_M } from '../utils/activities';
import { formatDuration, formatPace } from '../utils/format';

const APP_NAME = 'Vitra';

export default function ActivityScreen({ theme: t, setActiveScreen }) {
  const s = useMemo(() => createStyles(t), [t]);

  const {
    activityKey, setActivityKey, status, isRecording, starting, route, distance, elapsed,
    permission, summary, mapType, setMapType, userLocation, prepare, start, stop, reset,
  } = useTracker();

  const [sharing, setSharing] = useState(false);
  const shotRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    prepare();
    return () => {
      mountedRef.current = false;
    };
  }, [prepare]);

  const goHome = useCallback(() => {
    if (typeof setActiveScreen === 'function') setActiveScreen('home');
  }, [setActiveScreen]);

  const toggleMapType = useCallback(
    () => setMapType((prev) => (prev === 'standard' ? 'satellite' : 'standard')),
    [setMapType]
  );

  const handleReset = useCallback(() => {
    if (!isRecording) {
      reset();
      return;
    }
    // Reset saat merekam membuang data yang belum disimpan.
    Alert.alert('Hapus rekaman?', 'Rekaman yang sedang berjalan akan dihentikan dan tidak disimpan.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: reset },
    ]);
  }, [isRecording, reset]);

  const shareSummary = useCallback(async () => {
    if (!summary || sharing) return;
    setSharing(true);

    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Tidak tersedia', 'Fitur berbagi tidak didukung di perangkat ini.');
        return;
      }
      const uri = await captureRef(shotRef, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        UTI: 'public.png',
        dialogTitle: 'Simpan / bagikan hasil aktivitas',
      });
    } catch (e) {
      console.log('Share summary error:', e);
      Alert.alert('Gagal', 'Gambar hasil aktivitas tidak dapat dibuat.');
    } finally {
      if (mountedRef.current) setSharing(false);
    }
  }, [summary, sharing]);

  const km = distance / 1000;
  const tooShortToSave = summary && !summary.saved && summary.km * 1000 < MIN_SAVE_DISTANCE_M;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader theme={t} title="Aktivitas" onBack={goHome} />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipRow}
        >
          {ACTIVITIES.map((a) => (
            <Chip
              key={a.key}
              theme={t}
              label={a.label}
              icon={a.icon}
              active={a.key === activityKey}
              disabled={isRecording || starting}
              onPress={() => setActivityKey(a.key)}
            />
          ))}
        </ScrollView>

        <Card theme={t}>
          <TrackerMap
            theme={t}
            route={route}
            mapType={mapType}
            onToggleMapType={toggleMapType}
            center={userLocation}
            finished={status === 'finished'}
          />

          {permission === false ? (
            <View style={s.permBanner}>
              <Ionicons name="location-outline" size={18} color={t.danger} />
              <Text style={s.permText}>Izin lokasi ditolak. Aktifkan untuk merekam rute.</Text>
              <TouchableOpacity onPress={() => Linking.openSettings()} accessibilityRole="button">
                <Text style={s.permLink}>Pengaturan</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={s.liveRow}>
            <View style={s.liveItem}>
              <Text style={s.liveValue}>{km.toFixed(2)}</Text>
              <Text style={s.liveLabel}>km</Text>
            </View>
            <View style={s.liveDivider} />
            <View style={s.liveItem}>
              <Text style={s.liveValue}>{formatDuration(elapsed)}</Text>
              <Text style={s.liveLabel}>durasi</Text>
            </View>
            <View style={s.liveDivider} />
            <View style={s.liveItem}>
              <Text style={s.liveValue}>{formatPace(elapsed, km)}</Text>
              <Text style={s.liveLabel}>min/km</Text>
            </View>
          </View>

          <View style={s.btnRow}>
            <Btn
              theme={t}
              label={starting ? 'Mencari GPS…' : 'Start Record'}
              icon="play"
              onPress={start}
              disabled={isRecording}
              loading={starting}
              grow
            />
            <Btn theme={t} label="Stop" icon="stop" variant="danger" onPress={stop} disabled={!isRecording} />
            <Btn
              theme={t}
              label="Reset"
              icon="refresh"
              variant="outline"
              onPress={handleReset}
              disabled={status === 'idle'}
            />
          </View>
        </Card>

        {/* Ringkasan pasca-aktivitas */}
        {status === 'finished' && summary ? (
          <View style={s.summaryWrap}>
            <View ref={shotRef} collapsable={false} style={s.summaryCard}>
              <View style={s.summaryHead}>
                <Text style={s.brandText}>{APP_NAME}</Text>
                <Text style={s.dateText}>{summary.date}</Text>
              </View>

              <View style={s.activityTag}>
                <Ionicons name={summary.activity.icon} size={14} color={t.onPrimary} />
                <Text style={s.activityTagText}>{summary.activity.label}</Text>
              </View>

              <View style={s.heroRow}>
                <Text style={s.heroValue}>{summary.km.toFixed(2)}</Text>
                <Text style={s.heroUnit}>km</Text>
              </View>

              <View style={s.grid}>
                <Stat theme={t} icon="time" label="Durasi" value={formatDuration(summary.durationSec)} unit="mm:ss" />
                <Stat theme={t} icon="flame" label="Kalori" value={summary.calories} unit="kcal" />
                <Stat theme={t} icon="stopwatch" label="Pace" value={summary.pace} unit="min/km" />
                <Stat
                  theme={t}
                  icon="speedometer"
                  label="Kecepatan rata-rata"
                  value={summary.speed.toFixed(1)}
                  unit="km/h"
                />
              </View>
            </View>

            <View style={s.shareButton}>
              <Btn
                theme={t}
                label={sharing ? 'Memproses…' : 'Simpan / Bagikan Foto Hasil'}
                icon="share-social"
                onPress={shareSummary}
                disabled={sharing}
              />
            </View>

            {summary.saved ? <Text style={s.savedNote}>Tersimpan di Riwayat.</Text> : null}
            {tooShortToSave ? (
              <Text style={s.savedNote}>Jarak terlalu pendek, tidak disimpan ke Riwayat.</Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (t) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    content: { padding: 16, paddingBottom: 48 },

    chipRow: { gap: 8, paddingBottom: 14 },

    permBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
      padding: 10,
      borderRadius: 12,
      backgroundColor: `${t.danger}1A`,
    },
    permText: { flex: 1, fontSize: 12, color: t.text },
    permLink: { fontSize: 12, fontWeight: '700', color: t.primary },

    liveRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
    liveItem: { flex: 1, alignItems: 'center' },
    liveValue: { fontSize: 24, fontWeight: '800', color: t.text, fontVariant: ['tabular-nums'] },
    liveLabel: { fontSize: 12, color: t.sub, marginTop: 2 },
    liveDivider: { width: 1, height: 32, backgroundColor: t.border },

    btnRow: { flexDirection: 'row', gap: 8 },

    summaryWrap: { marginTop: 16 },
    summaryCard: {
      backgroundColor: t.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: 0,
      borderColor: t.border,
    },
    summaryHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    brandText: { fontSize: 15, fontWeight: '800', color: t.text, fontFamily: t.fontBrand },
    dateText: { fontSize: 12, color: t.sub },
    activityTag: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: t.primary,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      marginTop: 16,
    },
    activityTagText: { color: t.onPrimary, fontSize: 12, fontWeight: '700' },
    heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 8, marginBottom: 16 },
    heroValue: { fontSize: 56, fontWeight: '800', letterSpacing: -2, color: t.text },
    heroUnit: { fontSize: 20, fontWeight: '600', color: t.sub },
    grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },

    shareButton: { marginTop: 12 },
    savedNote: { fontSize: 11, color: t.sub, textAlign: 'center', marginTop: 10 },
  });