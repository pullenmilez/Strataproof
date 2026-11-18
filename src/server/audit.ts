import crypto from "crypto";
import { db } from "../db/index.ts";
import { auditEvents } from "../db/schema.ts";

export async function recordAuditEvent(params: {
  organisation_id: string;
  project_id?: string | null;
  actor_user_id?: string | null;
  event_type: string;
  entity_type: string;
  entity_id: string;
  event_metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(auditEvents).values({
      id: crypto.randomUUID(),
      organisationId: params.organisation_id,
      projectId: params.project_id ?? null,
      actorUserId: params.actor_user_id ?? null,
      eventType: params.event_type,
      entityType: params.entity_type,
      entityId: params.entity_id,
      eventMetadata: params.event_metadata ?? {},
      occurredAt: new Date(),
    });
  } catch (error) {
    console.error("Failed to record audit event:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
