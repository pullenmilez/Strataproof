import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/server/auth";
import { getStore } from "@/server/store";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ prospect_id: string }> }
) {
  const auth = getTenantContext(req);
  if ("error" in auth) return auth.error;
  const { organisation } = auth.ctx;
  const { prospect_id } = await context.params;

  const store = getStore();
  const claims = Array.from(store.claims.values())
    .filter(
      (c) =>
        c.prospect_id === prospect_id &&
        c.organisation_id === organisation.id &&
        c.deleted_at === null
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return NextResponse.json(claims);
}
