# The math

Everything the meter does comes down to two lines and one comparison. The code is in [`src/core/meter.ts`](../src/core/meter.ts), and it reads in the same order as this page.

## 1. Your side: the two lines

Before the vendor says anything, your own numbers already decide the most you can pay.

```
sales after tax = your price ÷ (1 + sales tax rate)
walk-away cost  = sales after tax × (1 − profit target) − fees − shipping − packing
great-deal cost = walk-away cost × 0.75
```

- **Walk-away cost** is the most one product can cost you while still leaving the profit you asked for. One rupee over and you've missed your own target.
- **Great-deal cost** is three quarters of that. It's a rule of thumb, not a law. Change `GREAT_FRACTION` in `meter.ts` if your business runs tighter or looser; the page picks the new figure up, the docs you'd update by hand.
- **Profit target** is a share of sales *after* tax, because the tax was never yours.
- **Fees** are a share of the full selling price, because that's what payment gateways charge on.

### Worked example

A brass diya set of 6, sold at ₹1,999. Sales tax 18%, fees 4.72%, shipping ₹100, packing ₹120, profit target 50%.

| Step | ₹ |
| --- | ---: |
| Customer pays | 1,999.00 |
| ÷ 1.18 | 1,694.07 |
| × (1 − 0.50) | 847.03 |
| − fees (1,999 × 4.72%) | − 94.35 |
| − shipping | − 100.00 |
| − packing | − 120.00 |
| **Walk-away cost for the set** | **532.68** |
| × 0.75 = **great-deal cost** | **399.51** |

That's ₹88.78 a diya to walk away, ₹66.59 a diya for great.

## 2. The vendor's side: the landed cost

A vendor's price is never the whole price. Two things get added.

```
landed cost per piece = quoted price × tax multiplier + delivery ÷ pieces ordered
cost per product      = landed cost per piece × pieces in one product
```

### The tax multiplier

Whether the tax on the vendor's bill is a real cost depends on two things: how the price was quoted, and whether you can claim the tax back.

| The vendor says | You can't claim tax back | You're tax-registered and can |
| --- | --- | --- |
| "₹60 plus 18% tax" | you pay 60 × 1.18 = **70.80** | the tax comes back, you pay **60.00** |
| "₹60 all in" | you pay **60.00** | the tax comes back, you pay 60 ÷ 1.18 = **50.85** |

So the vendor's tax rate changes the answer in two of the four boxes: "plus tax" when you can't claim it back, and "all in" when you can. In the other two it makes no difference, and the meter dims the rate box to say so.

### Delivery

₹300 delivery on 120 pieces is ₹2.50 a piece. On 12 pieces it's ₹25 a piece. A small order can turn a good price into a bad deal, and the meter says so when delivery is the thing breaking it.

### The example, continued

The shop is tax-registered. The vendor says "₹72 plus 18% tax, ₹300 delivery, 120 pieces".

```
landed per piece = 72 × 1 + 300 ÷ 120 = 72.00 + 2.50 = 74.50
cost per set     = 74.50 × 6          = 447.00
```

The same quote to a shop that can't claim the tax back:

```
landed per piece = 72 × 1.18 + 2.50 = 84.96 + 2.50 = 87.46
cost per set     = 87.46 × 6        = 524.76
```

Same vendor, same words, and one shop has room to spare while the other is ₹8 from its limit. That is why "I'm tax-registered" is a checkbox and not an assumption.

## 3. The comparison

| Cost per product | Verdict |
| --- | --- |
| at or under the great-deal cost | **Great deal** |
| over that, but at or under the walk-away cost | **Bargain harder** |
| over the walk-away cost | **Walk away** |

For the registered shop, ₹447.00 is over ₹399.51 and under ₹532.68, so: **bargain harder**. The cost is 84% of the limit, which is the small number under the needle.

```
profit per sale = 1,694.07 − 94.35 − 100 − 120 − 447.00 = 932.72
margin          = 932.72 ÷ 1,694.07                     = 55%
```

(The app shows ₹932.71. It keeps every decimal until the last moment, and the true figure is 932.71499…; rounding each step by hand, as above, drifts by a paisa.)

## 4. Working backwards: what to ask for

The meter also runs the landed-cost formula in reverse, to turn each line back into a price the vendor can say yes to, **in the vendor's own terms**.

```
quote for a cost level = (cost level ÷ pieces in one product − delivery share) ÷ tax multiplier
```

```
great:     (399.51 ÷ 6 − 2.50) ÷ 1 = 64.08   ->  "Ask for ₹64"
walk away: (532.68 ÷ 6 − 2.50) ÷ 1 = 86.28   ->  "Don't go over ₹86"
```

Counter-offers are always rounded **down**. A lower ask can only help you.

## 5. The whole order

```
products from the order = floor(pieces ordered ÷ pieces in one product)
leftover pieces         = pieces ordered − products × pieces in one product
order profit            = products × (sales after tax − fees − shipping − packing)
                          − pieces ordered × landed cost per piece
```

Leftovers are pieces you paid for and can't sell as a full product, so they come out of the order's profit. Order 100 diyas for sets of 6 and you make 16 sets with 4 diyas left on the shelf.

## 6. When nothing works

If your own fees, shipping and packing already eat everything the profit target leaves, the walk-away cost is zero. No vendor price can fix that, so the meter says so and points at your numbers instead of the vendor's: lower the target, or raise your price.

Anything under half the smallest coin counts as zero here. Computers leave crumbs like 0.000000000000007 when they divide, and a limit that small is not a limit.

## What the meter does not know

It's a calculator, not an accountant.

- It doesn't know your tax rules. You type the rates. Check them for your product and your country.
- It assumes every product from the order sells at full price. Returns, discounts and unsold stock are on you.
- It treats delivery as one flat charge with no tax of its own.
- "Great" is 75% of your limit because that's a useful rule of thumb. It isn't a market price check; the meter has no idea what other vendors charge.
