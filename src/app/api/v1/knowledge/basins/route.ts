import { and, asc, ilike, inArray, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/index.ts";
import { basinProfiles } from "@/db/schema.ts";
import { ensureKnowledgeSeeded } from "@/db/seed.ts";
import { getTenantContext } from "@/server/auth.ts";
import { ReviewStatus } from "@/server/enums.ts";

export async function GET(req: NextRequest) {
  const auth = await getTenantContext(req);
  if ("error" in auth) return auth.error;

  try {
    await ensureKnowledgeSeeded();
    const country = (req.nextUrl.searchParams.get("country") || "Nigeria").trim();

    const rows = await db
      .select()
      .from(basinProfiles)
      .where(
        and(
          ilike(basinProfiles.country, country),
          inArray(basinProfiles.reviewStatus, [
            ReviewStatus.APPROVED,
            ReviewStatus.CONDITIONALLY_APPROVED,
          ]),
          isNull(basinProfiles.deletedAt)
        )
      )
      .orderBy(asc(basinProfiles.basinName));

    return NextResponse.json(
      rows.map((b) => ({
        id: b.id,
        country: b.country,
        basin_name: b.basinName,
        basin_category: b.basinCategory,
        sub_basins_or_provinces: b.subBasinsOrProvinces,
        tectonic_summary: b.tectonicSummary,
        stratigraphic_overview: b.stratigraphicOverview,
        known_uncertainties_and_gaps: b.knownUncertaintiesAndGaps,
        review_status: b.reviewStatus,
      }))
    );
  } catch (error) {
    console.error("Failed to list basin profiles:", error);
    return NextResponse.json(
      { detail: "Failed to load curated basin profiles." },
      { status: 500 }
    );
  }
}
