import { redirect } from "next/navigation";
import { saveLiveKey } from "@/app/actions/app";
import { Notice, Shell } from "@/components/Shell";
import { currentUser } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

type Checklist = {
  pem?: boolean;
  balanceOk?: boolean;
  positionsOk?: boolean;
  probeOk?: boolean;
  balance?: number | null;
  message?: string;
};

export default async function KalshiPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const rows = await query<{ api_key_id: string; checklist: Checklist; last_balance: string | null }>(
    "select api_key_id, checklist, last_balance from kalshi_credentials where user_id = $1 and environment = 'live'",
    [user.id],
  );
  const cred = rows[0];
  const checklist = cred?.checklist ?? {};
  return (
    <Shell email={user.email} admin={user.role === "admin"}>
      <h1 className="text-2xl font-semibold">Kalshi</h1>
      <p className="mt-2 max-w-xl text-sm text-zinc-400">
        Paste a production key from kalshi.com. Dopealkshi reads your balance and positions on the live API. Paper orders stay on this server: dropped calls, 500s, and lagged reads. Run does not send a bet. The private key is encrypted and is not shown again.
      </p>
      <Notice text={params.error || params.message} />
      <ul className="mt-4 space-y-1 text-sm">
        <Check ok={checklist.pem} label="Private key parses" />
        <Check ok={checklist.balanceOk} label={cred?.last_balance ? `Balance $${Number(cred.last_balance).toFixed(2)}` : "Balance call"} />
        <Check ok={checklist.positionsOk} label="Positions call" />
        <Check ok={checklist.probeOk} label="Paper can drop a call, return 500, and lag a read" />
      </ul>
      <form action={saveLiveKey} className="mt-6 space-y-4">
        <label className="block text-sm">
          API key id
          <input className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2" name="keyId" defaultValue={cred?.api_key_id ?? ""} required />
        </label>
        <label className="block text-sm">
          Private key PEM
          <textarea className="mt-1 h-40 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs" name="pem" placeholder="Paste a new PEM to replace the saved key" required />
        </label>
        <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950" type="submit">
          Save and test
        </button>
      </form>
    </Shell>
  );
}

function Check({ ok, label }: { ok?: boolean; label: string }) {
  return (
    <li className={ok ? "text-emerald-400" : "text-zinc-500"}>
      {ok ? "Green" : "Waiting"} · {label}
    </li>
  );
}
