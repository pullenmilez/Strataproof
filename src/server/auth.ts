import crypto from "crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "../db/index.ts";
import {
  organisationMemberships,
  organisations,
  users,
} from "../db/schema.ts";
import { adminAuth } from "../lib/firebase-admin.ts";
import { UserRole } from "./enums.ts";

const SECRET =
  process.env.APP_SECRET_KEY ||
  "strataproof-dev-ephemeral-secret-key-not-for-production-use";

export interface TenantUser {
  id: string;
  uid: string | null;
  email: string;
  fullName: string;
  professionalCredentials: string | null;
  isActive: boolean;
}

export interface TenantOrganisation {
  id: string;
  name: string;
  slug: string;
  country: string;
  aiProcessingAuthorized: boolean;
}

export interface TenantContext {
  user: TenantUser;
  organisation: TenantOrganisation;
  role: UserRole;
}

interface JwtPayload {
  sub: string;
  org_id: string;
  role: UserRole;
  exp: number;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string | null): boolean {
  if (!storedHash) return false;
  const [salt, keyHex] = storedHash.split(":");
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, "hex");
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string): string {
  const padLen = (4 - (input.length % 4)) % 4;
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLen);
  return Buffer.from(padded, "base64").toString("utf-8");
}

export function createAccessToken(
  userId: string,
  organisationId: string,
  role: UserRole
): string {
  const expireMinutes = Number(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || 480);
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload: JwtPayload = {
    sub: userId,
    org_id: organisationId,
    role,
    exp: Math.floor(Date.now() / 1000) + expireMinutes * 60,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = base64UrlEncode(
    crypto.createHmac("sha256", SECRET).update(`${header}.${encodedPayload}`).digest()
  );
  return `${header}.${encodedPayload}.${signature}`;
}

export function verifyAccessToken(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payloadB64, sig] = parts;
  const expectedSig = base64UrlEncode(
    crypto.createHmac("sha256", SECRET).update(`${header}.${payloadB64}`).digest()
  );
  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    return null;
  }
  try {
    const decoded = JSON.parse(base64UrlDecode(payloadB64)) as JwtPayload;
    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function createDownloadSignature(versionId: string, orgId: string): string {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const data = `${versionId}:${orgId}:${exp}`;
  const hmac = crypto.createHmac("sha256", SECRET).update(data).digest("hex");
  return `${exp}.${hmac}`;
}

export function verifyDownloadSignature(
  versionId: string,
  orgId: string,
  sigParam: string | null
): boolean {
  if (!sigParam) return false;
  const [expStr, hmac] = sigParam.split(".");
  const exp = Number(expStr);
  if (!exp || !hmac || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(`${versionId}:${orgId}:${exp}`)
    .digest("hex");
  if (hmac.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected));
}

export async function getOrCreateFirebaseUser(
  uid: string,
  email: string,
  fullName?: string | null
) {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const existingByEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail));

    if (existingByEmail.length > 0 && !existingByEmail[0].uid) {
      const [updated] = await db
        .update(users)
        .set({ uid })
        .where(eq(users.id, existingByEmail[0].id))
        .returning();
      return updated;
    }

    const result = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        uid,
        email: normalizedEmail,
        fullName: (fullName || normalizedEmail.split("@")[0] || "Geoscientist").trim(),
        passwordHash: null,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: normalizedEmail,
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error("Failed to upsert Firebase user:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}

export async function verifyFirebaseBearerToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return null;
  try {
    return await adminAuth.verifyIdToken(token);
  } catch {
    return null;
  }
}

export async function getTenantContext(
  req: NextRequest,
  allowedRoles?: UserRole[]
): Promise<{ ctx: TenantContext } | { error: NextResponse }> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return {
      error: NextResponse.json({ detail: "Not authenticated." }, { status: 401 }),
    };
  }

  const headerOrgId = req.headers.get("x-organisation-id");

  try {
    // 1. Check custom tenant HMAC JWT
    const decodedJwt = verifyAccessToken(token);
    if (decodedJwt) {
      if (headerOrgId && headerOrgId !== decodedJwt.org_id) {
        return {
          error: NextResponse.json(
            { detail: "X-Organisation-ID does not match active tenant token." },
            { status: 403 }
          ),
        };
      }

      const [user] = await db.select().from(users).where(eq(users.id, decodedJwt.sub));
      const [org] = await db
        .select()
        .from(organisations)
        .where(eq(organisations.id, decodedJwt.org_id));

      if (!user || !user.isActive || !org) {
        return {
          error: NextResponse.json({ detail: "Invalid tenant context." }, { status: 401 }),
        };
      }

      const [membership] = await db
        .select()
        .from(organisationMemberships)
        .where(
          and(
            eq(organisationMemberships.userId, user.id),
            eq(organisationMemberships.organisationId, org.id),
            isNull(organisationMemberships.deletedAt)
          )
        );

      if (!membership) {
        return {
          error: NextResponse.json(
            { detail: "No active membership in organisation." },
            { status: 403 }
          ),
        };
      }

      const role = membership.role as UserRole;
      if (allowedRoles && !allowedRoles.includes(role)) {
        return {
          error: NextResponse.json(
            { detail: "Insufficient role privileges for this operation." },
            { status: 403 }
          ),
        };
      }

      return { ctx: { user, organisation: org, role } };
    }

    // 2. Fallback to Firebase ID Token verification
    let decodedFirebase;
    try {
      decodedFirebase = await adminAuth.verifyIdToken(token);
    } catch {
      return {
        error: NextResponse.json({ detail: "Invalid or expired token." }, { status: 401 }),
      };
    }

    const fbEmail = decodedFirebase.email || `${decodedFirebase.uid}@google.local`;
    const dbUser = await getOrCreateFirebaseUser(
      decodedFirebase.uid,
      fbEmail,
      decodedFirebase.name
    );

    if (!dbUser.isActive) {
      return {
        error: NextResponse.json({ detail: "User account is disabled." }, { status: 403 }),
      };
    }

    const memberships = await db
      .select()
      .from(organisationMemberships)
      .where(
        and(
          eq(organisationMemberships.userId, dbUser.id),
          isNull(organisationMemberships.deletedAt)
        )
      )
      .orderBy(desc(organisationMemberships.isDefault));

    const targetMembership = headerOrgId
      ? memberships.find((m) => m.organisationId === headerOrgId)
      : memberships[0];

    if (!targetMembership) {
      return {
        error: NextResponse.json(
          { detail: "No active organisation membership found." },
          { status: 403 }
        ),
      };
    }

    const [org] = await db
      .select()
      .from(organisations)
      .where(eq(organisations.id, targetMembership.organisationId));

    if (!org) {
      return {
        error: NextResponse.json({ detail: "Invalid organisation." }, { status: 403 }),
      };
    }

    const role = targetMembership.role as UserRole;
    if (allowedRoles && !allowedRoles.includes(role)) {
      return {
        error: NextResponse.json(
          { detail: "Insufficient role privileges for this operation." },
          { status: 403 }
        ),
      };
    }

    return { ctx: { user: dbUser, organisation: org, role } };
  } catch (error) {
    console.error("Tenant auth verification failed:", error);
    return {
      error: NextResponse.json(
        { detail: "Authentication service error. Please try again." },
        { status: 500 }
      ),
    };
  }
}
