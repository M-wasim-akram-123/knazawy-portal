# Build log

Newest entry at the top.

## 2026-11-14 — Meal cost

Meal cost is worked out when it is opened. It is not a document and it does not change stock. The standard cost of one portion is each ingredient's latest purchase price, with the recipe's wastage added. The actual cost is the ingredient cost of every batch of that recipe, divided by the portions cooked. The difference is actual minus standard. A recipe stays without a standard cost until every ingredient has a price. Finance can read it, along with the kitchen, operations, and an administrator. A sale rate and a margin wait for the airline rate card.

## 2026-11-14 — Production

A production batch cooks one approved, active recipe at one open location on a date. The kitchen enters the planned and actual portions as whole numbers. Recording the batch takes each ingredient for the portions made, plus the recipe's wastage, from the location's oldest cost layers first. Each batch gets a number, a total ingredient cost, and a cost per portion rounded to 2 dp. Stock that is short refuses the whole batch, so nothing is taken and no number is used. Batches are not edited or deleted. Meal cost and invoicing are still ahead.

## 2026-11-13 — Recipes

A recipe is a meal or a snack. It records how many portions it makes, the wastage percent allowed, and each ingredient's quantity for one portion. The batch quantity adds that wastage on top. A kitchen lead or an administrator can write it. An approved recipe goes back to draft when it is changed. Production and meal cost are still ahead.

## 2026-11-13 — Stock counts

A count is a sheet for one location. It records what the books say and what was counted. Submitting it shows the difference and waits for approval. Approving posts the difference: a shortage leaves at the oldest cost, and extra stock arrives at the latest known cost. A location can have only one count in progress. Wastage, spoilage, and damage stay on stock issues. Recipes are still ahead.

## 2026-11-13 — Stock transfers

A transfer sends goods from one location to another. Sending takes the oldest cost layers out of the source straight away. The destination confirms receipt, and the same quantities arrive there at the same unit cost and the same received date, so later issues still use the oldest stock first. A transfer cannot be received twice, and it cannot start and end in the same location. Counts and adjustments are still ahead.

## 2026-11-13 — Stock issues (FIFO)

Stock leaves a location as a stock issue with a reason: kitchen use, wastage, spoilage, or damage. Each issue takes from the oldest cost layer first, so its cost is the true FIFO cost. Each layer touched gets a negative movement at that layer's unit cost. An issue cannot take more than the location holds, and the message says how much is there. Issues are not edited or deleted. Transfers, counts, and adjustments are still ahead.

## 2026-11-13 — Supplier bills

A storekeeper photographs or uploads a supplier bill, checks the lines against the total, and posts it. The photo stays with the goods receipt, stock opens a FIFO layer, and the supplier is owed the bill total. Tax is an amount on the bill, not a rate.

Reading the bill automatically (OCR) is paused until the restaurant sends its bill copies and invoices. Bills are entered by hand until then.

## 2026-11-13 — Purchases and goods received

A purchase is drafted, sent, then received into a location. Each receipt opens a FIFO cost layer: purchase quantity times the item conversion, at the line price divided by that conversion. Receipts are not edited or deleted. Bill scanning is still ahead.

## 2026-11-13 — Phase 1A master data

`feature/phase-1a-master-data` adds items, suppliers, and stock locations. Staff sign in, then create and archive those records. Nothing is hard-deleted. Stock stays FIFO; this slice does not post movements yet.

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
