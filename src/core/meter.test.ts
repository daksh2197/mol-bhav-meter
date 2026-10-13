import { describe, expect, it } from 'vitest';
import { DIAL_MAX, GREAT_FRACTION, judge, taxMultiplier, type Offer, type Shop } from './meter';

/**
 * The worked example these tests lean on: a brass diya set of 6, sold at ₹1,999.
 *
 *   ₹1,999 / 1.18           = ₹1,694.07 after sales tax
 *   x 50% profit target     =   ₹847.03 left for everything else
 *   - fees (4.72% of 1,999) =    ₹94.35
 *   - shipping              =   ₹100
 *   - packing               =   ₹120
 *   walk-away cost          =   ₹532.68 for the set (₹88.78 a diya)
 *   great deal (75%)        =   ₹399.51 for the set (₹66.59 a diya)
 */
const diyaSet: Shop = {
  sellingPrice: 1999,
  piecesPerProduct: 6,
  salesTaxRate: 0.18,
  feeRate: 0.0472,
  shippingPerSale: 100,
  packingPerSale: 120,
  targetMargin: 0.5,
  reclaimVendorTax: false,
};

const sixtyPlusTax: Offer = {
  pricePerPiece: 60,
  taxIncluded: false,
  vendorTaxRate: 0.18,
  deliveryForOrder: 300,
  piecesOrdered: 120,
};

describe('the worked example', () => {
  const r = judge(diyaSet, sixtyPlusTax);

  it('finds the walk-away and great-deal cost for the set', () => {
    expect(r.netSale).toBeCloseTo(1694.07, 2);
    expect(r.fees).toBeCloseTo(94.35, 2);
    expect(r.walkAwayCost).toBeCloseTo(532.68, 2);
    expect(r.greatCost).toBeCloseTo(399.51, 2);
  });

  it('adds tax and a share of delivery to every piece', () => {
    // 60 x 1.18 = 70.80, plus 300 / 120 = 2.50
    expect(r.landedPerPiece).toBeCloseTo(73.3, 2);
    expect(r.costPerProduct).toBeCloseTo(439.8, 2);
  });

  it('calls it a bargain: over the great line, under the walk-away line', () => {
    expect(r.verdict).toBe('bargain');
    expect(r.profitPerSale).toBeCloseTo(939.915, 2);
    expect(r.margin).toBeCloseTo(0.5548, 4);
  });

  it('tells you what to ask for, in the vendor\'s own "plus tax" terms', () => {
    expect(r.greatQuote).toBeCloseTo(54.31, 2);
    expect(r.walkAwayQuote).toBeCloseTo(73.12, 2);
  });

  it('counts the whole order', () => {
    expect(r.productsFromOrder).toBe(20);
    expect(r.leftoverPieces).toBe(0);
    expect(r.orderProfit).toBeCloseTo(20 * r.profitPerSale, 6);
  });
});

describe('verdict lines', () => {
  it('great: a low quote lands under 75% of the walk-away cost', () => {
    expect(judge(diyaSet, { ...sixtyPlusTax, pricePerPiece: 45 }).verdict).toBe('great');
  });

  it('walk: a high quote blows past the walk-away cost', () => {
    const r = judge(diyaSet, { ...sixtyPlusTax, pricePerPiece: 125 });
    expect(r.verdict).toBe('walk');
    expect(r.profitPerSale).toBeLessThan(r.netSale * diyaSet.targetMargin);
  });

  it('sitting exactly on a line counts as making it', () => {
    const first = judge(diyaSet, sixtyPlusTax);
    expect(judge(diyaSet, { ...sixtyPlusTax, pricePerPiece: first.greatQuote }).verdict).toBe('great');
    expect(judge(diyaSet, { ...sixtyPlusTax, pricePerPiece: first.walkAwayQuote }).verdict).toBe('bargain');
  });

  it('one paisa over the walk-away line is a walk', () => {
    const first = judge(diyaSet, sixtyPlusTax);
    expect(judge(diyaSet, { ...sixtyPlusTax, pricePerPiece: first.walkAwayQuote + 0.01 }).verdict).toBe('walk');
  });
});

describe('tax on the vendor bill', () => {
  it('covers all four cases', () => {
    expect(taxMultiplier({ taxIncluded: false, vendorTaxRate: 0.18 }, false)).toBeCloseTo(1.18);
    expect(taxMultiplier({ taxIncluded: false, vendorTaxRate: 0.18 }, true)).toBe(1);
    expect(taxMultiplier({ taxIncluded: true, vendorTaxRate: 0.18 }, false)).toBe(1);
    expect(taxMultiplier({ taxIncluded: true, vendorTaxRate: 0.18 }, true)).toBeCloseTo(1 / 1.18);
  });

  it('"60 plus 18%" and "70.80 all in" are the same deal', () => {
    const plus = judge(diyaSet, sixtyPlusTax);
    const allIn = judge(diyaSet, { ...sixtyPlusTax, pricePerPiece: 70.8, taxIncluded: true });
    expect(allIn.costPerProduct).toBeCloseTo(plus.costPerProduct, 6);
    expect(allIn.verdict).toBe(plus.verdict);
  });

  it('a registered seller gets the vendor tax back, so the same quote looks better', () => {
    const registered = judge({ ...diyaSet, reclaimVendorTax: true }, sixtyPlusTax);
    // 60 + 2.50 delivery share = 62.50 a piece, 375 for the set
    expect(registered.costPerProduct).toBeCloseTo(375, 6);
    expect(registered.verdict).toBe('great');
  });
});

describe('the whole order', () => {
  it('charges you for pieces that do not fill a product', () => {
    const r = judge(diyaSet, { ...sixtyPlusTax, piecesOrdered: 100 });
    expect(r.productsFromOrder).toBe(16);
    expect(r.leftoverPieces).toBe(4);
    expect(r.orderProfit).toBeCloseTo(16 * r.profitPerSale - 4 * r.landedPerPiece, 6);
  });

  it('spreads delivery thinner on a bigger order', () => {
    const small = judge(diyaSet, { ...sixtyPlusTax, piecesOrdered: 12 });
    const big = judge(diyaSet, { ...sixtyPlusTax, piecesOrdered: 1200 });
    expect(small.landedPerPiece).toBeCloseTo(60 * 1.18 + 25, 6);
    expect(big.landedPerPiece).toBeCloseTo(60 * 1.18 + 0.25, 6);
  });
});

describe('the dial', () => {
  it('reads 1.0 exactly on the walk-away line', () => {
    const first = judge(diyaSet, sixtyPlusTax);
    expect(judge(diyaSet, { ...sixtyPlusTax, pricePerPiece: first.walkAwayQuote }).load).toBeCloseTo(1, 9);
  });

  it(`stops at ${DIAL_MAX} no matter how bad the quote is`, () => {
    expect(judge(diyaSet, { ...sixtyPlusTax, pricePerPiece: 99999 }).load).toBe(DIAL_MAX);
  });
});

describe('bad input does not crash it', () => {
  it('says "impossible" when your own costs eat the whole target', () => {
    const r = judge({ ...diyaSet, shippingPerSale: 900 }, sixtyPlusTax);
    expect(r.impossible).toBe(true);
    expect(r.walkAwayCost).toBe(0);
    expect(r.verdict).toBe('walk');
    expect(r.load).toBe(DIAL_MAX);
  });

  it('treats blanks, negatives and nonsense as zero', () => {
    const r = judge(
      { ...diyaSet, feeRate: NaN, shippingPerSale: -50, piecesPerProduct: 0 },
      { ...sixtyPlusTax, pricePerPiece: NaN, deliveryForOrder: -1, piecesOrdered: 0 },
    );
    for (const value of Object.values(r)) {
      if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
    }
    expect(r.costPerProduct).toBe(0);
  });

  it('survives a zero selling price', () => {
    const r = judge({ ...diyaSet, sellingPrice: 0 }, sixtyPlusTax);
    expect(r.margin).toBe(0);
    expect(r.impossible).toBe(true);
  });
});

/**
 * A property test. Instead of checking one hand-picked example, throw 500
 * random deals at the code and check a rule that must hold for every one:
 * "if the vendor quotes exactly what we told you to ask for, the cost lands
 * exactly on the line". The seed is fixed, so a failure is repeatable.
 */
describe('property: the counter-offer always lands on its line', () => {
  let seed = 31400;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const between = (low: number, high: number): number => low + random() * (high - low);

  it('holds for 500 random deals', () => {
    for (let i = 0; i < 500; i++) {
      const shop: Shop = {
        sellingPrice: between(100, 20000),
        piecesPerProduct: Math.ceil(between(0, 12)),
        salesTaxRate: between(0, 0.28),
        feeRate: between(0, 0.08),
        shippingPerSale: between(0, 50),
        packingPerSale: between(0, 20),
        targetMargin: between(0.1, 0.6),
        reclaimVendorTax: random() > 0.5,
      };
      const offer: Offer = {
        pricePerPiece: between(1, 500),
        taxIncluded: random() > 0.5,
        vendorTaxRate: between(0, 0.28),
        deliveryForOrder: between(0, 100),
        piecesOrdered: Math.ceil(between(50, 2000)),
      };
      const first = judge(shop, offer);
      if (first.impossible || first.greatQuote <= 0) continue;

      const atGreat = judge(shop, { ...offer, pricePerPiece: first.greatQuote });
      const atWalk = judge(shop, { ...offer, pricePerPiece: first.walkAwayQuote });

      expect(atGreat.costPerProduct).toBeCloseTo(first.greatCost, 6);
      expect(atGreat.load).toBeCloseTo(GREAT_FRACTION, 6);
      expect(atWalk.costPerProduct).toBeCloseTo(first.walkAwayCost, 6);
      expect(atWalk.margin).toBeCloseTo(shop.targetMargin, 6);
    }
  });
});
