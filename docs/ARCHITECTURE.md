# Architecture

Karam Restaurant Platform is one record from airline request to cash. Production, dispatch, hotel bookings, and invoice lines all point back to the service request.

## Surfaces

```
apps/web      Karam staff          :3000     app.<domain>
apps/portal   Airlines and hotels  :3002     portal.<domain>
packages/api  NestJS               :3001     /v1
```

Both Next.js apps rewrite `/v1/:path*` to the API, so the browser stays on the page origin. Cookies and CORS stay same-origin in production behind the reverse proxy, and the rewrite target is `API_REWRITE_TARGET` locally.

## Request lifecycle

`DRAFT → SUBMITTED → ACCEPTED → IN_PRODUCTION → DISPATCHED → DELIVERED → INVOICED`

`REJECTED` and `CANCELLED` are terminal problem states. Every change is time-stamped with the user. The tone of each status (draft, progress, done, problem) lives in `@knazawy/shared` so both apps colour it the same way.

A meal or snack request is fulfilled from stock and a recipe. A hotel request (Phase 2) is fulfilled by a hotel response. Both paths end on the same invoice and journal.

## Data

PostgreSQL via Prisma. The tenancy spine is `Organisation`, `User`, and `AuditLog`. Phase 1A adds items, suppliers, stock locations, purchases, goods receipts, supplier bills, payables, FIFO stock layers, stock issues, stock transfers, stock counts, recipes, and production batches on that spine. Meal cost is calculated from those records when it is opened. Phase 1B adds airline organisations and their users on the same spine. Phase 1B requests add service requests and their lines, numbered from the restaurant's sequence. Rate cards and their lines hold each airline's dated prices and minimum portions; approved cards for one airline never overlap. A delivery records, for one accepted request, the portions sent and the portions that arrived. An invoice bills those arrived portions at the rate card for the service date, and never below the card's minimum. A credit note reduces an issued invoice. Issuing either document posts one balanced journal entry, tagged to the airline, and that entry is not changed. Invoices and journal lines land with the feature that posts them.

Redis is started locally and is unused until a feature needs a cache or a queue.

## Isolation

`canReadOrganisation` in `@knazawy/shared` is the rule:

- Karam roles (operations, store, kitchen, finance, administrator) may read every organisation.
- Airline and hotel roles may read only their own organisation id.

The API must apply that check on every partner query. Hiding a row in the UI is not the control.

## Roles

| Role | Organisation | Primary job |
| --- | --- | --- |
| Airline requester | Airline | Submit requests, track status, confirm delivery |
| Airline finance | Airline | Rates, invoices, statements, disputes |
| Hotel coordinator | Hotel | Room availability, rates, check-in (Phase 2) |
| Operations manager | Karam | Accept requests, plan production, assign distribution |
| Storekeeper | Karam | Purchases, bill scan, receipts, stock |
| Kitchen lead | Karam | Production batches, usage, wastage |
| Finance officer | Karam | Rates, invoices, payments, ledger |
| Administrator | Karam | Users, master data, settings, audit |

Permission codes (`C` create, `R` read, `U` update, `A` approve) are in `ROLE_ACCESS`.

## Local dependencies

`docker compose up -d` starts PostgreSQL 16 on `5432` and Redis 7 on `6379`. Credentials in `.env.example` match the compose file and are for the local database only.
