import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, FlatList, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { COLORS, FONTS, RADIUS } from '@/constants/theme';
import { api, type Signal } from '@/lib/api';

interface MarketIndex { name: string; value: number; change: number; changePct: number; token: string; exchange: string }
const INDICES: MarketIndex[] = [
  { name: 'NIFTY 50', value: 0, change: 0, changePct: 0, token: '26000', exchange: 'NSE' },
  { name: 'SENSEX', value: 0, change: 0, changePct: 0, token: '1', exchange: 'BSE' },
  { name: 'BANK NIFTY', value: 0, change: 0, changePct: 0, token: '26009', exchange: 'NSE' },
];

function isMarketOpen() {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  const h = now.getHours(), m = now.getMinutes();
  const mins = h * 60 + m;
  return mins >= 9 * 60 + 15 && mins < 15 * 60 + 30;
}

function PulseView() {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.4, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [scale]);
  return <Animated.View style={[styles.pulse, { transform: [{ scale }] }]} />;
}

function IndexCard({ idx }: { idx: MarketIndex }) {
  const up = idx.changePct >= 0;
  return (
    <View style={styles.indexCard}>
      <Text style={styles.indexName}>{idx.name}</Text>
      <Text style={styles.indexValue}>
        {idx.value > 0 ? idx.value.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}
      </Text>
      <View style={[styles.changeRow, { backgroundColor: up ? COLORS.accentDim : COLORS.redDim }]}>
        <Feather name={up ? 'arrow-up-right' : 'arrow-down-right'} size={11}
          color={up ? COLORS.accent : COLORS.red} />
        <Text style={[styles.changeText, { color: up ? COLORS.accent : COLORS.red }]}>
          {idx.change > 0 ? '+' : ''}{idx.change.toFixed(2)} ({up ? '+' : ''}{idx.changePct.toFixed(2)}%)
        </Text>
      </View>
    </View>
  );
}

function SignalRow({ item }: { item: Signal }) {
  const up = item.signal === 'STRONG_BUY' || item.signal === 'BUY';
  const color = up ? COLORS.accent : item.signal === 'NEUTRAL' ? COLORS.textSub : COLORS.red;
  return (
    <View style={styles.signalRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.signalSymbol}>{item.symbol}</Text>
        <Text style={styles.signalMeta}>{item.indicators.slice(0, 2).join(' · ')}</Text>
      </View>
      <View style={styles.signalRight}>
        <View style={[styles.signalBadge, { backgroundColor: up ? COLORS.accentDim : item.signal === 'NEUTRAL' ? 'rgba(255,255,255,0.07)' : COLORS.redDim }]}>
          <Text style={[styles.signalBadgeText, { color }]}>{item.signal.replace('_', ' ')}</Text>
        </View>
        <Text style={[styles.scoreText, { color }]}>{item.score}</Text>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { session, connectBroker, isConnecting } = useApp();
  const [indices, setIndices] = useState<MarketIndex[]>(INDICES);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(false);
  const open = isMarketOpen();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [sigs] = await Promise.allSettled([api.getSignals()]);
      if (sigs.status === 'fulfilled' && sigs.value.data) {
        setSignals(sigs.value.data.slice(0, 5));
      }
      if (session?.jwtToken) {
        try {
          const q = await api.getQuote(session.jwtToken, 'FULL', {
            NSE: ['26000', '26009'],
            BSE: ['1'],
          });
          if (q.status && q.data?.fetched) {
            setIndices(prev => prev.map(idx => {
              const f = q.data.fetched.find((d) => d.tradingsymbol?.includes(idx.name.replace(' ', '')));
              return f ? { ...idx, value: f.ltp, change: f.change, changePct: f.percentchange } : idx;
            }));
          }
        } catch { /* ignore */ }
      }
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>TradeSignal Pro</Text>
          <View style={styles.marketStatus}>
            {open ? <PulseView /> : <View style={[styles.pulse, { backgroundColor: COLORS.red }]} />}
            <Text style={[styles.marketText, { color: open ? COLORS.accent : COLORS.red }]}>
              Market {open ? 'Open' : 'Closed'}
            </Text>
            {session && <Text style={styles.traderName}> · {session.clientName}</Text>}
          </View>
        </View>
        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); refresh(); }}>
          <View style={styles.iconBtn}>
            <Feather name="refresh-cw" size={18} color={COLORS.textSub} />
          </View>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 72 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={COLORS.accent} />}
      >
        {/* Market Indices */}
        <Text style={styles.sectionLabel}>MARKET INDICES</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.indexRow}>
          {indices.map(idx => <IndexCard key={idx.name} idx={idx} />)}
        </ScrollView>

        {/* Connect Banner */}
        {!session && (
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); connectBroker(); }}
            style={({ pressed }) => [styles.connectBanner, { opacity: pressed ? 0.8 : 1 }]}
          >
            <View style={styles.connectIcon}>
              <Feather name="link" size={20} color={COLORS.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.connectTitle}>Connect Angel One</Text>
              <Text style={styles.connectSub}>Tap to auto-login and see live data</Text>
            </View>
            {isConnecting
              ? <Feather name="loader" size={18} color={COLORS.textSub} />
              : <Feather name="chevron-right" size={18} color={COLORS.textSub} />
            }
          </Pressable>
        )}

        {/* Quick Stats */}
        <Text style={styles.sectionLabel}>SESSION STATS</Text>
        <View style={styles.statsRow}>
          {[
            { label: 'Signals Today', value: signals.length, icon: 'zap', color: COLORS.accent },
            { label: 'Buy Signals', value: signals.filter(s => s.signal.includes('BUY')).length, icon: 'arrow-up', color: COLORS.accent },
            { label: 'Sell Signals', value: signals.filter(s => s.signal.includes('SELL')).length, icon: 'arrow-down', color: COLORS.red },
            { label: 'Neutral', value: signals.filter(s => s.signal === 'NEUTRAL').length, icon: 'minus', color: COLORS.textSub },
          ].map(stat => (
            <View key={stat.label} style={styles.statCard}>
              <Feather name={stat.icon as 'zap'} size={16} color={stat.color} />
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Top Signals */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>TOP SIGNALS</Text>
        </View>
        <View style={styles.signalList}>
          {signals.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="zap-off" size={32} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No signals yet. Tap refresh to scan.</Text>
            </View>
          ) : (
            signals.map((s, i) => <SignalRow key={i} item={s} />)
          )}
        </View>

        {/* Market Timings */}
        <Text style={styles.sectionLabel}>MARKET TIMINGS</Text>
        <View style={styles.timingsCard}>
          {[
            { label: 'Pre-Open', time: '09:00 – 09:15', active: false },
            { label: 'Normal', time: '09:15 – 15:30', active: open },
            { label: 'Closing', time: '15:30 – 16:00', active: false },
            { label: 'After Hours', time: '16:00 – 09:00', active: !open },
          ].map((t, i) => (
            <View key={i} style={[styles.timingRow, i < 3 && { borderBottomWidth: 1, borderBottomColor: COLORS.divider }]}>
              <View style={[styles.timingDot, { backgroundColor: t.active ? COLORS.accent : COLORS.divider }]} />
              <Text style={[styles.timingLabel, t.active && { color: COLORS.text }]}>{t.label}</Text>
              <Text style={[styles.timingTime, t.active && { color: COLORS.accent }]}>{t.time}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  greeting: { fontSize: 22, fontFamily: FONTS.bold, color: COLORS.text },
  marketStatus: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 6 },
  pulse: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.accent },
  marketText: { fontSize: 12, fontFamily: FONTS.medium },
  traderName: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textMuted },
  iconBtn: {
    width: 38, height: 38, borderRadius: RADIUS.md, backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  sectionLabel: {
    fontSize: 10, fontFamily: FONTS.bold, color: COLORS.textMuted,
    letterSpacing: 1.2, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 20 },
  indexRow: { paddingHorizontal: 20, gap: 10, paddingBottom: 4 },
  indexCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    padding: 14, minWidth: 140, borderWidth: 1, borderColor: COLORS.cardBorder, gap: 4,
  },
  indexName: { fontSize: 10, fontFamily: FONTS.semibold, color: COLORS.textSub, letterSpacing: 0.5 },
  indexValue: { fontSize: 18, fontFamily: FONTS.bold, color: COLORS.text },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  changeText: { fontSize: 11, fontFamily: FONTS.medium },
  connectBanner: {
    marginHorizontal: 20, marginTop: 4, backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.accentDim,
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  connectIcon: {
    width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: COLORS.accentDim2,
    alignItems: 'center', justifyContent: 'center',
  },
  connectTitle: { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.text },
  connectSub: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textSub, marginTop: 2 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10 },
  statCard: {
    flex: 1, backgroundColor: COLORS.card, borderRadius: RADIUS.md,
    padding: 12, borderWidth: 1, borderColor: COLORS.cardBorder, alignItems: 'center', gap: 4,
  },
  statValue: { fontSize: 22, fontFamily: FONTS.bold },
  statLabel: { fontSize: 9, fontFamily: FONTS.regular, color: COLORS.textMuted, textAlign: 'center' },
  signalList: {
    marginHorizontal: 20, backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, overflow: 'hidden',
  },
  signalRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.divider,
  },
  signalSymbol: { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.text },
  signalMeta: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textMuted, marginTop: 2 },
  signalRight: { alignItems: 'flex-end', gap: 4 },
  signalBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  signalBadgeText: { fontSize: 9, fontFamily: FONTS.bold, letterSpacing: 0.5 },
  scoreText: { fontSize: 12, fontFamily: FONTS.bold },
  emptyState: { padding: 32, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textMuted, textAlign: 'center' },
  timingsCard: {
    marginHorizontal: 20, backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, overflow: 'hidden',
  },
  timingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  timingDot: { width: 8, height: 8, borderRadius: 4 },
  timingLabel: { flex: 1, fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textSub },
  timingTime: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textMuted },
});
