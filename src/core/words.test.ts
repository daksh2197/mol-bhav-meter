import { describe, expect, it } from 'vitest';
import { EXAMPLE } from './deal';
import { money, percent, symbol } from './format';
import { judge } from './meter';
import {
  advice,
  askable,
  dialDescription,
  exampleNote,
  idleAdvice,
  ledgerRows,
  limitRead,
  linesFor,
  orderLine,
  SAYINGS,
  sayingFor,
  summary,
  VERDICT_TITLE,
} from './words';

// The opening example: a tax-registered shop selling a diya set at ₹1,999, quoted ₹72 a piece plus tax.
const { shop, offer } = EXAMPLE;

describe('money on screen', () => {
  it('groups rupees the Indian way and drops pointless decimals', () => {
    expect(money(1999, 'INR')).toBe('₹1,999');
    expect(money(123456, 'INR')).toBe('₹1,23,456');
    expect(money(54.309, 'INR')).toBe('₹54.31');
    expect(money(439.8, 'INR')).toBe('₹439.80');
    expect(money(18798.3, 'INR')).toBe('₹18,798');
  });

  it('keeps the cents on dollars, however big the amount', () => {
    expect(money(12.5, 'CAD')).toBe('$12.50');
    expect(money(12, 'CAD')).toBe('$12');
    expect(money(1999.99, 'CAD')).toBe('$1,999.99');
  });

  it('uses a real minus sign for losses', () => {
    expect(money(-50, 'INR')).toBe('−₹50');
  });

  it('never prints "minus zero"', () => {
    expect(money(-0, 'INR')).toBe('₹0');
    expect(money(-0.001, 'INR')).toBe('₹0');
  });

  it('does not print NaN at people', () => {
    expect(money(NaN, 'INR')).toBe('₹0');
  });

  it('knows each currency symbol', () => {
    expect(symbol('INR')).toBe('₹');
    expect(symbol('CAD')).toBe('$');
    expect(symbol('GBP')).toBe('£');
  });

  it('rounds percentages to whole numbers', () => {
    expect(percent(0.5548)).toBe('55%');
  });
});

describe('a counter-offer you can say out loud', () => {
  it('rounds down, never up', () => {
    expect(askable(54.31)).toBe(54);
    expect(askable(73.99)).toBe(73);
  });

  it('keeps cents on small prices', () => {
    expect(askable(4.379)).toBe(4.37);
  });

  it('gives zero for nonsense', () => {
    expect(askable(-3)).toBe(0);
    expect(askable(NaN)).toBe(0);
  });

  it('gives the two prices for the dial', () => {
    expect(linesFor(judge(shop, offer))).toEqual({ great: 64, walk: 86 });
  });

  it('gives no prices when nothing could work', () => {
    expect(linesFor(judge({ ...shop, shippingPerSale: 900 }, offer))).toBeNull();
  });
});

describe('the coaching line', () => {
  const say = (quote: Partial<typeof offer>, shopChanges: Partial<typeof shop> = {}): string => {
    const o = { ...offer, ...quote };
    return advice(judge({ ...shop, ...shopChanges }, o), o, 'INR');
  };

  it('bargain: names the price to ask for and the price to stop at', () => {
    expect(say({})).toBe("Ask for ₹64 a piece plus tax. Don't go over ₹86.");
  });

  it('great: tells you how much room is left', () => {
    expect(say({ pricePerPiece: 45 })).toBe('Anything up to ₹64 a piece plus tax is a great deal. The vendor is at ₹45.');
  });

  it('walk: names the number the vendor has to hit', () => {
    expect(say({ pricePerPiece: 125 })).toBe('The vendor has to come down to ₹86 a piece plus tax, or you walk.');
  });

  it('says "with tax included" when that is how the price was quoted', () => {
    expect(say({ pricePerPiece: 130, taxIncluded: true })).toBe(
      'The vendor has to come down to ₹101 a piece with tax included, or you walk.',
    );
  });

  // The printed lines are rounded down to whole rupees, so there is a sliver of prices
  // that pass the real line but sit above the printed one. The words must not contradict the verdict.
  it('does not say "up to ₹64" to someone who is great at ₹64.05', () => {
    const o = { ...offer, pricePerPiece: 64.05 };
    expect(judge(shop, o).verdict).toBe('great');
    expect(say({ pricePerPiece: 64.05 })).toBe('Just inside the great-deal line. Book it.');
  });

  it('does not say "don\'t go over ₹86" to someone who is inside the limit at ₹86.20', () => {
    const o = { ...offer, pricePerPiece: 86.2 };
    expect(judge(shop, o).verdict).toBe('bargain');
    expect(say({ pricePerPiece: 86.2 })).toBe('Right on your limit. Ask for ₹64 a piece plus tax.');
  });

  it('blames delivery when delivery is the problem', () => {
    expect(say({ piecesOrdered: 2, deliveryForOrder: 5000 })).toContain('Delivery alone breaks this deal');
  });

  it('blames your own costs when no price could work', () => {
    expect(say({}, { shippingPerSale: 900 })).toContain('no vendor price works');
  });

  it('never suggests asking for ₹0', () => {
    // 113 / 1.13 x 0.5 - 50 is zero, give or take a float crumb.
    const line = say(
      { deliveryForOrder: 0 },
      { sellingPrice: 113, piecesPerProduct: 1, salesTaxRate: 0.13, feeRate: 0, shippingPerSale: 50, packingPerSale: 0 },
    );
    expect(line).toContain('no vendor price works');
    expect(line).not.toContain('₹0');
  });
});

describe('before a price is typed', () => {
  const blank = { ...offer, pricePerPiece: 0 };

  it('tells you both lines so you know them before the call', () => {
    expect(idleAdvice(judge(shop, blank), shop, blank, 'INR')).toBe(
      'Before the vendor names a price: great is ₹64 a piece or less. Over ₹86, you walk.',
    );
  });

  it('asks for your selling price first if that is what is missing', () => {
    const noPrice = { ...shop, sellingPrice: 0 };
    expect(idleAdvice(judge(noPrice, blank), noPrice, blank, 'INR')).toContain('Add your selling price');
  });

  it('stops the ledger before the vendor line and shows no profit', () => {
    const rows = ledgerRows(shop, judge(shop, blank), 'INR', false);
    const labels = rows.map(([label]) => label);
    expect(labels.at(-1)).toBe('Left for the vendor and your profit');
    expect(labels.join(' ')).not.toContain('Profit');
    expect(labels.join(' ')).not.toContain('Vendor:');
  });

  it('does not pretend the order makes money', () => {
    expect(orderLine(shop, judge(shop, blank), 'INR', false)).toBe("Type the vendor's price to see what this order makes.");
  });

  it('describes the dial as waiting', () => {
    expect(dialDescription(judge(shop, blank), false)).toBe('Deal meter. Waiting for the vendor price.');
  });
});

describe('the paperwork', () => {
  const result = judge(shop, offer);

  it('walks one sale from what the customer pays down to the profit', () => {
    const rows = ledgerRows(shop, result, 'INR', true);
    expect(rows.map(([label]) => label)).toEqual([
      'Customer pays',
      'Sales tax you pass on',
      'Payment and store fees',
      'Shipping',
      'Packing',
      'Vendor: 6 pieces at ₹74.50 landed',
      'Profit',
    ]);
    const total = rows.slice(0, -1).reduce((sum, [, amount]) => sum + amount, 0);
    expect(total).toBeCloseTo(result.profitPerSale, 9);
  });

  it('skips the sales tax line for a shop that charges none', () => {
    const noTax = { ...shop, salesTaxRate: 0 };
    const labels = ledgerRows(noTax, judge(noTax, offer), 'INR', true).map(([label]) => label);
    expect(labels).not.toContain('Sales tax you pass on');
  });

  it('sums up the order', () => {
    expect(orderLine(shop, result, 'INR', true)).toBe('This order makes 20 products. If they all sell, you keep ₹18,654.');
  });

  it('mentions leftovers', () => {
    const odd = { ...offer, piecesOrdered: 100 };
    expect(orderLine(shop, judge(shop, odd), 'INR', true)).toContain('16 products, with 4 pieces left over');
  });

  it('says so when the order cannot fill one product', () => {
    const tiny = { ...offer, piecesOrdered: 4 };
    expect(orderLine(shop, judge(shop, tiny), 'INR', true)).toBe(
      'This order is too small to make one product. You need at least 6 pieces.',
    );
  });

  it('says "you lose" when the order loses money', () => {
    const steep = { ...offer, pricePerPiece: 400 };
    expect(orderLine(shop, judge(shop, steep), 'INR', true)).toContain('you lose');
  });
});

describe('the number under the needle', () => {
  it('reads the true share of your limit', () => {
    expect(limitRead(judge(shop, offer))).toBe('84% of your limit');
    expect(limitRead(judge(shop, { ...offer, pricePerPiece: 125 }))).toBe('144% of your limit');
  });

  it('gives up counting politely', () => {
    expect(limitRead(judge(shop, { ...offer, pricePerPiece: 5000 }))).toBe('over 999% of your limit');
  });

  it('says nothing when there is no limit to compare against', () => {
    expect(limitRead(judge({ ...shop, shippingPerSale: 900 }, offer))).toBe('');
  });

  it('puts it into words for screen readers', () => {
    expect(dialDescription(judge(shop, offer), true)).toBe(
      "Deal meter: Bargain harder. The vendor's price puts your cost at 84% of your limit.",
    );
  });
});

describe('sayings', () => {
  it('gives the same saying for the same deal', () => {
    expect(sayingFor('bargain', offer)).toEqual(sayingFor('bargain', offer));
  });

  it('always returns a saying, whatever the numbers', () => {
    for (const price of [0, 1, 59.99, 60, 1e9]) {
      const [line] = sayingFor('walk', { ...offer, pricePerPiece: price });
      expect(line.length).toBeGreaterThan(0);
    }
  });

  it('has three for every verdict', () => {
    for (const list of Object.values(SAYINGS)) expect(list).toHaveLength(3);
  });
});

describe('the WhatsApp summary', () => {
  const text = summary(EXAMPLE.name, shop, offer, judge(shop, offer), 'INR', 'https://example.com/#quote=72');

  it('leads with the verdict', () => {
    expect(text.split('\n')[0]).toBe(`Mol-Bhav Meter: ${VERDICT_TITLE.bargain.toUpperCase()}`);
  });

  it('carries the numbers a partner needs to say yes or no', () => {
    expect(text).toContain('Brass diya set of 6, selling at ₹1,999');
    expect(text).toContain('Vendor: ₹72 a piece plus 18% tax, delivery ₹300, 120 pieces');
    expect(text).toContain('Cost per product: ₹447 (great under ₹399.51, walk away over ₹532.68)');
    expect(text).toContain('Profit per sale: ₹932.71 (55%)');
    expect(text).toContain('If all 20 sell: ₹18,654');
    expect(text).toContain('Ask for: ₹64 a piece');
  });

  it('ends with the link when there is one', () => {
    expect(text.split('\n').at(-1)).toBe('https://example.com/#quote=72');
  });

  it('skips the "ask for" line on a great deal', () => {
    const cheap = { ...offer, pricePerPiece: 45 };
    expect(summary('', shop, cheap, judge(shop, cheap), 'INR')).not.toContain('Ask for');
  });
});

describe('the example banner', () => {
  it('names the example and its price', () => {
    expect(exampleNote(EXAMPLE)).toBe('Example numbers: Brass diya set of 6, selling at ₹1,999. Change any of them.');
  });
});
