import { NextRequest, NextResponse } from "next/server";
import { createDownloadSignature, getTenantContext } from "@/server/auth";
import { UserRole } from "@/server/enums";
import { generateProspectAssessmentPdf } from "@/server/pdfGenerator";
import { getStore, recordAuditEvent } from "@/server/store";

const DEFAULT_SCOPE =
  "This assessment evaluates documentary consistency, evidence support, and petroleum-system failure modes using verified prospect records and approved geological knowledge sources. It does not compute discovery probabilities, reserve volumes, or commercial economic valuations.";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ prospect_id: string }> }
) {
  const auth = getTenantContext(req, [
    UserRole.ORG_ADMIN,
    UserRole.LEAD_GEOLOGIST,
    UserRole.GEOSCIENTIST,
  ]);
  if ("error" in auth) return auth.error;
  const { organisation, user } = auth.ctx;
  const { prospect_id } = await context.params;

  const store = getStore();
  const prospect = store.prospects.get(prospect_id);
  if (
    !prospect ||
    prospect.organisation_id !== organisation.id ||
    prospect.deleted_at !== null
  ) {
    return NextResponse.json({ detail: "Prospect not found." }, { status: 404 });
  }

  const payload = await req.json().catch(() => ({}));
  const title =
    typeof payload.title === "string" && payload.title.trim().length >= 5
      ? payload.title.trim()
      : "Prospect Geological Assurance & Falsification Assessment";
  const scopeAndLimitations =
    typeof payload.scope_and_limitations === "string" &&
    payload.scope_and_limitations.trim().length >= 10
      ? payload.scope_and_limitations.trim()
      : DEFAULT_SCOPE;

  const av = generateProspectAssessmentPdf({
    prospect,
    generatedByUser: user,
    title,
    scopeAndLimitations,
  });

  recordAuditEvent({
    organisation_id: organisation.id,
    project_id: prospect.project_id,
    actor_user_id: user.id,
    event_type: "ASSESSMENT_PDF_GENERATED",
    entity_type: "assessment_version",
    entity_id: av.id,
    event_metadata: { version: av.version_number, pdf_sha256: av.pdf_sha256 },
  });

  const sig = createDownloadSignature(av.id, organisation.id);

  return NextResponse.json(
    {
      id: av.id,
      assessment_id: av.assessment_id,
      version_number: av.version_number,
      pdf_sha256: av.pdf_sha256,
      generated_at: av.generated_at,
      download_url: `/api/v1/assessment-versions/${av.id}/download?sig=${encodeURIComponent(sig)}`,
    },
    { status: 201 }
  );
}
