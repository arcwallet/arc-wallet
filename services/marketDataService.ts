// Market Data Service - CoinGecko API Integration
// Free tier: 10-30 calls/minute, no API key required for basic endpoints

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
const CACHE_DURATION = 60 * 1000; // 1 minute cache

// Types
export interface CoinMarketData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number | null;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  price_change_percentage_1h_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;
  price_change_percentage_30d_in_currency?: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  last_updated: string;
  sparkline_in_7d?: {
    price: number[];
  };
}

export interface GlobalMarketData {
  active_cryptocurrencies: number;
  upcoming_icos: number;
  ongoing_icos: number;
  ended_icos: number;
  markets: number;
  total_market_cap: { [key: string]: number };
  total_volume: { [key: string]: number };
  market_cap_percentage: { [key: string]: number };
  market_cap_change_percentage_24h_usd: number;
  updated_at: number;
}

export interface TrendingCoin {
  id: string;
  coin_id: number;
  name: string;
  symbol: string;
  market_cap_rank: number;
  thumb: string;
  small: string;
  large: string;
  slug: string;
  price_btc: number;
  score: number;
}

export interface FearGreedData {
  value: string;
  value_classification: string;
  timestamp: string;
  time_until_update?: string;
}

export interface CoinDetail {
  id: string;
  symbol: string;
  name: string;
  description: { en: string };
  links: {
    homepage: string[];
    blockchain_site: string[];
    official_forum_url: string[];
    chat_url: string[];
    announcement_url: string[];
    twitter_screen_name: string;
    telegram_channel_identifier: string;
    subreddit_url: string;
  };
  image: {
    thumb: string;
    small: string;
    large: string;
  };
  categories: string[];
  market_data: {
    current_price: { [key: string]: number };
    ath: { [key: string]: number };
    ath_change_percentage: { [key: string]: number };
    ath_date: { [key: string]: string };
    atl: { [key: string]: number };
    atl_change_percentage: { [key: string]: number };
    atl_date: { [key: string]: string };
    market_cap: { [key: string]: number };
    market_cap_rank: number;
    fully_diluted_valuation: { [key: string]: number };
    total_volume: { [key: string]: number };
    high_24h: { [key: string]: number };
    low_24h: { [key: string]: number };
    price_change_24h: number;
    price_change_percentage_24h: number;
    price_change_percentage_7d: number;
    price_change_percentage_14d: number;
    price_change_percentage_30d: number;
    price_change_percentage_60d: number;
    price_change_percentage_200d: number;
    price_change_percentage_1y: number;
    circulating_supply: number;
    total_supply: number;
    max_supply: number;
  };
}

// Simple in-memory cache
const cache: Map<string, { data: any; timestamp: number }> = new Map();

const getCached = <T>(key: string): T | null => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data as T;
  }
  return null;
};

const setCache = (key: string, data: any): void => {
  cache.set(key, { data, timestamp: Date.now() });
};

// API Functions
export const marketDataService = {
  /**
   * Get top coins by market cap
   */
  async getTopCoins(
    page: number = 1,
    perPage: number = 50,
    sparkline: boolean = true
  ): Promise<CoinMarketData[]> {
    const cacheKey = `top-coins-${page}-${perPage}-${sparkline}`;
    const cached = getCached<CoinMarketData[]>(cacheKey);
    if (cached) return cached;

    try {
      const params = new URLSearchParams({
        vs_currency: 'usd',
        order: 'market_cap_desc',
        per_page: perPage.toString(),
        page: page.toString(),
        sparkline: sparkline.toString(),
        price_change_percentage: '1h,24h,7d,30d',
        locale: 'en',
      });

      const response = await fetch(`${COINGECKO_BASE_URL}/coins/markets?${params}`);

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error fetching top coins:', error);
      throw error;
    }
  },

  /**
   * Get global market data
   */
  async getGlobalData(): Promise<GlobalMarketData> {
    const cacheKey = 'global-data';
    const cached = getCached<{ data: GlobalMarketData }>(cacheKey);
    if (cached) return cached.data;

    try {
      const response = await fetch(`${COINGECKO_BASE_URL}/global`);

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const result = await response.json();
      setCache(cacheKey, result);
      return result.data;
    } catch (error) {
      console.error('Error fetching global data:', error);
      throw error;
    }
  },

  /**
   * Get trending coins (searched in the last 24 hours)
   */
  async getTrendingCoins(): Promise<TrendingCoin[]> {
    const cacheKey = 'trending-coins';
    const cached = getCached<{ coins: { item: TrendingCoin }[] }>(cacheKey);
    if (cached) return cached.coins.map(c => c.item);

    try {
      const response = await fetch(`${COINGECKO_BASE_URL}/search/trending`);

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      setCache(cacheKey, data);
      return data.coins.map((c: { item: TrendingCoin }) => c.item);
    } catch (error) {
      console.error('Error fetching trending coins:', error);
      throw error;
    }
  },

  /**
   * Get Fear & Greed Index from alternative.me
   */
  async getFearGreedIndex(): Promise<FearGreedData> {
    const cacheKey = 'fear-greed';
    const cached = getCached<{ data: FearGreedData[] }>(cacheKey);
    if (cached) return cached.data[0];

    try {
      const response = await fetch('https://api.alternative.me/fng/?limit=1');

      if (!response.ok) {
        throw new Error(`Fear & Greed API error: ${response.status}`);
      }

      const data = await response.json();
      setCache(cacheKey, data);
      return data.data[0];
    } catch (error) {
      console.error('Error fetching Fear & Greed index:', error);
      // Return default value on error
      return {
        value: '50',
        value_classification: 'Neutral',
        timestamp: Date.now().toString(),
      };
    }
  },

  /**
   * Get detailed coin data
   */
  async getCoinDetail(coinId: string): Promise<CoinDetail> {
    const cacheKey = `coin-detail-${coinId}`;
    const cached = getCached<CoinDetail>(cacheKey);
    if (cached) return cached;

    try {
      const params = new URLSearchParams({
        localization: 'false',
        tickers: 'false',
        market_data: 'true',
        community_data: 'false',
        developer_data: 'false',
        sparkline: 'false',
      });

      const response = await fetch(`${COINGECKO_BASE_URL}/coins/${coinId}?${params}`);

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error fetching coin detail:', error);
      throw error;
    }
  },

  /**
   * Search coins
   */
  async searchCoins(query: string): Promise<{ id: string; name: string; symbol: string; thumb: string; market_cap_rank: number }[]> {
    if (!query || query.length < 2) return [];

    const cacheKey = `search-${query.toLowerCase()}`;
    const cached = getCached<{ coins: any[] }>(cacheKey);
    if (cached) return cached.coins;

    try {
      const response = await fetch(`${COINGECKO_BASE_URL}/search?query=${encodeURIComponent(query)}`);

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      setCache(cacheKey, data);
      return data.coins.slice(0, 10); // Limit to 10 results
    } catch (error) {
      console.error('Error searching coins:', error);
      return [];
    }
  },

  /**
   * Get coins by category
   */
  async getCoinsByCategory(
    category: string,
    page: number = 1,
    perPage: number = 20
  ): Promise<CoinMarketData[]> {
    const cacheKey = `category-${category}-${page}`;
    const cached = getCached<CoinMarketData[]>(cacheKey);
    if (cached) return cached;

    try {
      const params = new URLSearchParams({
        vs_currency: 'usd',
        category: category,
        order: 'market_cap_desc',
        per_page: perPage.toString(),
        page: page.toString(),
        sparkline: 'true',
        price_change_percentage: '1h,24h,7d',
      });

      const response = await fetch(`${COINGECKO_BASE_URL}/coins/markets?${params}`);

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error fetching category coins:', error);
      throw error;
    }
  },

  /**
   * Get available categories
   */
  async getCategories(): Promise<{ category_id: string; name: string }[]> {
    const cacheKey = 'categories';
    const cached = getCached<any[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${COINGECKO_BASE_URL}/coins/categories/list`);

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  },

  /**
   * Get top gainers (sorted by 24h change)
   */
  async getTopGainers(limit: number = 10): Promise<CoinMarketData[]> {
    try {
      const coins = await this.getTopCoins(1, 100, false);
      return coins
        .filter(c => c.price_change_percentage_24h > 0)
        .sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)
        .slice(0, limit);
    } catch (error) {
      console.error('Error fetching gainers:', error);
      return [];
    }
  },

  /**
   * Get top losers (sorted by 24h change)
   */
  async getTopLosers(limit: number = 10): Promise<CoinMarketData[]> {
    try {
      const coins = await this.getTopCoins(1, 100, false);
      return coins
        .filter(c => c.price_change_percentage_24h < 0)
        .sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h)
        .slice(0, limit);
    } catch (error) {
      console.error('Error fetching losers:', error);
      return [];
    }
  },

  /**
   * Clear all cache
   */
  clearCache(): void {
    cache.clear();
  },
};

// Watchlist management (localStorage)
const WATCHLIST_KEY = 'arc_wallet_watchlist';

export const watchlistService = {
  getWatchlist(): string[] {
    try {
      const stored = localStorage.getItem(WATCHLIST_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  addToWatchlist(coinId: string): void {
    const watchlist = this.getWatchlist();
    if (!watchlist.includes(coinId)) {
      watchlist.push(coinId);
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
    }
  },

  removeFromWatchlist(coinId: string): void {
    const watchlist = this.getWatchlist();
    const filtered = watchlist.filter(id => id !== coinId);
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(filtered));
  },

  isInWatchlist(coinId: string): boolean {
    return this.getWatchlist().includes(coinId);
  },

  toggleWatchlist(coinId: string): boolean {
    if (this.isInWatchlist(coinId)) {
      this.removeFromWatchlist(coinId);
      return false;
    } else {
      this.addToWatchlist(coinId);
      return true;
    }
  },
};

// Crypto News Service
export interface CryptoNews {
  id: string;
  title: string;
  url: string;
  source: string;
  published_at: string;
  currencies?: { code: string; title: string }[];
}

export const newsService = {
  /**
   * Get crypto news from CryptoCompare
   */
  async getNews(limit: number = 10): Promise<CryptoNews[]> {
    const cacheKey = `news-${limit}`;
    const cached = getCached<CryptoNews[]>(cacheKey);
    if (cached) return cached;

    try {
      // Using CryptoCompare News API (free, no key required for basic)
      const response = await fetch(
        `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=latest`
      );

      if (!response.ok) {
        throw new Error(`News API error: ${response.status}`);
      }

      const data = await response.json();
      const news: CryptoNews[] = data.Data.slice(0, limit).map((item: any) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        source: item.source,
        published_at: new Date(item.published_on * 1000).toISOString(),
        currencies: item.categories?.split('|').map((c: string) => ({ code: c, title: c })),
      }));

      setCache(cacheKey, news);
      return news;
    } catch (error) {
      console.error('Error fetching news:', error);
      return [];
    }
  },
};

export default marketDataService;
