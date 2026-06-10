// src/api/priceService.js

export const fetchTwelveDataPrices = async (symbol) => {
  // 1. Updated key to v3 to wipe out the old 1-year cache records from memory
  const cacheKey = `quant_twelve_v3_${symbol}`;
  const cachedData = sessionStorage.getItem(cacheKey);
  if (cachedData) return JSON.parse(cachedData);

  const apiKey = import.meta.env.VITE_TWELVEDATA_KEY;
  if (!apiKey) throw new Error("Missing Twelve Data API Key!");

  // 2. CHANGED: Boosted outputsize to 1300 to pull down 5 full years of stock history
  const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=1300&apikey=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Server returned network failure status: ${response.status}`);
  const data = await response.json();

  if (data.status === "error") {
    throw new Error(`Twelve Data API Error: ${data.message}`);
  }

  const values = data.values;
  if (!values || values.length === 0) {
    throw new Error("Empty history dataset returned from backend service.");
  }

  const parsedPrices = values.map(item => ({
    date: item.datetime,
    close: parseFloat(item.close)
  }));
  
  const chronological = parsedPrices.reverse();
  sessionStorage.setItem(cacheKey, JSON.stringify(chronological));
  return chronological;
};