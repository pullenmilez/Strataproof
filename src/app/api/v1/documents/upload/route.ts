import crypto from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/index.ts";
import {
  documents,
  documentVersions,
  extractedRecords,
  ingestionJobs,
  prospects,
  storedObjects,
} from "@/db/schema.ts";
import { recordAuditEvent } from "@/server/audit.ts";
import { getTenantContext } from "@/server/auth.ts";
import { ProcessingStatus, ReviewStatus, UserRole } from "@/server/enums.ts";

export async function POST(req: NextRequest) {
  const auth = await getTenantContext(req, [
    UserRole.ORG_ADMIN,
    UserRole.LEAD_GEOLOGIST,
    UserRole.GEOSCIENTIST,
  ]);
  if ("error" in auth) return auth.error;
  const { organisation, user } = auth.ctx;

  try {
    const formData = await req.formData();
    const prospectId = String(formData.get("prospect_id") || "");
    const title = String(formData.get("title") || "").trim();
    const documentType = String(formData.get("document_type") || "").trim();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ detail: "File upload is required." }, { status: 422 });
    }

    const [prospect] = await db
      .select()
      .from(prospects)
      .where(
        and(
          eq(prospects.id, prospectId),
          eq(prospects.organisationId, organisation.id),
          isNull(prospects.deletedAt)
        )
      );

    if (!prospect) {
      return NextResponse.json(
        { detail: "Prospect not found in your organisation." },
        { status: 404 }
      );
    }

    const rawBytes = Buffer.from(await file.arrayBuffer());
    const sha256 = crypto.createHash("sha256").update(rawBytes).digest("hex");
    const safeName = (file.name || "document.bin").replace(/[^a-zA-Z0-9._-]/g, "_");
    const docId = crypto.randomUUID();
    const now = new Date();
    const s3Key = `org/${organisation.id}/projects/${prospect.projectId}/documents/${docId}/v1_${safeName}`;
    const mimeType = file.type || "application/octet-stream";

    const [doc] = await db
      .insert(documents)
      .values({
        id: docId,
        organisationId: organisation.id,
        projectId: prospect.projectId,
        prospectId: prospect.id,
        title: title || safeName,
        documentType: documentType || "WELL_REPORT",
        currentVersion: 1,
        createdBy: user.id,
        createdAt: now,
        deletedAt: null,
      })
      .returning();

    await db.insert(storedObjects).values({
      objectKey: s3Key,
      organisationId: organisation.id,
      contentType: mimeType,
      byteLength: rawBytes.byteLength,
      sha256,
      data: rawBytes,
      createdAt: now,
    });

    const docVerId = crypto.randomUUID();
    const [docVer] = await db
      .insert(documentVersions)
      .values({
        id: docVerId,
        organisationId: organisation.id,
        documentId: docId,
        versionNumber: 1,
        originalFilename: safeName,
        mimeType,
        fileSizeBytes: rawBytes.byteLength,
        sha256Checksum: sha256,
        s3Bucket: "strataproof-customer-docs",
        s3ObjectKey: s3Key,
        uploadedBy: user.id,
        createdAt: now,
      })
      .returning();

    await db.insert(ingestionJobs).values({
      id: crypto.randomUUID(),
      organisationId: organisation.id,
      documentVersionId: docVerId,
      status: ProcessingStatus.COMPLETED,
      extractionWarnings: [],
      errorMessage: null,
      createdAt: now,
      completedAt: now,
    });

    await db.insert(extractedRecords).values({
      id: crypto.randomUUID(),
      organisationId: organisation.id,
      prospectId: prospect.id,
      documentVersionId: docVerId,
      recordType: "DOCUMENT_UPLOAD_RECORD",
      rawPayload: { filename: safeName, size: rawBytes.byteLength, sha256 },
      extractionMethod: "inline_ingestion",
      extractionQualityLabel: "DETERMINISTIC_DIRECT",
      reviewStatus: ReviewStatus.UNREVIEWED,
    });

    await recordAuditEvent({
      organisation_id: organisation.id,
      project_id: prospect.projectId,
      actor_user_id: user.id,
      event_type: "DOCUMENT_VERSION_UPLOADED",
      entity_type: "document_version",
      entity_id: docVerId,
      event_metadata: { filename: safeName, sha256, version: 1 },
    });

    return NextResponse.json(
      {
        id: doc.id,
        organisation_id: doc.organisationId,
        project_id: doc.projectId,
        prospect_id: doc.prospectId,
        title: doc.title,
        document_type: doc.documentType,
        current_version: doc.currentVersion,
        created_by: doc.createdBy,
        created_at: doc.createdAt.toISOString(),
        versions: [
          {
            id: docVer.id,
            version_number: docVer.versionNumber,
            original_filename: docVer.originalFilename,
            mime_type: docVer.mimeType,
            file_size_bytes: docVer.fileSizeBytes,
            sha256_checksum: docVer.sha256Checksum,
            created_at: docVer.createdAt.toISOString(),
          },
        ],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to upload document:", error);
    return NextResponse.json(
      { detail: "Failed to persist uploaded document." },
      { status: 500 }
    );
  }
}
