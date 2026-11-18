import { NextRequest, NextResponse } from "next/server";
import { getTenantContext, verifyDownloadSignature } from "@/server/auth";
import { getStore } from "@/server/store";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ version_id: string }> }
) {
  const { version_id } = await context.params;
  const store = getStore();
  const av = store.assessmentVersions.get(version_id);

  if (!av) {
    return NextResponse.json(
      { detail: "Assessment version not found." },
      { status: 404 }
    );
  }

  const sig = req.nextUrl.searchParams.get("sig");
  const hasValidSig = verifyDownloadSignature(av.id, av.organisation_id, sig);

  if (!hasValidSig) {
    const auth = getTenantContext(req);
    if ("error" in auth) return auth.error;
    if (av.organisation_id !== auth.ctx.organisation.id) {
      return NextResponse.json(
        { detail: "Assessment version not found." },
        { status: 404 }
      );
    }
  }

  const pdfBytes = store.objectStorage.get(av.pdf_s3_key);
  if (!pdfBytes) {
    return NextResponse.json({ detail: "PDF artifact not found." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="strataproof_assessment_v${av.version_number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
