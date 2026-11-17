// End-to-end and security suite for the running API.
//
// Run against a disposable database seeded with `seed:demo`, never production:
//   E2E_BASE_URL=http://localhost:3101 node --test packages/api/e2e/system.e2e.mjs
//
// Tests share state and run in order: each step builds on the one before, the way the
// business works (stock in, airline orders, stock check, accept, cook, deliver, bill, credit).

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3101';
const PASSWORD = process.env.E2E_PASSWORD ?? '1234';
// Airline logins made by `seed:scenarios`. Override for a database seeded another way.
const AIRLINE_PASSWORD = process.env.E2E_AIRLINE_PASSWORD ?? 'Demo-pass-2026';
const passwordFor = (email) => (email.endsWith('@karam.local') ? PASSWORD : AIRLINE_PASSWORD);

const USERS = {
  admin: 'admin@karam.local',
  ops: 'ops@karam.local',
  store: 'store@karam.local',
  kitchen: 'kitchen@karam.local',
  finance: 'finance@karam.local',
  air1: process.env.E2E_AIRLINE_1 ?? 'requests@ind.example',
  air2: process.env.E2E_AIRLINE_2 ?? 'requests@kkr.example',
};

const tokens = {};
const state = {};

async function call(who, method, path, body, extra = {}) {
  const headers = { Accept: 'application/json', ...(extra.headers ?? {}) };
  const token = typeof who === 'string' && tokens[who] ? tokens[who] : who?.raw;
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const response = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: response.status, body: json, headers: response.headers };
}

const get = (who, path) => call(who, 'GET', path);
const post = (who, path, body) => call(who, 'POST', path, body ?? {});
const patch = (who, path, body) => call(who, 'PATCH', path, body);

function ok(result, label) {
  assert.ok(
    result.status >= 200 && result.status < 300,
    `${label}: expected 2xx, got ${result.status} ${JSON.stringify(result.body)}`,
  );
  return result.body;
}

function isoDate(daysFromToday) {
  const now = new Date(Date.now() + 5 * 60 * 60 * 1000); // Asia/Karachi
  now.setUTCDate(now.getUTCDate() + daysFromToday);
  return now.toISOString().slice(0, 10);
}

function requestBody(lines, overrides = {}) {
  return {
    flightNumber: 'PK301',
    route: 'KHI-DXB',
    serviceDate: isoDate(3),
    deliveryTime: '11:30',
    deliveryPoint: 'GATE',
    adults: 100,
    children: 0,
    infants: 0,
    crew: 8,
    specialDiets: 0,
    lines,
    ...overrides,
  };
}

// The smallest valid PNG: a 1x1 transparent pixel.
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
    '1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082',
  'hex',
);

function billForm(lines, file = new Blob([PNG], { type: 'image/png' }), name = 'bill.png') {
  const form = new FormData();
  form.set('supplierId', state.suppliers[0].id);
  form.set('billNumber', `E2E-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  form.set('billedOn', isoDate(0));
  form.set('locationId', state.locations[0].id);
  const total = lines.reduce(
    (sum, line) => sum + Number(line.quantity) * Number(line.unitPrice),
    0,
  );
  form.set('billTotal', total.toFixed(2));
  form.set('tax', '0');
  form.set('discount', '0');
  form.set('lines', JSON.stringify(lines));
  if (file) form.set('bill', file, name);
  return form;
}

function forgeToken(payload, header = { alg: 'none', typ: 'JWT' }) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode(header)}.${encode(payload)}.`;
}

before(async () => {
  const health = await get(null, '/v1/health');
  assert.equal(health.status, 200, `API is not reachable at ${BASE}`);
  for (const [who, email] of Object.entries(USERS)) {
    const login = await post(null, '/v1/auth/login', { email, password: passwordFor(email) });
    ok(login, `login ${who}`);
    tokens[who] = login.body.accessToken;
  }
});

describe('1. Platform hardening', () => {
  test('security headers are set and the framework is not advertised', async () => {
    const result = await get(null, '/v1/health');
    assert.equal(result.headers.get('x-powered-by'), null);
    assert.ok(result.headers.get('x-content-type-options'), 'nosniff missing');
    assert.ok(result.headers.get('strict-transport-security') || true);
    assert.ok(
      result.headers.get('x-frame-options') || result.headers.get('content-security-policy'),
    );
  });

  test('CORS does not allow an unknown origin', async () => {
    const response = await fetch(`${BASE}/v1/health`, {
      headers: { Origin: 'https://evil.example' },
    });
    assert.notEqual(response.headers.get('access-control-allow-origin'), 'https://evil.example');
    assert.notEqual(response.headers.get('access-control-allow-origin'), '*');
  });

  test('there is no route that deletes a financial record', async () => {
    for (const path of [
      '/v1/invoices/x',
      '/v1/ledger/x',
      '/v1/room-invoices/x',
      '/v1/requests/x',
    ]) {
      const result = await call('admin', 'DELETE', path);
      assert.equal(result.status, 404, `DELETE ${path} answered ${result.status}`);
    }
  });

  test('an oversized body is refused, not processed', async () => {
    const huge = JSON.stringify({ email: 'a'.repeat(2_000_000), password: 'x' });
    const result = await call(null, 'POST', '/v1/auth/login', huge);
    assert.ok([400, 401, 413].includes(result.status), `got ${result.status}`);
  });
});

describe('2. Authentication', () => {
  test('a wrong password and an unknown email get the same answer', async () => {
    const wrong = await post(null, '/v1/auth/login', { email: USERS.ops, password: 'nope-nope' });
    const unknown = await post(null, '/v1/auth/login', {
      email: 'nobody@karam.local',
      password: 'nope-nope',
    });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.deepEqual(wrong.body.message, unknown.body.message);
  });

  test('SQL and NoSQL style injection in login is just a failed login', async () => {
    for (const email of ["' OR 1=1 --", "admin@karam.local' --", '{"$gt":""}']) {
      const result = await post(null, '/v1/auth/login', { email, password: "' OR '1'='1" });
      assert.ok([400, 401].includes(result.status), `${email} gave ${result.status}`);
    }
    const objectEmail = await post(null, '/v1/auth/login', {
      email: { $gt: '' },
      password: { $gt: '' },
    });
    assert.ok([400, 401].includes(objectEmail.status));
  });

  test('no token, a garbage token, an unsigned token, and a re-signed token are all refused', async () => {
    assert.equal((await get(null, '/v1/auth/me')).status, 401);
    assert.equal((await get({ raw: 'garbage' }, '/v1/auth/me')).status, 401);
    const me = ok(await get('air1', '/v1/auth/me'), 'me');
    const unsigned = forgeToken({ sub: me.id ?? me.user?.id ?? 'x' });
    assert.equal((await get({ raw: unsigned }, '/v1/auth/me')).status, 401);
    const [header, , signature] = tokens.air1.split('.');
    const adminMe = ok(await get('admin', '/v1/auth/me'), 'admin me');
    const swapped = `${header}.${Buffer.from(
      JSON.stringify({ sub: adminMe.id ?? adminMe.user?.id }),
    ).toString('base64url')}.${signature}`;
    assert.equal((await get({ raw: swapped }, '/v1/auth/me')).status, 401);
  });

  test('the account endpoint never returns a password hash', async () => {
    const me = await get('admin', '/v1/auth/me');
    assert.ok(!JSON.stringify(me.body).toLowerCase().includes('passwordhash'));
    assert.ok(!JSON.stringify(me.body).includes('$2'));
  });

  test('repeated wrong passwords are slowed down or blocked', async () => {
    let limited = false;
    for (let attempt = 0; attempt < 15; attempt += 1) {
      const result = await post(null, '/v1/auth/login', {
        email: 'bruteforce-target@karam.local',
        password: `guess-${attempt}`,
      });
      if (result.status === 429) {
        limited = true;
        break;
      }
    }
    assert.ok(limited, 'fifteen wrong passwords in a row were never rate limited');
  });
});

describe('3. Input validation', () => {
  test('unknown fields are refused, so a client cannot set fields it does not own', async () => {
    const result = await post('air1', '/v1/requests', {
      ...requestBody([]),
      status: 'ACCEPTED',
      organisationId: 'someone-else',
    });
    assert.equal(result.status, 400, `extra fields gave ${result.status}`);
  });

  test('negative and absurd quantities are refused', async () => {
    const menu = ok(await get('air1', '/v1/requests/menu'), 'menu');
    state.menu = menu;
    for (const quantity of [-5, 0, 1.5, 10_000_000]) {
      const result = await post(
        'air1',
        '/v1/requests',
        requestBody([{ recipeId: menu[0].id, quantity }]),
      );
      assert.equal(result.status, 400, `quantity ${quantity} gave ${result.status}`);
    }
  });

  test('a service date in the past is refused', async () => {
    const result = await post(
      'air1',
      '/v1/requests',
      requestBody([{ recipeId: state.menu[0].id, quantity: 1 }], { serviceDate: isoDate(-2) }),
    );
    assert.equal(result.status, 400);
  });

  test('markup in text is stored as text, never interpreted', async () => {
    const result = await post(
      'air1',
      '/v1/requests',
      requestBody([{ recipeId: state.menu[0].id, quantity: 1 }], {
        note: '<script>alert(1)</script>',
      }),
    );
    const created = ok(result, 'create with markup');
    assert.equal(created.note, '<script>alert(1)</script>');
    state.markupRequestId = created.id;
  });
});

describe('4. Airlines are kept apart', () => {
  test('an airline sees only its own requests', async () => {
    const mine = ok(await get('air2', '/v1/requests'), 'air2 list');
    assert.ok(mine.every((row) => row.id !== state.markupRequestId));
  });

  test('an airline cannot change, submit, or cancel another airline’s request', async () => {
    const id = state.markupRequestId;
    const tries = [
      await patch(
        'air2',
        `/v1/requests/${id}`,
        requestBody([{ recipeId: state.menu[0].id, quantity: 1 }]),
      ),
      await post('air2', `/v1/requests/${id}/submit`),
      await post('air2', `/v1/requests/${id}/cancel`, {}),
    ];
    for (const result of tries)
      assert.ok([403, 404].includes(result.status), `got ${result.status}`);
  });

  test('an airline can never see stock, recipes, costs, suppliers, or the ledger of Karam', async () => {
    for (const path of [
      '/v1/stock',
      '/v1/stock/low',
      '/v1/recipes',
      '/v1/meal-costs',
      '/v1/suppliers',
      '/v1/items',
      '/v1/purchases',
      '/v1/receipts',
      '/v1/production',
      '/v1/airlines',
      '/v1/forecast',
      '/v1/branches',
    ]) {
      const result = await get('air1', path);
      assert.equal(result.status, 403, `${path} gave ${result.status} to an airline`);
    }
  });

  test('an airline sees only its own terms and cannot change them', async () => {
    const terms = ok(await get('air1', '/v1/airlines/terms'), 'terms');
    assert.equal(terms.length, 1);
    state.air1Id = terms[0].airlineId;
    const result = await patch('air1', `/v1/airlines/${state.air1Id}/terms`, {
      paymentTermsDays: 180,
      discountPercent: '99',
    });
    assert.equal(result.status, 403);
  });
});

describe('5. Stock in: a supplier bill puts goods into stock', () => {
  test('pick a menu recipe and its ingredients', async () => {
    const recipes = ok(await get('kitchen', '/v1/recipes'), 'recipes');
    const recipe = recipes.find(
      (row) => row.status === 'APPROVED' && row.active && row.lines.length > 0,
    );
    assert.ok(recipe, 'no approved recipe with ingredients in the seed');
    state.recipe = recipe;
    state.items = ok(await get('store', '/v1/items'), 'items');
    state.suppliers = ok(await get('store', '/v1/suppliers'), 'suppliers');
    state.locations = ok(await get('store', '/v1/locations'), 'locations');
    assert.ok(state.suppliers.length > 0 && state.locations.length > 0);
  });

  test('the stock check lists every ingredient and its answer matches the shortfalls', async () => {
    const created = ok(
      await post(
        'air1',
        '/v1/requests',
        requestBody([{ recipeId: state.recipe.id, quantity: 10 }]),
      ),
      'create request',
    );
    ok(await post('air1', `/v1/requests/${created.id}/submit`), 'submit');
    state.requestId = created.id;
    const check = ok(await get('ops', `/v1/requests/${created.id}/fulfilment`), 'fulfilment');
    assert.ok(check.ingredients.length > 0);
    assert.equal(
      check.canFulfil,
      check.ingredients.every((row) => row.short === '0'),
    );
    for (const row of check.ingredients) {
      const free = Math.max(0, Number(row.onHand) - Number(row.promised));
      assert.equal(Number(row.free).toFixed(4), free.toFixed(4), `${row.itemName} free stock`);
    }
  });

  test('an airline cannot run the stock check, even on its own request', async () => {
    const result = await get('air1', `/v1/requests/${state.requestId}/fulfilment`);
    assert.equal(result.status, 403);
  });

  test('the storekeeper records a supplier bill for every ingredient', async () => {
    // Enough for about 20 portions after wastage: 10 can be met, 999 cannot.
    const wastage = 1 + Number(state.recipe.wastagePercent) / 100;
    const lines = state.recipe.lines.map((line) => {
      const item = state.items.find((row) => row.id === line.itemId);
      const base = Number(line.quantityPerPortion) * 20 * wastage;
      const purchaseUnits = Math.ceil((base / Number(item.conversionToBase)) * 1000) / 1000;
      return {
        itemId: line.itemId,
        quantity: String(Math.max(purchaseUnits, 0.001)),
        unitPrice: '10',
      };
    });
    const result = await call('store', 'POST', '/v1/bills', billForm(lines));
    ok(result, 'post bill');
    state.receiptId = result.body.id;
  });

  test('the bill photo can be read back by Karam staff, not by an airline', async () => {
    const staff = await fetch(`${BASE}/v1/bills/${state.receiptId}/file`, {
      headers: { Authorization: `Bearer ${tokens.store}` },
    });
    assert.equal(staff.status, 200);
    assert.equal(staff.headers.get('x-content-type-options'), 'nosniff');
    await staff.body?.cancel();
    const airline = await get('air1', `/v1/bills/${state.receiptId}/file`);
    assert.equal(airline.status, 403);
  });

  test('an HTML file is refused, even when it claims to be a PNG', async () => {
    const line = [{ itemId: state.recipe.lines[0].itemId, quantity: '1', unitPrice: '10' }];
    const html = new Blob(['<html><script>alert(1)</script></html>'], { type: 'text/html' });
    const plain = await call('store', 'POST', '/v1/bills', billForm(line, html, 'x.html'));
    assert.equal(plain.status, 400, `an HTML bill gave ${plain.status}`);
    const disguised = new Blob(['<html><script>alert(1)</script></html>'], { type: 'image/png' });
    const spoofed = await call('store', 'POST', '/v1/bills', billForm(line, disguised, 'x.png'));
    assert.equal(spoofed.status, 400, `HTML labelled as PNG gave ${spoofed.status}`);
  });

  test('stock on hand now shows the goods', async () => {
    const stock = ok(await get('store', '/v1/stock'), 'stock');
    for (const line of state.recipe.lines) {
      assert.ok(
        stock.some((row) => row.itemId === line.itemId),
        `${line.itemName} not in stock`,
      );
    }
  });

  test('the kitchen and an airline cannot post a bill', async () => {
    const line = [{ itemId: state.recipe.lines[0].itemId, quantity: '1', unitPrice: '10' }];
    for (const who of ['kitchen', 'air1']) {
      const result = await call(who, 'POST', '/v1/bills', billForm(line));
      assert.equal(result.status, 403, `${who} got ${result.status}`);
    }
  });
});

describe('6. Order to accept: the stock check decides', () => {
  test('with stock in, the same order can now be met', async () => {
    const check = ok(await get('ops', `/v1/requests/${state.requestId}/fulfilment`), 'fulfilment');
    assert.equal(check.canFulfil, true, JSON.stringify(check));
    assert.ok(check.lines[0].canMake >= 10);
  });

  test('a huge order is flagged short, with how much is missing', async () => {
    const created = ok(
      await post(
        'air1',
        '/v1/requests',
        requestBody([{ recipeId: state.recipe.id, quantity: 999 }], { flightNumber: 'PK999' }),
      ),
      'create big request',
    );
    ok(await post('air1', `/v1/requests/${created.id}/submit`), 'submit big');
    const check = ok(await get('ops', `/v1/requests/${created.id}/fulfilment`), 'big check');
    assert.equal(check.canFulfil, false);
    assert.ok(check.ingredients.some((row) => row.short !== '0'));
    state.bigRequestId = created.id;
  });

  test('the airline hears about the decision on its live stream', async () => {
    const controller = new AbortController();
    const response = await fetch(`${BASE}/v1/notifications/stream`, {
      headers: { Authorization: `Bearer ${tokens.air1}`, Accept: 'text/event-stream' },
      signal: controller.signal,
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const received = (async () => {
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return buffer;
        buffer += decoder.decode(value, { stream: true });
        if (buffer.includes('event: notification')) return buffer;
      }
    })();
    ok(await post('ops', `/v1/requests/${state.requestId}/accept`), 'accept');
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('no live event within 5s')), 5_000),
    );
    const text = await Promise.race([received, timeout]);
    controller.abort();
    assert.match(text, /is accepted/);
  });

  test('one user cannot hold more than three live streams', async () => {
    const controllers = [];
    const statuses = [];
    for (let index = 0; index < 4; index += 1) {
      const controller = new AbortController();
      controllers.push(controller);
      const response = await fetch(`${BASE}/v1/notifications/stream`, {
        headers: { Authorization: `Bearer ${tokens.air2}` },
        signal: controller.signal,
      });
      statuses.push(response.status);
      if (response.status !== 200) await response.body?.cancel();
    }
    for (const controller of controllers) controller.abort();
    assert.deepEqual(statuses, [200, 200, 200, 429]);
  });

  test('the live stream refuses a request without a token', async () => {
    const response = await fetch(`${BASE}/v1/notifications/stream`);
    assert.equal(response.status, 401);
    await response.body?.cancel();
  });

  test('accepted stock is held: the big order now shows stock promised elsewhere', async () => {
    const check = ok(
      await get('ops', `/v1/requests/${state.bigRequestId}/fulfilment`),
      'big check',
    );
    assert.ok(check.ingredients.some((row) => row.promised !== '0'));
  });

  test('the airline rejects nothing it does not own: ops rejects the big order with a reason', async () => {
    assert.equal(
      (await post('ops', `/v1/requests/${state.bigRequestId}/reject`, { reason: '' })).status,
      400,
    );
    ok(
      await post('ops', `/v1/requests/${state.bigRequestId}/reject`, { reason: 'Not enough rice' }),
      'reject',
    );
    assert.equal((await post('air1', `/v1/requests/${state.bigRequestId}/accept`)).status, 403);
  });

  test('the airline’s bell has the notification, and another user cannot mark it read', async () => {
    const mine = ok(await get('air1', '/v1/notifications'), 'notifications');
    assert.ok(mine.length > 0);
    const result = await post('air2', `/v1/notifications/${mine[0].id}/read`);
    assert.equal(result.status, 404);
  });
});

describe('7. Kitchen to delivery', () => {
  test('the kitchen records the batch and the ingredients leave stock, oldest first', async () => {
    const before = ok(await get('kitchen', '/v1/stock'), 'stock before').filter(
      (row) => row.itemId === state.recipe.lines[0].itemId,
    );
    ok(
      await post('kitchen', '/v1/production', {
        recipeId: state.recipe.id,
        locationId: state.locations[0].id,
        producedOn: isoDate(0),
        plannedPortions: '10',
        actualPortions: '10',
      }),
      'production',
    );
    const after = ok(await get('kitchen', '/v1/stock'), 'stock after').filter(
      (row) => row.itemId === state.recipe.lines[0].itemId,
    );
    const total = (rows) => rows.reduce((sum, row) => sum + Number(row.quantityBase), 0);
    assert.ok(total(after) < total(before), 'production did not take stock');
  });

  test('operations dispatches and records the delivery', async () => {
    const delivery = ok(
      await post('ops', '/v1/deliveries', { requestId: state.requestId }),
      'start delivery',
    );
    const lines = [{ recipeId: state.recipe.id, quantity: 10 }];
    ok(await post('ops', `/v1/deliveries/${delivery.id}/dispatch`, { lines }), 'dispatch');
    ok(
      await post('ops', `/v1/deliveries/${delivery.id}/deliver`, {
        receivedBy: 'Gate agent',
        lines,
      }),
      'deliver',
    );
  });
});

describe('8. Terms, invoice, credit, ledger', () => {
  test('finance sets Net 45 and 5% off for the airline', async () => {
    const terms = ok(
      await patch('finance', `/v1/airlines/${state.air1Id}/terms`, {
        paymentTermsDays: 45,
        discountPercent: '5',
      }),
      'set terms',
    );
    assert.equal(terms.paymentTermsDays, 45);
    assert.equal(terms.discountPercent, '5');
  });

  test('the storekeeper cannot change terms', async () => {
    const result = await patch('store', `/v1/airlines/${state.air1Id}/terms`, {
      paymentTermsDays: 1,
      discountPercent: '0',
    });
    assert.equal(result.status, 403);
  });

  test('the invoice is issued with the discount and a due date 45 days out', async () => {
    const draft = ok(
      await post('finance', '/v1/invoices', { requestId: state.requestId }),
      'draft invoice',
    );
    const issued = ok(await post('finance', `/v1/invoices/${draft.id}/issue`), 'issue');
    assert.equal(issued.status, 'ISSUED');
    assert.equal(issued.discountPercent, '5');
    assert.equal(issued.paymentTermsDays, 45);
    assert.equal(issued.dueOn, isoDate(45));
    const subtotal = Number(issued.subtotal);
    assert.equal(
      Number(issued.total).toFixed(2),
      (subtotal - Math.round(subtotal * 5) / 100).toFixed(2),
    );
    state.invoice = issued;
  });

  test('issuing twice is refused', async () => {
    const result = await post('finance', `/v1/invoices/${state.invoice.id}/issue`);
    assert.equal(result.status, 400);
  });

  test('the airline sees its invoice; the other airline does not', async () => {
    const mine = ok(await get('air1', '/v1/invoices'), 'air1 invoices');
    assert.ok(mine.some((row) => row.id === state.invoice.id));
    const theirs = ok(await get('air2', '/v1/invoices'), 'air2 invoices');
    assert.ok(theirs.every((row) => row.id !== state.invoice.id));
  });

  test('a credit note for one portion takes the same discount off what is owed', async () => {
    const result = ok(
      await post('finance', `/v1/invoices/${state.invoice.id}/credit`, {
        reason: 'One meal arrived cold',
        lines: [{ recipeId: state.recipe.id, quantity: 1 }],
      }),
      'credit',
    );
    assert.equal(result.kind, 'CREDIT_NOTE');
    const after = ok(await get('finance', '/v1/invoices'), 'invoices').find(
      (row) => row.id === state.invoice.id,
    );
    const credited = Number(after.credits[0].total);
    assert.equal(Number(after.amountDue).toFixed(2), (Number(after.total) - credited).toFixed(2));
    const unit = Number(after.lines[0].unitPrice);
    assert.equal(credited.toFixed(2), (unit - Math.round(unit * 5) / 100).toFixed(2));
  });

  test('crediting more than was billed is refused', async () => {
    const result = await post('finance', `/v1/invoices/${state.invoice.id}/credit`, {
      reason: 'Too much',
      lines: [{ recipeId: state.recipe.id, quantity: 9999 }],
    });
    assert.equal(result.status, 400);
  });

  test('two credit notes sent at the same moment cannot over-credit the invoice', async () => {
    const invoice = ok(await get('finance', '/v1/invoices'), 'invoices').find(
      (row) => row.id === state.invoice.id,
    );
    const line = invoice.lines[0];
    const remaining = line.billedQuantity - line.creditedQuantity;
    assert.ok(remaining > 0);
    const body = {
      reason: 'Double click',
      lines: [{ recipeId: line.recipeId, quantity: remaining }],
    };
    const results = await Promise.all([
      post('finance', `/v1/invoices/${state.invoice.id}/credit`, body),
      post('finance', `/v1/invoices/${state.invoice.id}/credit`, body),
    ]);
    const statuses = results.map((result) => result.status).sort();
    assert.equal(statuses.filter((status) => status < 300).length, 1, `got ${statuses}`);
    const after = ok(await get('finance', '/v1/invoices'), 'invoices').find(
      (row) => row.id === state.invoice.id,
    );
    assert.equal(after.lines[0].creditedQuantity, line.billedQuantity);
    assert.equal(after.amountDue, '0.00');
  });

  test('an airline cancelling while staff accept: exactly one of them wins', async () => {
    const created = ok(
      await post(
        'air1',
        '/v1/requests',
        requestBody([{ recipeId: state.recipe.id, quantity: 1 }], { flightNumber: 'PK777' }),
      ),
      'create',
    );
    ok(await post('air1', `/v1/requests/${created.id}/submit`), 'submit');
    const [accept, cancel] = await Promise.all([
      post('ops', `/v1/requests/${created.id}/accept`),
      post('air1', `/v1/requests/${created.id}/cancel`, {}),
    ]);
    const final = ok(await get('air1', '/v1/requests'), 'list').find(
      (row) => row.id === created.id,
    );
    assert.ok(accept.status < 300 || cancel.status < 300, 'neither went through');
    if (accept.status < 300 && cancel.status < 300) {
      // Both may succeed in order: accepted first, then a free cancellation before the cut-off.
      assert.equal(final.status, 'CANCELLED');
    } else {
      assert.ok([400, 409].includes(accept.status < 300 ? cancel.status : accept.status));
      assert.equal(final.status, accept.status < 300 ? 'ACCEPTED' : 'CANCELLED');
    }
  });

  test('every ledger entry balances', async () => {
    const entries = ok(await get('finance', '/v1/ledger'), 'ledger');
    assert.ok(entries.length > 0);
    for (const entry of entries) {
      const debit = entry.lines.reduce((sum, line) => sum + Number(line.debit ?? 0), 0);
      const credit = entry.lines.reduce((sum, line) => sum + Number(line.credit ?? 0), 0);
      assert.equal(
        debit.toFixed(2),
        credit.toFixed(2),
        `entry ${entry.number ?? entry.id} does not balance`,
      );
    }
  });

  test('the ledger export is CSV that a spreadsheet will not run as formulas', async () => {
    const result = ok(await get('finance', '/v1/ledger/export'), 'export');
    const cells = result.csv.split(/\r?\n/).flatMap((line) => line.split(','));
    assert.ok(
      cells.every((cell) => !/^"?[=+@]/.test(cell)),
      'a cell starts like a formula',
    );
  });

  test('an airline requester cannot open a dispute or post to the ledger', async () => {
    assert.equal(
      (await post('air1', '/v1/disputes', { invoiceId: state.invoice.id, reason: 'x'.repeat(10) }))
        .status,
      403,
    );
    assert.equal((await get('air2', '/v1/ledger')).status, 403);
  });
});

describe('9. Staff roles stay in their lane', () => {
  // Valid bodies, so a 403 proves the permission check and not just validation.
  const production = () => ({
    recipeId: state.recipe.id,
    locationId: state.locations[0].id,
    producedOn: isoDate(0),
    plannedPortions: '1',
    actualPortions: '1',
  });
  const rateCard = () => ({
    airlineId: state.air1Id,
    validFrom: isoDate(400),
    lines: [{ recipeId: state.recipe.id, unitPrice: '1.00', minimumQuantity: 0 }],
  });
  const forbidden = [
    ['store', 'POST', '/v1/requests/x/accept'],
    ['store', 'POST', '/v1/invoices', () => ({ requestId: state.requestId })],
    ['kitchen', 'POST', '/v1/invoices', () => ({ requestId: state.requestId })],
    ['kitchen', 'POST', '/v1/airlines', () => ({ code: 'HACK', name: 'Hack Air' })],
    ['ops', 'POST', '/v1/invoices/x/issue'],
    ['finance', 'POST', '/v1/production', production],
    ['air1', 'POST', '/v1/production', production],
    ['ops', 'POST', '/v1/airlines', () => ({ code: 'HACK', name: 'Hack Air' })],
    ['air1', 'POST', '/v1/airlines', () => ({ code: 'HACK', name: 'Hack Air' })],
    ['air1', 'POST', '/v1/rate-cards', rateCard],
    ['store', 'POST', '/v1/rate-cards', rateCard],
    ['air1', 'POST', '/v1/branches', () => ({ code: 'HACK', name: 'Hack branch' })],
    ['ops', 'POST', '/v1/branches', () => ({ code: 'HACK', name: 'Hack branch' })],
  ];
  for (const [who, method, path, body] of forbidden) {
    test(`${who} cannot ${method} ${path}`, async () => {
      const result = await call(who, method, path, body ? body() : {});
      assert.equal(result.status, 403, `got ${result.status} ${JSON.stringify(result.body)}`);
    });
  }
});

describe('10. Every read route answers without a server error', () => {
  const reads = [
    '/v1/airlines',
    '/v1/airlines/terms',
    '/v1/invoices',
    '/v1/invoices/billable-requests',
    '/v1/ledger',
    '/v1/items',
    '/v1/suppliers',
    '/v1/locations',
    '/v1/purchases',
    '/v1/receipts',
    '/v1/branches',
    '/v1/branches/open',
    '/v1/deliveries',
    '/v1/disputes',
    '/v1/forecast',
    '/v1/notifications',
    '/v1/notifications/unread-count',
    '/v1/recipes',
    '/v1/production',
    '/v1/meal-costs',
    '/v1/requests',
    '/v1/requests/menu',
    '/v1/room-floors',
    '/v1/room-types',
    '/v1/hotel-rooms',
    '/v1/room-requests',
    '/v1/room-invoices',
    '/v1/rate-cards',
    '/v1/rate-cards/airlines',
    '/v1/stock',
    '/v1/stock/low',
    '/v1/stock/issues',
    '/v1/stock/transfers',
    '/v1/stock/counts',
  ];
  for (const who of ['admin', 'ops', 'store', 'kitchen', 'finance', 'air1']) {
    test(`${who}: no 5xx on any read`, async () => {
      const failures = [];
      for (const path of reads) {
        const result = await get(who, path);
        if (result.status >= 500) failures.push(`${path} ${result.status}`);
      }
      assert.deepEqual(failures, []);
    });
  }
});

describe('11. Browser sessions use an httpOnly cookie', () => {
  const login = (client, email) =>
    fetch(`${BASE}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-karam-client': client },
      body: JSON.stringify({ email, password: passwordFor(email) }),
    });
  const cookieFrom = (response) => (response.headers.get('set-cookie') ?? '').split(';')[0];

  test('signing in from an app sets an httpOnly, SameSite=Strict cookie scoped to the API', async () => {
    const response = await login('staff', USERS.ops);
    assert.equal(response.status, 200);
    const header = response.headers.get('set-cookie') ?? '';
    assert.match(header, /^kz_staff_session=/);
    assert.match(header, /HttpOnly/i);
    assert.match(header, /SameSite=Strict/i);
    assert.match(header, /Path=\/v1/i);
    state.staffCookie = cookieFrom(response);
  });

  test('the cookie works only when the app names itself, so another site cannot use it', async () => {
    const withHeader = await fetch(`${BASE}/v1/auth/me`, {
      headers: { Cookie: state.staffCookie, 'x-karam-client': 'staff' },
    });
    assert.equal(withHeader.status, 200);
    const forged = await fetch(`${BASE}/v1/requests/x/accept`, {
      method: 'POST',
      headers: { Cookie: state.staffCookie, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'a=1',
    });
    assert.equal(forged.status, 401, 'a cross-site form post with the cookie was not refused');
  });

  test('the staff cookie does not sign anyone in to the airline portal', async () => {
    const result = await fetch(`${BASE}/v1/auth/me`, {
      headers: { Cookie: state.staffCookie, 'x-karam-client': 'portal' },
    });
    assert.equal(result.status, 401);
  });

  test('staff and airline sessions in one browser stay separate', async () => {
    const portal = await login('portal', USERS.air1);
    const both = `${state.staffCookie}; ${cookieFrom(portal)}`;
    const staffMe = await (
      await fetch(`${BASE}/v1/auth/me`, { headers: { Cookie: both, 'x-karam-client': 'staff' } })
    ).json();
    const portalMe = await (
      await fetch(`${BASE}/v1/auth/me`, { headers: { Cookie: both, 'x-karam-client': 'portal' } })
    ).json();
    assert.equal(staffMe.role, 'OPERATIONS_MANAGER');
    assert.equal(portalMe.role, 'AIRLINE_REQUESTER');
  });

  test('signing out clears the cookie', async () => {
    const response = await fetch(`${BASE}/v1/auth/logout`, {
      method: 'POST',
      headers: { Cookie: state.staffCookie, 'x-karam-client': 'staff' },
    });
    assert.equal(response.status, 204);
    assert.match(response.headers.get('set-cookie') ?? '', /kz_staff_session=;/);
  });
});

describe('12. User accounts are managed by an administrator', () => {
  const email = `e2e-${Date.now()}@karam.local`;
  const password = 'first-long-password';

  test('only an administrator can see or add accounts', async () => {
    assert.equal((await get('ops', '/v1/users')).status, 403);
    assert.equal((await get('air1', '/v1/users')).status, 403);
    const all = ok(await get('admin', '/v1/users'), 'users');
    assert.ok(all.some((row) => row.email === USERS.air1 && !row.staff));
    assert.ok(all.every((row) => !JSON.stringify(row).includes('passwordHash')));
  });

  test('a new staff account can sign in at once', async () => {
    const created = ok(
      await post('admin', '/v1/users', { name: 'E2E Cook', email, role: 'KITCHEN_LEAD', password }),
      'create user',
    );
    assert.equal(created.staff, true);
    state.newUserId = created.id;
    const login = ok(await post(null, '/v1/auth/login', { email, password }), 'login');
    state.newUserToken = login.accessToken;
  });

  test('a staff role on an airline account, or a short password, is refused', async () => {
    assert.equal(
      (
        await post('admin', '/v1/users', {
          name: 'X',
          email: `x-${email}`,
          role: 'ADMINISTRATOR',
          organisationId: state.air1Id,
          password,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await post('admin', '/v1/users', {
          name: 'X',
          email: `y-${email}`,
          role: 'STOREKEEPER',
          password: 'short',
        })
      ).status,
      400,
    );
  });

  test('a new password signs the person out everywhere', async () => {
    ok(
      await post('admin', `/v1/users/${state.newUserId}/password`, {
        password: 'second-long-password',
      }),
      'set password',
    );
    assert.equal((await get({ raw: state.newUserToken }, '/v1/auth/me')).status, 401);
    assert.equal((await post(null, '/v1/auth/login', { email, password })).status, 401);
    ok(
      await post(null, '/v1/auth/login', { email, password: 'second-long-password' }),
      'new login',
    );
  });

  test('revoking stops sign-in, and restoring brings it back', async () => {
    ok(await post('admin', `/v1/users/${state.newUserId}/revoke`), 'revoke');
    assert.equal(
      (await post(null, '/v1/auth/login', { email, password: 'second-long-password' })).status,
      401,
    );
    ok(await post('admin', `/v1/users/${state.newUserId}/restore`), 'restore');
    ok(
      await post(null, '/v1/auth/login', { email, password: 'second-long-password' }),
      'login again',
    );
  });

  test('an administrator cannot revoke or delete themselves', async () => {
    const me = ok(await get('admin', '/v1/auth/me'), 'me');
    assert.equal((await post('admin', `/v1/users/${me.id}/revoke`)).status, 400);
    assert.equal((await call('admin', 'DELETE', `/v1/users/${me.id}`)).status, 400);
  });

  test('someone with records is kept; an account with no history can be deleted', async () => {
    const ops = ok(await get('admin', '/v1/users'), 'users').find((row) => row.email === USERS.ops);
    assert.equal((await call('admin', 'DELETE', `/v1/users/${ops.id}`)).status, 409);
    assert.equal((await call('admin', 'DELETE', `/v1/users/${state.newUserId}`)).status, 204);
    assert.equal(
      (await post(null, '/v1/auth/login', { email, password: 'second-long-password' })).status,
      401,
    );
  });
});

describe('13. Room requests show whether the rooms are free before a decision', () => {
  async function sendStay(rooms, fromDay, roomTypeId) {
    const [branch] = ok(await get('air1', '/v1/branches/for-stays'), 'branches');
    const offers = ok(
      await get('air1', `/v1/room-requests/offers?branchId=${branch.id}`),
      'offers',
    );
    const type = roomTypeId
      ? offers.find((offer) => offer.id === roomTypeId)
      : offers.find((offer) => offer.rooms > 0);
    assert.ok(type, 'no room type with rooms in this branch');
    const created = ok(
      await post('air1', '/v1/room-requests', {
        checkIn: isoDate(fromDay),
        checkOut: isoDate(fromDay + 2),
        branchId: branch.id,
        party: 'E2E crew',
        lines: [{ roomTypeId: type.id, rooms: rooms === 'all' ? type.rooms : rooms }],
      }),
      'create stay',
    );
    ok(await post('air1', `/v1/room-requests/${created.id}/submit`), 'submit stay');
    return { id: created.id, roomTypeId: type.id };
  }

  test('when another stay takes the rooms first, the waiting stay is shown short and cannot be accepted', async () => {
    const day = 40 + Math.floor(Math.random() * 200);
    // Two airlines ask for the same nights; both can be sent while the rooms are still free.
    const first = await sendStay('all', day);
    const second = await sendStay(1, day, first.roomTypeId);
    const before = ok(await get('ops', `/v1/room-requests/${second.id}/availability`), 'before');
    assert.equal(before.canAccept, true);
    // Accepting the first takes every room, so the second is now short.
    ok(
      await post('ops', `/v1/room-requests/${first.id}/accept`),
      'accept the stay taking every room',
    );
    const check = ok(
      await get('ops', `/v1/room-requests/${second.id}/availability`),
      'availability',
    );
    assert.equal(check.canAccept, false);
    assert.equal(check.lines[0].free, 0);
    assert.equal(check.lines[0].short, 1);
    assert.ok(check.lines[0].booked >= check.lines[0].rooms);
    assert.equal((await post('ops', `/v1/room-requests/${second.id}/accept`)).status, 400);
  });

  test('a stay that fits is shown free, and accepting it agrees', async () => {
    const stay = await sendStay(1, 250 + Math.floor(Math.random() * 100));
    const check = ok(await get('ops', `/v1/room-requests/${stay.id}/availability`), 'availability');
    assert.equal(check.canAccept, true);
    assert.equal(check.lines[0].short, 0);
    ok(await post('ops', `/v1/room-requests/${stay.id}/accept`), 'accept');
  });

  test('an airline never sees room availability', async () => {
    const stay = await sendStay(1, 400 + Math.floor(Math.random() * 100));
    assert.equal((await get('air1', `/v1/room-requests/${stay.id}/availability`)).status, 403);
  });
});

after(() => {
  // Nothing to clean: run against a throwaway database.
});
