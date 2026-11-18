# STRATAPROOF — MVP 0.1
**Petroleum Exploration Geological Evidence-Assurance & Falsification Platform**

## Overview
STRATAPROOF is an enterprise subsurface assurance system designed to evaluate exploration prospects by answering:
> *"What could make this exploration prospect fail, what evidence supports or contradicts the geological interpretation, what information is missing, and what investigation could help resolve the most important uncertainty?"*

### Core Architectural Guarantees
- **Curated & Verified Geological Knowledge Library:** Seeded with Nigerian sedimentary basins and strict `APPROVED` retrieval gating.
- **Multi-Tenant Workspace & Audit Trail:** Tenant isolation (`X-Organisation-ID` + HMAC JWT auth) and immutable audit logging.
- **No Fabricated Facts or Probabilities:** Missing evidence is explicitly surfaced as `INSUFFICIENT_EVIDENCE` or `REQUIRES_HUMAN_CHECK`. No discovery probabilities or invented numbers are ever generated.

## Running in Node.js (Next.js)
```bash
npm install
npm run dev
```
The unified Next.js application and `/api/v1/*` backend routes run on port `3000`.
