import Ionicons from "@expo/vector-icons/Ionicons";
import { Magnetometer } from "expo-sensors";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Card } from "../components/ui";

import { useTracker } from "../hooks/usetracker";
import { ACTIVITIES } from "../utils/activities";
import { formatDuration } from "../utils/format";
import { setRunSteps } from "../utils/rundata";

export default function ActivityScreen({
  theme: t,
  user,
  setActiveScreen,
  canGoBack,
  goBack,
}) {
  const insets = useSafeAreaInsets();
  const s = useMemo(() => createStyles(t, insets), [t, insets]);

  const tracker = useTracker();

  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);

  const [heading, setHeading] = useState(0);
  const headingRef = useRef(0);
  const lastUpdateRef = useRef(0);

  // Initialize tracker on mount
  useEffect(() => {
    tracker.prepare();
    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStart = () => {
    tracker.start();
  };

  const handlePause = () => {
    setShowPauseModal(true);
  };

  const handleResume = () => {
    setShowPauseModal(false);
  };

  const handleStopAndSave = async () => {
    setShowPauseModal(false);
    setRunSteps(tracker.steps || 0);
    await tracker.stop();
    setActiveScreen("runsummary");
  };

  const handleDiscard = () => {
    setShowPauseModal(false);
    tracker.reset();
  };

  // Stable map HTML — tile changes are injected via postMessage
  const mapHtml = useMemo(() => {
    const initialTile = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    const loc = tracker.userLocation || { latitude: -6.2, longitude: 106.8 };
    return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <style>
    *{margin:0;padding:0}
    html,body,#map{width:100%;height:100%;overflow:hidden}
    .leaflet-control-attribution{display:none!important}
    .dot{width:18px;height:18px;background:${t.primary};border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px ${t.primary}40}
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var map=L.map('map',{zoomControl:false,attributionControl:false}).setView([${loc.latitude},${loc.longitude}],16);
  var tile=L.tileLayer('${initialTile}',{maxZoom:19,subdomains:'abc'}).addTo(map);
  var marker=null,routeLayer=L.layerGroup().addTo(map);
  var iconHtml='<div style="position:relative;width:80px;height:80px;"><div id="cone" style="position:absolute;top:0;left:0;width:100%;height:100%;transition:transform 0.1s linear;transform-origin:50% 50%;"><svg viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" stop-color="${t.primary}" stop-opacity="0.5"/><stop offset="100%" stop-color="${t.primary}" stop-opacity="0"/></linearGradient></defs><path d="M50 50 L20 0 A50 50 0 0 1 80 0 Z" fill="url(#g)"/></svg></div><div class="dot" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);"></div></div>';
  var icon=L.divIcon({className:'',html:iconHtml,iconSize:[80,80],iconAnchor:[40,40]});

  function handle(e){
    try{
      var d=JSON.parse(e.data);
      if(d.type==='POS'){
        if(!marker){marker=L.marker([d.lat,d.lng],{icon:icon,zIndexOffset:1000}).addTo(map)}
        else{marker.setLatLng([d.lat,d.lng])}
        map.panTo([d.lat,d.lng],{animate:true,duration:0.5});
      }
      if(d.type==='HEADING'){
        var cone=document.getElementById('cone');
        if(cone){cone.style.transform='rotate('+d.val+'deg)';}
      }
      if(d.type==='ROUTE'){
        routeLayer.clearLayers();
        if(d.pts&&d.pts.length>1){
          L.polyline(d.pts,{color:'${t.primary}',weight:5,opacity:0.9,lineCap:'round',lineJoin:'round'}).addTo(routeLayer);
        }
      }
      if(d.type==='CENTER'){map.setView([d.lat,d.lng],17,{animate:true})}
      if(d.type==='TILE'){tile.setUrl(d.url)}
      if(d.type==='RESET'){routeLayer.clearLayers();if(marker){map.removeLayer(marker);marker=null}}
    }catch(x){}
  }
  document.addEventListener('message',handle);
  window.addEventListener('message',handle);
  setTimeout(function(){map.invalidateSize()},300);
  setInterval(function(){map.invalidateSize()},2000);
<\/script>
</body>
</html>`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const webViewRef = useRef(null);

  const handleCenterMap = useCallback(() => {
    if (!webViewRef.current || !tracker.userLocation) return;
    const { latitude, longitude } = tracker.userLocation;
    webViewRef.current.injectJavaScript(
      `if(typeof map!=='undefined'){map.setView([${latitude},${longitude}],16)}true;`,
    );
  }, [tracker.userLocation]);

  const sendToMap = useCallback((data) => {
    if (!webViewRef.current) return;
    const msg = JSON.stringify(JSON.stringify(data));
    webViewRef.current.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message',{data:${msg}}));true;`,
    );
  }, []);

  // Update marker position when userLocation changes
  useEffect(() => {
    if (tracker.userLocation) {
      sendToMap({
        type: "POS",
        lat: tracker.userLocation.latitude,
        lng: tracker.userLocation.longitude,
      });
    }
  }, [tracker.userLocation, sendToMap]);

  // Compass Sensor
  useEffect(() => {
    let subscription;
    Magnetometer.setUpdateInterval(16);
    Magnetometer.isAvailableAsync().then((available) => {
      if (!available) return;
      subscription = Magnetometer.addListener((result) => {
        let angle = Math.atan2(-result.x, result.y) * (180 / Math.PI);
        if (angle < 0) angle += 360;

        let current = headingRef.current;
        let diff = angle - current;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;

        let smoothed = current + diff * 0.25;
        smoothed = (smoothed + 360) % 360;
        headingRef.current = smoothed;

        const now = Date.now();
        if (now - lastUpdateRef.current > 16) {
          lastUpdateRef.current = now;
          setHeading(smoothed);
          sendToMap({ type: "HEADING", val: smoothed });
        }
      });
    });
    return () => {
      if (subscription) subscription.remove();
    };
  }, [sendToMap]);

  // Update route polyline
  useEffect(() => {
    if (tracker.route && tracker.route.length > 0) {
      const pts = tracker.route.map((p) => [p.latitude, p.longitude]);
      sendToMap({ type: "ROUTE", pts });
    }
  }, [tracker.route, sendToMap]);

  // Toggle satellite/standard tile
  useEffect(() => {
    const url =
      tracker.mapType === "satellite"
        ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    sendToMap({ type: "TILE", url });
  }, [tracker.mapType, sendToMap]);

  const distanceKm = tracker.distance
    ? (tracker.distance / 1000).toFixed(2)
    : "0.00";

  return (
    <View style={s.container}>
      <StatusBar
        barStyle={t.isDark ? "light-content" : "dark-content"}
        translucent
        backgroundColor="transparent"
      />

      {/* Map — fills entire screen behind overlays */}
      <WebView
        ref={webViewRef}
        source={{ html: mapHtml }}
        style={s.map}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        originWhitelist={["*"]}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mixedContentMode="always"
        androidLayerType="hardware"
        startInLoadingState={true}
        renderLoading={() => (
          <View style={s.mapLoading}>
            <ActivityIndicator size="large" color={t.primary} />
            <Text style={{ color: t.sub, marginTop: 8 }}>Memuat peta...</Text>
          </View>
        )}
      />

      {/* Center button */}
      <TouchableOpacity style={s.centerBtn} onPress={handleCenterMap}>
        <Ionicons name="locate" size={22} color={t.primary} />
      </TouchableOpacity>

      {/* Compass button */}
      <TouchableOpacity style={s.compassBtn} onPress={handleCenterMap}>
        <View style={{ transform: [{ rotate: `${heading - 45}deg` }] }}>
          <Ionicons name="navigate" size={24} color={t.primary} />
        </View>
      </TouchableOpacity>

      {/* Top Header Controls */}
      <View style={s.topControls}>
        <TouchableOpacity
          style={s.iconButton}
          onPress={() => (canGoBack ? goBack() : setActiveScreen("home"))}
          disabled={tracker.isRecording}
        >
          <Ionicons name="arrow-back" size={24} color={t.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={s.activitySelector}
          onPress={() => setShowActivityModal(true)}
          disabled={tracker.isRecording}
        >
          <Ionicons
            name={tracker.activity?.icon || "walk"}
            size={18}
            color={t.primary}
          />
          <Text style={s.activityText}>
            {tracker.activity?.label || "Aktivitas"}
          </Text>
          <Ionicons name="chevron-down" size={16} color={t.sub} />
        </TouchableOpacity>

        <TouchableOpacity
          style={s.iconButton}
          onPress={() =>
            tracker.setMapType(
              tracker.mapType === "standard" ? "satellite" : "standard",
            )
          }
        >
          <Ionicons
            name="layers"
            size={24}
            color={tracker.mapType === "satellite" ? t.primary : t.text}
          />
        </TouchableOpacity>
      </View>

      {/* Bottom HUD Metrics */}
      <View style={s.bottomHudContainer}>
        <Card theme={t} style={s.hudCard}>
          <View style={s.metricsRow}>
            <View style={s.metricItem}>
              <Text style={s.metricLabel}>WAKTU</Text>
              <Text style={s.metricValue}>
                {formatDuration(tracker.elapsed || 0)}
              </Text>
            </View>
            <View style={s.metricDivider} />
            <View style={s.metricItem}>
              <Text style={s.metricLabel}>LANGKAH</Text>
              <Text style={s.metricValue}>{tracker.steps || 0}</Text>
            </View>
            <View style={s.metricDivider} />
            <View style={s.metricItem}>
              <Text style={s.metricLabel}>JARAK (KM)</Text>
              <Text style={s.metricValue}>{distanceKm}</Text>
            </View>
          </View>

          <View style={s.actionRow}>
            {tracker.starting || !tracker.gpsLoaded ? (
              <View style={[s.mainButton, { backgroundColor: t.sub }]}>
                <ActivityIndicator color={t.onPrimary} />
              </View>
            ) : !tracker.isRecording ? (
              <TouchableOpacity style={s.mainButton} onPress={handleStart}>
                <Ionicons
                  name="play"
                  size={32}
                  color={t.onPrimary}
                  style={{ marginLeft: 4 }}
                />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[s.mainButton, { backgroundColor: t.danger }]}
                onPress={handlePause}
              >
                <Ionicons name="pause" size={32} color={t.onPrimary} />
              </TouchableOpacity>
            )}
          </View>
        </Card>
      </View>

      {/* Modal Jeda / Stop */}
      <Modal visible={showPauseModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <Card theme={t} style={s.pauseModalCard}>
            <Text style={s.pauseModalTitle}>Aktivitas Dijeda</Text>

            <TouchableOpacity
              style={[s.modalBtn, { backgroundColor: t.primary }]}
              onPress={handleResume}
            >
              <Ionicons
                name="play"
                size={20}
                color={t.onPrimary}
                style={s.modalBtnIcon}
              />
              <Text style={[s.modalBtnText, { color: t.onPrimary }]}>
                Lanjutkan
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.modalBtn, { backgroundColor: t.text }]}
              onPress={handleStopAndSave}
            >
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={t.bg}
                style={s.modalBtnIcon}
              />
              <Text style={[s.modalBtnText, { color: t.bg }]}>
                Selesai & Simpan
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                s.modalBtn,
                {
                  backgroundColor: "transparent",
                  borderColor: t.danger,
                  borderWidth: 1,
                },
              ]}
              onPress={handleDiscard}
            >
              <Ionicons
                name="trash"
                size={20}
                color={t.danger}
                style={s.modalBtnIcon}
              />
              <Text style={[s.modalBtnText, { color: t.danger }]}>
                Buang Aktivitas
              </Text>
            </TouchableOpacity>
          </Card>
        </View>
      </Modal>

      {/* Modal Pemilihan Aktivitas */}
      <Modal visible={showActivityModal} transparent animationType="slide">
        <View style={s.modalOverlayEnd}>
          <Card theme={t} style={s.activityModalCard}>
            <Text style={s.modalTitle}>Pilih Aktivitas</Text>
            {ACTIVITIES.map((act) => (
              <TouchableOpacity
                key={act.key}
                style={[
                  s.activityOption,
                  tracker.activityKey === act.key && {
                    backgroundColor: t.primary + "20",
                  },
                ]}
                onPress={() => {
                  tracker.setActivityKey(act.key);
                  setShowActivityModal(false);
                }}
              >
                <View
                  style={[
                    s.activityIconWrap,
                    {
                      backgroundColor:
                        tracker.activityKey === act.key ? t.primary : t.sub,
                    },
                  ]}
                >
                  <Ionicons
                    name={act.icon}
                    size={20}
                    color={tracker.activityKey === act.key ? t.onPrimary : t.bg}
                  />
                </View>
                <Text
                  style={[
                    s.activityOptionText,
                    tracker.activityKey === act.key && {
                      color: t.primary,
                      fontWeight: "bold",
                    },
                  ]}
                >
                  {act.label}
                </Text>
                {tracker.activityKey === act.key && (
                  <Ionicons name="checkmark" size={20} color={t.primary} />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={s.cancelBtn}
              onPress={() => setShowActivityModal(false)}
            >
              <Text style={s.cancelBtnText}>Batal</Text>
            </TouchableOpacity>
          </Card>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (t, insets) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    map: {
      ...StyleSheet.absoluteFillObject,
    },
    mapLoading: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: t.bg,
    },
    centerBtn: {
      position: "absolute",
      right: 16,
      top: insets.top + 64,
      backgroundColor: t.card,
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 3.84,
      elevation: 4,
      zIndex: 10,
    },
    compassBtn: {
      position: "absolute",
      right: 16,
      top: insets.top + 120,
      backgroundColor: t.card,
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 3.84,
      elevation: 4,
      zIndex: 10,
    },
    topControls: {
      position: "absolute",
      top: insets.top + 10,
      left: 16,
      right: 16,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      zIndex: 10,
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: t.card,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: t.shadow || "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    activitySelector: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: t.card,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      shadowColor: t.shadow || "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    activityText: {
      marginHorizontal: 8,
      color: t.text,
      fontSize: 14,
      fontWeight: "600",
    },
    bottomHudContainer: {
      position: "absolute",
      bottom: insets.bottom + 20,
      left: 16,
      right: 16,
      zIndex: 10,
    },
    hudCard: {
      padding: 16,
      borderRadius: 24,
      shadowColor: t.shadow || "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    },
    metricsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    metricItem: {
      flex: 1,
      alignItems: "center",
    },
    metricDivider: {
      width: 1,
      height: 30,
      backgroundColor: t.border,
    },
    metricLabel: {
      fontSize: 12,
      color: t.sub,
      marginBottom: 4,
      fontWeight: "600",
    },
    metricValue: {
      fontSize: 24,
      fontWeight: "700",
      color: t.text,
      fontVariant: ["tabular-nums"],
    },
    actionRow: {
      alignItems: "center",
    },
    mainButton: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: t.primary,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: t.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    pauseModalCard: {
      width: "100%",
      padding: 24,
      borderRadius: 20,
      alignItems: "center",
    },
    pauseModalTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: t.text,
      marginBottom: 24,
    },
    modalBtn: {
      flexDirection: "row",
      width: "100%",
      paddingVertical: 14,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
    },
    modalBtnIcon: {
      marginRight: 8,
    },
    modalBtnText: {
      fontSize: 16,
      fontWeight: "600",
    },
    modalOverlayEnd: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    activityModalCard: {
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: insets.bottom + 24 || 24,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: t.text,
      marginBottom: 16,
      textAlign: "center",
    },
    activityOption: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      borderRadius: 12,
      marginBottom: 8,
    },
    activityIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    activityOptionText: {
      flex: 1,
      fontSize: 16,
      color: t.text,
    },
    cancelBtn: {
      marginTop: 16,
      paddingVertical: 14,
      alignItems: "center",
    },
    cancelBtnText: {
      fontSize: 16,
      color: t.sub,
      fontWeight: "600",
    },
  });
