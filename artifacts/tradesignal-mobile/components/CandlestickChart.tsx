import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Rect, Path, Defs, LinearGradient as SVGLinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { COLORS, FONTS } from '@/constants/theme';

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Props {
  candles: Candle[];
  width: number;
  height: number;
  ema9?: number[];
  ema21?: number[];
  bbUpper?: number[];
  bbLower?: number[];
}

export function CandlestickChart({ candles, width, height, ema9, ema21, bbUpper, bbLower }: Props) {
  const PAD = { top: 12, bottom: 32, left: 4, right: 44 };
  const chartW = width - PAD.left - PAD.right;
  const chartH = height - PAD.top - PAD.bottom;

  const { minPrice, maxPrice, candleW, candleGap } = useMemo(() => {
    if (candles.length === 0) return { minPrice: 0, maxPrice: 1, candleW: 8, candleGap: 2 };
    const lows = candles.map(c => c.low);
    const highs = candles.map(c => c.high);
    const allExtra: number[] = [];
    if (bbUpper) allExtra.push(...bbUpper.filter(v => !isNaN(v)));
    if (bbLower) allExtra.push(...bbLower.filter(v => !isNaN(v)));
    const min = Math.min(...lows, ...allExtra) * 0.999;
    const max = Math.max(...highs, ...allExtra) * 1.001;
    const total = chartW / candles.length;
    const gap = Math.max(1, total * 0.15);
    const cw = Math.max(2, total - gap);
    return { minPrice: min, maxPrice: max, candleW: cw, candleGap: gap };
  }, [candles, chartW, bbUpper, bbLower]);

  const priceRange = maxPrice - minPrice || 1;
  const toY = (p: number) => PAD.top + chartH - ((p - minPrice) / priceRange) * chartH;
  const toX = (i: number) => PAD.left + i * (candleW + candleGap) + candleW / 2;

  const priceLabels = useMemo(() => {
    const count = 4;
    return Array.from({ length: count + 1 }, (_, i) => ({
      price: minPrice + (priceRange * i) / count,
      y: toY(minPrice + (priceRange * i) / count),
    }));
  }, [minPrice, priceRange]);

  const emaPath9 = useMemo(() => {
    if (!ema9) return '';
    let d = '';
    ema9.forEach((v, i) => {
      if (isNaN(v)) return;
      const x = toX(i); const y = toY(v);
      d += d === '' ? `M${x},${y}` : `L${x},${y}`;
    });
    return d;
  }, [ema9]);

  const emaPath21 = useMemo(() => {
    if (!ema21) return '';
    let d = '';
    ema21.forEach((v, i) => {
      if (isNaN(v)) return;
      const x = toX(i); const y = toY(v);
      d += d === '' ? `M${x},${y}` : `L${x},${y}`;
    });
    return d;
  }, [ema21]);

  const bbUpperPath = useMemo(() => {
    if (!bbUpper) return '';
    let d = '';
    bbUpper.forEach((v, i) => {
      if (isNaN(v)) return;
      d += d === '' ? `M${toX(i)},${toY(v)}` : `L${toX(i)},${toY(v)}`;
    });
    return d;
  }, [bbUpper]);

  const bbLowerPath = useMemo(() => {
    if (!bbLower) return '';
    let d = '';
    bbLower.forEach((v, i) => {
      if (isNaN(v)) return;
      d += d === '' ? `M${toX(i)},${toY(v)}` : `L${toX(i)},${toY(v)}`;
    });
    return d;
  }, [bbLower]);

  if (candles.length === 0) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={styles.emptyText}>No data</Text>
      </View>
    );
  }

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SVGLinearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={COLORS.surface} stopOpacity="1" />
          <Stop offset="1" stopColor={COLORS.bg} stopOpacity="1" />
        </SVGLinearGradient>
      </Defs>

      {/* Grid lines */}
      {priceLabels.map((l, i) => (
        <React.Fragment key={i}>
          <Line
            x1={PAD.left} y1={l.y}
            x2={width - PAD.right} y2={l.y}
            stroke={COLORS.divider} strokeWidth={0.5}
          />
          <SvgText
            x={width - PAD.right + 4} y={l.y + 4}
            fontSize={9} fill={COLORS.textMuted}
            fontFamily={FONTS.regular}
          >
            {l.price >= 1000 ? (l.price / 1000).toFixed(1) + 'k' : l.price.toFixed(0)}
          </SvgText>
        </React.Fragment>
      ))}

      {/* Bollinger Bands */}
      {bbUpperPath ? <Path d={bbUpperPath} stroke="rgba(41,121,255,0.4)" strokeWidth={1} fill="none" strokeDasharray="3,3" /> : null}
      {bbLowerPath ? <Path d={bbLowerPath} stroke="rgba(41,121,255,0.4)" strokeWidth={1} fill="none" strokeDasharray="3,3" /> : null}

      {/* EMA lines */}
      {emaPath9 ? <Path d={emaPath9} stroke="#FFB300" strokeWidth={1.5} fill="none" /> : null}
      {emaPath21 ? <Path d={emaPath21} stroke="#2979FF" strokeWidth={1.5} fill="none" /> : null}

      {/* Candles */}
      {candles.map((c, i) => {
        const x = PAD.left + i * (candleW + candleGap);
        const isBull = c.close >= c.open;
        const color = isBull ? COLORS.accent : COLORS.red;
        const bodyTop = toY(Math.max(c.open, c.close));
        const bodyBot = toY(Math.min(c.open, c.close));
        const bodyH = Math.max(1, bodyBot - bodyTop);
        const midX = x + candleW / 2;
        return (
          <React.Fragment key={i}>
            <Line x1={midX} y1={toY(c.high)} x2={midX} y2={toY(c.low)} stroke={color} strokeWidth={1} />
            <Rect x={x} y={bodyTop} width={candleW} height={bodyH}
              fill={isBull ? COLORS.accent : COLORS.red}
              fillOpacity={isBull ? 0.85 : 0.75}
              rx={1}
            />
          </React.Fragment>
        );
      })}

      {/* X axis time labels */}
      {candles.length > 0 && [0, Math.floor(candles.length / 2), candles.length - 1].map(i => {
        const c = candles[i];
        const d = new Date(c.time * 1000);
        const label = `${d.getDate()}/${d.getMonth() + 1}`;
        return (
          <SvgText key={i} x={toX(i)} y={height - 4}
            textAnchor="middle" fontSize={9} fill={COLORS.textMuted}
            fontFamily={FONTS.regular}
          >{label}</SvgText>
        );
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: COLORS.textMuted, fontSize: 13, fontFamily: FONTS.regular },
});
