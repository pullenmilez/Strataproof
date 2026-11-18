import crypto from "crypto";
import { jsPDF } from "jspdf";
import { ReviewStatus } from "./enums";
import { AssessmentVersion, getStore, Prospect, User } from "./store";

export function generateProspectAssessmentPdf(params: {
  prospect: Prospect;
  generatedByUser: User;
  title: string;
  scopeAndLimitations: string;
}): AssessmentVersion {
  const store = getStore();
  const { prospect, generatedByUser, title, scopeAndLimitations } = params;

  const org = store.organisations.get(prospect.organisation_id);
  const project = store.projects.get(prospect.project_id);
  const basin = prospect.basin_profile_id
    ? store.basins.get(prospect.basin_profile_id)
    : undefined;

  const docs = Array.from(store.documents.values()).filter(
    (d) => d.prospect_id === prospect.id && d.deleted_at === null
  );
  const docIds = new Set(docs.map((d) => d.id));
  const docVersions = Array.from(store.documentVersions.values()).filter((dv) =>
    docIds.has(dv.document_id)
  );
  const wells = Array.from(store.wells.values()).filter(
    (w) => w.prospect_id === prospect.id && w.deleted_at === null
  );
  const claims = Array.from(store.claims.values()).filter(
    (c) => c.prospect_id === prospect.id && c.deleted_at === null
  );
  const evidences = Array.from(store.evidenceItems.values()).filter(
    (e) => e.prospect_id === prospect.id && e.deleted_at === null
  );
  const contradictions = Array.from(store.contradictions.values()).filter(
    (ct) => ct.prospect_id === prospect.id && ct.deleted_at === null
  );
  const psElements = store.petroleumSystemElements.filter(
    (ps) => ps.prospect_id === prospect.id
  );
  const hypotheses = Array.from(store.hypotheses.values()).filter(
    (h) => h.prospect_id === prospect.id && h.deleted_at === null
  );
  const investigations = store.investigations
    .filter((inv) => inv.prospect_id === prospect.id)
    .sort((a, b) => a.priority_rank - b.priority_rank);
  const runs = store.analysisRuns.filter((r) => r.prospect_id === prospect.id);
  const knowledgeSources = Array.from(store.knowledgeSources.values()).filter(
    (ks) =>
      ks.verification_status === ReviewStatus.APPROVED ||
      ks.verification_status === ReviewStatus.CONDITIONALLY_APPROVED ||
      ks.verification_status === ReviewStatus.DISPUTED
  );

  const generatedAt = new Date().toISOString();
  const obsCount = claims.filter((c) => c.claim_classification === "OBSERVATION").length;
  const interpCount = claims.filter((c) => c.claim_classification === "INTERPRETATION").length;
  const assumpCount = claims.filter((c) => c.claim_classification === "ASSUMPTION").length;
  const predCount = claims.filter((c) => c.claim_classification === "PREDICTION").length;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const maxWidth = pageWidth - margin * 2;
  let y = 18;

  const ensureSpace = (needed = 12) => {
    if (y + needed > 280) {
      doc.addPage();
      y = 18;
    }
  };

  const addHeading = (text: string) => {
    ensureSpace(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 41, 66);
    doc.text(text, margin, y);
    y += 5;
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
  };

  const addBody = (text: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    for (const line of lines) {
      ensureSpace(6);
      doc.text(line, margin, y);
      y += 4.5;
    }
    y += 2;
  };

  // Cover Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(180, 83, 9);
  doc.text("STRATAPROOF - GEOLOGICAL EVIDENCE-ASSURANCE & FALSIFICATION REPORT", margin, y);
  y += 7;
  doc.setFontSize(16);
  doc.setTextColor(15, 41, 66);
  const titleLines = doc.splitTextToSize(title, maxWidth) as string[];
  for (const tl of titleLines) {
    doc.text(tl, margin, y);
    y += 7;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  addBody(
    `Organisation: ${org?.name ?? ""} | Project: ${project?.name ?? ""} (${project?.code ?? ""})\n` +
      `Prospect: ${prospect.name} | Basin / Country: ${prospect.basin_name}, ${prospect.country} | Block/Licence: ${prospect.block_or_licence ?? "-"}\n` +
      `Generated UTC: ${generatedAt} | Prepared By: ${generatedByUser.full_name}`
  );

  // 20 Sections matching pdf_generator.py
  addHeading("1. Executive Overview & Decision-Support Mandate");
  addBody(
    `This assurance dossier evaluates the geological evidence base, internal consistency, and principal failure mechanisms for prospect ${prospect.name} in the ${prospect.basin_name} (${prospect.country}). It summarizes ${docs.length} uploaded document(s), ${wells.length} well record(s), ${claims.length} geological claim(s), ${contradictions.length} detected contradiction/gap item(s), ${psElements.length} evaluated petroleum-system elements, and ${investigations.length} prioritized discriminating investigation(s).`
  );

  addHeading("2. Scope, Methodology, and Explicit Limitations");
  addBody(
    `${scopeAndLimitations}\nStrict Scientific Notice: STRATAPROOF reports qualitative evidence-support categories only. It does not generate discovery probabilities, hydrocarbon volume estimates, or fabricated numerical confidence scores.`
  );

  addHeading("3. Prospect Identity & Geological Setting");
  addBody(
    `Target Formations: ${prospect.target_formations.join(", ") || "Not explicitly specified"}\n` +
      `Sub-basin / Province: ${prospect.sub_basin_or_province ?? "-"}\n` +
      `Prospect Description: ${prospect.description ?? "-"}`
  );

  addHeading("4. Regional Basin Context (Curated Verified Knowledge Library)");
  addBody(
    `Basin Category: ${basin?.basin_category ?? "Unlinked basin profile"}\n` +
      `Tectonic Summary: ${basin?.tectonic_summary ?? "No approved basin profile linked."}\n` +
      `Stratigraphic Overview: ${basin?.stratigraphic_overview ?? "-"}\n` +
      `Regional Known Uncertainties: ${basin?.known_uncertainties_and_gaps ?? "-"}`
  );

  addHeading("5. Data Inventory & Document Provenance Register (Environment A)");
  if (docVersions.length === 0) {
    addBody("No primary documents uploaded.");
  } else {
    for (const dv of docVersions) {
      const parent = docs.find((d) => d.id === dv.document_id);
      addBody(
        `- ${parent?.title ?? "Document"} (${parent?.document_type ?? "-"}): ${dv.original_filename} v${dv.version_number} [SHA-256: ${dv.sha256_checksum.slice(0, 24)}...]`
      );
    }
  }

  addHeading("6. Well & Interval Provenance Summary");
  if (wells.length === 0) {
    addBody("No structured wells registered.");
  } else {
    for (const w of wells) {
      addBody(
        `- Well ${w.well_identifier} | TD: ${w.total_depth_raw ?? "-"} ${w.depth_unit ?? ""} | Datum: ${w.depth_datum ?? "-"}`
      );
    }
  }

  addHeading("7. Epistemic Classification Summary (Observations vs. Interpretations, Assumptions & Predictions)");
  addBody(
    `- OBSERVATION (${obsCount}): Direct measurements or primary records.\n` +
      `- INTERPRETATION (${interpCount}): Geoscientist inferences derived from observations.\n` +
      `- ASSUMPTION (${assumpCount}): Unverified working premises requiring testing.\n` +
      `- PREDICTION (${predCount}): Forward prognoses for undrilled targets.`
  );

  addHeading("8. Master Geological Evidence Ledger");
  if (claims.length === 0) {
    addBody("No geological claims recorded.");
  } else {
    for (const c of claims) {
      addBody(
        `- [${c.claim_classification}] ${c.geological_element}: ${c.claim_text} (Status: ${c.qualitative_status} | Review: ${c.review_status})`
      );
    }
  }

  addHeading("9. Primary Documentary Evidence Items");
  if (evidences.length === 0) {
    addBody("No evidence items recorded.");
  } else {
    for (const e of evidences) {
      addBody(
        `- ${e.evidence_type} | ${e.geological_subject} (${e.well_identifier ?? "-"} / ${e.formation ?? "-"} ${e.depth_interval_raw ?? ""}): ${e.evidence_description}`
      );
    }
  }

  addHeading("10. Deterministic Consistency & Contradiction Findings");
  if (contradictions.length === 0) {
    addBody("No contradictions detected.");
  } else {
    for (const ct of contradictions) {
      addBody(
        `- [${ct.severity}] ${ct.category} (${ct.outcome_classification}): ${ct.explanation} [Raw: ${ct.first_value_raw} vs ${ct.second_value_raw}]`
      );
    }
  }

  addHeading("11. Petroleum System 8-Element Assurance Matrix");
  if (psElements.length === 0) {
    addBody("Petroleum system falsification analysis not yet executed.");
  } else {
    for (const ps of psElements) {
      addBody(
        `- ${ps.element_type}: ${ps.qualitative_status} — ${ps.status_rationale}${ps.missing_evidence_summary.length ? ` (Missing: ${ps.missing_evidence_summary.join("; ")})` : ""}`
      );
    }
  }

  addHeading("12. Source Rock & Thermal Maturity Evaluation");
  addBody(
    "Evaluated independently under the Petroleum System Assurance Matrix above. Any uncalibrated TOC, kerogen typing, or vitrinite reflectance (%Ro) gaps remain explicitly flagged as INSUFFICIENT_EVIDENCE until primary geochemical data are linked."
  );

  addHeading("13. Reservoir, Top Seal & Fault Seal Evaluation");
  addBody(
    "Evaluated independently against well-log, core, and structural fault-juxtaposition records. Absence of capillary entry pressure or Shale Gouge Ratio (SGR) calibration is retained as an explicit seal failure hypothesis."
  );

  addHeading("14. Trap Geometry, Migration Pathway, Timing & Preservation Evaluation");
  addBody(
    "Structural closure velocity sensitivity, fetch-area migration continuity, trap-versus-charge relative timing, and post-entrapment uplift/biodegradation risks are tracked as distinct elements without masking weak links."
  );

  addHeading("15. Adversarial Falsification Hypotheses ('How Could This Prospect Fail?')");
  if (hypotheses.length === 0) {
    addBody("No falsification hypotheses generated.");
  } else {
    for (const h of hypotheses) {
      addBody(
        `- ${h.geological_applicability} [${h.review_status}]: ${h.proposed_failure_mechanism} (${h.confidence_rationale})`
      );
    }
  }

  addHeading("16. Information Gaps & Unverified Working Assumptions");
  addBody(
    "All claims lacking linked supporting EvidenceItems and all OCR/unit-incomplete records flagged REQUIRES_HUMAN_CHECK are itemized in Sections 8 and 10 for mandatory geoscientist resolution prior to drill-decision gate review."
  );

  addHeading("17. Prioritized Discriminating Investigations");
  if (investigations.length === 0) {
    addBody("No investigations ranked yet.");
  } else {
    for (const inv of investigations) {
      addBody(
        `- Rank #${inv.priority_rank} [${inv.decision_relevance}] ${inv.title}: ${inv.discriminating_objective} (Required Test: ${inv.required_data_or_test})`
      );
    }
  }

  addHeading("18. Human Review & Sign-Off Governance Status");
  const approvedCount = claims.filter((c) => c.review_status === ReviewStatus.APPROVED).length;
  addBody(
    `Total Claims: ${claims.length} | Approved Claims: ${approvedCount} | Pending Review: ${claims.length - approvedCount}. AI-suggested hypotheses remain labeled AI_SUGGESTED_PENDING_REVIEW until signed off by a Lead Geologist or Reviewer.`
  );

  addHeading("19. Customer Document References (Environment A)");
  if (docVersions.length === 0) {
    addBody("None");
  } else {
    for (const dv of docVersions) {
      const parent = docs.find((d) => d.id === dv.document_id);
      addBody(
        `- ${parent?.title ?? "Document"} - ${dv.original_filename} (v${dv.version_number}, SHA-256: ${dv.sha256_checksum})`
      );
    }
  }

  addHeading("20. Verified Geological Knowledge References & Execution Lineage (Environment B & C)");
  if (knowledgeSources.length === 0) {
    addBody("No external regional knowledge sources linked.");
  } else {
    for (const ks of knowledgeSources) {
      addBody(
        `- ${ks.authors_or_institution} (${ks.publication_year ?? "-"}). ${ks.title}. [${ks.verification_status}]`
      );
    }
  }
  addBody(
    `Analysis Runs Recorded: ${runs.length} deterministic/falsification execution(s) logged in immutable audit lineage.`
  );

  const arrayBuffer = doc.output("arraybuffer");
  const pdfBytes = Buffer.from(arrayBuffer);
  const pdfSha256 = crypto.createHash("sha256").update(pdfBytes).digest("hex");

  let assessment = store.assessments.find(
    (a) => a.prospect_id === prospect.id && a.organisation_id === prospect.organisation_id
  );
  let verNum = 1;
  if (!assessment) {
    assessment = {
      id: crypto.randomUUID(),
      organisation_id: prospect.organisation_id,
      project_id: prospect.project_id,
      prospect_id: prospect.id,
      title,
      current_version: 1,
      created_by: generatedByUser.id,
    };
    store.assessments.push(assessment);
  } else {
    assessment.current_version += 1;
    verNum = assessment.current_version;
  }

  const s3Key = `org/${prospect.organisation_id}/projects/${prospect.project_id}/prospects/${prospect.id}/assessments/${assessment.id}_v${verNum}_${pdfSha256.slice(0, 12)}.pdf`;
  store.objectStorage.set(s3Key, pdfBytes);

  const av: AssessmentVersion = {
    id: crypto.randomUUID(),
    organisation_id: prospect.organisation_id,
    assessment_id: assessment.id,
    prospect_id: prospect.id,
    version_number: verNum,
    scope_and_limitations: scopeAndLimitations,
    snapshot_data: {
      prospect_id: prospect.id,
      claims_count: claims.length,
      contradictions_count: contradictions.length,
      hypotheses_count: hypotheses.length,
      investigations_count: investigations.length,
    },
    pdf_s3_key: s3Key,
    pdf_sha256: pdfSha256,
    generated_by: generatedByUser.id,
    generated_at: generatedAt,
  };
  store.assessmentVersions.set(av.id, av);
  return av;
}
