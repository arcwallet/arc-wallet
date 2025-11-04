export function formatUSDCAmount(value: bigint, options: Intl.NumberFormatOptions = {}) {
  const decimals = 18n;
  const divisor = 10n ** decimals;
  const integerPart = value / divisor;
  const fractionPart = value % divisor;

  const fractionStr = fractionPart.toString().padStart(Number(decimals), '0').replace(/0+$/, '');
  const normalized = fractionStr ? `${integerPart}.${fractionStr}` : integerPart.toString();
  const number = Number.parseFloat(normalized);

  if (!Number.isFinite(number)) {
    return {
      raw: normalized,
      display: `${normalized} USDC`,
    };
  }

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
    ...options,
  });

  return {
    raw: normalized,
    display: formatter.format(number),
  };
}

export function formatBlockTime(timestamp: number) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}
