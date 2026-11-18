import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/index.ts";
import { falsificationHypotheses, prospects } from "@/db/schema.ts";
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
      .from(falsificationHypotheses)
      .where(
        and(
          eq(falsificationHypotheses.prospectId, prospect_id),
          eq(falsificationHypotheses.organisationId, organisation.id),
          isNull(falsificationHypotheses.deletedAt)
        )
      );

    return NextResponse.json(
      rows.map((h) => ({
        id: h.id,
        element_id: h.elementId,
        proposed_failure_mechanism: h.proposedFailureMechanism,
        geological_applicability: h.geologicalApplicability,
        relevance_conditions: h.relevanceConditions,
        missing_evidence: h.missingEvidence,
        knowledge_source_ids: h.knowledgeSourceIds,
        confidence_rationale: h.confidenceRationale,
        is_ai_suggested: h.isAiSuggested,
        review_status: h.reviewStatus,
        reviewer_notes: h.reviewerNotes,
      }))
    );
  } catch (error) {
    console.error("Failed to load hypotheses:", error);
    return NextResponse.json({ detail: "Failed to load hypotheses." }, { status: 500 });
  }
}
