import { NextRequest, NextResponse } from "next/server";
import { createAccessToken, verifyPassword } from "@/server/auth";
import { getStore } from "@/server/store";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const email = String(payload.email || "").toLowerCase().trim();
    const password = String(payload.password || "");

    const store = getStore();
    const user = Array.from(store.users.values()).find(
      (u) => u.email === email && u.is_active
    );

    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json(
        { detail: "Invalid email or password." },
        { status: 401 }
      );
    }

    const membership = store.memberships
      .filter((m) => m.user_id === user.id && m.deleted_at === null)
      .sort((a, b) => Number(b.is_default) - Number(a.is_default))[0];

    if (!membership) {
      return NextResponse.json(
        { detail: "No active organisation membership found." },
        { status: 403 }
      );
    }

    const token = createAccessToken(
      user.id,
      membership.organisation_id,
      membership.role
    );

    return NextResponse.json({
      access_token: token,
      token_type: "bearer",
      user_id: user.id,
      organisation_id: membership.organisation_id,
      role: membership.role,
    });
  } catch {
    return NextResponse.json({ detail: "Invalid login payload." }, { status: 400 });
  }
}
