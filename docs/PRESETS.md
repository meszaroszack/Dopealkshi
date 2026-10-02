# Presets

Styles are named numbers. The three dials write into those numbers. They do not add a new algorithm.

The sentences in the decision log use the values after the dials, not the stock preset, so a customer can see the rule they actually set.

## Dials

Every agent has the same three controls, plus the shared risk fields.

| Dial | What the customer thinks | What it writes |
|---|---|---|
| Size | How much per trade | Dollars or contracts, and max open positions |
| Picky | How sure it has to be | Tightens the entry band, the minimum move, or the confidence floor |
| Get out | When it takes the win or the loss | Profit target, stop, and the daily loss cap |

Shared, always visible, not hidden inside a style:

- Daily loss cap, then the agent stops opening new orders
- Cooldown after a loss
- Paper (simulated orders on a production key) or live (production orders, not armed in this deploy)
- Armed, default off. Live orders require armed, Pro, a green Live card, and the global halt off

## Window

15-minute `KXBTC15M`. Taken from the time windows described in `kalshi-ai-trader-v2` `client/src/pages/Strategy.tsx`.

- Minutes 0–3: no entry
- Minutes 3–10: enter only if the contract is 28–72¢ and BTC has moved at least $60 from the open
- Minutes 10–13.5: enter only if BTC has moved at least $120 from the open
- Last 90 seconds: no new entries
- Take profit at +35% from entry
- In the final window, exit under 75¢ and hold above 80¢

Picky tightens the contract band and raises the minimum BTC move. Get out changes the take-profit percent, the final-window exit level, and the daily loss cap.

## Swing

15-minute `KXBTC15M`. Taken from the default `bot_settings` row in `trader-retro` `shared/schema.ts`.

- Risk 25%
- Take profit 25%
- Stop 20%
- Confidence floor 60
- Swing threshold 0.05
- Lookback 3

These numbers disagree with Window on purpose. They are two presets, not one merged bot. Picky moves the confidence floor and the swing threshold. Get out moves the take profit, the stop, and the daily loss cap. Size applies the risk percent to the production balance, capped by max open positions.

## Decay

Hourly `KXBTCD`. Taken from the rules in `kalshi-btcd-ai-trader` `server/aiEngineKxbtcd.ts`. Pro only.

- Buy NO only
- Strike cushion 0.3% to 2% from spot
- NO priced 65–95¢
- Hold to the hour
- Exit if spot gets within 0.1% of the strike
- Flat contract count. No 0.5 / 1 / 1.5 model multiplier

Size sets the contract count. Picky narrows the cushion and the NO price band. Get out sets the emergency distance and the daily loss cap.

## What a preset is not

A preset is not a prompt and not a published customer agent. Customer-published dials become a public card only through Publish. They become an official style card only when an admin promotes that cluster. See [ADMIN.md](ADMIN.md).
