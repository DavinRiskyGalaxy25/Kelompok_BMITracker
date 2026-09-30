// components/BottomNavBar.js
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

const TABS = [
  { key: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { key: 'stopwatch', label: 'Stopwatch', icon: 'stopwatch-outline', activeIcon: 'stopwatch' },
  { key: 'record', label: 'Record', icon: 'radio-button-on-outline', activeIcon: 'radio-button-on' },
  { key: 'bmi', label: 'BMI', icon: 'scale-outline', activeIcon: 'scale' },
  { key: 'profile', label: 'Profil', icon: 'person-outline', activeIcon: 'person' },
];

export default function BottomNavBar({ activeScreen, setActiveScreen, theme: t }) {
  return (
    <View style={[styles.navContainer, { backgroundColor: t.card, borderTopColor: t.border }]}>
      {TABS.map((tab) => {
        const isActive = activeScreen === tab.key;
        const iconColor = isActive ? t.primary : t.sub;
        const iconName = isActive ? tab.activeIcon : tab.icon;

        return (
          <TouchableOpacity
            key={tab.key}
            activeOpacity={0.7}
            onPress={() => setActiveScreen(tab.key)}
            style={styles.tabItem}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
          >
            <Ionicons name={iconName} size={22} color={iconColor} />
            <Text
              style={[
                styles.tabLabel,
                {
                  color: iconColor,
                  fontWeight: isActive ? '700' : '500',
                },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  navContainer: {
    height: 60,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 3,
    letterSpacing: -0.2,
  },
});