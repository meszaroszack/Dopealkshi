# Dopealkshi

Dopealkshi is the product title and the name of this repository.

A person signs up, connects their own Kalshi demo key, and runs a named agent. An agent is a market, a style preset, and three dials. The algorithm is fixed. There is no model in the loop.

The running app is Next.js on Railway with Railway Postgres. Login is email and password. The first account on an empty database is admin, unless `ADMIN_EMAILS` lists the admin addresses. Supabase is not used in this deploy.

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

## Run locally

```bash
npm install
cp .env.example .env.local
# set DATABASE_URL and CREDENTIALS_KEY
npm run dev
```

The dev server listens on port 43123. `GET /api/health` reports whether the database migrated.

## Status

v1 slice: signup, demo key checklist, one Window agent, and a worker that sends demo orders and reconciles them. Hourly Decay, Stripe, and admin intelligence are not in this deploy.
