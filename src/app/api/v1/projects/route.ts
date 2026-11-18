import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/server/auth";
import { UserRole } from "@/server/enums";
import { getStore, recordAuditEvent } from "@/server/store";

export async function GET(req: NextRequest) {
  const auth = getTenantContext(req);
  if ("error" in auth) return auth.error;
  const { organisation } = auth.ctx;

  const store = getStore();
  const projects = Array.from(store.projects.values())
    .filter((p) => p.organisation_id === organisation.id && p.deleted_at === null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const auth = getTenantContext(req, [
    UserRole.ORG_ADMIN,
    UserRole.LEAD_GEOLOGIST,
    UserRole.GEOSCIENTIST,
  ]);
  if ("error" in auth) return auth.error;
  const { organisation, user } = auth.ctx;

  const payload = await req.json();
  const name = String(payload.name || "").trim();
  const code = String(payload.code || "").trim().toUpperCase();
  const country = String(payload.country || "Nigeria").trim();
  const description = payload.description ? String(payload.description) : null;

  if (name.length < 2 || code.length < 2) {
    return NextResponse.json(
      { detail: "Project name and code must be at least 2 characters." },
      { status: 422 }
    );
  }

  const store = getStore();
  const id = crypto.randomUUID();
  const project = {
    id,
    organisation_id: organisation.id,
    name,
    code,
    country,
    description,
    created_by: user.id,
    created_at: new Date().toISOString(),
    deleted_at: null,
  };
  store.projects.set(id, project);

  recordAuditEvent({
    organisation_id: organisation.id,
    project_id: id,
    actor_user_id: user.id,
    event_type: "PROJECT_CREATED",
    entity_type: "project",
    entity_id: id,
    event_metadata: { code },
  });

  return NextResponse.json(project, { status: 201 });
}
