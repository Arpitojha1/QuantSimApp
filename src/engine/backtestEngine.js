// src/engine/backtestEngine.js

export class BacktestEngine {
  constructor(initialCash) {
    this.initialCash = initialCash;
    this.cash = initialCash;
    this.sharesHeld = 0;
    this.lastBuyPrice = 0;
    this.wins = 0;
    this.losses = 0;
    this.trades = [];
  }

  run(prices, signals) {
    if (!signals || signals.length === 0) return;
    const offset = prices.length - signals.length;

    for (let i = 0; i < signals.length; i++) {
      const price = prices[i + offset];
      const signal = signals[i];
      const dayIndex = i + offset;

      if (signal === "BUY" && this.cash >= price) {
        const qty = Math.floor(this.cash / price);
        if (qty > 0) {
          this.sharesHeld += qty;
          this.lastBuyPrice = price;
          this.cash -= qty * price;
          this.trades.push({ type: "BUY", price, quantity: qty, dayIndex });
        }
      } else if (signal === "SELL" && this.sharesHeld > 0) {
        if (price > this.lastBuyPrice) this.wins++;
        else this.losses++;
        this.cash += this.sharesHeld * price;
        this.trades.push({ type: "SELL", price, quantity: this.sharesHeld, dayIndex });
        this.sharesHeld = 0;
      }
    }
  }
}