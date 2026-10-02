# Dopealkshi

Dopealkshi is the product title and the name of this repository.

A person signs up, connects their own Kalshi production key, and runs a named agent. An agent is a market, a style preset, and three dials. The algorithm is fixed. There is no model in the loop.

The running app is Next.js on Railway with Railway Postgres. Login is email and password. The first account on an empty database is admin, unless `ADMIN_EMAILS` lists the admin addresses. Supabase is not used in this deploy.

## Production reads, paper orders

Market data, balance, and positions come from Kalshi production:

`https://external-api.kalshi.com/trade-api/v2`

Paper mode does not post orders there. The worker writes an intent, then calls an in-process simulator that returns the same kinds of bad responses the live API does: a dropped call whose order shows up late, a 500 that left nothing, a 409 on retry, and a timestamp that lags while an order is still hidden. Run does not send a bet.

## Docs

| Doc | What it locks |
|---|---|
| [docs/PRODUCT.md](docs/PRODUCT.md) | What a customer does, free tier, publish |
| [docs/PRESETS.md](docs/PRESETS.md) | Window, Swing, and Decay, and what the dials write |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Processes, shared tape, data model |
| [docs/ORDER-LIFECYCLE.md](docs/ORDER-LIFECYCLE.md) | Intent row, bad responses, reconciler |
| [docs/SETTINGS.md](docs/SETTINGS.md) | Production key card, the checklist that gates Run |
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

v1 slice: signup, production key checklist, one Window agent, and a worker that simulates order calls (including failures) against the live tape. Hourly Decay, Stripe, live betting, and admin intelligence are not in this deploy.
