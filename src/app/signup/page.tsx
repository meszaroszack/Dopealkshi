import Link from "next/link";
import { signup } from "@/app/actions/auth";
import { Field, Notice, Shell } from "@/components/Shell";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <Shell>
      <h1 className="text-2xl font-semibold">Create an account</h1>
      <p className="mt-2 text-sm text-zinc-400">The first account on an empty database is admin.</p>
      <Notice text={params.error} />
      <form action={signup} className="mt-6 space-y-4">
        <Field label="Email" name="email" type="email" />
        <Field label="Password" name="password" type="password" hint="At least 8 characters." />
        <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950" type="submit">
          Sign up
        </button>
      </form>
      <p className="mt-4 text-sm text-zinc-400">
        Already registered? <Link href="/login">Log in</Link>
      </p>
    </Shell>
  );
}
