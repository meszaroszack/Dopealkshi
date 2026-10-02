import { notFound, redirect } from "next/navigation";
import { setRunning } from "@/app/actions/app";
import { Notice, Shell } from "@/components/Shell";
import { currentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import type { WindowParams } from "@/lib/window";

export const dynamic = "force-dynamic";

export default async function AgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const queryParams = await searchParams;
  const agents = await query<{
    id: string;
    name: string;
    status: string;
    params: WindowParams;
  }>("select id, name, status, params from agents where id = $1 and user_id = $2", [id, user.id]);
  const agent = agents[0];
  if (!agent) notFound();
  const decisions = await query<{ action: string; sentence: string; created_at: string }>(
    "select action, sentence, created_at from decisions where agent_id = $1 order by created_at desc limit 20",
    [id],
  );
  return (
    <Shell email={user.email} admin={user.role === "admin"}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Window · 15-minute BTC · paper</p>
          <h1 className="mt-1 text-2xl font-semibold">{agent.name}</h1>
        </div>
        <form action={setRunning}>
          <input type="hidden" name="id" value={agent.id} />
          <input type="hidden" name="running" value={agent.status === "running" ? "no" : "yes"} />
          <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950" type="submit">
            {agent.status === "running" ? "Pause" : "Run"}
          </button>
        </form>
      </div>
      <Notice text={queryParams.error} />
      <dl className="mt-6 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat label="Size" value={`$${agent.params.sizeDollars}`} />
        <Stat label="Picky" value={`$${agent.params.moveEarly} move`} />
        <Stat label="Get out" value={`${agent.params.takeProfitPct}%`} />
        <Stat label="Loss cap" value={`$${agent.params.dailyLossCap}`} />
      </dl>
      <h2 className="mt-8 text-sm font-medium text-zinc-400">What it did</h2>
      {decisions.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">Nothing yet. Run it after the Kalshi demo card is green.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {decisions.map((decision, index) => (
            <li key={`${decision.created_at}-${index}`} className="rounded-lg border border-zinc-800 px-3 py-2 text-sm">
              <span className="mr-2 text-xs uppercase text-zinc-500">{decision.action}</span>
              {decision.sentence}
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 px-3 py-2">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
