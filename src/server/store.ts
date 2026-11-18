import crypto from "crypto";
import {
  ClaimClassification,
  ContradictionOutcome,
  PetroleumSystemElementType,
  ProcessingStatus,
  QualitativeStatus,
  ReviewStatus,
  SeverityLevel,
  SourceQualityTier,
  UserRole,
} from "./enums";

export interface Organisation {
  id: string;
  name: string;
  slug: string;
  country: string;
  ai_processing_authorized: boolean;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  professional_credentials: string | null;
  is_active: boolean;
  created_at: string;
}

export interface OrganisationMembership {
  id: string;
  organisation_id: string;
  user_id: string;
  role: UserRole;
  is_default: boolean;
  deleted_at: string | null;
}

export interface Project {
  id: string;
  organisation_id: string;
  name: string;
  code: string;
  country: string;
  description: string | null;
  created_by: string;
  created_at: string;
  deleted_at: string | null;
}

export interface Prospect {
  id: string;
  organisation_id: string;
  project_id: string;
  name: string;
  block_or_licence: string | null;
  country: string;
  basin_name: string;
  sub_basin_or_province: string | null;
  basin_profile_id: string | null;
  target_formations: string[];
  description: string | null;
  created_by: string;
  created_at: string;
  deleted_at: string | null;
}

export interface BasinProfile {
  id: string;
  country: string;
  basin_name: string;
  basin_category: string;
  sub_basins_or_provinces: string[];
  tectonic_summary: string;
  stratigraphic_overview: string;
  known_uncertainties_and_gaps: string;
  review_status: ReviewStatus;
  deleted_at: string | null;
}

export interface FormationRecord {
  id: string;
  basin_profile_id: string;
  formation_name: string;
  recognized_aliases: string[];
  stratigraphic_rank_order: number | null;
  age_range: string | null;
  dominant_lithology: string | null;
  petroleum_system_role: string | null;
  review_status: ReviewStatus;
  deleted_at: string | null;
}

export interface SourceLicence {
  id: string;
  licence_code: string;
  name: string;
  permits_full_text_storage: boolean;
  permits_snippet_retrieval: boolean;
  attribution_requirements: string;
}

export interface KnowledgeSource {
  id: string;
  title: string;
  authors_or_institution: string;
  publication_type: string;
  publisher_or_journal: string | null;
  publication_year: number | null;
  doi_or_identifier: string | null;
  url: string | null;
  access_date: string;
  country: string;
  basin_or_area: string;
  geological_subject: string;
  licence_id: string;
  source_quality_tier: SourceQualityTier;
  peer_review_status: string;
  verification_status: ReviewStatus;
  notes: string | null;
}

export interface GeologicalKnowledgeClaim {
  id: string;
  claim_text: string;
  subject: string;
  geological_discipline: string;
  country: string;
  basin: string;
  sub_basin_or_province: string | null;
  formation: string | null;
  age_interval: string | null;
  claim_classification: ClaimClassification;
  source_quality_tier: SourceQualityTier;
  review_status: ReviewStatus;
  is_disputed: boolean;
  limitations: string;
  applicability_scope: string;
  source_ids: string[];
}

export interface DocumentRecord {
  id: string;
  organisation_id: string;
  project_id: string;
  prospect_id: string;
  title: string;
  document_type: string;
  current_version: number;
  created_by: string;
  created_at: string;
  deleted_at: string | null;
}

export interface DocumentVersion {
  id: string;
  organisation_id: string;
  document_id: string;
  version_number: number;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  sha256_checksum: string;
  s3_bucket: string;
  s3_object_key: string;
  uploaded_by: string;
  created_at: string;
}

export interface IngestionJob {
  id: string;
  organisation_id: string;
  document_version_id: string;
  status: ProcessingStatus;
  extraction_warnings: string[];
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ExtractedRecord {
  id: string;
  organisation_id: string;
  prospect_id: string;
  document_version_id: string;
  record_type: string;
  raw_payload: Record<string, unknown>;
  extraction_method: string;
  extraction_quality_label: string;
  review_status: ReviewStatus;
}

export interface Well {
  id: string;
  organisation_id: string;
  prospect_id: string;
  well_identifier: string;
  total_depth_raw: number | null;
  depth_unit: string | null;
  depth_datum: string | null;
  coordinate_system: string | null;
  deleted_at: string | null;
}

export interface WellInterval {
  id: string;
  organisation_id: string;
  well_id: string;
  formation_name: string;
  top_depth: number | null;
  bottom_depth: number | null;
  depth_type: string | null;
  depth_unit: string | null;
  depth_datum: string | null;
  reported_age: string | null;
  lithology_summary: string | null;
  source_location_id: string | null;
  deleted_at: string | null;
}

export interface GeologicalClaim {
  id: string;
  organisation_id: string;
  prospect_id: string;
  geological_element: string;
  petroleum_system_element: PetroleumSystemElementType | null;
  claim_text: string;
  claim_classification: ClaimClassification;
  stratigraphic_applicability: string | null;
  spatial_applicability: string | null;
  conditions_and_limitations: string | null;
  qualitative_status: QualitativeStatus;
  review_status: ReviewStatus;
  is_ai_suggested: boolean;
  current_revision: number;
  created_by: string;
  created_at: string;
  deleted_at: string | null;
}

export interface EvidenceItem {
  id: string;
  organisation_id: string;
  prospect_id: string;
  document_version_id: string | null;
  source_location_id: string | null;
  evidence_type: string;
  geological_subject: string;
  evidence_description: string;
  well_identifier: string | null;
  formation: string | null;
  depth_interval_raw: string | null;
  depth_unit: string | null;
  evidence_strength_note: string | null;
  review_status: ReviewStatus;
  created_by: string;
  deleted_at: string | null;
}

export interface ClaimEvidence {
  id: string;
  organisation_id: string;
  claim_id: string;
  evidence_id: string;
  relationship_role: "SUPPORTING" | "OPPOSING" | "CONTEXTUAL";
  rationale: string | null;
  linked_by: string;
}

export interface AnalysisRun {
  id: string;
  organisation_id: string;
  prospect_id: string;
  run_type: string;
  triggered_by: string;
  executed_rule_versions: Array<{ rule_code?: string; version: string; engine?: string }>;
  ai_model_used: string | null;
  status: ProcessingStatus;
  started_at: string;
  completed_at: string | null;
}

export interface Contradiction {
  id: string;
  organisation_id: string;
  prospect_id: string;
  analysis_run_id: string;
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
  review_status: ReviewStatus;
  created_at: string;
  deleted_at: string | null;
}

export interface PetroleumSystemElement {
  id: string;
  organisation_id: string;
  prospect_id: string;
  element_type: PetroleumSystemElementType;
  qualitative_status: QualitativeStatus;
  status_rationale: string;
  missing_evidence_summary: string[];
  review_status: ReviewStatus;
}

export interface FalsificationHypothesis {
  id: string;
  organisation_id: string;
  prospect_id: string;
  element_id: string;
  analysis_run_id: string;
  proposed_failure_mechanism: string;
  geological_applicability: string;
  relevance_conditions: string;
  missing_evidence: string[];
  knowledge_source_ids: string[];
  confidence_rationale: string;
  is_ai_suggested: boolean;
  review_status: ReviewStatus;
  reviewed_by: string | null;
  reviewer_notes: string | null;
  deleted_at: string | null;
}

export interface Investigation {
  id: string;
  organisation_id: string;
  prospect_id: string;
  hypothesis_id: string;
  title: string;
  discriminating_objective: string;
  required_data_or_test: string;
  user_supplied_cost_estimate: string | null;
  user_supplied_time_estimate: string | null;
  technical_feasibility_note: string | null;
  priority_rank: number;
  decision_relevance: string;
  discrimination_power: string;
  prioritisation_rationale: string;
}

export interface Assessment {
  id: string;
  organisation_id: string;
  project_id: string;
  prospect_id: string;
  title: string;
  current_version: number;
  created_by: string;
}

export interface AssessmentVersion {
  id: string;
  organisation_id: string;
  assessment_id: string;
  prospect_id: string;
  version_number: number;
  scope_and_limitations: string;
  snapshot_data: Record<string, unknown>;
  pdf_s3_key: string;
  pdf_sha256: string;
  generated_by: string;
  generated_at: string;
}

export interface AuditEvent {
  id: string;
  organisation_id: string;
  project_id: string | null;
  actor_user_id: string | null;
  event_type: string;
  entity_type: string;
  entity_id: string;
  event_metadata: Record<string, unknown>;
  occurred_at: string;
}

export interface StrataProofStore {
  organisations: Map<string, Organisation>;
  users: Map<string, User>;
  memberships: OrganisationMembership[];
  projects: Map<string, Project>;
  prospects: Map<string, Prospect>;
  basins: Map<string, BasinProfile>;
  formations: FormationRecord[];
  sourceLicences: Map<string, SourceLicence>;
  knowledgeSources: Map<string, KnowledgeSource>;
  knowledgeClaims: Map<string, GeologicalKnowledgeClaim>;
  documents: Map<string, DocumentRecord>;
  documentVersions: Map<string, DocumentVersion>;
  ingestionJobs: Map<string, IngestionJob>;
  extractedRecords: ExtractedRecord[];
  wells: Map<string, Well>;
  wellIntervals: WellInterval[];
  claims: Map<string, GeologicalClaim>;
  evidenceItems: Map<string, EvidenceItem>;
  claimEvidences: ClaimEvidence[];
  analysisRuns: AnalysisRun[];
  contradictions: Map<string, Contradiction>;
  petroleumSystemElements: PetroleumSystemElement[];
  hypotheses: Map<string, FalsificationHypothesis>;
  investigations: Investigation[];
  assessments: Assessment[];
  assessmentVersions: Map<string, AssessmentVersion>;
  auditEvents: AuditEvent[];
  objectStorage: Map<string, Buffer>;
}

const NIGERIAN_BASINS_TAXONOMY = [
  {
    basin_name: "Niger Delta Basin",
    basin_category: "Cenozoic Passive-Margin Deltaic Province",
    sub_basins_or_provinces: [
      "Northern Delta Depobelt",
      "Greater Ughelli Depobelt",
      "Central Swamp Depobelt",
      "Coastal Swamp Depobelt",
      "Shallow Offshore Depobelt",
      "Deepwater Toe-Thrust & Inner Fold Belt",
    ],
    tectonic_summary:
      "Syn-sedimentary gravity-driven growth faulting, rollover anticlines, shale diapirism, and deepwater toe-thrust folds.",
    stratigraphic_overview:
      "Diachronous tripartite succession: marine Akata Shale (base), paralic Agbada Formation, and continental Benin Sandstone (top).",
    known_uncertainties_and_gaps:
      "Deep Akata source-rock TOC/maturity calibration in ultra-deepwater; across-fault SGR sealing capacity in stacked Agbada reservoirs.",
  },
  {
    basin_name: "Anambra Basin",
    basin_category: "Cretaceous–Paleogene Intracratonic / Post-Santonian Foreland Basin",
    sub_basins_or_provinces: ["Onitsha-Nsukka Axis", "Enugu-Udi Escarpment", "Okigwe-Afikpo Syncline"],
    tectonic_summary:
      "Post-Santonian subsidence following Benue Trough inversion, overprinted by Cenozoic uplift and erosion.",
    stratigraphic_overview:
      "Nkporo/Enugu Shale, Mamu Coal Measures, Ajali Sandstone, Nsukka Formation, overlain by Imo and Ameki Groups.",
    known_uncertainties_and_gaps:
      "Magnitude of Cenozoic uplift/erosion affecting thermal maturity reconstruction and post-entrapment preservation.",
  },
  {
    basin_name: "Lower Benue Trough",
    basin_category: "Cretaceous Intracontinental Rift Basin",
    sub_basins_or_provinces: ["Abakaliki Anticlinorium", "Afikpo Syncline"],
    tectonic_summary:
      "Albian–Coniacian rift fill inverted during Santonian compressional folding and low-grade metamorphism.",
    stratigraphic_overview: "Asu River Group, Eze-Aku Group, and Awgu Formation.",
    known_uncertainties_and_gaps:
      "Santonian thermal overprint and trap breach risk across inverted anticlinorial structures.",
  },
  {
    basin_name: "Middle Benue Trough",
    basin_category: "Cretaceous Intracontinental Rift Basin",
    sub_basins_or_provinces: ["Lafia-Obi Sub-basin", "Keana Anticline"],
    tectonic_summary: "NE–SW trending rift segment with transpressional folding and localized igneous intrusions.",
    stratigraphic_overview: "Asu River Group, Awe, Keana, Eze-Aku, Awgu, and Lafia Formations.",
    known_uncertainties_and_gaps:
      "Sparse deep well calibration and localized igneous contact metamorphism of source horizons.",
  },
  {
    basin_name: "Upper Benue Trough",
    basin_category: "Cretaceous Intracontinental Rift Basin",
    sub_basins_or_provinces: ["Lau-Gombe Sub-basin", "Lamurde Anticline"],
    tectonic_summary:
      "Bifurcating rift arm transitioning into the Gongola and Yola arms with Santonian–Maastrichtian deformation.",
    stratigraphic_overview:
      "Bima Sandstone, Yolde Formation, Dukul/Jessu/Sekuliye/Numanha Formations, and Lamja Sandstone.",
    known_uncertainties_and_gaps: "Lateral continuity of marine Cenomanian–Turonian source shales and fault-seal integrity.",
  },
  {
    basin_name: "Gongola Basin",
    basin_category: "Cretaceous Rift Arm (Northern Benue Branch)",
    sub_basins_or_provinces: ["Kolmani River Trend", "Gombe-Nafada Axis"],
    tectonic_summary:
      "N–S trending rift grabens and horst blocks bounded by basement-involved normal and inverted faults.",
    stratigraphic_overview: "Bima Group, Yolde Formation, Pindiga Formation, Gombe Sandstone, and Kerri-Kerri Formation.",
    known_uncertainties_and_gaps: "Variable Pindiga shale organic facies quality and structural compartmentalization.",
  },
  {
    basin_name: "Yola Basin",
    basin_category: "Cretaceous Rift Arm (Eastern Benue Branch)",
    sub_basins_or_provinces: ["Numan-Yola Graben", "Demsa-Mayo Belwa Axis"],
    tectonic_summary: "E–W trending rift arm controlled by wrench and dip-slip basement faults.",
    stratigraphic_overview:
      "Bima Sandstone, Yolde, Dukul, Jessu, Sekuliye, Numanha, and Lamja Formations.",
    known_uncertainties_and_gaps: "Very low well control density and limited public organic geochemistry datasets.",
  },
  {
    basin_name: "Bida Basin (Mid-Niger Basin)",
    basin_category: "Campanian–Maastrichtian Intracratonic Sag / Wrench Basin",
    sub_basins_or_provinces: ["Northern Bida Sub-basin", "Southern Bida (Lokoja) Sub-basin"],
    tectonic_summary: "NW–SE trending intracratonic basin bounded by basement shear zones with gentle dips.",
    stratigraphic_overview:
      "Bida/Lokoja Sandstone, Sakpe Ironstone, Enagi/Patti Siltstone-Shale, and Batati/Agbaja Ironstone.",
    known_uncertainties_and_gaps:
      "Insufficient burial depth for thermal maturation across basin margins; scarcity of deep stratigraphic wells.",
  },
  {
    basin_name: "Dahomey Basin (Benin Basin)",
    basin_category: "Mesozoic–Cenozoic Coastal Margin Basin",
    sub_basins_or_provinces: ["Onshore Ogun-Lagos Block", "Okitipupa Ridge", "Offshore Deepwater Dahomey"],
    tectonic_summary: "Rifted passive margin separated from the Niger Delta by the Okitipupa Ridge and Chain Fracture Zone.",
    stratigraphic_overview:
      "Abeokuta Group (Ise, Afowo, Araromi Formations), Ewekoro, Akinbo, Oshosun, and Ilaro Formations.",
    known_uncertainties_and_gaps:
      "Biodegradation in shallow onshore tar-sand reservoirs and offshore source-rock thermal maturity.",
  },
  {
    basin_name: "Sokoto Basin (Iullemmeden Basin)",
    basin_category: "Mesozoic–Cenozoic Intracratonic Syneclise",
    sub_basins_or_provinces: ["Gundumi-Illo Trough", "Rima-Sokoto Plain"],
    tectonic_summary: "Southeastern sector of the intracratonic Iullemmeden Basin with gentle northwesterly regional dip.",
    stratigraphic_overview:
      "Gundumi/Illo Formations, Rima Group (Taloka, Dukamaje, Wurno), Sokoto Group (Dange, Kalambaina), and Gwandu Formation.",
    known_uncertainties_and_gaps:
      "Shallow sedimentary thickness and low thermal maturity gradients across most of the Nigerian sector.",
  },
  {
    basin_name: "Chad Basin (Bornu Basin)",
    basin_category: "Mesozoic–Cenozoic Intracontinental Rift & Sag Basin",
    sub_basins_or_provinces: ["Maiduguri Sub-basin", "Gubio Trough", "Lake Chad Axis"],
    tectonic_summary: "Cretaceous NE–SW rift grabens overlain by Cenozoic regional sag deposits.",
    stratigraphic_overview:
      "Bima Sandstone, Gongila Formation, Fika Shale, Gombe Sandstone, Kerri-Kerri, and Chad Formation.",
    known_uncertainties_and_gaps: "Tertiary intrusive sill thermal effects and seal breach risk in faulted Fika/Gongila traps.",
  },
  {
    basin_name: "Calabar Flank",
    basin_category: "Cretaceous Passive-Margin Hinge Zone",
    sub_basins_or_provinces: ["Oban Massif Margin", "Ikang Trough", "Ituk High"],
    tectonic_summary: "NW–SE trending horst-and-graben hinge zone bordering the Oban Massif and Ikang Trough.",
    stratigraphic_overview: "Awi Formation, Mfamosing Limestone, Ekenkpon Shale, New Netim Marl, and Nkporo Shale.",
    known_uncertainties_and_gaps:
      "Rapid lateral carbonate-clastic facies transitions and limited burial depth on structural highs.",
  },
  {
    basin_name: "Nigerian Frontier & Borderland Areas",
    basin_category: "Under-Explored / Frontier Sedimentary Provinces",
    sub_basins_or_provinces: ["Mamfe Embayment (Nigerian Sector)", "Cross River Frontier"],
    tectonic_summary:
      "Narrow fault-bounded rift embayments adjoining the Cameroon Volcanic Line and basement massifs.",
    stratigraphic_overview: "Fluvio-lacustrine Cretaceous sandstones and organic-rich shales.",
    known_uncertainties_and_gaps:
      "Severe scarcity of calibrated seismic, well logs, and regional biostratigraphic controls.",
  },
];

function createInitialStore(): StrataProofStore {
  const store: StrataProofStore = {
    organisations: new Map(),
    users: new Map(),
    memberships: [],
    projects: new Map(),
    prospects: new Map(),
    basins: new Map(),
    formations: [],
    sourceLicences: new Map(),
    knowledgeSources: new Map(),
    knowledgeClaims: new Map(),
    documents: new Map(),
    documentVersions: new Map(),
    ingestionJobs: new Map(),
    extractedRecords: [],
    wells: new Map(),
    wellIntervals: [],
    claims: new Map(),
    evidenceItems: new Map(),
    claimEvidences: [],
    analysisRuns: [],
    contradictions: new Map(),
    petroleumSystemElements: [],
    hypotheses: new Map(),
    investigations: [],
    assessments: [],
    assessmentVersions: new Map(),
    auditEvents: [],
    objectStorage: new Map(),
  };

  const licenceId = crypto.randomUUID();
  store.sourceLicences.set(licenceId, {
    id: licenceId,
    licence_code: "OPEN_PEER_REVIEWED_METADATA",
    name: "Open Bibliographic Metadata & Short Scientific Citation Licence",
    permits_full_text_storage: false,
    permits_snippet_retrieval: true,
    attribution_requirements: "Cite author, title, year, journal/institution, and DOI.",
  });

  for (const entry of NIGERIAN_BASINS_TAXONOMY) {
    const basinId = crypto.randomUUID();
    store.basins.set(basinId, {
      id: basinId,
      country: "Nigeria",
      basin_name: entry.basin_name,
      basin_category: entry.basin_category,
      sub_basins_or_provinces: entry.sub_basins_or_provinces,
      tectonic_summary: entry.tectonic_summary,
      stratigraphic_overview: entry.stratigraphic_overview,
      known_uncertainties_and_gaps: entry.known_uncertainties_and_gaps,
      review_status: ReviewStatus.APPROVED,
      deleted_at: null,
    });

    if (entry.basin_name === "Niger Delta Basin") {
      store.formations.push(
        {
          id: crypto.randomUUID(),
          basin_profile_id: basinId,
          formation_name: "Benin Formation",
          recognized_aliases: ["Benin Sandstone"],
          stratigraphic_rank_order: 1,
          age_range: "Oligocene-Recent",
          dominant_lithology: "Continental massive fluvial sandstones",
          petroleum_system_role: "Overburden / regional freshwater aquifer",
          review_status: ReviewStatus.APPROVED,
          deleted_at: null,
        },
        {
          id: crypto.randomUUID(),
          basin_profile_id: basinId,
          formation_name: "Agbada Formation",
          recognized_aliases: ["Paralic Agbada"],
          stratigraphic_rank_order: 2,
          age_range: "Eocene-Pliocene",
          dominant_lithology: "Alternating deltaic sandstones and marine shales",
          petroleum_system_role: "Primary reservoir and intraformational top/fault seal",
          review_status: ReviewStatus.APPROVED,
          deleted_at: null,
        },
        {
          id: crypto.randomUUID(),
          basin_profile_id: basinId,
          formation_name: "Akata Formation",
          recognized_aliases: ["Akata Shale"],
          stratigraphic_rank_order: 3,
          age_range: "Paleocene-Recent",
          dominant_lithology: "Overpressured marine prodelta shales",
          petroleum_system_role: "Primary regional source rock and detachment horizon",
          review_status: ReviewStatus.APPROVED,
          deleted_at: null,
        }
      );
    }
  }

  return store;
}

const globalForStore = globalThis as unknown as {
  __strataproofStore?: StrataProofStore;
};

export function getStore(): StrataProofStore {
  if (!globalForStore.__strataproofStore) {
    globalForStore.__strataproofStore = createInitialStore();
  }
  return globalForStore.__strataproofStore;
}

export function recordAuditEvent(params: {
  organisation_id: string;
  project_id?: string | null;
  actor_user_id?: string | null;
  event_type: string;
  entity_type: string;
  entity_id: string;
  event_metadata?: Record<string, unknown>;
}): void {
  const store = getStore();
  store.auditEvents.unshift({
    id: crypto.randomUUID(),
    organisation_id: params.organisation_id,
    project_id: params.project_id ?? null,
    actor_user_id: params.actor_user_id ?? null,
    event_type: params.event_type,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    event_metadata: params.event_metadata ?? {},
    occurred_at: new Date().toISOString(),
  });
}
