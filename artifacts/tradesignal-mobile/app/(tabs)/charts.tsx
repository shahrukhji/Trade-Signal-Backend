import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Dimensions, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CandlestickChart } from '@/components/CandlestickChart';
import { useApp } from '@/context/AppContext';
import { COLORS, FONTS, RADIUS } from '@/constants/theme';
import { api } from '@/lib/api';
import { EMA, BollingerBands, RSI } from '@/lib/indicators';

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_H = 260;
const RSI_H = 80;

interface Candle { time: number; open: number; high: number; low: number; close: number; volume: number }
interface SearchResult { tradingsymbol: string; symboltoken: string; exchange: string; name: string }

const INTERVALS = [
  { label: '1m', val: 'ONE_MINUTE' },
  { label: '5m', val: 'FIVE_MINUTE' },
  { label: '15m', val: 'FIFTEEN_MINUTE' },
  { label: '1H', val: 'ONE_HOUR' },
  { label: '1D', val: 'ONE_DAY' },
];

const POPULAR = [
  { s: 'RELIANCE', t: '2885', e: 'NSE' },
  { s: 'TCS', t: '11536', e: 'NSE' },
  { s: 'INFY', t: '1594', e: 'NSE' },
  { s: 'HDFC', t: '1333', e: 'NSE' },
  { s: 'ICICIBANK', t: '4963', e: 'NSE' },
  { s: 'WIPRO', t: '3787', e: 'NSE' },
];

function RsiChart({ rsi, width, height }: { rsi: number[]; width: number; height: number }) {
  const valid = rsi.filter(v => !isNaN(v));
  if (valid.length < 2) return null;
  const H = height - 20;
  const W = width - 40;
  let path = '';
  rsi.forEach((v, i) => {
    if (isNaN(v)) return;
    const x = 4 + (i / (rsi.length - 1)) * W;
    const y = 4 + ((100 - v) / 100) * H;
    path += path ? `L${x.toFixed(1)},${y.toFixed(1)}` : `M${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const cur = valid[valid.length - 1];
  const color = cur < 35 ? COLORS.accent : cur > 65 ? COLORS.red : COLORS.yellow;
  return (
    <View style={{ height, paddingLeft: 4 }}>
      <Text style={styles.rsiLabel}>RSI {cur.toFixed(1)}</Text>
      <View style={{ flex: 1, position: 'relative' }}>
        {/* SVG-like lines using Views */}
        <View style={[styles.rsiLine, { top: ((100 - 70) / 100) * H + 14, backgroundColor: COLORS.red, opacity: 0.3 }]} />
        <View style={[styles.rsiLine, { top: ((100 - 30) / 100) * H + 14, backgroundColor: COLORS.accent, opacity: 0.3 }]} />
      </View>
      <View style={[styles.rsiValueBubble, { backgroundColor: color }]}>
        <Text style={styles.rsiValueText}>{cur.toFixed(1)}</Text>
      </View>
    </View>
  );
}

export default function ChartsScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [interval, setInterval] = useState(INTERVALS[1]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showEMA, setShowEMA] = useState(true);
  const [showBB, setShowBB] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const fetchCandles = useCallback(async (sym: SearchResult, iv: typeof interval) => {
    if (!session?.jwtToken) return;
    setLoading(true);
    try {
      const now = new Date();
      const from = new Date(now);
      from.setDate(from.getDate() - (iv.val === 'ONE_DAY' ? 180 : iv.val === 'ONE_HOUR' ? 30 : 5));
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      const res = await api.getCandles(session.jwtToken, {
        exchange: sym.exchange,
        symboltoken: sym.symboltoken,
        interval: iv.val,
        fromdate: fmt(from),
        todate: fmt(now),
      });
      if (res.status && res.data) {
        const cs: Candle[] = res.data.map(([t, o, h, l, c, v]) => ({
          time: typeof t === 'string' ? new Date(t).getTime() / 1000 : Number(t),
          open: o, high: h, low: l, close: c, volume: v,
        }));
        setCandles(cs.slice(-80));
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [session]);

  const selectSymbol = useCallback((s: SearchResult) => {
    setSelected(s);
    setShowSearch(false);
    setQuery(s.tradingsymbol);
    setResults([]);
    fetchCandles(s, interval);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [interval, fetchCandles]);

  useEffect(() => {
    if (selected) fetchCandles(selected, interval);
  }, [interval, selected, fetchCandles]);

  useEffect(() => {
    if (!query || !session?.jwtToken) { setResults([]); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await api.searchSymbol(session.jwtToken, query);
        if (r.status) setResults(r.data.slice(0, 6));
      } catch { /* ignore */ }
    }, 400);
    return () => clearTimeout(searchTimer.current);
  }, [query, session]);

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const ema9 = showEMA ? EMA(closes, 9) : undefined;
  const ema21 = showEMA ? EMA(closes, 21) : undefined;
  const bb = showBB ? BollingerBands(closes) : undefined;
  const rsi = closes.length > 14 ? RSI(closes) : [];

  const lastClose = closes[closes.length - 1];
  const prevClose = closes[closes.length - 2];
  const changePct = lastClose && prevClose ? ((lastClose - prevClose) / prevClose) * 100 : 0;
  const up = changePct >= 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Charts</Text>
        <View style={styles.headerRight}>
          {!session && (
            <View style={styles.noAuthBadge}>
              <Feather name="lock" size={11} color={COLORS.yellow} />
              <Text style={styles.noAuthText}>Login required</Text>
            </View>
          )}
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Feather name="search" size={16} color={COLORS.textMuted} style={{ marginLeft: 12 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search symbol (e.g. RELIANCE)"
          placeholderTextColor={COLORS.textMuted}
          value={query}
          onChangeText={t => { setQuery(t); setShowSearch(true); }}
          onFocus={() => setShowSearch(true)}
          autoCapitalize="characters"
        />
        {query.length > 0 && (
          <Pressable onPress={() => { setQuery(''); setResults([]); setShowSearch(false); }} style={styles.clearBtn}>
            <Feather name="x" size={14} color={COLORS.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Search Results */}
      {showSearch && results.length > 0 && (
        <View style={styles.dropdown}>
          {results.map((r, i) => (
            <Pressable key={i} onPress={() => selectSymbol(r)}
              style={({ pressed }) => [styles.dropItem, pressed && { backgroundColor: COLORS.card }, i < results.length - 1 && { borderBottomWidth: 1, borderBottomColor: COLORS.divider }]}>
              <Text style={styles.dropSymbol}>{r.tradingsymbol}</Text>
              <Text style={styles.dropExch}>{r.exchange}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Popular */}
      {!selected && (
        <View style={styles.popularWrap}>
          <Text style={styles.popularLabel}>POPULAR</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
            {POPULAR.map(p => (
              <Pressable key={p.s} onPress={() => selectSymbol({ tradingsymbol: p.s, symboltoken: p.t, exchange: p.e, name: p.s })}
                style={({ pressed }) => [styles.popularChip, pressed && { opacity: 0.7 }]}>
                <Text style={styles.popularChipText}>{p.s}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 72 }}>
        {selected && (
          <>
            {/* Symbol Header */}
            <View style={styles.symbolHeader}>
              <View>
                <Text style={styles.symbolName}>{selected.tradingsymbol}</Text>
                <Text style={styles.symbolExch}>{selected.exchange} · {interval.label}</Text>
              </View>
              {lastClose > 0 && (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.symbolLtp}>₹{lastClose.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                  <Text style={[styles.symbolChg, { color: up ? COLORS.accent : COLORS.red }]}>
                    {up ? '+' : ''}{changePct.toFixed(2)}%
                  </Text>
                </View>
              )}
            </View>

            {/* Interval Selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.intervalRow}>
              {INTERVALS.map(iv => (
                <Pressable key={iv.val} onPress={() => { setInterval(iv); Haptics.selectionAsync(); }}
                  style={[styles.intervalChip, interval.val === iv.val && styles.intervalChipActive]}>
                  <Text style={[styles.intervalText, interval.val === iv.val && styles.intervalTextActive]}>{iv.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Indicator toggles */}
            <View style={styles.indicatorRow}>
              <Pressable onPress={() => { setShowEMA(!showEMA); Haptics.selectionAsync(); }}
                style={[styles.indToggle, showEMA && styles.indToggleActive]}>
                <View style={[styles.indDot, { backgroundColor: '#FFB300' }]} />
                <Text style={[styles.indText, showEMA && styles.indTextActive]}>EMA 9/21</Text>
              </Pressable>
              <Pressable onPress={() => { setShowBB(!showBB); Haptics.selectionAsync(); }}
                style={[styles.indToggle, showBB && styles.indToggleActive]}>
                <View style={[styles.indDot, { backgroundColor: COLORS.blue }]} />
                <Text style={[styles.indText, showBB && styles.indTextActive]}>Bollinger</Text>
              </Pressable>
            </View>

            {/* Chart */}
            <View style={styles.chartCard}>
              {loading ? (
                <View style={[styles.chartLoader, { height: CHART_H }]}>
                  <ActivityIndicator color={COLORS.accent} />
                  <Text style={styles.loadingText}>Loading chart...</Text>
                </View>
              ) : candles.length === 0 ? (
                <View style={[styles.chartLoader, { height: CHART_H }]}>
                  <Feather name="bar-chart-2" size={32} color={COLORS.textMuted} />
                  <Text style={styles.loadingText}>No candle data available</Text>
                </View>
              ) : (
                <CandlestickChart
                  candles={candles}
                  width={SCREEN_W - 32}
                  height={CHART_H}
                  ema9={ema9}
                  ema21={ema21}
                  bbUpper={bb?.upper}
                  bbLower={bb?.lower}
                />
              )}
            </View>

            {/* RSI */}
            {rsi.length > 0 && (
              <View style={[styles.chartCard, { marginTop: 8, height: RSI_H + 20, paddingVertical: 10 }]}>
                <RsiChart rsi={rsi} width={SCREEN_W - 32} height={RSI_H} />
              </View>
            )}

            {/* OHLCV */}
            {candles.length > 0 && (() => {
              const last = candles[candles.length - 1];
              return (
                <View style={styles.ohlcRow}>
                  {[
                    { l: 'Open', v: last.open },
                    { l: 'High', v: last.high },
                    { l: 'Low', v: last.low },
                    { l: 'Close', v: last.close },
                  ].map(({ l, v }) => (
                    <View key={l} style={styles.ohlcItem}>
                      <Text style={styles.ohlcLabel}>{l}</Text>
                      <Text style={styles.ohlcValue}>₹{v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}
          </>
        )}

        {!selected && (
          <View style={styles.selectPrompt}>
            <Feather name="activity" size={48} color={COLORS.textMuted} />
            <Text style={styles.selectTitle}>Select a stock</Text>
            <Text style={styles.selectSub}>Search above or pick from popular stocks to view live candlestick charts</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  title: { fontSize: 22, fontFamily: FONTS.bold, color: COLORS.text },
  headerRight: { flexDirection: 'row', gap: 8 },
  noAuthBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.yellowDim, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full },
  noAuthText: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.yellow },
  searchWrap: {
    marginHorizontal: 16, flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.cardBorder, marginBottom: 4,
  },
  searchInput: { flex: 1, height: 44, paddingHorizontal: 10, fontSize: 14, fontFamily: FONTS.regular, color: COLORS.text },
  clearBtn: { padding: 12 },
  dropdown: {
    marginHorizontal: 16, backgroundColor: COLORS.card,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder,
    overflow: 'hidden', zIndex: 100, marginBottom: 8,
  },
  dropItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11 },
  dropSymbol: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.text },
  dropExch: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textMuted },
  popularWrap: { paddingTop: 8 },
  popularLabel: { fontSize: 10, fontFamily: FONTS.bold, color: COLORS.textMuted, letterSpacing: 1, paddingHorizontal: 20, marginBottom: 8 },
  popularChip: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.cardBorder },
  popularChipText: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.text },
  symbolHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 8 },
  symbolName: { fontSize: 20, fontFamily: FONTS.bold, color: COLORS.text },
  symbolExch: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textMuted },
  symbolLtp: { fontSize: 20, fontFamily: FONTS.bold, color: COLORS.text },
  symbolChg: { fontSize: 13, fontFamily: FONTS.medium },
  intervalRow: { paddingHorizontal: 20, gap: 8, paddingBottom: 10 },
  intervalChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.cardBorder },
  intervalChipActive: { backgroundColor: COLORS.accentDim, borderColor: COLORS.accent },
  intervalText: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textSub },
  intervalTextActive: { color: COLORS.accent },
  indicatorRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, paddingBottom: 10 },
  indToggle: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.cardBorder },
  indToggleActive: { borderColor: COLORS.accent },
  indDot: { width: 8, height: 8, borderRadius: 4 },
  indText: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.textMuted },
  indTextActive: { color: COLORS.text },
  chartCard: { marginHorizontal: 16, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, overflow: 'hidden' },
  chartLoader: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textMuted },
  ohlcRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: 8, backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder },
  ohlcItem: { flex: 1, padding: 12, alignItems: 'center', borderRightWidth: 1, borderRightColor: COLORS.divider },
  ohlcLabel: { fontSize: 10, fontFamily: FONTS.regular, color: COLORS.textMuted },
  ohlcValue: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.text, marginTop: 2 },
  selectPrompt: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12, paddingHorizontal: 40 },
  selectTitle: { fontSize: 20, fontFamily: FONTS.semibold, color: COLORS.textSub },
  selectSub: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textMuted, textAlign: 'center' },
  rsiLabel: { fontSize: 10, fontFamily: FONTS.medium, color: COLORS.textSub, paddingHorizontal: 12, paddingBottom: 4 },
  rsiLine: { position: 'absolute', left: 0, right: 0, height: 1 },
  rsiValueBubble: { position: 'absolute', right: 12, top: 16, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  rsiValueText: { fontSize: 10, fontFamily: FONTS.bold, color: '#000' },
});
