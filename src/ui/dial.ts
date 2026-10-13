/**
 * The dial. It is drawn like a rev counter because that is what it is:
 * the needle climbs as the vendor's price climbs, and past the redline you walk.
 *
 * The scale is "cost as a share of your walk-away cost":
 *   0    -> needle hard left
 *   0.75 -> straight up: the great-deal line
 *   1.0  -> the redline starts: the walk-away line
 *   1.5  -> needle hard right, and it stops there
 */

import { DIAL_MAX, GREAT_FRACTION, type Verdict } from '../core/meter';

const CX = 160;
const CY = 170;
const R = 128;
/** The needle swings this many degrees either side of straight up. */
const SWEEP = 110;
/** Small breathing space between the coloured bands, in degrees. */
const GAP = 1.2;

/** Turn a load (0 to DIAL_MAX) into a needle angle in degrees. 0 is straight up. */
export function angleFor(load: number): number {
  const safe = Number.isFinite(load) ? Math.min(Math.max(load, 0), DIAL_MAX) : 0;
  return -SWEEP + (2 * SWEEP * safe) / DIAL_MAX;
}

function point(angle: number, radius: number): [number, number] {
  const radians = (angle * Math.PI) / 180;
  return [CX + radius * Math.sin(radians), CY - radius * Math.cos(radians)];
}

function arc(from: number, to: number, radius: number): string {
  const [x0, y0] = point(from, radius);
  const [x1, y1] = point(to, radius);
  const largeArc = to - from > 180 ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${radius} ${radius} 0 ${largeArc} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

function spoke(angle: number, inner: number, outer: number, className: string): string {
  const [x0, y0] = point(angle, inner);
  const [x1, y1] = point(angle, outer);
  return `<line class="${className}" x1="${x0.toFixed(2)}" y1="${y0.toFixed(2)}" x2="${x1.toFixed(2)}" y2="${y1.toFixed(2)}"/>`;
}

function draw(): string {
  const greatAngle = angleFor(GREAT_FRACTION);
  const walkAngle = angleFor(1);

  const ticks: string[] = [];
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const load = (DIAL_MAX * i) / steps;
    const major = i % 2 === 0;
    const classes = ['tick', major ? 'tick-major' : '', load > 1 ? 'tick-red' : ''].filter(Boolean).join(' ');
    ticks.push(spoke(angleFor(load), R - 10 - (major ? 12 : 6), R - 10, classes));
  }

  const [greatX, greatY] = point(greatAngle, R + 15);
  const [walkX, walkY] = point(walkAngle, R + 15);
  const [bargainX, bargainY] = point((greatAngle + walkAngle) / 2, R - 42);

  return `
<svg viewBox="0 0 320 222" role="img" aria-labelledby="dial-title">
  <title id="dial-title">Deal meter</title>
  <defs>
    <pattern id="redline-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
      <rect class="hatch-bar" width="3.5" height="7"/>
    </pattern>
  </defs>

  <path class="band band-great" d="${arc(-SWEEP, greatAngle - GAP, R)}"/>
  <path class="band band-bargain" d="${arc(greatAngle + GAP, walkAngle - GAP, R)}"/>
  <path class="band band-walk" stroke="url(#redline-hatch)" d="${arc(walkAngle + GAP, SWEEP, R)}"/>
  <path class="band-walk-edge" d="${arc(walkAngle + GAP, SWEEP, R + 5)}"/>

  ${ticks.join('\n  ')}
  ${spoke(greatAngle, R - 8, R + 9, 'line-mark')}
  ${spoke(walkAngle, R - 8, R + 9, 'line-mark')}

  <text class="line-price" data-part="great-price" x="${greatX.toFixed(1)}" y="${greatY.toFixed(1)}" text-anchor="middle"></text>
  <text class="line-price" data-part="walk-price" x="${(walkX + 2).toFixed(1)}" y="${(walkY + 4).toFixed(1)}" text-anchor="start"></text>

  <g class="needle">
    <path class="needle-blade" d="M159.2 52 L160.8 52 L163 170 L162 192 L158 192 L157 170 Z"/>
  </g>
  <!-- Drawn after the needle on purpose: the needle passes behind these words. -->
  <text class="zone zone-great" x="66" y="152" style="text-anchor:start">great</text>
  <text class="zone zone-bargain" x="${bargainX.toFixed(1)}" y="${bargainY.toFixed(1)}">bargain</text>
  <text class="zone zone-walk" x="254" y="152" style="text-anchor:end">walk away</text>

  <circle class="hub" cx="${CX}" cy="${CY}" r="11"/>
  <circle class="hub-pin" cx="${CX}" cy="${CY}" r="3"/>

  <text class="gauge-read" data-part="read" x="${CX}" y="212"></text>
</svg>`;
}

export interface DialState {
  /** Cost as a share of the walk-away cost. */
  load: number;
  verdict: Verdict | 'idle';
  /** The vendor price that sits on the great-deal line, already formatted. Empty to hide it. */
  greatPrice: string;
  /** The vendor price that sits on the walk-away line, already formatted. Empty to hide it. */
  walkPrice: string;
  /** The small line under the hub, e.g. "83% of your limit". Empty to hide it. */
  read: string;
  /** One sentence for screen readers. */
  description: string;
}

export interface Dial {
  set(state: DialState): void;
}

export function mountDial(host: HTMLElement): Dial {
  host.innerHTML = draw();
  const part = (name: string): SVGTextElement => host.querySelector<SVGTextElement>(`[data-part="${name}"]`)!;
  const title = host.querySelector('title')!;
  const greatPrice = part('great-price');
  const walkPrice = part('walk-price');
  const read = part('read');

  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let firstMove = true;
  let sweepTimer: number | undefined;

  const pointNeedle = (load: number): void => {
    host.style.setProperty('--needle', `${angleFor(load).toFixed(2)}deg`);
  };

  return {
    set(state) {
      title.textContent = state.description;
      greatPrice.textContent = state.greatPrice;
      walkPrice.textContent = state.walkPrice;
      read.textContent = state.read;

      window.clearTimeout(sweepTimer);
      if (firstMove && !calm && state.verdict !== 'idle') {
        // The ignition sweep: needle swings to the stop and settles, like a car waking up.
        // It happens once, on load. After that the needle only moves when you change a number.
        pointNeedle(DIAL_MAX);
        sweepTimer = window.setTimeout(() => pointNeedle(state.load), 620);
      } else {
        pointNeedle(state.verdict === 'idle' ? 0 : state.load);
      }
      firstMove = false;
    },
  };
}
