import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/server/auth";

export async function GET(req: NextRequest) {
  const auth = getTenantContext(req);
  if ("error" in auth) return auth.error;
  const { user, organisation, role } = auth.ctx;

  return NextResponse.json({
    user_id: user.id,
    email: user.email,
    full_name: user.full_name,
    professional_credentials: user.professional_credentials,
    organisation_id: organisation.id,
    organisation_name: organisation.name,
    role,
  });
}
