import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/index.ts";
import { prospects } from "@/db/schema.ts";
import { ensureKnowledgeSeeded } from "@/db/seed.ts";
import { recordAuditEvent } from "@/server/audit.ts";
import { getTenantContext } from "@/server/auth.ts";
import { UserRole } from "@/server/enums.ts";
import { runPetroleumSystemFalsification } from "@/server/falsificationEngine.ts";

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
      return NextResponse.json(
        { detail: "Prospect not found in your organisation." },
        { status: 404 }
      );
    }

    const run = await runPetroleumSystemFalsification(prospect, user.id);
    await recordAuditEvent({
      organisation_id: organisation.id,
      project_id: prospect.projectId,
      actor_user_id: user.id,
      event_type: "FALSIFICATION_ANALYSIS_EXECUTED",
      entity_type: "analysis_run",
      entity_id: run.id,
    });

    return NextResponse.json(run);
  } catch (error) {
    console.error("Falsification analysis failed:", error);
    return NextResponse.json(
      { detail: "Falsification analysis failed. Please try again." },
      { status: 500 }
    );
  }
}
