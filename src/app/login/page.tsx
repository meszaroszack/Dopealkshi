import Link from "next/link";
import { login } from "@/app/actions/auth";
import { Field, Notice, Shell } from "@/components/Shell";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <Shell>
      <h1 className="text-2xl font-semibold">Log in</h1>
      <Notice text={params.error} />
      <form action={login} className="mt-6 space-y-4">
        <Field label="Email" name="email" type="email" />
        <Field label="Password" name="password" type="password" />
        <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950" type="submit">
          Log in
        </button>
      </form>
      <p className="mt-4 text-sm text-zinc-400">
        No account yet? <Link href="/signup">Sign up</Link>
      </p>
    </Shell>
  );
}
