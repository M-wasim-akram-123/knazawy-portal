# Karam Restaurant Platform

Working constitution for `knazawy-portal`. The PRD (v0.1, 5 November 2026) wins on functional behaviour. This file wins on repository structure, package boundaries, and engineering defaults.

## What this is

Karam Restaurant fulfils airline requests for meals, snacks, and hotel rooms, then costs and invoices them from its own kitchen and inventory. Phase 1 is the restaurant core plus the airline portal. Hotel coordination is Phase 2.

## Workspace standard

Same workspace shape as Khushaamdeed. The products stay separate: own database, own host, own runtime.

- pnpm workspace (`pnpm@10`, Node 20)
- `apps/*` for deployable web surfaces
- `packages/*` for the API and shared libraries
- NestJS API with global prefix `/v1`, Helmet, cookie parser, and Swagger outside production
- Next.js App Router surfaces that proxy `/v1/*` to the API
- Strict TypeScript, ESLint with `@typescript-eslint/no-explicit-any`, Prettier
- One organisation's data is never readable by another partner organisation. Karam staff roles are the exception, and the check lives in `canReadOrganisation` until the API enforces it on every query.

PostgreSQL is the system of record (Prisma). The PRD requires a relational stock ledger, invoices, and journal. Redis is local infrastructure for later cache and queues.

## Apps

| App | Audience | Port | Phase |
| --- | --- | --- | --- |
| `apps/web` | Operations, store, kitchen, finance, administrator | 3000 | 1A then 1B |
| `apps/portal` | Airline requester, airline finance, hotel coordinator | 3002 | 1B, hotel in 2 |

Native mobile apps are out of scope. Both surfaces are responsive. Store, kitchen, and drivers are mobile-first.

## Packages

| Package | Responsibility |
| --- | --- |
| `@knazawy/api` | HTTP API, Prisma, seed |
| `@knazawy/shared` | Roles, statuses, phases, permission checks. No React, no I/O |
| `@knazawy/i18n` | English and Urdu copy |
| `@knazawy/design-system` | Tokens and controls. Status colours: grey draft, blue in progress, green done, red problem |
| `@knazawy/ui-shell` | Page chrome shared by both apps |
| `@knazawy/auth-client` | Token store and session user shape |
| `@knazawy/api-client` | Typed fetch wrapper |

`@knazawy/shared` publishes `dist/` because the API runs it from Node. The other libraries export TypeScript source and are transpiled by Next.js.

## Phases

1. **1A Restaurant core** — items, suppliers, locations, purchasing, bill scan, stock, recipes, production, meal cost.
2. **1B Airline portal and billing** — airline accounts, meal and snack requests, rate cards, distribution, invoices, ledger.
3. **2 Hotel coordination** — hotel accounts, room requests, acceptance, hotel invoices.
4. **3 Enhancements** — forecasting, WhatsApp or SMS, accounting-package integration, multi-branch.

Restaurant functionality ships first. Each phase needs a sign-off before the next one starts.

## Non-goals

- A full general-ledger ERP. The platform posts entries and exports them.
- Walk-in point of sale, table service, or consumer online ordering.
- Payroll, HR, and rostering.
- Native mobile apps.
- Direct integration with airline reservation or departure-control systems.

## Rules that apply from the first feature

- Financial records are never hard-deleted. Corrections are credit or debit notes.
- An airline or hotel reads only its own requests, rates, and invoices. Enforce this in the API.
- Billed quantity is the delivered quantity, subject to a rate-card minimum.
- A request uses the rate card valid on the service date.
- Stock is valued FIFO. A receipt creates a cost layer; issues consume the oldest layer first.
- Currency default is PKR. Time zone is Asia/Karachi. Dates are DD/MM/YYYY.
- Labels use plain language ("Goods received", not "GRN").
- English and Urdu are both first-class. Urdu strings live in `@knazawy/i18n` from the start.

## Branches

`main` is production. `staging` is the integration branch. Day-to-day work does not land on either one directly.

- Cut `feature/<short-name>` and `fix/<short-name>` from `staging`.
- Merge the feature or fix into `staging`.
- Merge `staging` into `main` when that staging build is ready for production.
- Do not commit on `main` or `staging`. Do not merge a feature branch straight into `main`.

## Build order for a feature

Shared types and permission checks, then API, then the surface that uses them. Do not put domain rules only in a React component.
