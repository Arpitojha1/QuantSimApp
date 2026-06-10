import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Indicators } from '../engine/indicator.js';
import { Strategies } from '../strategies/crossoverStrategy.js';
import { BacktestEngine } from '../engine/backtestEngine.js';
import { fetchTwelveDataPrices } from '../api/priceService.js';

export default function QuantSimApp() {
  // 1. Navigation Routing & Settings States
  const [activeTab, setActiveTab] = useState('dashboard');
  const [symbolInput, setSymbolInput] = useState('IBM');
  const [strategyChoice, setStrategyChoice] = useState('EMA');
  const [timeframeDays, setTimeframeDays] = useState(252); 

  // 2. Click-and-Drag Zoom History Engine
  const [zoomRange, setZoomRange] = useState(null); 
  const [zoomHistory, setZoomHistory] = useState([]); 
  const [dragStart, setDragStart] = useState(null); 
  const [dragEnd, setDragEnd] = useState(null);     
  const [isDragging, setIsDragging] = useState(false);

  // 3. Portfolio Basket Configuration States
  const [basket, setBasket] = useState(['IBM']);
  const [focusedSymbol, setFocusedSymbol] = useState('IBM');
  const initialCapitalPool = 100000.0;

  // 4. Network Lifecycle States
  const [allStocksData, setAllStocksData] = useState({});
  const [apiLoading, setApiLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  // Purge zoom history when switching tickers or base timeframes
  useEffect(() => {
    setZoomRange(null);
    setZoomHistory([]);
  }, [focusedSymbol, timeframeDays]);

  // Lazy Loader targeting single active selection changes
  useEffect(() => {
    let isMounted = true;
    setApiLoading(true);
    setApiError(null);

    if (allStocksData[focusedSymbol]) {
      setApiLoading(false);
      return;
    }

    fetchTwelveDataPrices(focusedSymbol)
      .then((livePrices) => {
        if (isMounted) {
          setAllStocksData(prev => ({
            ...prev,
            [focusedSymbol]: livePrices
          }));
          setApiLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setApiError(err.message);
          setApiLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [focusedSymbol]);

  // 5. Dual-Layer Timeframe Window Slicing Engine
  const timeframePrices = useMemo(() => {
    const rawArray = allStocksData[focusedSymbol] || [];
    if (rawArray.length === 0) return [];
    return rawArray.slice(-timeframeDays).map(item => item.close);
  }, [allStocksData, focusedSymbol, timeframeDays]);

  const timeframeDates = useMemo(() => {
    const rawArray = allStocksData[focusedSymbol] || [];
    if (rawArray.length === 0) return [];
    return rawArray.slice(-timeframeDays).map(item => item.date);
  }, [allStocksData, focusedSymbol, timeframeDays]);

  // Extract subset configurations if a custom zoom stack is targeted
  const slicedPrices = useMemo(() => {
    if (!zoomRange) return timeframePrices;
    return timeframePrices.slice(zoomRange.start, zoomRange.end + 1);
  }, [timeframePrices, zoomRange]);

  const activeDates = useMemo(() => {
    if (!zoomRange) return timeframeDates;
    return timeframeDates.slice(zoomRange.start, zoomRange.end + 1);
  }, [timeframeDates, zoomRange]);

  const latestPrice = slicedPrices.length > 0 ? slicedPrices[slicedPrices.length - 1] : 0;

  // 6. Backtest Calculations For Focused Window Slice
  const singleAnalysis = useMemo(() => {
    if (slicedPrices.length === 0) return null;
    const signals = Strategies.generateSignals(strategyChoice, slicedPrices, 10, 50);
    const dividedBudget = initialCapitalPool / basket.length;
    
    const engine = new BacktestEngine(dividedBudget);
    engine.run(slicedPrices, signals);

    return {
      engine,
      signals,
      sma10: Indicators.smaList(slicedPrices, 10),
      sma50: Indicators.smaList(slicedPrices, 50),
      ema10: Indicators.emaList(slicedPrices, 10),
      ema50: Indicators.emaList(slicedPrices, 50),
      rsi: Indicators.rsi(slicedPrices, 14),
      sharpe: Indicators.sharpeRatio(slicedPrices),
      buyAndHoldReturn: ((latestPrice - slicedPrices[0]) / slicedPrices[0]) * 100
    };
  }, [slicedPrices, strategyChoice, basket.length, latestPrice]);

  // 7. Multi-Stock Portfolio Aggregator Balance Model
  const portfolioSummary = useMemo(() => {
    if (Object.keys(allStocksData).length < basket.length) return null;
    
    let totalPortfolioValue = 0;
    const allocationPerStock = initialCapitalPool / basket.length;

    basket.forEach(sym => {
      const series = (allStocksData[sym] || []).slice(-timeframeDays).map(i => i.close);
      if (series.length > 0) {
        const sigs = Strategies.generateSignals(strategyChoice, series, 10, 50);
        const eng = new BacktestEngine(allocationPerStock);
        eng.run(series, sigs);
        const spotPrice = series[series.length - 1];
        totalPortfolioValue += eng.cash + (eng.sharesHeld * spotPrice);
      } else {
        totalPortfolioValue += allocationPerStock;
      }
    });

    return {
      totalValue: totalPortfolioValue,
      totalReturnPct: ((totalPortfolioValue - initialCapitalPool) / initialCapitalPool) * 100,
      allocationPerStock
    };
  }, [allStocksData, basket, timeframeDays, strategyChoice]);

  // 8. Safely Pre-calculated Fallbacks to Prevent Runtime White Screen Crashes
  const displayTotalValue = portfolioSummary ? portfolioSummary.totalValue : initialCapitalPool;
  const displayTotalReturn = portfolioSummary ? portfolioSummary.totalReturnPct : 0.0;
  const displayAllocation = portfolioSummary ? portfolioSummary.allocationPerStock : initialCapitalPool;

  const botStockAllocation = initialCapitalPool / basket.length;
  const botStrategyReturn = singleAnalysis?.engine ? (((singleAnalysis.engine.cash - botStockAllocation) / botStockAllocation) * 100) : 0.0;
  const passiveHoldReturn = singleAnalysis ? singleAnalysis.buyAndHoldReturn : 0.0;
  const alphaDifferential = botStrategyReturn - passiveHoldReturn;
  const metricsSharpe = singleAnalysis ? singleAnalysis.sharpe : 0.0;
  const metricsRsi = singleAnalysis ? singleAnalysis.rsi : 50;

  const totalTradesCount = singleAnalysis?.engine?.trades ? singleAnalysis.engine.trades.length : 0;
  const totalWinsCount = singleAnalysis?.engine ? singleAnalysis.engine.wins : 0;
  const totalLossesCount = singleAnalysis?.engine ? singleAnalysis.engine.losses : 0;
  const calculatedWinRate = (totalWinsCount + totalLossesCount > 0) ? ((totalWinsCount / (totalWinsCount + totalLossesCount)) * 100) : 0;

  // 9. Coordinates Intersect Array Resolution Logic
  const svgRef = useRef(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [hoverCoords, setHoverCoords] = useState({ x: 0, y: 0 });

  const getIndexFromMouseX = (clientX) => {
    if (!svgRef.current) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    const padding = 20;
    const svgWidth = 800;
    
    const mouseXRelative = ((clientX - rect.left) / rect.width) * svgWidth;
    const printableWidth = svgWidth - padding * 2;
    const percentagePosition = (mouseXRelative - padding) / printableWidth;
    
    const baseLength = zoomRange ? slicedPrices.length : timeframePrices.length;
    let index = Math.round(percentagePosition * (baseLength - 1));
    return Math.max(0, Math.min(baseLength - 1, index));
  };

  const handleSvgMouseDown = (e) => {
    if (slicedPrices.length === 0) return;
    const idx = getIndexFromMouseX(e.clientX);
    setDragStart(idx);
    setDragEnd(idx);
    setIsDragging(true);
  };

  const handleSvgMouseMove = (e) => {
    if (!svgRef.current || slicedPrices.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const padding = 20;
    const svgWidth = 800;
    
    const computedIndex = getIndexFromMouseX(e.clientX);
    const baseLength = zoomRange ? slicedPrices.length : timeframePrices.length;

    setHoverIndex(computedIndex);
    setHoverCoords({
      x: (computedIndex / (baseLength - 1)) * (svgWidth - padding * 2) + padding,
      y: e.clientY - rect.top
    });

    if (isDragging) {
      setDragEnd(computedIndex);
    }
  };

  const handleSvgMouseUp = () => {
    if (!isDragging || dragStart === null || dragEnd === null) {
      setIsDragging(false);
      return;
    }

    const startIdx = Math.min(dragStart, dragEnd);
    const endIdx = Math.max(dragStart, dragEnd);

    if (endIdx - startIdx > 4) {
      setZoomHistory(prev => [...prev, zoomRange]);
      if (zoomRange) {
        setZoomRange({
          start: zoomRange.start + startIdx,
          end: zoomRange.start + endIdx
        });
      } else {
        setZoomRange({ start: startIdx, end: endIdx });
      }
    }

    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  };

  const handleZoomOutStep = () => {
    if (zoomHistory.length === 0) {
      setZoomRange(null);
      return;
    }
    const internalHistoryCopy = [...zoomHistory];
    const previousTargetNode = internalHistoryCopy.pop();
    setZoomRange(previousTargetNode);
    setZoomHistory(internalHistoryCopy);
  };

  const handleZoomResetFull = () => {
    setZoomRange(null);
    setZoomHistory([]);
  };

  const handleAddTickerToken = (e) => {
    if (e) e.preventDefault();
    if (!symbolInput.trim()) return;
    const normalized = symbolInput.trim().toUpperCase();
    if (basket.includes(normalized)) {
      setFocusedSymbol(normalized);
      setSymbolInput('');
      return;
    }
    if (basket.length >= 5) {
      alert("Allocated tracking basket limit restricted to 5 concurrent stock units.");
      return;
    }
    setBasket([...basket, normalized]);
    setFocusedSymbol(normalized);
    setSymbolInput('');
  };

  const handleRemoveTickerToken = () => {
    if (!symbolInput.trim()) return;
    const normalized = symbolInput.trim().toUpperCase();
    if (!basket.includes(normalized)) {
      alert(`"${normalized}" is not currently inside your tracking matrix.`);
      return;
    }
    if (basket.length <= 1) {
      alert("System Allocation Fault: Portfolio requires at least 1 tracking asset.");
      return;
    }
    const filtered = basket.filter(s => s !== normalized);
    setBasket(filtered);
    if (focusedSymbol === normalized) setFocusedSymbol(filtered[0]);
    setSymbolInput('');
  };

  if (apiLoading) {
    return (
      <div className="bg-[#0D0F14] h-screen w-screen flex flex-col justify-center items-center font-mono">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#acc7ff] mb-4"></div>
        <p className="text-sm text-[#acc7ff] tracking-widest uppercase animate-pulse">Syncing Twelve Data Nodes for {focusedSymbol}...</p>
      </div>
    );
  }

  if (apiError || slicedPrices.length === 0) {
    return (
      <div className="bg-[#0D0F14] h-screen w-screen flex flex-col justify-center items-center font-mono p-6 text-center">
        <span className="material-symbols-outlined text-red-400 text-4xl mb-2">warning</span>
        <p className="text-sm text-red-400 font-semibold uppercase tracking-wider mb-4">API Pipeline Disruption</p>
        <p className="text-xs text-[#8c909e] max-w-md mb-6">{apiError || 'Empty dataset response.'}</p>
        <button 
          onClick={() => { setBasket(['IBM']); setFocusedSymbol('IBM'); setApiError(null); }}
          className="bg-[#32353c] text-white text-xs px-4 py-2 rounded border border-[#424753] hover:bg-[#acc7ff] hover:text-[#002f68] transition-all"
        >
          Restore Standard Benchmark (IBM)
        </button>
      </div>
    );
  }

  const generateSvgPath = (dataList, color, type = 'line', offsetIndex = 0) => {
    if (!dataList || dataList.length === 0) return null;
    const width = 800;
    const height = 300;
    const padding = 20;

    const maxVal = Math.max(...slicedPrices) * 1.02;
    const minVal = Math.min(...slicedPrices) * 0.98;
    const range = maxVal - minVal;

    const points = dataList.map((val, idx) => {
      const actualIdx = idx + offsetIndex;
      const x = (actualIdx / (slicedPrices.length - 1)) * (width - padding * 2) + padding;
      const y = height - (((val - minVal) / range) * (height - padding * 2) + padding);
      return `${x},${y}`;
    });

    return <path d={`M ${points.join(' L ')}`} fill="none" stroke={color} strokeWidth="1.5" strokeDasharray={type === 'dashed' ? '4 2' : undefined} />;
  };

  const dragRectMetrics = (() => {
    if (!isDragging || dragStart === null || dragEnd === null) return null;
    const width = 800;
    const padding = 20;
    const printableWidth = width - padding * 2;
    const baseLength = zoomRange ? slicedPrices.length : timeframePrices.length;
    
    const x1 = (dragStart / (baseLength - 1)) * printableWidth + padding;
    const x2 = (dragEnd / (baseLength - 1)) * printableWidth + padding;
    return {
      x: Math.min(x1, x2),
      width: Math.abs(x1 - x2)
    };
  })();

  return (
    <div className="bg-[#0D0F14] text-[#e1e2eb] font-sans antialiased overflow-hidden h-screen w-screen select-none">
      
      {/* Top Navbar */}
      <nav className="fixed top-0 right-0 left-[64px] h-[64px] border-b border-[#424753] bg-[#1d2026] flex justify-between items-center px-5 z-50">
        <div className="flex items-center gap-6">
          <span className="text-sm font-bold text-white tracking-wider uppercase">QuantSim Portfolio Console</span>
          <div className="flex gap-1 bg-[#11131a] p-1 rounded border border-[#252B3B]">
            {[
              { label: '3M', days: 63 },
              { label: '6M', days: 126 },
              { label: '1Y', days: 252 },
              { label: '2Y', days: 504 },
              { label: '3Y', days: 756 },
              { label: '4Y', days: 1008 },
              { label: '5Y', days: 1260 }
            ].map((t) => (
              <button
                key={t.label}
                onClick={() => setTimeframeDays(t.days)}
                className={`text-[10px] px-2.5 py-1 font-mono font-bold rounded transition-all ${timeframeDays === t.days ? 'bg-[#acc7ff] text-[#002f68]' : 'text-[#8c909e] hover:text-white'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2 items-center">
            <input 
              type="text" 
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value)}
              className="bg-[#11131a] border border-[#252B3B] text-xs px-3 py-1.5 rounded focus:outline-none focus:border-[#acc7ff] w-36 text-white font-mono uppercase"
              placeholder="Stock Ticker"
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddTickerToken(); }}
            />
            <button type="button" onClick={() => handleAddTickerToken()} className="bg-[#acc7ff] text-[#002f68] text-[10px] font-bold tracking-wider py-2 px-3 rounded hover:bg-[#32353c] hover:text-[#acc7ff] transition-all uppercase">
              + Deploy
            </button>
            <button type="button" onClick={handleRemoveTickerToken} className="bg-red-950 text-red-400 border border-red-700 hover:bg-red-900 text-[10px] font-bold tracking-wider py-2 px-3 rounded transition-all uppercase">
              - Remove
            </button>
          </div>
        </div>
      </nav>

      {/* Side Control Ribbon */}
      <aside className="fixed left-0 top-0 h-full w-[64px] border-r border-[#424753] bg-[#191c22] flex flex-col items-center py-4 gap-2 z-50">
        <div className="mb-8 text-center flex flex-col items-center gap-0.5">
          <span className="font-bold text-white text-base tracking-tighter">QS</span>
          <span className="text-[7px] text-[#acc7ff] tracking-widest uppercase font-bold">AUTO</span>
        </div>
        <div className="flex flex-col gap-4 w-full items-center">
          <button className="text-[#acc7ff] border-l-2 border-[#acc7ff] bg-[#1d2026] w-full py-2.5 flex flex-col items-center">
            <span className="material-symbols-outlined text-[22px]">smart_toy</span>
          </button>
        </div>
      </aside>

      {/* Main Container Layout */}
      <main className="ml-[64px] mt-[64px] p-3 h-[calc(100vh-64px)] flex gap-3 overflow-hidden bg-[#0D0F14]">
        
        {/* Left Side Allocation List Column */}
        <div className="w-[280px] flex flex-col gap-3 flex-shrink-0">
          
          {/* Consolidated Scorecard Summary Box */}
          <div className="bg-[#161A23] border border-[#252B3B] rounded p-4">
            <h2 className="text-[10px] font-bold text-[#c2c6d5] tracking-widest uppercase border-b border-[#252B3B] pb-2.5 mb-3">Consolidated Scorecard</h2>
            <div className="flex flex-col gap-3">
              <div>
                <span className="text-[10px] uppercase text-[#8c909e] block mb-0.5">Aggregated Net Value</span>
                <span className="text-xl font-bold font-mono text-white">₹{displayTotalValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-[#8c909e] block mb-0.5">Total Systemic Return</span>
                <span className={`text-sm font-mono font-bold ${displayTotalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {displayTotalReturn >= 0 ? '+' : ''}{displayTotalReturn.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          {/* Allocation Basket Selector Panel */}
          <div className="bg-[#161A23] border border-[#252B3B] rounded p-4 flex-1 flex flex-col overflow-hidden">
            <div className="flex justify-between items-center border-b border-[#252B3B] pb-2.5 mb-3">
              <h2 className="text-[10px] font-bold text-[#c2c6d5] tracking-widest uppercase">Distributed Basket</h2>
              <span className="text-[10px] text-[#8c909e] font-mono">{basket.length} Assets</span>
            </div>
            <div className="flex-1 overflow-auto flex flex-col gap-2">
              {basket.map((sym) => {
                const arr = allStocksData[sym] || [];
                const priceValue = arr.length > 0 ? arr[arr.length - 1].close : 0;
                return (
                  <div 
                    key={sym}
                    onClick={() => setFocusedSymbol(sym)}
                    className={`p-3 rounded border transition-all cursor-pointer flex justify-between items-center ${focusedSymbol === sym ? 'bg-[#1d2026] border-[#acc7ff]' : 'bg-[#11131a] border-[#252B3B] hover:border-[#424753]'}`}
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-bold font-mono text-white">{sym}</span>
                      <span className="text-[9px] text-[#8c909e]">Cap Slice: ₹{displayAllocation.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="text-right font-mono text-xs">
                      <div className="text-[#acc7ff] font-bold">₹{priceValue.toFixed(2)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center Workspace Visuals Column Layout */}
        <div className="flex-1 flex flex-col gap-3 min-w-[500px]">
          
          {/* Main Visual SVG Vector Chart Canvas Component Panel */}
          <div className="bg-[#161A23] border border-[#252B3B] rounded p-4 h-[55%] flex flex-col relative overflow-hidden">
            <div className="flex justify-between items-center border-b border-[#252B3B] pb-2.5 mb-3 select-none">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">{focusedSymbol} Chart Core</span>
                <select 
                  value={strategyChoice} 
                  onChange={(e) => setStrategyChoice(e.target.value)}
                  className="bg-[#11131a] text-[#acc7ff] border border-[#252B3B] text-[10px] font-bold rounded px-2 py-0.5"
                >
                  <option value="SMA">SMA CROSSOVER (10/50)</option>
                  <option value="EMA">EMA CROSSOVER (10/50)</option>
                </select>

                {/* Incremental Zoom Controls Interface */}
                {zoomRange && (
                  <div className="flex gap-1.5">
                    <button 
                      onClick={handleZoomOutStep}
                      className="bg-[#242936] border border-[#424753] text-[#acc7ff] text-[10px] font-mono font-bold px-2.5 py-1 rounded hover:bg-[#31374a] transition-all flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[12px]">zoom_out</span> Zoom Out
                    </button>
                    <button 
                      onClick={handleZoomResetFull}
                      className="bg-[#2a1b1b] border border-red-900 text-red-400 text-[10px] font-mono font-bold px-2.5 py-1 rounded hover:bg-red-900 hover:text-white transition-all flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[12px]">restart_alt</span> Reset
                    </button>
                  </div>
                )}
              </div>
              <div className="flex gap-4 font-mono text-[10px] text-[#8c909e]">
                <div className="flex items-center gap-1.5"><div className="w-3 h-[2px] bg-[#E8ECF4]" /><span>Price</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-0 border-t-[2px] border-dashed border-[#4F8EF7]" /><span>Fast Line</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-0 border-t-[2px] border-dashed border-[#A855F7]" /><span>Slow Line</span></div>
              </div>
            </div>

            <div className="flex-1 relative w-full h-full cursor-crosshair">
              <svg 
                ref={svgRef}
                onMouseDown={handleSvgMouseDown}
                onMouseMove={handleSvgMouseMove}
                onMouseUp={handleSvgMouseUp}
                className="w-full h-full absolute inset-0" 
                preserveAspectRatio="none" 
                viewBox="0 0 800 300"
              >
                {[50, 100, 150, 200, 250].map((y, idx) => (
                  <line key={idx} x1="0" y1={y} x2="800" y2={y} stroke="#1E2330" strokeDasharray="4" />
                ))}

                {generateSvgPath(slicedPrices, '#E8ECF4', 'line', 0)}
                {strategyChoice === 'SMA' ? (
                  <>
                    {generateSvgPath(singleAnalysis?.sma10, '#4F8EF7', 'dashed', 9)}
                    {generateSvgPath(singleAnalysis?.sma50, '#A855F7', 'dashed', 49)}
                  </>
                ) : (
                  <>
                    {generateSvgPath(singleAnalysis?.ema10, '#4F8EF7', 'dashed', 9)}
                    {generateSvgPath(singleAnalysis?.ema50, '#A855F7', 'dashed', 49)}
                  </>
                )}

                {/* Plot Trades Up/Down Triangles */}
                {(singleAnalysis?.engine?.trades || []).map((trade, index) => {
                  const x = (trade.dayIndex / (slicedPrices.length - 1)) * (800 - 40) + 20;
                  const maxVal = Math.max(...slicedPrices) * 1.02;
                  const minVal = Math.min(...slicedPrices) * 0.98;
                  const y = 300 - (((trade.price - minVal) / (maxVal - minVal)) * (300 - 40) + 20);
                  return trade.type === 'BUY' 
                    ? <polygon key={index} points={`${x},${y+4} ${x-4},${y+14} ${x+4},${y+14}`} fill="#22c55e" />
                    : <polygon key={index} points={`${x},${y-4} ${x-4},${y-14} ${x+4},${y-14}`} fill="#ef4444" />;
                })}

                {/* Live Brush Selector Highlighter Box */}
                {dragRectMetrics && (
                  <rect 
                    x={dragRectMetrics.x} 
                    y="0" 
                    width={dragRectMetrics.width} 
                    height="300" 
                    fill="#4F8EF7" 
                    fillOpacity="0.15" 
                    stroke="#4F8EF7" 
                    strokeWidth="1.2" 
                  />
                )}

                {/* Vertical alignment tracking crosshair line */}
                {hoverIndex !== null && !isDragging && (
                  <line x1={hoverCoords.x} y1="0" x2={hoverCoords.x} y2="300" stroke="#acc7ff" strokeWidth="1" strokeDasharray="3 3" />
                )}
              </svg>

              {/* Dynamic Coordinate Hover Card Box Data Tooltip */}
              {hoverIndex !== null && !isDragging && activeDates[hoverIndex] && (
                <div 
                  className="absolute bg-[#1d2026] border border-[#acc7ff] p-3 rounded shadow-2xl text-[11px] font-mono pointer-events-none z-50 text-[#e1e2eb]"
                  style={{ left: `${Math.min(hoverCoords.x, 620)}px`, top: `10px` }}
                >
                  <div className="text-[#acc7ff] font-bold border-b border-[#252B3B] pb-1 mb-1.5">Timeline Position Matrix</div>
                  <div>Relative Session Index: {hoverIndex}</div>
                  <div>Calendar Stamp: <span className="text-white">{activeDates[hoverIndex]}</span></div>
                  <div>Closing Price Action: <span className="text-green-400 font-bold">₹{slicedPrices[hoverIndex]?.toFixed(2)}</span></div>
                </div>
              )}
            </div>
            <div className="flex justify-between mt-1.5 font-mono text-[9px] text-[#8c909e] px-1">
              <span>{activeDates[0] || 'Start Frame Baseline'}</span>
              <span>{activeDates[activeDates.length - 1] || 'Trailing Segment Edge'}</span>
            </div>
          </div>

          {/* Individual Stock Transaction History Logs Ledger */}
          <div className="bg-[#161A23] border border-[#252B3B] rounded flex-1 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-[#252B3B] bg-[#11131a]">
              <span className="text-[10px] font-bold uppercase text-[#c2c6d5] tracking-wider">{focusedSymbol} Robot Ledger History Logs</span>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead className="bg-[#1E2330] text-[#c2c6d5] text-[10px] uppercase sticky top-0">
                  <tr>
                    <th className="px-4 py-2 font-normal">Day Frame</th>
                    <th className="px-4 py-2 font-normal">Action Call</th>
                    <th className="px-4 py-2 font-normal text-right">Execution Spot Price</th>
                    <th className="px-4 py-2 font-normal text-right">Shares Vol</th>
                    <th className="px-4 py-2 font-normal text-right">Gross Capital Consideration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#252B3B]">
                  {(singleAnalysis?.engine?.trades || []).map((trade, i) => (
                    <tr key={i} className="hover:bg-[#1d2026]">
                      <td className="px-4 py-1.5">Day {trade.dayIndex}</td>
                      <td className="px-4 py-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${trade.type === 'BUY' ? 'bg-green-950 text-green-400' : 'bg-red-950 text-red-400'}`}>{trade.type}</span>
                      </td>
                      <td className="px-4 py-1.5 text-right font-semibold">₹{trade.price.toFixed(2)}</td>
                      <td className="px-4 py-1.5 text-right">{trade.quantity}</td>
                      <td className="px-4 py-1.5 text-right text-white">₹{(trade.price * trade.quantity).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  {totalTradesCount === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center py-6 text-[11px] text-[#8c909e] uppercase tracking-wide">No crossover signals encountered inside this slicing interval window.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Active Asset Analytical Metrics Column */}
        <div className="w-[280px] flex flex-col gap-3 flex-shrink-0">
          
          {/* Focused Asset Strategy Breakdown Card */}
          <div className="bg-[#161A23] border border-[#252B3B] rounded p-4">
            <h2 className="text-[10px] font-bold text-[#c2c6d5] tracking-widest uppercase border-b border-[#252B3B] pb-2.5 mb-3">{focusedSymbol} Strategy Breakdown</h2>
            <div className="flex flex-col gap-3 text-sm font-mono">
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase text-[#8c909e]">Bot Strategy Return</span>
                <span className={`font-bold ${botStrategyReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {botStrategyReturn.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-t border-b border-[#1e2330]">
                <span className="text-[10px] uppercase text-[#8c909e]">Passive Buy &amp; Hold</span>
                <span className={`font-bold ${passiveHoldReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {passiveHoldReturn.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase text-[#8c909e]">Alpha Differential</span>
                <span className={`font-bold ${alphaDifferential >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {alphaDifferential.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Volatility Risk Assessment Card */}
          <div className="bg-[#161A23] border border-[#252B3B] rounded p-4">
            <h2 className="text-[10px] font-bold text-[#c2c6d5] tracking-widest uppercase border-b border-[#252B3B] pb-2.5 mb-3">{focusedSymbol} Volatility Profile</h2>
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-[#8c909e]">Sharpe Ratio</span>
                  <span className="text-base font-bold font-mono text-white">{metricsSharpe.toFixed(2)}</span>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded font-mono uppercase ${metricsSharpe >= 1.0 ? 'bg-green-950 text-green-400' : 'bg-red-950 text-red-400'}`}>
                  {metricsSharpe >= 1.0 ? 'Decent Risk' : 'High Variance'}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2.5 border-t border-[#252B3B]">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-[#8c909e]">Wilder RSI (14-Day)</span>
                  <span className="text-base font-bold font-mono text-white">{Math.round(metricsRsi)}</span>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${metricsRsi >= 70 ? 'bg-red-950 text-red-400' : metricsRsi <= 30 ? 'bg-green-950 text-green-400' : 'bg-[#1E2330] text-[#c2c6d5]'}`}>
                  {metricsRsi >= 70 ? 'Overbought' : metricsRsi <= 30 ? 'Oversold' : 'Neutral'}
                </span>
              </div>
            </div>
          </div>

          {/* Active Stock Trade Efficiency Matrix Card */}
          <div className="bg-[#161A23] border border-[#252B3B] rounded p-4 flex-1 flex flex-col">
            <h2 className="text-[10px] font-bold text-[#c2c6d5] tracking-widest uppercase border-b border-[#252B3B] pb-2 mb-1.5">Trade Efficiency Profiles</h2>
            <div className="flex-1 flex flex-col justify-between text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-[#1e2330]">
                <span className="text-[#8c909e]">Total Trades Executed:</span>
                <span className="text-white font-bold">{totalTradesCount}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#1e2330]">
                <span className="text-[#8c909e]">Profitable Transactions:</span>
                <span className="text-green-400 font-bold">{totalWinsCount}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#1e2330]">
                <span className="text-[#8c909e]">Unprofitable Transactions:</span>
                <span className="text-red-400 font-bold">{totalLossesCount}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#8c909e]">Statistical Win Rate:</span>
                <span className="text-white font-bold">{calculatedWinRate.toFixed(0)}%</span>
              </div>
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}