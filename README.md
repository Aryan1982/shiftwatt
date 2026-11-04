# ShiftWatt

**Same electricity. Cleaner hours.** ShiftWatt reads the grid's carbon forecast and runs things that can wait (EV charging, dishwasher, laundry, water heater) at the cleanest time before your deadline. It then logs the CO₂ you avoided.

Built for Green Shift Hacks 2026.

## Run

```sh
npm run dev        # live-reload server at http://localhost:4417
```

There are no dependencies to install. You can also open `index.html` directly.

## Screens

| Route | Purpose |
|---|---|
| `#/today` | Grid intensity now, 24h strip, 48h forecast with scheduled runs and surplus windows, what's on the grid now vs. cleanest, what's coming up, weekly results |
| `#/plan` | Pick a device and a deadline; optimize for lowest CO₂ or lowest cost; compare start-now vs. best; flexibility tip; schedule |
| `#/devices` | Device list with connection, kWh per run, and saved to date. "Run now" warns with the CO₂ cost of not waiting. Click a device for its drawer: default deadline, quiet hours (a real optimizer constraint), 30-day history, recent runs, remove |
| `#/impact` | 7/30/60-day totals, yearly pace, 1,000-home scale, the other carbon measure, biggest wins, per-run log, CSV export |
| `#/campus` | Next clean hour, washer booking, hall leaderboard with participation, campus scale calculator |
| `#/live` | Real-time GB data straight from the NESO API: national intensity (measured vs. forecast), the cleanest vs. dirtiest region right now, today's forecast vs. actual with its average error, plus a collapsible panel with the request URLs and raw JSON. Refresh button; auto-refreshes every 5 min |
| `#/settings` | Home name, grid region, electricity plan, notification preferences, carbon measure (average vs. marginal), integrations, export, reset |
| `#/method` | How it works: algorithm, data, limits |

There is also a notifications inbox (bell): start/finish events land there. Demo-only controls (clock, skip ahead, reset) live in the amber **Demo** bar, separate from the product UI.

## 60-second demo

1. **Today**: the grid is dirty right now (California, 6:30 PM). "Wait if you can. It gets 85% cleaner tomorrow at 11:30."
2. **Plan → EV charger**: tap **Use** on the tip (ready by 1 PM saves 4.4× more), then **Schedule**.
3. **Skip to next run** (Demo bar): the clock jumps forward, the charger starts on 85% clean power, and the bell gets a new notification.
4. **Impact**: 102 kg avoided in 60 days.
5. **Campus**: book a washer in the next clean hour.

## Data

- **Great Britain is live.** It uses the free, keyless [NESO Carbon Intensity API](https://carbonintensity.org.uk/): a 48-hour regional forecast (North West England) with the generation mix every 30 minutes. If the request fails, the app falls back to modeled data and labels it "Modeled".
- **California and Texas are modeled** in `data.js` from a generation mix (share × emission factor), so intensity, price and surplus stay consistent with each other. Their free forecast sources need accounts.
- The curtailment figure comes from the [U.S. EIA](https://www.eia.gov/todayinenergy/detail.php?id=65364). Driving equivalencies use the EPA factor of 0.393 kg CO₂ per mile.

State (schedules, devices, settings, notifications) persists in `localStorage`. **Reset** in the Demo bar or in Settings clears it.

## Limitations

- Device control is simulated. The Integrations screen lists the APIs a production build would use.
- The 60-day household history and the campus figures are illustrative sample data.
- Times display in the viewer's local time zone, including for the live GB forecast.
- Shifting lowers carbon per kWh, not kWh used. At scale, starts would be staggered to avoid creating new peaks.

## Files

- `index.html`, `styles.css`, `app.js`: the app (no build step)
- `data.js`: grid models, live NESO fetch, devices, sample history
- `slides/`: the intro deck (`slides/index.html` to present; PDF, PPTX and PNG exports)
- `screenshots/`: gallery images and thumbnail

MIT licensed. See `LICENSE`.
