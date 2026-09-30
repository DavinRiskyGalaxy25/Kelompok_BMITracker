/**
 * TrackerMap — peta Leaflet + OpenStreetMap/Esri (tanpa API key Google).
 *
 * Beda dengan versi lama: HTML peta dibuat SEKALI. Titik rute baru dikirim lewat
 * injectJavaScript (addPoints), jadi WebView tidak dimuat ulang setiap titik GPS.
 * Akibatnya tidak ada kedip, zoom/geser pengguna tidak di-reset, dan tile tidak diunduh ulang.
 *
 * Props:
 *  - theme
 *  - route            [{latitude, longitude}] rute yang digambar
 *  - mapType          'standard' | 'satellite'
 *  - onToggleMapType  callback tombol sakelar (Satelit / Default)
 *  - center           {latitude, longitude} pusat awal peta (dipakai saat rute masih kosong)
 *  - finished         true = rute final (peta dipas ke seluruh rute)
 *  - height           tinggi peta (default 260); null bila tinggi diatur lewat `style`
 *  - style            style tambahan untuk pembungkus
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import Ionicons from '@expo/vector-icons/Ionicons';

// Kebijakan tile OpenStreetMap dan lisensi Esri mewajibkan atribusi. Ubah ke false hanya
// bila atribusi ditampilkan di tempat lain di aplikasi.
const SHOW_ATTRIBUTION = true;

const TILES = {
  standard: 'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
};

const ATTRIBUTIONS = {
  standard: '© OpenStreetMap',
  satellite: 'Esri, Maxar, Earthstar Geographics',
};

const toLatLng = (p) => [p.latitude, p.longitude];

const buildMapHtml = ({ mapType, center, colors }) => {
  // Hanya konstanta tema dan angka yang masuk ke HTML. "<" di-escape agar aman di dalam <script>.
  const config = JSON.stringify({
    tileUrl: TILES[mapType] || TILES.standard,
    attribution: ATTRIBUTIONS[mapType] || ATTRIBUTIONS.standard,
    showAttribution: SHOW_ATTRIBUTION,
    center: [Number(center.latitude), Number(center.longitude)],
    primary: colors.primary,
    danger: colors.danger,
  }).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
      html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; background: ${colors.bg}; }
      .leaflet-control-attribution { font-size: 10px; opacity: 0.85; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      (function () {
        if (!window.L) return;
        var cfg = ${config};

        var map = L.map('map', { zoomControl: false, attributionControl: cfg.showAttribution });
        if (cfg.showAttribution) map.attributionControl.setPrefix(false);
        map.setView(cfg.center, 16);

        L.tileLayer(cfg.tileUrl, { maxZoom: 19, attribution: cfg.attribution }).addTo(map);

        var line = L.polyline([], {
          color: cfg.primary, weight: 5, lineJoin: 'round', lineCap: 'round', smoothFactor: 2
        }).addTo(map);
        var startMarker = null;
        var endMarker = null;

        function dot(latlng, color, radius) {
          return L.circleMarker(latlng, {
            radius: radius, color: color, fillColor: color, fillOpacity: 1
          }).addTo(map);
        }

        function syncMarkers(coords) {
          if (coords.length === 0) {
            if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
            if (endMarker) { map.removeLayer(endMarker); endMarker = null; }
            return;
          }
          var first = coords[0];
          var last = coords[coords.length - 1];
          if (startMarker) startMarker.setLatLng(first); else startMarker = dot(first, cfg.primary, 6);
          if (coords.length > 1) {
            if (endMarker) endMarker.setLatLng(last); else endMarker = dot(last, cfg.danger, 7);
          } else if (endMarker) {
            map.removeLayer(endMarker); endMarker = null;
          }
        }

        window.vitra = {
          // Ganti seluruh rute. fit=true memas peta ke seluruh rute (saat aktivitas selesai).
          setRoute: function (coords, fit) {
            line.setLatLngs(coords);
            syncMarkers(coords);
            if (coords.length === 0) return;
            if (fit && coords.length > 1) {
              map.fitBounds(line.getBounds(), { padding: [30, 30], maxZoom: 18 });
            } else {
              map.setView(coords[coords.length - 1], Math.max(map.getZoom(), 16));
            }
          },
          // Tambah titik baru. Peta hanya bergeser bila posisi keluar dari area tengah,
          // jadi zoom dan geseran manual pengguna tidak dipaksa kembali setiap detik.
          addPoints: function (coords) {
            for (var i = 0; i < coords.length; i++) line.addLatLng(coords[i]);
            var all = line.getLatLngs();
            syncMarkers(all);
            var last = all[all.length - 1];
            if (last && !map.getBounds().pad(-0.25).contains(last)) map.panTo(last);
          },
          setCenter: function (lat, lng) {
            if (line.getLatLngs().length === 0) map.setView([lat, lng], 16);
          }
        };
      })();
    </script>
  </body>
</html>`;
};

export default function TrackerMap({
  theme: t,
  route,
  mapType,
  onToggleMapType,
  center,
  finished = false,
  height = 260,
  style,
}) {
  const s = useMemo(() => createStyles(t), [t]);

  const webRef = useRef(null);
  const [ready, setReady] = useState(false);
  const sentRef = useRef(0); // jumlah titik rute yang sudah dikirim ke peta
  const modeRef = useRef(null); // 'live' | 'final'
  const initialCenterRef = useRef(center);

  // HTML hanya berubah bila jenis peta atau warna tema berubah (bukan karena titik GPS).
  const html = useMemo(
    () =>
      buildMapHtml({
        mapType,
        center: initialCenterRef.current,
        colors: { primary: t.primary, danger: t.danger, bg: t.input },
      }),
    [mapType, t.primary, t.danger, t.input]
  );

  const run = useCallback((js) => {
    webRef.current?.injectJavaScript(`${js};true;`);
  }, []);

  // Halaman dimuat ulang -> tandai belum siap dan kirim ulang seluruh rute setelah selesai dimuat.
  useEffect(() => {
    setReady(false);
    sentRef.current = 0;
    modeRef.current = null;
  }, [html]);

  // Sinkronisasi rute: kirim titik baru saja (inkremental), atau seluruh rute bila perlu.
  useEffect(() => {
    if (!ready) return;

    const mode = finished ? 'final' : 'live';
    const sent = sentRef.current;

    // Rute final selalu mengganti seluruh garis (rute tampilan berbeda dari rute langsung).
    if (finished || mode !== modeRef.current || route.length < sent || sent === 0) {
      run(`window.vitra&&window.vitra.setRoute(${JSON.stringify(route.map(toLatLng))},${finished})`);
    } else if (route.length > sent) {
      run(`window.vitra&&window.vitra.addPoints(${JSON.stringify(route.slice(sent).map(toLatLng))})`);
    }

    modeRef.current = mode;
    sentRef.current = route.length;
  }, [ready, route, finished, run]);

  // Pusatkan peta ke posisi pengguna selama belum ada rute.
  useEffect(() => {
    if (!ready || route.length > 0 || !center) return;
    run(`window.vitra&&window.vitra.setCenter(${Number(center.latitude)},${Number(center.longitude)})`);
  }, [ready, route.length, center?.latitude, center?.longitude, run]);

  return (
    <View style={[s.mapWrap, height != null && { height }, style]}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        style={s.map}
        scrollEnabled={false}
        nestedScrollEnabled
        javaScriptEnabled
        onLoadEnd={() => setReady(true)}
      />

      {/* Sakelar tampilan peta (Standard vs Satelit) */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={s.mapTypeToggle}
        onPress={onToggleMapType}
        accessibilityRole="button"
        accessibilityLabel={mapType === 'standard' ? 'Tampilkan peta satelit' : 'Tampilkan peta standar'}
      >
        <Ionicons name={mapType === 'standard' ? 'globe-outline' : 'map-outline'} size={16} color={t.text} />
        <Text style={s.mapTypeToggleText}>{mapType === 'standard' ? 'Satelit' : 'Default'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (t) =>
  StyleSheet.create({
    mapWrap: {
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: t.input,
      position: 'relative',
    },
    map: { flex: 1, backgroundColor: t.input },

    mapTypeToggle: {
      position: 'absolute',
      top: 10,
      right: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: t.card,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 0,
      borderColor: t.border,
      elevation: 3,
      shadowColor: t.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
    },
    mapTypeToggleText: { fontSize: 12, fontWeight: '700', color: t.text },
  });