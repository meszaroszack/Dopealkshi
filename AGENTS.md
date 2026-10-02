# Rules for the next coding session

Read [README.md](README.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before writing code. The product behavior is already decided in `docs/`. If a change disagrees with those docs, change the docs in the same PR.

## Do

- Build the order client against Kalshi V2 `POST /portfolio/events/orders`.
- Write the `client_order_id` to the database before the HTTP call.
- Send prices as fixed-point dollar strings (`"0.4400"`) and counts as fixed-point strings (`"3.00"`).
- Send side as `bid` or `ask` on the YES book. Translate YES/NO in the UI, not on the wire.
- Sign with the algorithm that matches the PEM. Kalshi's current default key is Ed25519. RSA-PSS SHA-256 still has to work.
- Sign the path without the query string, from the root (`/trade-api/v2/...`).
- Read public markets, balance, and positions from production `https://external-api.kalshi.com/trade-api/v2`.
- Paper order writes, order reads, and the user-data timestamp go through the in-process simulator in `src/lib/paper.ts`. It must drop calls, return 500s, lag reads, and answer a retry of the same `client_order_id` with 409. Paper never posts an order to Kalshi.
- Store the customer's production key on the `live` credential row. Do not call `demo.kalshi.co`.
- Encrypt the PEM on the server. After save, the browser never receives it again.
- Allow one running agent per series per user.
- Keep public market data on one shared tape. Private Kalshi calls are only for users with a running agent.
- Gate Run on the settings checklist in [docs/SETTINGS.md](docs/SETTINGS.md).
- Retry a lost create with the same `client_order_id`. See [docs/ORDER-LIFECYCLE.md](docs/ORDER-LIFECYCLE.md).

## Do not

- Do not call an LLM to pick a trade, a size, or an exit.
- Do not port the order client from `kalshi-ai-trader`, `trader-retro`, `kalshi-btcd-ai-trader`, `alpha-bot`, or `soccer-bloat-app`. Those clients post cents and `yes`/`no` to `/portfolio/orders`.
- Do not edit those repos, or `kalshi-hotkey-trader`, `compd-trader`, `cursor-kalshi-dashboard`, or `zerotrading`, from this project.
- Do not invent a local paper fill at the mid. A paper fill is a lagged read of an order the simulator already accepted.
- Do not store the PEM in plaintext, logs, admin screens, or decision sentences.
- Do not send a second order when the first response was a timeout, `500`, `503`, empty body, or bad JSON.
- Do not arm live from the paper Run path. Live betting stays off until an explicit arm switch sends production orders.
- Do not rank agents on paper fills. Paper never decides Working versus Not working.
- Do not copy another customer's key, fills, or balance when cloning an agent.
