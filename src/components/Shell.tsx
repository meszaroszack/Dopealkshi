import Link from "next/link";
import { logout } from "@/app/actions/auth";

export function Shell({
  email,
  admin,
  children,
}: {
  email?: string;
  admin?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-3xl px-4 py-6">
      <header className="mb-8 flex items-center justify-between gap-4">
        <Link href={email ? "/agents" : "/"} className="text-lg font-semibold tracking-tight">
          Dopealkshi
        </Link>
        {email ? (
          <nav className="flex items-center gap-4 text-sm text-zinc-300">
            <Link href="/agents">Agents</Link>
            <Link href="/kalshi">Kalshi</Link>
            {admin ? <Link href="/admin">Admin</Link> : null}
            <form action={logout}>
              <button className="text-zinc-400" type="submit">
                Log out
              </button>
            </form>
          </nav>
        ) : null}
      </header>
      {children}
    </div>
  );
}

export function Notice({ text }: { text?: string }) {
  if (!text) return null;
  return <p className="mb-4 rounded-lg border border-amber-700/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">{text}</p>;
}

export function Field({
  label,
  name,
  type = "text",
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm text-zinc-300">{label}</span>
      <input
        className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
        name={name}
        type={type}
        defaultValue={defaultValue}
        required
      />
      {hint ? <span className="mt-1 block text-xs text-zinc-500">{hint}</span> : null}
    </label>
  );
}
