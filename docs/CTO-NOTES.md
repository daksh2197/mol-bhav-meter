# CTO notes

You don't have to write this code. You have to be able to do three things with it:

1. **Explain it** to an interviewer, a partner or a customer.
2. **Find a bug** in it when a number looks wrong.
3. **Know what to ask for** when you want it changed.

This page gets you there. Read sections 1 and 2 once (about 15 minutes). Keep section 4 for the day something breaks. Do section 5 with your own hands, because that is where it sticks.

## 1. The whole app in one picture

```
   you type          the brain           the screen
 ┌───────────┐     ┌────────────┐     ┌──────────────┐
 │  the form │ ──> │  judge()   │ ──> │ dial, verdict│
 │(15 inputs)│     │  meter.ts  │     │ ledger, link │
 └───────────┘     └────────────┘     └──────────────┘
      ^  main.ts reads it        main.ts paints it  │
      └──────────── every keystroke, start to end ──┘
```

That's it. There is no server and no database. The page is a handful of files that GitHub hands to the phone, and then the phone does all the work.

- **The brain** (`src/core/`) only knows numbers. It has never heard of a button.
- **The screen** (`index.html`, `src/ui/`, `src/styles/`) only knows how to look. It can't do math.
- **The wiring** (`src/main.ts`) carries numbers from one to the other.

Keeping those three apart is the most important design decision in the repo. It's why a wrong number can only come from one of two places, and why the brain can be tested without opening a browser.

## 2. Six ideas this repo teaches

Each one has a plain meaning, where to see it, and a sentence you can say out loud.

### Pure functions

A pure function gets numbers in and gives numbers out, and does nothing else. Same input, same answer, every time. No clock, no network, no screen.

- **See it:** `judge()` in [`src/core/meter.ts`](../src/core/meter.ts).
- **Say it:** "All the business logic is one pure function, so I can test every edge case in milliseconds and the UI can't corrupt the math."

### Unit tests, and one property test

A unit test is a tiny program that runs your code with known inputs and checks the answer. There are dozens here. Most check one hand-picked example. One is different: it invents 500 random deals and checks a rule that must hold for all of them ("if the vendor quotes exactly what we told you to ask for, the cost lands exactly on the line"). That's a property test.

- **See it:** [`src/core/meter.test.ts`](../src/core/meter.test.ts). Read the test names top to bottom; they're written as plain sentences, so the file doubles as a spec.
- **Run it:** `npm test`.
- **Say it:** "Example tests prove the cases I thought of. The property test covers the ones I didn't."

### Types

TypeScript is JavaScript where every value has a declared shape. `Shop` and `Offer` at the top of `meter.ts` are the shapes. If someone passes a word where a number goes, or forgets a field, the build fails before the app ever runs.

- **See it:** the `interface` blocks in `meter.ts`. The comments on each field are the documentation.
- **Run it:** `npm run typecheck`.
- **Say it:** "The types are the contract between the UI and the logic. Break the contract and it won't build."

### State in a link

The whole deal (all 15 inputs, from your selling price to the vendor's tax rate) is packed into a link: `#price=1999&quote=72&...`. That one trick is both the "remember my numbers" feature and the "share with my partner" feature, with no server and no accounts. It sits after the `#` on purpose: browsers never send that part of an address to the website, so the numbers go from one person to the other and nowhere else.

- **See it:** `encodeDeal()` and `decodeDeal()` in [`src/core/deal.ts`](../src/core/deal.ts).
- **Try it:** press **Copy link**, paste it in a private window.
- **Say it:** "State lives in the URL fragment, so sharing needs no backend and the numbers never reach a server."

### Offline with a service worker

A service worker is a small script the browser keeps on the phone for one site. Ours saves a copy of the app the first time it opens. After that the meter opens with no signal.

- **See it:** [`public/sw.js`](../public/sw.js) (short, and commented line by line) and [`scripts/stamp-sw.mjs`](../scripts/stamp-sw.mjs), which stamps each build with a version made from the files' contents.
- **Try it:** open the live site, switch to airplane mode, reload.
- **Say it:** "It's a PWA that works offline. The app is saved on the first visit, and each build's cache is named by a hash of its contents, so a new build replaces the old one cleanly."

### CI/CD

CI means a robot runs the tests on every push to main and every pull request. CD means that if they pass on main, the robot also deploys. The whole pipeline is one file.

- **See it:** [`.github/workflows/ship.yml`](../.github/workflows/ship.yml), and the **Actions** tab on GitHub for the live runs.
- **Say it:** "Main is always deployable. A failing test blocks the release automatically; nobody has to remember to check."

## 3. Where things live

| You want to change... | Open this |
| --- | --- |
| How a verdict is decided | `src/core/meter.ts` |
| What "great" means (the 75% rule) | `GREAT_FRACTION` at the top of `meter.ts` |
| Anything the meter says: verdicts, sayings, coaching, the WhatsApp text | `src/core/words.ts` |
| A fixed label on the form | `index.html` |
| How money is shown, or add a currency | `src/core/format.ts` |
| The opening example | `EXAMPLE` in `src/core/deal.ts` (some tests expect its numbers, so they'll tell you what else to update) |
| A colour or a font | `src/styles/brand.css` |
| Layout and spacing | `src/styles/app.css` |
| The boxes on the page | `index.html` |
| How the dial is drawn | `src/ui/dial.ts` |
| What happens on deploy | `.github/workflows/ship.yml` |

## 4. When something breaks

| What you see | Likely cause | Where to look | How to check |
| --- | --- | --- | --- |
| A number looks wrong | The math, or the form feeding it the wrong box | `meter.ts`, then `readForm()` in `main.ts` | Open **Where the money goes** on the page and add it up by hand. Then write the deal as a test in `meter.test.ts`. If the test passes, the math is fine and the bug is in the wiring. |
| The page shows, but typing does nothing | A JavaScript error on start-up | Browser console (right-click, Inspect, Console) | The error names the file and line. A missing `id` in `index.html` gives a message that says exactly which one. |
| The site still shows the old version a few minutes after a deploy | GitHub Pages tells browsers they may reuse files for 10 minutes | Nothing to fix | Wait ten minutes, or hard-refresh. If it's still old, check the Actions tab: the deploy may not have run. |
| Green check, but there is no website | The repo is private, so the deploy steps are skipped on purpose | `.github/workflows/ship.yml` | Make the repo public, set Pages to **GitHub Actions**, then run the workflow once from the Actions tab. |
| Red X at "Ask GitHub where this site will live" | The repo is public but Pages isn't switched on | Repo **Settings**, **Pages**, **Source** | Set it to **GitHub Actions**, then press **Re-run jobs** on the failed run. |
| Red X on a later commit | A test or the build failed in CI | GitHub, **Actions** tab, click the red run | The log shows the failing test by name. Nothing was deployed, so the live site is still the last good version. |
| A shared link opens the wrong numbers | The link was cut off when pasted | `decodeDeal()` in `deal.ts` | It needs `quote=` after the `#`. Without it the page opens your last numbers, or the example on a first visit. Any other missing piece falls back to the example's value on purpose. |
| Works on my laptop, not on a phone | Old browser | `tsconfig.json` and `vite.config.ts` target ES2022 | Any phone updated since 2022 is fine. |

**The one debugging habit that matters:** reproduce it as a test first. A bug you can trigger with a test is a bug you can fix once and keep fixed.

## 5. Your turn

Five real changes, easiest first. Each one is a commit with your name on it. You can do all of them in the browser: open the repo on GitHub and press the `.` key. That opens an editor. Change the file, then use the Source Control panel on the left to commit. The robot tests and deploys it; watch the Actions tab.

1. **Add a saying.** In `src/core/words.ts`, add a line to one of the `SAYINGS` lists, in your own words. *Done when:* it shows up on the live site for some price.
2. **Add a currency.** In `src/core/format.ts`, add Australian dollars: `AUD: { locale: 'en-AU', label: 'Australian dollar ($)' }`. *Done when:* it's in the Currency menu and the tests still pass.
3. **Change the rule.** Set `GREAT_FRACTION` in `meter.ts` to `0.8` and push. *Done when:* CI goes red. Read the log, see which tests caught you, then decide: change it back, or update the tests (and the 75% in the docs) to the new rule. That red X is the safety net doing its job.
4. **Write a test.** Take a real quote from a real vendor call and add it to `meter.test.ts` as a new `it(...)`, with the verdict you expect. *Done when:* it passes, or it fails and you've found a bug.
5. **Add a field.** Add "customs duty %" for imported goods. It touches every layer: the `Offer` type and the math in `judge()` (`meter.ts`); `EXAMPLE`, `encodeDeal()` and `decodeDeal()` (`deal.ts`); the `Offer` objects in the tests; a box in `index.html`; and `fillForm()` and `readForm()` in `main.ts`. The build will refuse to pass until every one of them is done, which is the type checker being your checklist. *Done when:* a 30% duty flips the opening example from "Bargain harder" to "Walk away" and a new test proves it. This is the one to talk through with Claude; ask it to explain each change before you accept it.

## 6. Questions you should be ready for

**Why no React?**
One screen, fifteen inputs, one output. React alone is several times the size of this app's JavaScript. The structure a framework gives you (logic separate from view) is here anyway, done by hand.

**How do you know the math is right?**
Three ways. A worked example checked by hand to the paisa. Edge cases for every tax combination and for garbage input. And a property test across 500 random deals.

**What happens with no signal?**
The service worker saved every file on the first visit. The page itself is fetched fresh when there's a connection, so updates arrive, and falls back to the saved copy when there isn't.

**Where is the data stored?**
On the device only, in the browser's local storage, as the same text that goes into a share link. There is no server to send it to. A share link carries the numbers after the `#`, which browsers don't transmit.

**What would you build next?**
Saving vendors and comparing quotes side by side, because the second call is where bargaining power comes from. That needs a small local database (IndexedDB), still with no server.

**What did the AI do, and what did you do?**
Say it straight: Claude wrote most of the code as a pair programmer. You chose the problem, made the product decisions, reviewed the changes and can walk through any file. Then walk through one.

## 7. Words you'll hear

| Word | Plain meaning |
| --- | --- |
| Repo | The project folder, with its full history |
| Commit | One saved change, with a message saying why |
| Push | Send your commits to GitHub |
| Branch | A parallel copy to try something without touching the live version. `main` is the live one. |
| Pull request (PR) | "Here's my branch, please review and merge it" |
| CI / CD | Robot runs the tests / robot deploys if they pass |
| Build | Turn the source files into the small, fast files a browser downloads |
| Dependency | Someone else's code this project uses. Listed in `package.json`. |
| PWA | A website that can be installed and work offline like an app |
| Cache | A saved copy, kept so the next load is instant |
| Landed cost | What a piece really costs once tax and delivery are in |
