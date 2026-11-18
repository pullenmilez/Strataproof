import crypto from "crypto";
import { and, ilike, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/index.ts";
import {
  basinProfiles,
  geologicalClaims,
  projects,
  prospects,
  wellIntervals,
  wells,
} from "@/db/schema.ts";
import { ensureKnowledgeSeeded } from "@/db/seed.ts";
import { recordAuditEvent } from "@/server/audit.ts";
import { getTenantContext } from "@/server/auth.ts";
import {
  ClaimClassification,
  PetroleumSystemElementType,
  QualitativeStatus,
  ReviewStatus,
  UserRole,
} from "@/server/enums.ts";

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

    const [nigerDelta] = await db
      .select()
      .from(basinProfiles)
      .where(
        and(
          ilike(basinProfiles.country, "Nigeria"),
          ilike(basinProfiles.basinName, "Niger Delta Basin"),
          isNull(basinProfiles.deletedAt)
        )
      );

    const projectId = crypto.randomUUID();
    const suffix = projectId.slice(0, 4).toUpperCase();
    await db.insert(projects).values({
      id: projectId,
      organisationId: organisation.id,
      name: `OML-99 Sample Assurance (${suffix})`,
      code: `OML99-${suffix}`,
      country: "Nigeria",
      description:
        "Sample Niger Delta exploration project seeded with well-interval inconsistencies for assurance testing.",
      createdBy: user.id,
    });

    const prospectId = crypto.randomUUID();
    const [prospect] = await db
      .insert(prospects)
      .values({
        id: prospectId,
        organisationId: organisation.id,
        projectId,
        name: "Bonga-South Sample Prospect",
        blockOrLicence: "OML-99",
        country: "Nigeria",
        basinName: "Niger Delta Basin",
        subBasinOrProvince: "Deepwater / Offshore Depobelt",
        basinProfileId: nigerDelta?.id ?? null,
        targetFormations: ["Benin Formation", "Agbada Formation", "Akata Formation"],
        description:
          "Sample Niger Delta prospect containing mixed m/ft units, stratigraphic inversion, and an unsupported seal assumption.",
        createdBy: user.id,
      })
      .returning();

    const wellId = crypto.randomUUID();
    await db.insert(wells).values({
      id: wellId,
      organisationId: organisation.id,
      prospectId,
      wellIdentifier: "BONGA-S1",
      totalDepthRaw: 3950,
      depthUnit: "m",
      depthDatum: "KB",
      coordinateSystem: "WGS84 / UTM Zone 32N",
    });

    await db.insert(wellIntervals).values([
      {
        id: crypto.randomUUID(),
        organisationId: organisation.id,
        wellId,
        formationName: "Akata Formation",
        topDepth: 1800,
        bottomDepth: 2200,
        depthType: "MD",
        depthUnit: "m",
        depthDatum: "KB",
        reportedAge: "Paleocene - Recent",
        lithologySummary: "Overpressured marine prodelta shale",
      },
      {
        id: crypto.randomUUID(),
        organisationId: organisation.id,
        wellId,
        formationName: "Benin Formation",
        topDepth: 2300,
        bottomDepth: 7500,
        depthUnit: "ft",
        depthType: "MD",
        depthDatum: "MSL",
        reportedAge: "Oligocene - Recent",
        lithologySummary: "Continental fluvial coastal plain sandstone",
      },
    ]);

    await db.insert(geologicalClaims).values({
      id: crypto.randomUUID(),
      organisationId: organisation.id,
      prospectId,
      geologicalElement: "Fault Seal Capacity",
      petroleumSystemElement: PetroleumSystemElementType.SEAL,
      claimText:
        "Bounding growth fault provides a continuous lateral pressure seal across the Agbada target reservoir without capillary leakage.",
      claimClassification: ClaimClassification.ASSUMPTION,
      stratigraphicApplicability: "Agbada Formation",
      qualitativeStatus: QualitativeStatus.INSUFFICIENT_EVIDENCE,
      reviewStatus: ReviewStatus.UNREVIEWED,
      isAiSuggested: false,
      currentRevision: 1,
      createdBy: user.id,
    });

    await recordAuditEvent({
      organisation_id: organisation.id,
      project_id: projectId,
      actor_user_id: user.id,
      event_type: "SAMPLE_PROSPECT_SEEDED",
      entity_type: "prospect",
      entity_id: prospectId,
      event_metadata: { well: "BONGA-S1", basin: "Niger Delta Basin" },
    });

    return NextResponse.json(
      {
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
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to load sample prospect:", error);
    return NextResponse.json(
      { detail: "Failed to load sample Niger Delta prospect." },
      { status: 500 }
    );
  }
}
