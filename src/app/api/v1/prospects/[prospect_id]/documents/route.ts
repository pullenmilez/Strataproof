import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/index.ts";
import { documents, documentVersions, prospects } from "@/db/schema.ts";
import { getTenantContext } from "@/server/auth.ts";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ prospect_id: string }> }
) {
  const auth = await getTenantContext(req);
  if ("error" in auth) return auth.error;
  const { organisation } = auth.ctx;
  const { prospect_id } = await context.params;

  try {
    const [prospect] = await db
      .select({ id: prospects.id })
      .from(prospects)
      .where(
        and(
          eq(prospects.id, prospect_id),
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

    const docs = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.prospectId, prospect_id),
          eq(documents.organisationId, organisation.id),
          isNull(documents.deletedAt)
        )
      )
      .orderBy(desc(documents.createdAt));

    const docIds = docs.map((d) => d.id);
    const versions =
      docIds.length > 0
        ? await db
            .select()
            .from(documentVersions)
            .where(inArray(documentVersions.documentId, docIds))
            .orderBy(desc(documentVersions.versionNumber))
        : [];

    const versionMap = new Map<string, typeof versions>();
    for (const v of versions) {
      const arr = versionMap.get(v.documentId) || [];
      arr.push(v);
      versionMap.set(v.documentId, arr);
    }

    return NextResponse.json(
      docs.map((d) => ({
        id: d.id,
        organisation_id: d.organisationId,
        project_id: d.projectId,
        prospect_id: d.prospectId,
        title: d.title,
        document_type: d.documentType,
        current_version: d.currentVersion,
        created_at: d.createdAt.toISOString(),
        versions: (versionMap.get(d.id) || []).map((v) => ({
          id: v.id,
          version_number: v.versionNumber,
          original_filename: v.originalFilename,
          mime_type: v.mimeType,
          file_size_bytes: v.fileSizeBytes,
          sha256_checksum: v.sha256Checksum,
          created_at: v.createdAt.toISOString(),
        })),
      }))
    );
  } catch (error) {
    console.error("Failed to list prospect documents:", error);
    return NextResponse.json(
      { detail: "Failed to load prospect documents." },
      { status: 500 }
    );
  }
}
