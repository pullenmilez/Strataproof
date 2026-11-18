import crypto from "crypto";
import {
  ClaimClassification,
  ContradictionOutcome,
  PetroleumSystemElementType,
  ProcessingStatus,
  QualitativeStatus,
  ReviewStatus,
  SeverityLevel,
} from "./enums";
import { AnalysisRun, Contradiction, getStore, Prospect, WellInterval } from "./store";

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

function checkStratigraphicOrderAndDepths(
  wellIdentifier: string,
  intervals: WellInterval[],
  formationRankMap: Map<string, number>
): CandidateContradiction[] {
  const findings: CandidateContradiction[] = [];
  if (intervals.length === 0) return findings;

  const unitsPresent = new Set(
    intervals.map((iv) => iv.depth_unit?.trim().toLowerCase()).filter(Boolean) as string[]
  );
  const datumsPresent = new Set(
    intervals.map((iv) => iv.depth_datum?.trim().toUpperCase()).filter(Boolean) as string[]
  );
  const typesPresent = new Set(
    intervals.map((iv) => iv.depth_type?.trim().toUpperCase()).filter(Boolean) as string[]
  );

  if (unitsPresent.size > 1) {
    const sortedU = Array.from(unitsPresent).sort();
    findings.push({
      rule_code: "RULE-DEPTH-UNIT-002",
      category: "DEPTH_UNIT_DATUM_INCONSISTENCY",
      outcome_classification: ContradictionOutcome.POTENTIAL_DATA_INCONSISTENCY,
      severity: SeverityLevel.HIGH,
      well_or_interval: wellIdentifier,
      first_source_location_id: intervals[0].source_location_id,
      second_source_location_id: intervals[intervals.length - 1].source_location_id,
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
      first_source_location_id: intervals[0].source_location_id,
      second_source_location_id: intervals[intervals.length - 1].source_location_id,
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
    if (iv.top_depth !== null && iv.bottom_depth !== null && iv.top_depth > iv.bottom_depth) {
      findings.push({
        rule_code: "RULE-STRAT-ORDER-001",
        category: "STRATIGRAPHIC_ORDER_CONTRADICTION",
        outcome_classification: ContradictionOutcome.CONFIRMED_DATA_ERROR,
        severity: SeverityLevel.CRITICAL,
        well_or_interval: `${wellIdentifier} :: ${iv.formation_name}`,
        first_source_location_id: iv.source_location_id,
        second_source_location_id: iv.source_location_id,
        affected_claim_ids: [],
        first_value_raw: `top=${iv.top_depth}`,
        second_value_raw: `bottom=${iv.bottom_depth}`,
        units: iv.depth_unit,
        explanation: `Formation '${iv.formation_name}' in well '${wellIdentifier}' has top depth (${iv.top_depth}) greater than bottom depth (${iv.bottom_depth}).`,
        possible_geological_causes: ["Inverted top/base depth entry in well-top table."],
      });
    }
  }

  const comparable = intervals
    .filter((iv) => iv.top_depth !== null)
    .sort((a, b) => (a.top_depth ?? 0) - (b.top_depth ?? 0));

  for (let i = 0; i < comparable.length - 1; i++) {
    const upper = comparable[i];
    const lower = comparable[i + 1];

    if (
      upper.depth_unit &&
      lower.depth_unit &&
      upper.depth_unit.trim().toLowerCase() !== lower.depth_unit.trim().toLowerCase()
    ) {
      continue;
    }

    if (
      upper.bottom_depth !== null &&
      lower.top_depth !== null &&
      lower.top_depth < upper.bottom_depth
    ) {
      findings.push({
        rule_code: "RULE-STRAT-ORDER-001",
        category: "STRATIGRAPHIC_ORDER_CONTRADICTION",
        outcome_classification: ContradictionOutcome.POTENTIAL_DATA_INCONSISTENCY,
        severity: SeverityLevel.HIGH,
        well_or_interval: `${wellIdentifier} :: ${upper.formation_name} / ${lower.formation_name}`,
        first_source_location_id: upper.source_location_id,
        second_source_location_id: lower.source_location_id,
        affected_claim_ids: [],
        first_value_raw: `${upper.formation_name} base=${upper.bottom_depth}`,
        second_value_raw: `${lower.formation_name} top=${lower.top_depth}`,
        units: upper.depth_unit,
        explanation: `Overlapping depth intervals in well '${wellIdentifier}': '${upper.formation_name}' base (${upper.bottom_depth}) is deeper than '${lower.formation_name}' top (${lower.top_depth}).`,
        possible_geological_causes: [
          "Duplicate or overlapping formation pick across multiple reports.",
          "Thrust fault repetition or overturned fold limb.",
        ],
      });
    }

    const rankUpper = formationRankMap.get(upper.formation_name.trim().toLowerCase());
    const rankLower = formationRankMap.get(lower.formation_name.trim().toLowerCase());
    if (rankUpper !== undefined && rankLower !== undefined && rankUpper > rankLower) {
      findings.push({
        rule_code: "RULE-STRAT-ORDER-001",
        category: "STRATIGRAPHIC_ORDER_CONTRADICTION",
        outcome_classification: ContradictionOutcome.GEOLOGICAL_INTERPRETATION_DISAGREEMENT,
        severity: SeverityLevel.CRITICAL,
        well_or_interval: `${wellIdentifier} :: ${upper.formation_name} over ${lower.formation_name}`,
        first_source_location_id: upper.source_location_id,
        second_source_location_id: lower.source_location_id,
        affected_claim_ids: [],
        first_value_raw: `${upper.formation_name} (rank ${rankUpper}, top=${upper.top_depth})`,
        second_value_raw: `${lower.formation_name} (rank ${rankLower}, top=${lower.top_depth})`,
        units: upper.depth_unit,
        explanation: `Stratigraphic order reversal in well '${wellIdentifier}': older formation '${upper.formation_name}' at ${upper.top_depth} overlies younger formation '${lower.formation_name}' at ${lower.top_depth}.`,
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

export function runDeterministicValidation(
  prospect: Prospect,
  triggeredByUserId: string
): AnalysisRun {
  const store = getStore();
  const startedAt = new Date().toISOString();

  const run: AnalysisRun = {
    id: crypto.randomUUID(),
    organisation_id: prospect.organisation_id,
    prospect_id: prospect.id,
    run_type: "DETERMINISTIC_VALIDATION",
    triggered_by: triggeredByUserId,
    executed_rule_versions: RULE_DEFINITIONS,
    ai_model_used: null,
    status: ProcessingStatus.COMPLETED,
    started_at: startedAt,
    completed_at: null,
  };
  store.analysisRuns.push(run);

  // Clear prior unreviewed deterministic contradictions on this prospect
  for (const [cid, ct] of store.contradictions.entries()) {
    if (
      ct.prospect_id === prospect.id &&
      ct.organisation_id === prospect.organisation_id &&
      ct.review_status === ReviewStatus.UNREVIEWED
    ) {
      store.contradictions.delete(cid);
    }
  }

  const candidates: CandidateContradiction[] = [];

  // Build formation rank lookup from curated Environment B library
  const formationRankMap = new Map<string, number>();
  const formationAgeMap = new Map<string, string>();
  if (prospect.basin_profile_id) {
    const fms = store.formations.filter(
      (f) =>
        f.basin_profile_id === prospect.basin_profile_id &&
        (f.review_status === ReviewStatus.APPROVED ||
          f.review_status === ReviewStatus.CONDITIONALLY_APPROVED)
    );
    for (const fm of fms) {
      if (fm.stratigraphic_rank_order !== null) {
        formationRankMap.set(fm.formation_name.trim().toLowerCase(), fm.stratigraphic_rank_order);
        for (const alias of fm.recognized_aliases || []) {
          formationRankMap.set(String(alias).trim().toLowerCase(), fm.stratigraphic_rank_order);
        }
      }
      if (fm.age_range) {
        formationAgeMap.set(fm.formation_name.trim().toLowerCase(), fm.age_range.toLowerCase());
      }
    }
  }

  // Checks A, B, C across wells & intervals
  const wells = Array.from(store.wells.values()).filter(
    (w) =>
      w.prospect_id === prospect.id &&
      w.organisation_id === prospect.organisation_id &&
      w.deleted_at === null
  );

  for (const well of wells) {
    const intervals = store.wellIntervals.filter(
      (iv) =>
        iv.well_id === well.id &&
        iv.organisation_id === prospect.organisation_id &&
        iv.deleted_at === null
    );
    candidates.push(
      ...checkStratigraphicOrderAndDepths(well.well_identifier, intervals, formationRankMap)
    );

    for (const iv of intervals) {
      const refAge = formationAgeMap.get(iv.formation_name.trim().toLowerCase());
      if (refAge && iv.reported_age) {
        const repLower = iv.reported_age.trim().toLowerCase();
        if (!refAge.includes(repLower) && !repLower.includes(refAge)) {
          candidates.push({
            rule_code: "RULE-CHRONO-BIO-003",
            category: "CHRONOSTRATIGRAPHIC_AGE_MISMATCH",
            outcome_classification: ContradictionOutcome.GEOLOGICAL_INTERPRETATION_DISAGREEMENT,
            severity: SeverityLevel.MODERATE,
            well_or_interval: `${well.well_identifier} :: ${iv.formation_name}`,
            first_source_location_id: iv.source_location_id,
            second_source_location_id: null,
            affected_claim_ids: [],
            first_value_raw: `reported_age=${iv.reported_age}`,
            second_value_raw: `reference_age=${refAge}`,
            units: null,
            explanation: `Reported age '${iv.reported_age}' for formation '${iv.formation_name}' in well '${well.well_identifier}' differs from curated regional age range '${refAge}'.`,
            possible_geological_causes: [
              "Diachronous formation boundary across depobelts (common in Niger Delta Akata/Agbada/Benin).",
              "Reworked palynomorphs/foraminifera or biostratigraphic zone re-interpretation.",
            ],
          });
        }
      }
    }
  }

  // Check D: GeologicalClaims evidence completeness
  const claims = Array.from(store.claims.values()).filter(
    (c) =>
      c.prospect_id === prospect.id &&
      c.organisation_id === prospect.organisation_id &&
      c.deleted_at === null
  );
  const coveredPsElements = new Set<PetroleumSystemElementType>();

  for (const cl of claims) {
    if (cl.petroleum_system_element) {
      coveredPsElements.add(cl.petroleum_system_element);
    }

    const links = store.claimEvidences.filter((lk) => lk.claim_id === cl.id);
    const supporting = links.filter((lk) => lk.relationship_role === "SUPPORTING");
    const opposing = links.filter((lk) => lk.relationship_role === "OPPOSING");

    if (opposing.length > 0 && supporting.length > 0) {
      cl.qualitative_status = QualitativeStatus.MIXED_EVIDENCE;
    } else if (opposing.length > 0) {
      cl.qualitative_status = QualitativeStatus.CONTRADICTED;
    } else if (supporting.length > 0) {
      cl.qualitative_status = QualitativeStatus.SUPPORTED;
    } else {
      cl.qualitative_status = QualitativeStatus.INSUFFICIENT_EVIDENCE;
    }

    if (supporting.length === 0) {
      const severity =
        cl.claim_classification === ClaimClassification.OBSERVATION ||
        cl.claim_classification === ClaimClassification.INTERPRETATION
          ? SeverityLevel.HIGH
          : SeverityLevel.MODERATE;

      candidates.push({
        rule_code: "RULE-CLAIM-EVID-004",
        category: "UNSUPPORTED_CLAIM_OR_ASSUMPTION",
        outcome_classification: ContradictionOutcome.MISSING_INFORMATION,
        severity,
        well_or_interval: cl.stratigraphic_applicability || cl.geological_element,
        first_source_location_id: null,
        second_source_location_id: null,
        affected_claim_ids: [cl.id],
        first_value_raw: `classification=${cl.claim_classification}`,
        second_value_raw: "supporting_evidence_count=0",
        units: null,
        explanation: `Claim '${cl.claim_text.slice(0, 140)}' (${cl.claim_classification}) has zero linked supporting evidence items in the Evidence Ledger.`,
        possible_geological_causes: [
          "Underlying well log, seismic horizon, or geochemical report has not yet been ingested or linked.",
        ],
      });
    }
  }

  // Check E / F / G: Missing critical petroleum system elements
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

  // Check H: Provenance & unverified extraction quality
  const needsHumanCount = store.extractedRecords.filter(
    (r) =>
      r.prospect_id === prospect.id &&
      r.organisation_id === prospect.organisation_id &&
      r.extraction_quality_label === "REQUIRES_HUMAN_CHECK" &&
      r.review_status === ReviewStatus.UNREVIEWED
  ).length;

  if (needsHumanCount > 0) {
    candidates.push({
      rule_code: "RULE-PROVENANCE-008",
      category: "PROVENANCE_AND_EXTRACTION_QUALITY",
      outcome_classification: ContradictionOutcome.MISSING_INFORMATION,
      severity: SeverityLevel.MODERATE,
      well_or_interval: "Ingested Prospect Records",
      first_source_location_id: null,
      second_source_location_id: null,
      affected_claim_ids: [],
      first_value_raw: `requires_human_check_records=${needsHumanCount}`,
      second_value_raw: "verified_records=0",
      units: null,
      explanation: `${needsHumanCount} extracted record(s) from OCR or unit-incomplete tables are flagged REQUIRES_HUMAN_CHECK and await geoscientist verification.`,
      possible_geological_causes: [
        "Scanned PDF pages or spreadsheets lacking explicit depth/measurement units.",
      ],
    });
  }

  const docCount = Array.from(store.documents.values()).filter(
    (d) =>
      d.prospect_id === prospect.id &&
      d.organisation_id === prospect.organisation_id &&
      d.deleted_at === null
  ).length;

  if (docCount === 0) {
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

  const now = new Date().toISOString();
  for (const cand of candidates) {
    const id = crypto.randomUUID();
    const record: Contradiction = {
      id,
      organisation_id: prospect.organisation_id,
      prospect_id: prospect.id,
      analysis_run_id: run.id,
      rule_code: cand.rule_code,
      category: cand.category,
      outcome_classification: cand.outcome_classification,
      severity: cand.severity,
      well_or_interval: cand.well_or_interval,
      first_source_location_id: cand.first_source_location_id,
      second_source_location_id: cand.second_source_location_id,
      affected_claim_ids: cand.affected_claim_ids,
      first_value_raw: cand.first_value_raw,
      second_value_raw: cand.second_value_raw,
      units: cand.units,
      explanation: cand.explanation,
      possible_geological_causes: cand.possible_geological_causes,
      review_status: ReviewStatus.UNREVIEWED,
      created_at: now,
      deleted_at: null,
    };
    store.contradictions.set(id, record);
  }

  run.completed_at = new Date().toISOString();
  return run;
}
