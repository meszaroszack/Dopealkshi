import Link from "next/link";
import { redirect } from "next/navigation";
import { Notice, Shell } from "@/components/Shell";
import { currentUser } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AgentsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const agents = await query<{ id: string; name: string; status: string; style: string }>(
    "select id, name, status, style from agents where user_id = $1 order by created_at desc",
    [user.id],
  );
  const limit = 3 + (user.bonus_market_granted ? 1 : 0);
  return (
    <Shell email={user.email} admin={user.role === "admin"}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Agents</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Free markets used: {user.free_markets_used} of {limit}. Paper reads the live tape and simulates the order calls.
          </p>
        </div>
        <Link className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950" href="/agents/new">
          Create an agent
        </Link>
      </div>
      <Notice text={params.error} />
      {agents.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-zinc-700 px-4 py-8 text-sm text-zinc-400">
          No agent yet. Create one Window agent for the 15-minute BTC market.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {agents.map((agent) => (
            <li key={agent.id}>
              <Link className="flex items-center justify-between rounded-xl border border-zinc-800 px-4 py-3" href={`/agents/${agent.id}`}>
                <span>
                  <span className="block font-medium">{agent.name}</span>
                  <span className="text-xs uppercase tracking-wide text-zinc-500">{agent.style}</span>
                </span>
                <span className={agent.status === "running" ? "text-emerald-400" : "text-zinc-400"}>{agent.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}
