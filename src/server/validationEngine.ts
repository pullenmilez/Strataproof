import crypto from "crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db/index.ts";
import {
  analysisRuns,
  claimEvidences,
  contradictions,
  documents,
  extractedRecords,
  formationRecords,
  geologicalClaims,
  wellIntervals,
  wells,
} from "../db/schema.ts";
import {
  ClaimClassification,
  ContradictionOutcome,
  PetroleumSystemElementType,
  ProcessingStatus,
  QualitativeStatus,
  ReviewStatus,
  SeverityLevel,
} from "./enums.ts";

interface CandidateContradiction {
  rule_code: string;
  category: string;
  outcome_classification: ContradictionOutcome;
  severity: SeverityLevel;
  well_or_interval: string | null;
  first_source_location_id: string | null;
  second_source_location_id: string | null;
  affected_claim_ids: string[];
  first_value_raw: string;
  second_value_raw: string;
  units: string | null;
  explanation: string;
  possible_geological_causes: string[];
}

const RULE_DEFINITIONS = [
  { rule_code: "RULE-STRAT-ORDER-001", version: "v1.0.0" },
  { rule_code: "RULE-DEPTH-UNIT-002", version: "v1.0.0" },
  { rule_code: "RULE-CHRONO-BIO-003", version: "v1.0.0" },
  { rule_code: "RULE-CLAIM-EVID-004", version: "v1.0.0" },
  { rule_code: "RULE-SEAL-TRAP-005", version: "v1.0.0" },
  { rule_code: "RULE-SOURCE-MAT-006", version: "v1.0.0" },
  { rule_code: "RULE-PRES-TIMING-007", version: "v1.0.0" },
  { rule_code: "RULE-PROVENANCE-008", version: "v1.0.0" },
];

type WellIntervalRow = typeof wellIntervals.$inferSelect;
type ProspectRow = typeof import("../db/schema.ts").prospects.$inferSelect;

function checkStratigraphicOrderAndDepths(
  wellIdentifier: string,
  intervals: WellIntervalRow[],
  formationRankMap: Map<string, number>
): CandidateContradiction[] {
  const findings: CandidateContradiction[] = [];
  if (intervals.length === 0) return findings;

  const unitsPresent = new Set(
    intervals.map((iv) => iv.depthUnit?.trim().toLowerCase()).filter(Boolean) as string[]
  );
  const datumsPresent = new Set(
    intervals.map((iv) => iv.depthDatum?.trim().toUpperCase()).filter(Boolean) as string[]
  );
  const typesPresent = new Set(
    intervals.map((iv) => iv.depthType?.trim().toUpperCase()).filter(Boolean) as string[]
  );

  if (unitsPresent.size > 1) {
    const sortedU = Array.from(unitsPresent).sort();
    findings.push({
      rule_code: "RULE-DEPTH-UNIT-002",
      category: "DEPTH_UNIT_DATUM_INCONSISTENCY",
      outcome_classification: ContradictionOutcome.POTENTIAL_DATA_INCONSISTENCY,
      severity: SeverityLevel.HIGH,
      well_or_interval: wellIdentifier,
      first_source_location_id: intervals[0].sourceLocationId,
      second_source_location_id: intervals[intervals.length - 1].sourceLocationId,
      affected_claim_ids: [],
      first_value_raw: `units=${sortedU[0]}`,
      second_value_raw: `units=${sortedU[1]}`,
      units: "mixed",
      explanation: `Well '${wellIdentifier}' mixes incompatible depth units (${sortedU.join(", ")}) across reported intervals without explicit unit harmonization. Raw values are preserved without silent conversion.`,
      possible_geological_causes: [
        "Composite well-header / mud-log unit transcription mismatch (feet vs metres).",
      ],
    });
  }

  if (datumsPresent.size > 1 || typesPresent.size > 1) {
    findings.push({
      rule_code: "RULE-DEPTH-UNIT-002",
      category: "DEPTH_UNIT_DATUM_INCONSISTENCY",
      outcome_classification: ContradictionOutcome.POTENTIAL_DATA_INCONSISTENCY,
      severity: SeverityLevel.MODERATE,
      well_or_interval: wellIdentifier,
      first_source_location_id: intervals[0].sourceLocationId,
      second_source_location_id: intervals[intervals.length - 1].sourceLocationId,
      affected_claim_ids: [],
      first_value_raw: `datums=${JSON.stringify(Array.from(datumsPresent).sort())}, types=${JSON.stringify(Array.from(typesPresent).sort())}`,
      second_value_raw: "inconsistent reference datum/type",
      units: Array.from(unitsPresent)[0] ?? null,
      explanation: `Well '${wellIdentifier}' mixes depth reference datums (${Array.from(datumsPresent).sort().join(", ")}) or depth types (${Array.from(typesPresent).sort().join(", ")}) across stratigraphic picks.`,
      possible_geological_causes: [
        "KB vs MSL datum shift not normalized between legacy and modern well reports.",
      ],
    });
  }

  for (const iv of intervals) {
    if (iv.topDepth !== null && iv.bottomDepth !== null && iv.topDepth > iv.bottomDepth) {
      findings.push({
        rule_code: "RULE-STRAT-ORDER-001",
        category: "STRATIGRAPHIC_ORDER_CONTRADICTION",
        outcome_classification: ContradictionOutcome.CONFIRMED_DATA_ERROR,
        severity: SeverityLevel.CRITICAL,
        well_or_interval: `${wellIdentifier} :: ${iv.formationName}`,
        first_source_location_id: iv.sourceLocationId,
        second_source_location_id: iv.sourceLocationId,
        affected_claim_ids: [],
        first_value_raw: `top=${iv.topDepth}`,
        second_value_raw: `bottom=${iv.bottomDepth}`,
        units: iv.depthUnit,
        explanation: `Formation '${iv.formationName}' in well '${wellIdentifier}' has top depth (${iv.topDepth}) greater than bottom depth (${iv.bottomDepth}).`,
        possible_geological_causes: ["Inverted top/base depth entry in well-top table."],
      });
    }
  }

  const comparable = intervals
    .filter((iv) => iv.topDepth !== null)
    .sort((a, b) => (a.topDepth ?? 0) - (b.topDepth ?? 0));

  for (let i = 0; i < comparable.length - 1; i++) {
    const upper = comparable[i];
    const lower = comparable[i + 1];

    if (
      upper.depthUnit &&
      lower.depthUnit &&
      upper.depthUnit.trim().toLowerCase() !== lower.depthUnit.trim().toLowerCase()
    ) {
      continue;
    }

    if (
      upper.bottomDepth !== null &&
      lower.topDepth !== null &&
      lower.topDepth < upper.bottomDepth
    ) {
      findings.push({
        rule_code: "RULE-STRAT-ORDER-001",
        category: "STRATIGRAPHIC_ORDER_CONTRADICTION",
        outcome_classification: ContradictionOutcome.POTENTIAL_DATA_INCONSISTENCY,
        severity: SeverityLevel.HIGH,
        well_or_interval: `${wellIdentifier} :: ${upper.formationName} / ${lower.formationName}`,
        first_source_location_id: upper.sourceLocationId,
        second_source_location_id: lower.sourceLocationId,
        affected_claim_ids: [],
        first_value_raw: `${upper.formationName} base=${upper.bottomDepth}`,
        second_value_raw: `${lower.formationName} top=${lower.topDepth}`,
        units: upper.depthUnit,
        explanation: `Overlapping depth intervals in well '${wellIdentifier}': '${upper.formationName}' base (${upper.bottomDepth}) is deeper than '${lower.formationName}' top (${lower.topDepth}).`,
        possible_geological_causes: [
          "Duplicate or overlapping formation pick across multiple reports.",
          "Thrust fault repetition or overturned fold limb.",
        ],
      });
    }

    const rankUpper = formationRankMap.get(upper.formationName.trim().toLowerCase());
    const rankLower = formationRankMap.get(lower.formationName.trim().toLowerCase());
    if (rankUpper !== undefined && rankLower !== undefined && rankUpper > rankLower) {
      findings.push({
        rule_code: "RULE-STRAT-ORDER-001",
        category: "STRATIGRAPHIC_ORDER_CONTRADICTION",
        outcome_classification: ContradictionOutcome.GEOLOGICAL_INTERPRETATION_DISAGREEMENT,
        severity: SeverityLevel.CRITICAL,
        well_or_interval: `${wellIdentifier} :: ${upper.formationName} over ${lower.formationName}`,
        first_source_location_id: upper.sourceLocationId,
        second_source_location_id: lower.sourceLocationId,
        affected_claim_ids: [],
        first_value_raw: `${upper.formationName} (rank ${rankUpper}, top=${upper.topDepth})`,
        second_value_raw: `${lower.formationName} (rank ${rankLower}, top=${lower.topDepth})`,
        units: upper.depthUnit,
        explanation: `Stratigraphic order reversal in well '${wellIdentifier}': older formation '${upper.formationName}' at ${upper.topDepth} overlies younger formation '${lower.formationName}' at ${lower.topDepth}.`,
        possible_geological_causes: [
          "Reverse or thrust fault repetition (e.g., toe-thrust or inverted rift structure).",
          "Overturned stratigraphic limb.",
          "Misidentified formation top or biostratigraphic zone.",
        ],
      });
    }
  }

  return findings;
}

export async function runDeterministicValidation(
  prospect: ProspectRow,
  triggeredByUserId: string
) {
  try {
    const runId = crypto.randomUUID();
    const startedAt = new Date();

    const [run] = await db
      .insert(analysisRuns)
      .values({
        id: runId,
        organisationId: prospect.organisationId,
        prospectId: prospect.id,
        runType: "DETERMINISTIC_VALIDATION",
        triggeredBy: triggeredByUserId,
        executedRuleVersions: RULE_DEFINITIONS,
        aiModelUsed: null,
        status: ProcessingStatus.COMPLETED,
        startedAt,
        completedAt: null,
      })
      .returning();

    await db
      .delete(contradictions)
      .where(
        and(
          eq(contradictions.prospectId, prospect.id),
          eq(contradictions.organisationId, prospect.organisationId),
          eq(contradictions.reviewStatus, ReviewStatus.UNREVIEWED)
        )
      );

    const candidates: CandidateContradiction[] = [];

    const formationRankMap = new Map<string, number>();
    const formationAgeMap = new Map<string, string>();

    if (prospect.basinProfileId) {
      const fms = await db
        .select()
        .from(formationRecords)
        .where(
          and(
            eq(formationRecords.basinProfileId, prospect.basinProfileId),
            inArray(formationRecords.reviewStatus, [
              ReviewStatus.APPROVED,
              ReviewStatus.CONDITIONALLY_APPROVED,
            ])
          )
        );

      for (const fm of fms) {
        if (fm.stratigraphicRankOrder !== null) {
          formationRankMap.set(fm.formationName.trim().toLowerCase(), fm.stratigraphicRankOrder);
          for (const alias of fm.recognizedAliases || []) {
            formationRankMap.set(String(alias).trim().toLowerCase(), fm.stratigraphicRankOrder);
          }
        }
        if (fm.ageRange) {
          formationAgeMap.set(fm.formationName.trim().toLowerCase(), fm.ageRange.toLowerCase());
        }
      }
    }

    const prospectWells = await db
      .select()
      .from(wells)
      .where(
        and(
          eq(wells.prospectId, prospect.id),
          eq(wells.organisationId, prospect.organisationId),
          isNull(wells.deletedAt)
        )
      );

    for (const well of prospectWells) {
      const intervals = await db
        .select()
        .from(wellIntervals)
        .where(
          and(
            eq(wellIntervals.wellId, well.id),
            eq(wellIntervals.organisationId, prospect.organisationId),
            isNull(wellIntervals.deletedAt)
          )
        );

      candidates.push(
        ...checkStratigraphicOrderAndDepths(well.wellIdentifier, intervals, formationRankMap)
      );

      for (const iv of intervals) {
        const refAge = formationAgeMap.get(iv.formationName.trim().toLowerCase());
        if (refAge && iv.reportedAge) {
          const repLower = iv.reportedAge.trim().toLowerCase();
          if (!refAge.includes(repLower) && !repLower.includes(refAge)) {
            candidates.push({
              rule_code: "RULE-CHRONO-BIO-003",
              category: "CHRONOSTRATIGRAPHIC_AGE_MISMATCH",
              outcome_classification: ContradictionOutcome.GEOLOGICAL_INTERPRETATION_DISAGREEMENT,
              severity: SeverityLevel.MODERATE,
              well_or_interval: `${well.wellIdentifier} :: ${iv.formationName}`,
              first_source_location_id: iv.sourceLocationId,
              second_source_location_id: null,
              affected_claim_ids: [],
              first_value_raw: `reported_age=${iv.reportedAge}`,
              second_value_raw: `reference_age=${refAge}`,
              units: null,
              explanation: `Reported age '${iv.reportedAge}' for formation '${iv.formationName}' in well '${well.wellIdentifier}' differs from curated regional age range '${refAge}'.`,
              possible_geological_causes: [
                "Diachronous formation boundary across depobelts (common in Niger Delta Akata/Agbada/Benin).",
                "Reworked palynomorphs/foraminifera or biostratigraphic zone re-interpretation.",
              ],
            });
          }
        }
      }
    }

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

    const coveredPsElements = new Set<PetroleumSystemElementType>();

    for (const cl of claims) {
      if (cl.petroleumSystemElement) {
        coveredPsElements.add(cl.petroleumSystemElement as PetroleumSystemElementType);
      }

      const links = allLinks.filter((lk) => lk.claimId === cl.id);
      const supporting = links.filter((lk) => lk.relationshipRole === "SUPPORTING");
      const opposing = links.filter((lk) => lk.relationshipRole === "OPPOSING");

      let nextQualStatus = QualitativeStatus.INSUFFICIENT_EVIDENCE;
      if (opposing.length > 0 && supporting.length > 0) {
        nextQualStatus = QualitativeStatus.MIXED_EVIDENCE;
      } else if (opposing.length > 0) {
        nextQualStatus = QualitativeStatus.CONTRADICTED;
      } else if (supporting.length > 0) {
        nextQualStatus = QualitativeStatus.SUPPORTED;
      }

      await db
        .update(geologicalClaims)
        .set({ qualitativeStatus: nextQualStatus })
        .where(eq(geologicalClaims.id, cl.id));

      if (supporting.length === 0) {
        const severity =
          cl.claimClassification === ClaimClassification.OBSERVATION ||
          cl.claimClassification === ClaimClassification.INTERPRETATION
            ? SeverityLevel.HIGH
            : SeverityLevel.MODERATE;

        candidates.push({
          rule_code: "RULE-CLAIM-EVID-004",
          category: "UNSUPPORTED_CLAIM_OR_ASSUMPTION",
          outcome_classification: ContradictionOutcome.MISSING_INFORMATION,
          severity,
          well_or_interval: cl.stratigraphicApplicability || cl.geologicalElement,
          first_source_location_id: null,
          second_source_location_id: null,
          affected_claim_ids: [cl.id],
          first_value_raw: `classification=${cl.claimClassification}`,
          second_value_raw: "supporting_evidence_count=0",
          units: null,
          explanation: `Claim '${cl.claimText.slice(0, 140)}' (${cl.claimClassification}) has zero linked supporting evidence items in the Evidence Ledger.`,
          possible_geological_causes: [
            "Underlying well log, seismic horizon, or geochemical report has not yet been ingested or linked.",
          ],
        });
      }
    }

    const elementRuleMap: Array<[PetroleumSystemElementType, string, string]> = [
      [
        PetroleumSystemElementType.TRAP,
        "RULE-SEAL-TRAP-005",
        "No geological claims or evidence registered for Trap geometry/closure.",
      ],
      [
        PetroleumSystemElementType.SEAL,
        "RULE-SEAL-TRAP-005",
        "No geological claims or evidence registered for Top Seal or Fault Seal integrity.",
      ],
      [
        PetroleumSystemElementType.SOURCE_ROCK,
        "RULE-SOURCE-MAT-006",
        "No geological claims or evidence registered for Source Rock presence/TOC/kerogen.",
      ],
      [
        PetroleumSystemElementType.THERMAL_MATURITY,
        "RULE-SOURCE-MAT-006",
        "No geological claims or evidence registered for Thermal Maturity / burial window.",
      ],
      [
        PetroleumSystemElementType.TIMING,
        "RULE-PRES-TIMING-007",
        "No geological claims or evidence registered for Trap-vs-Charge relative timing.",
      ],
      [
        PetroleumSystemElementType.PRESERVATION,
        "RULE-PRES-TIMING-007",
        "No geological claims or evidence registered for Post-Entrapment Preservation / uplift / biodegradation.",
      ],
    ];

    for (const [elem, rcode, msg] of elementRuleMap) {
      if (!coveredPsElements.has(elem)) {
        candidates.push({
          rule_code: rcode,
          category: "MISSING_PETROLEUM_SYSTEM_EVIDENCE",
          outcome_classification: ContradictionOutcome.MISSING_INFORMATION,
          severity: SeverityLevel.HIGH,
          well_or_interval: elem,
          first_source_location_id: null,
          second_source_location_id: null,
          affected_claim_ids: [],
          first_value_raw: `element=${elem}`,
          second_value_raw: "registered_claims=0",
          units: null,
          explanation: msg,
          possible_geological_causes: [
            `Prospect evaluation dossier currently lacks explicit evidence covering ${elem}.`,
          ],
        });
      }
    }

    const humanCheckRecords = await db
      .select({ id: extractedRecords.id })
      .from(extractedRecords)
      .where(
        and(
          eq(extractedRecords.prospectId, prospect.id),
          eq(extractedRecords.organisationId, prospect.organisationId),
          eq(extractedRecords.extractionQualityLabel, "REQUIRES_HUMAN_CHECK"),
          eq(extractedRecords.reviewStatus, ReviewStatus.UNREVIEWED)
        )
      );

    if (humanCheckRecords.length > 0) {
      candidates.push({
        rule_code: "RULE-PROVENANCE-008",
        category: "PROVENANCE_AND_EXTRACTION_QUALITY",
        outcome_classification: ContradictionOutcome.MISSING_INFORMATION,
        severity: SeverityLevel.MODERATE,
        well_or_interval: "Ingested Prospect Records",
        first_source_location_id: null,
        second_source_location_id: null,
        affected_claim_ids: [],
        first_value_raw: `requires_human_check_records=${humanCheckRecords.length}`,
        second_value_raw: "verified_records=0",
        units: null,
        explanation: `${humanCheckRecords.length} extracted record(s) from OCR or unit-incomplete tables are flagged REQUIRES_HUMAN_CHECK and await geoscientist verification.`,
        possible_geological_causes: [
          "Scanned PDF pages or spreadsheets lacking explicit depth/measurement units.",
        ],
      });
    }

    const prospectDocs = await db
      .select({ id: documents.id })
      .from(documents)
      .where(
        and(
          eq(documents.prospectId, prospect.id),
          eq(documents.organisationId, prospect.organisationId),
          isNull(documents.deletedAt)
        )
      );

    if (prospectDocs.length === 0) {
      candidates.push({
        rule_code: "RULE-PROVENANCE-008",
        category: "PROVENANCE_AND_EXTRACTION_QUALITY",
        outcome_classification: ContradictionOutcome.MISSING_INFORMATION,
        severity: SeverityLevel.HIGH,
        well_or_interval: "Prospect Document Repository",
        first_source_location_id: null,
        second_source_location_id: null,
        affected_claim_ids: [],
        first_value_raw: "uploaded_documents=0",
        second_value_raw: "minimum_primary_documents>=1",
        units: null,
        explanation: "Prospect has zero uploaded primary geological documents in Environment A.",
        possible_geological_causes: [
          "No well reports, formation-top tables, or seismic summaries uploaded yet.",
        ],
      });
    }

    if (candidates.length > 0) {
      await db.insert(contradictions).values(
        candidates.map((cand) => ({
          id: crypto.randomUUID(),
          organisationId: prospect.organisationId,
          prospectId: prospect.id,
          analysisRunId: run.id,
          ruleCode: cand.rule_code,
          category: cand.category,
          outcomeClassification: cand.outcome_classification,
          severity: cand.severity,
          wellOrInterval: cand.well_or_interval,
          firstSourceLocationId: cand.first_source_location_id,
          secondSourceLocationId: cand.second_source_location_id,
          affectedClaimIds: cand.affected_claim_ids,
          firstValueRaw: cand.first_value_raw,
          secondValueRaw: cand.second_value_raw,
          units: cand.units,
          explanation: cand.explanation,
          possibleGeologicalCauses: cand.possible_geological_causes,
          reviewStatus: ReviewStatus.UNREVIEWED,
        }))
      );
    }

    const completedAt = new Date();
    const [updatedRun] = await db
      .update(analysisRuns)
      .set({ completedAt })
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
    console.error("Deterministic validation engine failed:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
