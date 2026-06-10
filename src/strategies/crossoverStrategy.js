// src/strategies/crossoverStrategy.js
import { Indicators } from '../engine/indicator.js';

export const Strategies = {
  generateSignals: (type, prices, shortPeriod = 10, longPeriod = 50) => {
    if (shortPeriod >= longPeriod || prices.length < longPeriod) return [];
    const fastLine = type === 'EMA' ? Indicators.emaList(prices, shortPeriod) : Indicators.smaList(prices, shortPeriod);
    const slowLine = type === 'EMA' ? Indicators.emaList(prices, longPeriod) : Indicators.smaList(prices, longPeriod);
    const offset = fastLine.length - slowLine.length;
    const signals = [];

    for (let i = 1; i < slowLine.length; i++) {
      const prevFast = fastLine[i - 1 + offset];
      const currFast = fastLine[i + offset];
      const prevSlow = slowLine[i - 1];
      const currSlow = slowLine[i];

      if (prevFast <= prevSlow && currFast > currSlow) signals.push("BUY");
      else if (prevFast >= prevSlow && currFast < currSlow) signals.push("SELL");
      else signals.push("HOLD");
    }
    return signals;
  }
};