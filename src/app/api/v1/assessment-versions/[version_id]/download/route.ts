import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/index.ts";
import { assessmentVersions, storedObjects } from "@/db/schema.ts";
import { getTenantContext, verifyDownloadSignature } from "@/server/auth.ts";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ version_id: string }> }
) {
  const { version_id } = await context.params;

  try {
    const [av] = await db
      .select()
      .from(assessmentVersions)
      .where(eq(assessmentVersions.id, version_id));

    if (!av) {
      return NextResponse.json(
        { detail: "Assessment version not found." },
        { status: 404 }
      );
    }

    const sig = req.nextUrl.searchParams.get("sig");
    const hasValidSig = verifyDownloadSignature(av.id, av.organisationId, sig);

    if (!hasValidSig) {
      const auth = await getTenantContext(req);
      if ("error" in auth) return auth.error;
      if (av.organisationId !== auth.ctx.organisation.id) {
        return NextResponse.json(
          { detail: "Assessment version not found." },
          { status: 404 }
        );
      }
    }

    const [obj] = await db
      .select()
      .from(storedObjects)
      .where(eq(storedObjects.objectKey, av.pdfS3Key));

    if (!obj) {
      return NextResponse.json({ detail: "PDF artifact not found." }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(obj.data), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="strataproof_assessment_v${av.versionNumber}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to download PDF report:", error);
    return NextResponse.json(
      { detail: "Failed to retrieve PDF report." },
      { status: 500 }
    );
  }
}
