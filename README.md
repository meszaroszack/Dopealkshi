# Agent app

Product name is unset. This repository is [Dopealkshi](https://github.com/meszaroszack/Dopealkshi). The customer-facing name will be a config constant, not this repo name.

This is the home of a B2C Kalshi app. A person signs up, connects their own Kalshi key, and runs a named agent. An agent is a market, a style preset, and three dials. The algorithm is fixed. There is no model in the loop.

The app is not built yet. These docs are the source of truth for the first build.

## Demo and live

Paper mode places real orders on Kalshi's demo exchange with a demo key.

`https://external-api.demo.kalshi.co/trade-api/v2`

Live mode places real orders on production with a separate production key. Demo keys and production keys are not interchangeable. There is no local fill simulator.

## Docs

| Doc | What it locks |
|---|---|
| [docs/PRODUCT.md](docs/PRODUCT.md) | What a customer does, free tier, publish |
| [docs/PRESETS.md](docs/PRESETS.md) | Window, Swing, and Decay, and what the dials write |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Processes, shared tape, data model |
| [docs/ORDER-LIFECYCLE.md](docs/ORDER-LIFECYCLE.md) | Intent row, bad responses, reconciler |
| [docs/SETTINGS.md](docs/SETTINGS.md) | Demo and Live cards, the checklist that gates Run |
| [docs/ADMIN.md](docs/ADMIN.md) | Halt, comp, intelligence, one-click clone |
| [AGENTS.md](AGENTS.md) | Rules for the next coding session |

## v1 markets

- 15-minute `KXBTC15M`, styles Swing and Window. Free tier lives here.
- Hourly `KXBTCD`, style Decay. Pro.
- Sports is a later plugin. It is not in v1.

## Status

Documentation only. No web app, no database, no worker, no Stripe project.
