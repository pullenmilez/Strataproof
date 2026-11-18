import crypto from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/index.ts";
import { geologicalClaims, prospects } from "@/db/schema.ts";
import { recordAuditEvent } from "@/server/audit.ts";
import { getTenantContext } from "@/server/auth.ts";
import {
  ClaimClassification,
  PetroleumSystemElementType,
  QualitativeStatus,
  ReviewStatus,
  UserRole,
} from "@/server/enums.ts";

export async function POST(req: NextRequest) {
  const auth = await getTenantContext(req, [
    UserRole.ORG_ADMIN,
    UserRole.LEAD_GEOLOGIST,
    UserRole.GEOSCIENTIST,
  ]);
  if ("error" in auth) return auth.error;
  const { organisation, user } = auth.ctx;

  try {
    const payload = await req.json();
    const prospectId = String(payload.prospect_id || "");
    const geologicalElement = String(payload.geological_element || "").trim();
    const claimText = String(payload.claim_text || "").trim();
    const claimClassification = payload.claim_classification as ClaimClassification;
    const psElem = (payload.petroleum_system_element || null) as PetroleumSystemElementType | null;
    const isAiSuggested = Boolean(payload.is_ai_suggested);

    const [prospect] = await db
      .select()
      .from(prospects)
      .where(
        and(
          eq(prospects.id, prospectId),
          eq(prospects.organisationId, organisation.id),
          isNull(prospects.deletedAt)
        )
      );

    if (!prospect) {
      return NextResponse.json({ detail: "Prospect not found." }, { status: 404 });
    }

    if (geologicalElement.length < 2 || claimText.length < 5) {
      return NextResponse.json(
        { detail: "Geological element and claim text are required." },
        { status: 422 }
      );
    }

    const id = crypto.randomUUID();
    const [claim] = await db
      .insert(geologicalClaims)
      .values({
        id,
        organisationId: organisation.id,
        prospectId: prospect.id,
        geologicalElement,
        petroleumSystemElement: psElem,
        claimText,
        claimClassification,
        stratigraphicApplicability: payload.stratigraphic_applicability
          ? String(payload.stratigraphic_applicability)
          : null,
        spatialApplicability: payload.spatial_applicability
          ? String(payload.spatial_applicability)
          : null,
        conditionsAndLimitations: payload.conditions_and_limitations
          ? String(payload.conditions_and_limitations)
          : null,
        qualitativeStatus: QualitativeStatus.INSUFFICIENT_EVIDENCE,
        reviewStatus: isAiSuggested
          ? ReviewStatus.AI_SUGGESTED_PENDING_REVIEW
          : ReviewStatus.UNREVIEWED,
        isAiSuggested,
        currentRevision: 1,
        createdBy: user.id,
      })
      .returning();

    await recordAuditEvent({
      organisation_id: organisation.id,
      project_id: prospect.projectId,
      actor_user_id: user.id,
      event_type: "GEOLOGICAL_CLAIM_CREATED",
      entity_type: "geological_claim",
      entity_id: id,
      event_metadata: { classification: claimClassification },
    });

    return NextResponse.json(
      {
        id: claim.id,
        organisation_id: claim.organisationId,
        prospect_id: claim.prospectId,
        geological_element: claim.geologicalElement,
        petroleum_system_element: claim.petroleumSystemElement,
        claim_text: claim.claimText,
        claim_classification: claim.claimClassification,
        stratigraphic_applicability: claim.stratigraphicApplicability,
        spatial_applicability: claim.spatialApplicability,
        conditions_and_limitations: claim.conditionsAndLimitations,
        qualitative_status: claim.qualitativeStatus,
        review_status: claim.reviewStatus,
        is_ai_suggested: claim.isAiSuggested,
        current_revision: claim.currentRevision,
        created_at: claim.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create claim:", error);
    return NextResponse.json({ detail: "Failed to register geological claim." }, { status: 500 });
  }
}
