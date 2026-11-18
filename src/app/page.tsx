"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { apiRequest, AuthSession } from "@/lib/api";

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

export default function StrataProofWorkspace() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auth form state
  const [isRegister, setIsRegister] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");

  // Domain state
  const [basins, setBasins] = useState<BasinProfileDto[]>([]);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [selectedProspect, setSelectedProspect] = useState<ProspectDto | null>(null);
  const [claims, setClaims] = useState<ClaimDto[]>([]);
  const [contradictions, setContradictions] = useState<ContradictionDto[]>([]);
  const [psElements, setPsElements] = useState<PetroleumSystemElementDto[]>([]);
  const [hypotheses, setHypotheses] = useState<HypothesisDto[]>([]);
  const [investigations, setInvestigations] = useState<InvestigationDto[]>([]);
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

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
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
    }
  }

  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const [me, basinList, projList] = await Promise.all([
          apiRequest<UserProfileDto>("/auth/me", {}, session),
          apiRequest<BasinProfileDto[]>("/knowledge/basins?country=Nigeria", {}, session),
          apiRequest<ProjectDto[]>("/projects", {}, session),
        ]);
        setProfile(me);
        setBasins(basinList);
        setProjects(projList);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to load workspace");
      }
    })();
  }, [session]);

  async function refreshProspectData(prospectId: string) {
    if (!session) return;
    const [cl, ct, ps, hy, inv] = await Promise.all([
      apiRequest<ClaimDto[]>(`/prospects/${prospectId}/claims`, {}, session),
      apiRequest<ContradictionDto[]>(`/prospects/${prospectId}/contradictions`, {}, session),
      apiRequest<PetroleumSystemElementDto[]>(`/prospects/${prospectId}/petroleum-system`, {}, session),
      apiRequest<HypothesisDto[]>(`/prospects/${prospectId}/hypotheses`, {}, session),
      apiRequest<InvestigationDto[]>(`/prospects/${prospectId}/investigations`, {}, session),
    ]);
    setClaims(cl);
    setContradictions(ct);
    setPsElements(ps);
    setHypotheses(hy);
    setInvestigations(inv);
  }

  async function createProjectAndProspect() {
    if (!session) return;
    setErrorMsg(null);
    try {
      const proj = await apiRequest<ProjectDto>(
        "/projects",
        {
          method: "POST",
          body: JSON.stringify({ name: projectName, code: projectCode, country: "Nigeria" }),
        },
        session
      );
      setProjects([proj, ...projects]);
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
      setSelectedProspect(prosp);
      await refreshProspectData(prosp.id);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create prospect");
    }
  }

  async function handleCreateClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !selectedProspect) return;
    setErrorMsg(null);
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
      await refreshProspectData(selectedProspect.id);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create claim");
    }
  }

  async function runValidationAndFalsification() {
    if (!session || !selectedProspect) return;
    setErrorMsg(null);
    try {
      await apiRequest(`/prospects/${selectedProspect.id}/validate`, { method: "POST" }, session);
      await apiRequest(`/prospects/${selectedProspect.id}/falsify`, { method: "POST" }, session);
      await refreshProspectData(selectedProspect.id);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to run validation and falsification");
    }
  }

  async function generatePdfReport() {
    if (!session || !selectedProspect) return;
    setErrorMsg(null);
    try {
      const rep = await apiRequest<AssessmentVersionDto>(
        `/prospects/${selectedProspect.id}/assessments`,
        { method: "POST", body: JSON.stringify({}) },
        session
      );
      setLatestAssessment(rep);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to generate PDF report");
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-7 shadow-xl">
          <div className="text-xs font-bold tracking-widest text-amber-400 uppercase">STRATAPROOF MVP 0.1</div>
          <h1 className="text-2xl font-bold mt-1">Geological Evidence Assurance</h1>
          <p className="text-xs text-slate-400 mt-1 mb-5">
            Multi-tenant workspace for petroleum exploration prospect falsification and auditability.
          </p>

          {errorMsg && (
            <div className="mb-4 p-3 rounded bg-red-950/70 border border-red-700 text-xs text-red-200">{errorMsg}</div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-3">
            {isRegister && (
              <>
                <input
                  className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
                  placeholder="Organisation Name (e.g. Niger Delta Exploration Ltd)"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                />
                <input
                  className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
                  placeholder="Full Name & Credentials (e.g. Dr. A. Okafor, CGeol)"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </>
            )}
            <input
              type="email"
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
              placeholder="Work Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
              placeholder="Password (min 10 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="submit"
              className="w-full py-2.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm"
            >
              {isRegister ? "Create Tenant Organisation & Sign In" : "Sign In"}
            </button>
          </form>

          <button
            onClick={() => setIsRegister(!isRegister)}
            className="mt-4 text-xs text-slate-400 hover:text-amber-300 underline"
          >
            {isRegister ? "Already have an account? Sign in" : "Need a new tenant workspace? Register"}
          </button>
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
      onLogout={() => setSession(null)}
    >
      {errorMsg && (
        <div className="mb-5 p-3 rounded bg-red-950/70 border border-red-700 text-xs text-red-200">{errorMsg}</div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6">
        <div>
          <div className="text-xs text-slate-400 uppercase tracking-wider">Active Exploration Prospect</div>
          <div className="text-lg font-bold text-white">
            {selectedProspect ? `${selectedProspect.name} (${selectedProspect.basin_name})` : "No Prospect Selected"}
          </div>
        </div>
        {selectedProspect && (
          <div className="flex gap-2">
            <button
              onClick={runValidationAndFalsification}
              className="px-4 py-2 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs"
            >
              Run Validation &amp; Falsification Engine
            </button>
            <button
              onClick={generatePdfReport}
              className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-semibold text-xs"
            >
              Generate 20-Section PDF Report
            </button>
          </div>
        )}
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
              onClick={createProjectAndProspect}
              className="w-full py-2 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm"
            >
              Create Prospect &amp; Link Basin Profile
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <h2 className="text-base font-semibold text-amber-300 mb-2">
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
              disabled={!selectedProspect}
              className="px-4 py-2 rounded bg-amber-500 text-slate-950 font-semibold text-xs disabled:opacity-50"
            >
              Add Claim to Ledger
            </button>
          </form>

          <div className="space-y-2">
            {claims.map((c) => (
              <div key={c.id} className="p-4 rounded bg-slate-900 border border-slate-800 text-xs">
                <div className="flex justify-between">
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
          <h2 className="text-base font-semibold text-amber-300">
            Deterministic Consistency &amp; Contradiction Findings ({contradictions.length})
          </h2>
          {contradictions.map((ct) => (
            <div key={ct.id} className="p-4 rounded bg-slate-900 border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between font-semibold">
                <span className="text-red-300">
                  [{ct.severity}] {ct.category} — {ct.outcome_classification}
                </span>
                <span className="text-slate-400">{ct.well_or_interval}</span>
              </div>
              <p className="text-slate-200 text-sm">{ct.explanation}</p>
              <div className="text-slate-400 font-mono">
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
                <div className="flex justify-between font-bold text-sm">
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
                <div className="flex justify-between text-slate-400">
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
              <div className="flex justify-between font-bold text-sm">
                <span className="text-amber-300">
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
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3 text-sm">
          <h2 className="text-base font-semibold text-amber-300">20-Section PDF Prospect Assurance Report</h2>
          <p className="text-xs text-slate-400">
            Generates an immutable, SHA-256 checksummed 20-section geological assurance report stored in Environment A.
          </p>
          {latestAssessment ? (
            <div className="p-4 rounded bg-slate-800 border border-slate-700 text-xs space-y-2">
              <div>
                <strong>Version:</strong> v{latestAssessment.version_number} | <strong>SHA-256:</strong>{" "}
                <code>{latestAssessment.pdf_sha256}</code>
              </div>
              {latestAssessment.download_url && (
                <a
                  href={latestAssessment.download_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block px-4 py-2 rounded bg-amber-500 text-slate-950 font-semibold"
                >
                  Download Verified PDF Report
                </a>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-400">Click &quot;Generate 20-Section PDF Report&quot; in the header above.</div>
          )}
        </div>
      )}

      {activeTab === "documents" && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 text-xs text-slate-300 space-y-2">
          <h2 className="text-base font-semibold text-amber-300">Private Document Repository (Environment A)</h2>
          <p>
            Supports PDF (selectable text + OCR fallback), CSV, XLSX, and LAS 2.0 well logs via{" "}
            <code>POST /api/v1/documents/upload</code> with SHA-256 integrity hashing and inline extraction.
          </p>
        </div>
      )}
    </AppShell>
  );
}
