# NightModeScheduler

An offline log of your evening screen time with a simple bedtime estimate. NightModeScheduler keeps your logs in the browser's `localStorage`, encrypted at rest, and never uploads them.

The estimate is one fixed rule, shown on the page under the figure: 22:00 plus 20 minutes for each hour of screen time after 18:00. It is not a measurement, and the app makes no claim about sleep, health or the body.

**Live:** [nightmode.stormberry.as](https://nightmode.stormberry.as)

## Features
- **Offline Tracking**: Log your evening screen time in privacy-first browser storage.
- **Colour shift**: the background moves from blue towards amber as the screen time on the slider goes up.
- **Bedtime estimate**: 22:00 plus 20 minutes for each hour of screen time after 18:00, wrapped past midnight and shown in your own clock format.
- **Responsive Layout**: Optimized for mobile and desktop with a premium deep-dark aesthetic.

## Architecture
- **Vanilla HTML and CSS, TypeScript**, no frameworks.
- **TypeScript source in `ts/`, compiled JavaScript committed.** `ts/app.ts` compiles to `app.js`, at the same path the page has always loaded, as a classic script (no modules). The compiled file is committed because GitHub Pages serves the repository as it is, with no build step of its own; `.gitattributes` marks it as generated. Edit the TypeScript, never the `.js`.
- **First-run notice generated.** `gate.js` and `gate.css` are written by `build-gates.py`, shared by every Stormberry Labs app, and are not edited here; `.gitattributes` marks `gate.js` as generated.
- **Build:** `npm run build` (`tools/build-ts.sh`) installs the pinned compiler (`npm ci`), compiles, then runs `bump_assets.py` to restamp the `?v=` cache stamps. `npm run check` changes nothing and fails when the committed JavaScript is not what the TypeScript compiles to. `npm test` runs the tests in `tests/` with the test runner built into Node 24. The published app has no runtime dependencies.
- **Privacy First**, no cookies, no tracking. Zero external API calls. All logs remain strictly on your device.
- Stormberry dark-mode glassmorphism design system, Inter typography.
- **Sovereign AI**, built and maintained using high-speed agentic workflows.

## Stack
- Browser `localStorage` for secure, persistent tracking.
- Browser `Intl` formatting, so times follow your locale (22:40 or 10:40 PM).
- [Inter](https://rsms.me/inter/) typeface, locally hosted.

## Local development
```bash
git clone https://github.com/StormberryAS/NightModeScheduler.git
cd NightModeScheduler
python3 -m http.server 3005
```
Open `http://localhost:3005` in your browser.

## Credits
Built by [Stormberry AS](https://stormberry.as). Proudly powered by sovereign AI agents.

## Disclaimer

Supplied free of charge, **as is**, with no warranty of any kind. Using it creates no client or advisory relationship with Stormberry AS, and nothing it produces is professional advice.

**Not medical advice.** This is a self-logging tool, not a clinical instrument. It does not diagnose, treat or monitor any condition, and nothing it displays should inform a decision about sleep, health or medication. Speak to a doctor about sleep problems.

This is a **functioning prototype**, not a certified instrument and not a professional service. Values are computed or modelled, not measured. Check anything that matters against an authoritative source before you act on it. Stormberry AS reimburses no cost or loss arising from use of this application.

Full terms: [DISCLAIMER.md](DISCLAIMER.md).
