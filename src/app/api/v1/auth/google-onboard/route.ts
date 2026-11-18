import crypto from "crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/index.ts";
import { organisationMemberships, organisations } from "@/db/schema.ts";
import { recordAuditEvent } from "@/server/audit.ts";
import {
  createAccessToken,
  getOrCreateFirebaseUser,
  verifyFirebaseBearerToken,
} from "@/server/auth.ts";
import { UserRole } from "@/server/enums.ts";

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "org";
  return base.slice(0, 90);
}

export async function POST(req: NextRequest) {
  try {
    const decoded = await verifyFirebaseBearerToken(req);
    if (!decoded) {
      return NextResponse.json({ detail: "Invalid or missing Google sign-in token." }, { status: 401 });
    }

    const payload = await req.json();
    const orgName = String(payload.organisation_name || "").trim();
    const country = String(payload.country || "Nigeria").trim();
    const fullNameInput = String(payload.full_name || decoded.name || "").trim();

    if (orgName.length < 2) {
      return NextResponse.json(
        { detail: "Organisation name must be at least 2 characters." },
        { status: 422 }
      );
    }

    const email = decoded.email || `${decoded.uid}@google.local`;
    const dbUser = await getOrCreateFirebaseUser(decoded.uid, email, fullNameInput);

    const existingMembership = await db
      .select()
      .from(organisationMemberships)
      .where(
        and(
          eq(organisationMemberships.userId, dbUser.id),
          isNull(organisationMemberships.deletedAt)
        )
      )
      .orderBy(desc(organisationMemberships.isDefault));

    if (existingMembership.length > 0) {
      const m = existingMembership[0];
      const role = m.role as UserRole;
      const accessToken = createAccessToken(dbUser.id, m.organisationId, role);
      return NextResponse.json({
        access_token: accessToken,
        token_type: "bearer",
        user_id: dbUser.id,
        organisation_id: m.organisationId,
        role,
      });
    }

    const slugBase = slugify(orgName);
    let slug = slugBase;
    let suffix = 1;
    while (
      (await db.select({ id: organisations.id }).from(organisations).where(eq(organisations.slug, slug)))
        .length > 0
    ) {
      suffix += 1;
      slug = `${slugBase}-${suffix}`;
    }

    const orgId = crypto.randomUUID();
    await db.insert(organisations).values({
      id: orgId,
      name: orgName,
      slug,
      country,
      aiProcessingAuthorized: false,
    });

    await db.insert(organisationMemberships).values({
      id: crypto.randomUUID(),
      organisationId: orgId,
      userId: dbUser.id,
      role: UserRole.ORG_ADMIN,
      isDefault: true,
      deletedAt: null,
    });

    await recordAuditEvent({
      organisation_id: orgId,
      actor_user_id: dbUser.id,
      event_type: "ORGANISATION_AND_ADMIN_REGISTERED_GOOGLE",
      entity_type: "organisation",
      entity_id: orgId,
      event_metadata: { email: dbUser.email },
    });

    const accessToken = createAccessToken(dbUser.id, orgId, UserRole.ORG_ADMIN);
    return NextResponse.json(
      {
        access_token: accessToken,
        token_type: "bearer",
        user_id: dbUser.id,
        organisation_id: orgId,
        role: UserRole.ORG_ADMIN,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Google onboarding failed:", error);
    return NextResponse.json(
      { detail: "Failed to create organisation for Google user." },
      { status: 500 }
    );
  }
}
