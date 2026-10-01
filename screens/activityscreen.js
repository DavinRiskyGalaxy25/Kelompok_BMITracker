// screens/activityscreen.js
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

function getHaversineDistance(a, b) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const val =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(val));
}

function getBearing(a, b) {
  const toRad = (x) => (x * Math.PI) / 180;
  const toDeg = (x) => (x * 180) / Math.PI;
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// HTML Map dengan dukungan pergantian Satelit secara dinamis
function createMapHTML(primaryColor = '#2563EB', initialTileUrl) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map {
      width: 100vw;
      height: 100vh;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: #E2E8F0;
    }
    .leaflet-control-attribution { display: none !important; }
    .location-marker-outer {
      width: 22px; height: 22px;
      background: ${primaryColor};
      border: 3px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 0 0 5px ${primaryColor}40, 0 3px 6px rgba(0,0,0,0.3);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true
    }).setView([-7.2575, 112.7521], 16);

    // Menyimpan referensi ke layer peta agar URL-nya bisa diubah untuk mode satelit
    var tileLayer = L.tileLayer('${initialTileUrl}', {
      maxZoom: 19,
      subdomains: 'abc'
    }).addTo(map);

    var marker = null;
    var routeLayer = L.layerGroup().addTo(map);

    var customIcon = L.divIcon({
      className: '',
      html: '<div class="location-marker-outer"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    function updatePointer(lat, lng) {
      if (!marker) {
        marker = L.marker([lat, lng], { icon: customIcon, zIndexOffset: 1000 }).addTo(map);
      } else {
        marker.setLatLng([lat, lng]);
      }
    }

    function updateRoute(pts) {
      routeLayer.clearLayers();
      if (!Array.isArray(pts) || pts.length < 2) return;
      L.polyline(pts, {
        color: '${primaryColor}',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(routeLayer);
    }

    function handleNativeMessage(e) {
      try {
        var data = JSON.parse(e.data);
        if (data.type === 'POS') {
          updatePointer(data.lat, data.lng);
        }
        if (data.type === 'ROUTE') {
          updateRoute(data.pts);
        }
        if (data.type === 'CENTER') {
          map.setView([data.lat, data.lng], 17, { animate: true });
        }
        if (data.type === 'RESET') {
          routeLayer.clearLayers();
        }
        if (data.type === 'SET_TILE') {
          tileLayer.setUrl(data.url);
        }
      } catch(err) {}
    }

    document.addEventListener('message', handleNativeMessage);
    window.addEventListener('message', handleNativeMessage);

    // Mencegah bagian abu-abu pada peta akibat error render WebView
    setInterval(function() {
      map.invalidateSize();
    }, 1500);
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
  const [recordState, setRecordState] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [distanceM, setDistanceM] = useState(0);
  const [route, setRoute] = useState([]);
  
  const [currentLoc, setCurrentLoc] = useState(null); // Menyimpan koordinat untuk Tombol Center

  const timerRef = useRef(null);
  const watchSubRef = useRef(null);

  const lastPointRef = useRef(null);
  const lastAnchorRef = useRef(null);
  const lastBearingRef = useRef(null);

  const km = distanceM / 1000;
  const currentPace = formatPace(elapsed, km);

  // Menentukan URL Tile berdasarkan mode satelit
  const tileUrl = useMemo(() => {
    if (is3DMap) {
      return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    }
    return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  }, [is3DMap]);

  // Generate HTML hanya 1 kali
  const mapHTML = useRef(createMapHTML(t.primary, tileUrl)).current;

  const sendToMap = useCallback((data) => {
    if (!webViewRef.current) return;
    const msg = JSON.stringify(JSON.stringify(data));
    webViewRef.current.injectJavaScript(`window.dispatchEvent(new MessageEvent('message', { data: ${msg} })); true;`);
  }, []);

  // Update satelit saat toggle ditekan
  useEffect(() => {
    sendToMap({ type: 'SET_TILE', url: tileUrl });
  }, [tileUrl, sendToMap]);

  // Cari lokasi awal saat layar dimuat
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const initialLoc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setCurrentLoc(initialLoc);
          sendToMap({ type: 'POS', lat: initialLoc.latitude, lng: initialLoc.longitude });
          sendToMap({ type: 'CENTER', lat: initialLoc.latitude, lng: initialLoc.longitude });
        }
      } catch (e) {}
    })();
  }, [sendToMap]);

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
        {
          accuracy: Location.Accuracy.Highest,
          timeInterval: 2000,
          distanceInterval: 3, // JITTER FIX: Minimal melangkah 3 meter
        },
        (loc) => {
          if (loc.coords.accuracy > 15) return; // JITTER FIX: Abaikan data tidak akurat

          const current = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };

          setCurrentLoc(current); // Selalu simpan lokasi terbaru
          sendToMap({ type: 'POS', lat: current.latitude, lng: current.longitude });

          if (!lastAnchorRef.current) {
            lastAnchorRef.current = current;
            lastPointRef.current = current;
            setRoute([[current.latitude, current.longitude]]);
            sendToMap({ type: 'CENTER', lat: current.latitude, lng: current.longitude });
            return;
          }

          const distFromLast = getHaversineDistance(lastPointRef.current, current);
          if (distFromLast < 2) return; 

          setDistanceM((prev) => prev + distFromLast);
          lastPointRef.current = current;

          const distFromAnchor = getHaversineDistance(lastAnchorRef.current, current);
          const currentBearing = getBearing(lastAnchorRef.current, current);

          let angleDiff = 0;
          if (lastBearingRef.current !== null) {
            angleDiff = Math.abs(currentBearing - lastBearingRef.current);
            if (angleDiff > 180) angleDiff = 360 - angleDiff;
          }

          setRoute((prevRoute) => {
            let nextRoute = [...prevRoute];
            if (angleDiff > 15 || distFromAnchor >= 25 || lastBearingRef.current === null) {
              nextRoute.push([current.latitude, current.longitude]);
              lastAnchorRef.current = current;
              lastBearingRef.current = currentBearing;
            } else {
              if (nextRoute.length > 1) {
                nextRoute[nextRoute.length - 1] = [current.latitude, current.longitude];
              } else {
                nextRoute.push([current.latitude, current.longitude]);
              }
            }
            sendToMap({ type: 'ROUTE', pts: nextRoute });
            return nextRoute;
          });
        }
      );
    } catch (e) {
      console.log('Error GPS:', e);
    }
  };

  const stopGPS = () => {
    if (watchSubRef.current) {
      watchSubRef.current.remove();
      watchSubRef.current = null;
    }
    lastPointRef.current = null;
    lastAnchorRef.current = null;
    lastBearingRef.current = null;
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

    setElapsed(0);
    setDistanceM(0);
    setRoute([]);
    sendToMap({ type: 'RESET' });

    if (setActiveScreen) setActiveScreen('profile');
  };

  const executeDiscard = () => {
    setPauseModalVisible(false);
    setConfirmDiscard(false);
    setRecordState('idle');

    stopGPS();
    if (timerRef.current) clearInterval(timerRef.current);

    setElapsed(0);
    setDistanceM(0);
    setRoute([]);
    sendToMap({ type: 'RESET' });
  };

  // TOMBOL CENTER FIX: Langsung ambil data dari memori 'currentLoc'
  const handleCenterLocation = () => {
    if (currentLoc) {
      sendToMap({ type: 'CENTER', lat: currentLoc.latitude, lng: currentLoc.longitude });
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      <View style={s.mapContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: mapHTML }}
          style={s.webview}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="always"
          bounces={false}
          scrollEnabled={false}
        />

        <SafeAreaView edges={['bottom']} style={s.anchoredPanel}>
          
          <View style={s.centerBtnWrapper}>
            <TouchableOpacity 
              activeOpacity={0.8} 
              onPress={handleCenterLocation} 
              style={[s.centerBtn, { backgroundColor: t.card }]}
            >
              <Ionicons name="locate" size={24} color={t.primary} />
            </TouchableOpacity>
          </View>

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

          <View style={s.actionRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => recordState === 'idle' && setActivityModalVisible(true)}
              style={[s.circleBtn, { backgroundColor: t.card }]}
            >
              <Ionicons name={selectedActivity.icon} size={22} color={t.text} />
            </TouchableOpacity>

            {recordState === 'idle' ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleStart}
                style={[s.mainCenterBtn, { backgroundColor: t.primary }]}
              >
                <Ionicons name="play" size={28} color={t.onPrimary} style={{ marginLeft: 3 }} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handlePauseTrigger}
                style={[s.mainCenterBtn, { backgroundColor: t.primary }]}
              >
                <Ionicons name="pause" size={26} color={t.onPrimary} />
              </TouchableOpacity>
            )}

            {/* Tombol Toggle Satelit / Standar */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setIs3DMap(!is3DMap)}
              style={[
                s.circleBtn,
                { 
                  backgroundColor: t.card, 
                  borderColor: is3DMap ? t.primary : 'transparent', 
                  borderWidth: is3DMap ? 2 : 0 
                },
              ]}
            >
              <Ionicons name="map" size={22} color={is3DMap ? t.primary : t.text} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      <Modal visible={pauseModalVisible} transparent animationType="fade">
        <View style={s.scrimOverlay}>
          <View style={[s.pauseSheet, { backgroundColor: t.card }]}>
            {!confirmDiscard ? (
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
                  <TouchableOpacity activeOpacity={0.85} onPress={handleResume} style={[s.modalBtn, { backgroundColor: t.primary }]}>
                    <Ionicons name="play" size={18} color={t.onPrimary} />
                    <Text style={[s.modalBtnText, { color: t.onPrimary }]}>Lanjutkan Lari</Text>
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.85} onPress={handleSave} style={[s.modalBtn, { backgroundColor: t.input }]}>
                    <Ionicons name="checkmark-circle" size={18} color={t.primary} />
                    <Text style={[s.modalBtnText, { color: t.text }]}>Selesai & Simpan</Text>
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.85} onPress={() => setConfirmDiscard(true)} style={[s.modalBtn, { backgroundColor: `${t.danger}15` }]}>
                    <Ionicons name="trash-outline" size={18} color={t.danger} />
                    <Text style={[s.modalBtnText, { color: t.danger }]}>Buang Sesi</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={s.pauseHeader}>
                  <View style={[s.pauseBadge, { backgroundColor: `${t.danger}18` }]}>
                    <Ionicons name="warning" size={20} color={t.danger} />
                  </View>
                  <Text style={[s.pauseTitle, { color: t.text }]}>Buang Sesi Ini?</Text>
                  <Text style={[s.pauseSubtitle, { color: t.sub, textAlign: 'center' }]}>
                    Data rute dan waktu latihan ini akan dihapus permanen.
                  </Text>
                </View>
                <View style={s.pauseActionWrap}>
                  <TouchableOpacity activeOpacity={0.85} onPress={executeDiscard} style={[s.modalBtn, { backgroundColor: t.danger }]}>
                    <Ionicons name="trash" size={18} color={t.onPrimary} />
                    <Text style={[s.modalBtnText, { color: t.onPrimary }]}>Ya, Buang Sesi</Text>
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.85} onPress={() => setConfirmDiscard(false)} style={[s.modalBtn, { backgroundColor: t.input }]}>
                    <Text style={[s.modalBtnText, { color: t.text }]}>Batal</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={activityModalVisible} transparent animationType="fade">
        <TouchableOpacity style={s.scrimOverlay} activeOpacity={1} onPress={() => setActivityModalVisible(false)}>
          <View style={[s.activitySheet, { backgroundColor: t.card }]}>
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
                <Ionicons name={act.icon} size={22} color={selectedActivity.key === act.key ? t.primary : t.text} />
                <Text style={[s.activityOptionText, { color: selectedActivity.key === act.key ? t.primary : t.text }]}>{act.label}</Text>
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
    mapContainer: { flex: 1, position: 'relative' },
    webview: { flex: 1, backgroundColor: '#E2E8F0' },
    anchoredPanel: { position: 'absolute', bottom: 14, left: 16, right: 16, zIndex: 10 },
    
    centerBtnWrapper: { alignItems: 'flex-end', marginBottom: 14, paddingRight: 4 },
    centerBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },

    floatingHUD: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 18, marginBottom: 14, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 5 },
    hudCol: { flex: 1, alignItems: 'center' },
    hudValue: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
    hudLabel: { fontSize: 9, fontWeight: '700', marginTop: 3, letterSpacing: 0.5 },
    hudDivider: { width: 1, height: 28 },
    actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
    circleBtn: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3 },
    mainCenterBtn: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
    scrimOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    pauseSheet: { width: '100%', borderRadius: 22, padding: 20, alignItems: 'center' },
    pauseHeader: { alignItems: 'center', marginBottom: 20 },
    pauseBadge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    pauseTitle: { fontSize: 20, fontWeight: '800' },
    pauseSubtitle: { fontSize: 13, marginTop: 4, fontWeight: '600' },
    pauseActionWrap: { width: '100%', gap: 10 },
    modalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 14 },
    modalBtnText: { fontSize: 14, fontWeight: '700' },
    activitySheet: { width: '100%', borderRadius: 20, padding: 18 },
    sheetTitle: { fontSize: 16, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
    activityOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, marginBottom: 6 },
    activityOptionText: { fontSize: 15, fontWeight: '700' },
  });