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
- **Vanilla HTML/CSS/JS**, no frameworks, no build step.
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
