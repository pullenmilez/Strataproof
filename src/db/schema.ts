import {
  boolean,
  customType,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const organisations = pgTable("organisations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  country: text("country").notNull().default("Nigeria"),
  aiProcessingAuthorized: boolean("ai_processing_authorized").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  uid: text("uid").unique(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  passwordHash: text("password_hash"),
  professionalCredentials: text("professional_credentials"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const organisationMemberships = pgTable("organisation_memberships", {
  id: text("id").primaryKey(),
  organisationId: text("organisation_id")
    .notNull()
    .references(() => organisations.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  role: text("role").notNull(),
  isDefault: boolean("is_default").notNull().default(true),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  organisationId: text("organisation_id")
    .notNull()
    .references(() => organisations.id),
  name: text("name").notNull(),
  code: text("code").notNull(),
  country: text("country").notNull().default("Nigeria"),
  description: text("description"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const basinProfiles = pgTable("basin_profiles", {
  id: text("id").primaryKey(),
  country: text("country").notNull().default("Nigeria"),
  basinName: text("basin_name").notNull(),
  basinCategory: text("basin_category").notNull(),
  subBasinsOrProvinces: jsonb("sub_basins_or_provinces").$type<string[]>().notNull(),
  tectonicSummary: text("tectonic_summary").notNull(),
  stratigraphicOverview: text("stratigraphic_overview").notNull(),
  knownUncertaintiesAndGaps: text("known_uncertainties_and_gaps").notNull(),
  reviewStatus: text("review_status").notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const formationRecords = pgTable("formation_records", {
  id: text("id").primaryKey(),
  basinProfileId: text("basin_profile_id")
    .notNull()
    .references(() => basinProfiles.id),
  formationName: text("formation_name").notNull(),
  recognizedAliases: jsonb("recognized_aliases").$type<string[]>().notNull(),
  stratigraphicRankOrder: integer("stratigraphic_rank_order"),
  ageRange: text("age_range"),
  dominantLithology: text("dominant_lithology"),
  petroleumSystemRole: text("petroleum_system_role"),
  reviewStatus: text("review_status").notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const sourceLicences = pgTable("source_licences", {
  id: text("id").primaryKey(),
  licenceCode: text("licence_code").notNull().unique(),
  name: text("name").notNull(),
  permitsFullTextStorage: boolean("permits_full_text_storage").notNull().default(false),
  permitsSnippetRetrieval: boolean("permits_snippet_retrieval").notNull().default(true),
  attributionRequirements: text("attribution_requirements").notNull(),
});

export const knowledgeSources = pgTable("knowledge_sources", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  authorsOrInstitution: text("authors_or_institution").notNull(),
  publicationType: text("publication_type").notNull(),
  publisherOrJournal: text("publisher_or_journal"),
  publicationYear: integer("publication_year"),
  doiOrIdentifier: text("doi_or_identifier"),
  url: text("url"),
  accessDate: text("access_date").notNull(),
  country: text("country").notNull(),
  basinOrArea: text("basin_or_area").notNull(),
  geologicalSubject: text("geological_subject").notNull(),
  licenceId: text("licence_id").notNull(),
  sourceQualityTier: text("source_quality_tier").notNull(),
  peerReviewStatus: text("peer_review_status").notNull(),
  verificationStatus: text("verification_status").notNull(),
  notes: text("notes"),
});

export const knowledgeClaims = pgTable("knowledge_claims", {
  id: text("id").primaryKey(),
  claimText: text("claim_text").notNull(),
  subject: text("subject").notNull(),
  geologicalDiscipline: text("geological_discipline").notNull(),
  country: text("country").notNull(),
  basin: text("basin").notNull(),
  subBasinOrProvince: text("sub_basin_or_province"),
  formation: text("formation"),
  ageInterval: text("age_interval"),
  claimClassification: text("claim_classification").notNull(),
  sourceQualityTier: text("source_quality_tier").notNull(),
  reviewStatus: text("review_status").notNull(),
  isDisputed: boolean("is_disputed").notNull().default(false),
  limitations: text("limitations").notNull(),
  applicabilityScope: text("applicability_scope").notNull(),
  sourceIds: jsonb("source_ids").$type<string[]>().notNull(),
});

export const prospects = pgTable("prospects", {
  id: text("id").primaryKey(),
  organisationId: text("organisation_id")
    .notNull()
    .references(() => organisations.id),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  name: text("name").notNull(),
  blockOrLicence: text("block_or_licence"),
  country: text("country").notNull().default("Nigeria"),
  basinName: text("basin_name").notNull(),
  subBasinOrProvince: text("sub_basin_or_province"),
  basinProfileId: text("basin_profile_id"),
  targetFormations: jsonb("target_formations").$type<string[]>().notNull(),
  description: text("description"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const documents = pgTable("documents", {
  id: text("id").primaryKey(),
  organisationId: text("organisation_id")
    .notNull()
    .references(() => organisations.id),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  prospectId: text("prospect_id")
    .notNull()
    .references(() => prospects.id),
  title: text("title").notNull(),
  documentType: text("document_type").notNull(),
  currentVersion: integer("current_version").notNull().default(1),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const documentVersions = pgTable("document_versions", {
  id: text("id").primaryKey(),
  organisationId: text("organisation_id")
    .notNull()
    .references(() => organisations.id),
  documentId: text("document_id")
    .notNull()
    .references(() => documents.id),
  versionNumber: integer("version_number").notNull(),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  sha256Checksum: text("sha256_checksum").notNull(),
  s3Bucket: text("s3_bucket").notNull(),
  s3ObjectKey: text("s3_object_key").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ingestionJobs = pgTable("ingestion_jobs", {
  id: text("id").primaryKey(),
  organisationId: text("organisation_id")
    .notNull()
    .references(() => organisations.id),
  documentVersionId: text("document_version_id")
    .notNull()
    .references(() => documentVersions.id),
  status: text("status").notNull(),
  extractionWarnings: jsonb("extraction_warnings").$type<string[]>().notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const extractedRecords = pgTable("extracted_records", {
  id: text("id").primaryKey(),
  organisationId: text("organisation_id")
    .notNull()
    .references(() => organisations.id),
  prospectId: text("prospect_id")
    .notNull()
    .references(() => prospects.id),
  documentVersionId: text("document_version_id")
    .notNull()
    .references(() => documentVersions.id),
  recordType: text("record_type").notNull(),
  rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>().notNull(),
  extractionMethod: text("extraction_method").notNull(),
  extractionQualityLabel: text("extraction_quality_label").notNull(),
  reviewStatus: text("review_status").notNull(),
});

export const wells = pgTable("wells", {
  id: text("id").primaryKey(),
  organisationId: text("organisation_id")
    .notNull()
    .references(() => organisations.id),
  prospectId: text("prospect_id")
    .notNull()
    .references(() => prospects.id),
  wellIdentifier: text("well_identifier").notNull(),
  totalDepthRaw: doublePrecision("total_depth_raw"),
  depthUnit: text("depth_unit"),
  depthDatum: text("depth_datum"),
  coordinateSystem: text("coordinate_system"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const wellIntervals = pgTable("well_intervals", {
  id: text("id").primaryKey(),
  organisationId: text("organisation_id")
    .notNull()
    .references(() => organisations.id),
  wellId: text("well_id")
    .notNull()
    .references(() => wells.id),
  formationName: text("formation_name").notNull(),
  topDepth: doublePrecision("top_depth"),
  bottomDepth: doublePrecision("bottom_depth"),
  depthType: text("depth_type"),
  depthUnit: text("depth_unit"),
  depthDatum: text("depth_datum"),
  reportedAge: text("reported_age"),
  lithologySummary: text("lithology_summary"),
  sourceLocationId: text("source_location_id"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const geologicalClaims = pgTable("geological_claims", {
  id: text("id").primaryKey(),
  organisationId: text("organisation_id")
    .notNull()
    .references(() => organisations.id),
  prospectId: text("prospect_id")
    .notNull()
    .references(() => prospects.id),
  geologicalElement: text("geological_element").notNull(),
  petroleumSystemElement: text("petroleum_system_element"),
  claimText: text("claim_text").notNull(),
  claimClassification: text("claim_classification").notNull(),
  stratigraphicApplicability: text("stratigraphic_applicability"),
  spatialApplicability: text("spatial_applicability"),
  conditionsAndLimitations: text("conditions_and_limitations"),
  qualitativeStatus: text("qualitative_status").notNull(),
  reviewStatus: text("review_status").notNull(),
  isAiSuggested: boolean("is_ai_suggested").notNull().default(false),
  currentRevision: integer("current_revision").notNull().default(1),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const evidenceItems = pgTable("evidence_items", {
  id: text("id").primaryKey(),
  organisationId: text("organisation_id")
    .notNull()
    .references(() => organisations.id),
  prospectId: text("prospect_id")
    .notNull()
    .references(() => prospects.id),
  documentVersionId: text("document_version_id"),
  sourceLocationId: text("source_location_id"),
  evidenceType: text("evidence_type").notNull(),
  geologicalSubject: text("geological_subject").notNull(),
  evidenceDescription: text("evidence_description").notNull(),
  wellIdentifier: text("well_identifier"),
  formation: text("formation"),
  depthIntervalRaw: text("depth_interval_raw"),
  depthUnit: text("depth_unit"),
  evidenceStrengthNote: text("evidence_strength_note"),
  reviewStatus: text("review_status").notNull(),
  createdBy: text("created_by").notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const claimEvidences = pgTable("claim_evidences", {
  id: text("id").primaryKey(),
  organisationId: text("organisation_id")
    .notNull()
    .references(() => organisations.id),
  claimId: text("claim_id")
    .notNull()
    .references(() => geologicalClaims.id),
  evidenceId: text("evidence_id")
    .notNull()
    .references(() => evidenceItems.id),
  relationshipRole: text("relationship_role").notNull(),
  rationale: text("rationale"),
  linkedBy: text("linked_by").notNull(),
});

export const analysisRuns = pgTable("analysis_runs", {
  id: text("id").primaryKey(),
  organisationId: text("organisation_id")
    .notNull()
    .references(() => organisations.id),
  prospectId: text("prospect_id")
    .notNull()
    .references(() => prospects.id),
  runType: text("run_type").notNull(),
  triggeredBy: text("triggered_by").notNull(),
  executedRuleVersions: jsonb("executed_rule_versions")
    .$type<Array<{ rule_code?: string; version: string; engine?: string }>>()
    .notNull(),
  aiModelUsed: text("ai_model_used"),
  status: text("status").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const contradictions = pgTable("contradictions", {
  id: text("id").primaryKey(),
  organisationId: text("organisation_id")
    .notNull()
    .references(() => organisations.id),
  prospectId: text("prospect_id")
    .notNull()
    .references(() => prospects.id),
  analysisRunId: text("analysis_run_id").notNull(),
  ruleCode: text("rule_code").notNull(),
  category: text("category").notNull(),
  outcomeClassification: text("outcome_classification").notNull(),
  severity: text("severity").notNull(),
  wellOrInterval: text("well_or_interval"),
  firstSourceLocationId: text("first_source_location_id"),
  secondSourceLocationId: text("second_source_location_id"),
  affectedClaimIds: jsonb("affected_claim_ids").$type<string[]>().notNull(),
  firstValueRaw: text("first_value_raw").notNull(),
  secondValueRaw: text("second_value_raw").notNull(),
  units: text("units"),
  explanation: text("explanation").notNull(),
  possibleGeologicalCauses: jsonb("possible_geological_causes").$type<string[]>().notNull(),
  reviewStatus: text("review_status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const petroleumSystemElements = pgTable("petroleum_system_elements", {
  id: text("id").primaryKey(),
  organisationId: text("organisation_id")
    .notNull()
    .references(() => organisations.id),
  prospectId: text("prospect_id")
    .notNull()
    .references(() => prospects.id),
  elementType: text("element_type").notNull(),
  qualitativeStatus: text("qualitative_status").notNull(),
  statusRationale: text("status_rationale").notNull(),
  missingEvidenceSummary: jsonb("missing_evidence_summary").$type<string[]>().notNull(),
  reviewStatus: text("review_status").notNull(),
});

export const falsificationHypotheses = pgTable("falsification_hypotheses", {
  id: text("id").primaryKey(),
  organisationId: text("organisation_id")
    .notNull()
    .references(() => organisations.id),
  prospectId: text("prospect_id")
    .notNull()
    .references(() => prospects.id),
  elementId: text("element_id").notNull(),
  analysisRunId: text("analysis_run_id").notNull(),
  proposedFailureMechanism: text("proposed_failure_mechanism").notNull(),
  geologicalApplicability: text("geological_applicability").notNull(),
  relevanceConditions: text("relevance_conditions").notNull(),
  missingEvidence: jsonb("missing_evidence").$type<string[]>().notNull(),
  knowledgeSourceIds: jsonb("knowledge_source_ids").$type<string[]>().notNull(),
  confidenceRationale: text("confidence_rationale").notNull(),
  isAiSuggested: boolean("is_ai_suggested").notNull().default(true),
  reviewStatus: text("review_status").notNull(),
  reviewedBy: text("reviewed_by"),
  reviewerNotes: text("reviewer_notes"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const investigations = pgTable("investigations", {
  id: text("id").primaryKey(),
  organisationId: text("organisation_id")
    .notNull()
    .references(() => organisations.id),
  prospectId: text("prospect_id")
    .notNull()
    .references(() => prospects.id),
  hypothesisId: text("hypothesis_id").notNull(),
  title: text("title").notNull(),
  discriminatingObjective: text("discriminating_objective").notNull(),
  requiredDataOrTest: text("required_data_or_test").notNull(),
  userSuppliedCostEstimate: text("user_supplied_cost_estimate"),
  userSuppliedTimeEstimate: text("user_supplied_time_estimate"),
  technicalFeasibilityNote: text("technical_feasibility_note"),
  priorityRank: integer("priority_rank").notNull(),
  decisionRelevance: text("decision_relevance").notNull(),
  discriminationPower: text("discrimination_power").notNull(),
  prioritisationRationale: text("prioritisation_rationale").notNull(),
});

export const assessments = pgTable("assessments", {
  id: text("id").primaryKey(),
  organisationId: text("organisation_id")
    .notNull()
    .references(() => organisations.id),
  projectId: text("project_id").notNull(),
  prospectId: text("prospect_id")
    .notNull()
    .references(() => prospects.id),
  title: text("title").notNull(),
  currentVersion: integer("current_version").notNull().default(1),
  createdBy: text("created_by").notNull(),
});

export const assessmentVersions = pgTable("assessment_versions", {
  id: text("id").primaryKey(),
  organisationId: text("organisation_id")
    .notNull()
    .references(() => organisations.id),
  assessmentId: text("assessment_id")
    .notNull()
    .references(() => assessments.id),
  prospectId: text("prospect_id")
    .notNull()
    .references(() => prospects.id),
  versionNumber: integer("version_number").notNull(),
  scopeAndLimitations: text("scope_and_limitations").notNull(),
  snapshotData: jsonb("snapshot_data").$type<Record<string, unknown>>().notNull(),
  pdfS3Key: text("pdf_s3_key").notNull(),
  pdfSha256: text("pdf_sha256").notNull(),
  generatedBy: text("generated_by").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  organisationId: text("organisation_id")
    .notNull()
    .references(() => organisations.id),
  projectId: text("project_id"),
  actorUserId: text("actor_user_id"),
  eventType: text("event_type").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  eventMetadata: jsonb("event_metadata").$type<Record<string, unknown>>().notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
});

export const storedObjects = pgTable("stored_objects", {
  objectKey: text("object_key").primaryKey(),
  organisationId: text("organisation_id")
    .notNull()
    .references(() => organisations.id),
  contentType: text("content_type").notNull(),
  byteLength: integer("byte_length").notNull(),
  sha256: text("sha256").notNull(),
  data: bytea("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
