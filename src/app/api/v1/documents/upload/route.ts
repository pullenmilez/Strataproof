import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/server/auth";
import { ProcessingStatus, ReviewStatus, UserRole } from "@/server/enums";
import { getStore, recordAuditEvent } from "@/server/store";

export async function POST(req: NextRequest) {
  const auth = getTenantContext(req, [
    UserRole.ORG_ADMIN,
    UserRole.LEAD_GEOLOGIST,
    UserRole.GEOSCIENTIST,
  ]);
  if ("error" in auth) return auth.error;
  const { organisation, user } = auth.ctx;

  const formData = await req.formData();
  const prospectId = String(formData.get("prospect_id") || "");
  const title = String(formData.get("title") || "").trim();
  const documentType = String(formData.get("document_type") || "").trim();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ detail: "File upload is required." }, { status: 422 });
  }

  const store = getStore();
  const prospect = store.prospects.get(prospectId);
  if (
    !prospect ||
    prospect.organisation_id !== organisation.id ||
    prospect.deleted_at !== null
  ) {
    return NextResponse.json(
      { detail: "Prospect not found in your organisation." },
      { status: 404 }
    );
  }

  const rawBytes = Buffer.from(await file.arrayBuffer());
  const sha256 = crypto.createHash("sha256").update(rawBytes).digest("hex");
  const safeName = (file.name || "document.bin").replace(/[^a-zA-Z0-9._-]/g, "_");
  const docId = crypto.randomUUID();
  const now = new Date().toISOString();

  const doc = {
    id: docId,
    organisation_id: organisation.id,
    project_id: prospect.project_id,
    prospect_id: prospect.id,
    title: title || safeName,
    document_type: documentType || "WELL_REPORT",
    current_version: 1,
    created_by: user.id,
    created_at: now,
    deleted_at: null,
  };
  store.documents.set(docId, doc);

  const s3Key = `org/${organisation.id}/projects/${prospect.project_id}/documents/${docId}/v1_${safeName}`;
  store.objectStorage.set(s3Key, rawBytes);

  const docVerId = crypto.randomUUID();
  const docVer = {
    id: docVerId,
    organisation_id: organisation.id,
    document_id: docId,
    version_number: 1,
    original_filename: safeName,
    mime_type: file.type || "application/octet-stream",
    file_size_bytes: rawBytes.byteLength,
    sha256_checksum: sha256,
    s3_bucket: "strataproof-customer-docs",
    s3_object_key: s3Key,
    uploaded_by: user.id,
    created_at: now,
  };
  store.documentVersions.set(docVerId, docVer);

  const jobId = crypto.randomUUID();
  store.ingestionJobs.set(jobId, {
    id: jobId,
    organisation_id: organisation.id,
    document_version_id: docVerId,
    status: ProcessingStatus.COMPLETED,
    extraction_warnings: [],
    error_message: null,
    created_at: now,
    completed_at: now,
  });

  store.extractedRecords.push({
    id: crypto.randomUUID(),
    organisation_id: organisation.id,
    prospect_id: prospect.id,
    document_version_id: docVerId,
    record_type: "DOCUMENT_UPLOAD_RECORD",
    raw_payload: { filename: safeName, size: rawBytes.byteLength, sha256 },
    extraction_method: "inline_ingestion",
    extraction_quality_label: "DETERMINISTIC_DIRECT",
    review_status: ReviewStatus.UNREVIEWED,
  });

  recordAuditEvent({
    organisation_id: organisation.id,
    project_id: prospect.project_id,
    actor_user_id: user.id,
    event_type: "DOCUMENT_VERSION_UPLOADED",
    entity_type: "document_version",
    entity_id: docVerId,
    event_metadata: { filename: safeName, sha256, version: 1 },
  });

  return NextResponse.json(
    {
      ...doc,
      versions: [docVer],
    },
    { status: 201 }
  );
}
