"use client";

import React, { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const activeItem =
    NAV_ITEMS.find((item) => item.id === activeTab) || NAV_ITEMS[0];

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsMobileMenuOpen(false);
      }
    };
    mediaQuery.addEventListener("change", handleMediaChange);
    return () => mediaQuery.removeEventListener("change", handleMediaChange);
  }, []);

  function handleSelectNav(tabId: string) {
    onSelectTab(tabId);
    setIsMobileMenuOpen(false);
  }

  function handleSignOut() {
    setIsMobileMenuOpen(false);
    onLogout();
  }

  function renderSidebarContent(isMobileDrawer: boolean) {
    return (
      <>
        <div>
          <div className="border-b border-slate-800 pb-4 mb-5 flex items-start justify-between gap-3">
            <div className="min-w-0">
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

            {isMobileDrawer && (
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="min-h-[44px] min-w-[44px] -mt-1 -mr-2 flex items-center justify-center rounded-md text-slate-300 hover:bg-slate-800 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 shrink-0"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </div>

          <nav aria-label="Primary sections" className="space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectNav(item.id)}
                  className={`w-full text-left px-3 py-2.5 min-h-[44px] rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    active
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-slate-800 pt-4 mt-6 text-xs space-y-1.5">
          <div className="text-slate-400">Tenant Organisation</div>
          <div className="font-semibold text-slate-200 truncate">{orgName}</div>
          <div className="text-slate-400 truncate">{userEmail}</div>
          <div className="inline-block px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-[11px]">
            {role}
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-3 w-full min-h-[44px] lg:min-h-0 py-2 px-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            Sign Out
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row">
      {/* Desktop Docked Sidebar */}
      <aside className="hidden lg:flex lg:w-72 lg:shrink-0 lg:flex-col lg:justify-between lg:sticky lg:top-0 lg:h-screen bg-slate-900 border-r border-slate-800 p-5 overflow-y-auto">
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile & Tablet Backdrop */}
      <div
        onClick={() => setIsMobileMenuOpen(false)}
        aria-hidden="true"
        className={`lg:hidden fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-sm transition-opacity duration-200 ease-out motion-reduce:transition-none ${
          isMobileMenuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Mobile & Tablet Slide-Over Drawer */}
      <aside
        id="mobile-navigation-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Workspace navigation"
        aria-hidden={!isMobileMenuOpen}
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-5 overflow-y-auto shadow-2xl transform transition-transform duration-200 ease-out motion-reduce:transition-none ${
          isMobileMenuOpen
            ? "translate-x-0 visible"
            : "-translate-x-full invisible"
        }`}
      >
        {renderSidebarContent(true)}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Sticky Mobile & Tablet Top Bar */}
        <header className="lg:hidden sticky top-0 z-30 h-14 px-4 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation-drawer"
            className="min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center rounded-md text-slate-200 hover:bg-slate-800 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 shrink-0"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-bold tracking-wider text-amber-400 whitespace-nowrap shrink-0">
              STRATAPROOF
            </span>
            <span className="text-slate-600 shrink-0" aria-hidden="true">
              ·
            </span>
            <span className="text-sm font-medium text-slate-200 truncate">
              {activeItem.label}
            </span>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
