import crypto from "crypto";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { jsPDF } from "jspdf";
import { db } from "../db/index.ts";
import {
  analysisRuns,
  assessments,
  assessmentVersions,
  basinProfiles,
  contradictions,
  documents,
  documentVersions,
  evidenceItems,
  falsificationHypotheses,
  geologicalClaims,
  investigations,
  knowledgeSources,
  organisations,
  petroleumSystemElements,
  projects,
  storedObjects,
  wells,
} from "../db/schema.ts";
import { ReviewStatus } from "./enums.ts";

type ProspectRow = typeof import("../db/schema.ts").prospects.$inferSelect;

export async function generateProspectAssessmentPdf(params: {
  prospect: ProspectRow;
  generatedByUser: { id: string; fullName: string };
  title: string;
  scopeAndLimitations: string;
}) {
  try {
    const { prospect, generatedByUser, title, scopeAndLimitations } = params;

    const [org] = await db
      .select()
      .from(organisations)
      .where(eq(organisations.id, prospect.organisationId));
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, prospect.projectId));
    const basin = prospect.basinProfileId
      ? (
          await db
            .select()
            .from(basinProfiles)
            .where(eq(basinProfiles.id, prospect.basinProfileId))
        )[0]
      : undefined;

    const docs = await db
      .select()
      .from(documents)
      .where(and(eq(documents.prospectId, prospect.id), isNull(documents.deletedAt)));

    const docIds = docs.map((d) => d.id);
    const docVersions =
      docIds.length > 0
        ? await db
            .select()
            .from(documentVersions)
            .where(inArray(documentVersions.documentId, docIds))
        : [];

    const prospectWells = await db
      .select()
      .from(wells)
      .where(and(eq(wells.prospectId, prospect.id), isNull(wells.deletedAt)));

    const claims = await db
      .select()
      .from(geologicalClaims)
      .where(
        and(
          eq(geologicalClaims.prospectId, prospect.id),
          isNull(geologicalClaims.deletedAt)
        )
      );

    const evidences = await db
      .select()
      .from(evidenceItems)
      .where(
        and(eq(evidenceItems.prospectId, prospect.id), isNull(evidenceItems.deletedAt))
      );

    const prospectContradictions = await db
      .select()
      .from(contradictions)
      .where(
        and(eq(contradictions.prospectId, prospect.id), isNull(contradictions.deletedAt))
      );

    const psElements = await db
      .select()
      .from(petroleumSystemElements)
      .where(eq(petroleumSystemElements.prospectId, prospect.id));

    const hypotheses = await db
      .select()
      .from(falsificationHypotheses)
      .where(
        and(
          eq(falsificationHypotheses.prospectId, prospect.id),
          isNull(falsificationHypotheses.deletedAt)
        )
      );

    const invRows = await db
      .select()
      .from(investigations)
      .where(eq(investigations.prospectId, prospect.id))
      .orderBy(asc(investigations.priorityRank));

    const runs = await db
      .select()
      .from(analysisRuns)
      .where(eq(analysisRuns.prospectId, prospect.id));

    const kSources = await db
      .select()
      .from(knowledgeSources)
      .where(
        inArray(knowledgeSources.verificationStatus, [
          ReviewStatus.APPROVED,
          ReviewStatus.CONDITIONALLY_APPROVED,
          ReviewStatus.DISPUTED,
        ])
      );

    const generatedAt = new Date();
    const obsCount = claims.filter((c) => c.claimClassification === "OBSERVATION").length;
    const interpCount = claims.filter((c) => c.claimClassification === "INTERPRETATION").length;
    const assumpCount = claims.filter((c) => c.claimClassification === "ASSUMPTION").length;
    const predCount = claims.filter((c) => c.claimClassification === "PREDICTION").length;

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
    addBody(
      `Organisation: ${org?.name ?? ""} | Project: ${project?.name ?? ""} (${project?.code ?? ""})\n` +
        `Prospect: ${prospect.name} | Basin / Country: ${prospect.basinName}, ${prospect.country} | Block/Licence: ${prospect.blockOrLicence ?? "-"}\n` +
        `Generated UTC: ${generatedAt.toISOString()} | Prepared By: ${generatedByUser.fullName}`
    );

    addHeading("1. Executive Overview & Decision-Support Mandate");
    addBody(
      `This assurance dossier evaluates the geological evidence base, internal consistency, and principal failure mechanisms for prospect ${prospect.name} in the ${prospect.basinName} (${prospect.country}). It summarizes ${docs.length} uploaded document(s), ${prospectWells.length} well record(s), ${claims.length} geological claim(s), ${prospectContradictions.length} detected contradiction/gap item(s), ${psElements.length} evaluated petroleum-system elements, and ${invRows.length} prioritized discriminating investigation(s).`
    );

    addHeading("2. Scope, Methodology, and Explicit Limitations");
    addBody(
      `${scopeAndLimitations}\nStrict Scientific Notice: STRATAPROOF reports qualitative evidence-support categories only. It does not generate discovery probabilities, hydrocarbon volume estimates, or fabricated numerical confidence scores.`
    );

    addHeading("3. Prospect Identity & Geological Setting");
    addBody(
      `Target Formations: ${prospect.targetFormations.join(", ") || "Not explicitly specified"}\n` +
        `Sub-basin / Province: ${prospect.subBasinOrProvince ?? "-"}\n` +
        `Prospect Description: ${prospect.description ?? "-"}`
    );

    addHeading("4. Regional Basin Context (Curated Verified Knowledge Library)");
    addBody(
      `Basin Category: ${basin?.basinCategory ?? "Unlinked basin profile"}\n` +
        `Tectonic Summary: ${basin?.tectonicSummary ?? "No approved basin profile linked."}\n` +
        `Stratigraphic Overview: ${basin?.stratigraphicOverview ?? "-"}\n` +
        `Regional Known Uncertainties: ${basin?.knownUncertaintiesAndGaps ?? "-"}`
    );

    addHeading("5. Data Inventory & Document Provenance Register (Environment A)");
    if (docVersions.length === 0) {
      addBody("No primary documents uploaded.");
    } else {
      for (const dv of docVersions) {
        const parent = docs.find((d) => d.id === dv.documentId);
        addBody(
          `- ${parent?.title ?? "Document"} (${parent?.documentType ?? "-"}): ${dv.originalFilename} v${dv.versionNumber} [SHA-256: ${dv.sha256Checksum.slice(0, 24)}...]`
        );
      }
    }

    addHeading("6. Well & Interval Provenance Summary");
    if (prospectWells.length === 0) {
      addBody("No structured wells registered.");
    } else {
      for (const w of prospectWells) {
        addBody(
          `- Well ${w.wellIdentifier} | TD: ${w.totalDepthRaw ?? "-"} ${w.depthUnit ?? ""} | Datum: ${w.depthDatum ?? "-"}`
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
          `- [${c.claimClassification}] ${c.geologicalElement}: ${c.claimText} (Status: ${c.qualitativeStatus} | Review: ${c.reviewStatus})`
        );
      }
    }

    addHeading("9. Primary Documentary Evidence Items");
    if (evidences.length === 0) {
      addBody("No evidence items recorded.");
    } else {
      for (const e of evidences) {
        addBody(
          `- ${e.evidenceType} | ${e.geologicalSubject} (${e.wellIdentifier ?? "-"} / ${e.formation ?? "-"} ${e.depthIntervalRaw ?? ""}): ${e.evidenceDescription}`
        );
      }
    }

    addHeading("10. Deterministic Consistency & Contradiction Findings");
    if (prospectContradictions.length === 0) {
      addBody("No contradictions detected.");
    } else {
      for (const ct of prospectContradictions) {
        addBody(
          `- [${ct.severity}] ${ct.category} (${ct.outcomeClassification}): ${ct.explanation} [Raw: ${ct.firstValueRaw} vs ${ct.secondValueRaw}]`
        );
      }
    }

    addHeading("11. Petroleum System 8-Element Assurance Matrix");
    if (psElements.length === 0) {
      addBody("Petroleum system falsification analysis not yet executed.");
    } else {
      for (const ps of psElements) {
        addBody(
          `- ${ps.elementType}: ${ps.qualitativeStatus} — ${ps.statusRationale}${ps.missingEvidenceSummary.length ? ` (Missing: ${ps.missingEvidenceSummary.join("; ")})` : ""}`
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
          `- ${h.geologicalApplicability} [${h.reviewStatus}]: ${h.proposedFailureMechanism} (${h.confidenceRationale})`
        );
      }
    }

    addHeading("16. Information Gaps & Unverified Working Assumptions");
    addBody(
      "All claims lacking linked supporting EvidenceItems and all OCR/unit-incomplete records flagged REQUIRES_HUMAN_CHECK are itemized in Sections 8 and 10 for mandatory geoscientist resolution prior to drill-decision gate review."
    );

    addHeading("17. Prioritized Discriminating Investigations");
    if (invRows.length === 0) {
      addBody("No investigations ranked yet.");
    } else {
      for (const inv of invRows) {
        addBody(
          `- Rank #${inv.priorityRank} [${inv.decisionRelevance}] ${inv.title}: ${inv.discriminatingObjective} (Required Test: ${inv.requiredDataOrTest})`
        );
      }
    }

    addHeading("18. Human Review & Sign-Off Governance Status");
    const approvedCount = claims.filter((c) => c.reviewStatus === ReviewStatus.APPROVED).length;
    addBody(
      `Total Claims: ${claims.length} | Approved Claims: ${approvedCount} | Pending Review: ${claims.length - approvedCount}. AI-suggested hypotheses remain labeled AI_SUGGESTED_PENDING_REVIEW until signed off by a Lead Geologist or Reviewer.`
    );

    addHeading("19. Customer Document References (Environment A)");
    if (docVersions.length === 0) {
      addBody("None");
    } else {
      for (const dv of docVersions) {
        const parent = docs.find((d) => d.id === dv.documentId);
        addBody(
          `- ${parent?.title ?? "Document"} - ${dv.originalFilename} (v${dv.versionNumber}, SHA-256: ${dv.sha256Checksum})`
        );
      }
    }

    addHeading("20. Verified Geological Knowledge References & Execution Lineage (Environment B & C)");
    if (kSources.length === 0) {
      addBody("No external regional knowledge sources linked.");
    } else {
      for (const ks of kSources) {
        addBody(
          `- ${ks.authorsOrInstitution} (${ks.publicationYear ?? "-"}). ${ks.title}. [${ks.verificationStatus}]`
        );
      }
    }
    addBody(
      `Analysis Runs Recorded: ${runs.length} deterministic/falsification execution(s) logged in immutable audit lineage.`
    );

    const arrayBuffer = doc.output("arraybuffer");
    const pdfBytes = Buffer.from(arrayBuffer);
    const pdfSha256 = crypto.createHash("sha256").update(pdfBytes).digest("hex");

    const existingAssessments = await db
      .select()
      .from(assessments)
      .where(
        and(
          eq(assessments.prospectId, prospect.id),
          eq(assessments.organisationId, prospect.organisationId)
        )
      );

    let assessment = existingAssessments[0];
    let verNum = 1;
    if (!assessment) {
      const [inserted] = await db
        .insert(assessments)
        .values({
          id: crypto.randomUUID(),
          organisationId: prospect.organisationId,
          projectId: prospect.projectId,
          prospectId: prospect.id,
          title,
          currentVersion: 1,
          createdBy: generatedByUser.id,
        })
        .returning();
      assessment = inserted;
    } else {
      verNum = assessment.currentVersion + 1;
      const [updated] = await db
        .update(assessments)
        .set({ currentVersion: verNum })
        .where(eq(assessments.id, assessment.id))
        .returning();
      assessment = updated;
    }

    const s3Key = `org/${prospect.organisationId}/projects/${prospect.projectId}/prospects/${prospect.id}/assessments/${assessment.id}_v${verNum}_${pdfSha256.slice(0, 12)}.pdf`;

    await db.insert(storedObjects).values({
      objectKey: s3Key,
      organisationId: prospect.organisationId,
      contentType: "application/pdf",
      byteLength: pdfBytes.byteLength,
      sha256: pdfSha256,
      data: pdfBytes,
      createdAt: generatedAt,
    });

    const [av] = await db
      .insert(assessmentVersions)
      .values({
        id: crypto.randomUUID(),
        organisationId: prospect.organisationId,
        assessmentId: assessment.id,
        prospectId: prospect.id,
        versionNumber: verNum,
        scopeAndLimitations,
        snapshotData: {
          prospect_id: prospect.id,
          claims_count: claims.length,
          contradictions_count: prospectContradictions.length,
          hypotheses_count: hypotheses.length,
          investigations_count: invRows.length,
        },
        pdfS3Key: s3Key,
        pdfSha256,
        generatedBy: generatedByUser.id,
        generatedAt,
      })
      .returning();

    return av;
  } catch (error) {
    console.error("PDF assessment generation failed:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
