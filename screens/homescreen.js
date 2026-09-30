// screens/homescreen.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card } from '../components/ui';
import { formatDateTime, formatDuration } from '../utils/format';
import { getActivityHistory } from '../utils/storage';

const DAYS_NAME = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const getGreeting = (hour = new Date().getHours()) => {
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
};

export default function HomeScreen({ theme: t, user, setActiveScreen }) {
  const s = useMemo(() => createStyles(t), [t]);
  const [activities, setActivities] = useState([]);
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);

  useEffect(() => {
    (async () => {
      const history = await getActivityHistory();
      setActivities(history || []);
    })();
  }, []);

  const latestRun = activities[0] || null;

  // Analisis 7 Hari Terakhir (Weekly Streak)
  const weeklyStreak = useMemo(() => {
    const today = new Date();
    const days = [];
    const runDatesSet = new Set(
      activities.map((a) => new Date(a.date).toDateString())
    );

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dString = d.toDateString();
      days.push({
        name: DAYS_NAME[d.getDay()],
        dateNum: d.getDate(),
        isToday: i === 0,
        active: runDatesSet.has(dString),
      });
    }
    return days;
  }, [activities]);

  // Kalender Bulanan (30 Hari Terakhir)
  const monthlyStreak = useMemo(() => {
    const today = new Date();
    const days = [];
    const runDatesSet = new Set(
      activities.map((a) => new Date(a.date).toDateString())
    );

    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      days.push({
        dateNum: d.getDate(),
        active: runDatesSet.has(d.toDateString()),
        fullDate: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      });
    }
    return days;
  }, [activities]);

  const activeDaysCount = monthlyStreak.filter((d) => d.active).length;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Header Sapaan */}
        <View style={s.greetingWrap}>
          <Text style={s.greetingTime}>{getGreeting()},</Text>
          <Text style={s.userName}>{user?.name || 'Pelari'}</Text>
        </View>

        {/* KARTU STREAK MINGGUAN */}
        <Card theme={t} style={s.streakCard}>
          <View style={s.streakHeader}>
            <View style={s.streakTitleRow}>
              <Ionicons name="flame" size={20} color="#F97316" />
              <Text style={s.streakTitle}>Streak Latihan Mingguan</Text>
            </View>
            <TouchableOpacity onPress={() => setCalendarModalVisible(true)}>
              <Text style={s.seeMonthText}>Buka Kalender</Text>
            </TouchableOpacity>
          </View>

          <View style={s.weekRow}>
            {weeklyStreak.map((d, index) => (
              <View key={index} style={s.dayItem}>
                <Text style={[s.dayName, d.isToday && { color: t.primary, fontWeight: '800' }]}>
                  {d.name}
                </Text>
                <View
                  style={[
                    s.dayCircle,
                    {
                      backgroundColor: d.active ? t.primary : t.input,
                      borderColor: d.isToday ? t.text : 'transparent',
                    },
                  ]}
                >
                  {d.active ? (
                    <Ionicons name="checkmark" size={14} color={t.onPrimary} />
                  ) : (
                    <Text style={[s.dayNumber, { color: t.sub }]}>{d.dateNum}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </Card>

        {/* RINGKASAN HASIL LARI TERAKHIR (BUKAN BMI) */}
        <Text style={s.sectionHeader}>Hasil Lari Terakhir</Text>
        {latestRun ? (
          <Card theme={t} style={s.runCard}>
            <View style={s.runHeader}>
              <View style={s.runBadge}>
                <Ionicons name="walk" size={16} color={t.onPrimary} />
                <Text style={s.runBadgeText}>{latestRun.label || 'Sesi Lari'}</Text>
              </View>
              <Text style={s.runDate}>{formatDateTime(latestRun.date)}</Text>
            </View>

            <View style={s.mainMetricRow}>
              <Text style={s.mainMetricValue}>{(Number(latestRun.km) || 0).toFixed(2)}</Text>
              <Text style={s.mainMetricUnit}>km</Text>
            </View>

            <View style={s.metricGrid}>
              <View style={s.metricCol}>
                <Text style={s.metricLabel}>Pace</Text>
                <Text style={s.metricVal}>{latestRun.pace || '--:--'}</Text>
              </View>
              <View style={s.metricDivider} />
              <View style={s.metricCol}>
                <Text style={s.metricLabel}>Durasi</Text>
                <Text style={s.metricVal}>
                  {formatDuration(latestRun.durationSec || latestRun.duration || 0)}
                </Text>
              </View>
              <View style={s.metricDivider} />
              <View style={s.metricCol}>
                <Text style={s.metricLabel}>Kalori</Text>
                <Text style={s.metricVal}>{latestRun.calories || 0} kcal</Text>
              </View>
            </View>
          </Card>
        ) : (
          <Card theme={t} style={s.emptyCard}>
            <Ionicons name="walk-outline" size={36} color={t.sub} />
            <Text style={s.emptyTitle}>Belum ada rekaman lari</Text>
            <Text style={s.emptySub}>Mulai sesi latihan pertama Anda di menu Record.</Text>
            <TouchableOpacity
              onPress={() => setActiveScreen('record')}
              style={[s.startBtn, { backgroundColor: t.primary }]}
            >
              <Text style={[s.startBtnText, { color: t.onPrimary }]}>Mulai Lari</Text>
            </TouchableOpacity>
          </Card>
        )}
      </ScrollView>

      {/* MODAL KALENDER STREAK PER BULAN */}
      <Modal
        visible={calendarModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCalendarModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { backgroundColor: t.card, borderColor: t.border }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Streak Latihan 30 Hari</Text>
              <TouchableOpacity onPress={() => setCalendarModalVisible(false)}>
                <Ionicons name="close-circle" size={24} color={t.sub} />
              </TouchableOpacity>
            </View>

            <Text style={s.modalDesc}>
              Total <Text style={{ color: t.primary, fontWeight: '800' }}>{activeDaysCount} hari</Text> aktif berolahraga dalam 30 hari terakhir.
            </Text>

            <View style={s.calendarGrid}>
              {monthlyStreak.map((item, idx) => (
                <View
                  key={idx}
                  style={[
                    s.gridBox,
                    { backgroundColor: item.active ? t.primary : t.input },
                  ]}
                >
                  <Text style={[s.gridText, { color: item.active ? t.onPrimary : t.sub }]}>
                    {item.dateNum}
                  </Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => setCalendarModalVisible(false)}
              style={[s.modalCloseBtn, { backgroundColor: t.primary }]}
            >
              <Text style={{ color: t.onPrimary, fontWeight: '700' }}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (t) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    content: { padding: 16, paddingBottom: 24 },

    greetingWrap: { marginBottom: 18, marginTop: 4 },
    greetingTime: { fontSize: 13, color: t.sub, fontWeight: '600' },
    userName: { fontSize: 24, fontWeight: '800', color: t.text, marginTop: 2 },

    streakCard: { padding: 14, marginBottom: 20 },
    streakHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    streakTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    streakTitle: { fontSize: 14, fontWeight: '700', color: t.text },
    seeMonthText: { fontSize: 12, fontWeight: '700', color: t.primary },

    weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
    dayItem: { alignItems: 'center', gap: 6 },
    dayName: { fontSize: 11, color: t.sub, fontWeight: '600' },
    dayCircle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
    },
    dayNumber: { fontSize: 11, fontWeight: '700' },

    sectionHeader: { fontSize: 16, fontWeight: '800', color: t.text, marginBottom: 10 },
    runCard: { padding: 16 },
    runHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    runBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: t.primary,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    runBadgeText: { fontSize: 11, color: t.onPrimary, fontWeight: '700' },
    runDate: { fontSize: 11, color: t.sub },

    mainMetricRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginVertical: 12 },
    mainMetricValue: { fontSize: 48, fontWeight: '800', color: t.text, letterSpacing: -1 },
    mainMetricUnit: { fontSize: 18, fontWeight: '700', color: t.sub },

    metricGrid: {
      flexDirection: 'row',
      backgroundColor: t.input,
      borderRadius: 12,
      paddingVertical: 10,
    },
    metricCol: { flex: 1, alignItems: 'center' },
    metricLabel: { fontSize: 10, color: t.sub },
    metricVal: { fontSize: 14, fontWeight: '800', color: t.text, marginTop: 2 },
    metricDivider: { width: 1, height: 26, backgroundColor: t.border },

    emptyCard: { alignItems: 'center', paddingVertical: 24, gap: 6 },
    emptyTitle: { fontSize: 15, fontWeight: '700', color: t.text, marginTop: 6 },
    emptySub: { fontSize: 12, color: t.sub, textAlign: 'center', marginBottom: 10 },
    startBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
    startBtnText: { fontSize: 12, fontWeight: '700' },

    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalCard: { width: '100%', borderRadius: 20, padding: 18, borderWidth: 1 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { fontSize: 16, fontWeight: '800', color: t.text },
    modalDesc: { fontSize: 12, color: t.sub, marginVertical: 12 },
    calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
    gridBox: {
      width: 38,
      height: 38,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gridText: { fontSize: 11, fontWeight: '700' },
    modalCloseBtn: { marginTop: 16, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  });