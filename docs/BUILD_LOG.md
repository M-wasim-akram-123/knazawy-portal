# Build log

Newest entry at the top.

## 2026-11-13 — Branch model

`main` is production. `staging` is the integration branch. Feature and fix branches are cut from `staging`, merge back into `staging`, and reach production only when `staging` merges into `main`.

## 2026-11-13 — Valuation and platform choices

OQ-008 closed. Stock valuation is FIFO.

pnpm 10 stays. PostgreSQL stays. This repo follows the Khushaamdeed workspace standard and does not share a database, host, or runtime with that project.

OQ-002 remains open for the purchased domain names and the hosting account. Local Phase 1A does not need them.

## 2026-11-13 — Monorepo scaffold

Workspace created to the Khushaamdeed standard: pnpm, `apps/web`, `apps/portal`, `packages/api`, and the shared libraries (`shared`, `i18n`, `design-system`, `ui-shell`, `auth-client`, `api-client`).

PostgreSQL (Prisma) is the system of record because the PRD ledger, stock, and invoices are relational. Local Compose also starts Redis.

The API serves `/v1/health` and Swagger at `/v1/docs` in development. Shared code holds the eight roles, the request lifecycle, and `canReadOrganisation`. No purchasing, stock, or invoicing behaviour yet. Phase 1A is next.
