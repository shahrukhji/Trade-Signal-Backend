// ═══════════════════════════════════════════════════════════
// TradeSignal Pro — Advanced Risk Management
// Ensures we never blow up the account
// Made with ❤️ by Shahrukh
// ═══════════════════════════════════════════════════════════

export interface RiskAssessment {
  maxPositionSize: number;
  maxCapitalForTrade: number;
  riskAmount: number;
  riskPercent: number;
  kellyCriterionSize: number;
  riskRating: 'SAFE' | 'MODERATE' | 'RISKY' | 'DANGEROUS';
  warnings: string[];
  approved: boolean;
}

export function assessTradeRisk(
  totalCapital: number,
  entryPrice: number,
  stopLoss: number,
  quantity: number,
  maxRiskPercent: number = 2,
  currentExposure: number = 0,
  winRate: number = 55,
  avgWinPercent: number = 3,
  avgLossPercent: number = 1.5
): RiskAssessment {
  const riskPerShare = Math.abs(entryPrice - stopLoss);
  const totalRisk = riskPerShare * quantity;
  const tradeValue = entryPrice * quantity;
  const riskPercent = (totalRisk / totalCapital) * 100;

  // Kelly Criterion: f = (p*b - (1-p)) / b
  const p = winRate / 100;
  const b = avgWinPercent / avgLossPercent;
  const kelly = Math.max(0, (p * b - (1 - p)) / b);
  const kellyShares = riskPerShare > 0 ? Math.floor((totalCapital * kelly) / entryPrice) : 0;

  const maxRiskAmount = totalCapital * (maxRiskPercent / 100);
  const maxShares = riskPerShare > 0 ? Math.floor(maxRiskAmount / riskPerShare) : 0;

  const totalExposure = currentExposure + tradeValue;
  const exposurePercent = (totalExposure / totalCapital) * 100;

  const warnings: string[] = [];
  let riskRating: RiskAssessment['riskRating'] = 'SAFE';
  let approved = true;

  if (riskPercent > maxRiskPercent * 2) {
    riskRating = 'DANGEROUS';
    warnings.push(`⛔ Risk ${riskPercent.toFixed(1)}% is MORE THAN DOUBLE your max ${maxRiskPercent}%! Reduce to ${maxShares} shares.`);
    approved = false;
  } else if (riskPercent > maxRiskPercent) {
    riskRating = 'RISKY';
    warnings.push(`⚠️ Risk ${riskPercent.toFixed(1)}% exceeds your ${maxRiskPercent}% limit. Recommended max: ${maxShares} shares.`);
  } else if (riskPercent > maxRiskPercent * 0.7) {
    riskRating = 'MODERATE';
    warnings.push(`📊 Risk ${riskPercent.toFixed(1)}% is approaching your ${maxRiskPercent}% limit.`);
  }

  if (exposurePercent > 80) {
    warnings.push(`⚠️ Total portfolio exposure will be ${exposurePercent.toFixed(0)}% — Very concentrated!`);
    if (exposurePercent > 95) {
      approved = false;
      warnings.push('⛔ Portfolio over-exposed. Reduce positions before adding new ones.');
    }
  }

  if (quantity > kellyShares * 1.5 && kellyShares > 0) {
    warnings.push(`📐 Kelly Criterion suggests max ${kellyShares} shares for optimal position sizing.`);
  }

  if (riskPerShare / entryPrice > 0.05) {
    warnings.push(`⚠️ Stop loss ${((riskPerShare / entryPrice) * 100).toFixed(1)}% away from entry — Very wide. Consider tighter stop.`);
  }

  if (warnings.length === 0) {
    warnings.push(`✅ Trade risk is SAFE at ${riskPercent.toFixed(2)}% of capital. Position size approved.`);
  }

  return {
    maxPositionSize: maxShares,
    maxCapitalForTrade: maxRiskAmount / (riskPerShare / entryPrice || 1),
    riskAmount: Math.round(totalRisk * 100) / 100,
    riskPercent: Math.round(riskPercent * 100) / 100,
    kellyCriterionSize: kellyShares,
    riskRating,
    warnings,
    approved,
  };
}

export function calculatePositionSize(
  capital: number,
  entryPrice: number,
  stopLoss: number,
  riskPercent: number = 1
): { shares: number; riskAmount: number; tradeValue: number } {
  const riskPerShare = Math.abs(entryPrice - stopLoss);
  const riskAmount = capital * (riskPercent / 100);
  const shares = riskPerShare > 0 ? Math.floor(riskAmount / riskPerShare) : 0;
  return { shares, riskAmount, tradeValue: shares * entryPrice };
}

export function getRiskRatingColor(rating: RiskAssessment['riskRating']): string {
  const map = { SAFE: '#00FF88', MODERATE: '#FFD700', RISKY: '#FF8C00', DANGEROUS: '#FF3366' };
  return map[rating];
}
