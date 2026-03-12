import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { COLORS } from "@/constants/theme";

export default function TabLayout() {
  const isIOS = Platform.OS === "ios";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: "rgba(255,255,255,0.30)",
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : COLORS.tabBar,
          borderTopWidth: 1,
          borderTopColor: COLORS.tabBarBorder,
          elevation: 0,
          height: Platform.OS === "android" ? 62 : 56,
          paddingBottom: Platform.OS === "android" ? 8 : 0,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: "Inter_500Medium",
          marginTop: -1,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={90}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.tabBar, borderTopWidth: 1, borderTopColor: COLORS.tabBarBorder }]} />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <View style={{ alignItems: 'center' }}>
              {focused && <View style={{ position: 'absolute', top: -4, width: 20, height: 2, backgroundColor: COLORS.accent, borderRadius: 1 }} />}
              <Feather name="trending-up" size={size - 2} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="charts"
        options={{
          title: "Charts",
          tabBarIcon: ({ color, size, focused }) => (
            <View style={{ alignItems: 'center' }}>
              {focused && <View style={{ position: 'absolute', top: -4, width: 20, height: 2, backgroundColor: COLORS.accent, borderRadius: 1 }} />}
              <Feather name="activity" size={size - 2} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="signals"
        options={{
          title: "Signals",
          tabBarIcon: ({ color, size, focused }) => (
            <View style={{ alignItems: 'center' }}>
              {focused && <View style={{ position: 'absolute', top: -4, width: 20, height: 2, backgroundColor: COLORS.accent, borderRadius: 1 }} />}
              <Feather name="zap" size={size - 2} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: "Portfolio",
          tabBarIcon: ({ color, size, focused }) => (
            <View style={{ alignItems: 'center' }}>
              {focused && <View style={{ position: 'absolute', top: -4, width: 20, height: 2, backgroundColor: COLORS.accent, borderRadius: 1 }} />}
              <Feather name="briefcase" size={size - 2} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size, focused }) => (
            <View style={{ alignItems: 'center' }}>
              {focused && <View style={{ position: 'absolute', top: -4, width: 20, height: 2, backgroundColor: COLORS.accent, borderRadius: 1 }} />}
              <Feather name="sliders" size={size - 2} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
