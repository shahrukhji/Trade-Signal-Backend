import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet,
  Switch, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, type SavedCredentials } from '@/context/AppContext';
import { COLORS, FONTS, RADIUS } from '@/constants/theme';

// ─── Reusable row ─────────────────────────────────────────────────────────────
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────
function Field({
  label, value, onChangeText, placeholder, secure, hint,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder: string; secure?: boolean; hint?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          secureTextEntry={secure && !show}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.fieldInput, secure && { paddingRight: 44 }]}
        />
        {secure && (
          <Pressable onPress={() => setShow(v => !v)} style={styles.eyeBtn}>
            <Feather name={show ? 'eye-off' : 'eye'} size={16} color={COLORS.textMuted} />
          </Pressable>
        )}
      </View>
      {hint && <Text style={styles.fieldHint}>{hint}</Text>}
    </View>
  );
}

// ─── Strategy guide data ──────────────────────────────────────────────────────
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

// ─── Main component ───────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    session, savedCredentials, paperMode, configStatus,
    setPaperMode, connectWithSaved, saveCredentials,
    clearCredentials, disconnect, isConnecting, connectError,
  } = useApp();

  // Form state for first-time / edit mode
  const [editMode, setEditMode] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [expandedStrat, setExpandedStrat] = useState<number | null>(null);

  const [clientCode, setClientCode] = useState(savedCredentials?.clientCode ?? '');
  const [password, setPassword] = useState(savedCredentials?.password ?? '');
  const [apiKey, setApiKey] = useState(savedCredentials?.apiKey ?? '');
  const [totpSecret, setTotpSecret] = useState(savedCredentials?.totpSecret ?? '');
  const [formError, setFormError] = useState('');

  const handleSaveAndConnect = async () => {
    if (!clientCode.trim()) return setFormError('Client ID is required');
    if (!password.trim()) return setFormError('PIN / Password is required');
    if (!apiKey.trim()) return setFormError('API Key is required');
    if (!totpSecret.trim()) return setFormError('TOTP Secret is required (for auto-generation)');
    setFormError('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const creds: SavedCredentials = {
      clientCode: clientCode.trim(),
      password: password.trim(),
      apiKey: apiKey.trim(),
      totpSecret: totpSecret.trim(),
    };
    await saveCredentials(creds);
    setEditMode(false);
  };

  const handleQuickConnect = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    connectWithSaved();
  };

  const handleDisconnect = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    disconnect();
  };

  const handleEditCreds = () => {
    setClientCode(savedCredentials?.clientCode ?? '');
    setPassword(savedCredentials?.password ?? '');
    setApiKey(savedCredentials?.apiKey ?? '');
    setTotpSecret(savedCredentials?.totpSecret ?? '');
    setFormError('');
    setEditMode(true);
  };

  const handleDeleteCreds = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await clearCredentials();
    setClientCode(''); setPassword(''); setApiKey(''); setTotpSecret('');
  };

  // ─── Strategy Guide ──────────────────────────────────────────────────────
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.stratNum}><Text style={styles.stratNumText}>{i + 1}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stratName}>{s.name}</Text>
                  <Text style={styles.stratParams}>{s.params}</Text>
                </View>
                <Feather name={expandedStrat === i ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textMuted} />
              </View>
              {expandedStrat === i && <Text style={styles.stratDesc}>{s.desc}</Text>}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  }

  // ─── First-time Setup Form OR Edit Credentials ───────────────────────────
  const showForm = !savedCredentials || editMode;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        {session && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
        {!session && savedCredentials && !editMode && (
          <View style={styles.savedBadge}>
            <Feather name="check-circle" size={12} color={COLORS.accent} />
            <Text style={styles.savedText}>Saved</Text>
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>

        {/* ═══ STATE 1: First-time OR Edit Mode — Credential form ═══ */}
        {showForm && !session && (
          <View style={styles.formCard}>
            {/* Title */}
            <View style={styles.formHeader}>
              <View style={styles.formIconWrap}>
                <Feather name={editMode ? 'edit-2' : 'link'} size={22} color={COLORS.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.formTitle}>
                  {editMode ? 'Update Credentials' : 'Angel One Setup'}
                </Text>
                <Text style={styles.formSub}>
                  {editMode
                    ? 'Update your saved credentials'
                    : 'Enter once — saved securely on your device'}
                </Text>
              </View>
              {editMode && (
                <Pressable onPress={() => setEditMode(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              )}
            </View>

            {/* Fields */}
            <Field
              label="Client ID *"
              value={clientCode}
              onChangeText={setClientCode}
              placeholder="e.g. A1234567"
              hint="Your Angel One login ID"
            />
            <Field
              label="PIN / Password *"
              value={password}
              onChangeText={setPassword}
              placeholder="Your Angel One PIN"
              secure
            />
            <Field
              label="SmartAPI Key *"
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="From smartapi.angelone.in"
              secure
              hint="Generate at smartapi.angelone.in → Apps"
            />
            <Field
              label="TOTP Secret *"
              value={totpSecret}
              onChangeText={setTotpSecret}
              placeholder="Base32 secret (e.g. JBSWY3DPEHPK3PXP)"
              secure
              hint="Enable TOTP in Angel One → My Profile → Security Settings"
            />

            {/* Error */}
            {(formError || connectError) ? (
              <View style={styles.errorBanner}>
                <Feather name="alert-circle" size={14} color={COLORS.red} />
                <Text style={styles.errorText}>{formError || connectError}</Text>
              </View>
            ) : null}

            {/* Save & Connect button */}
            <Pressable
              onPress={handleSaveAndConnect}
              disabled={isConnecting}
              style={({ pressed }) => [{ opacity: pressed || isConnecting ? 0.85 : 1 }]}
            >
              <LinearGradient
                colors={isConnecting ? [COLORS.accentDim, COLORS.accentDim] : ['#00E676', '#00C853']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.saveBtn}
              >
                {isConnecting
                  ? <><ActivityIndicator size="small" color={COLORS.accent} style={{ marginRight: 8 }} /><Text style={[styles.saveBtnText, { color: COLORS.accent }]}>Connecting...</Text></>
                  : <><Feather name="save" size={18} color="#000" style={{ marginRight: 8 }} /><Text style={styles.saveBtnText}>{editMode ? 'Update & Connect' : 'Save & Connect'}</Text></>
                }
              </LinearGradient>
            </Pressable>

            <Text style={styles.privacyNote}>
              🔒 Credentials saved locally on your device only. Never sent to third parties.
            </Text>
          </View>
        )}

        {/* ═══ STATE 2: Saved credentials, NOT connected — Quick Connect ═══ */}
        {savedCredentials && !session && !editMode && (
          <View style={styles.quickCard}>
            <LinearGradient
              colors={['rgba(0,230,118,0.09)', 'rgba(0,230,118,0.02)']}
              style={styles.quickGradient}
            >
              {/* Credential summary */}
              <View style={styles.credRow}>
                <View style={styles.credIconWrap}>
                  <Feather name="user" size={18} color={COLORS.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.credId}>{savedCredentials.clientCode}</Text>
                  <Text style={styles.credSub}>Angel One · API key saved · TOTP auto-generated</Text>
                </View>
              </View>

              {/* Error from last attempt */}
              {connectError ? (
                <View style={styles.errorBanner}>
                  <Feather name="alert-circle" size={14} color={COLORS.red} />
                  <Text style={styles.errorText}>{connectError}</Text>
                </View>
              ) : null}

              {/* Quick Connect button */}
              <Pressable
                onPress={isConnecting ? undefined : handleQuickConnect}
                disabled={isConnecting}
                style={({ pressed }) => [{ opacity: pressed || isConnecting ? 0.85 : 1 }]}
              >
                <LinearGradient
                  colors={isConnecting ? [COLORS.accentDim, COLORS.accentDim] : ['#00E676', '#00C853']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.saveBtn}
                >
                  {isConnecting
                    ? <><ActivityIndicator size="small" color={COLORS.accent} style={{ marginRight: 8 }} /><Text style={[styles.saveBtnText, { color: COLORS.accent }]}>Connecting...</Text></>
                    : <><Feather name="wifi" size={18} color="#000" style={{ marginRight: 8 }} /><Text style={styles.saveBtnText}>Quick Connect</Text></>
                  }
                </LinearGradient>
              </Pressable>

              {/* Edit / Delete row */}
              <View style={styles.credsActions}>
                <Pressable onPress={handleEditCreds} style={styles.credsActionBtn}>
                  <Feather name="edit-2" size={13} color={COLORS.textSub} />
                  <Text style={styles.credsActionText}>Edit Credentials</Text>
                </Pressable>
                <View style={styles.credsActionDivider} />
                <Pressable onPress={handleDeleteCreds} style={styles.credsActionBtn}>
                  <Feather name="trash-2" size={13} color={COLORS.red} />
                  <Text style={[styles.credsActionText, { color: COLORS.red }]}>Remove Saved</Text>
                </Pressable>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* ═══ STATE 3: Connected — Profile card ═══ */}
        {session && (
          <View style={styles.profileCard}>
            <LinearGradient
              colors={['rgba(0,230,118,0.10)', 'rgba(0,230,118,0.03)']}
              style={styles.profileGradient}
            >
              <View style={styles.profileRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {session.clientName.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'T'}
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
                  <View key={ex} style={styles.tag}><Text style={styles.tagText}>{ex}</Text></View>
                ))}
                <View style={[styles.tag, { borderColor: COLORS.accent + '40', backgroundColor: COLORS.accentDim }]}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.accent, marginRight: 4 }} />
                  <Text style={[styles.tagText, { color: COLORS.accent }]}>Connected</Text>
                </View>
              </View>
              {savedCredentials && (
                <Pressable onPress={handleEditCreds} style={styles.editCredsLink}>
                  <Feather name="edit-2" size={12} color={COLORS.textMuted} />
                  <Text style={styles.editCredsText}>Edit saved credentials</Text>
                </Pressable>
              )}
            </LinearGradient>
          </View>
        )}

        {/* ─── Trading Mode ─────────────────────────────────────────────── */}
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

        {/* ─── Features ─────────────────────────────────────────────────── */}
        <Section title="FEATURES">
          <Row icon="zap" label="25+ Technical Indicators" sublabel="EMA, MACD, RSI, Bollinger, VWAP, ATR..." />
          <Row icon="target" label="10 Algorithmic Strategies" sublabel="EMA Crossover, Supertrend, VWAP Bounce..." />
          <Row
            icon="book-open"
            label="Strategy & Indicator Guide"
            sublabel="Full details on all strategies"
            onPress={() => { setShowGuide(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            last
          />
        </Section>

        {/* ─── Market Info ──────────────────────────────────────────────── */}
        <Section title="MARKET INFORMATION">
          <Row icon="activity" label="Supported Exchanges" sublabel="NSE, BSE, NFO (Futures & Options)" />
          <Row icon="clock" label="Market Hours" sublabel="Mon–Fri · 09:15 – 15:30 IST" last />
        </Section>

        {/* ─── About ────────────────────────────────────────────────────── */}
        <Section title="ABOUT">
          <Row icon="info" label="TradeSignal Pro" sublabel="v1.0.0 · Angel One SmartAPI" last />
        </Section>

        <Text style={styles.footer}>Made with ❤️ by Shahrukh{'\n'}For educational purposes only. Not financial advice.</Text>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  title: { fontSize: 22, fontFamily: FONTS.bold, color: COLORS.text },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.accentDim, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.accent },
  liveText: { fontSize: 10, fontFamily: FONTS.bold, color: COLORS.accent, letterSpacing: 1 },
  savedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.accentDim, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full },
  savedText: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.accent },

  // ─── Form ──────────────────────────────────────────────────────────────
  formCard: { marginHorizontal: 16, marginBottom: 4, backgroundColor: COLORS.card, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 16, gap: 12 },
  formHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 4 },
  formIconWrap: { width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: COLORS.accentDim, borderWidth: 1, borderColor: 'rgba(0,230,118,0.25)', alignItems: 'center', justifyContent: 'center' },
  formTitle: { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.text },
  formSub: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textMuted, marginTop: 2, lineHeight: 15 },
  cancelBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.cardBorder },
  cancelText: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textSub },
  field: { gap: 4 },
  fieldLabel: { fontSize: 11, fontFamily: FONTS.semibold, color: COLORS.textMuted, letterSpacing: 0.3 },
  fieldWrap: { position: 'relative' },
  fieldInput: {
    height: 46, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.md, paddingHorizontal: 12, fontSize: 14, fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  eyeBtn: { position: 'absolute', right: 12, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', width: 36 },
  fieldHint: { fontSize: 10, fontFamily: FONTS.regular, color: COLORS.textMuted, lineHeight: 14 },
  saveBtn: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.lg },
  saveBtnText: { fontSize: 15, fontFamily: FONTS.bold, color: '#000' },
  privacyNote: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textMuted, textAlign: 'center', lineHeight: 16 },

  // ─── Quick Connect card ─────────────────────────────────────────────────
  quickCard: { marginHorizontal: 16, marginBottom: 4, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: 'rgba(0,230,118,0.2)', overflow: 'hidden' },
  quickGradient: { padding: 16, gap: 12 },
  credRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  credIconWrap: { width: 42, height: 42, borderRadius: RADIUS.md, backgroundColor: COLORS.accentDim, borderWidth: 1, borderColor: 'rgba(0,230,118,0.25)', alignItems: 'center', justifyContent: 'center' },
  credId: { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.text },
  credSub: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textMuted, marginTop: 2 },
  credsActions: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder, overflow: 'hidden' },
  credsActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  credsActionDivider: { width: 1, height: 20, backgroundColor: COLORS.cardBorder },
  credsActionText: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textSub },

  // ─── Connected profile ──────────────────────────────────────────────────
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
  editCredsLink: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  editCredsText: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textMuted },

  // ─── Shared ─────────────────────────────────────────────────────────────
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

  // ─── Guide ──────────────────────────────────────────────────────────────
  guideHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.cardBorder },
  guideTitle: { fontSize: 18, fontFamily: FONTS.semibold, color: COLORS.text },
  guideIntro: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSub, lineHeight: 20, margin: 16, padding: 14, backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder },
  guideSectionTitle: { fontSize: 10, fontFamily: FONTS.bold, color: COLORS.textMuted, letterSpacing: 1.2, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  stratCard: { marginHorizontal: 16, marginBottom: 8, backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 12, gap: 8 },
  stratNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.accentDim, alignItems: 'center', justifyContent: 'center' },
  stratNumText: { fontSize: 11, fontFamily: FONTS.bold, color: COLORS.accent },
  stratName: { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.text },
  stratParams: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.accent, marginTop: 2 },
  stratDesc: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textSub, lineHeight: 18, paddingTop: 4, borderTopWidth: 1, borderTopColor: COLORS.divider },
});
