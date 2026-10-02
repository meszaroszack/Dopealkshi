import { randomUUID } from "crypto";
import { query } from "../lib/db";
import { formatCount, formatPrice, kalshiRequest, publicGet } from "../lib/kalshi";
import { decideWindow, defaultWindowParams, type WindowParams } from "../lib/window";
import { decryptPem } from "../lib/crypto";

type AgentRow = {
  id: string;
  user_id: string;
  name: string;
  params: WindowParams;
  status: string;
  last_ticker: string | null;
  window_entries: number;
  open_entry_price: string | null;
  open_count: string | null;
  api_key_id: string;
  private_key_encrypted: string;
  checklist: { probeOk?: boolean };
  free_markets_used: number;
  skip_windows: number;
  bonus_market_granted: boolean;
  disabled: boolean;
  tier: string;
};

let started = false;

export function startWorker() {
  if (started) return;
  started = true;
  const tick = () => {
    runCycle().catch((error) => {
      console.error("[worker]", error instanceof Error ? error.message : error);
    });
  };
  setTimeout(tick, 4_000);
  setInterval(tick, 15_000);
}

async function runCycle() {
  if (!process.env.DATABASE_URL) return;
  const agents = await query<AgentRow>(
    `select a.id, a.user_id, a.name, a.params, a.status, a.last_ticker, a.window_entries,
            a.open_entry_price, a.open_count, c.api_key_id, c.private_key_encrypted, c.checklist,
            p.free_markets_used, p.skip_windows, p.bonus_market_granted, p.disabled, p.tier
     from agents a
     join kalshi_credentials c on c.user_id = a.user_id and c.environment = 'demo'
     join profiles p on p.id = a.user_id
     where a.status = 'running' and a.mode = 'paper' and p.disabled = false`,
  );
  if (agents.length === 0) return;

  const market = await loadMarket();
  const spot = await loadSpot();
  for (const agent of agents) {
    if (!agent.checklist?.probeOk) continue;
    await leaseAndTrade(agent, market, spot);
  }
}

async function loadMarket() {
  const result = await publicGet("/trade-api/v2/markets?series_ticker=KXBTC15M&status=open&limit=5");
  const markets = (result.json?.markets as Array<Record<string, unknown>> | undefined) ?? [];
  const open = markets
    .filter((market) => market.status === "active" || market.status === "open")
    .sort((a, b) => String(a.close_time).localeCompare(String(b.close_time)))[0];
  if (!open || typeof open.ticker !== "string") return null;
  const close = Date.parse(String(open.close_time));
  const opened = Date.parse(String(open.open_time));
  const now = Date.now();
  return {
    ticker: open.ticker,
    yesAsk: Number(open.yes_ask_dollars ?? 0),
    strike: Number(open.floor_strike ?? 0),
    elapsedMin: Number.isFinite(opened) ? (now - opened) / 60000 : 0,
    remainingSec: Number.isFinite(close) ? (close - now) / 1000 : 0,
  };
}

async function loadSpot() {
  try {
    const response = await fetch("https://api.coinbase.com/v2/prices/BTC-USD/spot", { signal: AbortSignal.timeout(8_000) });
    const json = (await response.json()) as { data?: { amount?: string } };
    const amount = Number(json.data?.amount);
    if (Number.isFinite(amount)) return amount;
  } catch {
    /* fall through */
  }
  const response = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT", { signal: AbortSignal.timeout(8_000) });
  const json = (await response.json()) as { price?: string };
  return Number(json.price ?? 0);
}

async function leaseAndTrade(agent: AgentRow, market: Awaited<ReturnType<typeof loadMarket>>, spot: number) {
  const leased = await query<{ id: string }>(
    `update agents set lease_until = now() + interval '20 seconds'
     where id = $1 and (lease_until is null or lease_until < now())
     returning id`,
    [agent.id],
  );
  if (!leased[0]) return;

  if (market && agent.last_ticker && agent.last_ticker !== market.ticker) {
    await rollWindow(agent);
  }

  const refreshed = (await query<AgentRow>(
    `select a.id, a.user_id, a.name, a.params, a.status, a.last_ticker, a.window_entries,
            a.open_entry_price, a.open_count, c.api_key_id, c.private_key_encrypted, c.checklist,
            p.free_markets_used, p.skip_windows, p.bonus_market_granted, p.disabled, p.tier
     from agents a
     join kalshi_credentials c on c.user_id = a.user_id and c.environment = 'demo'
     join profiles p on p.id = a.user_id
     where a.id = $1`,
    [agent.id],
  ))[0];
  if (!refreshed) return;

  const openIntent = (await query<{ status: string; client_order_id: string; kalshi_order_id: string | null; ticker: string; side: string; submit_time: string }>(
    `select status, client_order_id, kalshi_order_id, ticker, side, submit_time
     from order_intents
     where agent_id = $1 and purpose = 'strategy' and status in ('pending_submit', 'unknown', 'acked', 'resting')
     order by submit_time desc limit 1`,
    [refreshed.id],
  ))[0];

  const pem = decryptPem(refreshed.private_key_encrypted);
  if (openIntent) {
    await reconcile(refreshed, pem, openIntent);
    return;
  }

  const params = { ...defaultWindowParams, ...refreshed.params };
  const limit = 3 + (refreshed.bonus_market_granted ? 1 : 0);
  const overQuota = refreshed.tier !== "pro" && refreshed.free_markets_used >= limit;
  const view = market
    ? {
        ticker: market.ticker,
        yesAsk: market.yesAsk,
        elapsedMin: market.elapsedMin,
        remainingSec: market.remainingSec,
        move: Math.abs(spot - market.strike),
      }
    : null;
  const decision = decideWindow({
    market: view,
    params,
    hasPosition: Number(refreshed.open_count ?? 0) > 0,
    entryPrice: refreshed.open_entry_price === null ? null : Number(refreshed.open_entry_price),
    dailyLoss: 0,
    blocked: overQuota ? "quota" : null,
  });

  await query("insert into decisions (agent_id, action, sentence) values ($1, $2, $3)", [
    refreshed.id,
    decision.action,
    decision.sentence,
  ]);

  if (market && refreshed.last_ticker !== market.ticker) {
    await query("update agents set last_ticker = $2, window_entries = 0 where id = $1", [refreshed.id, market.ticker]);
  }

  if (!market || !view) return;
  if (decision.action === "enter") {
    await submit(refreshed, pem, market.ticker, "bid", view.yesAsk, params.sizeDollars);
    await query("update agents set window_entries = window_entries + 1 where id = $1", [refreshed.id]);
  } else if (decision.action === "exit" && Number(refreshed.open_count ?? 0) > 0) {
    await submit(refreshed, pem, market.ticker, "ask", view.yesAsk, Number(refreshed.open_count));
  }
}

async function rollWindow(agent: AgentRow) {
  const entries = agent.window_entries;
  await query("update profiles set free_markets_used = free_markets_used + 1 where id = $1 and tier <> 'pro'", [agent.user_id]);
  if (entries === 0) {
    await query("update profiles set skip_windows = skip_windows + 1 where id = $1", [agent.user_id]);
  }
  const profile = (await query<{ free_markets_used: number; skip_windows: number; bonus_market_granted: boolean }>(
    "select free_markets_used, skip_windows, bonus_market_granted from profiles where id = $1",
    [agent.user_id],
  ))[0];
  if (profile && profile.free_markets_used >= 3 && profile.skip_windows >= 3 && !profile.bonus_market_granted) {
    await query("update profiles set bonus_market_granted = true where id = $1", [agent.user_id]);
  }
  await query("update agents set window_entries = 0, open_entry_price = null, open_count = null where id = $1", [agent.id]);
}

async function submit(agent: AgentRow, pem: string, ticker: string, side: "bid" | "ask", price: number, size: number) {
  const contracts = side === "bid" ? Math.max(1, Math.floor(size / Math.max(price, 0.01))) : Math.max(1, Math.floor(size));
  const clientOrderId = randomUUID();
  await query(
    `insert into order_intents (agent_id, user_id, client_order_id, ticker, side, price, count, status, purpose)
     values ($1, $2, $3, $4, $5, $6, $7, 'pending_submit', 'strategy')`,
    [agent.id, agent.user_id, clientOrderId, ticker, side, formatPrice(price), formatCount(contracts)],
  );
  try {
    const created = await kalshiRequest("demo", agent.api_key_id, pem, "POST", "/trade-api/v2/portfolio/events/orders", {
      ticker,
      client_order_id: clientOrderId,
      side,
      count: formatCount(contracts),
      price: formatPrice(price),
      time_in_force: "good_till_canceled",
      self_trade_prevention_type: "taker_at_cross",
      post_only: false,
      cancel_order_on_pause: true,
    });
    await applyCreate(clientOrderId, created.status, created.json, created.text, side, price, contracts, agent.id);
  } catch (error) {
    await query("update order_intents set status = 'unknown', last_error = $2 where client_order_id = $1", [
      clientOrderId,
      error instanceof Error ? error.message : "timeout",
    ]);
    await query("insert into decisions (agent_id, action, sentence) values ($1, 'skip', $2)", [
      agent.id,
      "Kalshi timed out. Checking whether the bid landed. Not sending another.",
    ]);
  }
}

async function applyCreate(
  clientOrderId: string,
  status: number,
  json: Record<string, unknown> | null,
  text: string,
  side: string,
  price: number,
  contracts: number,
  agentId: string,
) {
  if (status === 201 || status === 409) {
    const orderId = typeof json?.order_id === "string" ? json.order_id : null;
    const fill = Number(json?.fill_count ?? 0);
    const remaining = Number(json?.remaining_count ?? contracts);
    const next = fill > 0 && remaining <= 0 ? "filled" : "resting";
    await query(
      "update order_intents set status = $2, kalshi_order_id = $3, raw = $4::jsonb where client_order_id = $1",
      [clientOrderId, status === 409 ? "acked" : next, orderId, JSON.stringify(json ?? {})],
    );
    if (side === "bid" && fill > 0) {
      await query("update agents set open_entry_price = $2, open_count = $3 where id = $1", [agentId, price, fill]);
    }
    if (side === "ask" && fill > 0) {
      await query("update agents set open_entry_price = null, open_count = null where id = $1", [agentId]);
    }
    return;
  }
  if (status === 401 || status === 403) {
    await query("update order_intents set status = 'paused_auth', last_error = $2 where client_order_id = $1", [clientOrderId, text.slice(0, 300)]);
    await query("update agents set status = 'paused' where id = $1", [agentId]);
    await query("insert into decisions (agent_id, action, sentence) values ($1, 'skip', $2)", [
      agentId,
      status === 403 ? "This key can read the account and cannot place orders." : "Paused. The demo key was rejected.",
    ]);
    return;
  }
  await query("update order_intents set status = 'rejected', last_error = $2 where client_order_id = $1", [clientOrderId, text.slice(0, 300)]);
  const message = typeof json?.message === "string" ? json.message : `Kalshi rejected the bid (${status}).`;
  await query("insert into decisions (agent_id, action, sentence) values ($1, 'skip', $2)", [agentId, message]);
}

async function reconcile(
  agent: AgentRow,
  pem: string,
  intent: { status: string; client_order_id: string; kalshi_order_id: string | null; ticker: string; side: string; submit_time: string },
) {
  if (intent.kalshi_order_id) {
    const order = await kalshiRequest("demo", agent.api_key_id, pem, "GET", `/trade-api/v2/portfolio/orders/${intent.kalshi_order_id}`);
    if (order.status === 200 && order.json) {
      const state = String(order.json.status ?? "");
      if (state === "executed" || Number(order.json.fill_count ?? 0) > 0 && Number(order.json.remaining_count ?? 0) === 0) {
        await query("update order_intents set status = 'filled', raw = $2::jsonb where client_order_id = $1", [intent.client_order_id, JSON.stringify(order.json)]);
      } else if (state === "canceled") {
        await query("update order_intents set status = 'canceled' where client_order_id = $1", [intent.client_order_id]);
      } else {
        await query("update order_intents set status = 'resting' where client_order_id = $1", [intent.client_order_id]);
      }
      return;
    }
  }

  const stamp = await kalshiRequest("demo", agent.api_key_id, pem, "GET", "/trade-api/v2/exchange/user_data_timestamp");
  const asOf = Date.parse(String(stamp.json?.as_of_time ?? ""));
  const submitted = Date.parse(intent.submit_time);
  if (!Number.isFinite(asOf) || asOf < submitted) return;

  const listed = await kalshiRequest("demo", agent.api_key_id, pem, "GET", `/trade-api/v2/portfolio/orders?limit=50`);
  const orders = (listed.json?.orders as Array<Record<string, unknown>> | undefined) ?? [];
  const found = orders.find((order) => order.client_order_id === intent.client_order_id);
  if (found) {
    await query("update order_intents set status = 'acked', kalshi_order_id = $2 where client_order_id = $1", [
      intent.client_order_id,
      typeof found.order_id === "string" ? found.order_id : null,
    ]);
    return;
  }
  await query("update order_intents set status = 'absent' where client_order_id = $1", [intent.client_order_id]);
}
