# Mol-Bhav Meter

**A vendor says a price. You get a straight answer: great deal, bargain, or walk away.**

[**Try it live**](https://daksh2197.github.io/mol-bhav-meter/) on any phone. Free, no sign-up, works with no signal.

[![Test and ship](https://github.com/daksh2197/mol-bhav-meter/actions/workflows/ship.yml/badge.svg)](https://github.com/daksh2197/mol-bhav-meter/actions/workflows/ship.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-FF5A1F.svg)](LICENSE)

<p align="center">
  <img src="docs/screenshots/demo.gif" width="340" alt="The meter's needle swinging between great deal, walk away and bargain harder as the vendor's price changes">
</p>

Mol-bhav (मोल-भाव) is Hindi for haggling. In Delhi, where I'm from, it's a sport. The problem is that nobody does the math while they're playing.

## Why I built it

It started as a one-page tool for my dad. He's on the phone with a vendor. The vendor says "72 a piece, GST extra, 300 for delivery." Dad has about four seconds to say yes, push back, or hang up.

The right answer depends on six other numbers: what the product sells for, how many pieces go into one set, sales tax, payment fees, shipping and the box. Nobody carries that in their head on a call.

So I put all of it behind one number you type and one dial you read. The dial is a rev counter, because I'm a car guy and a redline is the clearest "stop" ever designed.

- **Needle in the green:** book it.
- **Needle in the grey:** you have room. The meter gives you the exact price to ask for.
- **Needle past the redline:** say thank you and hang up.

![Three verdicts: great deal at ₹45, bargain harder at ₹72, walk away at ₹125](docs/screenshots/three-verdicts.png)

## What it does

- **One number in, one answer out.** Type the quote, read the verdict. No "Calculate" button.
- **Tells you what to say next.** "Ask for ₹64 a piece plus tax. Don't go over ₹86." In the vendor's own terms, so you never convert in your head.
- **Counts what vendors leave out.** Tax you can't claim back, delivery spread across the order, and the leftover pieces that don't fill a set.
- **Shares the whole deal in a link.** Your partner opens it and sees the same numbers. There's a WhatsApp summary too.
- **Works with no signal.** Open it once and it's saved on your phone. Add it to your home screen and it stays there. Markets and warehouses have terrible reception.
- **Keeps your numbers yours.** No server, no account, no ads, no tracking. A share link carries the numbers inside the link itself, in the part browsers never send to a website.
- **Six currencies.** Rupees, Canadian and US dollars, pounds, euros and dirhams.

![The meter on a laptop: the dial stays pinned on the left while the form scrolls on the right](docs/screenshots/desktop.png)

## The math in 30 seconds

```
walk-away cost = your price ÷ (1 + sales tax) × (1 − profit target) − fees − shipping − packing
great deal     = 75% of the walk-away cost, or less
```

A brass diya set of 6, sold at ₹1,999, with a 50% profit target:

| Step | ₹ |
| --- | ---: |
| Customer pays | 1,999.00 |
| ÷ 1.18, sales after tax | 1,694.07 |
| × 50%, what's left after your profit | 847.03 |
| − fees at 4.72% | − 94.35 |
| − shipping | − 100.00 |
| − packing | − 120.00 |
| **Walk-away cost for the set** | **532.68** |
| **Great deal for the set** | **399.51** |

The vendor says ₹72 plus tax, ₹300 delivery on 120 pieces. This shop is GST-registered, so the tax on the vendor's bill comes back and doesn't count. That's ₹74.50 a piece landed and ₹447 for the set. Over the great line, under the walk-away line. Verdict: **bargain harder**. Ask for ₹64, and don't go over ₹86.

The long version, with all four tax cases, is in [docs/THE-MATH.md](docs/THE-MATH.md).

## Run it yourself

You need [Node.js](https://nodejs.org) 22.12 or newer.

```bash
git clone https://github.com/daksh2197/mol-bhav-meter.git
cd mol-bhav-meter
npm install
npm run dev     # the app, live-reloading, at http://localhost:5173
npm test        # every test, in about a second
npm run build   # the finished site, in dist/
```

## How it's built

| Piece | Job | Why this one |
| --- | --- | --- |
| TypeScript | The language | It catches "you passed a word where a number goes" before the app runs |
| Vite | Builds the site | One command, about 150 ms |
| Vitest | Runs the tests | Checks on the math, the wording and the links |
| No framework | The screen | One screen doesn't need React. The app's JavaScript is about 7 kB once compressed |
| Service worker | Offline | Saves the app on the phone the first time it opens |
| GitHub Actions | Test, then deploy | Every push to main and every pull request runs the tests. If one fails, nothing ships |
| GitHub Pages | Hosting | Free |

The map:

```
src/
  core/            the brain: no screen, no browser, just numbers and words
    meter.ts       the deal math. Start here.
    deal.ts        turns a deal into a link and back
    words.ts       every sentence the meter writes
    format.ts      money on screen
    *.test.ts      the tests, next to the code they check
  ui/dial.ts       draws the rev counter
  main.ts          wires the form to the brain and the brain to the screen
  styles/brand.css the dakshdua.ca colours, in one file
public/sw.js       the offline worker
scripts/stamp-sw.mjs  stamps each build with a version
.github/workflows/ship.yml  test, then deploy
```

Want the guided tour? [docs/CTO-NOTES.md](docs/CTO-NOTES.md) explains every idea in here in plain English, how to debug it, and five small changes to try. The money side is in [docs/BUSINESS.md](docs/BUSINESS.md).

## What got caught along the way

- **Vendor tax.** The one-page version I made for my dad counted the tax on the vendor's bill as a cost for everybody. That's right for a shop that isn't tax-registered yet and wrong the day the registration comes through: the same quote can go from "bargain" to "great deal". It's one checkbox now, with tests on both sides.
- **A link that lied by a hair.** A 9.975% tax rate went into a share link and came back as 9.975000000000001%. Computers count in binary and sometimes it shows. A test caught it before a person did.
- **Three things an outside review found that the tests had missed.** Before this went public it got a cold read from a second Claude session that hadn't seen it being built. It found that share links put the numbers where a web server could see them (they now ride after the `#`, which browsers keep to themselves). It found that on a wide screen the pinned dial slid over the math section. And it found a shop whose limit should have been exactly zero and came out as 0.000000000000007, so the meter said "come down to ₹0". All three are fixed, and the fixes are in the commit history.

## How this was built

I build with Claude as my pair programmer. I bring the problem and decide what the thing should do. Claude writes most of the code. I review it until I can explain every file, and [the CTO notes](docs/CTO-NOTES.md) are my study guide, in public. Every commit carries the co-author line.

## What's next

- [ ] Hindi interface
- [ ] Save vendors and compare their quotes side by side
- [ ] Import mode: customs duty and currency conversion
- [ ] A light theme for bright sun

Ideas and pull requests are welcome. If you sell something and the meter gets your numbers wrong, [open an issue](https://github.com/daksh2197/mol-bhav-meter/issues) with the deal link. That's the fastest way to get it fixed.

## License

[MIT](LICENSE). Use it, fork it, put it inside your own shop's tools.

Built in Calgary by [Daksh Dua](https://dakshdua.ca).
