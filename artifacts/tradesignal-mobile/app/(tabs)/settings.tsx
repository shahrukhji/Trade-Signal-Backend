import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
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
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        {session && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>

        {/* Quick Connect Hero — shown when NOT connected */}
        {!session && (
          <View style={styles.connectHero}>
            <LinearGradient
              colors={['rgba(0,230,118,0.08)', 'rgba(0,230,118,0.02)']}
              style={styles.connectGradient}
            >
              <View style={styles.connectHeroTop}>
                <View style={styles.connectHeroIcon}>
                  <Feather name="wifi" size={24} color={COLORS.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.connectHeroTitle}>Connect Angel One</Text>
                  <Text style={styles.connectHeroSub}>SmartAPI · TOTP auto-generated server-side</Text>
                </View>
              </View>

              {configStatus?.allConfigured && (
                <View style={styles.configBadge}>
                  <Feather name="check-circle" size={12} color={COLORS.accent} />
                  <Text style={styles.configBadgeText}>All credentials pre-configured in Replit Secrets</Text>
                </View>
              )}

              <Pressable
                onPress={isConnecting ? undefined : handleConnect}
                disabled={isConnecting}
                style={({ pressed }) => [styles.connectBtn, pressed && { opacity: 0.85 }]}
              >
                <LinearGradient
                  colors={isConnecting ? [COLORS.accentDim, COLORS.accentDim] : ['#00E676', '#00C853']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.connectBtnGradient}
                >
                  {isConnecting ? (
                    <>
                      <ActivityIndicator size="small" color={COLORS.accent} style={{ marginRight: 8 }} />
                      <Text style={[styles.connectBtnText, { color: COLORS.accent }]}>Connecting...</Text>
                    </>
                  ) : (
                    <>
                      <Feather name="wifi" size={18} color="#000" style={{ marginRight: 8 }} />
                      <Text style={styles.connectBtnText}>Quick Connect (Auto)</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>

              {connectError ? (
                <View style={styles.errorBanner}>
                  <Feather name="alert-circle" size={14} color={COLORS.red} />
                  <Text style={styles.errorText}>{connectError}</Text>
                </View>
              ) : null}
            </LinearGradient>
          </View>
        )}

        {/* Connected Profile Card */}
        {session && (
          <View style={styles.profileCard}>
            <LinearGradient
              colors={['rgba(0,230,118,0.10)', 'rgba(0,230,118,0.03)']}
              style={styles.profileGradient}
            >
              <View style={styles.profileRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {session.clientName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileName}>{session.clientName}</Text>
                  <Text style={styles.profileSub}>{session.email || session.clientId} · Angel One</Text>
                </View>
                <Pressable onPress={handleDisconnect} style={styles.disconnectBtn}>
                  <Feather name="log-out" size={14} color={COLORS.red} />
                  <Text style={styles.disconnectText}>Disconnect</Text>
                </Pressable>
              </View>
              <View style={styles.profileTags}>
                {session.exchanges?.map((ex: string) => (
                  <View key={ex} style={styles.tag}>
                    <Text style={styles.tagText}>{ex}</Text>
                  </View>
                ))}
                <View style={[styles.tag, { borderColor: COLORS.accent + '40', backgroundColor: COLORS.accentDim }]}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.accent, marginRight: 4 }} />
                  <Text style={[styles.tagText, { color: COLORS.accent }]}>Connected</Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Trading Mode */}
        <Section title="TRADING MODE">
          <Row
            icon="shield"
            label="Paper Trading Mode"
            sublabel={paperMode ? 'Active — virtual ₹10,00,000 capital' : 'Disabled — real orders will be placed'}
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

        {/* Features */}
        <Section title="FEATURES">
          <Row icon="zap" label="25+ Technical Indicators" sublabel="EMA, MACD, RSI, Bollinger, VWAP, ATR..." />
          <Row icon="target" label="10 Algorithmic Strategies" sublabel="EMA Crossover, Supertrend, VWAP Bounce..." />
          <Row icon="bar-chart-2" label="Candlestick Patterns" sublabel="Hammer, Doji, Engulfing & 30+ patterns" />
          <Row
            icon="book-open"
            label="Strategy & Indicator Guide"
            sublabel="Full details on all strategies and indicators"
            onPress={() => { setShowGuide(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            last
          />
        </Section>

        {/* Market Info */}
        <Section title="MARKET INFORMATION">
          <Row icon="activity" label="Supported Exchanges" sublabel="NSE, BSE, NFO (Futures & Options)" />
          <Row icon="clock" label="Market Hours" sublabel="Mon–Fri · 09:15 – 15:30 IST" />
          <Row icon="calendar" label="Settlement" sublabel="T+1 rolling settlement" last />
        </Section>

        {/* About */}
        <Section title="ABOUT">
          <Row icon="info" label="TradeSignal Pro" sublabel="v1.0.0 · Angel One SmartAPI" />
          <Row icon="cpu" label="Engine" sublabel="Real-time multi-indicator analysis" />
          <Row icon="shield" label="Paper Mode Capital" sublabel="₹10,00,000 virtual funds" last />
        </Section>

        <Text style={styles.footer}>Made with ❤️ by Shahrukh{'\n'}For educational purposes only. Not financial advice.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  title: { fontSize: 22, fontFamily: FONTS.bold, color: COLORS.text },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.accentDim, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.accent },
  liveText: { fontSize: 10, fontFamily: FONTS.bold, color: COLORS.accent, letterSpacing: 1 },

  connectHero: { marginHorizontal: 16, marginBottom: 4, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: 'rgba(0,230,118,0.2)', overflow: 'hidden' },
  connectGradient: { padding: 16, gap: 12 },
  connectHeroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  connectHeroIcon: { width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: COLORS.accentDim, borderWidth: 1, borderColor: 'rgba(0,230,118,0.25)', alignItems: 'center', justifyContent: 'center' },
  connectHeroTitle: { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.text },
  connectHeroSub: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textMuted, marginTop: 2 },
  configBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.accentDim, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.md },
  configBadgeText: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.accent },
  connectBtn: { borderRadius: RADIUS.lg, overflow: 'hidden' },
  connectBtnGradient: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.lg },
  connectBtnText: { fontSize: 15, fontFamily: FONTS.bold, color: '#000' },

  profileCard: { marginHorizontal: 16, marginBottom: 4, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: 'rgba(0,230,118,0.2)', overflow: 'hidden' },
  profileGradient: { padding: 16, gap: 12 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.accentDim, borderWidth: 1, borderColor: 'rgba(0,230,118,0.3)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.accent },
  profileName: { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.text },
  profileSub: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textMuted, marginTop: 2 },
  disconnectBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.redDim, paddingHorizontal: 10, paddingVertical: 7, borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(255,69,96,0.2)' },
  disconnectText: { fontSize: 11, fontFamily: FONTS.semibold, color: COLORS.red },
  profileTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.cardBorder, flexDirection: 'row', alignItems: 'center' },
  tagText: { fontSize: 10, fontFamily: FONTS.semibold, color: COLORS.textSub },

  errorBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: COLORS.redDim, padding: 12, borderRadius: RADIUS.md },
  errorText: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.red, flex: 1, lineHeight: 18 },

  section: { marginBottom: 4 },
  sectionLabel: { fontSize: 10, fontFamily: FONTS.bold, color: COLORS.textMuted, letterSpacing: 1.2, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  sectionCard: { marginHorizontal: 16, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  rowIcon: { width: 32, height: 32, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.text },
  rowSublabel: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textMuted, marginTop: 1 },

  footer: { textAlign: 'center', fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textMuted, paddingVertical: 20, lineHeight: 18 },
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
});
