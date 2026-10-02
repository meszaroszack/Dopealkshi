import { randomUUID } from "crypto";
import { query } from "../src/lib/db";
import { paperFate, paperRequest, provePaperFailures } from "../src/lib/paper";

async function main() {
const userId = randomUUID();

const seen = new Set<string>();
for (let i = 0; i < 40; i += 1) seen.add(paperFate(randomUUID()));
if (seen.size !== 3) throw new Error(`expected all three fates, saw ${[...seen].join(",")}`);

const message = await provePaperFailures(userId);
if (message) throw new Error(message);

const leftover = await query("select client_order_id from paper_orders where user_id = $1", [userId]);
if (leftover.length) throw new Error("probe rows were not deleted");

let accepted = "";
for (let i = 0; i < 40; i += 1) {
  const id = randomUUID();
  if (paperFate(id) === "accept") {
    accepted = id;
    break;
  }
}
if (!accepted) throw new Error("could not draw an accept id");

const created = await paperRequest(userId, "POST", "/trade-api/v2/portfolio/events/orders", {
  ticker: "KXBTC15M-TEST",
  client_order_id: accepted,
  side: "bid",
  count: "2.00",
  price: "0.4400",
});
if (created.status !== 201) throw new Error(`accept path returned ${created.status}`);
const orderId = String(created.json?.order_id ?? "");
await query("update paper_orders set visible_at = now() - interval '20 seconds' where order_id = $1", [orderId]);
const filled = await paperRequest(userId, "GET", `/trade-api/v2/portfolio/orders/${orderId}`);
if (filled.json?.status !== "executed" || filled.json.fill_count !== "2.00") {
  throw new Error(`lagged fill did not execute: ${JSON.stringify(filled.json)}`);
}
await query("delete from paper_orders where user_id = $1", [userId]);
console.log("paper simulator ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
