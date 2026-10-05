import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "../components/ui";
import { useTracker } from "../hooks/usetracker";
import { formatDuration } from "../utils/format";
import {
  clearRunData,
  getRunPhoto,
  getRunSteps,
  setRunPhoto,
} from "../utils/rundata";
import { STORAGE_KEYS } from "../utils/storage";

async function updateLatestActivity(patch) {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.activityHistory);
    const list = raw ? JSON.parse(raw) : [];
    if (list.length > 0) {
      list[0] = { ...list[0], ...patch };
      await AsyncStorage.setItem(
        STORAGE_KEYS.activityHistory,
        JSON.stringify(list),
      );
    }
  } catch (e) {
    console.log("Update latest activity error:", e);
  }
}

async function deleteLatestActivity() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.activityHistory);
    const list = raw ? JSON.parse(raw) : [];
    if (list.length > 0) {
      list.shift();
      await AsyncStorage.setItem(
        STORAGE_KEYS.activityHistory,
        JSON.stringify(list),
      );
    }
  } catch (e) {
    console.log("Delete latest activity error:", e);
  }
}

export default function RunSummaryScreen({ theme: t, user, setActiveScreen }) {
  const insets = useSafeAreaInsets();
  const s = useMemo(() => createStyles(t), [t]);

  const { summary, route, reset } = useTracker();

  const mapRef = useRef(null);
  const steps = getRunSteps();
  const initialPhoto = getRunPhoto();

  const [photoUri, setPhotoUri] = useState(initialPhoto);
  const [isSaving, setIsSaving] = useState(false);

  const hasRoute = route && route.length > 0;
  const startPoint = hasRoute ? route[0] : null;
  const endPoint = hasRoute ? route[route.length - 1] : null;

  const mapHtml = useMemo(() => {
    if (!hasRoute) return "";
    const initialTile = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    const routeCoords = JSON.stringify(
      route.map((p) => [p.latitude, p.longitude]),
    );
    const startLat = startPoint.latitude;
    const startLng = startPoint.longitude;
    const endLat = endPoint.latitude;
    const endLng = endPoint.longitude;

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
    .dot-start{width:16px;height:16px;background:#4ade80;border:3px solid #fff;border-radius:50%}
    .dot-end{width:16px;height:16px;background:#ef4444;border:3px solid #fff;border-radius:50%}
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var map=L.map('map',{zoomControl:false,attributionControl:false});
  L.tileLayer('${initialTile}',{maxZoom:19,subdomains:'abc'}).addTo(map);
  var routeLayer=L.layerGroup().addTo(map);

  var coords=${routeCoords};
  if(coords.length>0){
    var polyline=L.polyline(coords,{color:'${t.primary}',weight:4}).addTo(routeLayer);
    map.fitBounds(polyline.getBounds(),{padding:[20,20]});

    var startIcon=L.divIcon({className:'',html:'<div class="dot-start"></div>',iconSize:[16,16],iconAnchor:[8,8]});
    L.marker([${startLat},${startLng}],{icon:startIcon}).addTo(map);

    var endIcon=L.divIcon({className:'',html:'<div class="dot-end"></div>',iconSize:[16,16],iconAnchor:[8,8]});
    L.marker([${endLat},${endLng}],{icon:endIcon}).addTo(map);
  }
  setTimeout(function(){map.invalidateSize()},300);
<\/script>
</body>
</html>`;
  }, [hasRoute, route, startPoint, endPoint, t]);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Izin Ditolak",
        "Maaf, kami butuh izin galeri untuk mengunggah foto.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
      setRunPhoto(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Izin Ditolak",
        "Maaf, kami butuh izin kamera untuk mengambil foto.",
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
      setRunPhoto(result.assets[0].uri);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUri(null);
    setRunPhoto(null);
  };

  const handlePhotoOptions = () => {
    Alert.alert("Tambahkan Foto", "Pilih sumber foto", [
      { text: "Kamera", onPress: handleTakePhoto },
      { text: "Galeri", onPress: handlePickImage },
      { text: "Batal", style: "cancel" },
    ]);
  };

  const handleSave = async () => {
    if (!summary) return;
    setIsSaving(true);

    await updateLatestActivity({
      steps: steps,
      photo: photoUri,
    });

    clearRunData();
    reset();
    setActiveScreen("home");
  };

  const handleDiscard = () => {
    Alert.alert(
      "Buang Aktivitas",
      "Apakah Anda yakin ingin menghapus aktivitas ini? Data tidak dapat dikembalikan.",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Buang",
          style: "destructive",
          onPress: async () => {
            await deleteLatestActivity();
            clearRunData();
            reset();
            setActiveScreen("home");
          },
        },
      ],
    );
  };

  if (!summary) {
    return (
      <View
        style={[
          s.container,
          {
            paddingTop: insets.top,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <Text style={s.text}>Tidak ada data aktivitas.</Text>
        <TouchableOpacity
          style={s.btnPrimary}
          onPress={() => setActiveScreen("home")}
        >
          <Text style={s.btnPrimaryText}>Kembali ke Beranda</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[
          s.scrollContent,
          { paddingBottom: insets.bottom + 20 },
        ]}
      >
        <View style={s.header}>
          <Text style={s.headerTitle}>Ringkasan Aktivitas</Text>
          <Text style={s.headerDate}>
            {new Date(summary.date).toLocaleString("id-ID", {
              dateStyle: "long",
              timeStyle: "short",
            })}
          </Text>
        </View>

        <Card theme={t} style={s.mainCard}>
          <View style={s.mainStatContainer}>
            <Text style={s.mainStatValue}>{summary.km.toFixed(2)}</Text>
            <Text style={s.mainStatLabel}>Kilometer</Text>
          </View>

          <View style={s.statsRow}>
            <View style={s.statBox}>
              <Ionicons name="time-outline" size={20} color={t.text} />
              <Text style={s.statVal}>
                {formatDuration(summary.durationSec)}
              </Text>
              <Text style={s.statLbl}>Durasi</Text>
            </View>
            <View style={s.statBox}>
              <Ionicons name="footsteps-outline" size={20} color={t.text} />
              <Text style={s.statVal}>{steps.toLocaleString("id-ID")}</Text>
              <Text style={s.statLbl}>Langkah</Text>
            </View>
          </View>

          <View style={s.statsRow}>
            <View style={s.statBox}>
              <Ionicons name="speedometer-outline" size={20} color={t.text} />
              <Text style={s.statVal}>{summary.pace}</Text>
              <Text style={s.statLbl}>Pace (/km)</Text>
            </View>
            <View style={s.statBox}>
              <Ionicons name="flame-outline" size={20} color={t.text} />
              <Text style={s.statVal}>{Math.round(summary.calories)}</Text>
              <Text style={s.statLbl}>Kalori (kcal)</Text>
            </View>
          </View>
        </Card>

        {hasRoute ? (
          <View style={s.mapContainer}>
            <WebView
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
            />
          </View>
        ) : (
          <View style={s.noMapContainer}>
            <Ionicons name="map-outline" size={32} color={t.sub} />
            <Text style={s.noMapText}>
              Rute tidak tersedia (GPS tidak aktif)
            </Text>
          </View>
        )}

        <View style={s.photoSection}>
          <Text style={s.sectionTitle}>Foto Aktivitas</Text>
          {photoUri ? (
            <View style={s.photoWrapper}>
              <Image source={{ uri: photoUri }} style={s.photo} />
              <TouchableOpacity
                style={s.removePhotoBtn}
                onPress={handleRemovePhoto}
              >
                <Ionicons name="close-circle" size={28} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={s.addPhotoBtn}
              onPress={handlePhotoOptions}
            >
              <Ionicons name="camera-outline" size={32} color={t.sub} />
              <Text style={s.addPhotoText}>Tambahkan Foto</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={s.actions}>
          <TouchableOpacity
            style={s.btnSave}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color={t.onPrimary} />
            ) : (
              <Text style={s.btnSaveText}>Simpan Aktivitas</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={s.btnDiscard}
            onPress={handleDiscard}
            disabled={isSaving}
          >
            <Text style={s.btnDiscardText}>Buang</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (t) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
    },
    scrollContent: {
      padding: 16,
    },
    text: {
      color: t.text,
      fontSize: 16,
      marginBottom: 16,
    },
    header: {
      alignItems: "center",
      marginBottom: 24,
      marginTop: 8,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: t.text,
    },
    headerDate: {
      fontSize: 14,
      color: t.sub,
      marginTop: 4,
    },
    mainCard: {
      padding: 20,
      marginBottom: 20,
    },
    mainStatContainer: {
      alignItems: "center",
      marginBottom: 24,
    },
    mainStatValue: {
      fontSize: 48,
      fontWeight: "900",
      color: t.primary,
    },
    mainStatLabel: {
      fontSize: 16,
      color: t.sub,
      textTransform: "uppercase",
      fontWeight: "bold",
      letterSpacing: 1,
    },
    statsRow: {
      flexDirection: "row",
      justifyContent: "space-around",
      marginBottom: 16,
    },
    statBox: {
      alignItems: "center",
      flex: 1,
    },
    statVal: {
      fontSize: 18,
      fontWeight: "bold",
      color: t.text,
      marginTop: 4,
    },
    statLbl: {
      fontSize: 12,
      color: t.sub,
      marginTop: 2,
    },
    mapContainer: {
      height: 250,
      borderRadius: 16,
      overflow: "hidden",
      marginBottom: 20,
      borderWidth: 1,
      borderColor: t.border,
    },
    map: {
      ...StyleSheet.absoluteFillObject,
    },
    noMapContainer: {
      height: 150,
      borderRadius: 16,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
      borderStyle: "dashed",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 20,
    },
    noMapText: {
      color: t.sub,
      marginTop: 8,
    },
    photoSection: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: t.text,
      marginBottom: 12,
    },
    addPhotoBtn: {
      height: 120,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: t.border,
      borderStyle: "dashed",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: t.card,
    },
    addPhotoText: {
      color: t.sub,
      marginTop: 8,
      fontWeight: "500",
    },
    photoWrapper: {
      position: "relative",
    },
    photo: {
      width: "100%",
      height: 200,
      borderRadius: 12,
    },
    removePhotoBtn: {
      position: "absolute",
      top: -10,
      right: -10,
      backgroundColor: t.bg,
      borderRadius: 14,
    },
    actions: {
      marginTop: 8,
    },
    btnSave: {
      backgroundColor: t.primary,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: "center",
      marginBottom: 12,
    },
    btnSaveText: {
      color: t.onPrimary,
      fontSize: 16,
      fontWeight: "bold",
    },
    btnDiscard: {
      paddingVertical: 12,
      alignItems: "center",
    },
    btnDiscardText: {
      color: "#ef4444",
      fontSize: 16,
      fontWeight: "bold",
    },
    btnPrimary: {
      backgroundColor: t.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    btnPrimaryText: {
      color: t.onPrimary,
      fontWeight: "bold",
    },
  });
