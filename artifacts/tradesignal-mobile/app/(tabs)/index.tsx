import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, Pressable, RefreshControl,
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

function PulseDot({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.5, duration: 800, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [scale]);
  return (
    <View style={{ width: 10, height: 10, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, opacity: 0.3, transform: [{ scale }], position: 'absolute' }} />
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
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
  const isBuy = item.signal === 'STRONG_BUY' || item.signal === 'BUY';
  const isSell = item.signal === 'STRONG_SELL' || item.signal === 'SELL';
  const color = isBuy ? COLORS.accent : isSell ? COLORS.red : COLORS.textSub;
  const bg = isBuy ? COLORS.accentDim : isSell ? COLORS.redDim : 'rgba(255,255,255,0.05)';
  return (
    <View style={styles.signalRow}>
      <View style={[styles.signalIcon, { backgroundColor: bg }]}>
        <Feather name={isBuy ? 'arrow-up' : isSell ? 'arrow-down' : 'minus'} size={12} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.signalSymbol}>{item.symbol}</Text>
        <Text style={styles.signalMeta}>{item.indicators.slice(0, 2).join(' · ')}</Text>
      </View>
      <View style={styles.signalRight}>
        <View style={[styles.signalBadge, { backgroundColor: bg }]}>
          <Text style={[styles.signalBadgeText, { color }]}>{item.signal.replace('_', ' ')}</Text>
        </View>
        {item.target1 && <Text style={[styles.targetText, { color: COLORS.textMuted }]}>T1 ₹{item.target1.toFixed(0)}</Text>}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { session, connectBroker, isConnecting, paperMode } = useApp();
  const [indices, setIndices] = useState<MarketIndex[]>(INDICES);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(false);
  const open = isMarketOpen();

  const now = new Date();
  const hours = now.getHours();
  const greeting = hours < 12 ? 'Good Morning' : hours < 17 ? 'Good Afternoon' : 'Good Evening';

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [sigs] = await Promise.allSettled([api.getSignals()]);
      if (sigs.status === 'fulfilled' && sigs.value.data) {
        setSignals(sigs.value.data.slice(0, 6));
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

  const buyCount = signals.filter(s => s.signal.includes('BUY')).length;
  const sellCount = signals.filter(s => s.signal.includes('SELL')).length;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Paper Trading Banner */}
      {paperMode && (
        <View style={styles.paperBanner}>
          <Feather name="activity" size={11} color="#FF4560" />
          <Text style={styles.paperBannerText}>PAPER TRADING ACTIVE</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting}, {session ? session.clientName.split(' ')[0] : 'Trader'} 👋</Text>
          <View style={styles.marketStatus}>
            <PulseDot color={open ? COLORS.accent : COLORS.red} />
            <Text style={[styles.marketText, { color: open ? COLORS.accent : COLORS.red }]}>
              Market {open ? 'Open' : 'Closed'}
            </Text>
          </View>
        </View>
        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); refresh(); }}>
          <View style={styles.iconBtn}>
            <Feather name="refresh-cw" size={17} color={COLORS.textSub} />
          </View>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 72 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={COLORS.accent} />}
      >
        {/* Hero Stats Card */}
        <View style={styles.heroCard}>
          <LinearGradient
            colors={['rgba(0,230,118,0.10)', 'rgba(0,230,118,0.03)', 'transparent']}
            style={styles.heroGradient}
          >
            <View style={styles.heroRow}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{signals.length}</Text>
                <Text style={styles.heroStatLabel}>Total Signals</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStat}>
                <Text style={[styles.heroStatValue, { color: COLORS.accent }]}>{buyCount}</Text>
                <Text style={styles.heroStatLabel}>Buy Signals</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStat}>
                <Text style={[styles.heroStatValue, { color: COLORS.red }]}>{sellCount}</Text>
                <Text style={styles.heroStatLabel}>Sell Signals</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStat}>
                <Text style={[styles.heroStatValue, { color: session ? COLORS.accent : COLORS.textMuted }]}>
                  {session ? 'Live' : 'Paper'}
                </Text>
                <Text style={styles.heroStatLabel}>Mode</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Connect Banner — shown when NOT connected */}
        {!session && (
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); connectBroker(); }}
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }, styles.connectBannerWrap]}
          >
            <LinearGradient
              colors={['rgba(0,230,118,0.12)', 'rgba(0,230,118,0.04)']}
              style={styles.connectBanner}
            >
              <View style={styles.connectIconWrap}>
                <Feather name="wifi" size={20} color={COLORS.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.connectTitle}>Connect Angel One</Text>
                <Text style={styles.connectSub}>Tap to auto-login · credentials pre-configured</Text>
              </View>
              {isConnecting
                ? <Feather name="loader" size={18} color={COLORS.accent} />
                : <Feather name="chevron-right" size={18} color={COLORS.accent} />
              }
            </LinearGradient>
          </Pressable>
        )}

        {/* Market Indices */}
        <Text style={styles.sectionLabel}>MARKET INDICES</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.indexRow}>
          {indices.map(idx => <IndexCard key={idx.name} idx={idx} />)}
        </ScrollView>

        {/* Top Signals */}
        <Text style={styles.sectionLabel}>HOT SIGNALS</Text>
        <View style={styles.signalList}>
          {signals.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="zap-off" size={28} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No signals yet</Text>
              <Text style={styles.emptySubText}>Pull to refresh and scan the market</Text>
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
  paperBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: 'rgba(255,69,96,0.12)', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,69,96,0.15)',
  },
  paperBannerText: { fontSize: 10, fontFamily: FONTS.bold, color: '#FF4560', letterSpacing: 1.5 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  greeting: { fontSize: 18, fontFamily: FONTS.bold, color: COLORS.text },
  marketStatus: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  marketText: { fontSize: 12, fontFamily: FONTS.medium },
  iconBtn: {
    width: 38, height: 38, borderRadius: RADIUS.md, backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  heroCard: { marginHorizontal: 16, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: 'rgba(0,230,118,0.15)', overflow: 'hidden', marginBottom: 4 },
  heroGradient: { padding: 16 },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: { fontSize: 22, fontFamily: FONTS.bold, color: COLORS.text },
  heroStatLabel: { fontSize: 9, fontFamily: FONTS.regular, color: COLORS.textMuted, marginTop: 3, textAlign: 'center' },
  heroDivider: { width: 1, height: 36, backgroundColor: COLORS.divider },
  connectBannerWrap: { marginHorizontal: 16, marginTop: 8, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: 'rgba(0,230,118,0.2)', overflow: 'hidden' },
  connectBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  connectIconWrap: { width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: COLORS.accentDim, alignItems: 'center', justifyContent: 'center' },
  connectTitle: { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.text },
  connectSub: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textSub, marginTop: 2 },
  sectionLabel: {
    fontSize: 10, fontFamily: FONTS.bold, color: COLORS.textMuted,
    letterSpacing: 1.2, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10,
  },
  indexRow: { paddingHorizontal: 20, gap: 10, paddingBottom: 4 },
  indexCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    padding: 14, minWidth: 140, borderWidth: 1, borderColor: COLORS.cardBorder, gap: 4,
  },
  indexName: { fontSize: 10, fontFamily: FONTS.semibold, color: COLORS.textSub, letterSpacing: 0.5 },
  indexValue: { fontSize: 18, fontFamily: FONTS.bold, color: COLORS.text },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  changeText: { fontSize: 11, fontFamily: FONTS.medium },
  signalList: {
    marginHorizontal: 20, backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, overflow: 'hidden',
  },
  signalRow: {
    flexDirection: 'row', alignItems: 'center', padding: 13,
    borderBottomWidth: 1, borderBottomColor: COLORS.divider, gap: 10,
  },
  signalIcon: { width: 30, height: 30, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  signalSymbol: { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.text },
  signalMeta: { fontSize: 10, fontFamily: FONTS.regular, color: COLORS.textMuted, marginTop: 1 },
  signalRight: { alignItems: 'flex-end', gap: 3 },
  signalBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  signalBadgeText: { fontSize: 9, fontFamily: FONTS.bold, letterSpacing: 0.5 },
  targetText: { fontSize: 10, fontFamily: FONTS.regular },
  emptyState: { padding: 32, alignItems: 'center', gap: 6 },
  emptyText: { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.textSub },
  emptySubText: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textMuted },
  timingsCard: {
    marginHorizontal: 20, backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, overflow: 'hidden',
  },
  timingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  timingDot: { width: 8, height: 8, borderRadius: 4 },
  timingLabel: { flex: 1, fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textSub },
  timingTime: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textMuted },
});
