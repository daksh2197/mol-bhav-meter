/**
 * The brain of Mol-Bhav Meter.
 *
 * Nothing in this file touches the screen, the browser or the network.
 * Numbers go in, numbers come out. That is called a "pure function",
 * and it is why this file is easy to test and hard to break.
 *
 * If a number on screen ever looks wrong, the bug is either here
 * or in how the screen feeds this file. Start here.
 */

/** Your side of the deal: what you sell and what it costs you to sell it. */
export interface Shop {
  /** What a customer pays for one product. Includes sales tax if you charge it. */
  sellingPrice: number;
  /** Vendor pieces inside one product. A "set of 6 diyas" is 6. A single mug is 1. */
  piecesPerProduct: number;
  /** Sales tax inside your selling price, as a fraction. 18% is 0.18. Use 0 if you don't charge tax. */
  salesTaxRate: number;
  /** Payment gateway plus store platform fees, as a fraction of the selling price. */
  feeRate: number;
  /** What you pay to ship one sale. Use 0 if the customer pays for shipping. */
  shippingPerSale: number;
  /** Box, filler and tape for one sale. */
  packingPerSale: number;
  /** The profit you want to keep, as a fraction of sales after tax. 0.5 means half. */
  targetMargin: number;
  /** True if you are tax-registered and the tax on the vendor's bill comes back to you. */
  reclaimVendorTax: boolean;
}

/** The vendor's side: what was just said on the phone. */
export interface Offer {
  /** The vendor's price for one piece, exactly as quoted. */
  pricePerPiece: number;
  /** True if the quoted price already has tax in it. False if the vendor said "plus tax". */
  taxIncluded: boolean;
  /** The tax rate on the vendor's bill, as a fraction. */
  vendorTaxRate: number;
  /** Delivery to your door for the whole order. */
  deliveryForOrder: number;
  /** How many pieces you would order. */
  piecesOrdered: number;
}

export type Verdict = 'great' | 'bargain' | 'walk';

export interface Result {
  verdict: Verdict;
  /** True when your own costs are so high that even free goods miss the target. */
  impossible: boolean;

  /** What you keep from one sale after sales tax. */
  netSale: number;
  /** Sales tax inside one sale. */
  taxOnSale: number;
  /** Payment and platform fees on one sale. */
  fees: number;

  /** Real cost of one vendor piece: the quoted price, tax you can't reclaim, and its share of delivery. */
  landedPerPiece: number;
  /** Vendor cost inside one product. */
  costPerProduct: number;

  /** The most one product can cost you and still hit your profit target. */
  walkAwayCost: number;
  /** Three quarters of the walk-away cost. At or under this, book it. */
  greatCost: number;
  /** The vendor price per piece (as the vendor quotes it) that lands exactly on the walk-away cost. */
  walkAwayQuote: number;
  /** The vendor price per piece (as the vendor quotes it) that lands exactly on the great-deal cost. */
  greatQuote: number;

  profitPerSale: number;
  /** Profit as a fraction of sales after tax. */
  margin: number;

  /** Cost divided by walk-away cost. 1.0 is the redline. Capped at SHARE_MAX so it is always a real number. */
  shareOfLimit: number;
  /** The same thing, capped at DIAL_MAX. Drives the needle, which stops at the end of the dial. */
  load: number;

  /** Whole products you can make from this order. */
  productsFromOrder: number;
  /** Pieces you pay for that don't fill a whole product. */
  leftoverPieces: number;
  /** Profit if every product from this order sells, after paying for the leftovers too. */
  orderProfit: number;
}

/** A deal is "great" when the cost is at or under this share of the walk-away cost. */
export const GREAT_FRACTION = 0.75;
/** The dial stops here. 1.5 means "50% over your walk-away cost". */
export const DIAL_MAX = 1.5;

/** "999 times over your limit" is as far as the share-of-limit figure goes. */
export const SHARE_MAX = 999;

/** Floating point leaves crumbs like 0.30000000000000004. This is the broom. */
const EPSILON = 1e-9;
/** Half the smallest coin. A walk-away cost below this is zero, whatever the crumbs say. */
const SMALLEST_MONEY = 0.005;
/** Nobody is haggling over a trillion. Bigger inputs are typos, and they turn into Infinity downstream. */
const BIGGEST_MONEY = 1e12;
const BIGGEST_COUNT = 1e9;

const nonNegative = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.min(n, BIGGEST_MONEY) : 0);
const wholeAtLeastOne = (n: number): number =>
  Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), BIGGEST_COUNT) : 1;

/**
 * How much of the vendor's quoted price really leaves your pocket.
 *
 *   "₹60 plus 18% tax", tax doesn't come back  ->  you pay 60 x 1.18
 *   "₹60 plus 18% tax", tax comes back         ->  you pay 60
 *   "₹60 all in",       tax doesn't come back  ->  you pay 60
 *   "₹60 all in",       tax comes back         ->  you pay 60 / 1.18
 */
export function taxMultiplier(offer: Pick<Offer, 'taxIncluded' | 'vendorTaxRate'>, reclaim: boolean): number {
  const rate = nonNegative(offer.vendorTaxRate);
  if (offer.taxIncluded) return reclaim ? 1 / (1 + rate) : 1;
  return reclaim ? 1 : 1 + rate;
}

/** Run the numbers on one vendor offer. */
export function judge(shop: Shop, offer: Offer): Result {
  // Your side: what one sale leaves on the table before paying the vendor.
  const price = nonNegative(shop.sellingPrice);
  const pieces = wholeAtLeastOne(shop.piecesPerProduct);
  const netSale = price / (1 + nonNegative(shop.salesTaxRate));
  const taxOnSale = price - netSale;
  const fees = price * nonNegative(shop.feeRate);
  const overhead = fees + nonNegative(shop.shippingPerSale) + nonNegative(shop.packingPerSale);
  const target = Math.min(nonNegative(shop.targetMargin), 1);

  // The two lines on the dial.
  const room = netSale * (1 - target) - overhead;
  const walkAwayCost = room < SMALLEST_MONEY ? 0 : room;
  const greatCost = walkAwayCost * GREAT_FRACTION;
  const impossible = walkAwayCost === 0;

  // The vendor's side: what one piece really costs once it is sitting in your home.
  const ordered = wholeAtLeastOne(offer.piecesOrdered);
  const deliveryShare = nonNegative(offer.deliveryForOrder) / ordered;
  const multiplier = taxMultiplier(offer, shop.reclaimVendorTax);
  const landedPerPiece = nonNegative(offer.pricePerPiece) * multiplier + deliveryShare;
  const costPerProduct = landedPerPiece * pieces;

  const profitPerSale = netSale - overhead - costPerProduct;
  const margin = netSale > 0 ? profitPerSale / netSale : 0;

  // Work backwards: what would the vendor have to quote to land on each line?
  const quoteFor = (costLevel: number): number => (costLevel / pieces - deliveryShare) / multiplier;

  let verdict: Verdict;
  if (impossible) verdict = 'walk';
  else if (costPerProduct <= greatCost + EPSILON) verdict = 'great';
  else if (costPerProduct <= walkAwayCost + EPSILON) verdict = 'bargain';
  else verdict = 'walk';

  const shareOfLimit = impossible ? SHARE_MAX : Math.min(costPerProduct / walkAwayCost, SHARE_MAX);

  const productsFromOrder = Math.floor(ordered / pieces);
  const leftoverPieces = ordered - productsFromOrder * pieces;
  const orderProfit = productsFromOrder * (netSale - overhead) - ordered * landedPerPiece;

  return {
    verdict,
    impossible,
    netSale,
    taxOnSale,
    fees,
    landedPerPiece,
    costPerProduct,
    walkAwayCost,
    greatCost,
    walkAwayQuote: quoteFor(walkAwayCost),
    greatQuote: quoteFor(greatCost),
    profitPerSale,
    margin,
    shareOfLimit,
    load: Math.min(shareOfLimit, DIAL_MAX),
    productsFromOrder,
    leftoverPieces,
    orderProfit,
  };
}
