"use server";

import { redirect } from "next/navigation";
import { createSession, hashPassword, roleFor, verifyPassword, clearSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function signup(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!email.includes("@") || password.length < 8) {
    redirect("/signup?error=Use a real email and a password of at least 8 characters.");
  }
  const existing = await query<{ count: string }>("select count(*)::text as count from users");
  const role = roleFor(email, Number(existing[0]?.count ?? 0));
  let userId = "";
  try {
    const rows = await query<{ id: string }>(
      "insert into users (email, password_hash) values ($1, $2) returning id",
      [email, hashPassword(password)],
    );
    userId = rows[0].id;
    await query("insert into profiles (id, role) values ($1, $2)", [userId, role]);
  } catch {
    redirect("/signup?error=That email is already registered.");
  }
  await createSession(userId);
  redirect("/agents");
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const rows = await query<{ id: string; password_hash: string; disabled: boolean }>(
    `select u.id, u.password_hash, p.disabled
     from users u join profiles p on p.id = u.id
     where u.email = $1`,
    [email],
  );
  const user = rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) {
    redirect("/login?error=Email or password is wrong.");
  }
  if (user.disabled) redirect("/login?error=This account is disabled.");
  await createSession(user.id);
  redirect("/agents");
}

export async function logout() {
  await clearSession();
  redirect("/");
}
