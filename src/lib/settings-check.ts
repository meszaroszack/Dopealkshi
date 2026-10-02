import { randomUUID } from "crypto";
import { decryptPem, describeKey, encryptPem, normalizePem } from "./crypto";
import { query } from "./db";
import {
  dollarsFromBalance,
  formatCount,
  formatPrice,
  kalshiRequest,
  publicGet,
} from "./kalshi";

export type Checklist = {
  pem: boolean;
  balanceOk: boolean;
  positionsOk: boolean;
  probeOk: boolean;
  balance: number | null;
  message: string;
};

export async function testDemoKey(userId: string, keyId: string, pemInput: string) {
  const checklist: Checklist = {
    pem: false,
    balanceOk: false,
    positionsOk: false,
    probeOk: false,
    balance: null,
    message: "",
  };
  let pem = "";
  try {
    const described = describeKey(pemInput);
    pem = described.pem;
    checklist.pem = described.type === "ed25519" || described.type === "rsa";
    if (!checklist.pem) checklist.message = "The private key did not parse. Paste the PEM Kalshi showed you once.";
  } catch {
    checklist.message = "The private key did not parse. Paste the PEM Kalshi showed you once.";
  }

  if (checklist.pem) {
    try {
      const balance = await kalshiRequest("demo", keyId, pem, "GET", "/trade-api/v2/portfolio/balance");
      checklist.balance = dollarsFromBalance(balance.json);
      checklist.balanceOk = balance.status === 200 && checklist.balance !== null && !Number.isNaN(checklist.balance);
      if (!checklist.balanceOk) {
        checklist.message = balance.status === 401
          ? "This demo key was rejected. Check the key id and the PEM."
          : `Balance call failed (${balance.status}).`;
      }
    } catch (error) {
      checklist.message = error instanceof Error ? error.message : "Balance call failed.";
    }
  }

  if (checklist.balanceOk) {
    try {
      const positions = await kalshiRequest("demo", keyId, pem, "GET", "/trade-api/v2/portfolio/positions");
      checklist.positionsOk = positions.status === 200;
      if (!checklist.positionsOk) checklist.message = `Positions call failed (${positions.status}).`;
    } catch (error) {
      checklist.message = error instanceof Error ? error.message : "Positions call failed.";
    }
  }

  if (checklist.positionsOk) {
    checklist.message = await runProbe(userId, keyId, pem, checklist);
  }

  if (checklist.probeOk) checklist.message = `Demo connected. Balance $${checklist.balance?.toFixed(2)}.`;

  const encrypted = checklist.pem ? encryptPem(normalizePem(pemInput)) : null;
  if (encrypted) {
    await query(
      `insert into kalshi_credentials (user_id, environment, api_key_id, private_key_encrypted, last_balance, last_error, checklist)
       values ($1, 'demo', $2, $3, $4, $5, $6::jsonb)
       on conflict (user_id, environment)
       do update set api_key_id = $2, private_key_encrypted = $3, last_balance = $4, last_error = $5, checklist = $6::jsonb, updated_at = now()`,
      [userId, keyId.trim(), encrypted, checklist.balance, checklist.probeOk ? null : checklist.message, JSON.stringify(checklist)],
    );
  }
  return checklist;
}

async function runProbe(userId: string, keyId: string, pem: string, checklist: Checklist) {
  const markets = await publicGet("/trade-api/v2/markets?status=open&limit=1");
  const list = (markets.json?.markets as Array<Record<string, unknown>> | undefined) ?? [];
  const ticker = typeof list[0]?.ticker === "string" ? list[0].ticker : "";
  if (!ticker) return "No open market to prove the key can trade.";

  const clientOrderId = randomUUID();
  await query(
    `insert into order_intents (user_id, client_order_id, ticker, side, price, count, status, purpose)
     values ($1, $2, $3, 'bid', '0.0100', '1.00', 'pending_submit', 'probe')`,
    [userId, clientOrderId, ticker],
  );
  let created;
  try {
    created = await kalshiRequest("demo", keyId, pem, "POST", "/trade-api/v2/portfolio/events/orders", {
      ticker,
      client_order_id: clientOrderId,
      side: "bid",
      count: formatCount(1),
      price: formatPrice(0.01),
      time_in_force: "good_till_canceled",
      self_trade_prevention_type: "taker_at_cross",
      post_only: true,
      cancel_order_on_pause: true,
    });
  } catch (error) {
    await query("update order_intents set status = 'unknown', last_error = $2 where client_order_id = $1", [
      clientOrderId,
      error instanceof Error ? error.message : "timeout",
    ]);
    return "Kalshi timed out on the 1¢ test order. Not sending another.";
  }

  if (created.status === 403) {
    await query("update order_intents set status = 'paused_auth', last_error = $2 where client_order_id = $1", [clientOrderId, created.text.slice(0, 300)]);
    return "This key can read the account and cannot place orders.";
  }
  if (created.status !== 201 && created.status !== 409) {
    await query("update order_intents set status = 'rejected', last_error = $2, raw = $3::jsonb where client_order_id = $1", [
      clientOrderId,
      created.text.slice(0, 300),
      JSON.stringify(created.json ?? {}),
    ]);
    return `Test order rejected (${created.status}). ${created.json?.message ?? ""}`.trim();
  }

  const orderId = typeof created.json?.order_id === "string" ? created.json.order_id : "";
  await query(
    "update order_intents set status = 'acked', kalshi_order_id = $2, raw = $3::jsonb where client_order_id = $1",
    [clientOrderId, orderId || null, JSON.stringify(created.json ?? {})],
  );
  if (!orderId) return "Kalshi accepted the test without an order id. The card stays red.";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const cancel = await kalshiRequest("demo", keyId, pem, "DELETE", `/trade-api/v2/portfolio/events/orders/${orderId}?market_ticker=${encodeURIComponent(ticker)}`);
    if (cancel.status >= 200 && cancel.status < 300) {
      await query("update order_intents set status = 'canceled' where client_order_id = $1", [clientOrderId]);
      checklist.probeOk = true;
      return "";
    }
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
  return "The 1¢ test order was placed and the cancel is not confirmed yet. Try Test again.";
}

export async function loadDemoPem(userId: string) {
  const rows = await query<{ api_key_id: string; private_key_encrypted: string; checklist: Checklist; last_balance: string | null }>(
    "select api_key_id, private_key_encrypted, checklist, last_balance from kalshi_credentials where user_id = $1 and environment = 'demo'",
    [userId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    keyId: row.api_key_id,
    pem: decryptPem(row.private_key_encrypted),
    checklist: row.checklist,
    balance: row.last_balance === null ? null : Number(row.last_balance),
  };
}
