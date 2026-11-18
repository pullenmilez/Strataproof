import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/index.ts";
import { petroleumSystemElements, prospects } from "@/db/schema.ts";
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
    const [prospect] = await db
      .select({ id: prospects.id })
      .from(prospects)
      .where(
        and(
          eq(prospects.id, prospect_id),
          eq(prospects.organisationId, organisation.id),
          isNull(prospects.deletedAt)
        )
      );

    if (!prospect) {
      return NextResponse.json(
        { detail: "Prospect not found in your organisation." },
        { status: 404 }
      );
    }

    const rows = await db
      .select()
      .from(petroleumSystemElements)
      .where(
        and(
          eq(petroleumSystemElements.prospectId, prospect_id),
          eq(petroleumSystemElements.organisationId, organisation.id)
        )
      );

    return NextResponse.json(
      rows.map((ps) => ({
        id: ps.id,
        element_type: ps.elementType,
        qualitative_status: ps.qualitativeStatus,
        status_rationale: ps.statusRationale,
        missing_evidence_summary: ps.missingEvidenceSummary,
        review_status: ps.reviewStatus,
      }))
    );
  } catch (error) {
    console.error("Failed to load petroleum system elements:", error);
    return NextResponse.json(
      { detail: "Failed to load petroleum system elements." },
      { status: 500 }
    );
  }
}
