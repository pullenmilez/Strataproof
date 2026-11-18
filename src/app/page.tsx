"use client";

import React, { useCallback, useEffect, useState } from "react";
import { signInWithPopup, signOut as firebaseSignOut } from "firebase/auth";
import { FileText, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { apiRequest, AuthSession } from "@/lib/api";
import { getFirebaseAuth, getGoogleAuthProvider } from "@/lib/firebase";

interface BasinProfileDto {
  id: string;
  country: string;
  basin_name: string;
  basin_category: string;
  sub_basins_or_provinces: string[];
  tectonic_summary: string;
  stratigraphic_overview: string;
  known_uncertainties_and_gaps: string;
  review_status: string;
}

interface UserProfileDto {
  user_id: string;
  email: string;
  full_name: string;
  professional_credentials: string | null;
  organisation_id: string;
  organisation_name: string;
  role: string;
}

interface ProjectDto {
  id: string;
  organisation_id: string;
  name: string;
  code: string;
  country: string;
  description: string | null;
  created_at: string;
}

interface ProspectDto {
  id: string;
  organisation_id: string;
  project_id: string;
  name: string;
  block_or_licence: string | null;
  country: string;
  basin_name: string;
  sub_basin_or_province: string | null;
  target_formations: string[];
  description: string | null;
  created_at: string;
}

interface ClaimDto {
  id: string;
  geological_element: string;
  claim_classification: string;
  claim_text: string;
  qualitative_status: string;
  review_status: string;
}

interface ContradictionDto {
  id: string;
  severity: string;
  category: string;
  outcome_classification: string;
  well_or_interval: string | null;
  explanation: string;
  first_value_raw: string;
  second_value_raw: string;
}

interface PetroleumSystemElementDto {
  id: string;
  element_type: string;
  qualitative_status: string;
  status_rationale: string;
}

interface HypothesisDto {
  id: string;
  geological_applicability: string;
  review_status: string;
  proposed_failure_mechanism: string;
  confidence_rationale: string;
}

interface InvestigationDto {
  id: string;
  priority_rank: number;
  title: string;
  decision_relevance: string;
  discriminating_objective: string;
  required_data_or_test: string;
}

interface AssessmentVersionDto {
  id: string;
  assessment_id: string;
  version_number: number;
  pdf_sha256: string;
  generated_at: string;
  download_url: string | null;
}

interface DocumentDto {
  id: string;
  title: string;
  document_type: string;
  current_version: number;
  created_at: string;
  versions: Array<{
    id: string;
    version_number: number;
    original_filename: string;
    mime_type: string;
    file_size_bytes: number;
    sha256_checksum: string;
    created_at: string;
  }>;
}

interface AuditEventDto {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  occurred_at: string;
}

interface GoogleSessionResponse {
  needs_onboarding: boolean;
  email?: string;
  full_name?: string;
  access_token?: string;
  user_id?: string;
  organisation_id?: string;
  role?: string;
}

export default function StrataProofWorkspace() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Auth form state
  const [isRegister, setIsRegister] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [googleIdToken, setGoogleIdToken] = useState<string | null>(null);
  const [onboardOrgName, setOnboardOrgName] = useState("");
  const [onboardFullName, setOnboardFullName] = useState("");
  const [isAuthBusy, setIsAuthBusy] = useState(false);

  // Domain state
  const [basins, setBasins] = useState<BasinProfileDto[]>([]);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [prospects, setProspects] = useState<ProspectDto[]>([]);
  const [selectedProspect, setSelectedProspect] = useState<ProspectDto | null>(null);
  const [claims, setClaims] = useState<ClaimDto[]>([]);
  const [contradictions, setContradictions] = useState<ContradictionDto[]>([]);
  const [psElements, setPsElements] = useState<PetroleumSystemElementDto[]>([]);
  const [hypotheses, setHypotheses] = useState<HypothesisDto[]>([]);
  const [investigations, setInvestigations] = useState<InvestigationDto[]>([]);
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEventDto[]>([]);
  const [latestAssessment, setLatestAssessment] = useState<AssessmentVersionDto | null>(null);

  // Quick creation forms
  const [projectName, setProjectName] = useState("Niger Delta Block OML-X Assurance");
  const [projectCode, setProjectCode] = useState("ND-OMLX");
  const [prospectName, setProspectName] = useState("Bonga-South Deep Prospect");
  const [basinName, setBasinName] = useState("Niger Delta Basin");

  const [claimElement, setClaimElement] = useState("Top Seal Integrity");
  const [psElementType, setPsElementType] = useState("SEAL");
  const [claimClass, setClaimClass] = useState("ASSUMPTION");
  const [claimText, setClaimText] = useState("");

  // Document upload form
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState("WELL_REPORT");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const refreshProspectData = useCallback(
    async (prospectId: string, activeSession: AuthSession) => {
      const [cl, ct, ps, hy, inv, docs, evs] = await Promise.all([
        apiRequest<ClaimDto[]>(`/prospects/${prospectId}/claims`, {}, activeSession),
        apiRequest<ContradictionDto[]>(`/prospects/${prospectId}/contradictions`, {}, activeSession),
        apiRequest<PetroleumSystemElementDto[]>(`/prospects/${prospectId}/petroleum-system`, {}, activeSession),
        apiRequest<HypothesisDto[]>(`/prospects/${prospectId}/hypotheses`, {}, activeSession),
        apiRequest<InvestigationDto[]>(`/prospects/${prospectId}/investigations`, {}, activeSession),
        apiRequest<DocumentDto[]>(`/prospects/${prospectId}/documents`, {}, activeSession),
        apiRequest<AuditEventDto[]>("/audit/events?limit=25", {}, activeSession),
      ]);
      setClaims(cl);
      setContradictions(ct);
      setPsElements(ps);
      setHypotheses(hy);
      setInvestigations(inv);
      setDocuments(docs);
      setAuditEvents(evs);
    },
    []
  );

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setIsAuthBusy(true);
    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const body = isRegister
        ? { email, password, full_name: fullName, organisation_name: orgName, country: "Nigeria" }
        : { email, password };
      const tok = await apiRequest<AuthSession>(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setSession(tok);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setIsAuthBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    setErrorMsg(null);
    setIsAuthBusy(true);
    try {
      const cred = await signInWithPopup(getFirebaseAuth(), getGoogleAuthProvider());
      const idToken = await cred.user.getIdToken();
      const res = await fetch("/api/v1/auth/google-session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
      });
      const body = (await res.json().catch(() => ({}))) as GoogleSessionResponse & {
        detail?: string;
      };
      if (!res.ok) {
        throw new Error(body.detail || "Google sign-in verification failed");
      }

      if (body.needs_onboarding) {
        setGoogleIdToken(idToken);
        setOnboardFullName(body.full_name || cred.user.displayName || "");
        return;
      }

      if (body.access_token && body.user_id && body.organisation_id && body.role) {
        setSession({
          access_token: body.access_token,
          user_id: body.user_id,
          organisation_id: body.organisation_id,
          role: body.role,
        });
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Google Sign-In failed");
    } finally {
      setIsAuthBusy(false);
    }
  }

  async function handleGoogleOnboardSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!googleIdToken) return;
    setErrorMsg(null);
    setIsAuthBusy(true);
    try {
      const res = await fetch("/api/v1/auth/google-onboard", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleIdToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organisation_name: onboardOrgName,
          full_name: onboardFullName,
          country: "Nigeria",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.detail || "Organisation creation failed");
      }
      setGoogleIdToken(null);
      setSession(body as AuthSession);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Organisation creation failed");
    } finally {
      setIsAuthBusy(false);
    }
  }

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const [me, basinList, projList, prospectList, eventList] = await Promise.all([
          apiRequest<UserProfileDto>("/auth/me", {}, session),
          apiRequest<BasinProfileDto[]>("/knowledge/basins?country=Nigeria", {}, session),
          apiRequest<ProjectDto[]>("/projects", {}, session),
          apiRequest<ProspectDto[]>("/prospects", {}, session),
          apiRequest<AuditEventDto[]>("/audit/events?limit=25", {}, session),
        ]);
        if (cancelled) return;
        setProfile(me);
        setBasins(basinList);
        setProjects(projList);
        setProspects(prospectList);
        setAuditEvents(eventList);

        if (prospectList.length > 0) {
          setSelectedProspect(prospectList[0]);
          await refreshProspectData(prospectList[0].id, session);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : "Failed to load workspace");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, refreshProspectData]);

  async function handleSelectProspect(prospectId: string) {
    if (!session) return;
    const found = prospects.find((p) => p.id === prospectId) || null;
    setSelectedProspect(found);
    setLatestAssessment(null);
    if (found) {
      setErrorMsg(null);
      try {
        await refreshProspectData(found.id, session);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to load prospect details");
      }
    }
  }

  async function createProjectAndProspect() {
    if (!session) return;
    setErrorMsg(null);
    setIsBusy(true);
    try {
      const proj = await apiRequest<ProjectDto>(
        "/projects",
        {
          method: "POST",
          body: JSON.stringify({ name: projectName, code: projectCode, country: "Nigeria" }),
        },
        session
      );
      setProjects((prev) => [proj, ...prev]);
      const prosp = await apiRequest<ProspectDto>(
        "/prospects",
        {
          method: "POST",
          body: JSON.stringify({
            project_id: proj.id,
            name: prospectName,
            country: "Nigeria",
            basin_name: basinName,
            target_formations: ["Agbada Formation", "Akata Formation"],
          }),
        },
        session
      );
      setProspects((prev) => [prosp, ...prev]);
      setSelectedProspect(prosp);
      setLatestAssessment(null);
      await refreshProspectData(prosp.id, session);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create prospect");
    } finally {
      setIsBusy(false);
    }
  }

  async function loadSampleProspect() {
    if (!session) return;
    setErrorMsg(null);
    setIsBusy(true);
    try {
      const prosp = await apiRequest<ProspectDto>(
        "/sample-prospect",
        { method: "POST", body: JSON.stringify({}) },
        session
      );
      const projList = await apiRequest<ProjectDto[]>("/projects", {}, session);
      setProjects(projList);
      setProspects((prev) => [prosp, ...prev]);
      setSelectedProspect(prosp);
      setLatestAssessment(null);
      await refreshProspectData(prosp.id, session);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load sample prospect");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCreateClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !selectedProspect) return;
    setErrorMsg(null);
    setIsBusy(true);
    try {
      await apiRequest(
        "/claims",
        {
          method: "POST",
          body: JSON.stringify({
            prospect_id: selectedProspect.id,
            geological_element: claimElement,
            petroleum_system_element: psElementType,
            claim_text: claimText,
            claim_classification: claimClass,
          }),
        },
        session
      );
      setClaimText("");
      await refreshProspectData(selectedProspect.id, session);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create claim");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDocumentUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !selectedProspect || !docFile) return;
    setErrorMsg(null);
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("prospect_id", selectedProspect.id);
      formData.append("title", docTitle.trim() || docFile.name);
      formData.append("document_type", docType);
      formData.append("file", docFile);

      await apiRequest("/documents/upload", { method: "POST", body: formData }, session);
      setDocTitle("");
      setDocFile(null);
      await refreshProspectData(selectedProspect.id, session);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Document upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  async function runValidationAndFalsification() {
    if (!session || !selectedProspect) return;
    setErrorMsg(null);
    setIsBusy(true);
    try {
      await apiRequest(`/prospects/${selectedProspect.id}/validate`, { method: "POST" }, session);
      await apiRequest(`/prospects/${selectedProspect.id}/falsify`, { method: "POST" }, session);
      await refreshProspectData(selectedProspect.id, session);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to run validation and falsification");
    } finally {
      setIsBusy(false);
    }
  }

  async function generatePdfReport() {
    if (!session || !selectedProspect) return;
    setErrorMsg(null);
    setIsBusy(true);
    try {
      const rep = await apiRequest<AssessmentVersionDto>(
        `/prospects/${selectedProspect.id}/assessments`,
        { method: "POST", body: JSON.stringify({}) },
        session
      );
      setLatestAssessment(rep);
      const evs = await apiRequest<AuditEventDto[]>("/audit/events?limit=25", {}, session);
      setAuditEvents(evs);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to generate PDF report");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleLogout() {
    if (typeof window !== "undefined") {
      await firebaseSignOut(getFirebaseAuth()).catch(() => {});
    }
    setSession(null);
    setProfile(null);
    setProjects([]);
    setProspects([]);
    setSelectedProspect(null);
    setClaims([]);
    setContradictions([]);
    setPsElements([]);
    setHypotheses([]);
    setInvestigations([]);
    setDocuments([]);
    setAuditEvents([]);
    setLatestAssessment(null);
    setGoogleIdToken(null);
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-7 shadow-xl">
          <div className="text-xs font-bold tracking-widest text-amber-400 uppercase">STRATAPROOF MVP 0.1</div>
          <h1 className="text-2xl font-bold mt-1">Geological Evidence Assurance</h1>
          <p className="text-xs text-slate-400 mt-1 mb-5">
            Multi-tenant workspace for petroleum exploration prospect falsification and auditability.
          </p>

          {errorMsg && (
            <div className="mb-4 p-3 rounded bg-red-950/70 border border-red-700 text-xs text-red-200">{errorMsg}</div>
          )}

          {googleIdToken ? (
            <form onSubmit={handleGoogleOnboardSubmit} className="space-y-3">
              <div className="p-3 rounded bg-slate-800/70 border border-slate-700 text-xs text-slate-300">
                Google account verified. Enter your tenant organisation details to initialize your workspace.
              </div>
              <input
                className="w-full px-3 py-2.5 rounded bg-slate-800 border border-slate-700 text-sm"
                placeholder="Organisation Name (e.g. Niger Delta Exploration Ltd)"
                value={onboardOrgName}
                onChange={(e) => setOnboardOrgName(e.target.value)}
                required
              />
              <input
                className="w-full px-3 py-2.5 rounded bg-slate-800 border border-slate-700 text-sm"
                placeholder="Full Name & Credentials"
                value={onboardFullName}
                onChange={(e) => setOnboardFullName(e.target.value)}
                required
              />
              <button
                type="submit"
                disabled={isAuthBusy}
                className="w-full py-2.5 min-h-[44px] rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm disabled:opacity-50"
              >
                {isAuthBusy ? "Creating Workspace..." : "Create Tenant Organisation"}
              </button>
              <button
                type="button"
                onClick={() => setGoogleIdToken(null)}
                className="w-full py-2 text-xs text-slate-400 hover:text-slate-200"
              >
                Back to Sign In
              </button>
            </form>
          ) : (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isAuthBusy}
                className="w-full py-2.5 min-h-[44px] rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-semibold text-sm transition-colors disabled:opacity-50"
              >
                Continue with Google
              </button>

              <div className="relative my-4 flex items-center">
                <div className="flex-grow border-t border-slate-800" />
                <span className="mx-3 text-[11px] text-slate-500 uppercase tracking-wider">or work email</span>
                <div className="flex-grow border-t border-slate-800" />
              </div>

              <div className="grid grid-cols-2 gap-1 p-1 mb-4 rounded-lg bg-slate-800/80 border border-slate-700/80">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(true);
                    setErrorMsg(null);
                  }}
                  className={`min-h-[40px] py-1.5 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    isRegister
                      ? "bg-amber-500 text-slate-950"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Create Workspace
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(false);
                    setErrorMsg(null);
                  }}
                  className={`min-h-[40px] py-1.5 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    !isRegister
                      ? "bg-amber-500 text-slate-950"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Sign In
                </button>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-3">
                {isRegister && (
                  <>
                    <input
                      className="w-full px-3 py-2.5 rounded bg-slate-800 border border-slate-700 text-sm"
                      placeholder="Organisation Name (e.g. Niger Delta Exploration Ltd)"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      required
                    />
                    <input
                      className="w-full px-3 py-2.5 rounded bg-slate-800 border border-slate-700 text-sm"
                      placeholder="Full Name & Credentials (e.g. Dr. A. Okafor, CGeol)"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </>
                )}
                <input
                  type="email"
                  autoComplete="email"
                  className="w-full px-3 py-2.5 rounded bg-slate-800 border border-slate-700 text-sm"
                  placeholder="Work Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <input
                  type="password"
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  className="w-full px-3 py-2.5 rounded bg-slate-800 border border-slate-700 text-sm"
                  placeholder={isRegister ? "Password (min 10 characters)" : "Password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="submit"
                  disabled={isAuthBusy}
                  className="w-full py-2.5 min-h-[44px] rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm disabled:opacity-50 cursor-pointer"
                >
                  {isRegister ? "Create Tenant Organisation & Sign In" : "Sign In"}
                </button>
              </form>

              <button
                type="button"
                onClick={() => {
                  setIsRegister((prev) => !prev);
                  setErrorMsg(null);
                }}
                className="mt-3 inline-flex items-center min-h-[44px] py-2 text-xs text-slate-300 hover:text-amber-300 underline cursor-pointer"
              >
                {isRegister ? "Already have an account? Sign in" : "Need a new tenant workspace? Register"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <AppShell
      orgName={profile?.organisation_name || "Organisation"}
      userEmail={profile?.email || email}
      role={session.role}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      onLogout={handleLogout}
    >
      {errorMsg && (
        <div className="mb-5 p-3 rounded bg-red-950/70 border border-red-700 text-xs text-red-200">{errorMsg}</div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6">
        <div className="min-w-0">
          <div className="text-xs text-slate-400 uppercase tracking-wider">Active Exploration Prospect</div>
          <div className="text-base sm:text-lg font-bold text-white truncate">
            {selectedProspect ? `${selectedProspect.name} (${selectedProspect.basin_name})` : "No Prospect Selected"}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {prospects.length > 0 && (
            <select
              aria-label="Switch active exploration prospect"
              value={selectedProspect?.id || ""}
              onChange={(e) => handleSelectProspect(e.target.value)}
              className="min-h-[44px] sm:min-h-0 px-3 py-2 rounded bg-slate-800 border border-slate-700 text-xs text-slate-100 max-w-full"
            >
              {prospects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.basin_name})
                </option>
              ))}
            </select>
          )}
          {selectedProspect && (
            <>
              <button
                type="button"
                onClick={runValidationAndFalsification}
                disabled={isBusy}
                className="min-h-[44px] sm:min-h-0 px-4 py-2 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs whitespace-nowrap disabled:opacity-50"
              >
                Run Validation &amp; Falsification Engine
              </button>
              <button
                type="button"
                onClick={generatePdfReport}
                disabled={isBusy}
                className="min-h-[44px] sm:min-h-0 px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-semibold text-xs whitespace-nowrap disabled:opacity-50"
              >
                Generate 20-Section PDF Report
              </button>
            </>
          )}
        </div>
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
            <h2 className="text-base font-semibold text-amber-300">Initialize Exploration Project &amp; Prospect</h2>
            <input
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Project Name"
            />
            <input
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
              value={projectCode}
              onChange={(e) => setProjectCode(e.target.value)}
              placeholder="Project Code"
            />
            <input
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
              value={prospectName}
              onChange={(e) => setProspectName(e.target.value)}
              placeholder="Prospect Name"
            />
            <select
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
              value={basinName}
              onChange={(e) => setBasinName(e.target.value)}
            >
              {basins.map((b) => (
                <option key={b.id} value={b.basin_name}>
                  {b.basin_name} ({b.country})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={createProjectAndProspect}
              disabled={isBusy}
              className="w-full min-h-[44px] py-2 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm disabled:opacity-50"
            >
              Create Prospect &amp; Link Basin Profile
            </button>
            <button
              type="button"
              onClick={loadSampleProspect}
              disabled={isBusy}
              className="w-full min-h-[44px] py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 font-semibold text-xs disabled:opacity-50"
            >
              Load Sample Niger Delta Prospect
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <h2 className="text-base font-semibold text-amber-300 mb-2 tabular-nums">
              Curated Nigerian Sedimentary Basins ({basins.length} Approved)
            </h2>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
              {basins.map((b) => (
                <div key={b.id} className="p-3 rounded bg-slate-800/70 border border-slate-700 text-xs">
                  <div className="font-semibold text-white">{b.basin_name}</div>
                  <div className="text-slate-400 mt-0.5">{b.stratigraphic_overview}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "ledger" && (
        <div className="space-y-6">
          <form onSubmit={handleCreateClaim} className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
            <h2 className="text-base font-semibold text-amber-300">Register Geological Claim in Evidence Ledger</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                className="px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
                value={claimElement}
                onChange={(e) => setClaimElement(e.target.value)}
                placeholder="Geological Element"
              />
              <select
                className="px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
                value={psElementType}
                onChange={(e) => setPsElementType(e.target.value)}
              >
                <option value="SOURCE_ROCK">SOURCE_ROCK</option>
                <option value="THERMAL_MATURITY">THERMAL_MATURITY</option>
                <option value="RESERVOIR">RESERVOIR</option>
                <option value="SEAL">SEAL</option>
                <option value="TRAP">TRAP</option>
                <option value="MIGRATION">MIGRATION</option>
                <option value="TIMING">TIMING</option>
                <option value="PRESERVATION">PRESERVATION</option>
              </select>
              <select
                className="px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
                value={claimClass}
                onChange={(e) => setClaimClass(e.target.value)}
              >
                <option value="OBSERVATION">OBSERVATION</option>
                <option value="INTERPRETATION">INTERPRETATION</option>
                <option value="ASSUMPTION">ASSUMPTION</option>
                <option value="PREDICTION">PREDICTION</option>
              </select>
            </div>
            <textarea
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
              rows={2}
              value={claimText}
              onChange={(e) => setClaimText(e.target.value)}
              placeholder="Enter explicit geological statement..."
              required
            />
            <button
              type="submit"
              disabled={!selectedProspect || isBusy}
              className="min-h-[44px] sm:min-h-0 px-4 py-2 rounded bg-amber-500 text-slate-950 font-semibold text-xs disabled:opacity-50"
            >
              Add Claim to Ledger
            </button>
          </form>

          <div className="space-y-2">
            {claims.map((c) => (
              <div key={c.id} className="p-4 rounded bg-slate-900 border border-slate-800 text-xs">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold text-amber-300">
                    {c.geological_element} ({c.claim_classification})
                  </span>
                  <span className="font-mono text-slate-400">
                    Status: {c.qualitative_status} | Review: {c.review_status}
                  </span>
                </div>
                <p className="text-slate-200 mt-1 text-sm">{c.claim_text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "contradictions" && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-amber-300 tabular-nums">
            Deterministic Consistency &amp; Contradiction Findings ({contradictions.length})
          </h2>
          {contradictions.map((ct) => (
            <div key={ct.id} className="p-4 rounded bg-slate-900 border border-slate-800 text-xs space-y-1">
              <div className="flex flex-wrap justify-between gap-2 font-semibold">
                <span className="text-red-300">
                  [{ct.severity}] {ct.category} — {ct.outcome_classification}
                </span>
                <span className="text-slate-400">{ct.well_or_interval}</span>
              </div>
              <p className="text-slate-200 text-sm">{ct.explanation}</p>
              <div className="text-slate-400 font-mono break-words">
                Raw comparison: {ct.first_value_raw} vs {ct.second_value_raw}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "falsification" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {psElements.map((ps) => (
              <div key={ps.id} className="p-4 rounded bg-slate-900 border border-slate-800 text-xs">
                <div className="flex justify-between gap-2 font-bold text-sm">
                  <span className="text-white">{ps.element_type}</span>
                  <span className="text-amber-300">{ps.qualitative_status}</span>
                </div>
                <p className="text-slate-300 mt-1">{ps.status_rationale}</p>
              </div>
            ))}
          </div>

          <h3 className="text-base font-semibold text-amber-300">Adversarial Falsification Hypotheses</h3>
          <div className="space-y-2">
            {hypotheses.map((h) => (
              <div key={h.id} className="p-4 rounded bg-slate-900 border border-slate-800 text-xs space-y-1">
                <div className="flex flex-wrap justify-between gap-2 text-slate-400">
                  <span>{h.geological_applicability}</span>
                  <span className="font-mono text-amber-300">{h.review_status}</span>
                </div>
                <p className="text-sm text-white font-medium">{h.proposed_failure_mechanism}</p>
                <p className="text-slate-400">{h.confidence_rationale}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "investigations" && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-amber-300">Prioritized Discriminating Investigations</h2>
          {investigations.map((inv) => (
            <div key={inv.id} className="p-4 rounded bg-slate-900 border border-slate-800 text-xs space-y-1">
              <div className="flex flex-wrap justify-between gap-2 font-bold text-sm">
                <span className="text-amber-300 tabular-nums">
                  Rank #{inv.priority_rank} — {inv.title}
                </span>
                <span className="text-slate-400">{inv.decision_relevance}</span>
              </div>
              <p className="text-slate-200">{inv.discriminating_objective}</p>
              <p className="text-slate-400">Required Test/Data: {inv.required_data_or_test}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === "reports" && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3 text-sm">
            <h2 className="text-base font-semibold text-amber-300">20-Section PDF Prospect Assurance Report</h2>
            <p className="text-xs text-slate-400">
              Generates an immutable, SHA-256 checksummed 20-section geological assurance report stored in Environment A.
            </p>
            {latestAssessment ? (
              <div className="p-4 rounded bg-slate-800 border border-slate-700 text-xs space-y-2">
                <div className="break-all tabular-nums">
                  <strong>Version:</strong> v{latestAssessment.version_number} | <strong>SHA-256:</strong>{" "}
                  <code>{latestAssessment.pdf_sha256}</code>
                </div>
                {latestAssessment.download_url && (
                  <a
                    href={latestAssessment.download_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center min-h-[44px] sm:min-h-0 px-4 py-2 rounded bg-amber-500 text-slate-950 font-semibold"
                  >
                    Download Verified PDF Report
                  </a>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-400">
                Click &quot;Generate 20-Section PDF Report&quot; in the header above.
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
            <h3 className="text-base font-semibold text-amber-300 tabular-nums">
              Immutable Audit Trail ({auditEvents.length})
            </h3>
            {auditEvents.length === 0 ? (
              <p className="text-xs text-slate-400">No audit events recorded yet.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {auditEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 rounded bg-slate-800/60 border border-slate-800 text-xs flex flex-wrap justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <span className="font-mono text-amber-300 font-semibold">{ev.event_type}</span>
                      <span className="text-slate-400 ml-2">
                        {ev.entity_type} · {ev.entity_id.slice(0, 8)}
                      </span>
                    </div>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {new Date(ev.occurred_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "documents" && (
        <div className="space-y-6">
          <form onSubmit={handleDocumentUpload} className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
            <div className="flex items-center gap-2 text-base font-semibold text-amber-300">
              <Upload className="h-4 w-4 shrink-0" aria-hidden="true" />
              <h2>Private Document Repository (Environment A)</h2>
            </div>
            <p className="text-xs text-slate-400">
              Upload primary geological documents (PDF, CSV, XLSX, LAS 2.0) with SHA-256 integrity hashing.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                className="px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="Document Title (optional, defaults to filename)"
              />
              <select
                className="px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
              >
                <option value="WELL_REPORT">WELL_REPORT</option>
                <option value="SEISMIC_INTERPRETATION">SEISMIC_INTERPRETATION</option>
                <option value="PETROPHYSICAL_LOG">PETROPHYSICAL_LOG</option>
                <option value="GEOCHEMICAL_REPORT">GEOCHEMICAL_REPORT</option>
                <option value="REGIONAL_STUDY">REGIONAL_STUDY</option>
              </select>
            </div>
            <input
              type="file"
              onChange={(e) => setDocFile(e.target.files?.[0] || null)}
              className="block w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:bg-slate-800 file:text-amber-300 file:font-semibold hover:file:bg-slate-700"
              required
            />
            <button
              type="submit"
              disabled={!selectedProspect || !docFile || isUploading}
              className="min-h-[44px] sm:min-h-0 px-4 py-2 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs disabled:opacity-50"
            >
              {isUploading ? "Uploading..." : "Upload & Compute SHA-256"}
            </button>
          </form>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
            <h3 className="text-base font-semibold text-amber-300 tabular-nums">
              Uploaded Prospect Documents ({documents.length})
            </h3>
            {documents.length === 0 ? (
              <p className="text-xs text-slate-400">
                {selectedProspect
                  ? "No documents uploaded for this prospect yet."
                  : "Select or create a prospect to upload primary geological documents."}
              </p>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => {
                  const latestVer = doc.versions[0];
                  return (
                    <div
                      key={doc.id}
                      className="p-3 rounded bg-slate-800/70 border border-slate-700 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <FileText className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                        <div className="min-w-0">
                          <div className="font-semibold text-white truncate">{doc.title}</div>
                          <div className="text-slate-400 truncate">
                            {doc.document_type} · v{doc.current_version}
                            {latestVer ? ` · ${latestVer.original_filename}` : ""}
                          </div>
                        </div>
                      </div>
                      {latestVer && (
                        <div className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                          {(latestVer.file_size_bytes / 1024).toFixed(1)} KB ·{" "}
                          {latestVer.sha256_checksum.slice(0, 12)}…
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
