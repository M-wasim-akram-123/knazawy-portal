import { OrganisationType, PrismaClient, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

/** One sign-in per Karam role, so each screen can be tried locally. */
const SAMPLE_STAFF = [
  { email: 'ops@karam.local', name: 'Operations Manager', role: UserRole.OPERATIONS_MANAGER },
  { email: 'store@karam.local', name: 'Storekeeper', role: UserRole.STOREKEEPER },
  { email: 'kitchen@karam.local', name: 'Head Chef', role: UserRole.HEAD_CHEF },
  { email: 'chef@karam.local', name: 'Chef', role: UserRole.CHEF },
  { email: 'finance@karam.local', name: 'Finance Officer', role: UserRole.FINANCE_OFFICER },
] as const;

function ensureDatabaseUrl(): void {
  if (process.env.DATABASE_URL) return;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL is required');
  }
  process.env.DATABASE_URL = 'postgresql://knazawy:knazawy@localhost:5432/knazawy?schema=public';
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Dev seed refuses to run when NODE_ENV=production');
  }

  ensureDatabaseUrl();
  const prisma = new PrismaClient();
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@karam.local').trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? '1234';
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const organisation = await prisma.organisation.upsert({
      where: { code: 'karam' },
      update: { name: 'Karam Restaurant', type: OrganisationType.KARAM },
      create: {
        code: 'karam',
        type: OrganisationType.KARAM,
        name: 'Karam Restaurant',
      },
    });

    const branch = await prisma.branch.upsert({
      where: { organisationId_code: { organisationId: organisation.id, code: 'MAIN' } },
      update: { name: 'Karam Restaurant', active: true },
      create: { organisationId: organisation.id, code: 'MAIN', name: 'Karam Restaurant' },
    });

    await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        role: UserRole.ADMINISTRATOR,
        status: UserStatus.ACTIVE,
        organisationId: organisation.id,
        branchId: branch.id,
      },
      create: {
        organisationId: organisation.id,
        name: 'Karam Administrator',
        email,
        role: UserRole.ADMINISTRATOR,
        status: UserStatus.ACTIVE,
        passwordHash,
        branchId: branch.id,
      },
    });

    const staffHash = process.env.SEED_STAFF_PASSWORD
      ? await bcrypt.hash(process.env.SEED_STAFF_PASSWORD, 10)
      : passwordHash;
    for (const staff of SAMPLE_STAFF) {
      await prisma.user.upsert({
        where: { email: staff.email },
        update: {
          name: staff.name,
          passwordHash: staffHash,
          role: staff.role,
          status: UserStatus.ACTIVE,
          organisationId: organisation.id,
          branchId: branch.id,
        },
        create: {
          organisationId: organisation.id,
          name: staff.name,
          email: staff.email,
          role: staff.role,
          status: UserStatus.ACTIVE,
          passwordHash: staffHash,
          branchId: branch.id,
        },
      });
    }

    console.info(`Seeded ${email} on organisation ${organisation.code}`);
    console.info(`Seeded sample staff: ${SAMPLE_STAFF.map((staff) => staff.email).join(', ')}`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
