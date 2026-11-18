import crypto from "crypto";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/index.ts";
import {
  organisationMemberships,
  organisations,
  users,
} from "@/db/schema.ts";
import { recordAuditEvent } from "@/server/audit.ts";
import { createAccessToken, hashPassword } from "@/server/auth.ts";
import { UserRole } from "@/server/enums.ts";

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "org";
  return base.slice(0, 90);
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const email = String(payload.email || "").toLowerCase().trim();
    const fullName = String(payload.full_name || "").trim();
    const password = String(payload.password || "");
    const orgName = String(payload.organisation_name || "").trim();
    const country = String(payload.country || "Nigeria").trim();
    const professionalCredentials = payload.professional_credentials
      ? String(payload.professional_credentials)
      : null;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ detail: "Valid email is required." }, { status: 422 });
    }
    if (fullName.length < 2) {
      return NextResponse.json({ detail: "Full name must be at least 2 characters." }, { status: 422 });
    }
    if (password.length < 10) {
      return NextResponse.json({ detail: "Password must be at least 10 characters." }, { status: 422 });
    }
    if (orgName.length < 2) {
      return NextResponse.json({ detail: "Organisation name is required." }, { status: 422 });
    }

    const existingUsers = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existingUsers.length > 0) {
      return NextResponse.json({ detail: "Email is already registered." }, { status: 409 });
    }

    const slugBase = slugify(orgName);
    let slug = slugBase;
    let suffix = 1;
    while ((await db.select({ id: organisations.id }).from(organisations).where(eq(organisations.slug, slug))).length > 0) {
      suffix += 1;
      slug = `${slugBase}-${suffix}`;
    }

    const orgId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    await db.insert(organisations).values({
      id: orgId,
      name: orgName,
      slug,
      country,
      aiProcessingAuthorized: false,
    });

    await db.insert(users).values({
      id: userId,
      uid: null,
      email,
      fullName,
      passwordHash: hashPassword(password),
      professionalCredentials,
      isActive: true,
    });

    await db.insert(organisationMemberships).values({
      id: crypto.randomUUID(),
      organisationId: orgId,
      userId,
      role: UserRole.ORG_ADMIN,
      isDefault: true,
      deletedAt: null,
    });

    await recordAuditEvent({
      organisation_id: orgId,
      actor_user_id: userId,
      event_type: "ORGANISATION_AND_ADMIN_REGISTERED",
      entity_type: "organisation",
      entity_id: orgId,
      event_metadata: { email },
    });

    const token = createAccessToken(userId, orgId, UserRole.ORG_ADMIN);
    return NextResponse.json(
      {
        access_token: token,
        token_type: "bearer",
        user_id: userId,
        organisation_id: orgId,
        role: UserRole.ORG_ADMIN,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration failed:", error);
    return NextResponse.json({ detail: "Registration failed. Please try again." }, { status: 500 });
  }
}
