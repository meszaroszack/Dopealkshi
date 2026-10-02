import Link from "next/link";
import { Shell } from "@/components/Shell";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  let email: string | undefined;
  try {
    email = (await currentUser())?.email;
  } catch {
    email = undefined;
  }
  return (
    <Shell email={email}>
      <p className="text-sm uppercase tracking-[0.2em] text-emerald-400">15-minute BTC</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Your agent. Your dials. Real Kalshi tape.</h1>
      <p className="mt-4 max-w-xl text-zinc-300">
        Dopealkshi runs the Window rules on the live 15-minute Bitcoin market. You connect a production key so the reads are real. Paper mode simulates the order calls, including the ones that drop and come back late. It does not send a bet. Every cycle is a sentence from the rule that fired.
      </p>
      <div className="mt-8 flex gap-3">
        {email ? (
          <Link className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950" href="/agents">
            Open agents
          </Link>
        ) : (
          <>
            <Link className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950" href="/signup">
              Create an account
            </Link>
            <Link className="rounded-lg border border-zinc-700 px-4 py-2 text-sm" href="/login">
              Log in
            </Link>
          </>
        )}
      </div>
    </Shell>
  );
}
