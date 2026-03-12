import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SignalBadge } from '@/components/SignalBadge';
import { useApp } from '@/context/AppContext';
import { COLORS, FONTS, RADIUS } from '@/constants/theme';
import { api, type Signal } from '@/lib/api';

type Filter = 'ALL' | 'BUY' | 'SELL' | 'STRONG_BUY' | 'STRONG_SELL' | 'NEUTRAL';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'STRONG_BUY', label: 'Strong Buy' },
  { key: 'BUY', label: 'Buy' },
  { key: 'NEUTRAL', label: 'Neutral' },
  { key: 'SELL', label: 'Sell' },
  { key: 'STRONG_SELL', label: 'Strong Sell' },
];

function ScoreMeter({ score }: { score: number }) {
  const color = score >= 70 ? COLORS.accent : score <= 30 ? COLORS.red : COLORS.yellow;
  return (
    <View style={styles.meterWrap}>
      <View style={styles.meterBg}>
        <View style={[styles.meterFill, { width: `${score}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.meterScore, { color }]}>{score}</Text>
    </View>
  );
}

function SignalCard({ item }: { item: Signal }) {
  const up = item.signal === 'STRONG_BUY' || item.signal === 'BUY';
  const down = item.signal === 'STRONG_SELL' || item.signal === 'SELL';
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable
      onPress={() => { setExpanded(!expanded); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.cardTop}>
        <View style={[styles.signalAccent, {
          backgroundColor: up ? COLORS.accentDim : down ? COLORS.redDim : 'rgba(255,255,255,0.05)',
        }]}>
          <Feather
            name={up ? 'trending-up' : down ? 'trending-down' : 'minus'}
            size={16}
            color={up ? COLORS.accent : down ? COLORS.red : COLORS.textSub}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardSymbol}>{item.symbol}</Text>
          <Text style={styles.cardExch}>{item.exchange}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <SignalBadge signal={item.signal} size="sm" />
          {item.ltp != null && (
            <Text style={styles.cardLtp}>₹{item.ltp.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
          )}
        </View>
      </View>

      <ScoreMeter score={item.score} />

      {expanded && (
        <View style={styles.indicatorsWrap}>
          {(item.ltp != null || item.target1 != null || item.stopLoss != null) && (
            <View style={styles.tradePlan}>
              <Text style={styles.tradePlanLabel}>TRADE PLAN</Text>
              <View style={styles.tradePlanRow}>
                {item.ltp != null && (
                  <View style={styles.tradePlanItem}>
                    <Text style={styles.tpLabel}>Entry</Text>
                    <Text style={styles.tpVal}>₹{item.ltp.toFixed(2)}</Text>
                  </View>
                )}
                {item.target1 != null && (
                  <View style={[styles.tradePlanItem, { borderLeftWidth: 1, borderLeftColor: COLORS.divider }]}>
                    <Text style={styles.tpLabel}>Target</Text>
                    <Text style={[styles.tpVal, { color: COLORS.accent }]}>₹{item.target1.toFixed(2)}</Text>
                  </View>
                )}
                {item.stopLoss != null && (
                  <View style={[styles.tradePlanItem, { borderLeftWidth: 1, borderLeftColor: COLORS.divider }]}>
                    <Text style={styles.tpLabel}>Stop Loss</Text>
                    <Text style={[styles.tpVal, { color: COLORS.red }]}>₹{item.stopLoss.toFixed(2)}</Text>
                  </View>
                )}
                {item.riskReward != null && (
                  <View style={[styles.tradePlanItem, { borderLeftWidth: 1, borderLeftColor: COLORS.divider }]}>
                    <Text style={styles.tpLabel}>R:R</Text>
                    <Text style={[styles.tpVal, { color: COLORS.yellow }]}>1:{item.riskReward.toFixed(1)}</Text>
                  </View>
                )}
              </View>
            </View>
          )}
          {item.indicators.length > 0 && (
            <>
              <Text style={styles.indicatorsLabel}>SIGNAL REASONS</Text>
              <View style={styles.indicatorChips}>
                {item.indicators.slice(0, 6).map((ind, i) => (
                  <View key={i} style={styles.indChip}>
                    <Text style={styles.indChipText}>{ind}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
          {item.rsi != null && (
            <View style={styles.extraRow}>
              <View style={styles.extraItem}>
                <Text style={styles.extraLabel}>RSI</Text>
                <Text style={[styles.extraVal, {
                  color: item.rsi < 35 ? COLORS.accent : item.rsi > 65 ? COLORS.red : COLORS.textSub
                }]}>{item.rsi.toFixed(1)}</Text>
              </View>
            </View>
          )}
        </View>
      )}

      <View style={styles.cardFooter}>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.textMuted} />
      </View>
    </Pressable>
  );
}

export default function SignalsScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useApp();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [filter, setFilter] = useState<Filter>('ALL');

  const runScan = useCallback(async () => {
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await api.getSignals();
      if (res.success && res.data) setSignals(res.data);
      setScanned(true);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  const filtered = signals.filter(s => filter === 'ALL' || s.signal === filter);
  const buys = signals.filter(s => s.signal.includes('BUY')).length;
  const sells = signals.filter(s => s.signal.includes('SELL')).length;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Signals</Text>
        {scanned && (
          <View style={styles.summaryBadges}>
            <View style={[styles.summBadge, { backgroundColor: COLORS.accentDim }]}>
              <Text style={[styles.summText, { color: COLORS.accent }]}>{buys} Buy</Text>
            </View>
            <View style={[styles.summBadge, { backgroundColor: COLORS.redDim }]}>
              <Text style={[styles.summText, { color: COLORS.red }]}>{sells} Sell</Text>
            </View>
          </View>
        )}
      </View>

      {/* Scan Button */}
      <Pressable
        onPress={runScan}
        disabled={loading}
        style={({ pressed }) => [styles.scanBtn, pressed && { opacity: 0.8 }]}
      >
        {loading ? (
          <ActivityIndicator color="#000" size="small" />
        ) : (
          <Feather name="zap" size={18} color="#000" />
        )}
        <Text style={styles.scanText}>{loading ? 'Scanning Market...' : 'Run Market Scan'}</Text>
      </Pressable>

      {/* Filters */}
      {scanned && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          {FILTERS.map(f => (
            <Pressable key={f.key} onPress={() => { setFilter(f.key); Haptics.selectionAsync(); }}
              style={[styles.filterChip, filter === f.key && styles.filterChipActive]}>
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Results */}
      {!scanned ? (
        <View style={styles.emptyState}>
          <Feather name="search" size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>Scanner Ready</Text>
          <Text style={styles.emptySub}>
            Tap "Run Market Scan" to analyze stocks using{'\n'}25+ technical indicators and 10 strategies
          </Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="filter" size={32} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>No results</Text>
          <Text style={styles.emptySub}>No signals match this filter</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, i) => `${item.symbol}-${i}`}
          renderItem={({ item }) => <SignalCard item={item} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 80, paddingTop: 4 }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={runScan} tintColor={COLORS.accent} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  title: { fontSize: 22, fontFamily: FONTS.bold, color: COLORS.text },
  summaryBadges: { flexDirection: 'row', gap: 6 },
  summBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full },
  summText: { fontSize: 11, fontFamily: FONTS.semibold },
  scanBtn: {
    marginHorizontal: 16, marginBottom: 12, backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  scanText: { fontSize: 15, fontFamily: FONTS.semibold, color: '#000' },
  filtersRow: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.cardBorder },
  filterChipActive: { backgroundColor: COLORS.accentDim, borderColor: COLORS.accent },
  filterText: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textSub },
  filterTextActive: { color: COLORS.accent },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontFamily: FONTS.semibold, color: COLORS.textSub },
  emptySub: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  card: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.cardBorder, padding: 14, gap: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  signalAccent: { width: 36, height: 36, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  cardSymbol: { fontSize: 15, fontFamily: FONTS.semibold, color: COLORS.text },
  cardExch: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textMuted },
  cardLtp: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textSub },
  meterWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meterBg: { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 2 },
  meterScore: { fontSize: 12, fontFamily: FONTS.bold, minWidth: 24, textAlign: 'right' },
  indicatorsWrap: { paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.divider, gap: 8 },
  indicatorsLabel: { fontSize: 9, fontFamily: FONTS.bold, color: COLORS.textMuted, letterSpacing: 1 },
  indicatorChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  indChip: { backgroundColor: COLORS.accentDim, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  indChipText: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.accent },
  extraRow: { flexDirection: 'row', gap: 16 },
  extraItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  extraLabel: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textMuted },
  extraVal: { fontSize: 12, fontFamily: FONTS.semibold },
  cardFooter: { alignItems: 'center' },
  tradePlan: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: RADIUS.sm, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.divider },
  tradePlanLabel: { fontSize: 9, fontFamily: FONTS.bold, color: COLORS.textMuted, letterSpacing: 1, padding: 8, paddingBottom: 4 },
  tradePlanRow: { flexDirection: 'row' },
  tradePlanItem: { flex: 1, padding: 8, alignItems: 'center' },
  tpLabel: { fontSize: 9, fontFamily: FONTS.regular, color: COLORS.textMuted },
  tpVal: { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.text, marginTop: 2 },
});
