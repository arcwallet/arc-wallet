import { logger } from './logger';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_PASSKEY_API_URL || 'https://arcwallet-backend.onrender.com';

let _circleWalletService: any = null;
async function getCircleWalletService() {
  if (!_circleWalletService) {
    const module = await import('./circleWalletService');
    _circleWalletService = module.circleWalletService;
  }
  return _circleWalletService;
}

export interface X402PaymentRequirements {
  price: string;
  token: string;
  recipient: string;
  network: string;
  description?: string;
  validUntil?: number;
}

export interface X402PaymentRequiredResponse {
  error: string;
  code: 'PAYMENT_REQUIRED';
  paymentRequirements: X402PaymentRequirements;
  message: string;
}

export interface X402PaymentResult {
  txHash: string;
  amount: string;
  recipient: string;
  timestamp: number;
}

export interface X402FetchOptions extends RequestInit {
  maxRetries?: number;
  onPaymentRequired?: (requirements: X402PaymentRequirements) => Promise<boolean>;
  onPaymentSent?: (result: X402PaymentResult) => void;
}

function isPaymentRequired(response: Response): boolean {
  return response.status === 402;
}

async function parsePaymentRequirements(
  response: Response
): Promise<X402PaymentRequirements> {
  const data = await response.json() as X402PaymentRequiredResponse;

  if (!data.paymentRequirements) {
    throw new Error('Invalid 402 response: missing paymentRequirements');
  }

  return data.paymentRequirements;
}

async function executePayment(
  requirements: X402PaymentRequirements
): Promise<X402PaymentResult> {
  logger.info('Executing x402 payment', {
    component: 'x402Client',
    amount: requirements.price,
    recipient: requirements.recipient,
  });

  // USDC token address on Arc Testnet
  const USDC_ADDRESS = '0x0000000000000000000000000000000000000001'; // Native USDC on Arc

  try {
    // Use Circle Wallet to send USDC payment (lazy loaded)
    const circleWallet = await getCircleWalletService();
    const txHash = await circleWallet.sendTokenTransfer({
      tokenAddress: USDC_ADDRESS,
      to: requirements.recipient,
      amount: requirements.price,
      decimals: 6, // USDC has 6 decimals
    });

    const result: X402PaymentResult = {
      txHash,
      amount: requirements.price,
      recipient: requirements.recipient,
      timestamp: Date.now(),
    };

    logger.info('x402 payment successful', {
      component: 'x402Client',
      txHash,
    });

    return result;
  } catch (error: any) {
    logger.error('x402 payment failed', {
      component: 'x402Client',
      errorMsg: error.message,
    });
    throw new Error(`Payment failed: ${error.message}`);
  }
}

export async function x402Fetch(
  url: string,
  options: X402FetchOptions = {}
): Promise<Response> {
  const {
    maxRetries = 1,
    onPaymentRequired,
    onPaymentSent,
    ...fetchOptions
  } = options;

  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

  logger.info('x402 fetch request', {
    component: 'x402Client',
    url: fullUrl,
  });

  // Initial request
  let response = await fetch(fullUrl, fetchOptions);

  // Check for 402 Payment Required
  if (isPaymentRequired(response)) {
    logger.info('Received 402 Payment Required', {
      component: 'x402Client',
      url: fullUrl,
    });

    // Parse payment requirements
    const requirements = await parsePaymentRequirements(response);

    // Ask for user approval if callback provided
    if (onPaymentRequired) {
      const approved = await onPaymentRequired(requirements);
      if (!approved) {
        throw new Error('Payment rejected by user');
      }
    }

    // Execute payment
    const paymentResult = await executePayment(requirements);

    // Notify about payment
    if (onPaymentSent) {
      onPaymentSent(paymentResult);
    }

    // Retry request with payment proof
    const retryHeaders = new Headers(fetchOptions.headers);
    retryHeaders.set('X-Payment-TxHash', paymentResult.txHash);

    response = await fetch(fullUrl, {
      ...fetchOptions,
      headers: retryHeaders,
    });

    // If still 402, payment verification failed
    if (isPaymentRequired(response)) {
      throw new Error('Payment verification failed on server');
    }
  }

  return response;
}

export async function x402FetchJSON<T>(
  url: string,
  options: X402FetchOptions = {}
): Promise<T> {
  const response = await x402Fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Request failed: ${response.status}`);
  }

  return response.json();
}

export async function getAgentPricing(): Promise<{
  services: Array<{
    id: string;
    name: string;
    price: string;
    token: string;
    description: string;
  }>;
  paymentRecipient: string;
  network: string;
}> {
  const response = await fetch(`${API_BASE_URL}/api/agent/pricing`);
  return response.json();
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function parseIntent(
  message: string,
  conversationHistory?: ConversationMessage[]
): Promise<{
  success: boolean;
  message: string;
  intent: {
    type: string;
    params: Record<string, any>;
  };
  confidence: number;
}> {
  const url = `${API_BASE_URL}/api/agent/parse-intent`;
  logger.info('parseIntent request', { component: 'x402Client', url });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        message,
        conversationHistory: conversationHistory?.slice(-10), // Send last 10 messages for context
      }),
      credentials: 'include', // Include cookies for CORS
      mode: 'cors',
    });

    logger.info('parseIntent response', { component: 'x402Client', status: response.status });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Request failed: ${response.status}`);
    }

    return response.json();
  } catch (error: any) {
    logger.error('parseIntent error', { component: 'x402Client', errorMsg: error.message });
    // Return fallback response instead of throwing
    return {
      success: true,
      message: 'Processing locally...',
      intent: { type: 'UNKNOWN', params: {} },
      confidence: 0.5,
    };
  }
}

export async function analyzeWalletRisk(
  address: string,
  options: X402FetchOptions = {}
): Promise<{
  success: boolean;
  address: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  flags: string[];
  recommendation: string;
  details: Record<string, any>;
}> {
  return x402FetchJSON(`/api/agent/risk/${address}`, options);
}

export async function getTokenPrice(
  token: string,
  options: X402FetchOptions = {}
): Promise<{
  success: boolean;
  token: string;
  price: number;
  currency: string;
  change24h: number;
  volume24h: number;
  marketCap: number;
  lastUpdated: string;
}> {
  return x402FetchJSON(`/api/agent/price/${token}`, options);
}

export async function getNewsSummary(
  options: X402FetchOptions = {}
): Promise<{
  success: boolean;
  summary: string;
  headlines: Array<{ title: string; source: string; sentiment: string }>;
  marketSentiment: string;
  generatedAt: string;
}> {
  return x402FetchJSON('/api/agent/news', options);
}

export default {
  x402Fetch,
  x402FetchJSON,
  getAgentPricing,
  parseIntent,
  analyzeWalletRisk,
  getTokenPrice,
  getNewsSummary,
};
