import crypto from "crypto";
import { and, desc, eq, ilike, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/index.ts";
import { basinProfiles, projects, prospects } from "@/db/schema.ts";
import { ensureKnowledgeSeeded } from "@/db/seed.ts";
import { recordAuditEvent } from "@/server/audit.ts";
import { getTenantContext } from "@/server/auth.ts";
import { UserRole } from "@/server/enums.ts";

export async function GET(req: NextRequest) {
  const auth = await getTenantContext(req);
  if ("error" in auth) return auth.error;
  const { organisation } = auth.ctx;

  try {
    const rows = await db
      .select()
      .from(prospects)
      .where(
        and(eq(prospects.organisationId, organisation.id), isNull(prospects.deletedAt))
      )
      .orderBy(desc(prospects.createdAt));

    return NextResponse.json(
      rows.map((p) => ({
        id: p.id,
        organisation_id: p.organisationId,
        project_id: p.projectId,
        name: p.name,
        block_or_licence: p.blockOrLicence,
        country: p.country,
        basin_name: p.basinName,
        sub_basin_or_province: p.subBasinOrProvince,
        target_formations: p.targetFormations,
        description: p.description,
        created_at: p.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("Failed to list prospects:", error);
    return NextResponse.json({ detail: "Failed to list prospects." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await getTenantContext(req, [
    UserRole.ORG_ADMIN,
    UserRole.LEAD_GEOLOGIST,
    UserRole.GEOSCIENTIST,
  ]);
  if ("error" in auth) return auth.error;
  const { organisation, user } = auth.ctx;

  try {
    await ensureKnowledgeSeeded();
    const payload = await req.json();
    const projectId = String(payload.project_id || "");
    const name = String(payload.name || "").trim();
    const country = String(payload.country || "Nigeria").trim();
    const basinName = String(payload.basin_name || "").trim();

    const [project] = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.organisationId, organisation.id),
          isNull(projects.deletedAt)
        )
      );

    if (!project) {
      return NextResponse.json(
        { detail: "Project not found in your organisation." },
        { status: 404 }
      );
    }

    const [basinProfile] = await db
      .select()
      .from(basinProfiles)
      .where(
        and(
          ilike(basinProfiles.country, country),
          ilike(basinProfiles.basinName, basinName),
          isNull(basinProfiles.deletedAt)
        )
      );

    const id = crypto.randomUUID();
    const [prosp] = await db
      .insert(prospects)
      .values({
        id,
        organisationId: organisation.id,
        projectId: project.id,
        name,
        blockOrLicence: payload.block_or_licence ? String(payload.block_or_licence) : null,
        country,
        basinName,
        subBasinOrProvince: payload.sub_basin_or_province
          ? String(payload.sub_basin_or_province)
          : null,
        basinProfileId: basinProfile?.id ?? null,
        targetFormations: Array.isArray(payload.target_formations)
          ? payload.target_formations.map(String)
          : [],
        description: payload.description ? String(payload.description) : null,
        createdBy: user.id,
      })
      .returning();

    await recordAuditEvent({
      organisation_id: organisation.id,
      project_id: project.id,
      actor_user_id: user.id,
      event_type: "PROSPECT_CREATED",
      entity_type: "prospect",
      entity_id: id,
      event_metadata: { basin_name: basinName },
    });

    return NextResponse.json(
      {
        id: prosp.id,
        organisation_id: prosp.organisationId,
        project_id: prosp.projectId,
        name: prosp.name,
        block_or_licence: prosp.blockOrLicence,
        country: prosp.country,
        basin_name: prosp.basinName,
        sub_basin_or_province: prosp.subBasinOrProvince,
        target_formations: prosp.targetFormations,
        description: prosp.description,
        created_at: prosp.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create prospect:", error);
    return NextResponse.json({ detail: "Failed to create prospect." }, { status: 500 });
  }
}
