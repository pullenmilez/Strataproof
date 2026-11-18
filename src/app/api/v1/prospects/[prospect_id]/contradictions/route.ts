import { and, desc, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/index.ts";
import { contradictions, prospects } from "@/db/schema.ts";
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
      .from(contradictions)
      .where(
        and(
          eq(contradictions.prospectId, prospect_id),
          eq(contradictions.organisationId, organisation.id),
          isNull(contradictions.deletedAt)
        )
      )
      .orderBy(desc(contradictions.createdAt));

    return NextResponse.json(
      rows.map((ct) => ({
        id: ct.id,
        category: ct.category,
        outcome_classification: ct.outcomeClassification,
        severity: ct.severity,
        well_or_interval: ct.wellOrInterval,
        first_value_raw: ct.firstValueRaw,
        second_value_raw: ct.secondValueRaw,
        units: ct.units,
        explanation: ct.explanation,
        possible_geological_causes: ct.possibleGeologicalCauses,
        review_status: ct.reviewStatus,
      }))
    );
  } catch (error) {
    console.error("Failed to list contradictions:", error);
    return NextResponse.json({ detail: "Failed to load contradictions." }, { status: 500 });
  }
}
