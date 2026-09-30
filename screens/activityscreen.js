// screens/recordscreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';

import { Card } from '../components/ui';
import { formatDuration, formatPace } from '../utils/format';
import { addActivityEntry } from '../utils/storage';

const ACTIVITIES = [
  { key: 'run', label: 'Lari', icon: 'footsteps' },
  { key: 'bike', label: 'Bersepeda', icon: 'bicycle' },
  { key: 'swim', label: 'Berenang', icon: 'water' },
];

function createMapHTML(primaryColor = '#2563EB', is3D = false) {
  const tileUrl = is3D
    ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; background: #E5E3DF; }
    .leaflet-control-attribution { display: none !important; }
    .location-marker {
      width: 22px; height: 22px;
      background: ${primaryColor};
      border: 3px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 0 0 6px ${primaryColor}35, 0 3px 8px rgba(0,0,0,0.3);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([-7.2575, 112.7521], 16);
    L.tileLayer('${tileUrl}', { maxZoom: 19 }).addTo(map);

    let marker = null;
    const routeLayer = L.layerGroup().addTo(map);

    const icon = L.divIcon({
      className: '',
      html: '<div class="location-marker"></div>',
      iconSize: [22, 22], iconAnchor: [11, 11]
    });

    function setPos(lat, lng) {
      if (!marker) {
        marker = L.marker([lat, lng], { icon: icon }).addTo(map);
      } else {
        marker.setLatLng([lat, lng]);
      }
      map.setView([lat, lng], 16);
    }

    function setRoute(pts) {
      routeLayer.clearLayers();
      if (!Array.isArray(pts) || pts.length < 2) return;
      L.polyline(pts, { color: '${primaryColor}', weight: 6, lineCap: 'round', lineJoin: 'round' }).addTo(routeLayer);
    }

    function resetMap() {
      routeLayer.clearLayers();
    }

    window.addEventListener('message', (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.type === 'POS') setPos(d.lat, d.lng);
        if (d.type === 'ROUTE') setRoute(d.pts);
        if (d.type === 'RESET') resetMap();
      } catch(err) {}
    });
  </script>
</body>
</html>
`;
}

export default function RecordScreen({ theme: t, setActiveScreen }) {
  const s = useMemo(() => createStyles(t), [t]);
  const webViewRef = useRef(null);

  const [selectedActivity, setSelectedActivity] = useState(ACTIVITIES[0]);
  const [activityModalVisible, setActivityModalVisible] = useState(false);
  const [pauseModalVisible, setPauseModalVisible] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [is3DMap, setIs3DMap] = useState(false);

  // FSM State: 'idle' | 'recording' | 'paused'
  const [recordState, setRecordState] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [distanceM, setDistanceM] = useState(0);
  const [route, setRoute] = useState([]);

  const timerRef = useRef(null);
  const watchSubRef = useRef(null);

  const km = distanceM / 1000;
  const currentPace = formatPace(elapsed, km);

  const sendToMap = useCallback((data) => {
    if (!webViewRef.current) return;
    const msg = JSON.stringify(JSON.stringify(data));
    webViewRef.current.injectJavaScript(`window.dispatchEvent(new MessageEvent('message', { data: ${msg} })); true;`);
  }, []);

  // Inisialisasi GPS
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          sendToMap({ type: 'POS', lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      } catch (e) {}
    })();
  }, [sendToMap]);

  // Timer Lifecycle
  useEffect(() => {
    if (recordState === 'recording') {
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recordState]);

  const startGPS = async () => {
    try {
      watchSubRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 2 },
        (loc) => {
          const { latitude, longitude } = loc.coords;
          sendToMap({ type: 'POS', lat: latitude, lng: longitude });

          setRoute((prev) => {
            const next = [...prev, [latitude, longitude]];
            sendToMap({ type: 'ROUTE', pts: next });
            return next;
          });

          setDistanceM((prev) => prev + 2.8);
        }
      );
    } catch (e) {}
  };

  const stopGPS = () => {
    if (watchSubRef.current) {
      watchSubRef.current.remove();
      watchSubRef.current = null;
    }
  };

  const handleStart = async () => {
    setRecordState('recording');
    await startGPS();
  };

  const handlePauseTrigger = () => {
    setRecordState('paused');
    stopGPS();
    setConfirmDiscard(false);
    setPauseModalVisible(true);
  };

  const handleResume = () => {
    setPauseModalVisible(false);
    setRecordState('recording');
    startGPS();
  };

  const handleSave = async () => {
    setPauseModalVisible(false);
    setRecordState('idle');
    stopGPS();

    await addActivityEntry({
      activity: selectedActivity.key,
      label: selectedActivity.label,
      km: Number(km.toFixed(2)),
      durationSec: elapsed,
      calories: Math.round(km * 60),
      pace: currentPace,
      speed: elapsed > 0 ? Number((km / (elapsed / 3600)).toFixed(1)) : 0,
      route,
      date: new Date().toISOString(),
    });

    // Reset State & Map
    setElapsed(0);
    setDistanceM(0);
    setRoute([]);
    sendToMap({ type: 'RESET' });

    if (setActiveScreen) setActiveScreen('profile');
  };

  // HANDLER EKSEKUSI BUANG SESI (DISCARD)
  const executeDiscard = () => {
    setPauseModalVisible(false);
    setConfirmDiscard(false);
    setRecordState('idle');

    // 1. Matikan tracking GPS & interval
    stopGPS();
    if (timerRef.current) clearInterval(timerRef.current);

    // 2. Bersihkan buffer state lokal
    setElapsed(0);
    setDistanceM(0);
    setRoute([]);

    // 3. Reset visual rute di Leaflet WebView
    sendToMap({ type: 'RESET' });
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* 1. FULL-BLEED MAP VIEWPORT */}
      <View style={StyleSheet.absoluteFillObject}>
        <WebView
          ref={webViewRef}
          source={{ html: createMapHTML(t.primary, is3DMap) }}
          style={s.webview}
        />
      </View>

      {/* 2. ANCHORED BOTTOM CONTROL PANEL */}
      <SafeAreaView edges={['bottom']} style={s.anchoredPanel}>
        {/* FLOATING HUD METRICS */}
        <Card theme={t} style={s.floatingHUD}>
          <View style={s.hudCol}>
            <Text style={[s.hudValue, { color: t.text }]}>{formatDuration(elapsed)}</Text>
            <Text style={[s.hudLabel, { color: t.sub }]}>WAKTU</Text>
          </View>
          <View style={[s.hudDivider, { backgroundColor: t.border }]} />
          <View style={s.hudCol}>
            <Text style={[s.hudValue, { color: t.text }]}>{currentPace}</Text>
            <Text style={[s.hudLabel, { color: t.sub }]}>PACE (T/KM)</Text>
          </View>
          <View style={[s.hudDivider, { backgroundColor: t.border }]} />
          <View style={s.hudCol}>
            <Text style={[s.hudValue, { color: t.text }]}>{km.toFixed(2)}</Text>
            <Text style={[s.hudLabel, { color: t.sub }]}>JARAK (KM)</Text>
          </View>
        </Card>

        {/* 3 CIRCULAR ACTION BUTTONS */}
        <View style={s.actionRow}>
          {/* Tombol Kiri: Pemilih Kategori */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => recordState === 'idle' && setActivityModalVisible(true)}
            style={[s.circleBtn, { backgroundColor: t.card, borderColor: t.border }]}
            accessibilityLabel="Pilih Jenis Olahraga"
          >
            <Ionicons name={selectedActivity.icon} size={22} color={t.text} />
          </TouchableOpacity>

          {/* Tombol Tengah: Play / Pause Control */}
          {recordState === 'idle' ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleStart}
              style={[s.mainCenterBtn, { backgroundColor: t.primary }]}
              accessibilityLabel="Mulai Lacak"
            >
              <Ionicons name="play" size={28} color={t.onPrimary} style={{ marginLeft: 3 }} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handlePauseTrigger}
              style={[s.mainCenterBtn, { backgroundColor: t.primary }]}
              accessibilityLabel="Jeda Latihan"
            >
              <Ionicons name="pause" size={26} color={t.onPrimary} />
            </TouchableOpacity>
          )}

          {/* Tombol Kanan: Tipe Peta 3D/Standar */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setIs3DMap(!is3DMap)}
            style={[
              s.circleBtn,
              { backgroundColor: t.card, borderColor: is3DMap ? t.primary : t.border },
            ]}
            accessibilityLabel="Ubah Tampilan Peta"
          >
            <Ionicons name="layers" size={22} color={is3DMap ? t.primary : t.text} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* MODAL DIALOG: JEDA & BUANG SESI (BEBAS DEADLOCK) */}
      <Modal visible={pauseModalVisible} transparent animationType="fade">
        <View style={s.scrimOverlay}>
          <View style={[s.pauseSheet, { backgroundColor: t.card, borderColor: t.border }]}>
            {!confirmDiscard ? (
              // TAMPILAN NORMAL SAAT DIJEDA
              <>
                <View style={s.pauseHeader}>
                  <View style={[s.pauseBadge, { backgroundColor: `${t.primary}18` }]}>
                    <Ionicons name="pause" size={20} color={t.primary} />
                  </View>
                  <Text style={[s.pauseTitle, { color: t.text }]}>Latihan Dijeda</Text>
                  <Text style={[s.pauseSubtitle, { color: t.sub }]}>
                    {km.toFixed(2)} km · {formatDuration(elapsed)}
                  </Text>
                </View>

                <View style={s.pauseActionWrap}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleResume}
                    style={[s.modalBtn, { backgroundColor: t.primary }]}
                  >
                    <Ionicons name="play" size={18} color={t.onPrimary} />
                    <Text style={[s.modalBtnText, { color: t.onPrimary }]}>Lanjutkan Lari</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleSave}
                    style={[s.modalBtn, { backgroundColor: t.card, borderColor: t.border, borderWidth: 1 }]}
                  >
                    <Ionicons name="checkmark-circle" size={18} color={t.primary} />
                    <Text style={[s.modalBtnText, { color: t.text }]}>Selesai & Simpan</Text>
                  </TouchableOpacity>

                  {/* Tombol Buang Sesi: Membuka Konfirmasi Langsung di Modal */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setConfirmDiscard(true)}
                    style={[s.modalBtn, { backgroundColor: `${t.danger}15` }]}
                  >
                    <Ionicons name="trash-outline" size={18} color={t.danger} />
                    <Text style={[s.modalBtnText, { color: t.danger }]}>Buang Sesi</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              // TAMPILAN KONFIRMASI BUANG SESI (IN-SHEET CONFIRMATION)
              <>
                <View style={s.pauseHeader}>
                  <View style={[s.pauseBadge, { backgroundColor: `${t.danger}18` }]}>
                    <Ionicons name="warning" size={20} color={t.danger} />
                  </View>
                  <Text style={[s.pauseTitle, { color: t.text }]}>Buang Sesi Ini?</Text>
                  <Text style={[s.pauseSubtitle, { color: t.sub, textAlign: 'center' }]}>
                    Data rute dan waktu latihan yang belum disimpan akan terhapus permanen.
                  </Text>
                </View>

                <View style={s.pauseActionWrap}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={executeDiscard}
                    style={[s.modalBtn, { backgroundColor: t.danger }]}
                  >
                    <Ionicons name="trash" size={18} color={t.onPrimary} />
                    <Text style={[s.modalBtnText, { color: t.onPrimary }]}>Ya, Buang Sesi</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setConfirmDiscard(false)}
                    style={[s.modalBtn, { backgroundColor: t.input }]}
                  >
                    <Text style={[s.modalBtnText, { color: t.text }]}>Batal</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL PEMILIH AKTIVITAS */}
      <Modal visible={activityModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={s.scrimOverlay}
          activeOpacity={1}
          onPress={() => setActivityModalVisible(false)}
        >
          <View style={[s.activitySheet, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[s.sheetTitle, { color: t.text }]}>Pilih Kategori Gerakan</Text>
            {ACTIVITIES.map((act) => (
              <TouchableOpacity
                key={act.key}
                onPress={() => {
                  setSelectedActivity(act);
                  setActivityModalVisible(false);
                }}
                style={[
                  s.activityOptionRow,
                  selectedActivity.key === act.key && { backgroundColor: `${t.primary}15` },
                ]}
              >
                <Ionicons
                  name={act.icon}
                  size={22}
                  color={selectedActivity.key === act.key ? t.primary : t.text}
                />
                <Text
                  style={[
                    s.activityOptionText,
                    { color: selectedActivity.key === act.key ? t.primary : t.text },
                  ]}
                >
                  {act.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const createStyles = (t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },
    webview: { flex: 1 },

    anchoredPanel: {
      position: 'absolute',
      bottom: 14,
      left: 16,
      right: 16,
      zIndex: 10,
    },

    floatingHUD: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 18,
      marginBottom: 14,
      borderWidth: 1,
      elevation: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.15,
      shadowRadius: 5,
    },
    hudCol: { flex: 1, alignItems: 'center' },
    hudValue: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
    hudLabel: { fontSize: 9, fontWeight: '700', marginTop: 3, letterSpacing: 0.5 },
    hudDivider: { width: 1, height: 28 },

    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingHorizontal: 8,
    },
    circleBtn: {
      width: 52,
      height: 52,
      borderRadius: 26,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
    },
    mainCenterBtn: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
    },

    scrimOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    pauseSheet: {
      width: '100%',
      borderRadius: 22,
      padding: 20,
      borderWidth: 1,
      alignItems: 'center',
    },
    pauseHeader: { alignItems: 'center', marginBottom: 20 },
    pauseBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    pauseTitle: { fontSize: 20, fontWeight: '800' },
    pauseSubtitle: { fontSize: 13, marginTop: 4, fontWeight: '600' },
    pauseActionWrap: { width: '100%', gap: 10 },
    modalBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 48,
      borderRadius: 14,
    },
    modalBtnText: { fontSize: 14, fontWeight: '700' },

    activitySheet: {
      width: '100%',
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
    },
    sheetTitle: { fontSize: 16, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
    activityOptionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      marginBottom: 6,
    },
    activityOptionText: { fontSize: 15, fontWeight: '700' },
  });