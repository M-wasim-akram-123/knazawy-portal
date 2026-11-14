# Build log

Newest entry at the top.

## 2026-11-14 — Ledger

Issuing an invoice posts one balanced entry: accounts receivable is debited and meal sales is credited, for the invoice total. A credit note posts the opposite, for the amount credited. A bill of zero is not posted. Each document posts once, in the same step as it is issued, and an entry is never edited or deleted. The book has two accounts, 1100 and 4000. It is not a full ledger: there is no chart of accounts to maintain and nothing is exported into another accounting package yet. Finance and an administrator see every entry. Airline finance sees only its own airline, on a Ledger page in the portal. Operations cannot open it. The page exports the entries as a spreadsheet.

## 2026-11-14 — Invoices

Finance prepares an invoice for a delivered request. The price is the approved rate card that covers the service date, and the billed quantity is the portions that arrived, or the card's minimum when that is higher. Prices are taken again when the invoice is issued, then locked. The request becomes invoiced and the airline can read it. A draft stays inside Karam. A correction is a credit note against the issued invoice: it uses the price that was billed, it cannot credit more than is still open, and it needs a reason. The invoice itself is never edited or deleted. Raising and issuing a bill belongs to Karam finance. An airline finance user can read invoices; their permission to create one is not used for this bill. The ledger is still ahead.

## 2026-11-14 — Deliveries

Operations takes an accepted request into production, then records what leaves the kitchen and what arrives. One request has one delivery, numbered DN-00001 from the restaurant's sequence. Portions sent cannot exceed what was ordered, and at least one portion must leave. Portions recorded on arrival cannot exceed what was sent. If nothing arrives, a reason is required. Once recorded, the delivery is not edited: the portions that arrived are what an invoice will bill, and a correction later is a credit or debit note. The delivery does not move stock; cooking already did that. An airline requester can read its own deliveries. Finance, the kitchen, and an administrator cannot. Invoicing is still ahead.

## 2026-11-14 — Rate cards

A rate card holds the price an airline pays for each meal and snack, in PKR, over a range of dates. A card can be left open-ended. Each priced item can carry a minimum number of portions. The airline pays for the portions delivered, but never fewer than that minimum. Finance writes a card as a draft and approves it. An administrator can correct a draft. Once approved, a card's prices cannot change. Two approved cards for the same airline can never share a date, so exactly one card applies to any service date. To change prices, finance ends the current card on a date (today or later, so past days keep their prices) and approves a new one. Cards are numbered RC-00001 from the restaurant's sequence. An airline sees only its own approved cards, on a Rate cards page in the portal. Its request form shows the price of each item, the charge after the minimum, and an estimated total from the card that covers the service date. Invoicing will use the same rule on delivered portions.

The airline portal now uses the same frame as the staff app: a top bar with the user and sign-out, a side menu that shows only what the role can open, and the same sign-in layout.

## 2026-11-14 — Requests

An airline user asks for meals and snacks for one flight. The request gives the flight number, route, service date, delivery time, and delivery point (gate, lounge, aircraft, or hotel), plus the passenger split (adults, children, infants, crew, and special diets, which sit inside the total). It lists menu items as portions. Only approved, active meals and snacks appear on the menu, and costs are never sent to the airline. A draft can be changed, sent, or cancelled. Once sent, the request is locked to the airline's view. Operations accepts it or rejects it, and a rejection needs a reason. Karam sees a request only after it is sent. Each request gets a number from the restaurant's sequence (RQ-00001), so numbers are unique across airlines. The service date must be today or later, and the menu is checked again when the request is sent. Rate preview, amendments, cut-off, and invoicing are still ahead.

## 2026-11-14 — Airline accounts

An administrator opens an airline account and adds its users. Each user belongs to one airline and holds either the requester role or the finance role. A disabled user cannot sign in. The airline portal shows that airline's name after sign-in. An airline user cannot open another airline's account, and a Karam role cannot be placed on an airline. Requests, rate cards, and invoices are still ahead.

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
