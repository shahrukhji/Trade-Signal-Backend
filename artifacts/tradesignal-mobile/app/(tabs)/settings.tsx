import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView,
  StyleSheet, Switch, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { COLORS, FONTS, RADIUS } from '@/constants/theme';

interface SectionProps { title: string; children: React.ReactNode }
function Section({ title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

interface RowProps {
  icon: string; label: string; sublabel?: string;
  right?: React.ReactNode; onPress?: () => void;
  danger?: boolean; last?: boolean;
}
function Row({ icon, label, sublabel, right, onPress, danger, last }: RowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && onPress && { opacity: 0.7 }]}
    >
      <View style={[styles.rowIcon, { backgroundColor: danger ? COLORS.redDim : COLORS.accentDim2 }]}>
        <Feather name={icon as 'settings'} size={16} color={danger ? COLORS.red : COLORS.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, danger && { color: COLORS.red }]}>{label}</Text>
        {sublabel && <Text style={styles.rowSublabel}>{sublabel}</Text>}
      </View>
      {right}
      {onPress && !right && <Feather name="chevron-right" size={16} color={COLORS.textMuted} />}
    </Pressable>
  );
}

const STRATEGIES = [
  { name: 'EMA Crossover', desc: 'Fast/slow EMA cross with volume confirmation', params: 'EMA 9/21, Vol 1.5x' },
  { name: 'RSI Reversal', desc: 'Oversold/overbought RSI with price confirmation', params: 'RSI <35 or >65' },
  { name: 'VWAP Bounce', desc: 'Price bouncing off VWAP with momentum', params: 'VWAP + RSI' },
  { name: 'Bollinger Squeeze', desc: 'Breakout after BB squeeze (low volatility)', params: 'BB Width <0.05' },
  { name: 'Supertrend', desc: 'Trend-following with dynamic stop loss', params: 'ATR 10, Factor 3' },
  { name: 'MACD Signal', desc: 'MACD line crossing signal line', params: '12/26/9 EMA' },
  { name: 'Breakout Volume', desc: 'Price breaking key levels with surge in volume', params: 'Vol >2x average' },
  { name: 'Hammer/Doji', desc: 'Candlestick reversal patterns at key levels', params: 'Hammer, Shooting Star' },
  { name: 'Opening Range', desc: 'First 15-min range breakout with trend filter', params: 'ORB + EMA 50' },
  { name: 'Intraday Momentum', desc: 'Strong momentum with multi-indicator alignment', params: 'RSI + EMA + VWAP' },
];

const INDICATORS = [
  'EMA (9, 21, 50, 200)', 'SMA (20, 50)', 'RSI (14)', 'MACD (12/26/9)',
  'Bollinger Bands (20, 2)', 'VWAP', 'ATR (14)', 'Supertrend', 'Stochastic',
  'Williams %R', 'CCI', 'OBV', 'MFI', 'ADX', 'Parabolic SAR',
  'Pivot Points', 'Fibonacci', 'Ichimoku Cloud',
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { session, configStatus, paperMode, setPaperMode, connectBroker, disconnect, isConnecting, connectError } = useApp();
  const [showGuide, setShowGuide] = useState(false);
  const [expandedStrat, setExpandedStrat] = useState<number | null>(null);

  const handleConnect = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    connectBroker();
  };
  const handleDisconnect = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    disconnect();
  };

  if (showGuide) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.guideHeader}>
          <Pressable onPress={() => setShowGuide(false)} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={COLORS.text} />
          </Pressable>
          <Text style={styles.guideTitle}>Strategy Guide</Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
          <Text style={styles.guideIntro}>
            TradeSignal Pro uses 10 proven algorithmic strategies analyzed across 25+ indicators and 30+ candlestick patterns.
          </Text>

          <Text style={styles.guideSectionTitle}>TRADING STRATEGIES</Text>
          {STRATEGIES.map((s, i) => (
            <Pressable key={i} onPress={() => { setExpandedStrat(expandedStrat === i ? null : i); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              style={[styles.stratCard, expandedStrat === i && { borderColor: COLORS.accent }]}>
              <View style={styles.stratRow}>
                <View style={styles.stratNum}><Text style={styles.stratNumText}>{i + 1}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stratName}>{s.name}</Text>
                  <Text style={styles.stratParams}>{s.params}</Text>
                </View>
                <Feather name={expandedStrat === i ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textMuted} />
              </View>
              {expandedStrat === i && (
                <Text style={styles.stratDesc}>{s.desc}</Text>
              )}
            </Pressable>
          ))}

          <Text style={styles.guideSectionTitle}>INDICATORS ({INDICATORS.length})</Text>
          <View style={styles.indGrid}>
            {INDICATORS.map((ind, i) => (
              <View key={i} style={styles.indItem}>
                <Feather name="check-circle" size={12} color={COLORS.accent} />
                <Text style={styles.indName}>{ind}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.guideSectionTitle}>MARKET HOURS (NSE/BSE)</Text>
          <View style={styles.hoursCard}>
            {[
              { s: 'Pre-Market', t: '09:00 – 09:15' },
              { s: 'Regular', t: '09:15 – 15:30' },
              { s: 'Closing', t: '15:30 – 16:00' },
              { s: 'F&O Expiry', t: 'Every Thursday' },
              { s: 'Settlement', t: 'T+1 rolling' },
            ].map((h, i, arr) => (
              <View key={i} style={[styles.hoursRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: COLORS.divider }]}>
                <Text style={styles.hoursSession}>{h.s}</Text>
                <Text style={styles.hoursTime}>{h.t}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.guideSectionTitle}>RISK MANAGEMENT</Text>
          <View style={styles.riskCard}>
            {[
              { rule: 'Max risk per trade', val: '2% of capital' },
              { rule: 'Stop loss method', val: 'ATR-based (1.5x ATR)' },
              { rule: 'Target', val: '1:2 or 1:3 risk-reward' },
              { rule: 'Max open positions', val: '5 simultaneous' },
              { rule: 'Paper mode', val: 'Virtual ₹10,00,000 capital' },
            ].map((r, i, arr) => (
              <View key={i} style={[styles.riskRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: COLORS.divider }]}>
                <Text style={styles.riskRule}>{r.rule}</Text>
                <Text style={styles.riskVal}>{r.val}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>

        {/* Broker Connection */}
        <Section title="BROKER CONNECTION">
          <Row
            icon="user"
            label={session ? `Connected as ${session.clientName}` : 'Angel One Account'}
            sublabel={session ? session.email || session.clientId : 'Not connected'}
            right={session ? (
              <View style={styles.connectedBadge}>
                <View style={styles.connDot} />
                <Text style={styles.connText}>Live</Text>
              </View>
            ) : undefined}
          />
          {!session && (
            <Row
              icon="link"
              label={isConnecting ? 'Connecting...' : 'Auto Connect'}
              sublabel={configStatus?.allConfigured ? 'Credentials pre-configured' : 'Using environment credentials'}
              onPress={isConnecting ? undefined : handleConnect}
              right={isConnecting ? <ActivityIndicator size="small" color={COLORS.accent} /> : undefined}
            />
          )}
          {configStatus && (
            <Row
              icon="check-circle"
              label="Credentials Status"
              sublabel={configStatus.allConfigured ? 'All credentials configured' : 'Partial configuration'}
              last
            />
          )}
          {session && (
            <Row icon="log-out" label="Disconnect" onPress={handleDisconnect} danger last />
          )}
        </Section>

        {connectError ? (
          <View style={styles.errorBanner}>
            <Feather name="alert-circle" size={14} color={COLORS.red} />
            <Text style={styles.errorText}>{connectError}</Text>
          </View>
        ) : null}

        {/* Trading Mode */}
        <Section title="TRADING MODE">
          <Row
            icon="shield"
            label="Paper Trading Mode"
            sublabel="Use virtual money — no real orders placed"
            right={
              <Switch
                value={!!paperMode}
                onValueChange={v => { setPaperMode(v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                trackColor={{ false: COLORS.surface, true: COLORS.accentDim }}
                thumbColor={paperMode ? COLORS.accent : COLORS.textMuted}
                ios_backgroundColor={COLORS.surface}
              />
            }
            last
          />
        </Section>

        {/* App Info */}
        <Section title="INFORMATION">
          <Row
            icon="book-open"
            label="Strategy & Indicator Guide"
            sublabel="10 strategies, 18 indicators, patterns"
            onPress={() => { setShowGuide(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          />
          <Row
            icon="activity"
            label="Supported Exchanges"
            sublabel="NSE, BSE, NFO (F&O)"
          />
          <Row
            icon="clock"
            label="Market Hours"
            sublabel="Mon–Fri, 09:15 – 15:30 IST"
            last
          />
        </Section>

        {/* About */}
        <Section title="ABOUT">
          <Row icon="info" label="TradeSignal Pro" sublabel="v1.0.0 · Angel One SmartAPI" />
          <Row icon="cpu" label="Indicators" sublabel="25+ technical indicators" />
          <Row icon="bar-chart-2" label="Strategies" sublabel="10 algorithmic strategies" last />
        </Section>

        <Text style={styles.footer}>Made with ❤️ by Shahrukh{'\n'}For educational purposes only. Not financial advice.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 20, paddingVertical: 12 },
  title: { fontSize: 22, fontFamily: FONTS.bold, color: COLORS.text },
  section: { marginBottom: 4 },
  sectionLabel: { fontSize: 10, fontFamily: FONTS.bold, color: COLORS.textMuted, letterSpacing: 1.2, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  sectionCard: { marginHorizontal: 16, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  rowIcon: { width: 32, height: 32, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.text },
  rowSublabel: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textMuted, marginTop: 1 },
  connectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.accentDim, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full },
  connDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.accent },
  connText: { fontSize: 11, fontFamily: FONTS.semibold, color: COLORS.accent },
  errorBanner: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.redDim, padding: 12, borderRadius: RADIUS.md, marginBottom: 8 },
  errorText: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.red, flex: 1 },
  footer: { textAlign: 'center', fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textMuted, paddingVertical: 20, lineHeight: 18 },
  // Guide styles
  guideHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.cardBorder },
  guideTitle: { fontSize: 18, fontFamily: FONTS.semibold, color: COLORS.text },
  guideIntro: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSub, lineHeight: 20, margin: 16, padding: 14, backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder },
  guideSectionTitle: { fontSize: 10, fontFamily: FONTS.bold, color: COLORS.textMuted, letterSpacing: 1.2, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  stratCard: { marginHorizontal: 16, marginBottom: 8, backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 12, gap: 8 },
  stratRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stratNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.accentDim, alignItems: 'center', justifyContent: 'center' },
  stratNumText: { fontSize: 11, fontFamily: FONTS.bold, color: COLORS.accent },
  stratName: { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.text },
  stratParams: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.accent, marginTop: 2 },
  stratDesc: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textSub, lineHeight: 18, paddingTop: 4, borderTopWidth: 1, borderTopColor: COLORS.divider },
  indGrid: { marginHorizontal: 16, backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 12, gap: 8 },
  indItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  indName: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSub },
  hoursCard: { marginHorizontal: 16, backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder, overflow: 'hidden' },
  hoursRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
  hoursSession: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textSub },
  hoursTime: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.accent },
  riskCard: { marginHorizontal: 16, backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder, overflow: 'hidden' },
  riskRow: { paddingHorizontal: 14, paddingVertical: 11 },
  riskRule: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textMuted, marginBottom: 3 },
  riskVal: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.text },
});
