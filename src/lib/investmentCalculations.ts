/**
 * Investment Calculations Utility
 * Handles projection math, daily valuations, and contribution totals
 */

export interface InvestmentTransaction {
  id: string;
  transaction_date: string;
  type: 'deposit' | 'withdrawal' | 'fee' | 'dividend';
  amount: number;
}

export interface InvestmentValuation {
  valuation_date: string;
  value: number;
  source: 'manual' | 'estimated' | 'live';
}

export interface DailyValue {
  date: string;
  value: number;
  source: 'manual' | 'estimated';
  contributions: number;
  growth: number;
}

/**
 * Calculate daily growth rate from annual return
 */
export function getDailyRate(annualReturn: number): number {
  return Math.pow(1 + annualReturn / 100, 1 / 365) - 1;
}

/**
 * Calculate total contributions (deposits - withdrawals - fees)
 */
export function calculateContributionTotal(transactions: InvestmentTransaction[]): number {
  return transactions.reduce((total, tx) => {
    const amount = Math.abs(tx.amount);
    if (tx.type === 'deposit' || tx.type === 'dividend') {
      return total + amount;
    } else if (tx.type === 'withdrawal' || tx.type === 'fee') {
      return total - amount;
    }
    return total;
  }, 0);
}

/**
 * Calculate net deposits only (deposits - withdrawals)
 */
export function calculateNetDeposits(transactions: InvestmentTransaction[]): number {
  return transactions.reduce((total, tx) => {
    const amount = Math.abs(tx.amount);
    if (tx.type === 'deposit') {
      return total + amount;
    } else if (tx.type === 'withdrawal') {
      return total - amount;
    }
    return total;
  }, 0);
}

/**
 * Calculate daily estimated values from start date to end date
 * Uses compound interest formula with daily contributions
 */
export function calculateDailyValues(
  transactions: InvestmentTransaction[],
  manualValuations: InvestmentValuation[],
  startDate: Date,
  endDate: Date,
  expectedAnnualReturn: number
): DailyValue[] {
  const dailyRate = getDailyRate(expectedAnnualReturn);
  const values: DailyValue[] = [];
  
  // Sort transactions by date
  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
  );
  
  // Create a map of manual valuations
  const manualMap = new Map(
    manualValuations.map(v => [v.valuation_date, v.value])
  );
  
  let currentValue = 0;
  let totalContributions = 0;
  let txIndex = 0;
  
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    
    // Apply any transactions for this date
    while (
      txIndex < sortedTransactions.length &&
      sortedTransactions[txIndex].transaction_date === dateStr
    ) {
      const tx = sortedTransactions[txIndex];
      const amount = Math.abs(tx.amount);
      
      if (tx.type === 'deposit' || tx.type === 'dividend') {
        currentValue += amount;
        totalContributions += amount;
      } else if (tx.type === 'withdrawal' || tx.type === 'fee') {
        currentValue -= amount;
        if (tx.type === 'withdrawal') {
          totalContributions -= amount;
        }
      }
      
      txIndex++;
    }
    
    // Apply daily growth
    if (currentValue > 0) {
      currentValue *= (1 + dailyRate);
    }
    
    // Check if we have a manual valuation for this date
    const manualValue = manualMap.get(dateStr);
    const value = manualValue !== undefined ? manualValue : currentValue;
    const source = manualValue !== undefined ? 'manual' : 'estimated';
    
    // If manual value exists, update our running value
    if (manualValue !== undefined) {
      currentValue = manualValue;
    }
    
    const growth = value - totalContributions;
    
    values.push({
      date: dateStr,
      value: Math.max(0, value),
      source,
      contributions: totalContributions,
      growth: growth,
    });
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return values;
}

/**
 * Calculate future projection
 */
export function calculateProjection(
  currentValue: number,
  monthlyContribution: number,
  expectedAnnualReturn: number,
  months: number
): number {
  const monthlyRate = Math.pow(1 + expectedAnnualReturn / 100, 1 / 12) - 1;
  let value = currentValue;
  
  for (let i = 0; i < months; i++) {
    value += monthlyContribution;
    value *= (1 + monthlyRate);
  }
  
  return value;
}

/**
 * Calculate projection with multiple scenarios
 */
export function calculateProjectionScenarios(
  currentValue: number,
  monthlyContribution: number,
  expectedAnnualReturn: number,
  months: number
): { expected: number; conservative: number; aggressive: number } {
  return {
    expected: calculateProjection(currentValue, monthlyContribution, expectedAnnualReturn, months),
    conservative: calculateProjection(currentValue, monthlyContribution, expectedAnnualReturn - 3, months),
    aggressive: calculateProjection(currentValue, monthlyContribution, expectedAnnualReturn + 4, months),
  };
}

/**
 * Generate projection chart data
 */
export function generateProjectionData(
  currentValue: number,
  monthlyContribution: number,
  expectedAnnualReturn: number,
  monthsAhead: number
): { date: string; value: number }[] {
  const data: { date: string; value: number }[] = [];
  const today = new Date();
  const monthlyRate = Math.pow(1 + expectedAnnualReturn / 100, 1 / 12) - 1;
  
  let value = currentValue;
  
  for (let i = 0; i <= monthsAhead; i++) {
    const date = new Date(today);
    date.setMonth(date.getMonth() + i);
    
    if (i > 0) {
      value += monthlyContribution;
      value *= (1 + monthlyRate);
    }
    
    data.push({
      date: date.toISOString().split('T')[0],
      value: Math.round(value * 100) / 100,
    });
  }
  
  return data;
}

/**
 * Risk preset returns
 */
export const RISK_PRESETS = {
  conservative: 5,
  medium: 8,
  aggressive: 12,
} as const;

/**
 * Calculate percentage return
 */
export function calculateReturn(currentValue: number, totalContributions: number): number {
  if (totalContributions <= 0) return 0;
  return ((currentValue - totalContributions) / totalContributions) * 100;
}

/**
 * Calculate daily change (assumes constant daily growth)
 */
export function calculateDailyChange(currentValue: number, expectedAnnualReturn: number): {
  amount: number;
  percentage: number;
} {
  const dailyRate = getDailyRate(expectedAnnualReturn);
  const previousValue = currentValue / (1 + dailyRate);
  
  return {
    amount: currentValue - previousValue,
    percentage: dailyRate * 100,
  };
}
