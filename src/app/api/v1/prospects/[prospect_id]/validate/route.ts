import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/server/auth";
import { UserRole } from "@/server/enums";
import { getStore, recordAuditEvent } from "@/server/store";
import { runDeterministicValidation } from "@/server/validationEngine";

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
    return NextResponse.json(
      { detail: "Prospect not found in your organisation." },
      { status: 404 }
    );
  }

  const run = runDeterministicValidation(prospect, user.id);
  recordAuditEvent({
    organisation_id: organisation.id,
    project_id: prospect.project_id,
    actor_user_id: user.id,
    event_type: "DETERMINISTIC_VALIDATION_EXECUTED",
    entity_type: "analysis_run",
    entity_id: run.id,
  });

  return NextResponse.json(run);
}
