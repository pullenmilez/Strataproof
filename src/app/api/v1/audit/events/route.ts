import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/server/auth";
import { getStore } from "@/server/store";

export async function GET(req: NextRequest) {
  const auth = getTenantContext(req);
  if ("error" in auth) return auth.error;
  const { organisation } = auth.ctx;

  const limitParam = Number(req.nextUrl.searchParams.get("limit") || 100);
  const limit = Math.min(Math.max(limitParam, 1), 500);

  const store = getStore();
  const events = store.auditEvents
    .filter((ev) => ev.organisation_id === organisation.id)
    .slice(0, limit);

  return NextResponse.json(events);
}
