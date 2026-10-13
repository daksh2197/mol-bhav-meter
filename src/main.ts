/**
 * The wiring. This file reads the form, hands the numbers to the brain
 * (core/meter.ts), and paints the answer on screen. It makes no decisions itself.
 *
 *   form  ->  readForm()  ->  judge()  ->  render()  ->  screen
 *
 * Every keystroke runs that whole line again. It takes well under a millisecond,
 * so there is no "Calculate" button.
 */

import './styles/fonts.css';
import './styles/brand.css';
import './styles/app.css';

import { decodeDeal, encodeDeal, EXAMPLE, type Deal } from './core/deal';
import { CURRENCIES, isCurrency, money, percent, symbol } from './core/format';
import { judge, type Result } from './core/meter';
import { advice, askable, sayingFor, summary, VERDICT_TITLE } from './core/words';
import { mountDial } from './ui/dial';

const STORAGE_KEY = 'mol-bhav-meter:v1';

// ---------- small helpers ----------

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`index.html is missing an element with id="${id}"`);
  return found as T;
}

const input = (id: string): HTMLInputElement => el<HTMLInputElement>(id);

/** What is typed in a number box, as a number. Blank or nonsense counts as 0. */
function numberIn(id: string): number {
  const value = parseFloat(input(id).value);
  return Number.isFinite(value) ? value : 0;
}

/** Show a number in a box without float crumbs like 4.720000000000001. */
const tidy = (n: number): string => String(Math.round(n * 1e4) / 1e4);

// Storage can be switched off (private windows, embeds). The meter must work anyway.
function remember(deal: Deal): void {
  try {
    localStorage.setItem(STORAGE_KEY, encodeDeal(deal));
  } catch {
    /* fine: it just won't be remembered */
  }
}

function recall(): Deal | null {
  try {
    return decodeDeal(localStorage.getItem(STORAGE_KEY) ?? '');
  } catch {
    return null;
  }
}

function forget(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to forget */
  }
}

// ---------- the form ----------

let taxIncluded = false;

function fillForm(deal: Deal): void {
  const { shop, offer } = deal;
  input('quote').value = offer.pricePerPiece > 0 ? tidy(offer.pricePerPiece) : '';
  input('vtax').value = tidy(offer.vendorTaxRate * 100);
  input('delivery').value = tidy(offer.deliveryForOrder);
  input('qty').value = tidy(offer.piecesOrdered);
  input('name').value = deal.name;
  input('price').value = tidy(shop.sellingPrice);
  input('pieces').value = tidy(shop.piecesPerProduct);
  el<HTMLSelectElement>('currency').value = deal.currency;
  input('target').value = tidy(shop.targetMargin * 100);
  input('fees').value = tidy(shop.feeRate * 100);
  input('tax').value = tidy(shop.salesTaxRate * 100);
  input('ship').value = tidy(shop.shippingPerSale);
  input('pack').value = tidy(shop.packingPerSale);
  input('reclaim').checked = shop.reclaimVendorTax;
  taxIncluded = offer.taxIncluded;
}

function readForm(): Deal {
  const currency = el<HTMLSelectElement>('currency').value;
  return {
    name: input('name').value.trim(),
    currency: isCurrency(currency) ? currency : EXAMPLE.currency,
    shop: {
      sellingPrice: numberIn('price'),
      piecesPerProduct: Math.max(1, Math.floor(numberIn('pieces'))),
      salesTaxRate: numberIn('tax') / 100,
      feeRate: numberIn('fees') / 100,
      shippingPerSale: numberIn('ship'),
      packingPerSale: numberIn('pack'),
      targetMargin: Math.min(numberIn('target'), 100) / 100,
      reclaimVendorTax: input('reclaim').checked,
    },
    offer: {
      pricePerPiece: numberIn('quote'),
      taxIncluded,
      vendorTaxRate: numberIn('vtax') / 100,
      deliveryForOrder: numberIn('delivery'),
      piecesOrdered: Math.max(1, Math.floor(numberIn('qty'))),
    },
  };
}

// ---------- the screen ----------

const dial = mountDial(el('dial'));
const cluster = el('cluster');
const verdictWord = el('verdict');
let shownVerdict = '';

function shareLink(deal: Deal): string {
  return `${location.origin}${location.pathname}?${encodeDeal(deal)}`;
}

function ledgerRows(deal: Deal, result: Result): Array<[label: string, amount: number]> {
  const { shop } = deal;
  const pieces = shop.piecesPerProduct;
  const rows: Array<[string, number]> = [['Customer pays', shop.sellingPrice]];
  if (result.taxOnSale > 0) rows.push(['Sales tax you pass on', -result.taxOnSale]);
  rows.push(
    ['Payment and store fees', -result.fees],
    ['Shipping', -shop.shippingPerSale],
    ['Packing', -shop.packingPerSale],
    [
      `Vendor: ${pieces} ${pieces === 1 ? 'piece' : 'pieces'} at ${money(result.landedPerPiece, deal.currency)} landed`,
      -result.costPerProduct,
    ],
    ['Profit', result.profitPerSale],
  );
  return rows;
}

function orderLine(deal: Deal, result: Result): string {
  const cash = (n: number): string => money(n, deal.currency);
  const made = result.productsFromOrder;
  if (made === 0) {
    return `This order is too small to make one product. You need at least <b>${deal.shop.piecesPerProduct} pieces</b>.`;
  }
  const leftover =
    result.leftoverPieces > 0
      ? `, with ${result.leftoverPieces} ${result.leftoverPieces === 1 ? 'piece' : 'pieces'} left over`
      : '';
  const outcome = result.orderProfit >= 0 ? 'you keep' : 'you lose';
  return `This order makes <b>${made} ${made === 1 ? 'product' : 'products'}</b>${leftover}. If they all sell, ${outcome} <b>${cash(Math.abs(result.orderProfit))}</b>.`;
}

function render(deal: Deal): void {
  const { shop, offer, currency } = deal;
  const result = judge(shop, offer);
  const cash = (n: number): string => money(n, currency);
  const ready = offer.pricePerPiece > 0 && shop.sellingPrice > 0;
  const state = ready ? result.verdict : 'idle';
  const hasLines = !result.impossible && result.walkAwayQuote > 0;

  // The instrument.
  cluster.dataset.verdict = state;
  const title = ready ? VERDICT_TITLE[result.verdict] : 'Type his price';
  verdictWord.textContent = title;
  if (ready && shownVerdict && shownVerdict !== state) {
    verdictWord.classList.remove('pop');
    void verdictWord.offsetWidth; // restart the animation
    verdictWord.classList.add('pop');
  }
  shownVerdict = state;

  const [saying, meaning] = sayingFor(result.verdict, offer);
  el('saying').textContent = saying;
  el('saying-meaning').textContent = meaning;

  if (ready) {
    el('advice').textContent = advice(result, offer, currency);
  } else if (shop.sellingPrice <= 0) {
    el('advice').textContent = 'Add your selling price below, then type what the vendor quoted.';
  } else if (hasLines) {
    el('advice').textContent = `Before he says a number: great is ${cash(askable(result.greatQuote))} a piece or less. Over ${cash(askable(result.walkAwayQuote))}, you walk.`;
  } else {
    el('advice').textContent = advice(result, offer, currency);
  }

  // The needle stops at the end of the dial, but the number under it tells the whole truth.
  const share = result.impossible ? '' : `${Math.round((result.costPerProduct / result.walkAwayCost) * 100)}% of your limit`;
  dial.set({
    load: result.load,
    verdict: state,
    greatPrice: hasLines && result.greatQuote > 0 ? cash(askable(result.greatQuote)) : '',
    walkPrice: hasLines ? cash(askable(result.walkAwayQuote)) : '',
    read: ready ? share : '',
    description: ready
      ? `Deal meter: ${title}. ${share ? `His price puts your cost at ${share}.` : ''}`
      : 'Deal meter. Waiting for the vendor price.',
  });

  const profit = el('stat-profit');
  const marginStat = el('stat-margin');
  if (ready) {
    // Green means "you hit your target", not just "above zero". Orange means you lose money.
    const tone = result.profitPerSale < 0 ? 'down' : result.margin >= shop.targetMargin ? 'up' : '';
    profit.textContent = cash(result.profitPerSale);
    profit.className = tone;
    marginStat.textContent = percent(result.margin);
    marginStat.className = tone;
    el('stat-cost').textContent = cash(result.costPerProduct);
  } else {
    for (const stat of [profit, marginStat, el('stat-cost')]) {
      stat.textContent = '–';
      stat.className = '';
    }
  }

  // The vendor tax rate only matters when it changes what you pay.
  const rateMatters = !offer.taxIncluded || shop.reclaimVendorTax;
  el('vtax').closest('.rate')?.toggleAttribute('data-quiet', !rateMatters);

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-incl]')) {
    button.setAttribute('aria-pressed', String((button.dataset.incl === '1') === offer.taxIncluded));
  }
  for (const slot of document.querySelectorAll<HTMLElement>('[data-symbol]')) {
    slot.textContent = symbol(currency);
  }

  // The paperwork.
  const rows = ledgerRows(deal, result);
  el('ledger').replaceChildren(
    ...rows.map(([label, amount], index) => {
      const row = document.createElement('tr');
      const isTotal = index === rows.length - 1;
      if (isTotal) row.className = 'total';
      const name = document.createElement('td');
      name.textContent = label;
      const value = document.createElement('td');
      value.textContent = cash(amount);
      if (isTotal) value.className = amount >= 0 ? 'up' : 'down';
      row.append(name, value);
      return row;
    }),
  );
  el('order-line').innerHTML = orderLine(deal, result);

  const link = shareLink(deal);
  const text = summary(deal.name, shop, offer, result, currency, link);
  el('summary').textContent = summary(deal.name, shop, offer, result, currency);
  el<HTMLAnchorElement>('whatsapp').href = `https://wa.me/?text=${encodeURIComponent(text)}`;
  el('copy-summary').dataset.text = text;
  el('copy-link').dataset.text = link;
}

// ---------- copy buttons ----------

async function copy(text: string, done: string): Promise<void> {
  const toast = el('toast');
  try {
    await navigator.clipboard.writeText(text);
    toast.textContent = done;
  } catch {
    // Older phones and locked-down embeds: select the text so a long-press can copy it.
    const range = document.createRange();
    range.selectNodeContents(el('summary'));
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    toast.textContent = 'Could not copy on its own. The summary is selected: press and hold, then Copy.';
  }
}

// ---------- start-up ----------

function start(): void {
  const query = new URLSearchParams(location.search);
  if (query.has('embed')) document.documentElement.dataset.embed = '';

  const select = el<HTMLSelectElement>('currency');
  for (const [code, { label }] of Object.entries(CURRENCIES)) {
    select.add(new Option(label, code));
  }

  // Where do the opening numbers come from? A shared link wins, then your last visit, then the example.
  const fromLink = decodeDeal(location.search);
  const fromLastVisit = fromLink ? null : recall();
  const opening = fromLink ?? fromLastVisit ?? EXAMPLE;
  fillForm(opening);
  el('example-note').hidden = opening !== EXAMPLE;

  if (fromLink) {
    // Keep the address bar clean once the link has done its job.
    remember(fromLink);
    history.replaceState(null, '', location.pathname + (query.has('embed') ? '?embed=1' : ''));
  }

  const onEdit = (): void => {
    const deal = readForm();
    el('example-note').hidden = true;
    el('toast').textContent = '';
    remember(deal);
    render(deal);
  };

  document.addEventListener('input', onEdit);
  document.addEventListener('change', onEdit);

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-incl]')) {
    button.addEventListener('click', () => {
      taxIncluded = button.dataset.incl === '1';
      onEdit();
    });
  }

  el('copy-summary').addEventListener('click', (event) => {
    void copy((event.currentTarget as HTMLElement).dataset.text ?? '', 'Summary copied.');
  });
  el('copy-link').addEventListener('click', (event) => {
    void copy((event.currentTarget as HTMLElement).dataset.text ?? '', 'Link copied.');
  });
  el('reset').addEventListener('click', () => {
    forget();
    fillForm(EXAMPLE);
    el('example-note').hidden = false;
    el('toast').textContent = '';
    render(EXAMPLE);
    input('quote').focus();
  });

  render(readForm());

  // The service worker is what makes the meter open with no signal. Only in the real build.
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline support is a bonus, not a requirement */
    });
  }
}

start();
