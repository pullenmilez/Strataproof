import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/index.ts";
import { prospects } from "@/db/schema.ts";
import { getTenantContext } from "@/server/auth.ts";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ prospect_id: string }> }
) {
  const auth = await getTenantContext(req);
  if ("error" in auth) return auth.error;
  const { organisation } = auth.ctx;
  const { prospect_id } = await context.params;

  try {
    const [prospect] = await db
      .select()
      .from(prospects)
      .where(
        and(
          eq(prospects.id, prospect_id),
          eq(prospects.organisationId, organisation.id),
          isNull(prospects.deletedAt)
        )
      );

    if (!prospect) {
      return NextResponse.json({ detail: "Prospect not found." }, { status: 404 });
    }

    return NextResponse.json({
      id: prospect.id,
      organisation_id: prospect.organisationId,
      project_id: prospect.projectId,
      name: prospect.name,
      block_or_licence: prospect.blockOrLicence,
      country: prospect.country,
      basin_name: prospect.basinName,
      sub_basin_or_province: prospect.subBasinOrProvince,
      target_formations: prospect.targetFormations,
      description: prospect.description,
      created_at: prospect.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Failed to get prospect:", error);
    return NextResponse.json({ detail: "Failed to fetch prospect." }, { status: 500 });
  }
}
