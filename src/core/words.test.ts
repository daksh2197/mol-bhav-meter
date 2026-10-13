import { describe, expect, it } from 'vitest';
import { EXAMPLE } from './deal';
import { money, percent, symbol } from './format';
import { judge } from './meter';
import { advice, askable, sayingFor, summary, VERDICT_TITLE } from './words';

const { shop, offer } = EXAMPLE;

describe('money on screen', () => {
  it('groups rupees the Indian way and drops pointless decimals', () => {
    expect(money(1999, 'INR')).toBe('₹1,999');
    expect(money(123456, 'INR')).toBe('₹1,23,456');
    expect(money(54.309, 'INR')).toBe('₹54.31');
    expect(money(439.8, 'INR')).toBe('₹439.80');
    expect(money(18798.3, 'INR')).toBe('₹18,798');
  });

  it('gives dollars two decimals when there are cents', () => {
    expect(money(12.5, 'CAD')).toBe('$12.50');
    expect(money(12, 'CAD')).toBe('$12');
  });

  it('uses a real minus sign for losses', () => {
    expect(money(-50, 'INR')).toBe('−₹50');
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
});

describe('the coaching line', () => {
  it('bargain: names the price to ask for and the price to stop at', () => {
    const line = advice(judge(shop, offer), offer, 'INR');
    expect(line).toBe("Ask for ₹54 a piece plus tax. Don't go over ₹73.");
  });

  it('great: tells you how much room is left', () => {
    const cheap = { ...offer, pricePerPiece: 45 };
    expect(advice(judge(shop, cheap), cheap, 'INR')).toBe(
      'Anything up to ₹54 a piece plus tax is a great deal. He is at ₹45.',
    );
  });

  it('walk: names the number he has to hit', () => {
    const steep = { ...offer, pricePerPiece: 125 };
    expect(advice(judge(shop, steep), steep, 'INR')).toBe('He has to come down to ₹73 a piece plus tax, or you walk.');
  });

  it('says "tax included" when that is how he quoted it', () => {
    const allIn = { ...offer, pricePerPiece: 90, taxIncluded: true };
    expect(advice(judge(shop, allIn), allIn, 'INR')).toContain('a piece, tax included');
  });

  it('blames delivery when delivery is the problem', () => {
    const tiny = { ...offer, piecesOrdered: 2, deliveryForOrder: 5000 };
    expect(advice(judge(shop, tiny), tiny, 'INR')).toContain('Delivery alone breaks this deal');
  });

  it('blames your own costs when no price could work', () => {
    const heavy = { ...shop, shippingPerSale: 900 };
    expect(advice(judge(heavy, offer), offer, 'INR')).toContain('no vendor price works');
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
});

describe('the WhatsApp summary', () => {
  const text = summary(EXAMPLE.name, shop, offer, judge(shop, offer), 'INR', 'https://example.com/?quote=60');

  it('leads with the verdict', () => {
    expect(text.split('\n')[0]).toBe(`Mol-Bhav Meter: ${VERDICT_TITLE.bargain.toUpperCase()}`);
  });

  it('carries the numbers a partner needs to say yes or no', () => {
    expect(text).toContain('Brass diya set of 6, selling at ₹1,999');
    expect(text).toContain('Vendor: ₹60 a piece plus 18% tax, delivery ₹300, 120 pieces');
    expect(text).toContain('Profit per sale: ₹939.91 (55%)');
    expect(text).toContain('If all 20 sell: ₹18,798');
    expect(text).toContain('Ask for: ₹54 a piece');
  });

  it('ends with the link when there is one', () => {
    expect(text.split('\n').at(-1)).toBe('https://example.com/?quote=60');
  });

  it('skips the "ask for" line on a great deal', () => {
    const cheap = { ...offer, pricePerPiece: 45 };
    expect(summary('', shop, cheap, judge(shop, cheap), 'INR')).not.toContain('Ask for');
  });
});
