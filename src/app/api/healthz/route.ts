import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "strataproof-api",
    version: "0.1.0",
  });
}
