import { and, desc, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/index.ts";
import { organisationMemberships, users } from "@/db/schema.ts";
import { createAccessToken, verifyPassword } from "@/server/auth.ts";
import { UserRole } from "@/server/enums.ts";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const email = String(payload.email || "").toLowerCase().trim();
    const password = String(payload.password || "");

    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.isActive, true)));

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ detail: "Invalid email or password." }, { status: 401 });
    }

    const [membership] = await db
      .select()
      .from(organisationMemberships)
      .where(
        and(
          eq(organisationMemberships.userId, user.id),
          isNull(organisationMemberships.deletedAt)
        )
      )
      .orderBy(desc(organisationMemberships.isDefault));

    if (!membership) {
      return NextResponse.json(
        { detail: "No active organisation membership found." },
        { status: 403 }
      );
    }

    const role = membership.role as UserRole;
    const token = createAccessToken(user.id, membership.organisationId, role);

    return NextResponse.json({
      access_token: token,
      token_type: "bearer",
      user_id: user.id,
      organisation_id: membership.organisationId,
      role,
    });
  } catch (error) {
    console.error("Login failed:", error);
    return NextResponse.json({ detail: "Login failed. Please try again." }, { status: 500 });
  }
}
