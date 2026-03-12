import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '@/constants/theme';

type Signal = 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';

const CONFIG: Record<Signal, { label: string; color: string; bg: string }> = {
  STRONG_BUY:  { label: 'STRONG BUY',  color: COLORS.accent, bg: 'rgba(0,230,118,0.15)' },
  BUY:         { label: 'BUY',          color: COLORS.accent, bg: 'rgba(0,230,118,0.10)' },
  NEUTRAL:     { label: 'NEUTRAL',      color: COLORS.textSub, bg: 'rgba(255,255,255,0.07)' },
  SELL:        { label: 'SELL',         color: COLORS.red,    bg: 'rgba(255,69,96,0.10)' },
  STRONG_SELL: { label: 'STRONG SELL',  color: COLORS.red,    bg: 'rgba(255,69,96,0.15)' },
};

export function SignalBadge({ signal, size = 'sm' }: { signal: Signal; size?: 'sm' | 'md' }) {
  const cfg = CONFIG[signal] ?? CONFIG.NEUTRAL;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }, size === 'md' && styles.badgeMd]}>
      <Text style={[styles.text, { color: cfg.color }, size === 'md' && styles.textMd]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  badgeMd: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  text: { fontSize: 9, fontFamily: FONTS.bold ?? FONTS.semibold, letterSpacing: 0.5 },
  textMd: { fontSize: 11 },
});
