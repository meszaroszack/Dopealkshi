import { redirect } from "next/navigation";
import { createAgent } from "@/app/actions/app";
import { Field, Notice, Shell } from "@/components/Shell";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewAgentPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  return (
    <Shell email={user.email} admin={user.role === "admin"}>
      <h1 className="text-2xl font-semibold">New Window agent</h1>
      <p className="mt-2 max-w-xl text-sm text-zinc-400">
        It watches the first three minutes, buys YES only between 28¢ and 72¢ after BTC has moved enough, and does not open a trade in the last 90 seconds. It starts paused, on your demo key.
      </p>
      <Notice text={params.error} />
      <form action={createAgent} className="mt-6 space-y-4">
        <Field label="Name" name="name" hint='Example: "Late window".' />
        <Field label="Size, dollars per trade" name="sizeDollars" type="number" defaultValue={5} />
        <Field label="Picky, minimum BTC move in dollars" name="moveEarly" type="number" defaultValue={60} hint="After minute 10 the required move doubles." />
        <Field label="Get out, take profit percent" name="takeProfitPct" type="number" defaultValue={35} />
        <Field label="Daily loss cap, dollars" name="dailyLossCap" type="number" defaultValue={25} />
        <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950" type="submit">
          Save agent
        </button>
      </form>
    </Shell>
  );
}
