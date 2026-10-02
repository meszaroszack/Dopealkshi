"use server";

import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { testDemoKey } from "@/lib/settings-check";
import { defaultWindowParams } from "@/lib/window";

async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.disabled) redirect("/login?error=This account is disabled.");
  return user;
}

export async function saveDemoKey(formData: FormData) {
  const user = await requireUser();
  const keyId = String(formData.get("keyId") || "").trim();
  const pem = String(formData.get("pem") || "");
  if (!keyId || !pem.trim()) redirect("/kalshi?error=Key id and PEM are both required.");
  const checklist = await testDemoKey(user.id, keyId, pem);
  redirect(`/kalshi?message=${encodeURIComponent(checklist.message || "Saved.")}`);
}

export async function createAgent(formData: FormData) {
  const user = await requireUser();
  const count = await query<{ count: string }>("select count(*)::text as count from agents where user_id = $1", [user.id]);
  if (user.tier !== "pro" && Number(count[0]?.count ?? 0) >= 1) {
    redirect("/agents?error=Free accounts get one agent. Pro unlocks more.");
  }
  const name = String(formData.get("name") || "").trim().slice(0, 40);
  const sizeDollars = Number(formData.get("sizeDollars") || 5);
  const moveEarly = Number(formData.get("moveEarly") || 60);
  const takeProfitPct = Number(formData.get("takeProfitPct") || 35);
  const dailyLossCap = Number(formData.get("dailyLossCap") || 25);
  if (!name) redirect("/agents/new?error=Name the agent.");
  const params = {
    ...defaultWindowParams,
    sizeDollars: clamp(sizeDollars, 1, 50),
    moveEarly: clamp(moveEarly, 10, 500),
    moveLate: clamp(moveEarly, 10, 500) * 2,
    takeProfitPct: clamp(takeProfitPct, 5, 100),
    dailyLossCap: clamp(dailyLossCap, 1, 500),
  };
  const rows = await query<{ id: string }>(
    `insert into agents (user_id, name, strategy, style, params, mode, status)
     values ($1, $2, 'btc_15m', 'window', $3::jsonb, 'paper', 'paused') returning id`,
    [user.id, name, JSON.stringify(params)],
  );
  redirect(`/agents/${rows[0].id}`);
}

export async function setRunning(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") || "");
  const running = String(formData.get("running") || "") === "yes";
  const agent = (await query<{ id: string }>("select id from agents where id = $1 and user_id = $2", [id, user.id]))[0];
  if (!agent) redirect("/agents");
  if (running) {
    const cred = await query<{ checklist: { probeOk?: boolean } }>(
      "select checklist from kalshi_credentials where user_id = $1 and environment = 'demo'",
      [user.id],
    );
    if (!cred[0]?.checklist?.probeOk) {
      redirect(`/agents/${id}?error=${encodeURIComponent("Demo key is not green yet. Finish the Kalshi checklist.")}`);
    }
    await query("update agents set status = 'paused' where user_id = $1 and strategy = 'btc_15m' and id <> $2", [user.id, id]);
  }
  await query("update agents set status = $2 where id = $1", [id, running ? "running" : "paused"]);
  redirect(`/agents/${id}`);
}

export async function setHalt(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/agents");
  const halt = String(formData.get("halt") || "") === "yes";
  await query("update app_settings set halt_live = $1 where id = 1", [halt]);
  await query("insert into admin_audit (actor_id, action, target) values ($1, $2, 'live')", [
    user.id,
    halt ? "halt" : "resume",
  ]);
  redirect("/admin");
}

export async function setUserTier(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/agents");
  const userId = String(formData.get("userId") || "");
  const action = String(formData.get("action") || "");
  if (action === "disable") {
    await query("update profiles set disabled = true where id = $1", [userId]);
    await query("update agents set status = 'paused' where user_id = $1", [userId]);
    await query("insert into admin_audit (actor_id, action, target) values ($1, 'disable', $2)", [user.id, userId]);
  }
  if (action === "comp") {
    await query("update profiles set tier = 'pro' where id = $1", [userId]);
    await query("insert into admin_audit (actor_id, action, target) values ($1, 'comp', $2)", [user.id, userId]);
  }
  if (action === "grant") {
    await query("update profiles set bonus_market_granted = true where id = $1", [userId]);
    await query("insert into admin_audit (actor_id, action, target) values ($1, 'grant_market', $2)", [user.id, userId]);
  }
  redirect("/admin");
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
