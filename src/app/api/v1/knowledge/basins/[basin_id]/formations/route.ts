import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/index.ts";
import { formationRecords } from "@/db/schema.ts";
import { ensureKnowledgeSeeded } from "@/db/seed.ts";
import { getTenantContext } from "@/server/auth.ts";
import { ReviewStatus } from "@/server/enums.ts";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ basin_id: string }> }
) {
  const auth = await getTenantContext(req);
  if ("error" in auth) return auth.error;

  try {
    await ensureKnowledgeSeeded();
    const { basin_id } = await context.params;

    const rows = await db
      .select()
      .from(formationRecords)
      .where(
        and(
          eq(formationRecords.basinProfileId, basin_id),
          inArray(formationRecords.reviewStatus, [
            ReviewStatus.APPROVED,
            ReviewStatus.CONDITIONALLY_APPROVED,
          ]),
          isNull(formationRecords.deletedAt)
        )
      )
      .orderBy(asc(formationRecords.stratigraphicRankOrder));

    return NextResponse.json(
      rows.map((f) => ({
        id: f.id,
        basin_profile_id: f.basinProfileId,
        formation_name: f.formationName,
        recognized_aliases: f.recognizedAliases,
        stratigraphic_rank_order: f.stratigraphicRankOrder,
        age_range: f.ageRange,
        dominant_lithology: f.dominantLithology,
        petroleum_system_role: f.petroleumSystemRole,
      }))
    );
  } catch (error) {
    console.error("Failed to fetch formations:", error);
    return NextResponse.json(
      { detail: "Failed to fetch basin formations." },
      { status: 500 }
    );
  }
}
