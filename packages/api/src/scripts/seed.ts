import { OrganisationType, PrismaClient, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

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
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@karam.local';
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

    await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        role: UserRole.ADMINISTRATOR,
        status: UserStatus.ACTIVE,
        organisationId: organisation.id,
      },
      create: {
        organisationId: organisation.id,
        name: 'Karam Administrator',
        email,
        role: UserRole.ADMINISTRATOR,
        status: UserStatus.ACTIVE,
        passwordHash,
      },
    });

    console.info(`Seeded ${email} on organisation ${organisation.code}`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
