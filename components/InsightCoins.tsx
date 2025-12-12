import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useCircleWallet } from '../contexts/CircleWalletContext';
import {
  marketDataService,
  watchlistService,
  newsService,
  CoinMarketData,
  GlobalMarketData,
  FearGreedData,
  CryptoNews,
} from '../services/marketDataService';

// ============================================================================
// TYPES
// ============================================================================

type ViewMode = 'grid' | 'table';
type SortField = 'market_cap' | 'price' | 'change_24h' | 'change_7d' | 'volume' | 'name';
type SortOrder = 'asc' | 'desc';
type TimeFilter = '1h' | '24h' | '7d' | '30d';
type CategoryFilter = 'all' | 'trending' | 'gainers' | 'losers' | 'defi' | 'gaming' | 'ai' | 'layer-1' | 'layer-2' | 'meme' | 'watchlist';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatPrice = (price: number): string => {
  if (price >= 1000) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.0001) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(8)}`;
};

const formatLargeNumber = (num: number): string => {
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
};

const formatSupply = (num: number | null): string => {
  if (!num) return 'N/A';
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toFixed(0);
};

const formatPercentage = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

const getPercentageColor = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'text-slate-400';
  return value >= 0 ? 'text-green-400' : 'text-red-400';
};

const timeAgo = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

// Sparkline Chart
const SparklineChart: React.FC<{ data: number[]; positive: boolean; height?: number }> = ({
  data,
  positive,
  height = 40
}) => {
  if (!data || data.length === 0) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const areaPath = `M0,${height} L${data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' L')} L100,${height} Z`;

  return (
    <svg viewBox={`0 0 100 ${height}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`gradient-${positive ? 'up' : 'down'}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={positive ? '#22c55e' : '#ef4444'} stopOpacity="0.3" />
          <stop offset="100%" stopColor={positive ? '#22c55e' : '#ef4444'} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#gradient-${positive ? 'up' : 'down'})`} />
      <polyline
        fill="none"
        stroke={positive ? '#22c55e' : '#ef4444'}
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  );
};

// Fear & Greed Gauge
const FearGreedGauge: React.FC<{ data: FearGreedData | null; loading: boolean }> = ({ data, loading }) => {
  const value = data ? parseInt(data.value) : 50;
  const classification = data?.value_classification || 'Neutral';

  const getColor = (val: number): string => {
    if (val <= 25) return '#ef4444'; // Extreme Fear
    if (val <= 45) return '#f97316'; // Fear
    if (val <= 55) return '#eab308'; // Neutral
    if (val <= 75) return '#84cc16'; // Greed
    return '#22c55e'; // Extreme Greed
  };

  const rotation = (value / 100) * 180 - 90;

  if (loading) {
    return (
      <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 animate-pulse">
        <div className="h-4 bg-slate-700 rounded w-32 mb-3" />
        <div className="h-20 bg-slate-700 rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-400">Fear & Greed Index</h3>
        <span className="text-xs text-slate-500">Updated hourly</span>
      </div>

      <div className="relative flex flex-col items-center">
        {/* Gauge */}
        <svg viewBox="0 0 200 110" className="w-full max-w-[180px]">
          {/* Background arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#334155"
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* Colored segments */}
          <path d="M 20 100 A 80 80 0 0 1 56 43" fill="none" stroke="#ef4444" strokeWidth="12" strokeLinecap="round" />
          <path d="M 56 43 A 80 80 0 0 1 100 20" fill="none" stroke="#f97316" strokeWidth="12" />
          <path d="M 100 20 A 80 80 0 0 1 144 43" fill="none" stroke="#eab308" strokeWidth="12" />
          <path d="M 144 43 A 80 80 0 0 1 180 100" fill="none" stroke="#22c55e" strokeWidth="12" strokeLinecap="round" />

          {/* Needle */}
          <g transform={`rotate(${rotation}, 100, 100)`}>
            <line x1="100" y1="100" x2="100" y2="35" stroke="white" strokeWidth="3" strokeLinecap="round" />
            <circle cx="100" cy="100" r="8" fill="white" />
          </g>
        </svg>

        {/* Value */}
        <div className="text-center mt-2">
          <span className="text-3xl font-bold" style={{ color: getColor(value) }}>{value}</span>
          <p className="text-sm font-medium" style={{ color: getColor(value) }}>{classification}</p>
        </div>
      </div>
    </div>
  );
};

// Global Stats Bar
const GlobalStatsBar: React.FC<{ data: GlobalMarketData | null; loading: boolean }> = ({ data, loading }) => {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-3 animate-pulse">
            <div className="h-3 bg-slate-700 rounded w-20 mb-2" />
            <div className="h-5 bg-slate-700 rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  const stats = [
    {
      label: 'Total Market Cap',
      value: formatLargeNumber(data.total_market_cap?.usd || 0),
      change: data.market_cap_change_percentage_24h_usd,
      color: 'from-blue-500/10 to-blue-600/5 border-blue-500/20',
    },
    {
      label: '24h Volume',
      value: formatLargeNumber(data.total_volume?.usd || 0),
      color: 'from-purple-500/10 to-purple-600/5 border-purple-500/20',
    },
    {
      label: 'BTC Dominance',
      value: `${(data.market_cap_percentage?.btc || 0).toFixed(1)}%`,
      color: 'from-orange-500/10 to-orange-600/5 border-orange-500/20',
    },
    {
      label: 'ETH Dominance',
      value: `${(data.market_cap_percentage?.eth || 0).toFixed(1)}%`,
      color: 'from-indigo-500/10 to-indigo-600/5 border-indigo-500/20',
    },
    {
      label: 'Active Cryptos',
      value: data.active_cryptocurrencies?.toLocaleString() || '0',
      color: 'from-green-500/10 to-green-600/5 border-green-500/20',
    },
    {
      label: 'Markets',
      value: data.markets?.toLocaleString() || '0',
      color: 'from-pink-500/10 to-pink-600/5 border-pink-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {stats.map((stat, index) => (
        <div key={index} className={`rounded-xl bg-gradient-to-br ${stat.color} border p-3`}>
          <p className="text-slate-400 text-xs truncate">{stat.label}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-lg font-bold text-white">{stat.value}</p>
            {stat.change !== undefined && (
              <span className={`text-xs font-medium ${getPercentageColor(stat.change)}`}>
                {formatPercentage(stat.change)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// Coin Row (Table View)
const CoinRow: React.FC<{
  coin: CoinMarketData;
  timeFilter: TimeFilter;
  isWatchlisted: boolean;
  onToggleWatchlist: (id: string) => void;
  onClick: () => void;
}> = ({ coin, timeFilter, isWatchlisted, onToggleWatchlist, onClick }) => {
  const getChangeValue = (): number | null => {
    switch (timeFilter) {
      case '1h': return coin.price_change_percentage_1h_in_currency ?? null;
      case '24h': return coin.price_change_percentage_24h;
      case '7d': return coin.price_change_percentage_7d_in_currency ?? null;
      case '30d': return coin.price_change_percentage_30d_in_currency ?? null;
      default: return coin.price_change_percentage_24h;
    }
  };

  const changeValue = getChangeValue();
  const isPositive = (changeValue ?? 0) >= 0;

  return (
    <tr
      className="border-b border-slate-700/30 hover:bg-slate-800/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <td className="py-3 px-2">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleWatchlist(coin.id); }}
          className={`p-1 rounded transition-colors ${isWatchlisted ? 'text-yellow-400' : 'text-slate-600 hover:text-slate-400'}`}
        >
          <svg className="w-4 h-4" fill={isWatchlisted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </button>
      </td>
      <td className="py-3 px-2 text-slate-400 text-sm">#{coin.market_cap_rank}</td>
      <td className="py-3 px-2">
        <div className="flex items-center gap-3">
          <img src={coin.image} alt={coin.name} className="w-8 h-8 rounded-full" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-coin.png'; }} />
          <div>
            <p className="font-medium text-white">{coin.name}</p>
            <p className="text-xs text-slate-400 uppercase">{coin.symbol}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-2 text-right font-medium text-white">{formatPrice(coin.current_price)}</td>
      <td className={`py-3 px-2 text-right font-medium ${getPercentageColor(changeValue)}`}>
        {formatPercentage(changeValue)}
      </td>
      <td className="py-3 px-2 text-right text-slate-300">{formatLargeNumber(coin.market_cap)}</td>
      <td className="py-3 px-2 text-right text-slate-300">{formatLargeNumber(coin.total_volume)}</td>
      <td className="py-3 px-2 w-28">
        <div className="h-10">
          <SparklineChart
            data={coin.sparkline_in_7d?.price || []}
            positive={isPositive}
            height={40}
          />
        </div>
      </td>
    </tr>
  );
};

// Coin Card (Grid View)
const CoinCard: React.FC<{
  coin: CoinMarketData;
  timeFilter: TimeFilter;
  isWatchlisted: boolean;
  onToggleWatchlist: (id: string) => void;
  onClick: () => void;
}> = ({ coin, timeFilter, isWatchlisted, onToggleWatchlist, onClick }) => {
  const getChangeValue = (): number | null => {
    switch (timeFilter) {
      case '1h': return coin.price_change_percentage_1h_in_currency ?? null;
      case '24h': return coin.price_change_percentage_24h;
      case '7d': return coin.price_change_percentage_7d_in_currency ?? null;
      case '30d': return coin.price_change_percentage_30d_in_currency ?? null;
      default: return coin.price_change_percentage_24h;
    }
  };

  const changeValue = getChangeValue();
  const isPositive = (changeValue ?? 0) >= 0;

  return (
    <div
      onClick={onClick}
      className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 p-4 cursor-pointer hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <img src={coin.image} alt={coin.name} className="w-10 h-10 rounded-full" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-coin.png'; }} />
            <div>
              <h3 className="font-semibold text-white">{coin.name}</h3>
              <p className="text-xs text-slate-400 uppercase">{coin.symbol}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">#{coin.market_cap_rank}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleWatchlist(coin.id); }}
              className={`p-1 rounded transition-colors ${isWatchlisted ? 'text-yellow-400' : 'text-slate-600 hover:text-slate-400'}`}
            >
              <svg className="w-4 h-4" fill={isWatchlisted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Price & Change */}
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-xl font-bold text-white">{formatPrice(coin.current_price)}</p>
            <p className={`text-sm font-medium ${getPercentageColor(changeValue)}`}>
              {formatPercentage(changeValue)}
            </p>
          </div>
          <div className="w-24 h-10">
            <SparklineChart
              data={coin.sparkline_in_7d?.price || []}
              positive={isPositive}
              height={40}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex justify-between text-xs text-slate-400 pt-2 border-t border-slate-700/50">
          <div>
            <p className="text-slate-500">MCap</p>
            <p className="text-slate-300">{formatLargeNumber(coin.market_cap)}</p>
          </div>
          <div className="text-right">
            <p className="text-slate-500">Vol 24h</p>
            <p className="text-slate-300">{formatLargeNumber(coin.total_volume)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Coin Detail Modal
const CoinDetailModal: React.FC<{
  coin: CoinMarketData | null;
  isWatchlisted: boolean;
  onToggleWatchlist: (id: string) => void;
  onClose: () => void;
}> = ({ coin, isWatchlisted, onToggleWatchlist, onClose }) => {
  if (!coin) return null;

  const isPositive = coin.price_change_percentage_24h >= 0;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl z-50 max-h-[90vh] overflow-y-auto">
        <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 shadow-2xl">
          {/* Header */}
          <div className="relative p-6 border-b border-slate-700/50 bg-gradient-to-r from-blue-500/10 to-purple-500/10">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex items-center gap-4">
              <img src={coin.image} alt={coin.name} className="w-16 h-16 rounded-full" />
              <div>
                <h2 className="text-2xl font-bold text-white">{coin.name}</h2>
                <p className="text-slate-400">{coin.symbol.toUpperCase()} · Rank #{coin.market_cap_rank}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Price Section */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-3xl font-bold text-white">{formatPrice(coin.current_price)}</p>
                <div className="flex items-center gap-4 mt-2">
                  <span className={`text-lg font-semibold ${getPercentageColor(coin.price_change_percentage_24h)}`}>
                    {formatPercentage(coin.price_change_percentage_24h)} (24h)
                  </span>
                </div>
              </div>
              <div className="w-40 h-16">
                <SparklineChart data={coin.sparkline_in_7d?.price || []} positive={isPositive} height={64} />
              </div>
            </div>

            {/* Time Period Changes */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: '1h', value: coin.price_change_percentage_1h_in_currency },
                { label: '24h', value: coin.price_change_percentage_24h },
                { label: '7d', value: coin.price_change_percentage_7d_in_currency },
                { label: '30d', value: coin.price_change_percentage_30d_in_currency },
              ].map((period) => (
                <div key={period.label} className="bg-slate-800/50 rounded-lg p-3 text-center">
                  <p className="text-slate-500 text-xs mb-1">{period.label}</p>
                  <p className={`font-semibold ${getPercentageColor(period.value)}`}>
                    {formatPercentage(period.value)}
                  </p>
                </div>
              ))}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800/50 rounded-xl p-4">
                <p className="text-slate-500 text-sm">Market Cap</p>
                <p className="text-white font-semibold text-lg">{formatLargeNumber(coin.market_cap)}</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4">
                <p className="text-slate-500 text-sm">24h Volume</p>
                <p className="text-white font-semibold text-lg">{formatLargeNumber(coin.total_volume)}</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4">
                <p className="text-slate-500 text-sm">Circulating Supply</p>
                <p className="text-white font-semibold text-lg">{formatSupply(coin.circulating_supply)} {coin.symbol.toUpperCase()}</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4">
                <p className="text-slate-500 text-sm">Max Supply</p>
                <p className="text-white font-semibold text-lg">{formatSupply(coin.max_supply)}</p>
              </div>
            </div>

            {/* ATH/ATL */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                <p className="text-green-400 text-sm font-medium">All-Time High</p>
                <p className="text-white font-bold text-xl mt-1">{formatPrice(coin.ath)}</p>
                <p className="text-slate-400 text-xs mt-1">
                  {formatPercentage(coin.ath_change_percentage)} from ATH
                </p>
                <p className="text-slate-500 text-xs">{new Date(coin.ath_date).toLocaleDateString()}</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <p className="text-red-400 text-sm font-medium">All-Time Low</p>
                <p className="text-white font-bold text-xl mt-1">{formatPrice(coin.atl)}</p>
                <p className="text-slate-400 text-xs mt-1">
                  {formatPercentage(coin.atl_change_percentage)} from ATL
                </p>
                <p className="text-slate-500 text-xs">{new Date(coin.atl_date).toLocaleDateString()}</p>
              </div>
            </div>

            {/* 24h Range */}
            <div className="bg-slate-800/50 rounded-xl p-4">
              <p className="text-slate-400 text-sm mb-3">24h Price Range</p>
              <div className="relative h-2 bg-slate-700 rounded-full">
                <div
                  className="absolute h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full"
                  style={{
                    left: '0%',
                    width: '100%'
                  }}
                />
                <div
                  className="absolute w-3 h-3 bg-white rounded-full -top-0.5 transform -translate-x-1/2"
                  style={{
                    left: `${((coin.current_price - coin.low_24h) / (coin.high_24h - coin.low_24h)) * 100}%`
                  }}
                />
              </div>
              <div className="flex justify-between mt-2 text-sm">
                <span className="text-slate-400">{formatPrice(coin.low_24h)}</span>
                <span className="text-slate-400">{formatPrice(coin.high_24h)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 border-t border-slate-700/50 bg-slate-800/30">
            <div className="flex gap-3">
              <button
                onClick={() => onToggleWatchlist(coin.id)}
                className={`flex-1 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 ${
                  isWatchlisted
                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                <svg className="w-5 h-5" fill={isWatchlisted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                {isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// News Card
const NewsCard: React.FC<{ news: CryptoNews }> = ({ news }) => {
  return (
    <a
      href={news.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/80 transition-all duration-200"
    >
      <h4 className="text-white font-medium text-sm leading-snug line-clamp-2 mb-2">{news.title}</h4>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-blue-400">{news.source}</span>
        <span className="text-slate-600">•</span>
        <span className="text-slate-500">{timeAgo(news.published_at)}</span>
      </div>
    </a>
  );
};

// Loading Skeleton
const CoinSkeleton: React.FC<{ viewMode: ViewMode }> = ({ viewMode }) => {
  if (viewMode === 'table') {
    return (
      <tr className="animate-pulse">
        <td className="py-3 px-2"><div className="w-4 h-4 bg-slate-700 rounded" /></td>
        <td className="py-3 px-2"><div className="w-8 h-4 bg-slate-700 rounded" /></td>
        <td className="py-3 px-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-700 rounded-full" />
            <div className="space-y-2">
              <div className="w-24 h-4 bg-slate-700 rounded" />
              <div className="w-12 h-3 bg-slate-700 rounded" />
            </div>
          </div>
        </td>
        <td className="py-3 px-2"><div className="w-20 h-4 bg-slate-700 rounded ml-auto" /></td>
        <td className="py-3 px-2"><div className="w-16 h-4 bg-slate-700 rounded ml-auto" /></td>
        <td className="py-3 px-2"><div className="w-20 h-4 bg-slate-700 rounded ml-auto" /></td>
        <td className="py-3 px-2"><div className="w-20 h-4 bg-slate-700 rounded ml-auto" /></td>
        <td className="py-3 px-2"><div className="w-28 h-10 bg-slate-700 rounded" /></td>
      </tr>
    );
  }

  return (
    <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-slate-700 rounded-full" />
        <div className="space-y-2">
          <div className="w-24 h-4 bg-slate-700 rounded" />
          <div className="w-12 h-3 bg-slate-700 rounded" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="w-32 h-6 bg-slate-700 rounded" />
        <div className="w-20 h-4 bg-slate-700 rounded" />
        <div className="w-full h-10 bg-slate-700 rounded" />
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const InsightCoins: React.FC = () => {
  // State
  const [coins, setCoins] = useState<CoinMarketData[]>([]);
  const [globalData, setGlobalData] = useState<GlobalMarketData | null>(null);
  const [fearGreed, setFearGreed] = useState<FearGreedData | null>(null);
  const [news, setNews] = useState<CryptoNews[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('24h');
  const [sortField, setSortField] = useState<SortField>('market_cap');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCoin, setSelectedCoin] = useState<CoinMarketData | null>(null);

  // Categories config
  const categories: { id: CategoryFilter; label: string; icon: string }[] = [
    { id: 'all', label: 'All Coins', icon: '📊' },
    { id: 'watchlist', label: 'Watchlist', icon: '⭐' },
    { id: 'trending', label: 'Trending', icon: '🔥' },
    { id: 'gainers', label: 'Top Gainers', icon: '📈' },
    { id: 'losers', label: 'Top Losers', icon: '📉' },
    { id: 'defi', label: 'DeFi', icon: '💰' },
    { id: 'layer-1', label: 'Layer 1', icon: '⛓️' },
    { id: 'layer-2', label: 'Layer 2', icon: '🔗' },
    { id: 'gaming', label: 'Gaming', icon: '🎮' },
    { id: 'ai', label: 'AI & Big Data', icon: '🤖' },
    { id: 'meme', label: 'Meme', icon: '🐕' },
  ];

  // Fetch data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [coinsData, globalDataResult, fearGreedResult, newsData] = await Promise.all([
        marketDataService.getTopCoins(1, 100, true),
        marketDataService.getGlobalData(),
        marketDataService.getFearGreedIndex(),
        newsService.getNews(10),
      ]);

      setCoins(coinsData);
      setGlobalData(globalDataResult);
      setFearGreed(fearGreedResult);
      setNews(newsData);
      setWatchlist(watchlistService.getWatchlist());
    } catch (err) {
      setError('Failed to fetch market data. Please try again later.');
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Refresh every 60 seconds
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Toggle watchlist
  const handleToggleWatchlist = useCallback((coinId: string) => {
    const isNowWatchlisted = watchlistService.toggleWatchlist(coinId);
    setWatchlist(watchlistService.getWatchlist());
  }, []);

  // Filter and sort coins
  const filteredAndSortedCoins = useMemo(() => {
    let result = [...coins];

    // Category filter
    if (category === 'watchlist') {
      result = result.filter(c => watchlist.includes(c.id));
    } else if (category === 'gainers') {
      result = result.filter(c => c.price_change_percentage_24h > 0);
    } else if (category === 'losers') {
      result = result.filter(c => c.price_change_percentage_24h < 0);
    }
    // For other categories, we'd need the CoinGecko category endpoint

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.symbol.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      let aVal: number, bVal: number;

      switch (sortField) {
        case 'name':
          return sortOrder === 'asc'
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        case 'price':
          aVal = a.current_price;
          bVal = b.current_price;
          break;
        case 'change_24h':
          aVal = a.price_change_percentage_24h || 0;
          bVal = b.price_change_percentage_24h || 0;
          break;
        case 'change_7d':
          aVal = a.price_change_percentage_7d_in_currency || 0;
          bVal = b.price_change_percentage_7d_in_currency || 0;
          break;
        case 'volume':
          aVal = a.total_volume;
          bVal = b.total_volume;
          break;
        case 'market_cap':
        default:
          aVal = a.market_cap;
          bVal = b.market_cap;
      }

      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [coins, category, searchQuery, sortField, sortOrder, watchlist]);

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const SortIcon: React.FC<{ field: SortField }> = ({ field }) => {
    if (sortField !== field) return <span className="text-slate-600 ml-1">↕</span>;
    return <span className="text-blue-400 ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Market Insights</h1>
          <p className="text-slate-400 mt-1">Real-time cryptocurrency market data</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search coins..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-64 pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>

          {/* View Toggle */}
          <div className="flex rounded-xl bg-slate-800/50 border border-slate-700/50 p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600 transition-colors disabled:opacity-50"
          >
            <svg className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Global Stats */}
      <GlobalStatsBar data={globalData} loading={isLoading} />

      {/* Main Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="xl:col-span-3 space-y-4">
          {/* Categories & Time Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Categories */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm whitespace-nowrap transition-all duration-200 ${
                    category === cat.id
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                      : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-slate-300'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                  {cat.id === 'watchlist' && watchlist.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs">
                      {watchlist.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Time Filter */}
            <div className="flex rounded-xl bg-slate-800/50 border border-slate-700/50 p-1">
              {(['1h', '24h', '7d', '30d'] as TimeFilter[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeFilter(tf)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    timeFilter === tf
                      ? 'bg-blue-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-red-400">
              <p>{error}</p>
              <button onClick={fetchData} className="mt-2 text-sm underline hover:no-underline">
                Try again
              </button>
            </div>
          )}

          {/* Coins List */}
          {viewMode === 'table' ? (
            <div className="rounded-xl bg-slate-800/30 border border-slate-700/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800/50">
                    <tr className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-2 w-10"></th>
                      <th className="py-3 px-2 w-16">#</th>
                      <th className="py-3 px-2 cursor-pointer hover:text-white" onClick={() => handleSort('name')}>
                        Coin <SortIcon field="name" />
                      </th>
                      <th className="py-3 px-2 text-right cursor-pointer hover:text-white" onClick={() => handleSort('price')}>
                        Price <SortIcon field="price" />
                      </th>
                      <th className="py-3 px-2 text-right cursor-pointer hover:text-white" onClick={() => handleSort('change_24h')}>
                        {timeFilter} <SortIcon field="change_24h" />
                      </th>
                      <th className="py-3 px-2 text-right cursor-pointer hover:text-white" onClick={() => handleSort('market_cap')}>
                        Market Cap <SortIcon field="market_cap" />
                      </th>
                      <th className="py-3 px-2 text-right cursor-pointer hover:text-white" onClick={() => handleSort('volume')}>
                        Volume (24h) <SortIcon field="volume" />
                      </th>
                      <th className="py-3 px-2 text-center">Last 7 Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      [...Array(10)].map((_, i) => <CoinSkeleton key={i} viewMode="table" />)
                    ) : filteredAndSortedCoins.length > 0 ? (
                      filteredAndSortedCoins.map((coin) => (
                        <CoinRow
                          key={coin.id}
                          coin={coin}
                          timeFilter={timeFilter}
                          isWatchlisted={watchlist.includes(coin.id)}
                          onToggleWatchlist={handleToggleWatchlist}
                          onClick={() => setSelectedCoin(coin)}
                        />
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-12 text-center">
                          <div className="flex flex-col items-center">
                            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                              <span className="text-3xl">🔍</span>
                            </div>
                            <p className="text-slate-400">No coins found</p>
                            <p className="text-slate-500 text-sm mt-1">Try adjusting your search or filters</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {isLoading ? (
                [...Array(9)].map((_, i) => <CoinSkeleton key={i} viewMode="grid" />)
              ) : filteredAndSortedCoins.length > 0 ? (
                filteredAndSortedCoins.map((coin) => (
                  <CoinCard
                    key={coin.id}
                    coin={coin}
                    timeFilter={timeFilter}
                    isWatchlisted={watchlist.includes(coin.id)}
                    onToggleWatchlist={handleToggleWatchlist}
                    onClick={() => setSelectedCoin(coin)}
                  />
                ))
              ) : (
                <div className="col-span-full flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                    <span className="text-3xl">🔍</span>
                  </div>
                  <p className="text-slate-400">No coins found</p>
                  <p className="text-slate-500 text-sm mt-1">Try adjusting your search or filters</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Fear & Greed Index */}
          <FearGreedGauge data={fearGreed} loading={isLoading} />

          {/* Latest News */}
          <div className="rounded-xl bg-slate-800/30 border border-slate-700/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">Latest News</h3>
            </div>
            <div className="space-y-3">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-slate-700 rounded w-full mb-2" />
                    <div className="h-3 bg-slate-700 rounded w-3/4" />
                  </div>
                ))
              ) : news.length > 0 ? (
                news.slice(0, 5).map((item) => (
                  <NewsCard key={item.id} news={item} />
                ))
              ) : (
                <p className="text-slate-500 text-sm text-center py-4">No news available</p>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="rounded-xl bg-slate-800/30 border border-slate-700/50 p-4">
            <h3 className="font-semibold text-white mb-4">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Watchlist</span>
                <span className="text-white font-medium">{watchlist.length} coins</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Total Coins</span>
                <span className="text-white font-medium">{coins.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Last Updated</span>
                <span className="text-white font-medium">
                  {coins[0]?.last_updated ? timeAgo(coins[0].last_updated) : '-'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Coin Detail Modal */}
      <CoinDetailModal
        coin={selectedCoin}
        isWatchlisted={selectedCoin ? watchlist.includes(selectedCoin.id) : false}
        onToggleWatchlist={handleToggleWatchlist}
        onClose={() => setSelectedCoin(null)}
      />
    </div>
  );
};

export default InsightCoins;
