import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/server/auth";
import { ReviewStatus } from "@/server/enums";
import { getStore } from "@/server/store";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ basin_id: string }> }
) {
  const auth = getTenantContext(req);
  if ("error" in auth) return auth.error;

  const { basin_id } = await context.params;
  const store = getStore();

  const formations = store.formations
    .filter(
      (f) =>
        f.basin_profile_id === basin_id &&
        (f.review_status === ReviewStatus.APPROVED ||
          f.review_status === ReviewStatus.CONDITIONALLY_APPROVED) &&
        f.deleted_at === null
    )
    .sort(
      (a, b) =>
        (a.stratigraphic_rank_order ?? 999) - (b.stratigraphic_rank_order ?? 999)
    );

  return NextResponse.json(formations);
}
