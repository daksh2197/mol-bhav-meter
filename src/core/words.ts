/**
 * Every sentence the meter writes while it runs lives in this file: verdicts, sayings,
 * coaching, the ledger, the summary and the little status messages.
 * (The fixed labels on the form are in index.html.)
 *
 * Want to change the tone, add a saying or translate it? Start here.
 */

import type { Deal } from './deal';
import { money, percent, type CurrencyCode } from './format';
import type { Offer, Result, Shop, Verdict } from './meter';

export const VERDICT_TITLE: Record<Verdict, string> = {
  great: 'Great deal',
  bargain: 'Bargain harder',
  walk: 'Walk away',
};

/** What the verdict line says before a vendor price has been typed. */
export const IDLE_TITLE = "Type the vendor's price";

/** Each saying is [the line, what it means]. The meaning is blank when the line is already English. */
export const SAYINGS: Record<Verdict, ReadonlyArray<readonly [string, string]>> = {
  great: [
    ['Shabaash! Deal pakki karo.', 'Well done. Lock it in.'],
    ['Yeh toh jackpot hai.', 'This one is a jackpot.'],
    ['Book it before the price changes.', ''],
  ],
  bargain: [
    ['Theek hai, thoda aur mol-bhav.', 'Not bad. Haggle a little more.'],
    ['Bhaiya, thoda kam karo.', 'Brother, bring it down a little.'],
    ['Close. One more push.', ''],
  ],
  walk: [
    ['Nahi chalega. Agla vendor!', "Won't work. Next vendor!"],
    ['Itna mehenga? Rehne do.', 'That expensive? Leave it.'],
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

/**
 * The two prices printed on the dial, as numbers you can say out loud.
 * Null when there is no vendor price that could work at all.
 */
export function linesFor(result: Result): { great: number; walk: number } | null {
  const walk = askable(result.walkAwayQuote);
  if (result.impossible || walk <= 0) return null;
  return { great: askable(result.greatQuote), walk };
}

const taxNote = (offer: Offer): string => {
  if (offer.vendorTaxRate <= 0) return '';
  return offer.taxIncluded ? ' with tax included' : ' plus tax';
};

/** The one line of coaching under the verdict, once a vendor price is in. */
export function advice(result: Result, offer: Offer, currency: CurrencyCode): string {
  const cash = (n: number): string => money(n, currency);
  const note = taxNote(offer);
  const lines = linesFor(result);

  if (!lines) {
    return !result.impossible && offer.deliveryForOrder > 0
      ? 'Delivery alone breaks this deal. Ask for free delivery, or order more pieces to spread it out.'
      : 'With your costs and profit target, no vendor price works. Lower the target or raise your selling price.';
  }

  const quote = offer.pricePerPiece;
  switch (result.verdict) {
    case 'great':
      // The printed line is rounded down, so a quote can be great and still sit a hair above it.
      return quote <= lines.great
        ? `Anything up to ${cash(lines.great)} a piece${note} is a great deal. The vendor is at ${cash(quote)}.`
        : 'Just inside the great-deal line. Book it.';
    case 'bargain':
      if (lines.great <= 0) {
        return `You're inside your limit of ${cash(lines.walk)} a piece${note}. Push on delivery to make it great.`;
      }
      return quote <= lines.walk
        ? `Ask for ${cash(lines.great)} a piece${note}. Don't go over ${cash(lines.walk)}.`
        : `Right on your limit. Ask for ${cash(lines.great)} a piece${note}.`;
    case 'walk':
      return `The vendor has to come down to ${cash(lines.walk)} a piece${note}, or you walk.`;
  }
}

/** The coaching line before a vendor price has been typed. */
export function idleAdvice(result: Result, shop: Shop, offer: Offer, currency: CurrencyCode): string {
  if (shop.sellingPrice <= 0) return 'Add your selling price below, then type what the vendor quoted.';
  const lines = linesFor(result);
  if (!lines) return advice(result, offer, currency);
  const cash = (n: number): string => money(n, currency);
  return lines.great > 0
    ? `Before the vendor names a price: great is ${cash(lines.great)} a piece or less. Over ${cash(lines.walk)}, you walk.`
    : `Before the vendor names a price: over ${cash(lines.walk)} a piece, you walk.`;
}

/** The small figure under the needle. */
export function limitRead(result: Result): string {
  if (result.impossible) return '';
  const share = Math.round(result.shareOfLimit * 100);
  return share > 999 ? 'over 999% of your limit' : `${share}% of your limit`;
}

/** What a screen reader hears for the dial. */
export function dialDescription(result: Result, ready: boolean): string {
  if (!ready) return 'Deal meter. Waiting for the vendor price.';
  const read = limitRead(result);
  return `Deal meter: ${VERDICT_TITLE[result.verdict]}.${read ? ` The vendor's price puts your cost at ${read}.` : ''}`;
}

/** One sale, line by line. With no vendor price yet, it stops before the vendor's line. */
export function ledgerRows(
  shop: Shop,
  result: Result,
  currency: CurrencyCode,
  ready: boolean,
): Array<[label: string, amount: number]> {
  const pieces = shop.piecesPerProduct;
  const rows: Array<[string, number]> = [['Customer pays', shop.sellingPrice]];
  if (result.taxOnSale > 0) rows.push(['Sales tax you pass on', -result.taxOnSale]);
  rows.push(
    ['Payment and store fees', -result.fees],
    ['Shipping', -shop.shippingPerSale],
    ['Packing', -shop.packingPerSale],
  );
  if (!ready) {
    rows.push(['Left for the vendor and your profit', result.netSale - result.fees - shop.shippingPerSale - shop.packingPerSale]);
    return rows;
  }
  rows.push(
    [`Vendor: ${pieces} ${pieces === 1 ? 'piece' : 'pieces'} at ${money(result.landedPerPiece, currency)} landed`, -result.costPerProduct],
    ['Profit', result.profitPerSale],
  );
  return rows;
}

/** What the whole order adds up to. */
export function orderLine(shop: Shop, result: Result, currency: CurrencyCode, ready: boolean): string {
  if (!ready) return "Type the vendor's price to see what this order makes.";
  const made = result.productsFromOrder;
  if (made === 0) {
    return `This order is too small to make one product. You need at least ${shop.piecesPerProduct} pieces.`;
  }
  const leftover =
    result.leftoverPieces > 0
      ? `, with ${result.leftoverPieces} ${result.leftoverPieces === 1 ? 'piece' : 'pieces'} left over`
      : '';
  const outcome = result.orderProfit >= 0 ? 'you keep' : 'you lose';
  return `This order makes ${made} ${made === 1 ? 'product' : 'products'}${leftover}. If they all sell, ${outcome} ${money(Math.abs(result.orderProfit), currency)}.`;
}

/** Shown in place of the summary before there is a deal to summarise. */
export const NO_SUMMARY_YET = "Type the vendor's price to get a summary you can send.";

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
  const text = [
    `Mol-Bhav Meter: ${VERDICT_TITLE[result.verdict].toUpperCase()}`,
    `${name || 'Product'}, selling at ${cash(shop.sellingPrice)}`,
    `Vendor: ${cash(offer.pricePerPiece)} a piece${taxLine}, delivery ${cash(offer.deliveryForOrder)}, ${offer.piecesOrdered} pieces`,
    `Cost per product: ${cash(result.costPerProduct)} (great under ${cash(result.greatCost)}, walk away over ${cash(result.walkAwayCost)})`,
    `Profit per sale: ${cash(result.profitPerSale)} (${percent(result.margin)})`,
    `If all ${result.productsFromOrder} sell: ${cash(result.orderProfit)}`,
  ];
  const lines = linesFor(result);
  if (lines && result.verdict !== 'great') {
    const target = result.verdict === 'bargain' && lines.great > 0 ? lines.great : lines.walk;
    text.push(`Ask for: ${cash(target)} a piece`);
  }
  if (link) text.push(link);
  return text.join('\n');
}

/** The banner shown while the opening example is still on screen. */
export function exampleNote(deal: Deal): string {
  return `Example numbers: ${deal.name}, selling at ${money(deal.shop.sellingPrice, deal.currency)}. Change any of them.`;
}

/** Status messages for the copy buttons. */
export const TOAST = {
  summaryCopied: 'Summary copied.',
  linkCopied: 'Link copied.',
  copyBlocked: "This browser won't copy for you. It's selected below: press and hold, then Copy.",
} as const;
