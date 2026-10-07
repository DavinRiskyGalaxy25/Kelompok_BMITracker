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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card } from '../components/ui';
import RunSummaryOverlay from '../components/RunSummaryOverlay';
import { formatDateTime, formatDuration } from '../utils/format';
import { getActivityHistory } from '../utils/storage';

const DAYS_NAME = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const DAYS_NAME_SHORT = ['MIN', 'SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB'];
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const getGreeting = (hour = new Date().getHours()) => {
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
};

// Komponen Khusus Ikon Api & Centang
const ActiveFlameIcon = ({ size = 38, theme: t }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <Ionicons name="flame" size={size} color="#F97316" />
    <View
      style={{
        position: 'absolute',
        bottom: 2,
        right: -2,
        backgroundColor: t.card, // Menyamarkan background centang dengan warna card
        borderRadius: 12,
        padding: 1,
      }}
    >
      <Ionicons name="checkmark-circle" size={size * 0.45} color={t.primary} />
    </View>
  </View>
);

export default function HomeScreen({ theme: t, user, setActiveScreen }) {
  const s = useMemo(() => createStyles(t), [t]);
  const insets = useSafeAreaInsets();
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

  // Kalender Grid Klasik (Bulan Berjalan)
  const monthlyCalendar = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 (Sun) - 6 (Sat)
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const runDatesSet = new Set(
      activities.map((a) => new Date(a.date).toDateString())
    );

    const grid = [];
    // Isi grid kosong untuk hari sebelum tanggal 1
    for (let i = 0; i < firstDay; i++) {
      grid.push(null);
    }
    // Isi tanggal bulan ini
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      grid.push({
        dateNum: i,
        isToday: d.toDateString() === today.toDateString(),
        active: runDatesSet.has(d.toDateString()),
      });
    }
    return grid;
  }, [activities]);

  const activeDaysCount = monthlyCalendar.filter((d) => d && d.active).length;

  return (
    <View style={[s.safe, { paddingTop: insets.top }]}>
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
              <View key={index} style={s.dayItemWrap}>
                {d.active ? (
                  // HARI AKTIF: Tertutup Ikon Api & Centang sepenuhnya
                  <ActiveFlameIcon size={38} theme={t} />
                ) : (
                  // HARI BIASA: Tampilkan teks hari dan angka
                  <View style={s.dayItem}>
                    <Text style={[s.dayName, d.isToday && { color: t.primary, fontWeight: '800' }]}>
                      {d.name}
                    </Text>
                    <View
                      style={[
                        s.dayCircle,
                        { borderColor: d.isToday ? t.primary : 'transparent' },
                      ]}
                    >
                      <Text style={[s.dayNumber, d.isToday ? { color: t.primary } : { color: t.sub }]}>
                        {d.dateNum}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        </Card>

        {/* RINGKASAN HASIL LARI TERAKHIR */}
        <Text style={s.sectionHeader}>Hasil Lari Terakhir</Text>
        {latestRun ? (
          <View style={s.edgeToEdge}>
            <RunSummaryOverlay run={latestRun} theme={t} />
          </View>
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

      {/* MODAL KALENDER STREAK */}
      <Modal
        visible={calendarModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCalendarModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { backgroundColor: t.card, borderColor: t.border }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{MONTH_NAMES[new Date().getMonth()]} {new Date().getFullYear()}</Text>
              <TouchableOpacity onPress={() => setCalendarModalVisible(false)}>
                <Ionicons name="close-circle" size={26} color={t.sub} />
              </TouchableOpacity>
            </View>

            <Text style={s.modalDesc}>
              Total <Text style={{ color: t.primary, fontWeight: '800' }}>{activeDaysCount} hari</Text> aktif di bulan ini.
            </Text>

            {/* CONTAINER KALENDER 7 KOLOM */}
            <View style={s.calendarContainer}>
              {/* Header Hari */}
              <View style={s.calendarHeaderRow}>
                {DAYS_NAME_SHORT.map((day, idx) => (
                  <Text key={idx} style={[s.calDayHead, { color: t.sub }]}>{day}</Text>
                ))}
              </View>

              {/* Grid Tanggal */}
              <View style={s.calendarGrid}>
                {monthlyCalendar.map((item, idx) => {
                  // Jika sel padding (kosong sebelum tgl 1)
                  if (!item) {
                    return <View key={idx} style={s.calCell} />;
                  }

                  // Jika hari itu user melakukan aktivitas
                  if (item.active) {
                    return (
                      <View key={idx} style={s.calCell}>
                        <ActiveFlameIcon size={26} theme={t} />
                      </View>
                    );
                  }

                  // Hari biasa / Hari ini
                  return (
                    <View
                      key={idx}
                      style={[
                        s.calCell,
                        item.isToday && s.calCellToday,
                        item.isToday && { backgroundColor: t.primary }
                      ]}
                    >
                      <Text style={[
                        s.calCellText,
                        { color: item.isToday ? t.onPrimary : t.text }
                      ]}>
                        {item.dateNum}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (t) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    content: { padding: 16, paddingBottom: 24 },

    greetingWrap: { marginBottom: 18, marginTop: 4 },
    greetingTime: { fontSize: 13, color: t.sub, fontWeight: '600' },
    userName: { fontSize: 24, fontWeight: '800', color: t.text, marginTop: 2 },
    edgeToEdge: { marginHorizontal: -16, marginBottom: 20 },

    streakCard: { padding: 14, marginBottom: 20 },
    streakHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    streakTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    streakTitle: { fontSize: 14, fontWeight: '700', color: t.text },
    seeMonthText: { fontSize: 12, fontWeight: '700', color: t.primary },

    weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
    dayItemWrap: { width: 40, height: 50, alignItems: 'center', justifyContent: 'center' },
    dayItem: { alignItems: 'center', gap: 4 },
    dayName: { fontSize: 11, color: t.sub, fontWeight: '600' },
    dayCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
    },
    dayNumber: { fontSize: 12, fontWeight: '700' },

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
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'flex-end',
      padding: 0,
    },
    modalCard: { 
      width: '100%', 
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28, 
      padding: 24, 
      borderTopWidth: 1 
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { fontSize: 18, fontWeight: '800', color: t.text },
    modalDesc: { fontSize: 13, color: t.sub, marginVertical: 12 },

    // CSS KALENDER
    calendarContainer: { width: '100%', marginTop: 10, marginBottom: 10 },
    calendarHeaderRow: { flexDirection: 'row', marginBottom: 12 },
    calDayHead: { width: '14.28%', textAlign: 'center', fontSize: 11, fontWeight: '700' },
    calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calCell: { 
      width: '14.28%', 
      height: 44, 
      alignItems: 'center', 
      justifyContent: 'center', 
      marginBottom: 6 
    },
    calCellToday: { borderRadius: 12 },
    calCellText: { fontSize: 15, fontWeight: '600' },
  });