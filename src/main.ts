/**
 * The wiring. This file reads the form, hands the numbers to the brain
 * (core/meter.ts), asks core/words.ts what to say, and paints the answer.
 * It does no math and writes no sentences of its own.
 *
 *   form  ->  readForm()  ->  judge()  ->  render()  ->  screen
 *
 * Every keystroke runs that whole line again. It takes about a millisecond,
 * so there is no "Calculate" button.
 */

import './styles/fonts.css';
import './styles/brand.css';
import './styles/app.css';

import { decodeDeal, encodeDeal, EXAMPLE, type Deal } from './core/deal';
import { CURRENCIES, isCurrency, money, percent, symbol } from './core/format';
import { GREAT_FRACTION, judge } from './core/meter';
import {
  advice,
  dialDescription,
  exampleNote,
  IDLE_TITLE,
  idleAdvice,
  ledgerRows,
  limitRead,
  linesFor,
  NO_SUMMARY_YET,
  orderLine,
  sayingFor,
  summary,
  TOAST,
  VERDICT_TITLE,
} from './core/words';
import { mountDial } from './ui/dial';

const STORAGE_KEY = 'mol-bhav-meter:v1';

// ---------- small helpers ----------

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`index.html is missing an element with id="${id}"`);
  return found as T;
}

const input = (id: string): HTMLInputElement => el<HTMLInputElement>(id);

/** What is typed in a number box, as a number. Blank, negative or nonsense counts as 0. */
function numberIn(id: string): number {
  const value = parseFloat(input(id).value);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Show a number in a box without float crumbs like 4.720000000000001. */
const tidy = (n: number): string => String(Math.round(n * 1e4) / 1e4);

/**
 * Change text only when it is different. Screen readers announce every change
 * inside a live region, so rewriting the same words would make them repeat themselves.
 */
function setText(target: HTMLElement, text: string): void {
  if (target.textContent !== text) target.textContent = text;
}

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

/**
 * The deal goes after the "#". Browsers keep that part to themselves: it is never
 * sent to the server, so a shared link tells GitHub nothing about anyone's prices.
 */
function shareLink(deal: Deal): string {
  return `${location.origin}${location.pathname}#${encodeDeal(deal)}`;
}

function render(deal: Deal): void {
  const { shop, offer, currency } = deal;
  const result = judge(shop, offer);
  const cash = (n: number): string => money(n, currency);
  const ready = offer.pricePerPiece > 0 && shop.sellingPrice > 0;
  const state = ready ? result.verdict : 'idle';
  const lines = linesFor(result);

  // The instrument.
  cluster.dataset.verdict = state;
  setText(verdictWord, ready ? VERDICT_TITLE[result.verdict] : IDLE_TITLE);
  if (ready && shownVerdict && shownVerdict !== state) {
    verdictWord.classList.remove('pop');
    void verdictWord.offsetWidth; // restart the animation
    verdictWord.classList.add('pop');
  }
  shownVerdict = state;

  const [saying, meaning] = sayingFor(result.verdict, offer);
  setText(el('saying'), saying);
  setText(el('saying-meaning'), meaning);
  setText(el('advice'), ready ? advice(result, offer, currency) : idleAdvice(result, shop, offer, currency));

  dial.set({
    load: result.load,
    verdict: state,
    greatPrice: lines && lines.great > 0 ? cash(lines.great) : '',
    walkPrice: lines ? cash(lines.walk) : '',
    read: ready ? limitRead(result) : '',
    description: dialDescription(result, ready),
  });

  // Green means "you hit your target", not just "above zero". Orange means you lose money.
  const tone = !ready ? '' : result.profitPerSale < 0 ? 'down' : result.margin >= shop.targetMargin ? 'up' : '';
  const stats: Array<[id: string, text: string, tone: string]> = [
    ['stat-profit', ready ? cash(result.profitPerSale) : '–', tone],
    ['stat-margin', ready ? percent(result.margin) : '–', tone],
    ['stat-cost', ready ? cash(result.costPerProduct) : '–', ''],
  ];
  for (const [id, text, className] of stats) {
    setText(el(id), text);
    el(id).className = className;
  }

  // The vendor's tax rate only changes the answer in two cases: "plus tax" when the tax
  // doesn't come back to you, and "tax included" when it does. Otherwise dim the box.
  const rateMatters = offer.taxIncluded === shop.reclaimVendorTax;
  el('vtax').closest('.rate')?.toggleAttribute('data-quiet', !rateMatters);

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-incl]')) {
    button.setAttribute('aria-pressed', String((button.dataset.incl === '1') === offer.taxIncluded));
  }
  for (const slot of document.querySelectorAll<HTMLElement>('[data-symbol]')) {
    setText(slot, symbol(currency));
  }

  // The paperwork.
  const rows = ledgerRows(shop, result, currency, ready);
  el('ledger').replaceChildren(
    ...rows.map(([label, amount], index) => {
      const row = document.createElement('tr');
      const isTotal = index === rows.length - 1;
      if (isTotal) row.className = 'total';
      const name = document.createElement('td');
      name.textContent = label;
      const value = document.createElement('td');
      value.textContent = cash(amount);
      if (isTotal && ready) value.className = amount >= 0 ? 'up' : 'down';
      row.append(name, value);
      return row;
    }),
  );
  setText(el('order-line'), orderLine(shop, result, currency, ready));

  // Sharing only makes sense once there is a deal to share.
  const link = shareLink(deal);
  setText(el('summary'), ready ? summary(deal.name, shop, offer, result, currency) : NO_SUMMARY_YET);
  const whatsapp = el<HTMLAnchorElement>('whatsapp');
  const sendable = ready ? summary(deal.name, shop, offer, result, currency, link) : '';
  if (ready) {
    whatsapp.href = `https://wa.me/?text=${encodeURIComponent(sendable)}`;
    whatsapp.removeAttribute('aria-disabled');
    whatsapp.removeAttribute('tabindex');
  } else {
    whatsapp.removeAttribute('href');
    whatsapp.setAttribute('aria-disabled', 'true');
    whatsapp.setAttribute('tabindex', '-1');
  }
  const copySummary = el<HTMLButtonElement>('copy-summary');
  const copyLink = el<HTMLButtonElement>('copy-link');
  copySummary.disabled = !ready;
  copyLink.disabled = !ready;
  copySummary.dataset.text = sendable;
  copyLink.dataset.text = link;
}

// ---------- copy buttons ----------

async function copy(text: string, done: string): Promise<void> {
  const fallback = el<HTMLTextAreaElement>('copy-fallback');
  fallback.hidden = true;
  try {
    await navigator.clipboard.writeText(text);
    setText(el('toast'), done);
  } catch {
    // Older phones and locked-down embeds refuse to copy. Show exactly what was asked for,
    // selected, so a long-press can do it by hand.
    fallback.value = text;
    fallback.hidden = false;
    fallback.focus();
    fallback.select();
    setText(el('toast'), TOAST.copyBlocked);
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
  setText(el('great-share'), percent(GREAT_FRACTION));

  const note = el('example-note');
  const showExample = (showing: boolean): void => {
    setText(note, exampleNote(EXAMPLE));
    note.hidden = !showing;
  };

  /** A shared link has the deal after the "#". Take it, then tidy the address bar. */
  const takeDealFromLink = (): Deal | null => {
    const shared = decodeDeal(location.hash.slice(1));
    if (shared) {
      remember(shared);
      history.replaceState(null, '', location.pathname + location.search);
    }
    return shared;
  };

  // Where do the opening numbers come from? A shared link wins, then your last visit, then the example.
  const opening = takeDealFromLink() ?? recall() ?? EXAMPLE;
  fillForm(opening);
  showExample(opening === EXAMPLE);

  const onEdit = (): void => {
    const deal = readForm();
    showExample(false);
    setText(el('toast'), '');
    el('copy-fallback').hidden = true;
    remember(deal);
    render(deal);
  };

  // "input" fires for every kind of control here: typing, the checkbox and the currency menu.
  // The copy box is ours, not part of the deal, so edits there are ignored.
  document.addEventListener('input', (event) => {
    if ((event.target as HTMLElement).id !== 'copy-fallback') onEdit();
  });

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-incl]')) {
    button.addEventListener('click', () => {
      taxIncluded = button.dataset.incl === '1';
      onEdit();
    });
  }

  el('copy-summary').addEventListener('click', (event) => {
    void copy((event.currentTarget as HTMLElement).dataset.text ?? '', TOAST.summaryCopied);
  });
  el('copy-link').addEventListener('click', (event) => {
    void copy((event.currentTarget as HTMLElement).dataset.text ?? '', TOAST.linkCopied);
  });
  el('reset').addEventListener('click', () => {
    forget();
    fillForm(EXAMPLE);
    showExample(true);
    setText(el('toast'), '');
    el('copy-fallback').hidden = true;
    render(EXAMPLE);
    input('quote').focus();
  });

  // Someone pastes a shared link into a tab that already has the meter open.
  window.addEventListener('hashchange', () => {
    const shared = takeDealFromLink();
    if (!shared) return;
    fillForm(shared);
    showExample(false);
    render(readForm());
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
