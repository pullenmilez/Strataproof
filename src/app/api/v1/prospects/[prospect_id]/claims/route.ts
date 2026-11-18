import { and, desc, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/index.ts";
import { geologicalClaims } from "@/db/schema.ts";
import { getTenantContext } from "@/server/auth.ts";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ prospect_id: string }> }
) {
  const auth = await getTenantContext(req);
  if ("error" in auth) return auth.error;
  const { organisation } = auth.ctx;
  const { prospect_id } = await context.params;

  try {
    const rows = await db
      .select()
      .from(geologicalClaims)
      .where(
        and(
          eq(geologicalClaims.prospectId, prospect_id),
          eq(geologicalClaims.organisationId, organisation.id),
          isNull(geologicalClaims.deletedAt)
        )
      )
      .orderBy(desc(geologicalClaims.createdAt));

    return NextResponse.json(
      rows.map((c) => ({
        id: c.id,
        organisation_id: c.organisationId,
        prospect_id: c.prospectId,
        geological_element: c.geologicalElement,
        petroleum_system_element: c.petroleumSystemElement,
        claim_text: c.claimText,
        claim_classification: c.claimClassification,
        stratigraphic_applicability: c.stratigraphicApplicability,
        spatial_applicability: c.spatialApplicability,
        conditions_and_limitations: c.conditionsAndLimitations,
        qualitative_status: c.qualitativeStatus,
        review_status: c.reviewStatus,
        is_ai_suggested: c.isAiSuggested,
        current_revision: c.currentRevision,
        created_at: c.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("Failed to list claims:", error);
    return NextResponse.json({ detail: "Failed to load claims." }, { status: 500 });
  }
}
