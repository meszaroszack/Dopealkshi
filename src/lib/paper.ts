import { createHash, randomUUID } from "crypto";
import { query } from "./db";
import type { KalshiResult } from "./kalshi";

export type PaperFate = "drop" | "server_error" | "accept";

export function paperFate(clientOrderId: string): PaperFate {
  const bucket = createHash("sha256").update(clientOrderId).digest()[0] % 10;
  if (bucket <= 1) return "drop";
  if (bucket === 2) return "server_error";
  return "accept";
}

type PaperOrder = {
  client_order_id: string;
  order_id: string;
  ticker: string;
  side: string;
  price: string;
  count: string;
  fill_count: string;
  remaining_count: string;
  status: string;
  visible_at: string;
};

export async function paperRequest(userId: string, method: string, path: string, body?: unknown): Promise<KalshiResult> {
  if (method === "POST" && path === "/trade-api/v2/portfolio/events/orders") {
    return createOrder(userId, body as Record<string, unknown>);
  }
  if (method === "GET" && path.startsWith("/trade-api/v2/exchange/user_data_timestamp")) {
    return timestamp(userId);
  }
  if (method === "GET" && path.startsWith("/trade-api/v2/portfolio/orders/")) {
    const orderId = path.split("/").pop()?.split("?")[0] ?? "";
    return getOne(userId, orderId);
  }
  if (method === "GET" && path.startsWith("/trade-api/v2/portfolio/orders")) {
    return listOrders(userId);
  }
  if (method === "DELETE" && path.includes("/portfolio/events/orders/")) {
    const orderId = path.split("/portfolio/events/orders/")[1]?.split("?")[0] ?? "";
    return cancel(userId, orderId);
  }
  return { status: 400, json: { message: "Paper simulator does not implement that call." }, text: "" };
}

async function createOrder(userId: string, body: Record<string, unknown>): Promise<KalshiResult> {
  const clientOrderId = String(body.client_order_id ?? "");
  const existing = await find(userId, clientOrderId);
  if (existing) {
    return { status: 409, json: { message: "duplicate client_order_id", order_id: existing.order_id, client_order_id: clientOrderId }, text: "" };
  }
  const fate = paperFate(clientOrderId);
  if (fate === "server_error") {
    return { status: 500, json: { message: "internal server error" }, text: "internal server error" };
  }
  const orderId = randomUUID();
  const visibleAt = new Date(Date.now() + (fate === "drop" ? 8_000 : 0)).toISOString();
  const count = String(body.count ?? "1.00");
  await query(
    `insert into paper_orders (client_order_id, order_id, user_id, ticker, side, price, count, fill_count, remaining_count, status, visible_at)
     values ($1,$2,$3,$4,$5,$6,$7,'0.00',$7,'resting',$8)`,
    [clientOrderId, orderId, userId, String(body.ticker ?? ""), String(body.side ?? "bid"), String(body.price ?? "0.0100"), count, visibleAt],
  );
  if (fate === "drop") {
    throw new Error("timeout");
  }
  return {
    status: 201,
    json: { order_id: orderId, client_order_id: clientOrderId, fill_count: "0.00", remaining_count: count },
    text: "",
  };
}

async function timestamp(userId: string): Promise<KalshiResult> {
  const hidden = await query<{ visible_at: string }>(
    "select visible_at from paper_orders where user_id = $1 and visible_at > now() order by visible_at limit 1",
    [userId],
  );
  const asOf = hidden[0] ? new Date(Date.now() - 30_000).toISOString() : new Date().toISOString();
  return { status: 200, json: { as_of_time: asOf }, text: "" };
}

async function listOrders(userId: string): Promise<KalshiResult> {
  const rows = await query<PaperOrder>(
    "select * from paper_orders where user_id = $1 and visible_at <= now() order by created_at desc limit 50",
    [userId],
  );
  const visible = [];
  for (const row of rows) visible.push(await maybeFill(row));
  return { status: 200, json: { orders: visible.map(toWire) }, text: "" };
}

async function getOne(userId: string, orderId: string): Promise<KalshiResult> {
  const rows = await query<PaperOrder>(
    "select * from paper_orders where user_id = $1 and order_id = $2 and visible_at <= now()",
    [userId, orderId],
  );
  if (!rows[0]) return { status: 404, json: { message: "not found" }, text: "" };
  return { status: 200, json: toWire(await maybeFill(rows[0])), text: "" };
}

async function maybeFill(row: PaperOrder): Promise<PaperOrder> {
  if (row.status !== "resting") return row;
  if (new Date(row.visible_at).getTime() > Date.now() - 15_000) return row;
  await query(
    "update paper_orders set status = 'executed', fill_count = count, remaining_count = '0.00' where order_id = $1 and status = 'resting'",
    [row.order_id],
  );
  return { ...row, status: "executed", fill_count: row.count, remaining_count: "0.00" };
}

async function cancel(userId: string, orderId: string): Promise<KalshiResult> {
  const rows = await query<PaperOrder>("select * from paper_orders where user_id = $1 and order_id = $2", [userId, orderId]);
  if (!rows[0]) return { status: 404, json: { message: "not found" }, text: "" };
  if (new Date(rows[0].visible_at).getTime() > Date.now()) {
    return { status: 503, json: { message: "service unavailable" }, text: "" };
  }
  await query("update paper_orders set status = 'canceled', remaining_count = '0.00' where order_id = $1", [orderId]);
  return { status: 200, json: { order_id: orderId, client_order_id: rows[0].client_order_id }, text: "" };
}

async function find(userId: string, clientOrderId: string) {
  const rows = await query<PaperOrder>("select * from paper_orders where user_id = $1 and client_order_id = $2", [userId, clientOrderId]);
  return rows[0] ?? null;
}

function toWire(row: PaperOrder) {
  return {
    order_id: row.order_id,
    client_order_id: row.client_order_id,
    ticker: row.ticker,
    side: row.side,
    status: row.status === "canceled" ? "canceled" : row.status === "resting" ? "resting" : "executed",
    fill_count: row.fill_count,
    remaining_count: row.remaining_count,
  };
}

function idWithFate(fate: PaperFate) {
  for (let i = 0; i < 80; i += 1) {
    const id = `probe-${fate}-${i}-${randomUUID()}`;
    if (paperFate(id) === fate) return id;
  }
  throw new Error("could not draw a paper failure case");
}

export async function provePaperFailures(userId: string) {
  const dropped = idWithFate("drop");
  const failed = idWithFate("server_error");
  try {
    let timedOut = false;
    try {
      await createOrder(userId, { client_order_id: dropped, ticker: "PROBE", side: "bid", count: "1.00", price: "0.0100" });
    } catch {
      timedOut = true;
    }
    if (!timedOut) return "The dropped-call case did not time out.";
    const again = await createOrder(userId, { client_order_id: dropped, ticker: "PROBE", side: "bid", count: "1.00", price: "0.0100" });
    if (again.status !== 409) return "A retry did not come back as already placed.";
    const blown = await createOrder(userId, { client_order_id: failed, ticker: "PROBE", side: "bid", count: "1.00", price: "0.0100" });
    if (blown.status !== 500) return "The bad response case did not fail.";
    const listed = await listOrders(userId);
    const orders = (listed.json?.orders as Array<{ client_order_id?: string }> | undefined) ?? [];
    if (orders.some((order) => order.client_order_id === dropped)) return "A lagged order was visible too early.";
    const stamp = await timestamp(userId);
    const asOf = Date.parse(String(stamp.json?.as_of_time ?? ""));
    if (asOf > Date.now() - 5_000) return "The read timestamp did not lag.";
    const orderId = typeof again.json?.order_id === "string" ? again.json.order_id : "";
    const hidden = await query<PaperOrder>("select * from paper_orders where user_id = $1 and order_id = $2", [userId, orderId]);
    if (!hidden[0]) return "The dropped call did not leave an order to find later.";
    const cancel = await paperRequest(userId, "DELETE", `/trade-api/v2/portfolio/events/orders/${hidden[0].order_id}`);
    if (cancel.status !== 503) return "A cancel during the lag window should fail, not pretend it worked.";
    return "";
  } finally {
    await query("delete from paper_orders where user_id = $1 and ticker = 'PROBE'", [userId]);
  }
}
