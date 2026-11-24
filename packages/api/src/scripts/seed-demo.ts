import { todayInKarachi } from '@knazawy/shared';
import {
  BaseUnit,
  LocationType,
  OrganisationType,
  Prisma,
  PrismaClient,
  RecipeKind,
  RecipeStatus,
  RateCardStatus,
  StorageType,
  UserRole,
  UserStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

import { nextDocumentNumber } from '../common/document-number';

const TARGET_COUNT = 10;

function ensureDatabaseUrl(): void {
  if (process.env.DATABASE_URL) return;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL is required');
  }
  process.env.DATABASE_URL = 'postgresql://knazawy:knazawy@localhost:5432/knazawy?schema=public';
}

function dateFromIso(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo seed refuses to run when NODE_ENV=production');
  }

  ensureDatabaseUrl();
  const prisma = new PrismaClient();
  const airlinePassword = process.env.DEMO_AIRLINE_PASSWORD ?? '1234';
  const airlinePasswordHash = await bcrypt.hash(airlinePassword, 10);

  try {
    const karam = await prisma.organisation.findUnique({ where: { code: 'karam' } });
    if (!karam || karam.type !== OrganisationType.KARAM) {
      throw new Error('Run pnpm seed:local first to create the Karam organisation.');
    }

    const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@karam.local').trim().toLowerCase();
    const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!admin || admin.organisationId !== karam.id || admin.role !== UserRole.ADMINISTRATOR) {
      throw new Error(`Run pnpm seed:local first to create ${adminEmail}.`);
    }

    const suppliers = await prisma.supplier.findMany({
      where: { organisationId: karam.id },
      orderBy: { name: 'asc' },
    });
    let supplierNumber = 1;
    while (suppliers.length < TARGET_COUNT) {
      const name = `Demo Supplier ${String(supplierNumber).padStart(2, '0')}`;
      supplierNumber += 1;
      if (suppliers.some((supplier) => supplier.name === name)) continue;
      const supplier = await prisma.supplier.create({
        data: {
          organisationId: karam.id,
          name,
          contactName: `Demo Contact ${supplierNumber - 1}`,
          email: `supplier${String(supplierNumber - 1).padStart(2, '0')}@example.test`,
          paymentTermsDays: 30,
        },
      });
      suppliers.push(supplier);
    }

    const airlineRows = await prisma.organisation.findMany({
      where: { type: OrganisationType.AIRLINE },
      orderBy: { code: 'asc' },
    });
    let airlineNumber = 1;
    while (airlineRows.length < TARGET_COUNT) {
      const code = `DEMOAIR${String(airlineNumber).padStart(2, '0')}`;
      airlineNumber += 1;
      if (airlineRows.some((airline) => airline.code === code)) continue;
      const existing = await prisma.organisation.findUnique({ where: { code } });
      if (existing) continue;
      const airline = await prisma.organisation.create({
        data: {
          code,
          type: OrganisationType.AIRLINE,
          name: `Demo Airline ${String(airlineNumber - 1).padStart(2, '0')}`,
        },
      });
      airlineRows.push(airline);
    }

    const airlineLoginEmails = new Map<string, string>();
    for (const airline of airlineRows) {
      let email = `requester@${airline.code.toLowerCase()}.local`;
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.organisationId !== airline.id) {
        throw new Error(`Cannot seed ${email}: the email belongs to another organisation.`);
      }
      if (existing && existing.role !== UserRole.AIRLINE_REQUESTER) {
        throw new Error(`Cannot seed ${email}: the account is not an airline requester.`);
      }
      if (existing?.status === UserStatus.ACTIVE) {
        airlineLoginEmails.set(airline.id, email);
        continue;
      }
      if (existing) {
        email = `demo-requester@${airline.code.toLowerCase()}.local`;
        const alternate = await prisma.user.findUnique({ where: { email } });
        if (alternate && alternate.organisationId !== airline.id) {
          throw new Error(`Cannot seed ${email}: the email belongs to another organisation.`);
        }
        if (alternate && alternate.role !== UserRole.AIRLINE_REQUESTER) {
          throw new Error(`Cannot seed ${email}: the account is not an airline requester.`);
        }
        if (alternate?.status === UserStatus.ACTIVE) {
          airlineLoginEmails.set(airline.id, email);
          continue;
        }
        if (alternate) {
          throw new Error(`Cannot seed ${email}: the existing account is inactive.`);
        }
      }
      await prisma.user.create({
        data: {
          organisationId: airline.id,
          name: `${airline.name} Requester`,
          email,
          role: UserRole.AIRLINE_REQUESTER,
          status: UserStatus.ACTIVE,
          passwordHash: airlinePasswordHash,
        },
      });
      airlineLoginEmails.set(airline.id, email);
    }

    const activeItems = await prisma.item.findMany({
      where: { organisationId: karam.id, active: true },
      orderBy: { code: 'asc' },
    });
    let ingredientNumber = 1;
    while (activeItems.length < TARGET_COUNT) {
      const code = `DEMO-ING-${String(ingredientNumber).padStart(2, '0')}`;
      ingredientNumber += 1;
      const existing = await prisma.item.findUnique({
        where: { organisationId_code: { organisationId: karam.id, code } },
      });
      if (existing) continue;
      const item = await prisma.item.create({
        data: {
          organisationId: karam.id,
          code,
          name: `Demo Ingredient ${String(ingredientNumber - 1).padStart(2, '0')}`,
          category: 'Demo food',
          baseUnit: BaseUnit.KG,
          purchaseUnit: 'kg',
          conversionToBase: '1',
          reorderLevel: '0',
          shelfLifeDays: 7,
          storageType: StorageType.DRY,
        },
      });
      activeItems.push(item);
    }

    const demoIngredients = activeItems.filter(
      (item) => item.code.startsWith('DEMO-ING-') || item.code === 'DEMO-ING',
    );
    for (let index = 0; index < demoIngredients.length; index += 1) {
      const item = demoIngredients[index];
      const supplier = suppliers[index % suppliers.length];
      if (!item || !supplier) continue;
      await prisma.itemSupplier.upsert({
        where: { itemId_supplierId: { itemId: item.id, supplierId: supplier.id } },
        update: {},
        create: { itemId: item.id, supplierId: supplier.id },
      });
    }
    const recipeIngredients = demoIngredients.length > 0 ? demoIngredients : activeItems;

    const activeRecipes = await prisma.recipe.findMany({
      where: {
        organisationId: karam.id,
        active: true,
        status: RecipeStatus.APPROVED,
      },
      orderBy: { code: 'asc' },
    });
    let recipeNumber = 1;
    while (activeRecipes.length < TARGET_COUNT) {
      const code = `DEMO-MENU-${String(recipeNumber).padStart(2, '0')}`;
      const menuNumber = recipeNumber;
      recipeNumber += 1;
      const item = recipeIngredients[(menuNumber - 1) % recipeIngredients.length];
      if (!item) throw new Error('No active demo ingredients are available for the menu.');

      const existing = await prisma.recipe.findUnique({
        where: { organisationId_code: { organisationId: karam.id, code } },
      });
      let recipeId: string;
      if (existing) {
        if (!existing.name.startsWith('Demo ')) {
          throw new Error(`Cannot seed ${code}: it belongs to a non-demo recipe.`);
        }
        await prisma.recipe.update({
          where: { id: existing.id },
          data: { active: true, status: RecipeStatus.APPROVED },
        });
        recipeId = existing.id;
      } else {
        const recipe = await prisma.recipe.create({
          data: {
            organisationId: karam.id,
            code,
            name:
              menuNumber <= 7
                ? `Demo Meal ${String(menuNumber).padStart(2, '0')}`
                : `Demo Snack ${String(menuNumber).padStart(2, '0')}`,
            kind: menuNumber <= 7 ? RecipeKind.MEAL : RecipeKind.SNACK,
            portions: '1',
            wastagePercent: '0',
            active: true,
            status: RecipeStatus.APPROVED,
          },
        });
        recipeId = recipe.id;
      }

      await prisma.recipeLine.upsert({
        where: { recipeId_itemId: { recipeId, itemId: item.id } },
        update: { quantityPerPortion: '0.1' },
        create: { recipeId, itemId: item.id, quantityPerPortion: '0.1' },
      });
      const recipe = await prisma.recipe.findUniqueOrThrow({ where: { id: recipeId } });
      activeRecipes.push(recipe);
    }

    const branch = await prisma.branch.findFirst({
      where: { organisationId: karam.id, active: true },
      orderBy: { code: 'asc' },
    });
    if (!branch) {
      throw new Error('Run pnpm seed:local first. Karam needs an open branch.');
    }

    const activeLocationCount = await prisma.stockLocation.count({
      where: { organisationId: karam.id, branchId: branch.id, active: true },
    });
    if (activeLocationCount === 0) {
      await prisma.stockLocation.create({
        data: {
          organisationId: karam.id,
          branchId: branch.id,
          name: 'Demo Store',
          type: LocationType.STORE,
        },
      });
    }

    const menuRecipes = await prisma.recipe.findMany({
      where: {
        organisationId: karam.id,
        active: true,
        status: RecipeStatus.APPROVED,
      },
      orderBy: { code: 'asc' },
    });
    const today = dateFromIso(todayInKarachi());

    for (const airline of airlineRows) {
      const currentCard = await prisma.rateCard.findFirst({
        where: {
          organisationId: airline.id,
          status: RateCardStatus.APPROVED,
          validFrom: { lte: today },
          OR: [{ validTo: null }, { validTo: { gte: today } }],
        },
      });
      if (currentCard) continue;

      const nextCard = await prisma.rateCard.findFirst({
        where: {
          organisationId: airline.id,
          status: RateCardStatus.APPROVED,
          validFrom: { gt: today },
        },
        orderBy: { validFrom: 'asc' },
        select: { validFrom: true },
      });
      const validTo = nextCard ? addDays(nextCard.validFrom, -1) : null;

      await prisma.$transaction(async (tx) => {
        const number = await nextDocumentNumber(tx, karam.id, 'RATE_CARD');
        const card = await tx.rateCard.create({
          data: {
            organisationId: airline.id,
            number,
            status: RateCardStatus.APPROVED,
            validFrom: today,
            validTo,
            note: 'Local demo prices; not a commercial agreement.',
            createdById: admin.id,
            approvedAt: new Date(),
            approvedById: admin.id,
            lines: {
              create: menuRecipes.map((recipe) => ({
                recipeId: recipe.id,
                unitPrice: recipe.kind === RecipeKind.MEAL ? '1500.00' : '500.00',
                minimumQuantity: 0,
              })),
            },
          },
        });
        await tx.auditLog.create({
          data: {
            userId: admin.id,
            entity: 'RateCard',
            entityId: card.id,
            action: 'seed_demo',
            after: {
              number,
              airlineCode: airline.code,
              status: RateCardStatus.APPROVED,
              demoPrices: true,
              menuItemCount: menuRecipes.length,
            } satisfies Prisma.InputJsonValue,
          },
        });
      });
    }

    const totals = await Promise.all([
      prisma.organisation.count({ where: { type: OrganisationType.AIRLINE } }),
      prisma.supplier.count({ where: { organisationId: karam.id } }),
      prisma.item.count({ where: { organisationId: karam.id, active: true } }),
      prisma.recipe.count({
        where: {
          organisationId: karam.id,
          active: true,
          status: RecipeStatus.APPROVED,
        },
      }),
    ]);

    console.info('Local demo data is ready:');
    console.info(
      `Airlines: ${totals[0]}; suppliers: ${totals[1]}; ingredients: ${totals[2]}; menu recipes: ${totals[3]}.`,
    );
    console.info(
      `Every airline has an active requester login. Local demo password: ${airlinePassword}`,
    );
    for (const airline of airlineRows) {
      console.info(`  ${airline.name}: ${airlineLoginEmails.get(airline.id)}`);
    }
    console.info(
      'Demo rate cards use SAR 1,500 per meal and SAR 500 per snack where no current approved card existed.',
    );
    console.info('No stock quantities were fabricated.');
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
