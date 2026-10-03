// screens/profilescreen.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Card } from '../components/ui';
import { formatDateTime, formatDuration } from '../utils/format';
import {
  clearActivityHistory,
  deleteActivityEntry,
  getActivityHistory,
  getBmiHistory,
} from '../utils/storage';
import { normalizeName } from '../utils/validation';

export default function ProfileScreen({
  theme: t,
  user,
  darkMode,
  setDarkMode,
  onLogout,
  onUpdateUser,
}) {
  const s = useMemo(() => createStyles(t), [t]);
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState('history'); // 'history' | 'settings'
  const [activities, setActivities] = useState([]);
  const [latestBmi, setLatestBmi] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');

  const loadData = useCallback(async () => {
    const [actList, bmiList] = await Promise.all([getActivityHistory(), getBmiHistory()]);
    setActivities(actList || []);
    if (bmiList && bmiList.length > 0) setLatestBmi(bmiList[0]);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveName = async () => {
    const clean = normalizeName(newName);
    if (!clean || clean.length < 2) return;
    if (onUpdateUser) await onUpdateUser({ name: clean });
    setEditModalVisible(false);
  };

  const handleDeleteActivity = (id) => {
    Alert.alert('Hapus Aktivitas', 'Hapus catatan latihan ini dari riwayat?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          const updated = await deleteActivityEntry(id);
          setActivities(updated || []);
        },
      },
    ]);
  };

  return (
    <View style={[s.safe, { paddingTop: insets.top }]}>
      {/* HEADER: Hanya Judul, Tanpa Tombol Kembali */}

      <View style={s.container}>
        {/* PROFILE HERO CARD */}
        <Card theme={t} style={s.heroCard}>
          <View style={s.heroRow}>
            <View style={[s.avatarCircle, { backgroundColor: t.primary }]}>
              <Text style={[s.avatarText, { color: t.onPrimary }]}>
                {(user?.name || 'V').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={s.heroInfo}>
              <Text style={[s.userName, { color: t.text }]}>{user?.name || 'vstride User'}</Text>
              <Text style={[s.userEmail, { color: t.sub }]}>{user?.email || 'user@vstride.app'}</Text>
              <TouchableOpacity
                onPress={() => {
                  setNewName(user?.name || '');
                  setEditModalVisible(true);
                }}
                style={s.editLink}
              >
                <Text style={[s.editLinkText, { color: t.primary }]}>Ubah Profil</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>

        {/* SEGMENTED TAB SWITCHER */}
        <View style={[s.tabSwitch, { backgroundColor: t.input }]}>
          <TouchableOpacity
            onPress={() => setActiveTab('history')}
            style={[s.tabBtn, activeTab === 'history' && { backgroundColor: t.primary }]}
          >
            <Text style={[s.tabBtnText, { color: activeTab === 'history' ? t.onPrimary : t.sub }]}>
              Riwayat Lari ({activities.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('settings')}
            style={[s.tabBtn, activeTab === 'settings' && { backgroundColor: t.primary }]}
          >
            <Text style={[s.tabBtnText, { color: activeTab === 'settings' ? t.onPrimary : t.sub }]}>
              Pengaturan Akun
            </Text>
          </TouchableOpacity>
        </View>

        {/* TAB 1: HISTORY LIST */}
        {activeTab === 'history' ? (
          <FlatList
            data={activities}
            keyExtractor={(item) => String(item.id || item.date)}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={s.emptyWrap}>
                <Ionicons name="footsteps-outline" size={42} color={t.sub} />
                <Text style={[s.emptyTitle, { color: t.text }]}>Belum ada riwayat lari</Text>
                <Text style={[s.emptySub, { color: t.sub }]}>Selesaikan sesi latihan di menu Record untuk melihat catatan di sini.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Card theme={t} style={s.historyCard}>
                <View style={s.historyCardHeader}>
                  <View style={s.activityTag}>
                    <Ionicons name="walk" size={14} color={t.primary} />
                    <Text style={[s.activityTagText, { color: t.text }]}>{item.label || 'Lari'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteActivity(item.id)}>
                    <Ionicons name="trash-outline" size={16} color={t.sub} />
                  </TouchableOpacity>
                </View>
                <Text style={[s.historyDate, { color: t.sub }]}>{formatDateTime(item.date)}</Text>
                
                <View style={[s.historyMetrics, { backgroundColor: t.input }]}>
                  <View style={s.mCol}>
                    <Text style={[s.mVal, { color: t.text }]}>{(Number(item.km) || 0).toFixed(2)}</Text>
                    <Text style={[s.mLbl, { color: t.sub }]}>km</Text>
                  </View>
                  <View style={s.mCol}>
                    <Text style={[s.mVal, { color: t.text }]}>{formatDuration(item.durationSec || 0)}</Text>
                    <Text style={[s.mLbl, { color: t.sub }]}>durasi</Text>
                  </View>
                  <View style={s.mCol}>
                    <Text style={[s.mVal, { color: t.text }]}>{item.pace || '--:--'}</Text>
                    <Text style={[s.mLbl, { color: t.sub }]}>pace</Text>
                  </View>
                  <View style={s.mCol}>
                    <Text style={[s.mVal, { color: t.text }]}>{item.calories || 0}</Text>
                    <Text style={[s.mLbl, { color: t.sub }]}>kcal</Text>
                  </View>
                </View>
              </Card>
            )}
          />
        ) : (
          /* TAB 2: PENGATURAN */
          <View style={s.settingsWrap}>
            <Card theme={t} style={s.settingCard}>
              <View style={s.settingRow}>
                <View style={s.settingLabelGroup}>
                  <Ionicons name={darkMode ? 'moon' : 'sunny'} size={20} color={t.primary} />
                  <Text style={[s.settingLabel, { color: t.text }]}>Mode Gelap</Text>
                </View>
                <Switch
                  value={Boolean(darkMode)}
                  onValueChange={(v) => setDarkMode && setDarkMode(v)}
                  trackColor={{ false: t.border, true: t.primary }}
                  thumbColor={t.onPrimary}
                />
              </View>
            </Card>

            <TouchableOpacity
              onPress={() =>
                Alert.alert('Keluar Akun', 'Keluar dari aplikasi vstride?', [
                  { text: 'Batal' },
                  { text: 'Keluar', style: 'destructive', onPress: onLogout },
                ])
              }
              style={[s.logoutButton, { borderColor: t.danger }]}
            >
              <Ionicons name="log-out-outline" size={18} color={t.danger} />
              <Text style={[s.logoutText, { color: t.danger }]}>Keluar Akun</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* MODAL UBAH NAMA */}
      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[s.modalTitle, { color: t.text }]}>Ubah Nama Profil</Text>
            <TextInput
              style={[s.modalInput, { backgroundColor: t.input, color: t.text, borderColor: t.border }]}
              value={newName}
              onChangeText={setNewName}
              placeholder="Nama baru"
              placeholderTextColor={t.sub}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                style={[s.mBtn, { backgroundColor: t.input }]}
              >
                <Text style={{ color: t.text, fontWeight: '700' }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveName}
                style={[s.mBtn, { backgroundColor: t.primary }]}
              >
                <Text style={{ color: t.onPrimary, fontWeight: '700' }}>Simpan</Text>
              </TouchableOpacity>
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
    topHeader: {
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerTitle: { fontSize: 17, fontWeight: '800' },
    container: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },

    heroCard: { padding: 14, marginBottom: 12 },
    heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    avatarCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 24, fontWeight: '800' },
    heroInfo: { flex: 1 },
    userName: { fontSize: 18, fontWeight: '800' },
    userEmail: { fontSize: 12, marginTop: 1 },
    editLink: { marginTop: 4 },
    editLinkText: { fontSize: 12, fontWeight: '700' },

    tabSwitch: {
      flexDirection: 'row',
      borderRadius: 12,
      padding: 4,
      marginBottom: 12,
    },
    tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
    tabBtnText: { fontSize: 12, fontWeight: '700' },

    listContent: { paddingBottom: 24 },
    historyCard: { padding: 14, marginBottom: 10 },
    historyCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    activityTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    activityTagText: { fontSize: 14, fontWeight: '700' },
    historyDate: { fontSize: 11, marginVertical: 6 },
    historyMetrics: {
      flexDirection: 'row',
      borderRadius: 10,
      paddingVertical: 8,
      marginTop: 4,
    },
    mCol: { flex: 1, alignItems: 'center' },
    mVal: { fontSize: 13, fontWeight: '800' },
    mLbl: { fontSize: 9, marginTop: 1 },

    emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 50, gap: 6 },
    emptyTitle: { fontSize: 15, fontWeight: '700', marginTop: 6 },
    emptySub: { fontSize: 12, textAlign: 'center', paddingHorizontal: 20 },

    settingsWrap: { paddingTop: 6 },
    settingCard: { padding: 14, marginBottom: 14 },
    settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    settingLabelGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    settingLabel: { fontSize: 14, fontWeight: '700' },
    logoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 46,
      borderRadius: 12,
      borderWidth: 1,
      marginTop: 4,
    },
    logoutText: { fontSize: 14, fontWeight: '700' },

    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalBox: { width: '100%', borderRadius: 18, padding: 18, borderWidth: 1 },
    modalTitle: { fontSize: 16, fontWeight: '800', marginBottom: 12 },
    modalInput: { borderRadius: 10, borderWidth: 1, padding: 10, fontSize: 14, marginBottom: 16 },
    mBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  });