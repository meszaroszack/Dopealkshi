import { redirect } from "next/navigation";
import { setHalt, setUserTier } from "@/app/actions/app";
import { Shell } from "@/components/Shell";
import { currentUser } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/agents");
  const settings = await query<{ halt_live: boolean }>("select halt_live from app_settings where id = 1");
  const users = await query<{
    id: string;
    email: string;
    role: string;
    tier: string;
    disabled: boolean;
    free_markets_used: number;
    has_key: boolean;
  }>(
    `select u.id, u.email, p.role, p.tier, p.disabled, p.free_markets_used,
            exists(select 1 from kalshi_credentials c where c.user_id = u.id and c.environment = 'demo') as has_key
     from users u join profiles p on p.id = u.id
     order by u.created_at`,
  );
  const halt = settings[0]?.halt_live ?? false;
  return (
    <Shell email={user.email} admin>
      <h1 className="text-2xl font-semibold">Admin</h1>
      <form action={setHalt} className="mt-4">
        <input type="hidden" name="halt" value={halt ? "no" : "yes"} />
        <button className="rounded-lg border border-zinc-700 px-4 py-2 text-sm" type="submit">
          {halt ? "Live halt is on. Resume live orders." : "Halt live orders"}
        </button>
      </form>
      <p className="mt-2 text-xs text-zinc-500">This deploy only sends demo orders. The halt is stored for the live path.</p>
      <ul className="mt-6 space-y-3">
        {users.map((row) => (
          <li key={row.id} className="rounded-xl border border-zinc-800 px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">{row.email}</div>
                <div className="text-xs text-zinc-500">
                  {row.role} · {row.tier} · {row.disabled ? "disabled" : "active"} · demo key {row.has_key ? "yes" : "no"} · markets {row.free_markets_used}
                </div>
              </div>
              <div className="flex gap-2">
                <form action={setUserTier}>
                  <input type="hidden" name="userId" value={row.id} />
                  <input type="hidden" name="action" value="comp" />
                  <button className="rounded border border-zinc-700 px-2 py-1 text-xs" type="submit">Comp Pro</button>
                </form>
                <form action={setUserTier}>
                  <input type="hidden" name="userId" value={row.id} />
                  <input type="hidden" name="action" value="grant" />
                  <button className="rounded border border-zinc-700 px-2 py-1 text-xs" type="submit">Grant market</button>
                </form>
                <form action={setUserTier}>
                  <input type="hidden" name="userId" value={row.id} />
                  <input type="hidden" name="action" value="disable" />
                  <button className="rounded border border-zinc-700 px-2 py-1 text-xs" type="submit">Disable</button>
                </form>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
