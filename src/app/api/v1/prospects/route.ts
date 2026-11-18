import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/server/auth";
import { UserRole } from "@/server/enums";
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
  const projectId = String(payload.project_id || "");
  const name = String(payload.name || "").trim();
  const country = String(payload.country || "Nigeria").trim();
  const basinName = String(payload.basin_name || "").trim();

  const store = getStore();
  const project = store.projects.get(projectId);
  if (!project || project.organisation_id !== organisation.id || project.deleted_at !== null) {
    return NextResponse.json(
      { detail: "Project not found in your organisation." },
      { status: 404 }
    );
  }

  const basinProfile = Array.from(store.basins.values()).find(
    (b) =>
      b.country.toLowerCase() === country.toLowerCase() &&
      b.basin_name.toLowerCase() === basinName.toLowerCase() &&
      b.deleted_at === null
  );

  const id = crypto.randomUUID();
  const prospect = {
    id,
    organisation_id: organisation.id,
    project_id: project.id,
    name,
    block_or_licence: payload.block_or_licence ? String(payload.block_or_licence) : null,
    country,
    basin_name: basinName,
    sub_basin_or_province: payload.sub_basin_or_province
      ? String(payload.sub_basin_or_province)
      : null,
    basin_profile_id: basinProfile?.id ?? null,
    target_formations: Array.isArray(payload.target_formations)
      ? payload.target_formations.map(String)
      : [],
    description: payload.description ? String(payload.description) : null,
    created_by: user.id,
    created_at: new Date().toISOString(),
    deleted_at: null,
  };
  store.prospects.set(id, prospect);

  recordAuditEvent({
    organisation_id: organisation.id,
    project_id: project.id,
    actor_user_id: user.id,
    event_type: "PROSPECT_CREATED",
    entity_type: "prospect",
    entity_id: id,
    event_metadata: { basin_name: basinName },
  });

  return NextResponse.json(prospect, { status: 201 });
}
