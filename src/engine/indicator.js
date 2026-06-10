// src/engine/indicators.js

export const Indicators = {
  sma: (prices, period) => {
    if (prices.length < period) return -1;
    let sum = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
      sum += prices[i];
    }
    return sum / period;
  },

  smaList: (prices, period) => {
    const result = [];
    for (let i = period - 1; i < prices.length; i++) {
      result.push(Indicators.sma(prices.slice(0, i + 1), period));
    }
    return result;
  },

  emaList: (prices, period) => {
    const result = [];
    if (prices.length < period) return result;
    const k = 2.0 / (period + 1);
    const seed = Indicators.sma(prices.slice(0, period), period);
    result.push(seed);

    for (let i = period; i < prices.length; i++) {
      const ema = (prices[i] * k) + (result[result.length - 1] * (1 - k));
      result.push(ema);
    }
    return result;
  },

  rsi: (prices, period = 14) => {
    if (prices.length < period + 1) return -1;
    let avgGain = 0;
    let avgLoss = 0;

    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change >= 0) avgGain += change;
      else avgLoss += Math.abs(change);
    }
    avgGain /= period;
    avgLoss /= period;

    for (let i = period + 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change >= 0) {
        avgGain = (avgGain * (period - 1) + change) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
      }
    }

    if (avgLoss === 0) return 100;
    return 100 - (100 / (1 + (avgGain / avgLoss)));
  },

  stdDev: (values) => {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  },

  dailyReturns: (prices) => {
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    return returns;
  },

  sharpeRatio: (prices) => {
    const returns = Indicators.dailyReturns(prices);
    if (returns.length === 0) return 0;
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const std = Indicators.stdDev(returns);
    if (std === 0) return 0;
    return ((avgReturn - (0.06 / 252)) / std) * Math.sqrt(252);
  }
};