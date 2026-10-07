import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useStopwatch } from "../contexts/StopwatchContext";

export default function StopwatchScreen({ theme: t }) {
  const insets = useSafeAreaInsets();
  const { isRunning, time, laps, handleStartPause, handleReset, handleLap } = useStopwatch();

  const formatStopwatch = (ms) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const centis = Math.floor((ms % 1000) / 10);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
  };

  const s = useMemo(() => createStyles(t, insets), [t, insets]);

  const controlBgColor = t.isDark ? "#222222" : "#E5E5EA";
  const controlIconColor = t.primary;

  return (
    <View style={s.safe}>
      <StatusBar
        barStyle={t.isDark ? "light-content" : "dark-content"}
        backgroundColor={t.bg}
      />

      <View style={s.container}>
        {/* TAMPILAN WAKTU */}
        <View
          style={[
            s.displayWrap,
            laps.length > 0 ? s.displayWrapWithLaps : s.displayWrapCentered,
          ]}
        >
          <Text style={[s.timeText, { color: t.text }]}>
            {formatStopwatch(time)}
          </Text>
        </View>

        {/* DAFTAR PUTARAN (LAPS) */}
        {laps.length > 0 && (
          <View style={s.lapsContainer}>
            <FlatList
              data={laps}
              keyExtractor={(item) => String(item.id)}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item }) => (
                <View style={s.lapItemRow}>
                  <Text style={[s.lapIndex, { color: t.sub }]}>
                    {String(item.id).padStart(2, "0")}
                  </Text>
                  <Text style={[s.lapSplit, { color: t.sub }]}>
                    + {formatStopwatch(item.splitTime)}
                  </Text>
                  <Text style={[s.lapTotal, { color: t.text }]}>
                    {formatStopwatch(item.time)}
                  </Text>
                </View>
              )}
            />
          </View>
        )}

        {/* KONTROL TOMBOL UTAMA DI BAWAH */}
        <View style={[s.controlsContainer, time === 0 && !isRunning && s.controlsContainerCentered]}>
          {time === 0 && !isRunning ? (
            /* Oval Play Button */
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleStartPause}
              style={[s.pillBtn, { backgroundColor: controlBgColor }]}
            >
              <Ionicons
                name="play"
                size={28}
                color={controlIconColor}
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>
          ) : (
            <>
              {/* Left Button (Lap / Reset) */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={isRunning ? handleLap : handleReset}
                style={[s.circleBtn, { backgroundColor: controlBgColor }]}
              >
                {isRunning ? (
                  <Ionicons
                    name="play-skip-forward"
                    size={24}
                    color={controlIconColor}
                  />
                ) : (
                  <Ionicons name="refresh" size={26} color={controlIconColor} />
                )}
              </TouchableOpacity>

              {/* Right Button (Start / Pause) */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleStartPause}
                style={[s.circleBtn, { backgroundColor: controlBgColor }]}
              >
                {isRunning ? (
                  <Ionicons name="pause" size={24} color={controlIconColor} />
                ) : (
                  <Ionicons
                    name="play"
                    size={24}
                    color={controlIconColor}
                    style={{ marginLeft: 4 }}
                  />
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const createStyles = (t, insets) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: t.bg,
      paddingTop: insets.top,
    },
    container: {
      flex: 1,
      paddingHorizontal: 20,
    },
    displayWrap: {
      alignItems: "center",
      justifyContent: "center",
    },
    displayWrapCentered: {
      flex: 1,
      paddingBottom: 80,
    },
    displayWrapWithLaps: {
      paddingTop: 60,
      paddingBottom: 30,
    },
    timeText: {
      fontSize: 68,
      fontWeight: "300",
      fontVariant: ["tabular-nums"],
    },
    lapsContainer: {
      flex: 1,
      marginTop: 10,
    },
    lapItemRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 14,
    },
    lapIndex: {
      fontSize: 16,
      width: 40,
    },
    lapSplit: {
      fontSize: 16,
      flex: 1,
      textAlign: "center",
    },
    lapTotal: {
      fontSize: 16,
      width: 90,
      textAlign: "right",
      fontVariant: ["tabular-nums"],
      fontWeight: "500",
    },
    controlsContainer: {
      height: 72,
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "center",
      marginBottom: 40,
      marginTop: 10,
    },
    controlsContainerCentered: {
      justifyContent: "center",
    },
    pillBtn: {
      width: 140,
      height: 64,
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    circleBtn: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: "center",
      justifyContent: "center",
    },
  });
