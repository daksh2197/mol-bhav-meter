import { describe, expect, it } from 'vitest';
import { decodeDeal, encodeDeal, EXAMPLE, type Deal } from './deal';

describe('sharing a deal as text', () => {
  it('survives a round trip', () => {
    expect(decodeDeal(encodeDeal(EXAMPLE))).toEqual(EXAMPLE);
  });

  it('keeps awkward rates exact', () => {
    const deal: Deal = {
      ...EXAMPLE,
      currency: 'CAD',
      shop: { ...EXAMPLE.shop, feeRate: 0.0472, salesTaxRate: 0.09975, reclaimVendorTax: true },
      offer: { ...EXAMPLE.offer, pricePerPiece: 4.35, taxIncluded: true, vendorTaxRate: 0.05 },
    };
    expect(decodeDeal(encodeDeal(deal))).toEqual(deal);
  });

  it('writes rates the way a person would read them', () => {
    const text = encodeDeal(EXAMPLE);
    expect(text).toContain('tax=18');
    expect(text).toContain('fees=4.72');
    expect(text).toContain('quote=60');
  });

  it('survives names with symbols in them', () => {
    const deal = { ...EXAMPLE, name: 'Chess & Ludo set (engraved) #2 = ₹4,499?' };
    expect(decodeDeal(encodeDeal(deal))?.name).toBe(deal.name);
  });

  it('returns null when there is no deal in the text', () => {
    expect(decodeDeal('')).toBeNull();
    expect(decodeDeal('embed=1')).toBeNull();
  });

  it('falls back to the example for anything missing or garbled', () => {
    const deal = decodeDeal('quote=75&price=abc&qty=-4&cur=XXX&tax=');
    expect(deal).not.toBeNull();
    expect(deal?.offer.pricePerPiece).toBe(75);
    expect(deal?.shop.sellingPrice).toBe(EXAMPLE.shop.sellingPrice);
    expect(deal?.offer.piecesOrdered).toBe(EXAMPLE.offer.piecesOrdered);
    expect(deal?.currency).toBe('INR');
    expect(deal?.shop.salesTaxRate).toBe(EXAMPLE.shop.salesTaxRate);
  });

  it('refuses a target above 100%', () => {
    expect(decodeDeal('quote=1&target=250')?.shop.targetMargin).toBe(1);
  });

  it('cuts a silly-long name down to size', () => {
    expect(decodeDeal(`quote=1&name=${'x'.repeat(500)}`)?.name.length).toBe(80);
  });
});
