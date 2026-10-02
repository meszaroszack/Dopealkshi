# Product

The customer-facing name is unset. In the product, a person builds an agent. Under the dials, the agent is a fixed algorithm with a saved configuration.

## Create

Four steps.

1. Name it. Example: "Late window".
2. Pick a market. 15-minute BTC (`KXBTC15M`) or hourly BTC (`KXBTCD`).
3. Pick a style card. 15-minute has Window and Swing. Hourly has Decay. The numbers are in [PRESETS.md](PRESETS.md).
4. Set three dials: size, picky, and get out.

The agent is created paused, in paper, bound to the Demo key card. Run stays disabled until that card is green. See [SETTINGS.md](SETTINGS.md).

An "Edit rules" disclosure shows the underlying numbers. The default page does not.

## What they watch

Each cycle writes one sentence from the rule that fired.

- "Skipped. 81¢ is outside the 28–72¢ band you set."
- "Bought NO. Strike is 1.1% away, NO is 78¢, your band is 65–95¢."
- "Stopped for the day. Loss hit the $25 cap."
- "Kalshi timed out. Checking whether the bid landed. Not sending another."

The log is the product. It does not say the agent learned, trained, or decided on its own.

## Paper

Paper uses the customer's demo Kalshi key and places real orders on the demo exchange. A demo settlement counts toward the free quota. Practice that never hits Kalshi does not exist in this app.

## Free and Pro

Free:

- One agent
- 15-minute market only
- Three settled demo markets, then the agent stops opening new orders
- If a position is still open when the third market ends, get-out rules keep running until that position settles
- If all three markets were skips, the account gets one extra market, once

After the quota, the agent stays on the page and keeps logging shadow lines.

- "Would have bought YES at 44¢. Free markets are used."

The order is not sent. Upgrade is one button on that page: Resume on the next market. The dials stay as they are.

Pro, about $15 a month, or an admin comp:

- The quota is gone
- Hourly Decay unlocks
- More than one agent
- Live arm, after the Live card is green

The free tape is the same speed as Pro. A slower free tier is a broken product, not a paywall.

Admin can grant one extra market without comping the month. That is for someone who burned three windows on a bad preset.

## Publish

Publish copies the agent's name, style, and dials onto a public card. It does not copy the key, the order history, or the balance. Another customer can clone the card. The clone is a new paused agent on their own demo key.

Unpublish removes the card. It does not delete the agent's own orders.

The public card shows the dials. It shows a performance sentence only after an admin releases one. It does not show another customer's dollar P&L.

## Clone

A customer clone and an admin clone are the same copy operation. Dials only. Paused. Bound to the copier's own demo key. Later edits on the source agent do not change the copy.

## Words the UI does not use

Trained, learning, and autonomous. A settings change shows up in the next log line. That is the moment the agent feels like theirs.
