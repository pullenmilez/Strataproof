import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/server/auth";
import { ReviewStatus } from "@/server/enums";
import { getStore } from "@/server/store";

export async function GET(req: NextRequest) {
  const auth = getTenantContext(req);
  if ("error" in auth) return auth.error;

  const country = (req.nextUrl.searchParams.get("country") || "Nigeria").trim().toLowerCase();
  const store = getStore();

  const basins = Array.from(store.basins.values())
    .filter(
      (b) =>
        b.country.toLowerCase() === country &&
        (b.review_status === ReviewStatus.APPROVED ||
          b.review_status === ReviewStatus.CONDITIONALLY_APPROVED) &&
        b.deleted_at === null
    )
    .sort((a, b) => a.basin_name.localeCompare(b.basin_name));

  return NextResponse.json(basins);
}
