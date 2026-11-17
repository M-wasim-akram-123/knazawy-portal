// Fills a running API with realistic test data, through the API itself, so every stock layer,
// invoice, and ledger line is made by the real business rules.
//
//   SEED_BASE_URL=http://localhost:3001 node packages/api/scripts/seed-scenarios.mjs
//
// Run `pnpm seed:local` first (Karam, the branch, and the staff logins). Safe to run twice:
// master data is matched by code, name, or email, and the scenarios run only once.
// Never point this at production.

const BASE = process.env.SEED_BASE_URL ?? 'http://localhost:3001';
const STAFF_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? '1234';
const AIRLINE_PASSWORD = process.env.SEED_AIRLINE_PASSWORD ?? 'Demo-pass-2026';
const MARKER = 'Scenario seed';

const tokens = {};

async function call(who, method, path, body) {
  const headers = { Accept: 'application/json' };
  if (tokens[who]) headers.Authorization = `Bearer ${tokens[who]}`;
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const response = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = Array.isArray(json?.message) ? json.message.join('; ') : json?.message;
    throw new Error(`${method} ${path} as ${who}: ${response.status} ${message ?? text}`);
  }
  return json;
}
const get = (who, path) => call(who, 'GET', path);
const post = (who, path, body) => call(who, 'POST', path, body ?? {});
const patch = (who, path, body) => call(who, 'PATCH', path, body);

async function login(who, email, password) {
  const result = await post('nobody', '/v1/auth/login', { email, password });
  tokens[who] = result.accessToken;
}

function isoDate(daysFromToday) {
  const now = new Date(Date.now() + 5 * 60 * 60 * 1000); // Asia/Karachi
  now.setUTCDate(now.getUTCDate() + daysFromToday);
  return now.toISOString().slice(0, 10);
}

const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
    '1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082',
  'hex',
);

// ---------------------------------------------------------------- master data

const LOCATIONS = [
  { name: 'Main Dry Store', type: 'STORE' },
  { name: 'Cold Room', type: 'COLD_ROOM' },
  { name: 'Deep Freezer', type: 'FREEZER' },
  { name: 'Hot Kitchen', type: 'KITCHEN' },
  { name: 'Delivery Van 1', type: 'VEHICLE' },
];

// code, name, category, base unit, purchase unit, units per purchase unit, reorder level,
// shelf life days, storage, where it is kept, price per purchase unit
const ITEMS = [
  [
    'RICE-BAS',
    'Basmati rice',
    'Grains',
    'KG',
    'Bag 25 kg',
    '25',
    '50',
    365,
    'DRY',
    'Main Dry Store',
    '8500',
  ],
  [
    'FLOUR-WHT',
    'Wheat flour',
    'Grains',
    'KG',
    'Bag 50 kg',
    '50',
    '40',
    120,
    'DRY',
    'Main Dry Store',
    '7200',
  ],
  [
    'DAAL-MSR',
    'Red lentils',
    'Pulses',
    'KG',
    'Bag 25 kg',
    '25',
    '15',
    365,
    'DRY',
    'Main Dry Store',
    '7000',
  ],
  [
    'CHANA',
    'Chickpeas',
    'Pulses',
    'KG',
    'Bag 25 kg',
    '25',
    '15',
    365,
    'DRY',
    'Main Dry Store',
    '6500',
  ],
  [
    'CHK-BNL',
    'Chicken boneless',
    'Meat',
    'KG',
    'Kilogram',
    '1',
    '30',
    3,
    'CHILLED',
    'Cold Room',
    '1150',
  ],
  ['MUTTON', 'Mutton', 'Meat', 'KG', 'Kilogram', '1', '15', 3, 'CHILLED', 'Cold Room', '2400'],
  [
    'BEEF-MNC',
    'Beef mince',
    'Meat',
    'KG',
    'Kilogram',
    '1',
    '15',
    3,
    'CHILLED',
    'Cold Room',
    '1500',
  ],
  [
    'FISH-FIL',
    'Fish fillet',
    'Seafood',
    'KG',
    'Kilogram',
    '1',
    '10',
    90,
    'FROZEN',
    'Deep Freezer',
    '1900',
  ],
  [
    'OIL-CKG',
    'Cooking oil',
    'Oils',
    'LITRE',
    'Can 16 L',
    '16',
    '32',
    270,
    'DRY',
    'Main Dry Store',
    '8000',
  ],
  [
    'ONION',
    'Onions',
    'Vegetables',
    'KG',
    'Bag 40 kg',
    '40',
    '40',
    30,
    'DRY',
    'Main Dry Store',
    '4800',
  ],
  [
    'TOMATO',
    'Tomatoes',
    'Vegetables',
    'KG',
    'Crate 20 kg',
    '20',
    '20',
    7,
    'CHILLED',
    'Cold Room',
    '3000',
  ],
  [
    'POTATO',
    'Potatoes',
    'Vegetables',
    'KG',
    'Bag 40 kg',
    '40',
    '40',
    45,
    'DRY',
    'Main Dry Store',
    '3600',
  ],
  [
    'VEG-MIX',
    'Mixed vegetables, frozen',
    'Vegetables',
    'KG',
    'Bag 2.5 kg',
    '2.5',
    '10',
    180,
    'FROZEN',
    'Deep Freezer',
    '1100',
  ],
  ['YOGURT', 'Yogurt', 'Dairy', 'KG', 'Tub 5 kg', '5', '15', 7, 'CHILLED', 'Cold Room', '1600'],
  ['BUTTER', 'Butter', 'Dairy', 'KG', 'Block 1 kg', '1', '5', 60, 'CHILLED', 'Cold Room', '2200'],
  ['MILK', 'Milk', 'Dairy', 'LITRE', 'Pack 1 L', '1', '20', 5, 'CHILLED', 'Cold Room', '220'],
  ['EGGS', 'Eggs', 'Dairy', 'PIECE', 'Tray 30', '30', '120', 21, 'CHILLED', 'Cold Room', '900'],
  [
    'MASALA',
    'Garam masala',
    'Spices',
    'KG',
    'Pack 1 kg',
    '1',
    '3',
    365,
    'DRY',
    'Main Dry Store',
    '2800',
  ],
  ['SALT', 'Salt', 'Spices', 'KG', 'Bag 10 kg', '10', '10', 730, 'DRY', 'Main Dry Store', '600'],
  [
    'SUGAR',
    'Sugar',
    'Dry goods',
    'KG',
    'Bag 50 kg',
    '50',
    '20',
    730,
    'DRY',
    'Main Dry Store',
    '7500',
  ],
  [
    'BREAD-RL',
    'Bread rolls',
    'Bakery',
    'PIECE',
    'Pack 12',
    '12',
    '96',
    3,
    'DRY',
    'Main Dry Store',
    '480',
  ],
  [
    'TEA',
    'Tea leaves',
    'Beverages',
    'KG',
    'Pack 1 kg',
    '1',
    '3',
    365,
    'DRY',
    'Main Dry Store',
    '1800',
  ],
  [
    'JUICE',
    'Juice pack 200 ml',
    'Beverages',
    'PIECE',
    'Carton 24',
    '24',
    '96',
    180,
    'DRY',
    'Main Dry Store',
    '1440',
  ],
  [
    'BISCUIT',
    'Biscuit pack',
    'Snacks',
    'PIECE',
    'Carton 48',
    '48',
    '96',
    180,
    'DRY',
    'Main Dry Store',
    '1920',
  ],
  [
    'FRUIT',
    'Seasonal fruit',
    'Fruit',
    'KG',
    'Crate 10 kg',
    '10',
    '15',
    5,
    'CHILLED',
    'Cold Room',
    '2500',
  ],
];

// Items kept deliberately short, so "Running low" and "Not enough stock" have something to show.
const SHORT_ITEMS = new Set(['FISH-FIL', 'MUTTON', 'BUTTER']);

const SUPPLIERS = [
  ['Al-Madina Rice Traders', 'Imran Qureshi', 30, ['RICE-BAS', 'DAAL-MSR', 'CHANA']],
  ['Lahore Poultry House', 'Bilal Ahmed', 7, ['CHK-BNL', 'EGGS']],
  ['Mehran Meat Suppliers', 'Kashif Ali', 7, ['MUTTON', 'BEEF-MNC']],
  ['Sea Breeze Fish Market', 'Nadia Hussain', 15, ['FISH-FIL']],
  ['Karachi Fresh Vegetables', 'Rashid Khan', 7, ['ONION', 'TOMATO', 'POTATO']],
  ['Polar Frozen Foods', 'Sana Iqbal', 30, ['VEG-MIX']],
  ['Punjab Dairy Co.', 'Usman Tariq', 15, ['YOGURT', 'BUTTER', 'MILK']],
  ['Sindh Flour Mills', 'Farhan Siddiqui', 30, ['FLOUR-WHT']],
  ['Golden Oil Distributors', 'Asad Mirza', 30, ['OIL-CKG']],
  ['Zaiqa Spice Wholesalers', 'Hina Rauf', 30, ['MASALA', 'SALT']],
  ['Sweet Crystal Sugar', 'Waqas Javed', 30, ['SUGAR']],
  ['Bakers Choice', 'Ayesha Noor', 7, ['BREAD-RL', 'BISCUIT']],
  ['Hill Tea Company', 'Zubair Shah', 30, ['TEA']],
  ['Crystal Beverages', 'Maria Khan', 30, ['JUICE']],
  ['Green Valley Fruits', 'Tahir Mehmood', 7, ['FRUIT']],
  ['Pak Packaging Solutions', 'Saad Butt', 45, []],
];

// code, name, kind, wastage %, [item code, quantity per portion]
const RECIPES = [
  [
    'M-BIRYANI',
    'Chicken biryani',
    'MEAL',
    '5',
    [
      ['RICE-BAS', '0.150'],
      ['CHK-BNL', '0.180'],
      ['ONION', '0.040'],
      ['YOGURT', '0.030'],
      ['OIL-CKG', '0.025'],
      ['MASALA', '0.004'],
    ],
  ],
  [
    'M-PULAO',
    'Mutton pulao',
    'MEAL',
    '5',
    [
      ['RICE-BAS', '0.150'],
      ['MUTTON', '0.160'],
      ['ONION', '0.040'],
      ['OIL-CKG', '0.020'],
      ['MASALA', '0.003'],
    ],
  ],
  [
    'M-KARAHI',
    'Chicken karahi with naan',
    'MEAL',
    '5',
    [
      ['CHK-BNL', '0.200'],
      ['TOMATO', '0.080'],
      ['FLOUR-WHT', '0.120'],
      ['OIL-CKG', '0.030'],
      ['MASALA', '0.004'],
    ],
  ],
  [
    'M-QEEMA',
    'Beef qeema with rice',
    'MEAL',
    '5',
    [
      ['BEEF-MNC', '0.150'],
      ['RICE-BAS', '0.120'],
      ['ONION', '0.040'],
      ['TOMATO', '0.040'],
      ['OIL-CKG', '0.020'],
    ],
  ],
  [
    'M-DAAL',
    'Daal chawal',
    'MEAL',
    '3',
    [
      ['DAAL-MSR', '0.090'],
      ['RICE-BAS', '0.150'],
      ['ONION', '0.030'],
      ['OIL-CKG', '0.015'],
      ['SALT', '0.004'],
    ],
  ],
  [
    'M-CHANA',
    'Chana masala with rice',
    'MEAL',
    '3',
    [
      ['CHANA', '0.090'],
      ['RICE-BAS', '0.140'],
      ['TOMATO', '0.050'],
      ['OIL-CKG', '0.015'],
    ],
  ],
  [
    'M-FISH',
    'Fish curry with rice',
    'MEAL',
    '6',
    [
      ['FISH-FIL', '0.170'],
      ['RICE-BAS', '0.140'],
      ['TOMATO', '0.050'],
      ['OIL-CKG', '0.020'],
      ['MASALA', '0.003'],
    ],
  ],
  [
    'M-ALOO',
    'Aloo gosht',
    'MEAL',
    '5',
    [
      ['MUTTON', '0.120'],
      ['POTATO', '0.120'],
      ['ONION', '0.040'],
      ['OIL-CKG', '0.020'],
    ],
  ],
  [
    'M-VEGRICE',
    'Vegetable fried rice',
    'MEAL',
    '3',
    [
      ['RICE-BAS', '0.160'],
      ['VEG-MIX', '0.100'],
      ['OIL-CKG', '0.020'],
      ['SALT', '0.003'],
    ],
  ],
  [
    'M-EGGRICE',
    'Egg fried rice',
    'MEAL',
    '3',
    [
      ['RICE-BAS', '0.160'],
      ['EGGS', '2'],
      ['VEG-MIX', '0.050'],
      ['OIL-CKG', '0.020'],
    ],
  ],
  [
    'M-BRKFST',
    'Continental breakfast',
    'MEAL',
    '2',
    [
      ['EGGS', '2'],
      ['BREAD-RL', '2'],
      ['BUTTER', '0.020'],
      ['JUICE', '1'],
      ['FRUIT', '0.100'],
    ],
  ],
  [
    'M-KIDS',
    'Kids meal',
    'MEAL',
    '3',
    [
      ['CHK-BNL', '0.100'],
      ['POTATO', '0.120'],
      ['OIL-CKG', '0.030'],
      ['JUICE', '1'],
    ],
  ],
  [
    'M-VEGDIET',
    'Special diet vegetable meal',
    'MEAL',
    '3',
    [
      ['VEG-MIX', '0.180'],
      ['RICE-BAS', '0.120'],
      ['DAAL-MSR', '0.050'],
    ],
  ],
  [
    'S-CHKSAND',
    'Chicken sandwich',
    'SNACK',
    '3',
    [
      ['BREAD-RL', '2'],
      ['CHK-BNL', '0.080'],
      ['BUTTER', '0.010'],
    ],
  ],
  [
    'S-EGGSAND',
    'Egg sandwich',
    'SNACK',
    '3',
    [
      ['BREAD-RL', '2'],
      ['EGGS', '1'],
      ['BUTTER', '0.010'],
    ],
  ],
  [
    'S-SAMOSA',
    'Vegetable samosa (2 pieces)',
    'SNACK',
    '4',
    [
      ['FLOUR-WHT', '0.060'],
      ['POTATO', '0.080'],
      ['OIL-CKG', '0.030'],
    ],
  ],
  ['S-FRUIT', 'Fruit cup', 'SNACK', '8', [['FRUIT', '0.180']]],
  [
    'S-TEA',
    'Tea and biscuits',
    'SNACK',
    '2',
    [
      ['TEA', '0.004'],
      ['MILK', '0.050'],
      ['SUGAR', '0.010'],
      ['BISCUIT', '1'],
    ],
  ],
  ['S-JUICE', 'Juice box', 'SNACK', '0', [['JUICE', '1']]],
];

// code, name, payment days, discount %
const AIRLINES = [
  ['IND', 'Indus Air', 30, '0'],
  ['KKR', 'Karakoram Airways', 45, '2.5'],
  ['SSK', 'Sindh Sky', 30, '5'],
  ['MRG', 'Margalla Air', 15, '0'],
  ['GWD', 'Gwadar Wings', 60, '7.5'],
  ['THR', 'Thar Air', 30, '0'],
  ['SWT', 'Swat Valley Airlines', 30, '2'],
  ['RAV', 'Ravi Air', 45, '0'],
  ['CHN', 'Chenab Airways', 30, '3'],
  ['KHN', 'Kohinoor Air', 0, '0'],
  ['ARC', 'Arabian Crescent', 60, '5'],
  ['GPA', 'Gulf Pearl Airways', 45, '4'],
  ['SLK', 'Silk Route Air', 30, '0'],
  ['DFL', 'Desert Falcon', 30, '2.5'],
  ['OAS', 'Oasis Airlines', 15, '0'],
];

const EXTRA_STAFF = [
  ['Sadia Operations', 'sadia.ops@karam.local', 'OPERATIONS_MANAGER'],
  ['Hamza Operations', 'hamza.ops@karam.local', 'OPERATIONS_MANAGER'],
  ['Ali Store', 'ali.store@karam.local', 'STOREKEEPER'],
  ['Noman Store', 'noman.store@karam.local', 'STOREKEEPER'],
  ['Chef Rizwan', 'rizwan.kitchen@karam.local', 'KITCHEN_LEAD'],
  ['Chef Amna', 'amna.kitchen@karam.local', 'KITCHEN_LEAD'],
  ['Fatima Finance', 'fatima.finance@karam.local', 'FINANCE_OFFICER'],
];

const FLOORS = ['Ground floor', 'First floor', 'Second floor'];
const ROOM_TYPES = [
  ['Single', 'One bed, for a crew member', '9500'],
  ['Double', 'Two beds', '14500'],
  ['Crew suite', 'Two rooms and a lounge, for a captain', '24000'],
];

// ---------------------------------------------------------------- helpers

const log = (message) => console.log(`  ${message}`);

async function ensure(list, match, create, label) {
  const found = list.find(match);
  if (found) return found;
  const made = await create();
  list.push(made);
  log(`added ${label}`);
  return made;
}

function billForm(supplierId, locationId, lines, number) {
  const form = new FormData();
  form.set('supplierId', supplierId);
  form.set('billNumber', number);
  form.set('billedOn', isoDate(0));
  form.set('locationId', locationId);
  const total = lines.reduce(
    (sum, line) => sum + Number(line.quantity) * Number(line.unitPrice),
    0,
  );
  form.set('billTotal', total.toFixed(2));
  form.set('tax', '0');
  form.set('discount', '0');
  form.set('lines', JSON.stringify(lines));
  form.set('bill', new Blob([PNG], { type: 'image/png' }), `${number}.png`);
  return form;
}

function passengers(total) {
  const crew = 8;
  const children = Math.round(total * 0.08);
  const infants = Math.round(total * 0.02);
  return { adults: total - crew - children - infants, children, infants, crew, specialDiets: 2 };
}

// ---------------------------------------------------------------- run

async function main() {
  console.log(`Seeding scenarios into ${BASE}`);
  await get('nobody', '/v1/health');
  await login('admin', 'admin@karam.local', STAFF_PASSWORD);
  await login('ops', 'ops@karam.local', STAFF_PASSWORD);
  await login('store', 'store@karam.local', STAFF_PASSWORD);
  await login('kitchen', 'kitchen@karam.local', STAFF_PASSWORD);
  await login('finance', 'finance@karam.local', STAFF_PASSWORD);

  console.log('Staff');
  const users = await get('admin', '/v1/users');
  const branches = await get('admin', '/v1/branches/open');
  for (const [name, email, role] of EXTRA_STAFF) {
    await ensure(
      users,
      (row) => row.email === email,
      () =>
        post('admin', '/v1/users', {
          name,
          email,
          role,
          branchId: branches[0]?.id,
          password: AIRLINE_PASSWORD,
        }),
      `${name} (${role})`,
    );
  }

  console.log('Store locations');
  const locations = await get('store', '/v1/locations');
  for (const location of LOCATIONS) {
    await ensure(
      locations,
      (row) => row.name === location.name,
      () => post('admin', '/v1/locations', location),
      location.name,
    );
  }
  const locationByName = new Map(locations.map((row) => [row.name, row]));

  console.log('Items');
  const items = await get('store', '/v1/items');
  for (const [
    code,
    name,
    category,
    baseUnit,
    purchaseUnit,
    conversionToBase,
    reorderLevel,
    shelfLifeDays,
    storageType,
  ] of ITEMS) {
    await ensure(
      items,
      (row) => row.code === code,
      () =>
        post('admin', '/v1/items', {
          code,
          name,
          category,
          baseUnit,
          purchaseUnit,
          conversionToBase,
          reorderLevel,
          shelfLifeDays,
          storageType,
        }),
      name,
    );
  }
  const itemByCode = new Map(items.map((row) => [row.code, row]));

  console.log('Suppliers');
  const suppliers = await get('store', '/v1/suppliers');
  for (const [name, contactName, paymentTermsDays, codes] of SUPPLIERS) {
    const slug = name.toLowerCase().replace(/[^a-z]+/g, '');
    await ensure(
      suppliers,
      (row) => row.name === name,
      () =>
        post('admin', '/v1/suppliers', {
          name,
          contactName,
          phone: `+92 300 ${String(1000000 + suppliers.length * 7919).slice(0, 7)}`,
          email: `orders@${slug.slice(0, 18)}.example`,
          paymentTermsDays,
          itemIds: codes.map((code) => itemByCode.get(code).id),
        }),
      name,
    );
  }
  const supplierFor = (code) => {
    const entry = SUPPLIERS.find(([, , , codes]) => codes.includes(code));
    return suppliers.find((row) => row.name === entry[0]);
  };

  console.log('Recipes');
  const recipes = await get('kitchen', '/v1/recipes');
  for (const [code, name, kind, wastagePercent, lines] of RECIPES) {
    const recipe = await ensure(
      recipes,
      (row) => row.code === code,
      () =>
        post('kitchen', '/v1/recipes', {
          code,
          name,
          kind,
          portions: '1',
          wastagePercent,
          lines: lines.map(([itemCode, quantity]) => ({
            itemId: itemByCode.get(itemCode).id,
            quantity,
          })),
        }),
      name,
    );
    if (recipe.status !== 'APPROVED') {
      Object.assign(recipe, await post('admin', `/v1/recipes/${recipe.id}/approve`));
    }
  }
  const recipeByCode = new Map(recipes.map((row) => [row.code, row]));

  console.log('Airlines, their people, terms, and prices');
  const airlines = await get('admin', '/v1/airlines');
  const accounts = await get('admin', '/v1/users');
  const allRecipes = RECIPES.map(([code]) => recipeByCode.get(code));
  for (const [code, name, paymentTermsDays, discountPercent] of AIRLINES) {
    const airline = await ensure(
      airlines,
      (row) => row.code === code,
      () => post('admin', '/v1/airlines', { code, name }),
      name,
    );
    const domain = `${code.toLowerCase()}.example`;
    for (const [role, prefix, label] of [
      ['AIRLINE_REQUESTER', 'requests', 'Requests desk'],
      ['AIRLINE_FINANCE', 'finance', 'Accounts'],
    ]) {
      const email = `${prefix}@${domain}`;
      await ensure(
        accounts,
        (row) => row.email === email,
        () =>
          post('admin', '/v1/users', {
            name: `${name} ${label}`,
            email,
            role,
            organisationId: airline.id,
            password: AIRLINE_PASSWORD,
          }),
        email,
      );
    }
    await patch('finance', `/v1/airlines/${airline.id}/terms`, {
      paymentTermsDays,
      discountPercent,
    });
    const cards = await get('finance', `/v1/rate-cards?airlineId=${airline.id}`);
    if (!cards.some((card) => card.status === 'APPROVED' && card.airlineId === airline.id)) {
      const index = AIRLINES.findIndex(([airlineCode]) => airlineCode === code);
      const card = await post('finance', '/v1/rate-cards', {
        airlineId: airline.id,
        validFrom: isoDate(-30),
        note: `${MARKER}: standard prices`,
        lines: allRecipes.map((recipe, line) => ({
          recipeId: recipe.id,
          unitPrice: String(
            (recipe.kind === 'MEAL'
              ? 1200 + ((line * 90 + index * 35) % 1000)
              : 300 + ((line * 40 + index * 15) % 400)
            ).toFixed(2),
          ),
          minimumQuantity: recipe.kind === 'MEAL' ? 20 : 0,
        })),
      });
      await post('finance', `/v1/rate-cards/${card.id}/approve`);
      log(`approved prices for ${name}`);
    }
  }

  console.log('Rooms');
  const floors = await get('admin', '/v1/room-floors');
  for (const [index, name] of FLOORS.entries()) {
    await ensure(
      floors,
      (row) => row.name === name,
      () => post('admin', '/v1/room-floors', { name, sortOrder: index }),
      name,
    );
  }
  const roomTypes = await get('admin', '/v1/room-types');
  for (const [name, note, amountPerNight] of ROOM_TYPES) {
    const type = await ensure(
      roomTypes,
      (row) => row.name === name,
      () => post('admin', '/v1/room-types', { name, note }),
      name,
    );
    if (!(type.charges ?? []).length) {
      await post('admin', `/v1/room-types/${type.id}/charges`, { name: 'Room', amountPerNight });
      await post('admin', `/v1/room-types/${type.id}/charges`, {
        name: 'Breakfast',
        amountPerNight: '1500',
      });
    }
  }
  const rooms = await get('admin', '/v1/hotel-rooms');
  const freshFloors = await get('admin', '/v1/room-floors');
  const freshTypes = await get('admin', '/v1/room-types');
  for (let number = 0; number < 18; number += 1) {
    const floor = freshFloors.find((row) => row.name === FLOORS[Math.floor(number / 6)]);
    const type = freshTypes.find(
      (row) => row.name === ROOM_TYPES[number % 6 < 3 ? 0 : number % 6 < 5 ? 1 : 2][0],
    );
    const name = `${Math.floor(number / 6) + 1}${String((number % 6) + 1).padStart(2, '0')}`;
    await ensure(
      rooms,
      (row) => row.name === name,
      () => post('admin', '/v1/hotel-rooms', { floorId: floor.id, roomTypeId: type.id, name }),
      `room ${name}`,
    );
  }

  // ------------------------------------------------------------ scenarios (once)
  const existing = await get('ops', '/v1/requests');
  if (existing.some((row) => row.note === MARKER)) {
    console.log('Scenarios already seeded. Master data is up to date.');
    return;
  }

  console.log('Stock in: supplier bills, two deliveries per item for FIFO layers');
  for (const round of [0, 1]) {
    const bySupplier = new Map();
    for (const [code, , , , , conversion, reorder, , , locationName, price] of ITEMS) {
      const supplier = supplierFor(code);
      const base = SHORT_ITEMS.has(code) ? Number(reorder) * 0.4 : Number(reorder) * 6;
      const quantity = Math.max(1, Math.ceil(base / Number(conversion) / 2));
      const unitPrice = (Number(price) * (round === 0 ? 1 : 1.06)).toFixed(2);
      const key = `${supplier.id}:${locationName}`;
      if (!bySupplier.has(key)) bySupplier.set(key, { supplier, locationName, lines: [] });
      bySupplier
        .get(key)
        .lines.push({ itemId: itemByCode.get(code).id, quantity: String(quantity), unitPrice });
    }
    let bill = 0;
    for (const { supplier, locationName, lines } of bySupplier.values()) {
      bill += 1;
      await post(
        'store',
        '/v1/bills',
        billForm(
          supplier.id,
          locationByName.get(locationName).id,
          lines,
          `SB-${round + 1}${String(bill).padStart(3, '0')}`,
        ),
      );
    }
    log(`round ${round + 1}: ${bill} supplier bills posted`);
  }

  console.log('Purchase orders: one draft, one sent and half received');
  const draftPo = await post('store', '/v1/purchases', {
    supplierId: supplierFor('RICE-BAS').id,
    orderedOn: isoDate(0),
    lines: [{ itemId: itemByCode.get('RICE-BAS').id, quantity: '10', unitPrice: '8400' }],
  });
  log(`draft ${draftPo.number}`);
  const sentPo = await post('store', '/v1/purchases', {
    supplierId: supplierFor('CHK-BNL').id,
    orderedOn: isoDate(0),
    lines: [
      { itemId: itemByCode.get('CHK-BNL').id, quantity: '40', unitPrice: '1120' },
      { itemId: itemByCode.get('EGGS').id, quantity: '10', unitPrice: '880' },
    ],
  });
  const sent = await post('store', `/v1/purchases/${sentPo.id}/send`);
  await post('store', '/v1/receipts', {
    purchaseId: sent.id,
    locationId: locationByName.get('Cold Room').id,
    receivedOn: isoDate(0),
    lines: [{ purchaseLineId: sent.lines[0].id, quantity: '20' }],
  });
  log(`${sent.number} sent, 20 of 40 kg chicken received`);

  console.log('Stock movements: a kitchen issue and spoiled stock written off');
  await post('store', '/v1/stock/issues', {
    locationId: locationByName.get('Cold Room').id,
    issuedOn: isoDate(0),
    reason: 'SPOILAGE',
    note: 'Tomatoes went soft',
    lines: [{ itemId: itemByCode.get('TOMATO').id, quantity: '2' }],
  });

  /**
   * How the kitchen works: the store sends each ingredient from where it is kept to the Hot
   * Kitchen (a stock transfer), the kitchen receives it, then records the batch there.
   */
  const kitchenId = locationByName.get('Hot Kitchen').id;
  async function cook(number, lines) {
    const needs = new Map();
    for (const [code, portions] of lines) {
      const [, , , wastage, ingredients] = RECIPES.find(([recipeCode]) => recipeCode === code);
      for (const [itemCode, perPortion] of ingredients) {
        const amount = Number(perPortion) * portions * (1 + Number(wastage) / 100) * 1.02;
        needs.set(itemCode, (needs.get(itemCode) ?? 0) + amount);
      }
    }
    const byLocation = new Map();
    for (const [itemCode, amount] of needs) {
      const where = ITEMS.find(([code]) => code === itemCode)[9];
      if (!byLocation.has(where)) byLocation.set(where, []);
      const unit = itemByCode.get(itemCode).baseUnit;
      const quantity = unit === 'PIECE' ? String(Math.ceil(amount)) : amount.toFixed(3);
      byLocation.get(where).push({ itemId: itemByCode.get(itemCode).id, quantity });
    }
    try {
      for (const [where, transferLines] of byLocation) {
        const transfer = await post('store', '/v1/stock/transfers', {
          fromLocationId: locationByName.get(where).id,
          toLocationId: kitchenId,
          sentOn: isoDate(0),
          lines: transferLines,
        });
        await post('store', `/v1/stock/transfers/${transfer.id}/receive`, {
          receivedOn: isoDate(0),
        });
      }
      for (const [code, portions] of lines) {
        await post('kitchen', '/v1/production', {
          recipeId: recipeByCode.get(code).id,
          locationId: kitchenId,
          producedOn: isoDate(0),
          plannedPortions: String(portions),
          actualPortions: String(portions),
        });
      }
      log(`${number}: ingredients sent to the kitchen and cooked`);
    } catch (error) {
      log(`${number}: could not cook everything (${error.message.split(': ').pop()})`);
    }
  }

  console.log('Airline orders in every state');
  const airlineIds = new Map((await get('admin', '/v1/airlines')).map((row) => [row.code, row.id]));
  const orders = [
    // airline, flight, route, days ahead, passengers, [recipe, portions], what happens
    [
      'IND',
      'IN301',
      'KHI-DXB',
      3,
      180,
      [
        ['M-BIRYANI', 120],
        ['M-DAAL', 40],
        ['S-JUICE', 180],
      ],
      'submit',
    ],
    [
      'KKR',
      'KR112',
      'ISB-GIL',
      2,
      60,
      [
        ['M-VEGRICE', 50],
        ['S-TEA', 60],
      ],
      'submit',
    ],
    [
      'SSK',
      'SS701',
      'KHI-JED',
      4,
      220,
      [
        ['M-FISH', 200],
        ['S-FRUIT', 220],
      ],
      'submit',
    ],
    ['GWD', 'GW220', 'KHI-MCT', 5, 150, [['M-PULAO', 150]], 'submit'],
    [
      'MRG',
      'MG440',
      'ISB-KHI',
      2,
      140,
      [
        ['M-QEEMA', 90],
        ['M-CHANA', 40],
        ['S-SAMOSA', 140],
      ],
      'accept',
    ],
    [
      'ARC',
      'AC009',
      'LHE-RUH',
      3,
      200,
      [
        ['M-KARAHI', 150],
        ['M-VEGDIET', 10],
        ['S-JUICE', 200],
      ],
      'accept',
    ],
    [
      'GPA',
      'GP517',
      'KHI-DOH',
      6,
      120,
      [
        ['M-BRKFST', 110],
        ['M-KIDS', 10],
      ],
      'accept',
    ],
    [
      'THR',
      'TH118',
      'LHE-KHI',
      2,
      90,
      [
        ['S-CHKSAND', 90],
        ['S-JUICE', 90],
      ],
      'deliver',
    ],
    [
      'SWT',
      'SW330',
      'PEW-DXB',
      2,
      160,
      [
        ['M-BIRYANI', 140],
        ['S-EGGSAND', 20],
      ],
      'deliver',
    ],
    ['RAV', 'RV606', 'LHE-ISB', 2, 80, [['S-TEA', 80]], 'invoice'],
    [
      'CHN',
      'CH150',
      'MUX-KHI',
      2,
      100,
      [
        ['M-DAAL', 60],
        ['M-EGGRICE', 40],
      ],
      'invoice',
    ],
    [
      'KHN',
      'KH789',
      'KHI-SHJ',
      2,
      170,
      [
        ['M-BIRYANI', 150],
        ['S-FRUIT', 170],
      ],
      'credit',
    ],
    [
      'ARC',
      'AC011',
      'LHE-RUH',
      2,
      190,
      [
        ['M-KARAHI', 150],
        ['S-JUICE', 190],
      ],
      'dispute',
    ],
    ['SLK', 'SR404', 'ISB-URC', 7, 130, [['M-ALOO', 130]], 'reject'],
    ['DFL', 'DF808', 'KHI-AUH', 8, 110, [['M-FISH', 110]], 'reject'],
    ['OAS', 'OA250', 'MUX-DXB', 9, 75, [['M-VEGRICE', 75]], 'cancel'],
    ['IND', 'IN305', 'KHI-DXB', 10, 175, [['M-BIRYANI', 175]], 'draft'],
    [
      'SSK',
      'SS705',
      'KHI-JED',
      12,
      210,
      [
        ['M-CHANA', 100],
        ['M-DAAL', 110],
      ],
      'draft',
    ],
  ];
  for (const [code, flightNumber, route, days, total, lines, outcome] of orders) {
    const who = `air:${code}`;
    if (!tokens[who]) await login(who, `requests@${code.toLowerCase()}.example`, AIRLINE_PASSWORD);
    const request = await post(who, '/v1/requests', {
      flightNumber,
      route,
      serviceDate: isoDate(days),
      deliveryTime: ['06:30', '11:30', '15:45', '21:10'][flightNumber.length % 4],
      deliveryPoint: ['GATE', 'AIRCRAFT', 'LOUNGE'][total % 3],
      ...passengers(total),
      specialDietNote: 'Two diabetic meals',
      note: MARKER,
      lines: lines.map(([recipe, quantity]) => ({
        recipeId: recipeByCode.get(recipe).id,
        quantity,
      })),
    });
    if (outcome === 'draft') {
      log(`${request.number} ${code} left as a draft`);
      continue;
    }
    await post(who, `/v1/requests/${request.id}/submit`);
    if (outcome === 'submit') {
      log(`${request.number} ${code} waiting for a decision`);
      continue;
    }
    if (outcome === 'reject') {
      await post('ops', `/v1/requests/${request.id}/reject`, {
        reason: 'We cannot staff that flight on that date.',
      });
      log(`${request.number} ${code} rejected`);
      continue;
    }
    await post('ops', `/v1/requests/${request.id}/accept`);
    if (outcome === 'accept') {
      log(`${request.number} ${code} accepted, holding stock`);
      continue;
    }
    if (outcome === 'cancel') {
      await post(who, `/v1/requests/${request.id}/cancel`, {});
      log(`${request.number} ${code} cancelled by the airline`);
      continue;
    }
    await cook(request.number, lines);
    const delivery = await post('ops', '/v1/deliveries', { requestId: request.id });
    const sentLines = lines.map(([recipe, quantity]) => ({
      recipeId: recipeByCode.get(recipe).id,
      quantity,
    }));
    await post('ops', `/v1/deliveries/${delivery.id}/dispatch`, {
      vehicleNote: 'Delivery Van 1',
      lines: sentLines,
    });
    const received = lines.map(([recipe, quantity], index) => ({
      recipeId: recipeByCode.get(recipe).id,
      quantity: outcome === 'credit' && index === 0 ? quantity - 5 : quantity,
    }));
    await post('ops', `/v1/deliveries/${delivery.id}/deliver`, {
      receivedBy: 'Station supervisor',
      lines: received,
    });
    if (outcome === 'deliver') {
      log(`${request.number} ${code} delivered, ready to invoice`);
      continue;
    }
    const draft = await post('finance', '/v1/invoices', { requestId: request.id, note: MARKER });
    const invoice = await post('finance', `/v1/invoices/${draft.id}/issue`);
    log(`${request.number} ${code} invoiced as ${invoice.number}, ${invoice.total} PKR`);
    if (outcome === 'credit') {
      await post('finance', `/v1/invoices/${invoice.id}/credit`, {
        reason: 'Three meals arrived cold',
        lines: [{ recipeId: invoice.lines[0].recipeId, quantity: 3 }],
      });
      log(`  credit note on ${invoice.number}`);
    }
    if (outcome === 'dispute') {
      const finance = `fin:${code}`;
      if (!tokens[finance])
        await login(finance, `finance@${code.toLowerCase()}.example`, AIRLINE_PASSWORD);
      await post(finance, '/v1/disputes', {
        invoiceId: invoice.id,
        reason: 'We were billed the minimum but asked for fewer meals.',
      });
      log(`  ${code} disputed ${invoice.number}`);
    }
  }

  console.log('Room requests');
  const stayBranches = await get('air:IND', '/v1/branches/for-stays');
  const types = await get('air:IND', '/v1/room-requests/offers').catch(() => freshTypes);
  void types;
  const single = freshTypes.find((row) => row.name === 'Single');
  const double = freshTypes.find((row) => row.name === 'Double');
  const stays = [
    ['IND', 0, 2, [[single, 4]], 'checkin'],
    [
      'KKR',
      2,
      4,
      [
        [single, 3],
        [double, 1],
      ],
      'accept',
    ],
    ['GPA', 3, 5, [[double, 2]], 'submit'],
    ['SSK', 5, 6, [[single, 6]], 'reject'],
  ];
  for (const [code, from, to, lines, outcome] of stays) {
    const who = `air:${code}`;
    if (!tokens[who]) await login(who, `requests@${code.toLowerCase()}.example`, AIRLINE_PASSWORD);
    const request = await post(who, '/v1/room-requests', {
      checkIn: isoDate(from),
      checkOut: isoDate(to),
      branchId: stayBranches[0].id,
      party: 'Operating crew',
      note: MARKER,
      lines: lines.map(([type, rooms]) => ({ roomTypeId: type.id, rooms })),
    });
    await post(who, `/v1/room-requests/${request.id}/submit`);
    if (outcome === 'submit') {
      log(`${code} room request waiting`);
      continue;
    }
    if (outcome === 'reject') {
      await post('ops', `/v1/room-requests/${request.id}/reject`, {
        reason: 'Fully booked that night.',
      });
      log(`${code} room request rejected`);
      continue;
    }
    await post('ops', `/v1/room-requests/${request.id}/accept`);
    if (outcome === 'checkin') {
      const free = await get('ops', `/v1/room-requests/${request.id}/free-rooms`);
      const wanted = lines.flatMap(([type, count]) =>
        free.filter((room) => room.roomTypeId === type.id).slice(0, count),
      );
      await post('ops', `/v1/room-requests/${request.id}/check-in`, {
        hotelRoomIds: wanted.map((room) => room.id),
      });
      log(`${code} crew checked in to ${wanted.length} rooms`);
    } else log(`${code} room request accepted`);
  }

  console.log('Done.');
  console.log(
    `Airline logins: requests@<code>.example and finance@<code>.example, password ${AIRLINE_PASSWORD}`,
  );
  console.log(
    `New staff logins use the same password. Airline codes: ${AIRLINES.map(([code]) => code.toLowerCase()).join(', ')}`,
  );
}

main().catch((error) => {
  console.error(`Seeding stopped: ${error.message}`);
  process.exitCode = 1;
});
