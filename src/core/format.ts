/**
 * Money on screen. The math in meter.ts never rounds; rounding happens here,
 * at the last moment, so small errors never pile up.
 */

export const CURRENCIES = {
  INR: { locale: 'en-IN', label: 'Indian rupee (₹)' },
  CAD: { locale: 'en-CA', label: 'Canadian dollar ($)' },
  USD: { locale: 'en-US', label: 'US dollar ($)' },
  GBP: { locale: 'en-GB', label: 'British pound (£)' },
  EUR: { locale: 'en-IE', label: 'Euro (€)' },
  AED: { locale: 'en-AE', label: 'UAE dirham (AED)' },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export const isCurrency = (code: string): code is CurrencyCode => Object.hasOwn(CURRENCIES, code);

/**
 * ₹1,999 and ₹54.31, never ₹54.3 or ₹1,999.00.
 * Small amounts with paise or cents keep two decimals. Everything else is whole.
 */
export function money(amount: number, code: CurrencyCode): string {
  const value = Number.isFinite(amount) ? amount : 0;
  const rounded = Math.round(value * 100) / 100;
  const showDecimals = Math.abs(rounded) < 1000 && !Number.isInteger(rounded);
  const digits = showDecimals ? 2 : 0;
  return new Intl.NumberFormat(CURRENCIES[code].locale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
    .format(rounded)
    .replace('-', '−');
}

/** The bare symbol, for the little prefix inside money inputs. */
export function symbol(code: CurrencyCode): string {
  const parts = new Intl.NumberFormat(CURRENCIES[code].locale, { style: 'currency', currency: code }).formatToParts(0);
  return parts.find((part) => part.type === 'currency')?.value ?? code;
}

export const percent = (fraction: number): string => `${Math.round(fraction * 100)}%`;
