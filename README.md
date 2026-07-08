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
