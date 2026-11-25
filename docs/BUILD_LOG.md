# Build log

Newest entry at the top.

## 2026-11-25 — Room board: see every room, who is in it, and when it is free

The Rooms screen for Karam staff now has three tabs. **Overview** shows tiles for rooms, occupied, free now, booked ahead, due out today, and rooms still to check in today, with an occupancy ring, the free guest places against the total, the men, women, and children in rooms right now, free rooms by type, and a floor plan where every room is a square coloured free, booked ahead, occupied, due out today, or overdue. Selecting a room opens a side panel with the airline, stay number, guests, when they moved in, the check-out time, when the room is free, and what is booked after. **Calendar** shows 7, 14, or 30 days with a row per room and a bar for every stay, every room set aside ahead, and recent stays that ended. A bar starts at the arrival time and ends at the check-out time, so a room that turns over the same day shows two bars that meet. A strip at the top counts the free rooms of each type each day. **Set up** is the old screen, now with how many guests each room sleeps.

Each room has a capacity, from 1 to 20, children included. Check-in now records how many men, women, and children are in each room and the check-out time for that room (noon unless another time is agreed). A room cannot take more guests than it sleeps, and it cannot be given to another stay while a guest holds it, including a guest who has stayed past the check-out time. Karam can also set rooms aside for an accepted stay at any time before it ends, and release them again. A room set aside shows as booked ahead on the board and cannot be taken by another stay for those nights. A room whose stay was set aside cannot be archived. The Hotel room requests screen asks for the guests and check-out time, shows the rooms set aside with a Release button, and lists the guests and due-out time for each room in use.

The floor plan is drawn as a building, top floor first, with each floor showing how many of its rooms are free. Each room card shows its state, type, guest places as small people, the men, women, and children inside, the airline, the check-out time or when it is free, and how far through the stay it is. Search by room number or airline, filter by room type, or use the state buttons to light up only the rooms you need. **Set up** now opens with totals, shows floors as cards, room types as cards with the nightly price and what makes it up, and rooms grouped by floor with a − and + to change how many guests a room sleeps. Archived items stay hidden until "Show archived" is on, and can be restored. "Add several rooms" creates a numbered row of rooms in one step.

Airlines still book only a number of rooms by type. They never see room names, guests, or the board. The maths for the board lives in `@knazawy/shared` with tests. `SEED_ONLY=rooms node packages/api/scripts/seed-scenarios.mjs` fills a demo database with guests in rooms and rooms set aside.

## 2026-11-24 — Restock alert at the reorder level, and the administrator can accept orders

Each item already has a reorder level on the Items screen. When stock in a branch falls from above that level to the level or below, the administrator and the head chef each get one notification in the app: "Rice is running low", with how much is left and the level. It fires when stock leaves the store through an issue, a production run, or an approved count. Another alert comes only after the item has been restocked above the level and falls again. A level of 0 means no alert. A branch's alert goes to people working in that branch, or to people with no branch. Only the in-app notification exists. WhatsApp or SMS is still open.

When an order is opened, the stock check still warns "Not enough stock" and names the short ingredients, counting stock promised to other accepted orders. The button then reads "Accept anyway". Accepting is never blocked. The administrator can now accept or reject orders, as the operations manager can. Before, the administrator could only read and change them.

## 2026-11-24 — Head chef and chef, finance sees money only, clearer menu, amounts in SAR

The kitchen lead role is now the head chef, who adds, edits, and approves recipes. A new chef role only reads: orders to prepare, recipes, and the week ahead. A chef never sees stock, money, meal cost, or setup. Existing kitchen lead accounts became head chefs when the migration ran, and anyone still signed in under the old role is sent back to sign in. The finance officer no longer sees recipes or hotel rooms. Finance keeps prices, invoices, disputes, the ledger, meal cost, and approving purchases. Meal cost has its own permission so finance can read it without reading recipes. Anyone who may read recipes may read item names, because recipes list them.

The left menu uses plain, longer names for each screen, in English, Urdu, and Arabic, and the groups say what they hold. The Branches screen now opens only for roles the API lets read branches.

Amounts are labelled SAR instead of PKR everywhere on screen, in messages, and in notes. This changes the label only. No stored amount was converted, so a price of 1500 now reads 1500 SAR. The time zone stays Asia/Karachi and dates stay DD/MM/YYYY. Notes and notifications already saved still say PKR.

## 2026-11-14 — Rooms and room requests belong to a branch

Floors and the rooms on them belong to the branch the user is working in. Room types and the charges that make a night's price stay shared, so every branch offers the same kinds of room. An airline chooses a branch when it asks for rooms, and it only sees how many rooms that branch has, never the floor or the room name. Karam staff see and accept only the requests for the branch they are working in, and check guests into that branch's rooms. A room bill follows the request's branch. Existing floors and requests sit on MAIN.

WhatsApp or SMS, and a direct link to an accounting package, are still open. Messages were left for later, and the accounting package is still unnamed (OQ-006). The ledger spreadsheet export remains the way entries leave the platform.

## 2026-11-14 — Stock and purchases stay with the branch

Locations and purchases belong to the branch the user is working in. Goods received, issues, counts, production, and the stock on hand use that branch's locations. A transfer can leave for a location in another branch, and only that branch can confirm it arrived. Items, suppliers, and recipes stay shared across Karam. Existing locations and purchases sit on the MAIN branch. A user with no branch is asked to choose one before any of this work.

## 2026-11-14 — Karam branches, with airlines left whole

Karam can have more than one branch. An administrator adds a branch with a short code and a name, and can close one while another stays open. The last open branch cannot be closed. Each Karam user works in one branch and can move to another open branch. The migration gives the existing Karam organisation one branch, named after it, and puts every Karam user on it. An airline is not split into branches, and an airline user has none. Stock, rooms, and requests still belong to the organisation. Putting them on a branch is the next cut.

## 2026-11-14 — Forecast of meals and snacks for the next seven days

Operations, the kitchen lead, and administrators see the expected meals and snacks for today and the next six days, per airline and item, with a total per item across airlines. The expected number for a day is the average of the same weekday over the last four weeks. Only accepted requests count, so drafts, submitted, rejected, and cancelled requests are left out. The page also shows what is already booked for each day. Nothing is stored: the forecast is worked out when the page loads. Airlines and finance cannot see it. Stock needs and billing forecasts are not built yet.

## 2026-11-14 — A room cannot leave while a guest is in it or accepted stays need it

Archiving a room, or moving it to another room type, is refused in two cases. A guest is checked into the room, or the accepted stays of that type would be left short of rooms on any night from today on. The message says how many rooms the stays need. The check runs under the same lock as check-in and acceptance, so a stay cannot be accepted while the room is leaving. Reactivating a room is not limited. Before this, an archived room could leave accepted stays with no room behind them.

## 2026-11-14 — A credited stay can be billed again, room bills can be disputed, and there is no hotel partner

A credit note reverses the whole room bill and takes it out of force. Finance can raise a new bill for that stay, at the nightly price still fixed on acceptance. The old bill and the credit note stay. Only one bill is in force at a time, and each bill is credited once.

Airline finance can dispute a room bill the same way as a meal invoice: one dispute per bill, Karam finance accepts or rejects it, and the bill does not change. A credit note is still how money goes back, and a credit note cannot be disputed.

OQ-011 is closed. Karam owns the rooms, so there is no hotel partner and no hotel coordinator login. Operations accepts stays and checks guests in and out. Finance bills them. The administrator sets the rooms up. The hotel coordinator role remains in the role list so an old account still loads, and it can do nothing.

## 2026-11-14 — Room bills: finance bills an accepted stay, and a credit note reverses it

Finance bills an accepted room stay for every booked night, at the nightly price fixed when the stay was accepted. Each room type on the stay is one line: rooms, nights, nightly price, and amount. The bill is issued at once with the next IN number, and is posted to the ledger the same way as a meal invoice. A stay is billed once. A correction is a credit note (CN number) for the whole bill. It is issued once, and a credit note itself cannot be credited. A stay that has been credited stays billed, so it is not billed again. The airline sees its room bills on its Invoices page, with room type names and amounts, not floor or room names. Only finance can raise a bill or a credit note. Operations and administrators cannot. Early departure is billed for the booked nights, as decided before this slice.

## 2026-11-14 — Check-in and check-out: Karam moves each guest into a room

Once a stay is accepted, Karam operations moves each guest into a named room of the right type, from the first night until the morning the stay ends. A room holds one guest at a time, and a room already in use is refused. Checking out releases that room and keeps the stay and its nightly price. The airline sees how many rooms are checked in, not which rooms. Only operations can check guests in or out. Billing for the room nights is the next slice. Decided by the product owner: a guest who leaves early is billed for every booked night, because the room stayed reserved for the stay.

## 2026-11-14 — An airline asks for rooms, and Karam accepts against availability

An airline drafts a stay: check-in, check-out, who the rooms are for, and how many rooms of each type. The nightly price is the room type's charges added together. Sending the request tells Karam operations. Accepting it keeps the nightly price as it was then, and only when enough rooms of that type are free for those nights. A checkout morning is free for the next guest. A sent request can be cancelled by the airline until it is accepted. Rejecting needs a reason. The airline sees room types and prices, not floor or room names. Check-in, check-out, and room invoices are still ahead. The hotel coordinator role is still an open question.

## 2026-11-14 — Rooms, floors, and nightly charges are set by the administrator

The building is not fixed in the software. An administrator names each floor and the order it is listed in, names each room on a floor, and names each room type. A night's price is whatever charges the administrator adds to that type, in PKR per night, added together. A charge can be archived, and so can a floor, a type, or a room. A floor or a type with a room still in use cannot be archived until those rooms are. The same room name can be used on another floor. Operations and finance can read the setup. An airline cannot. Room requests, availability, and room invoices are still ahead.

## 2026-11-14 — Phase 2 started: room requests (shared rules)

Phase 2 is on `feature/phase-2-hotels`, cut from `feature/phase-1b-airline-accounts` because Phase 1 is not merged into `staging` yet. Karam owns the rooms it offers. An airline asks for rooms for a stay of nights, and Karam accepts or rejects against its own availability. Room prices come from a Karam rate card, billed per room night, the same way meals are priced. There is no outside hotel to pay and no hotel margin, so OQ-009 is closed on that basis.

This first slice adds only the shared rules: room request statuses and moves (same shape as service requests), counting a stay in nights, the room and night limits, and who may request or decide. The `room_requests` area is added to the permission table. Still to build: the room request API, room types and availability, room rate cards, check-in and check-out, and room invoices. Open for the next slice: whether the hotel coordinator role (OQ-011 and the architecture role table) is a Karam role or a partner role.

## 2026-11-14 — Phase 1A and 1B signed off

The product owner signed off Phase 1A (restaurant core) and Phase 1B (airline portal and billing) as built. Two items are carried forward, not blocking: automatic bill reading (OCR) waits for the restaurant's bill copies, and staff and portal screens still need a browser pass. Phase 2 (hotel coordination) starts now.

## 2026-11-14 — Amendments, cancellation charges, notifications, disputes

A request can be changed after it is sent, until 24 hours before delivery in Karachi time. The airline does that itself. After the cut-off, only Karam can change it, and only until production starts. Each change keeps a number (AM-00001) and a reason. The request keeps its own number. Sending a request inside the cut-off is refused.

Cancelling a draft or a request Karam has not accepted is free, as is cancelling an accepted request before the cut-off. Once the cut-off has passed on an accepted request, cancelling bills the portions ordered, and at least each item's minimum, on the rate card for the service date. The airline confirms that amount. The bill is issued at once as a cancellation, posted to the ledger, and the request is cancelled. Nothing already in production can be cancelled. A credit note is still how that charge is reduced.

The app keeps a message for the people who need to know: operations when a request is sent, changed, or cancelled; the airline when it is accepted, rejected, cooked, sent out, or arrives; finance on both sides when a bill, credit note, or cancellation is issued. These messages are not email or text messages.

Airline finance can dispute one issued invoice, including a cancellation. Karam finance accepts or rejects it with a reason. The invoice is not changed either way. If money is due back, finance raises a credit note.

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
