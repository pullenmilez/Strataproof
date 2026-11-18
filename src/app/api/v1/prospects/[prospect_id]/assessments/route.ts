import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/index.ts";
import { prospects } from "@/db/schema.ts";
import { ensureKnowledgeSeeded } from "@/db/seed.ts";
import { recordAuditEvent } from "@/server/audit.ts";
import { createDownloadSignature, getTenantContext } from "@/server/auth.ts";
import { UserRole } from "@/server/enums.ts";
import { generateProspectAssessmentPdf } from "@/server/pdfGenerator.ts";

const DEFAULT_SCOPE =
  "This assessment evaluates documentary consistency, evidence support, and petroleum-system failure modes using verified prospect records and approved geological knowledge sources. It does not compute discovery probabilities, reserve volumes, or commercial economic valuations.";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ prospect_id: string }> }
) {
  const auth = await getTenantContext(req, [
    UserRole.ORG_ADMIN,
    UserRole.LEAD_GEOLOGIST,
    UserRole.GEOSCIENTIST,
  ]);
  if ("error" in auth) return auth.error;
  const { organisation, user } = auth.ctx;
  const { prospect_id } = await context.params;

  try {
    await ensureKnowledgeSeeded();

    const [prospect] = await db
      .select()
      .from(prospects)
      .where(
        and(
          eq(prospects.id, prospect_id),
          eq(prospects.organisationId, organisation.id),
          isNull(prospects.deletedAt)
        )
      );

    if (!prospect) {
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

    const av = await generateProspectAssessmentPdf({
      prospect,
      generatedByUser: user,
      title,
      scopeAndLimitations,
    });

    await recordAuditEvent({
      organisation_id: organisation.id,
      project_id: prospect.projectId,
      actor_user_id: user.id,
      event_type: "ASSESSMENT_PDF_GENERATED",
      entity_type: "assessment_version",
      entity_id: av.id,
      event_metadata: { version: av.versionNumber, pdf_sha256: av.pdfSha256 },
    });

    const sig = createDownloadSignature(av.id, organisation.id);

    return NextResponse.json(
      {
        id: av.id,
        assessment_id: av.assessmentId,
        version_number: av.versionNumber,
        pdf_sha256: av.pdfSha256,
        generated_at: av.generatedAt.toISOString(),
        download_url: `/api/v1/assessment-versions/${av.id}/download?sig=${encodeURIComponent(sig)}`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to generate assessment PDF:", error);
    return NextResponse.json(
      { detail: "Failed to generate assessment PDF report." },
      { status: 500 }
    );
  }
}
