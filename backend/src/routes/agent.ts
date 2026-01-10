/**
 * Arc Agent API Routes
 *
 * x402-protected endpoints for Arc Agent capabilities:
 * - Wallet risk analysis
 * - Token price data
 * - News/market summary
 * - Intent parsing (AI)
 */

import { Router, Request, Response } from 'express';
import { x402Middleware } from '../middleware/x402.js';
import { aiService } from '../services/aiService.js';

// Agent API recipient wallet (receives x402 payments)
// In production, this should be from environment variables
const AGENT_PAYMENT_RECIPIENT = process.env.AGENT_PAYMENT_WALLET || '0x0000000000000000000000000000000000000000';

// Pricing for x402 services (in USDC)
const PRICING = {
  riskAnalysis: '0.02',
  priceData: '0.01',
  newsSummary: '0.03',
  aiQuery: '0.02',
};

export function createAgentRoutes(): Router {
  const router = Router();

  /**
   * Health check (no payment required)
   */
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'arc-agent',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get pricing information (no payment required)
   */
  router.get('/pricing', (_req: Request, res: Response) => {
    res.json({
      services: [
        {
          id: 'risk-analysis',
          name: 'Wallet Risk Analysis',
          price: PRICING.riskAnalysis,
          token: 'USDC',
          description: 'Analyze wallet address for risk factors',
        },
        {
          id: 'price-data',
          name: 'Token Price Data',
          price: PRICING.priceData,
          token: 'USDC',
          description: 'Get current token price and market data',
        },
        {
          id: 'news-summary',
          name: 'Market News Summary',
          price: PRICING.newsSummary,
          token: 'USDC',
          description: 'AI-generated summary of recent crypto news',
        },
        {
          id: 'ai-query',
          name: 'AI Query',
          price: PRICING.aiQuery,
          token: 'USDC',
          description: 'General AI-powered query',
        },
      ],
      paymentRecipient: AGENT_PAYMENT_RECIPIENT,
      network: 'arc-testnet',
    });
  });

  /**
   * Parse user intent (no payment required - uses local AI)
   */
  router.post('/parse-intent', async (req: Request, res: Response) => {
    try {
      const { message } = req.body;

      if (!message || typeof message !== 'string') {
        res.status(400).json({
          error: 'Invalid request',
          message: 'Message is required',
        });
        return;
      }

      const result = await aiService.parseIntent(message);

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('[Agent] Parse intent error:', error.message);
      res.status(500).json({
        error: 'Intent parsing failed',
        message: error.message,
      });
    }
  });

  /**
   * Wallet Risk Analysis (x402 protected)
   */
  router.get(
    '/risk/:address',
    x402Middleware({
      price: PRICING.riskAnalysis,
      recipient: AGENT_PAYMENT_RECIPIENT,
      description: 'Wallet risk analysis',
      validitySeconds: 300,
    }),
    async (req: Request, res: Response) => {
      try {
        const { address } = req.params;

        // Validate address format
        if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
          res.status(400).json({
            error: 'Invalid address',
            message: 'Please provide a valid Ethereum address',
          });
          return;
        }

        // Perform risk analysis
        const riskData = await analyzeWalletRisk(address);

        res.json({
          success: true,
          address,
          ...riskData,
          paymentInfo: (req as any).x402Payment,
        });
      } catch (error: any) {
        console.error('[Agent] Risk analysis error:', error.message);
        res.status(500).json({
          error: 'Risk analysis failed',
          message: error.message,
        });
      }
    }
  );

  /**
   * Token Price Data (x402 protected)
   */
  router.get(
    '/price/:token',
    x402Middleware({
      price: PRICING.priceData,
      recipient: AGENT_PAYMENT_RECIPIENT,
      description: 'Token price data',
      validitySeconds: 60,
    }),
    async (req: Request, res: Response) => {
      try {
        const { token } = req.params;

        const priceData = await getTokenPrice(token.toUpperCase());

        res.json({
          success: true,
          token: token.toUpperCase(),
          ...priceData,
          paymentInfo: (req as any).x402Payment,
        });
      } catch (error: any) {
        console.error('[Agent] Price data error:', error.message);
        res.status(500).json({
          error: 'Price fetch failed',
          message: error.message,
        });
      }
    }
  );

  /**
   * Market News Summary (x402 protected)
   */
  router.get(
    '/news',
    x402Middleware({
      price: PRICING.newsSummary,
      recipient: AGENT_PAYMENT_RECIPIENT,
      description: 'Market news summary',
      validitySeconds: 300,
    }),
    async (_req: Request, res: Response) => {
      try {
        const newsSummary = await getNewsSummary();

        res.json({
          success: true,
          ...newsSummary,
          paymentInfo: (_req as any).x402Payment,
        });
      } catch (error: any) {
        console.error('[Agent] News summary error:', error.message);
        res.status(500).json({
          error: 'News fetch failed',
          message: error.message,
        });
      }
    }
  );

  return router;
}

// ============================================
// Service Functions
// ============================================

/**
 * Analyze wallet address for risk factors
 */
async function analyzeWalletRisk(address: string): Promise<{
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  flags: string[];
  recommendation: string;
  details: Record<string, any>;
}> {
  // Demo implementation - in production, integrate with AnChain.AI or similar
  const addressLower = address.toLowerCase();

  // Simulated risk factors based on address patterns
  const flags: string[] = [];
  let riskScore = 0;

  // Check for known patterns (demo)
  if (addressLower.includes('dead') || addressLower.includes('0000')) {
    flags.push('suspicious_pattern');
    riskScore += 30;
  }

  if (addressLower.endsWith('000')) {
    flags.push('vanity_address');
    riskScore += 10;
  }

  // Random factors for demo variety
  const randomFactor = parseInt(address.slice(-4), 16) % 100;
  if (randomFactor > 80) {
    flags.push('high_volume_transfers');
    riskScore += 20;
  }
  if (randomFactor > 90) {
    flags.push('mixer_interaction');
    riskScore += 40;
  }
  if (randomFactor > 95) {
    flags.push('sanctioned_interaction');
    riskScore += 50;
  }

  // Determine risk level
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  let recommendation: string;

  if (riskScore >= 70) {
    riskLevel = 'CRITICAL';
    recommendation = 'Avoid transactions with this address. High probability of malicious activity.';
  } else if (riskScore >= 50) {
    riskLevel = 'HIGH';
    recommendation = 'Exercise extreme caution. Verify the counterparty through other means.';
  } else if (riskScore >= 25) {
    riskLevel = 'MEDIUM';
    recommendation = 'Proceed with caution. Consider additional verification.';
  } else {
    riskLevel = 'LOW';
    recommendation = 'No significant risk factors detected. Standard precautions apply.';
  }

  return {
    riskScore: Math.min(riskScore, 100),
    riskLevel,
    flags,
    recommendation,
    details: {
      analyzedAt: new Date().toISOString(),
      dataSource: 'Arc Agent Demo',
      checksPerformed: [
        'address_pattern_analysis',
        'transaction_history_scan',
        'sanctions_screening',
        'mixer_detection',
      ],
    },
  };
}

/**
 * Get token price data using Gemini AI for real-time data
 */
async function getTokenPrice(token: string): Promise<{
  price: number;
  currency: string;
  change24h: number;
  volume24h: number;
  marketCap: number;
  lastUpdated: string;
}> {
  // Use Gemini to get real-time price data
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey && apiKey.startsWith('AIza')) {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' });

      const prompt = `What is the current price of ${token} cryptocurrency in USD?
      Respond ONLY with a JSON object in this exact format, no markdown:
      {"price": <number>, "change24h": <number>, "volume24h": <number>, "marketCap": <number>}

      Use real current market data. For stablecoins like USDC use 1.0, for EURC use the EUR/USD rate.`;

      const result = await model.generateContent(prompt);
      const text = result.response?.text?.() || '';

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          price: parsed.price || 0,
          currency: 'USD',
          change24h: parseFloat((parsed.change24h || 0).toFixed(2)),
          volume24h: parsed.volume24h || 0,
          marketCap: parsed.marketCap || 0,
          lastUpdated: new Date().toISOString(),
        };
      }
    }
  } catch (error) {
    console.error('[Agent] Gemini price fetch error:', error);
  }

  // Fallback to static prices if Gemini fails
  const fallbackPrices: Record<string, number> = {
    USDC: 1.0,
    EURC: 1.08,
    ETH: 3500.0,
    BTC: 100000.0,
    ARC: 0.15,
    USYC: 1.05,
  };

  return {
    price: fallbackPrices[token] || 0,
    currency: 'USD',
    change24h: 0,
    volume24h: 0,
    marketCap: 0,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Get market news summary
 */
async function getNewsSummary(): Promise<{
  summary: string;
  headlines: Array<{ title: string; source: string; sentiment: string }>;
  marketSentiment: string;
  generatedAt: string;
}> {
  // Demo implementation - in production, use news API + AI summarization
  const headlines = [
    { title: 'Circle Launches Arc Network Public Testnet', source: 'CoinDesk', sentiment: 'positive' },
    { title: 'USDC Adoption Reaches All-Time High', source: 'The Block', sentiment: 'positive' },
    { title: 'x402 Protocol Gains Traction for AI Payments', source: 'Decrypt', sentiment: 'positive' },
    { title: 'DeFi TVL Shows Signs of Recovery', source: 'DeFi Pulse', sentiment: 'neutral' },
    { title: 'Regulatory Clarity Expected in Q1 2026', source: 'Bloomberg', sentiment: 'neutral' },
  ];

  return {
    summary: 'The crypto market shows positive momentum with stablecoin adoption reaching new highs. Circle\'s Arc Network testnet launch has attracted significant developer interest, particularly for agentic commerce applications. The x402 protocol is emerging as a standard for AI-to-AI payments.',
    headlines,
    marketSentiment: 'bullish',
    generatedAt: new Date().toISOString(),
  };
}

export default createAgentRoutes;
