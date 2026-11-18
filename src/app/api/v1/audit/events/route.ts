import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/index.ts";
import { auditEvents } from "@/db/schema.ts";
import { getTenantContext } from "@/server/auth.ts";

export async function GET(req: NextRequest) {
  const auth = await getTenantContext(req);
  if ("error" in auth) return auth.error;
  const { organisation } = auth.ctx;

  const limitParam = Number(req.nextUrl.searchParams.get("limit") || 100);
  const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 100, 1), 500);

  try {
    const events = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.organisationId, organisation.id))
      .orderBy(desc(auditEvents.occurredAt))
      .limit(limit);

    return NextResponse.json(
      events.map((ev) => ({
        id: ev.id,
        organisation_id: ev.organisationId,
        project_id: ev.projectId,
        actor_user_id: ev.actorUserId,
        event_type: ev.eventType,
        entity_type: ev.entityType,
        entity_id: ev.entityId,
        event_metadata: ev.eventMetadata,
        occurred_at: ev.occurredAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("Failed to load audit events:", error);
    return NextResponse.json(
      { detail: "Failed to load audit trail." },
      { status: 500 }
    );
  }
}
