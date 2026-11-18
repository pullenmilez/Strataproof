import { and, asc, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/index.ts";
import { investigations, prospects } from "@/db/schema.ts";
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
      .from(investigations)
      .where(
        and(
          eq(investigations.prospectId, prospect_id),
          eq(investigations.organisationId, organisation.id)
        )
      )
      .orderBy(asc(investigations.priorityRank));

    return NextResponse.json(
      rows.map((inv) => ({
        id: inv.id,
        organisation_id: inv.organisationId,
        prospect_id: inv.prospectId,
        hypothesis_id: inv.hypothesisId,
        title: inv.title,
        discriminating_objective: inv.discriminatingObjective,
        required_data_or_test: inv.requiredDataOrTest,
        user_supplied_cost_estimate: inv.userSuppliedCostEstimate,
        user_supplied_time_estimate: inv.userSuppliedTimeEstimate,
        technical_feasibility_note: inv.technicalFeasibilityNote,
        priority_rank: inv.priorityRank,
        decision_relevance: inv.decisionRelevance,
        discrimination_power: inv.discriminationPower,
        prioritisation_rationale: inv.prioritisationRationale,
      }))
    );
  } catch (error) {
    console.error("Failed to load investigations:", error);
    return NextResponse.json(
      { detail: "Failed to load discriminating investigations." },
      { status: 500 }
    );
  }
}
