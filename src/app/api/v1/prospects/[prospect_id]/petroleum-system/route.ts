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
  const prospect = store.prospects.get(prospect_id);
  if (
    !prospect ||
    prospect.organisation_id !== organisation.id ||
    prospect.deleted_at !== null
  ) {
    return NextResponse.json(
      { detail: "Prospect not found in your organisation." },
      { status: 404 }
    );
  }

  const elements = store.petroleumSystemElements.filter(
    (ps) => ps.prospect_id === prospect_id && ps.organisation_id === organisation.id
  );
  return NextResponse.json(elements);
}
