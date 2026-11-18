import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/server/auth";
import {
  ClaimClassification,
  PetroleumSystemElementType,
  QualitativeStatus,
  ReviewStatus,
  UserRole,
} from "@/server/enums";
import { getStore, recordAuditEvent } from "@/server/store";

export async function POST(req: NextRequest) {
  const auth = getTenantContext(req, [
    UserRole.ORG_ADMIN,
    UserRole.LEAD_GEOLOGIST,
    UserRole.GEOSCIENTIST,
  ]);
  if ("error" in auth) return auth.error;
  const { organisation, user } = auth.ctx;

  const payload = await req.json();
  const prospectId = String(payload.prospect_id || "");
  const geologicalElement = String(payload.geological_element || "").trim();
  const claimText = String(payload.claim_text || "").trim();
  const claimClassification = payload.claim_classification as ClaimClassification;
  const psElem = (payload.petroleum_system_element || null) as PetroleumSystemElementType | null;
  const isAiSuggested = Boolean(payload.is_ai_suggested);

  const store = getStore();
  const prospect = store.prospects.get(prospectId);
  if (
    !prospect ||
    prospect.organisation_id !== organisation.id ||
    prospect.deleted_at !== null
  ) {
    return NextResponse.json({ detail: "Prospect not found." }, { status: 404 });
  }

  if (geologicalElement.length < 2 || claimText.length < 5) {
    return NextResponse.json(
      { detail: "Geological element and claim text are required." },
      { status: 422 }
    );
  }

  const id = crypto.randomUUID();
  const claim = {
    id,
    organisation_id: organisation.id,
    prospect_id: prospect.id,
    geological_element: geologicalElement,
    petroleum_system_element: psElem,
    claim_text: claimText,
    claim_classification: claimClassification,
    stratigraphic_applicability: payload.stratigraphic_applicability
      ? String(payload.stratigraphic_applicability)
      : null,
    spatial_applicability: payload.spatial_applicability
      ? String(payload.spatial_applicability)
      : null,
    conditions_and_limitations: payload.conditions_and_limitations
      ? String(payload.conditions_and_limitations)
      : null,
    qualitative_status: QualitativeStatus.INSUFFICIENT_EVIDENCE,
    review_status: isAiSuggested
      ? ReviewStatus.AI_SUGGESTED_PENDING_REVIEW
      : ReviewStatus.UNREVIEWED,
    is_ai_suggested: isAiSuggested,
    current_revision: 1,
    created_by: user.id,
    created_at: new Date().toISOString(),
    deleted_at: null,
  };
  store.claims.set(id, claim);

  recordAuditEvent({
    organisation_id: organisation.id,
    project_id: prospect.project_id,
    actor_user_id: user.id,
    event_type: "GEOLOGICAL_CLAIM_CREATED",
    entity_type: "geological_claim",
    entity_id: id,
    event_metadata: { classification: claimClassification },
  });

  return NextResponse.json(claim, { status: 201 });
}
