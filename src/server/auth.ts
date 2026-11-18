import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "./enums";
import { getStore, Organisation, User } from "./store";

const SECRET =
  process.env.APP_SECRET_KEY ||
  "strataproof-dev-ephemeral-secret-key-not-for-production-use";

export interface TenantContext {
  user: User;
  organisation: Organisation;
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

export function verifyPassword(password: string, storedHash: string): boolean {
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

export function getTenantContext(
  req: NextRequest,
  allowedRoles?: UserRole[]
): { ctx: TenantContext } | { error: NextResponse } {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return {
      error: NextResponse.json({ detail: "Not authenticated." }, { status: 401 }),
    };
  }

  const decoded = verifyAccessToken(token);
  if (!decoded) {
    return {
      error: NextResponse.json({ detail: "Invalid or expired token." }, { status: 401 }),
    };
  }

  const headerOrgId = req.headers.get("x-organisation-id");
  if (headerOrgId && headerOrgId !== decoded.org_id) {
    return {
      error: NextResponse.json(
        { detail: "X-Organisation-ID does not match active tenant token." },
        { status: 403 }
      ),
    };
  }

  const store = getStore();
  const user = store.users.get(decoded.sub);
  const org = store.organisations.get(decoded.org_id);
  if (!user || !user.is_active || !org) {
    return {
      error: NextResponse.json({ detail: "Invalid tenant context." }, { status: 401 }),
    };
  }

  const membership = store.memberships.find(
    (m) =>
      m.user_id === user.id &&
      m.organisation_id === org.id &&
      m.deleted_at === null
  );
  if (!membership) {
    return {
      error: NextResponse.json(
        { detail: "No active membership in organisation." },
        { status: 403 }
      ),
    };
  }

  if (allowedRoles && !allowedRoles.includes(membership.role)) {
    return {
      error: NextResponse.json(
        { detail: "Insufficient role privileges for this operation." },
        { status: 403 }
      ),
    };
  }

  return {
    ctx: {
      user,
      organisation: org,
      role: membership.role,
    },
  };
}
