import crypto from "crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/index.ts";
import { projects } from "@/db/schema.ts";
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
      .from(projects)
      .where(and(eq(projects.organisationId, organisation.id), isNull(projects.deletedAt)))
      .orderBy(desc(projects.createdAt));

    return NextResponse.json(
      rows.map((p) => ({
        id: p.id,
        organisation_id: p.organisationId,
        name: p.name,
        code: p.code,
        country: p.country,
        description: p.description,
        created_at: p.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("Failed to list projects:", error);
    return NextResponse.json({ detail: "Failed to list projects." }, { status: 500 });
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

    const id = crypto.randomUUID();
    const [p] = await db
      .insert(projects)
      .values({
        id,
        organisationId: organisation.id,
        name,
        code,
        country,
        description,
        createdBy: user.id,
      })
      .returning();

    await recordAuditEvent({
      organisation_id: organisation.id,
      project_id: id,
      actor_user_id: user.id,
      event_type: "PROJECT_CREATED",
      entity_type: "project",
      entity_id: id,
      event_metadata: { code },
    });

    return NextResponse.json(
      {
        id: p.id,
        organisation_id: p.organisationId,
        name: p.name,
        code: p.code,
        country: p.country,
        description: p.description,
        created_at: p.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json({ detail: "Failed to create project." }, { status: 500 });
  }
}
