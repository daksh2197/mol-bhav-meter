/**
 * Every sentence the meter says lives in this file.
 * Want to change the tone, add a saying or translate it? This is the only place to touch.
 */

import { money, percent, type CurrencyCode } from './format';
import type { Offer, Result, Shop, Verdict } from './meter';

export const VERDICT_TITLE: Record<Verdict, string> = {
  great: 'Great deal',
  bargain: 'Bargain harder',
  walk: 'Walk away',
};

/** Each saying is [what you'd say in Delhi, what it means]. */
export const SAYINGS: Record<Verdict, ReadonlyArray<readonly [string, string]>> = {
  great: [
    ['Shabaash! Deal pakki karo.', 'Well done. Lock it in.'],
    ['Yeh toh lottery hai.', 'This one is a lottery ticket.'],
    ['Book it before he changes his mind.', ''],
  ],
  bargain: [
    ['Theek hai, thoda aur mol-bhav.', 'Not bad. Haggle a little more.'],
    ['Chai pilao, rate kam karwao.', 'Buy him a chai, get the rate down.'],
    ['Close. One more push.', ''],
  ],
  walk: [
    ['Nahi chalega. Agla vendor!', "Won't work. Next vendor!"],
    ['Is rate pe toh hum ghaate mein.', "At this rate we're losing money."],
    ['Say thank you and hang up.', ''],
  ],
};

/** Same deal, same saying. It changes when the numbers change, not on every keystroke. */
export function sayingFor(verdict: Verdict, offer: Offer): readonly [string, string] {
  const list = SAYINGS[verdict];
  const seed = Math.abs(Math.round(offer.pricePerPiece * 7 + offer.piecesOrdered));
  return list[seed % list.length] ?? ['', ''];
}

/**
 * Nobody haggles to the paisa. Round a counter-offer DOWN to a number you can say out loud.
 * Rounding down is the safe side: a lower ask can only help you.
 */
export function askable(quote: number): number {
  if (!Number.isFinite(quote) || quote <= 0) return 0;
  if (quote >= 20) return Math.floor(quote);
  return Math.floor(quote * 100) / 100;
}

const taxNote = (offer: Offer): string => {
  if (offer.vendorTaxRate <= 0) return '';
  return offer.taxIncluded ? ' with tax included' : ' plus tax';
};

/** The one line of coaching under the verdict. */
export function advice(result: Result, offer: Offer, currency: CurrencyCode): string {
  const cash = (n: number): string => money(n, currency);
  const note = taxNote(offer);

  if (result.impossible) {
    return 'With your costs and profit target, no vendor price works. Lower the target or raise your selling price.';
  }
  if (result.walkAwayQuote <= 0) {
    return 'Delivery alone breaks this deal. Ask for free delivery, or order more pieces to spread it out.';
  }
  switch (result.verdict) {
    case 'great':
      return `Anything up to ${cash(askable(result.greatQuote))} a piece${note} is a great deal. He is at ${cash(offer.pricePerPiece)}.`;
    case 'bargain':
      return result.greatQuote > 0
        ? `Ask for ${cash(askable(result.greatQuote))} a piece${note}. Don't go over ${cash(askable(result.walkAwayQuote))}.`
        : `You're inside your limit of ${cash(askable(result.walkAwayQuote))} a piece${note}. Push on delivery to make it great.`;
    case 'walk':
      return `He has to come down to ${cash(askable(result.walkAwayQuote))} a piece${note}, or you walk.`;
  }
}

/** A plain-text summary you can paste into WhatsApp, an email or your notes. */
export function summary(
  name: string,
  shop: Shop,
  offer: Offer,
  result: Result,
  currency: CurrencyCode,
  link?: string,
): string {
  const cash = (n: number): string => money(n, currency);
  const taxLine =
    offer.vendorTaxRate > 0
      ? offer.taxIncluded
        ? ' tax included'
        : ` plus ${percent(offer.vendorTaxRate)} tax`
      : '';
  const lines = [
    `Mol-Bhav Meter: ${VERDICT_TITLE[result.verdict].toUpperCase()}`,
    `${name || 'Product'}, selling at ${cash(shop.sellingPrice)}`,
    `Vendor: ${cash(offer.pricePerPiece)} a piece${taxLine}, delivery ${cash(offer.deliveryForOrder)}, ${offer.piecesOrdered} pieces`,
    `Cost per product: ${cash(result.costPerProduct)} (great under ${cash(result.greatCost)}, walk away over ${cash(result.walkAwayCost)})`,
    `Profit per sale: ${cash(result.profitPerSale)} (${percent(result.margin)})`,
    `If all ${result.productsFromOrder} sell: ${cash(result.orderProfit)}`,
  ];
  if (result.verdict !== 'great' && !result.impossible && result.walkAwayQuote > 0) {
    const target = result.verdict === 'bargain' && result.greatQuote > 0 ? result.greatQuote : result.walkAwayQuote;
    lines.push(`Ask for: ${cash(askable(target))} a piece`);
  }
  if (link) lines.push(link);
  return lines.join('\n');
}
