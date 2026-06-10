# Quant Trading Simulator

A web-based algorithmic trading backtester built with React and Vite. Type in any stock ticker, pick a strategy, and the app simulates what would have happened if a rules-based system had been trading it over the last 5 years — no emotions, just math.

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react) ![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat&logo=vite) ![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-38BDF8?style=flat&logo=tailwindcss) ![License](https://img.shields.io/badge/license-MIT-green?style=flat)

---

## What it does

The simulator pulls real historical price data for any stock, runs a moving average crossover strategy on it, and shows you whether that strategy would have beaten simply buying and holding the stock. Every result comes with a trade log, a Sharpe Ratio, and an Alpha comparison so you can actually judge if the robot was smart or just lucky.

**Strategies supported:** SMA (Simple Moving Average) and EMA (Exponential Moving Average) crossovers — both run in parallel so you can compare them head-to-head for the same stock.

**Indicators calculated:** 10/50-day fast and slow lines, 14-day Wilder's RSI, annualized Sharpe Ratio (adjusted against a 6% risk-free rate), and Alpha vs. Buy & Hold.

**Portfolio mode:** Add multiple stocks at once. The app splits your starting capital equally across them, runs isolated backtest engines for each, and gives you an aggregated net worth at the end.

---

## Getting started

### Prerequisites

- Node.js v18 or higher
- A free API key from [Twelve Data](https://twelvedata.com) — the free tier gives you 800 API credits/day which is enough for casual use

### Installation

```bash
git clone https://github.com/your-username/quant-trading-simulator.git
cd quant-trading-simulator
npm install
```

### Setting up your API key

Create a `.env` file in the root of the project:

```bash
touch .env
```

Add this line to it with your own key:

```
VITE_TWELVEDATA_KEY=your_api_key_here
```

> Your key is only used client-side and never sent anywhere except directly to Twelve Data's servers. It stays in your browser session.

Then start the dev server:

```bash
npm run dev
```

Open `http://localhost:5173` and you're good to go.

---

## How to use it

1. Type a stock ticker in the search bar — `AAPL`, `TSLA`, `RELIANCE.BSE`, `IBM`, etc.
2. Hit **Run Backtest**
3. Pick your strategy (SMA or EMA) from the dropdown
4. Read the dashboard — chart, trade log, performance card, and risk metrics all update automatically
5. Use the **Compare Strategies** panel to see which approach worked better for that specific stock
6. Click and drag on the chart to zoom into any time window — every indicator recalculates for that slice

---

## Errors you might run into

### Rate limit hit

**What it looks like:** The app shows a loading spinner that never resolves, or you get a blank chart after searching.

**Why it happens:** Twelve Data's free tier has a limit of 8 requests per minute and 800 credits per day. If you search for several stocks in quick succession, you'll hit the per-minute cap.

**Fix:** Wait 60 seconds and search again. The app caches every successful response in `sessionStorage`, so if you re-search the same ticker in the same browser session it loads instantly without touching the API.

---

### Stock not found / no data returned

**What it looks like:** The chart area stays empty or you see an error message about missing data.

**Why it happens:** A few possible reasons —

- The ticker symbol is wrong. US stocks use plain symbols like `AAPL` or `MSFT`. Indian stocks on BSE need the `.BSE` suffix (e.g., `RELIANCE.BSE`) and on NSE use `.NSE`.
- The stock is very thinly traded or a small-cap that Twelve Data's free tier doesn't cover.
- You searched for an index (like `NIFTY50`) instead of a tradeable stock — indices aren't supported.

**Fix:** Double-check the ticker on [Twelve Data's symbol search](https://twelvedata.com/stocks) before entering it.

---

### Moving average lines don't appear on the chart

**What it looks like:** The price line draws correctly but the 10-day and 50-day lines are missing.

**Why it happens:** The 50-day moving average needs at least 50 data points to start drawing. If you zoom into a very short window (fewer than 50 days), the slow line has nothing to calculate from.

**Fix:** Zoom out to a wider time window. The lines will reappear once the window is large enough.

---

### Chart zoom gets stuck

**What it looks like:** You zoomed in too far and can't zoom back out normally.

**Fix:** Use the **Zoom Out** button — it steps back through your zoom history one level at a time. If you want to reset everything, just re-run the backtest for the same ticker.

---

### Sharpe Ratio shows `NaN` or `0`

**What it looks like:** The risk metrics card shows `NaN` or an unexpected zero.

**Why it happens:** This usually means the strategy produced zero closed trades in the selected window — which happens when the fast and slow lines never crossed. A flat, sideways-moving stock can do this.

**Fix:** Try a different stock or a longer time window so the lines have a chance to cross.

---

## Project structure

```
src/
├── services/
│   └── priceService.js        # API calls, caching, data normalization
├── engine/
│   ├── indicators.js           # SMA, EMA, RSI, Sharpe Ratio math
│   ├── crossoverStrategy.js    # BUY/SELL/HOLD signal generation
│   └── backtestEngine.js       # Virtual wallet and trade simulation
├── components/
│   └── QuantSimApp.jsx         # Main UI, React state, SVG chart
└── main.jsx
```

Each module is fully decoupled. The math engine knows nothing about React. The strategy layer knows nothing about the API. If you want to add a new strategy (RSI breakout, Bollinger Bands, etc.), you only need to add one new file in `engine/` and wire it into the dropdown.

---

## Roadmap

These are the things I'm planning to build next. None of this is live yet — this is the honest list of where the project is going.

### Near-term

- [ ] Let users input a custom starting capital instead of the fixed default
- [ ] Add a transaction fee model (flat fee or percentage per trade) so results are more realistic
- [ ] Export trade log as CSV
- [ ] Add RSI momentum breakout as a third strategy option

### Hosting and auth (the real next milestone)

Right now this runs entirely in your browser with your own API key. The logical next step is proper hosting with real user accounts. Here's what that version of the project looks like:

- **User auth** — JWT-based login so each user has their own persistent session and saved backtests
- **Backend API proxy** — instead of exposing the Twelve Data key client-side, all API requests go through a Node/Express or Spring Boot backend. Each user gets rate-limited server-side so one person can't burn everyone's quota
- **Database layer (PostgreSQL)** — store each user's backtest history, saved strategies, and portfolio configurations so they persist across sessions
- **Per-user strategy configs** — save and name your own parameter sets (e.g., "my AAPL EMA setup") and reload them later

### Real data, real decisions

The most interesting future direction — let users mark any specific date on the chart and see exactly what the simulation would have decided on that day, based only on information available up to that point. No lookahead. Combined with 5 full years of data this would make the backtester genuinely useful for evaluating a strategy's consistency across different market conditions (bull runs, crashes, sideways periods).

---

## Tech stack

| Layer            | Tech                                       |
| ---------------- | ------------------------------------------ |
| Frontend         | React 18, Vite, Tailwind CSS v4            |
| Charting         | Hand-drawn SVG (no external chart library) |
| Data             | Twelve Data API                            |
| Caching          | Browser `sessionStorage`                   |
| State management | `useState`, `useEffect`, `useMemo`         |

---

## License

MIT — use it, fork it, break it, learn from it.

---

## Author

Built by Arpit — B.Tech CSE (Data Science) at MIT Bengaluru. This project is part of a larger goal of building production-grade quant finance tooling from scratch. If you have feedback on the architecture or find a bug, open an issue.
