import React from 'react';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';
import { formatDuration } from '../utils/format';

export default function RunSummaryOverlay({ run, theme, fullscreen = false }) {
  if (!run) return null;

  const photoUrl = run.photo;
  const distance = (Number(run.km) || 0).toFixed(2);
  const pace = run.pace || '--:--';
  const time = formatDuration(run.durationSec || run.duration || 0);
  const steps = run.steps || 0;
  const calories = Math.round(run.calories || 0);

  // Use the image if available, otherwise just use a dark neutral background
  const bgSource = photoUrl ? { uri: photoUrl } : null;
  const fallbackBgColor = '#1a1a1a'; // Neutral dark background if no photo

  return (
    <View style={[s.container, fullscreen ? s.fullscreen : s.cardMode, { backgroundColor: fallbackBgColor }]}>
      <ImageBackground 
        source={bgSource} 
        style={s.bgImage}
        imageStyle={{ opacity: photoUrl ? 0.8 : 0 }} 
      >
        <View style={s.overlay}>
          {/* Metrics Stack */}
          <View style={s.metricsContainer}>
            {/* Jarak */}
            <View style={s.metricBlock}>
              <Text style={s.metricLabel}>Jarak</Text>
              <Text style={s.metricValueLarge}>{distance} <Text style={s.metricUnitLarge}>km</Text></Text>
            </View>

            {/* Durasi & Pace (Row) */}
            <View style={s.row}>
              <View style={s.metricBlockHalf}>
                <Text style={s.metricLabel}>Durasi</Text>
                <Text style={s.metricValue}>{time}</Text>
              </View>
              <View style={s.metricBlockHalf}>
                <Text style={s.metricLabel}>Pace</Text>
                <Text style={s.metricValue}>{pace} <Text style={s.metricUnit}>/km</Text></Text>
              </View>
            </View>

            {/* Langkah & Kalori (Row) */}
            <View style={s.row}>
              <View style={s.metricBlockHalf}>
                <Text style={s.metricLabel}>Langkah</Text>
                <Text style={s.metricValue}>{steps}</Text>
              </View>
              <View style={s.metricBlockHalf}>
                <Text style={s.metricLabel}>Kalori</Text>
                <Text style={s.metricValue}>{calories} <Text style={s.metricUnit}>kkal</Text></Text>
              </View>
            </View>
          </View>

          {/* Watermark */}
          <View style={s.watermarkContainer}>
            <Text style={s.watermark}>VITASTRIDE</Text>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
  cardMode: {
    aspectRatio: 0.65, // Tall portrait aspect ratio like Strava
  },
  fullscreen: {
    flex: 1,
  },
  bgImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)', // Slight dimming to make white text pop
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricsContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  metricBlock: {
    alignItems: 'center',
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    marginBottom: 24,
  },
  metricBlockHalf: {
    alignItems: 'center',
    width: '45%',
  },
  metricLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  metricValueLarge: {
    color: '#ffffff',
    fontSize: 48,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  metricUnitLarge: {
    fontSize: 24,
    fontWeight: '700',
  },
  metricValue: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  metricUnit: {
    fontSize: 16,
    fontWeight: '700',
  },
  watermarkContainer: {
    position: 'absolute',
    bottom: 16,
  },
  watermark: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
