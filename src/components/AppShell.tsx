"use client";

import React from "react";

interface AppShellProps {
  orgName: string;
  userEmail: string;
  role: string;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { id: "overview", label: "1. Prospect & Basin Context" },
  { id: "documents", label: "2. Documents & Ingestion" },
  { id: "ledger", label: "3. Geological Evidence Ledger" },
  { id: "contradictions", label: "4. Deterministic Contradictions" },
  { id: "falsification", label: "5. Petroleum System Falsification" },
  { id: "investigations", label: "6. Discriminating Investigations" },
  { id: "reports", label: "7. 20-Section PDF Report & Audit" },
];

export function AppShell({
  orgName,
  userEmail,
  role,
  activeTab,
  onSelectTab,
  onLogout,
  children,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-5">
        <div>
          <div className="border-b border-slate-800 pb-4 mb-5">
            <div className="text-xs font-bold tracking-widest text-amber-400 uppercase">
              STRATAPROOF MVP 0.1
            </div>
            <h1 className="text-lg font-semibold text-white mt-1">
              Subsurface Assurance
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Evidence-backed prospect falsification &amp; contradiction detection
            </p>
          </div>

          <nav className="space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-md text-sm font-medium transition ${
                    active
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-slate-800 pt-4 text-xs space-y-1">
          <div className="text-slate-400">Tenant Organisation</div>
          <div className="font-semibold text-slate-200 truncate">{orgName}</div>
          <div className="text-slate-400 truncate">{userEmail}</div>
          <div className="inline-block px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-[11px]">
            {role}
          </div>
          <button
            onClick={onLogout}
            className="mt-3 w-full py-1.5 px-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
          >
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
