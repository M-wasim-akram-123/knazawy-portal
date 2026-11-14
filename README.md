# Karam Restaurant Platform

One web system for airline meal and snack requests, Karam Restaurant's kitchen and inventory, finance, and (later) hotel rooms. The working product name is **Karam Restaurant Platform**. This repository is `knazawy-portal`.

The workspace follows the same monorepo standard as Khushaamdeed: pnpm workspaces, a NestJS API, Next.js surfaces, and shared TypeScript packages.

Product behaviour is specified in the Product Requirements Document v0.1 (5 November 2026, Raza Nawaz). That document wins on functional scope. `CLAUDE.md` wins on how this repository is structured.

---

## Project status

**Phase 1A recipes.** Staff can sign in, keep items, suppliers, and locations, send a purchase, receive it, post a supplier bill, issue stock, transfer stock, count a location, keep a meal or snack recipe, record a production batch that uses stock, and compare a meal's standard cost with what batches actually cost. An administrator can open an airline account and its users can sign in on the portal. An airline can send meal and snack requests for a flight, and operations accepts or rejects them. Finance keeps dated rate cards for each airline, and the airline sees its prices and an estimated charge while it builds a request. Automatic bill reading (waiting for the restaurant's bill copies), distribution, and invoicing are still ahead.

## Branches

`main` is production. `staging` is where finished work is integrated. Features and fixes are their own branches, cut from `staging`, merged into `staging`, and promoted to `main` only from `staging`.

```text
feature/<name>  or  fix/<name>
        │
        ▼
     staging
        │
        ▼
      main          production
```

## Where to start reading

1. `CLAUDE.md` — repository constitution: apps, packages, phases, and non-goals.
2. `docs/ARCHITECTURE.md` — how a request moves through the system.
3. `docs/OPEN_QUESTIONS.md` — decisions still open from the PRD.
4. `docs/BUILD_LOG.md` — what each working session shipped.

## Architecture in one paragraph

Two web surfaces (`apps/web` for Karam staff, `apps/portal` for airlines and hotels), one NestJS API (`packages/api`), and shared packages for domain types, English/Urdu copy, the design system, auth, and the HTTP client. PostgreSQL holds the ledger, stock, and invoices. Redis is reserved for cache and queues. Staff use `app.` and partners use `portal.`; role-based views inside each surface are the default.

## Running locally

**Prerequisites:** Node.js 20, pnpm 10 (see `packageManager`), Docker for PostgreSQL and Redis. The workspace layout matches Khushaamdeed: `apps/*`, `packages/*`, and pnpm workspaces.

```bash
pnpm install
docker compose up -d
copy .env.example .env

pnpm --filter @knazawy/shared build
pnpm --filter @knazawy/api dev       # http://localhost:3001/v1/health
pnpm --filter @knazawy/web dev       # http://localhost:3000
pnpm --filter @knazawy/portal dev    # http://localhost:3002

pnpm typecheck
pnpm test
pnpm lint
```

On Windows PowerShell, `copy .env.example .env` creates the local env file. `pnpm dev` builds `@knazawy/shared` and starts the staff app, the partner portal, and the API together.

**Local seed** (requires Postgres):

```bash
pnpm seed:local
```

The seed creates the Karam organisation and `admin@karam.local`. The default password is `1234` and is for this development database only. The script refuses to run when `NODE_ENV=production`.

## Ports

| Surface | Package | URL |
| --- | --- | --- |
| Staff app | `@knazawy/web` | http://localhost:3000 |
| API | `@knazawy/api` | http://localhost:3001 |
| Airline and hotel portal | `@knazawy/portal` | http://localhost:3002 |
| Swagger (development) | `@knazawy/api` | http://localhost:3001/v1/docs |

## License

Proprietary. All rights reserved.
