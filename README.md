# NightModeScheduler

Personal light-exposure tracker designed to promote a healthy circadian rhythm. NightModeScheduler securely logs your evening screen time entirely offline using the browser's `localStorage` and mathematically estimates your optimal bedtime based on blue-light interference.

**Live:** [nightmode.stormberry.as](https://nightmode.stormberry.as)

## Features
- **Offline Tracking**: Securely log and track your evening screen exposure using privacy-first browser storage.
- **Blue-Light Meter**: Dynamic CSS background gradients that shift in color temperature based on your logged exposure levels.
- **Bedtime Calculator**: Automatically pushes back your optimal bedtime recommendation if excessive late-night screen time is detected.
- **Responsive Layout**: Optimized for mobile and desktop with a premium deep-dark aesthetic.

## Architecture
- **Vanilla HTML/CSS/JS**, no frameworks, no build step.
- **Privacy First**, no cookies, no tracking. Zero external API calls. All logs remain strictly on your device.
- Stormberry dark-mode glassmorphism design system, Inter typography.
- **Sovereign AI**, built and maintained using high-speed agentic workflows.

## Stack
- Browser `localStorage` for secure, persistent tracking.
- Browser `Date` for real-time circadian calculations.
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
