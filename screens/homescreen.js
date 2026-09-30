/**
 * HomeScreen — Vitra
 *
 * Props:
 *  - theme            token tema Vitra dari App.js (bg, card, primary, text, sub, border, input, danger, onPrimary, shadow, isDark, fontBrand)
 *  - user             { name, email }
 *  - setActiveScreen  fungsi routing: 'bmi' | 'activity' | 'map' | 'history' | 'profile'
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { SectionTitle, getCardStyle } from '../components/ui';
import { useTracker } from '../hooks/useTracker';
import { formatDuration } from '../utils/format';
import { getActivityHistory, getBmiHistory } from '../utils/storage';

/* ------------------------------ Constants ------------------------------ */

const APP_NAME = 'Vitra';
const DEFAULT_USER_NAME = 'Vitra User';

const MENU_ITEMS = [
  { key: 'bmi', icon: 'analytics', title: 'IMT / BMI', subtitle: 'Hitung indeks massa tubuh dan kebutuhan energi' },
  { key: 'activity', icon: 'navigate', title: 'Aktivitas', subtitle: 'Rekam dan pantau aktivitas harian' },
  { key: 'map', icon: 'map', title: 'Peta', subtitle: 'Lacak rute lari, sepeda, dan renang' },
  { key: 'history', icon: 'time', title: 'Riwayat', subtitle: 'Lihat aktivitas dan hasil yang tersimpan' },
  { key: 'profile', icon: 'person', title: 'Profil', subtitle: 'Akun, tema, dan pengaturan' },
];

const BMI_LABELS = {
  underweight: 'Kurus',
  normal: 'Normal',
  overweight: 'Gemuk',
  obese: 'Obesitas',
  teen_screening: 'Skrining remaja',
};

const INITIAL_SUMMARY = { bmi: null, category: null, activityCount: 0, lastActivityTs: null };

/* ------------------------------- Helpers ------------------------------- */

const getGreeting = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
};

const formatShortDate = (ts) =>
  ts ? new Date(ts).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : '-';

const getLatestTimestamp = (list) =>
  list.reduce((max, item) => {
    const ts = Date.parse(item?.date);
    return Number.isFinite(ts) && ts > max ? ts : max;
  }, 0) || null;

/* ------------------------- Presentational parts ------------------------- */

const SummaryItem = ({ s, value, label }) => (
  <View style={s.summaryItem}>
    <Text style={s.summaryValue}>{value}</Text>
    <Text style={s.summaryLabel}>{label}</Text>
  </View>
);

const RecordingBanner = ({ s, t, distanceKm, elapsedSec, onPress }) => (
  <TouchableOpacity
    activeOpacity={0.85}
    onPress={onPress}
    style={s.recordingBanner}
    accessibilityRole="button"
    accessibilityLabel="Rekaman aktivitas sedang berjalan. Buka layar aktivitas."
  >
    <Ionicons name="radio-button-on" size={18} color={t.danger} />
    <View style={s.menuTextWrap}>
      <Text style={s.menuTitle}>Sedang merekam</Text>
      <Text style={s.menuSubtitle}>
        {distanceKm.toFixed(2)} km · {formatDuration(elapsedSec)}
      </Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={t.sub} />
  </TouchableOpacity>
);

const MenuCard = ({ s, t, item, onPress }) => (
  <TouchableOpacity
    activeOpacity={0.85}
    onPress={() => onPress(item.key)}
    style={s.menuCard}
    accessibilityRole="button"
    accessibilityLabel={`${item.title}. ${item.subtitle}`}
  >
    <View style={s.menuIconWrap}>
      <Ionicons name={item.icon} size={22} color={t.primary} />
    </View>
    <View style={s.menuTextWrap}>
      <Text style={s.menuTitle}>{item.title}</Text>
      <Text style={s.menuSubtitle}>{item.subtitle}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={t.sub} />
  </TouchableOpacity>
);

/* --------------------------------- Screen -------------------------------- */

export default function HomeScreen({ theme: t, user, setActiveScreen }) {
  const s = useMemo(() => createStyles(t), [t]);
  const [summary, setSummary] = useState(INITIAL_SUMMARY);
  const { isRecording, distance, elapsed } = useTracker();

  const displayName = String(user?.name || '').trim() || DEFAULT_USER_NAME;
  const initial = displayName.charAt(0).toUpperCase();
  const greeting = useMemo(() => getGreeting(), []);

  useEffect(() => {
    let active = true;

    (async () => {
      const [bmiHistory, activityHistory] = await Promise.all([getBmiHistory(), getActivityHistory()]);
      if (!active) return;

      const latestBmi = bmiHistory[0];
      const bmiValue = Number(latestBmi?.bmi);

      setSummary({
        bmi: Number.isFinite(bmiValue) ? bmiValue : null,
        category: BMI_LABELS[latestBmi?.category] || null,
        activityCount: activityHistory.length,
        lastActivityTs: getLatestTimestamp(activityHistory),
      });
    })();

    return () => {
      active = false;
    };
  }, []);

  const go = (screen) => {
    if (typeof setActiveScreen === 'function') setActiveScreen(screen);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.appName}>{APP_NAME}</Text>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => go('profile')}
            style={s.avatar}
            accessibilityRole="button"
            accessibilityLabel="Buka profil"
          >
            <Text style={s.avatarText}>{initial}</Text>
          </TouchableOpacity>
        </View>

        {/* Sapaan */}
        <View style={s.greetingBlock}>
          <Text style={s.greeting}>{greeting},</Text>
          <Text style={s.userName} numberOfLines={1}>
            {displayName}
          </Text>
        </View>

        {isRecording ? (
          <RecordingBanner
            s={s}
            t={t}
            distanceKm={distance / 1000}
            elapsedSec={elapsed}
            onPress={() => go('activity')}
          />
        ) : null}

        {/* Ringkasan */}
        <SectionTitle theme={t} icon="pulse" title="Ringkasan" />
        <View style={s.card}>
          <View style={s.summaryRow}>
            <SummaryItem s={s} value={summary.bmi !== null ? summary.bmi.toFixed(1) : '-'} label="BMI terakhir" />
            <View style={s.summaryDivider} />
            <SummaryItem s={s} value={String(summary.activityCount)} label="aktivitas" />
            <View style={s.summaryDivider} />
            <SummaryItem s={s} value={formatShortDate(summary.lastActivityTs)} label="terakhir" />
          </View>
          {summary.category ? (
            <Text style={s.metaLine}>Kategori BMI terakhir: {summary.category}</Text>
          ) : null}
        </View>

        {/* Menu */}
        <View style={s.menuSectionGap} />
        <SectionTitle theme={t} icon="grid" title="Menu" />
        {MENU_ITEMS.map((item) => (
          <MenuCard key={item.key} s={s} t={t} item={item} onPress={go} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

/* -------------------------------- Styles -------------------------------- */

const createStyles = (t) => {
  const cardBase = getCardStyle(t);

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    content: { padding: 16, paddingBottom: 48 },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20,
      marginTop: 4,
    },
    appName: {
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: -0.5,
      fontFamily: t.fontBrand,
      color: t.text,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.primary,
    },
    avatarText: { fontSize: 16, fontWeight: '800', color: t.onPrimary },

    greetingBlock: { marginBottom: 24 },
    greeting: { fontSize: 14, fontWeight: '600', color: t.sub },
    userName: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, color: t.text, marginTop: 2 },

    card: cardBase,

    summaryRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryValue: { fontSize: 24, fontWeight: '800', color: t.text, fontVariant: ['tabular-nums'] },
    summaryLabel: { fontSize: 12, color: t.sub, marginTop: 2 },
    summaryDivider: { width: 1, height: 32, backgroundColor: t.border },
    metaLine: { fontSize: 12, color: t.sub, marginTop: 14, lineHeight: 18, textAlign: 'center' },

    recordingBanner: {
      ...cardBase,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 20,
    },

    menuSectionGap: { height: 28 },
    menuCard: {
      ...cardBase,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 12,
    },
    menuIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.input,
    },
    menuTextWrap: { flex: 1 },
    menuTitle: { fontSize: 16, fontWeight: '700', color: t.text },
    menuSubtitle: { fontSize: 12, color: t.sub, marginTop: 2, lineHeight: 18 },
  });
};