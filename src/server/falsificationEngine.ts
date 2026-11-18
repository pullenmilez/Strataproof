import crypto from "crypto";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "../db/index.ts";
import {
  analysisRuns,
  basinProfiles,
  claimEvidences,
  contradictions,
  falsificationHypotheses,
  geologicalClaims,
  investigations,
  knowledgeClaims,
  petroleumSystemElements,
} from "../db/schema.ts";
import {
  ALL_PETROLEUM_SYSTEM_ELEMENTS,
  PetroleumSystemElementType,
  ProcessingStatus,
  QualitativeStatus,
  ReviewStatus,
  SourceQualityTier,
} from "./enums.ts";

const DEFAULT_FAILURE_MODES: Record<PetroleumSystemElementType, [string, string]> = {
  [PetroleumSystemElementType.SOURCE_ROCK]: [
    "Absence of effective oil- or gas-prone source rock facies or insufficient organic richness (TOC/HI) within the prospect fetch area.",
    "Applicable across clastic and carbonate basins where source-rock lateral continuity is inferred from distant wells.",
  ],
  [PetroleumSystemElementType.THERMAL_MATURITY]: [
    "Insufficient burial depth or paleo-heat flow to bring source horizons into the hydrocarbon expulsion window.",
    "Critical on basin margins, structural highs, or inverted rift blocks with eroded overburden.",
  ],
  [PetroleumSystemElementType.RESERVOIR]: [
    "Reservoir pinch-out, diagenetic porosity occlusion, or shale-out across the mapped prospect closure.",
    "Applicable where reservoir presence is extrapolated from seismic amplitude or offset well logs.",
  ],
  [PetroleumSystemElementType.SEAL]: [
    "Top-seal capillary breakthrough or across-fault sand-on-sand juxtaposition allowing vertical/lateral hydrocarbon leakage.",
    "Critical in fault-bounded traps and stacked deltaic/rift sand-shale sequences.",
  ],
  [PetroleumSystemElementType.TRAP]: [
    "False structural closure caused by depth-conversion velocity pull-up or unmapped fault compartmentalization.",
    "Applies to all time-migrated seismic closures lacking dense checkshot/VSP velocity calibration.",
  ],
  [PetroleumSystemElementType.MIGRATION]: [
    "Shadow-zone isolation or lack of continuous carrier beds/fault conduits linking the mature kitchen to the trap.",
    "Applies where structural spill-points or intervening sealing faults divert charge away from the prospect.",
  ],
  [PetroleumSystemElementType.TIMING]: [
    "Trap-forming faulting or folding post-dated peak hydrocarbon expulsion from the kitchen.",
    "Critical in basins affected by multi-phase tectonic inversion or late growth-fault reactivation.",
  ],
  [PetroleumSystemElementType.PRESERVATION]: [
    "Post-entrapment tectonic uplift, fault reactivation breach, meteoric flushing, or severe biodegradation.",
    "Applies to shallow reservoirs (<1,500 m) and structurally inverted or reactivated fault blocks.",
  ],
};

const ELEMENT_DISCRIMINATION_WEIGHT: Record<PetroleumSystemElementType, number> = {
  [PetroleumSystemElementType.TRAP]: 100,
  [PetroleumSystemElementType.SEAL]: 95,
  [PetroleumSystemElementType.SOURCE_ROCK]: 90,
  [PetroleumSystemElementType.THERMAL_MATURITY]: 85,
  [PetroleumSystemElementType.TIMING]: 80,
  [PetroleumSystemElementType.MIGRATION]: 75,
  [PetroleumSystemElementType.RESERVOIR]: 70,
  [PetroleumSystemElementType.PRESERVATION]: 65,
};

const INVESTIGATION_TEMPLATES: Record<
  PetroleumSystemElementType,
  [string, string, string, string]
> = {
  [PetroleumSystemElementType.SOURCE_ROCK]: [
    "Source-Rock Organic Geochemistry & TOC/Rock-Eval Audit",
    "Determine whether effective oil- or gas-prone source facies (TOC, HI, kerogen type) exist within the fetch area.",
    "Rock-Eval pyrolysis, Total Organic Carbon (TOC), and maceral/biomarker analysis on ditch cuttings or sidewall cores.",
    "High feasibility using archived cuttings or regional offset well geochemical datasets.",
  ],
  [PetroleumSystemElementType.THERMAL_MATURITY]: [
    "1D/2D Burial History & Vitrinite Reflectance Calibration",
    "Test whether candidate source horizons entered and remained in the hydrocarbon generation window prior to trap formation.",
    "Vitrinite reflectance (%Ro), Tmax profiles, and corrected bottom-hole temperature (BHT) logs.",
    "High feasibility if offset well logs and temperature surveys are available.",
  ],
  [PetroleumSystemElementType.RESERVOIR]: [
    "Core / Petrophysical Net-Pay & Facies Continuity Verification",
    "Verify reservoir net-to-gross, effective porosity, permeability, and lateral sand/carbonate continuity across the prospect.",
    "Petrophysical log re-evaluation (GR, RHOB, NPHI, RT), core plug poroperm data, and seismic attribute/AVO calibration.",
    "High feasibility via existing LAS logs and seismic horizon attribute extraction.",
  ],
  [PetroleumSystemElementType.SEAL]: [
    "Top-Seal Capillary Entry Pressure & Across-Fault SGR Analysis",
    "Test whether top-seal shales and bounding faults can retain the proposed hydrocarbon column without capillary or mechanical breach.",
    "Shale Gouge Ratio (SGR) fault-seal modeling, pressure-depth (RFT/MDT) gradient plots, and caprock lithology logs.",
    "Moderate-to-high feasibility using fault-throw mapping and offset well pressure data.",
  ],
  [PetroleumSystemElementType.TRAP]: [
    "Depth-Conversion Velocity Sensitivity & Structural Closure Audit",
    "Verify that four-way dip or fault-dependent structural closure persists under plausible depth-conversion velocity models.",
    "Checkshot / VSP time-depth calibration, anisotropic depth migration velocity sensitivity, and fault-plane map audit.",
    "High feasibility prior to drill-decision commitment.",
  ],
  [PetroleumSystemElementType.MIGRATION]: [
    "Carrier-Bed & Fault-Conduit Migration Pathway Mapping",
    "Determine whether a continuous, geometrically valid migration pathway connects the mature kitchen to the prospect trap.",
    "Top-carrier-bed structural spill-point and fetch-area ray-tracing on depth-converted regional horizons.",
    "Moderate feasibility depending on regional 2D/3D seismic coverage.",
  ],
  [PetroleumSystemElementType.TIMING]: [
    "Structural Restoration vs. Peak Expulsion Timing Reconstruction",
    "Verify that trap closure existed prior to peak hydrocarbon expulsion from the kitchen.",
    "2D/3D structural flattening/restoration integrated with basin thermal-expulsion history.",
    "Moderate feasibility using interpreted stratigraphic horizons.",
  ],
  [PetroleumSystemElementType.PRESERVATION]: [
    "Post-Entrapment Uplift, Biodegradation & Fault-Reactivation Check",
    "Assess whether Neogene/Cenozoic uplift, meteoric flushing, biodegradation, or late fault reactivation breached or degraded hydrocarbons.",
    "Reservoir temperature/salinity screening, fluid-inclusion/oil-API offset comparison, and shallow seismic gas-chimney inspection.",
    "High feasibility using seismic amplitude anomalies and regional offset fluid properties.",
  ],
};

type ProspectRow = typeof import("../db/schema.ts").prospects.$inferSelect;
type HypothesisRow = typeof falsificationHypotheses.$inferSelect;

export async function runPetroleumSystemFalsification(
  prospect: ProspectRow,
  triggeredByUserId: string
) {
  try {
    const runId = crypto.randomUUID();
    const [run] = await db
      .insert(analysisRuns)
      .values({
        id: runId,
        organisationId: prospect.organisationId,
        prospectId: prospect.id,
        runType: "FALSIFICATION_ANALYSIS",
        triggeredBy: triggeredByUserId,
        executedRuleVersions: [{ engine: "petroleum_system_falsification", version: "v1.0.0" }],
        aiModelUsed: "deterministic-geological-synthesis-v1",
        status: ProcessingStatus.COMPLETED,
        startedAt: new Date(),
        completedAt: null,
      })
      .returning();

    const basinRows = prospect.basinProfileId
      ? await db
          .select()
          .from(basinProfiles)
          .where(eq(basinProfiles.id, prospect.basinProfileId))
      : [];
    const basinProfile = basinRows[0] ?? null;

    const allVerifiedKnowledge = await db
      .select()
      .from(knowledgeClaims)
      .where(
        and(
          inArray(knowledgeClaims.reviewStatus, [
            ReviewStatus.APPROVED,
            ReviewStatus.CONDITIONALLY_APPROVED,
          ]),
          ne(knowledgeClaims.sourceQualityTier, SourceQualityTier.QUARANTINED_UNVERIFIED)
        )
      );

    const verifiedCitations = allVerifiedKnowledge
      .filter(
        (kc) =>
          kc.country.toLowerCase() === prospect.country.toLowerCase() &&
          kc.basin.toLowerCase() === prospect.basinName.toLowerCase()
      )
      .slice(0, 10);

    const claims = await db
      .select()
      .from(geologicalClaims)
      .where(
        and(
          eq(geologicalClaims.prospectId, prospect.id),
          eq(geologicalClaims.organisationId, prospect.organisationId),
          isNull(geologicalClaims.deletedAt)
        )
      );

    const allLinks = await db
      .select()
      .from(claimEvidences)
      .where(eq(claimEvidences.organisationId, prospect.organisationId));

    const openContradictions = await db
      .select()
      .from(contradictions)
      .where(
        and(
          eq(contradictions.prospectId, prospect.id),
          eq(contradictions.organisationId, prospect.organisationId),
          isNull(contradictions.deletedAt)
        )
      );

    await db
      .delete(falsificationHypotheses)
      .where(
        and(
          eq(falsificationHypotheses.prospectId, prospect.id),
          eq(falsificationHypotheses.organisationId, prospect.organisationId),
          eq(falsificationHypotheses.reviewStatus, ReviewStatus.AI_SUGGESTED_PENDING_REVIEW)
        )
      );

    const existingPsElements = await db
      .select()
      .from(petroleumSystemElements)
      .where(
        and(
          eq(petroleumSystemElements.prospectId, prospect.id),
          eq(petroleumSystemElements.organisationId, prospect.organisationId)
        )
      );

    const hypothesesForRanking: Array<{
      hyp: HypothesisRow;
      elemType: PetroleumSystemElementType;
    }> = [];

    for (const elemType of ALL_PETROLEUM_SYSTEM_ELEMENTS) {
      const elemClaims = claims.filter((c) => c.petroleumSystemElement === elemType);
      const supportingIds: string[] = [];
      const opposingIds: string[] = [];

      for (const c of elemClaims) {
        for (const lk of allLinks) {
          if (lk.claimId === c.id) {
            if (lk.relationshipRole === "SUPPORTING") supportingIds.push(lk.evidenceId);
            else if (lk.relationshipRole === "OPPOSING") opposingIds.push(lk.evidenceId);
          }
        }
      }

      const elemContradictions = openContradictions.filter((ct) =>
        (ct.wellOrInterval || "").includes(elemType)
      );
      const missingItems: string[] = [];
      let statusVal: QualitativeStatus;
      let rationale: string;

      if (elemClaims.length === 0) {
        statusVal = QualitativeStatus.INSUFFICIENT_EVIDENCE;
        missingItems.push(`No geological claims registered for ${elemType}.`);
        rationale = `Insufficient evidence: zero geological claims or primary records evaluate ${elemType}.`;
      } else if (opposingIds.length > 0 && supportingIds.length > 0) {
        statusVal = QualitativeStatus.MIXED_EVIDENCE;
        rationale = `Mixed evidence: ${supportingIds.length} supporting and ${opposingIds.length} opposing evidence item(s) linked across ${elemClaims.length} claim(s).`;
      } else if (opposingIds.length > 0 || elemContradictions.length > 0) {
        statusVal = QualitativeStatus.CONTRADICTED;
        rationale = `Contradicted or contested: ${opposingIds.length} opposing evidence item(s) and ${elemContradictions.length} validation contradiction(s) affect ${elemType}.`;
      } else if (supportingIds.length > 0) {
        const allApproved = elemClaims.every((c) => c.reviewStatus === ReviewStatus.APPROVED);
        statusVal = allApproved
          ? QualitativeStatus.SUPPORTED
          : QualitativeStatus.PARTIALLY_SUPPORTED;
        if (!allApproved) {
          missingItems.push("One or more supporting claims have not yet completed peer review.");
        }
        rationale = `${statusVal}: backed by ${supportingIds.length} linked evidence item(s) across ${elemClaims.length} claim(s).`;
      } else {
        statusVal = QualitativeStatus.WEAKLY_SUPPORTED;
        missingItems.push(`Claims exist for ${elemType} but lack linked primary EvidenceItems.`);
        rationale = `Weakly supported: ${elemClaims.length} claim(s) stated without linked primary documentary evidence.`;
      }

      let psElem = existingPsElements.find((ps) => ps.elementType === elemType);
      if (!psElem) {
        const [inserted] = await db
          .insert(petroleumSystemElements)
          .values({
            id: crypto.randomUUID(),
            organisationId: prospect.organisationId,
            prospectId: prospect.id,
            elementType: elemType,
            qualitativeStatus: statusVal,
            statusRationale: rationale,
            missingEvidenceSummary: missingItems,
            reviewStatus: ReviewStatus.UNREVIEWED,
          })
          .returning();
        psElem = inserted;
      } else {
        const [updated] = await db
          .update(petroleumSystemElements)
          .set({
            qualitativeStatus: statusVal,
            statusRationale: rationale,
            missingEvidenceSummary: missingItems,
          })
          .where(eq(petroleumSystemElements.id, psElem.id))
          .returning();
        psElem = updated;
      }

      const [baseMechanism, baseRelevance] = DEFAULT_FAILURE_MODES[elemType];
      const relevance = basinProfile
        ? `${baseRelevance} Basin context (${basinProfile.basinName}): ${basinProfile.knownUncertaintiesAndGaps}`
        : baseRelevance;

      const kSourceIds = Array.from(
        new Set(verifiedCitations.flatMap((vc) => vc.sourceIds || []))
      );

      const [hyp] = await db
        .insert(falsificationHypotheses)
        .values({
          id: crypto.randomUUID(),
          organisationId: prospect.organisationId,
          prospectId: prospect.id,
          elementId: psElem.id,
          analysisRunId: run.id,
          proposedFailureMechanism: baseMechanism,
          geologicalApplicability: `${prospect.country} — ${prospect.basinName} (${elemType})`,
          relevanceConditions: relevance,
          missingEvidence: missingItems,
          knowledgeSourceIds: kSourceIds,
          confidenceRationale: `Qualitative assessment status is ${statusVal}. Grounded in ${supportingIds.length} supporting, ${opposingIds.length} opposing prospect evidence items, and ${verifiedCitations.length} verified regional knowledge record(s).`,
          isAiSuggested: true,
          reviewStatus: ReviewStatus.AI_SUGGESTED_PENDING_REVIEW,
          reviewedBy: null,
          reviewerNotes: null,
          deletedAt: null,
        })
        .returning();

      hypothesesForRanking.push({ hyp, elemType });
    }

    await db
      .delete(investigations)
      .where(
        and(
          eq(investigations.prospectId, prospect.id),
          eq(investigations.organisationId, prospect.organisationId)
        )
      );

    const scored = hypothesesForRanking
      .map(({ hyp, elemType }) => {
        const baseScore = ELEMENT_DISCRIMINATION_WEIGHT[elemType] ?? 50;
        const gapBonus = Math.min(hyp.missingEvidence.length * 4, 20);
        return { score: baseScore + gapBonus, hyp, elemType };
      })
      .sort((a, b) => b.score - a.score);

    await db.insert(investigations).values(
      scored.map((item, idx) => {
        const rank = idx + 1;
        const [title, obj, reqTest, feasibility] = INVESTIGATION_TEMPLATES[item.elemType];
        const decisionRel = rank <= 3 ? "CRITICAL" : rank <= 6 ? "HIGH" : "MODERATE";
        return {
          id: crypto.randomUUID(),
          organisationId: prospect.organisationId,
          prospectId: prospect.id,
          hypothesisId: item.hyp.id,
          title,
          discriminatingObjective: obj,
          requiredDataOrTest: reqTest,
          userSuppliedCostEstimate: null,
          userSuppliedTimeEstimate: null,
          technicalFeasibilityNote: feasibility,
          priorityRank: rank,
          decisionRelevance: decisionRel,
          discriminationPower: `Directly tests ${item.elemType} failure hypothesis (Rank #${rank})`,
          prioritisationRationale: `Ranked #${rank} based on structural/petroleum-system criticality of ${item.elemType} and ${item.hyp.missingEvidence.length} unresolved evidence gap(s). Cost and duration remain user-supplied.`,
        };
      })
    );

    const [updatedRun] = await db
      .update(analysisRuns)
      .set({ completedAt: new Date() })
      .where(eq(analysisRuns.id, run.id))
      .returning();

    return {
      id: updatedRun.id,
      prospect_id: updatedRun.prospectId,
      run_type: updatedRun.runType,
      status: updatedRun.status,
      executed_rule_versions: updatedRun.executedRuleVersions,
      ai_model_used: updatedRun.aiModelUsed,
      started_at: updatedRun.startedAt.toISOString(),
      completed_at: updatedRun.completedAt?.toISOString() ?? null,
    };
  } catch (error) {
    console.error("Falsification engine failed:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
