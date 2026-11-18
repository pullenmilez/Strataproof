import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAccessToken, hashPassword } from "@/server/auth";
import { UserRole } from "@/server/enums";
import { getStore, recordAuditEvent } from "@/server/store";

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

    const store = getStore();
    for (const u of store.users.values()) {
      if (u.email === email) {
        return NextResponse.json({ detail: "Email is already registered." }, { status: 409 });
      }
    }

    const slugBase = slugify(orgName);
    let slug = slugBase;
    let suffix = 1;
    const existingSlugs = new Set(Array.from(store.organisations.values()).map((o) => o.slug));
    while (existingSlugs.has(slug)) {
      suffix += 1;
      slug = `${slugBase}-${suffix}`;
    }

    const now = new Date().toISOString();
    const orgId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    store.organisations.set(orgId, {
      id: orgId,
      name: orgName,
      slug,
      country,
      ai_processing_authorized: false,
      created_at: now,
    });

    store.users.set(userId, {
      id: userId,
      email,
      full_name: fullName,
      password_hash: hashPassword(password),
      professional_credentials: professionalCredentials,
      is_active: true,
      created_at: now,
    });

    store.memberships.push({
      id: crypto.randomUUID(),
      organisation_id: orgId,
      user_id: userId,
      role: UserRole.ORG_ADMIN,
      is_default: true,
      deleted_at: null,
    });

    recordAuditEvent({
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
  } catch {
    return NextResponse.json({ detail: "Invalid registration payload." }, { status: 400 });
  }
}
