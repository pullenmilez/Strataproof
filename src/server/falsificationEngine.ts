import crypto from "crypto";
import {
  ALL_PETROLEUM_SYSTEM_ELEMENTS,
  PetroleumSystemElementType,
  ProcessingStatus,
  QualitativeStatus,
  ReviewStatus,
  SourceQualityTier,
} from "./enums";
import {
  AnalysisRun,
  FalsificationHypothesis,
  getStore,
  Investigation,
  PetroleumSystemElement,
  Prospect,
} from "./store";

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

export function runPetroleumSystemFalsification(
  prospect: Prospect,
  triggeredByUserId: string
): AnalysisRun {
  const store = getStore();
  const startedAt = new Date().toISOString();

  const run: AnalysisRun = {
    id: crypto.randomUUID(),
    organisation_id: prospect.organisation_id,
    prospect_id: prospect.id,
    run_type: "FALSIFICATION_ANALYSIS",
    triggered_by: triggeredByUserId,
    executed_rule_versions: [{ engine: "petroleum_system_falsification", version: "v1.0.0" }],
    ai_model_used: "deterministic-geological-synthesis-v1",
    status: ProcessingStatus.COMPLETED,
    started_at: startedAt,
    completed_at: null,
  };
  store.analysisRuns.push(run);

  const basinProfile = prospect.basin_profile_id
    ? store.basins.get(prospect.basin_profile_id) ?? null
    : null;

  // Strict APPROVED/CONDITIONALLY_APPROVED retrieval gating from Environment B
  const verifiedCitations = Array.from(store.knowledgeClaims.values())
    .filter(
      (kc) =>
        kc.country.toLowerCase() === prospect.country.toLowerCase() &&
        kc.basin.toLowerCase() === prospect.basin_name.toLowerCase() &&
        (kc.review_status === ReviewStatus.APPROVED ||
          kc.review_status === ReviewStatus.CONDITIONALLY_APPROVED) &&
        kc.source_quality_tier !== SourceQualityTier.QUARANTINED_UNVERIFIED
    )
    .slice(0, 10);

  const claims = Array.from(store.claims.values()).filter(
    (c) =>
      c.prospect_id === prospect.id &&
      c.organisation_id === prospect.organisation_id &&
      c.deleted_at === null
  );

  const openContradictions = Array.from(store.contradictions.values()).filter(
    (ct) =>
      ct.prospect_id === prospect.id &&
      ct.organisation_id === prospect.organisation_id &&
      ct.deleted_at === null
  );

  // Clear prior unreviewed hypotheses for clean re-run
  for (const [hid, h] of store.hypotheses.entries()) {
    if (
      h.prospect_id === prospect.id &&
      h.organisation_id === prospect.organisation_id &&
      h.review_status === ReviewStatus.AI_SUGGESTED_PENDING_REVIEW
    ) {
      store.hypotheses.delete(hid);
    }
  }

  const hypothesesForRanking: Array<{
    hyp: FalsificationHypothesis;
    elemType: PetroleumSystemElementType;
  }> = [];

  for (const elemType of ALL_PETROLEUM_SYSTEM_ELEMENTS) {
    const elemClaims = claims.filter((c) => c.petroleum_system_element === elemType);
    const supportingIds: string[] = [];
    const opposingIds: string[] = [];

    for (const c of elemClaims) {
      for (const lk of store.claimEvidences) {
        if (lk.claim_id === c.id) {
          if (lk.relationship_role === "SUPPORTING") supportingIds.push(lk.evidence_id);
          else if (lk.relationship_role === "OPPOSING") opposingIds.push(lk.evidence_id);
        }
      }
    }

    const elemContradictions = openContradictions.filter((ct) =>
      (ct.well_or_interval || "").includes(elemType)
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
      const allApproved = elemClaims.every((c) => c.review_status === ReviewStatus.APPROVED);
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

    let psElem = store.petroleumSystemElements.find(
      (ps) => ps.prospect_id === prospect.id && ps.element_type === elemType
    );
    if (!psElem) {
      psElem = {
        id: crypto.randomUUID(),
        organisation_id: prospect.organisation_id,
        prospect_id: prospect.id,
        element_type: elemType,
        qualitative_status: statusVal,
        status_rationale: rationale,
        missing_evidence_summary: missingItems,
        review_status: ReviewStatus.UNREVIEWED,
      };
      store.petroleumSystemElements.push(psElem);
    } else {
      psElem.qualitative_status = statusVal;
      psElem.status_rationale = rationale;
      psElem.missing_evidence_summary = missingItems;
    }

    const [baseMechanism, baseRelevance] = DEFAULT_FAILURE_MODES[elemType];
    const relevance = basinProfile
      ? `${baseRelevance} Basin context (${basinProfile.basin_name}): ${basinProfile.known_uncertainties_and_gaps}`
      : baseRelevance;

    const kSourceIds = Array.from(
      new Set(verifiedCitations.flatMap((vc) => vc.source_ids || []))
    );

    const hypId = crypto.randomUUID();
    const hyp: FalsificationHypothesis = {
      id: hypId,
      organisation_id: prospect.organisation_id,
      prospect_id: prospect.id,
      element_id: psElem.id,
      analysis_run_id: run.id,
      proposed_failure_mechanism: baseMechanism,
      geological_applicability: `${prospect.country} — ${prospect.basin_name} (${elemType})`,
      relevance_conditions: relevance,
      missing_evidence: missingItems,
      knowledge_source_ids: kSourceIds,
      confidence_rationale: `Qualitative assessment status is ${statusVal}. Grounded in ${supportingIds.length} supporting, ${opposingIds.length} opposing prospect evidence items, and ${verifiedCitations.length} verified regional knowledge record(s).`,
      is_ai_suggested: true,
      review_status: ReviewStatus.AI_SUGGESTED_PENDING_REVIEW,
      reviewed_by: null,
      reviewer_notes: null,
      deleted_at: null,
    };
    store.hypotheses.set(hypId, hyp);
    hypothesesForRanking.push({ hyp, elemType });
  }

  // Generate & rank discriminating investigations
  store.investigations = store.investigations.filter(
    (inv) =>
      !(inv.prospect_id === prospect.id && inv.organisation_id === prospect.organisation_id)
  );

  const scored = hypothesesForRanking
    .map(({ hyp, elemType }) => {
      const baseScore = ELEMENT_DISCRIMINATION_WEIGHT[elemType] ?? 50;
      const gapBonus = Math.min(hyp.missing_evidence.length * 4, 20);
      return { score: baseScore + gapBonus, hyp, elemType };
    })
    .sort((a, b) => b.score - a.score);

  scored.forEach((item, idx) => {
    const rank = idx + 1;
    const [title, obj, reqTest, feasibility] = INVESTIGATION_TEMPLATES[item.elemType];
    const decisionRel = rank <= 3 ? "CRITICAL" : rank <= 6 ? "HIGH" : "MODERATE";

    const inv: Investigation = {
      id: crypto.randomUUID(),
      organisation_id: prospect.organisation_id,
      prospect_id: prospect.id,
      hypothesis_id: item.hyp.id,
      title,
      discriminating_objective: obj,
      required_data_or_test: reqTest,
      user_supplied_cost_estimate: null,
      user_supplied_time_estimate: null,
      technical_feasibility_note: feasibility,
      priority_rank: rank,
      decision_relevance: decisionRel,
      discrimination_power: `Directly tests ${item.elemType} failure hypothesis (Rank #${rank})`,
      prioritisation_rationale: `Ranked #${rank} based on structural/petroleum-system criticality of ${item.elemType} and ${item.hyp.missing_evidence.length} unresolved evidence gap(s). Cost and duration remain user-supplied.`,
    };
    store.investigations.push(inv);
  });

  run.completed_at = new Date().toISOString();
  return run;
}
