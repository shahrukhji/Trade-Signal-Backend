import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { COLORS, FONTS, RADIUS } from '@/constants/theme';
import { api, type Holding, type Position, type FundsData } from '@/lib/api';

function PnlTag({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <View style={[styles.pnlTag, { backgroundColor: up ? COLORS.accentDim : COLORS.redDim }]}>
      <Feather name={up ? 'arrow-up-right' : 'arrow-down-right'} size={10} color={up ? COLORS.accent : COLORS.red} />
      <Text style={[styles.pnlText, { color: up ? COLORS.accent : COLORS.red }]}>
        {up ? '+' : ''}₹{Math.abs(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
      </Text>
    </View>
  );
}

function HoldingRow({ item }: { item: Holding }) {
  const up = item.profitandloss >= 0;
  return (
    <View style={styles.holdingRow}>
      <View style={styles.holdingIcon}>
        <Text style={styles.holdingInitial}>{item.tradingsymbol[0]}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.holdingSymbol}>{item.tradingsymbol}</Text>
        <Text style={styles.holdingMeta}>{item.quantity} shares · Avg ₹{item.averageprice.toFixed(2)}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={styles.holdingLtp}>₹{item.ltp.toFixed(2)}</Text>
        <PnlTag value={item.profitandloss} />
        <Text style={[styles.holdingPct, { color: up ? COLORS.accent : COLORS.red }]}>
          {up ? '+' : ''}{item.pnlpercentage.toFixed(2)}%
        </Text>
      </View>
    </View>
  );
}

function PositionRow({ item }: { item: Position }) {
  const pnl = parseFloat(item.unrealisedpnl || '0');
  const up = pnl >= 0;
  const qty = parseInt(item.netqty || '0');
  if (qty === 0) return null;
  return (
    <View style={styles.holdingRow}>
      <View style={[styles.holdingIcon, { backgroundColor: COLORS.blueDim }]}>
        <Text style={[styles.holdingInitial, { color: COLORS.blue }]}>{item.tradingsymbol[0]}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.holdingSymbol}>{item.tradingsymbol}</Text>
        <Text style={styles.holdingMeta}>{qty > 0 ? 'Long' : 'Short'} {Math.abs(qty)} · {item.producttype}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={styles.holdingLtp}>₹{parseFloat(item.ltp || '0').toFixed(2)}</Text>
        <PnlTag value={pnl} />
      </View>
    </View>
  );
}

export default function PortfolioScreen() {
  const insets = useSafeAreaInsets();
  const { session, connectBroker, isConnecting } = useApp();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [funds, setFunds] = useState<FundsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'holdings' | 'positions'>('holdings');

  const load = useCallback(async () => {
    if (!session?.jwtToken) return;
    setLoading(true);
    try {
      const [h, p, f] = await Promise.allSettled([
        api.getHoldings(session.jwtToken),
        api.getPositions(session.jwtToken),
        api.getFunds(session.jwtToken),
      ]);
      if (h.status === 'fulfilled' && h.value.data) setHoldings(h.value.data);
      if (p.status === 'fulfilled' && p.value.data) setPositions(p.value.data);
      if (f.status === 'fulfilled' && f.value.data) setFunds(f.value.data);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  const totalPnl = holdings.reduce((s, h) => s + h.profitandloss, 0);
  const totalInvested = holdings.reduce((s, h) => s + h.averageprice * h.quantity, 0);
  const totalCurrent = holdings.reduce((s, h) => s + h.ltp * h.quantity, 0);
  const unrealisedPos = positions.reduce((s, p) => s + parseFloat(p.unrealisedpnl || '0'), 0);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Portfolio</Text>
        {session && (
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); load(); }}
            style={styles.refreshBtn}>
            <Feather name="refresh-cw" size={16} color={COLORS.textSub} />
          </Pressable>
        )}
      </View>

      {!session ? (
        <View style={styles.loginPrompt}>
          <Feather name="briefcase" size={52} color={COLORS.textMuted} />
          <Text style={styles.loginTitle}>Connect to view portfolio</Text>
          <Text style={styles.loginSub}>Your holdings, positions, and P&L will appear here after connecting Angel One</Text>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); connectBroker(); }}
            style={({ pressed }) => [styles.connectBtn, pressed && { opacity: 0.8 }]}>
            {isConnecting
              ? <ActivityIndicator color="#000" size="small" />
              : <Feather name="link" size={16} color="#000" />
            }
            <Text style={styles.connectBtnText}>{isConnecting ? 'Connecting...' : 'Connect Angel One'}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={COLORS.accent} />}
        >
          {/* Funds Summary */}
          {funds && (
            <View style={styles.fundsCard}>
              <View style={styles.fundsRow}>
                <Text style={styles.fundsLabel}>Available Cash</Text>
                <Text style={styles.fundsValue}>₹{parseFloat(funds.availablecash || '0').toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
              </View>
              <View style={styles.fundsDivider} />
              <View style={styles.fundsRow}>
                <Text style={styles.fundsLabel}>Intraday Limit</Text>
                <Text style={styles.fundsValue}>₹{parseFloat(funds.availableintradaypayin || '0').toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
              </View>
            </View>
          )}

          {/* P&L Overview */}
          <View style={styles.pnlCard}>
            <View style={styles.pnlMain}>
              <Text style={styles.pnlMainLabel}>Total P&L</Text>
              <Text style={[styles.pnlMainVal, { color: totalPnl >= 0 ? COLORS.accent : COLORS.red }]}>
                {totalPnl >= 0 ? '+' : ''}₹{Math.abs(totalPnl).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </Text>
              {totalInvested > 0 && (
                <Text style={[styles.pnlPct, { color: totalPnl >= 0 ? COLORS.accent : COLORS.red }]}>
                  {totalPnl >= 0 ? '+' : ''}{((totalPnl / totalInvested) * 100).toFixed(2)}% overall
                </Text>
              )}
            </View>
            <View style={styles.pnlStats}>
              <View style={styles.pnlStatItem}>
                <Text style={styles.pnlStatLabel}>Invested</Text>
                <Text style={styles.pnlStatVal}>₹{totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
              </View>
              <View style={[styles.pnlStatItem, { borderLeftWidth: 1, borderLeftColor: COLORS.divider }]}>
                <Text style={styles.pnlStatLabel}>Current</Text>
                <Text style={styles.pnlStatVal}>₹{totalCurrent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
              </View>
              <View style={[styles.pnlStatItem, { borderLeftWidth: 1, borderLeftColor: COLORS.divider }]}>
                <Text style={styles.pnlStatLabel}>Intraday P&L</Text>
                <Text style={[styles.pnlStatVal, { color: unrealisedPos >= 0 ? COLORS.accent : COLORS.red }]}>
                  {unrealisedPos >= 0 ? '+' : ''}₹{Math.abs(unrealisedPos).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </Text>
              </View>
            </View>
          </View>

          {/* Tab Switcher */}
          <View style={styles.tabRow}>
            <Pressable onPress={() => { setTab('holdings'); Haptics.selectionAsync(); }}
              style={[styles.tabBtn, tab === 'holdings' && styles.tabBtnActive]}>
              <Text style={[styles.tabBtnText, tab === 'holdings' && styles.tabBtnTextActive]}>
                Holdings ({holdings.length})
              </Text>
            </Pressable>
            <Pressable onPress={() => { setTab('positions'); Haptics.selectionAsync(); }}
              style={[styles.tabBtn, tab === 'positions' && styles.tabBtnActive]}>
              <Text style={[styles.tabBtnText, tab === 'positions' && styles.tabBtnTextActive]}>
                Positions ({positions.filter(p => parseInt(p.netqty || '0') !== 0).length})
              </Text>
            </Pressable>
          </View>

          {/* List */}
          {tab === 'holdings' && (
            <View style={styles.listCard}>
              {holdings.length === 0 ? (
                <View style={styles.listEmpty}>
                  <Feather name="inbox" size={28} color={COLORS.textMuted} />
                  <Text style={styles.listEmptyText}>No holdings found</Text>
                </View>
              ) : (
                holdings.map((h, i) => (
                  <React.Fragment key={h.isin + i}>
                    <HoldingRow item={h} />
                    {i < holdings.length - 1 && <View style={styles.rowDivider} />}
                  </React.Fragment>
                ))
              )}
            </View>
          )}

          {tab === 'positions' && (
            <View style={styles.listCard}>
              {positions.filter(p => parseInt(p.netqty || '0') !== 0).length === 0 ? (
                <View style={styles.listEmpty}>
                  <Feather name="inbox" size={28} color={COLORS.textMuted} />
                  <Text style={styles.listEmptyText}>No open positions</Text>
                </View>
              ) : (
                positions.filter(p => parseInt(p.netqty || '0') !== 0).map((p, i, arr) => (
                  <React.Fragment key={p.symboltoken + i}>
                    <PositionRow item={p} />
                    {i < arr.length - 1 && <View style={styles.rowDivider} />}
                  </React.Fragment>
                ))
              )}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  title: { fontSize: 22, fontFamily: FONTS.bold, color: COLORS.text },
  refreshBtn: { width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.cardBorder },
  loginPrompt: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 40 },
  loginTitle: { fontSize: 18, fontFamily: FONTS.semibold, color: COLORS.textSub },
  loginSub: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  connectBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.accent, paddingHorizontal: 24, paddingVertical: 14, borderRadius: RADIUS.md, marginTop: 8 },
  connectBtnText: { fontSize: 15, fontFamily: FONTS.semibold, color: '#000' },
  fundsCard: { marginHorizontal: 16, marginBottom: 10, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 14 },
  fundsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  fundsLabel: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSub },
  fundsValue: { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.text },
  fundsDivider: { height: 1, backgroundColor: COLORS.divider, marginVertical: 8 },
  pnlCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, overflow: 'hidden' },
  pnlMain: { padding: 18, alignItems: 'center', gap: 4 },
  pnlMainLabel: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textMuted, letterSpacing: 0.5 },
  pnlMainVal: { fontSize: 28, fontFamily: FONTS.bold },
  pnlPct: { fontSize: 13, fontFamily: FONTS.medium },
  pnlStats: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.divider },
  pnlStatItem: { flex: 1, padding: 12, alignItems: 'center', gap: 4 },
  pnlStatLabel: { fontSize: 10, fontFamily: FONTS.regular, color: COLORS.textMuted },
  pnlStatVal: { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.text },
  tabRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 10, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 3, gap: 3 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: RADIUS.sm - 2 },
  tabBtnActive: { backgroundColor: COLORS.card },
  tabBtnText: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textMuted },
  tabBtnTextActive: { color: COLORS.text },
  listCard: { marginHorizontal: 16, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, overflow: 'hidden' },
  holdingRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  holdingIcon: { width: 38, height: 38, borderRadius: RADIUS.md, backgroundColor: COLORS.accentDim, alignItems: 'center', justifyContent: 'center' },
  holdingInitial: { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.accent },
  holdingSymbol: { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.text },
  holdingMeta: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textMuted, marginTop: 1 },
  holdingLtp: { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.text },
  holdingPct: { fontSize: 11, fontFamily: FONTS.medium },
  pnlTag: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  pnlText: { fontSize: 10, fontFamily: FONTS.semibold },
  rowDivider: { height: 1, backgroundColor: COLORS.divider, marginHorizontal: 14 },
  listEmpty: { padding: 32, alignItems: 'center', gap: 8 },
  listEmptyText: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textMuted },
});
