import { and, desc, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/index.ts";
import { organisationMemberships } from "@/db/schema.ts";
import {
  createAccessToken,
  getOrCreateFirebaseUser,
  verifyFirebaseBearerToken,
} from "@/server/auth.ts";
import { UserRole } from "@/server/enums.ts";

export async function POST(req: NextRequest) {
  try {
    const decoded = await verifyFirebaseBearerToken(req);
    if (!decoded) {
      return NextResponse.json({ detail: "Invalid or missing Google sign-in token." }, { status: 401 });
    }

    const email = decoded.email || `${decoded.uid}@google.local`;
    const dbUser = await getOrCreateFirebaseUser(decoded.uid, email, decoded.name);

    const [membership] = await db
      .select()
      .from(organisationMemberships)
      .where(
        and(
          eq(organisationMemberships.userId, dbUser.id),
          isNull(organisationMemberships.deletedAt)
        )
      )
      .orderBy(desc(organisationMemberships.isDefault));

    if (!membership) {
      return NextResponse.json({
        needs_onboarding: true,
        email: dbUser.email,
        full_name: dbUser.fullName,
      });
    }

    const role = membership.role as UserRole;
    const accessToken = createAccessToken(dbUser.id, membership.organisationId, role);

    return NextResponse.json({
      needs_onboarding: false,
      access_token: accessToken,
      token_type: "bearer",
      user_id: dbUser.id,
      organisation_id: membership.organisationId,
      role,
    });
  } catch (error) {
    console.error("Google session exchange failed:", error);
    return NextResponse.json(
      { detail: "Failed to verify Google sign-in session." },
      { status: 500 }
    );
  }
}
