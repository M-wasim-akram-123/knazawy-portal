import { checkFulfilment, type FulfilmentRecipe } from './fulfilment';

const biryani: FulfilmentRecipe = {
  recipeId: 'biryani',
  recipeName: 'Chicken biryani',
  kind: 'MEAL',
  wastagePercent: '0.00',
  ingredients: [
    { itemId: 'rice', itemName: 'Rice', baseUnit: 'KG', quantityPerPortion: '0.150' },
    { itemId: 'chicken', itemName: 'Chicken', baseUnit: 'KG', quantityPerPortion: '0.200' },
  ],
};

const pulao: FulfilmentRecipe = {
  recipeId: 'pulao',
  recipeName: 'Vegetable pulao',
  kind: 'MEAL',
  wastagePercent: '10.00',
  ingredients: [{ itemId: 'rice', itemName: 'Rice', baseUnit: 'KG', quantityPerPortion: '0.100' }],
};

const recipes = new Map([
  [biryani.recipeId, biryani],
  [pulao.recipeId, pulao],
]);

describe('order fulfilment from stock', () => {
  it('takes an order that stock covers', () => {
    const result = checkFulfilment({
      requestId: 'r1',
      lines: [{ recipeId: 'biryani', quantity: 100 }],
      recipes,
      onHand: new Map([
        ['rice', '20.0000'],
        ['chicken', '20.0000'],
      ]),
      promisedLines: [],
    });
    expect(result.canFulfil).toBe(true);
    expect(result.lines[0]).toMatchObject({ quantity: 100, canMake: 100, checked: true });
    expect(result.ingredients.find((row) => row.itemId === 'rice')).toMatchObject({
      needed: '15',
      free: '20',
      short: '0',
    });
  });

  it('adds shared ingredients across lines, with wastage, and says how short it is', () => {
    const result = checkFulfilment({
      requestId: 'r1',
      lines: [
        { recipeId: 'biryani', quantity: 100 },
        { recipeId: 'pulao', quantity: 50 },
      ],
      recipes,
      onHand: new Map([
        ['rice', '20'],
        ['chicken', '20'],
      ]),
      promisedLines: [],
    });
    // 100 x 0.150 + 50 x 0.100 x 1.10 = 20.5 kg of rice.
    const rice = result.ingredients.find((row) => row.itemId === 'rice');
    expect(rice).toMatchObject({ needed: '20.5', short: '0.5' });
    expect(result.canFulfil).toBe(false);
  });

  it('holds back stock promised to accepted orders', () => {
    const result = checkFulfilment({
      requestId: 'r2',
      lines: [{ recipeId: 'biryani', quantity: 100 }],
      recipes,
      onHand: new Map([
        ['rice', '20'],
        ['chicken', '20'],
      ]),
      promisedLines: [{ recipeId: 'biryani', quantity: 60 }],
    });
    const chicken = result.ingredients.find((row) => row.itemId === 'chicken');
    expect(chicken).toMatchObject({ promised: '12', free: '8', short: '12' });
    expect(result.lines[0]?.canMake).toBe(40);
    expect(result.canFulfil).toBe(false);
  });

  it('never counts free stock below zero', () => {
    const result = checkFulfilment({
      requestId: 'r3',
      lines: [{ recipeId: 'pulao', quantity: 1 }],
      recipes,
      onHand: new Map([['rice', '0.05']]),
      promisedLines: [{ recipeId: 'biryani', quantity: 10 }],
    });
    expect(result.ingredients[0]).toMatchObject({ free: '0', short: '0.11' });
    expect(result.lines[0]?.canMake).toBe(0);
  });

  it('cannot confirm an item whose recipe has no ingredients', () => {
    const empty = new Map(recipes);
    empty.set('tea', {
      recipeId: 'tea',
      recipeName: 'Tea',
      kind: 'SNACK',
      wastagePercent: '0',
      ingredients: [],
    });
    const result = checkFulfilment({
      requestId: 'r4',
      lines: [{ recipeId: 'tea', quantity: 5 }],
      recipes: empty,
      onHand: new Map(),
      promisedLines: [],
    });
    expect(result.lines[0]?.checked).toBe(false);
    expect(result.canFulfil).toBe(false);
  });
});
