/**
 * A "deal" is everything on the screen: your shop, the vendor's offer and the currency.
 *
 * This file turns a deal into a short piece of text and back again. That one trick
 * does two jobs: it is how the page remembers your numbers between visits, and it is
 * how "Copy link" shares the exact same deal with someone else. No server, no account.
 */

import { isCurrency, type CurrencyCode } from './format';
import type { Offer, Shop } from './meter';

export interface Deal {
  name: string;
  currency: CurrencyCode;
  shop: Shop;
  offer: Offer;
}

/** The numbers the page opens with. Also the worked example in docs/THE-MATH.md. */
export const EXAMPLE: Deal = {
  name: 'Brass diya set of 6',
  currency: 'INR',
  shop: {
    sellingPrice: 1999,
    piecesPerProduct: 6,
    salesTaxRate: 0.18,
    feeRate: 0.0472,
    shippingPerSale: 100,
    packingPerSale: 120,
    targetMargin: 0.5,
    reclaimVendorTax: false,
  },
  offer: {
    pricePerPiece: 60,
    taxIncluded: false,
    vendorTaxRate: 0.18,
    deliveryForOrder: 300,
    piecesOrdered: 120,
  },
};

// Rates travel as percentages (18, not 0.18) so a link is readable by a human.
// Both directions round to four decimal places of a percent, so 9.975% goes out
// and comes back as exactly 9.975% instead of 9.975000000000001%.
const toPercent = (fraction: number): number => Math.round(fraction * 1e6) / 1e4;
const fromPercent = (percent: number): number => Math.round(percent * 1e4) / 1e6;

/** deal -> "name=Brass+diya+set+of+6&cur=INR&price=1999&..." */
export function encodeDeal(deal: Deal): string {
  const { shop, offer } = deal;
  const params = new URLSearchParams({
    name: deal.name,
    cur: deal.currency,
    price: String(shop.sellingPrice),
    pieces: String(shop.piecesPerProduct),
    tax: String(toPercent(shop.salesTaxRate)),
    fees: String(toPercent(shop.feeRate)),
    ship: String(shop.shippingPerSale),
    pack: String(shop.packingPerSale),
    target: String(toPercent(shop.targetMargin)),
    reclaim: shop.reclaimVendorTax ? '1' : '0',
    quote: String(offer.pricePerPiece),
    incl: offer.taxIncluded ? '1' : '0',
    vtax: String(toPercent(offer.vendorTaxRate)),
    delivery: String(offer.deliveryForOrder),
    qty: String(offer.piecesOrdered),
  });
  return params.toString();
}

/**
 * "…&quote=60&…" -> deal. Returns null when the text has no vendor quote in it,
 * so the caller knows to fall back to saved numbers or the example.
 * Anything missing or garbled quietly falls back to the example's value:
 * a link someone mangled should still open a working page.
 */
export function decodeDeal(text: string): Deal | null {
  const params = new URLSearchParams(text);
  if (!params.has('quote')) return null;

  const number = (key: string, fallback: number, min = 0): number => {
    const raw = params.get(key);
    if (raw === null || raw.trim() === '') return fallback;
    const value = Number(raw);
    return Number.isFinite(value) && value >= min ? value : fallback;
  };
  const flag = (key: string, fallback: boolean): boolean => {
    const raw = params.get(key);
    return raw === null ? fallback : raw === '1';
  };

  const currency = params.get('cur') ?? '';
  const { shop, offer } = EXAMPLE;

  return {
    name: (params.get('name') ?? '').slice(0, 80),
    currency: isCurrency(currency) ? currency : EXAMPLE.currency,
    shop: {
      sellingPrice: number('price', shop.sellingPrice),
      piecesPerProduct: Math.floor(number('pieces', shop.piecesPerProduct, 1)),
      salesTaxRate: fromPercent(number('tax', toPercent(shop.salesTaxRate))),
      feeRate: fromPercent(number('fees', toPercent(shop.feeRate))),
      shippingPerSale: number('ship', shop.shippingPerSale),
      packingPerSale: number('pack', shop.packingPerSale),
      targetMargin: Math.min(fromPercent(number('target', toPercent(shop.targetMargin))), 1),
      reclaimVendorTax: flag('reclaim', shop.reclaimVendorTax),
    },
    offer: {
      pricePerPiece: number('quote', offer.pricePerPiece),
      taxIncluded: flag('incl', offer.taxIncluded),
      vendorTaxRate: fromPercent(number('vtax', toPercent(offer.vendorTaxRate))),
      deliveryForOrder: number('delivery', offer.deliveryForOrder),
      piecesOrdered: Math.floor(number('qty', offer.piecesOrdered, 1)),
    },
  };
}
