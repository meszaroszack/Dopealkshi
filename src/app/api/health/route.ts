import { NextResponse } from "next/server";
import { getPool, migrate } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  let db = false;
  if (getPool()) {
    try {
      db = await migrate();
    } catch {
      db = false;
    }
  }
  return NextResponse.json({ ok: true, name: "Dopealkshi", db });
}
