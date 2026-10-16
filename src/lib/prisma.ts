import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new PrismaClient({ adapter } as any);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalForPrisma = globalThis as unknown as { prisma?: any; prismaClass?: unknown };

// Dev'da klient globalThis'da saqlanadi — HMR har safar yangi ulanishlar ochmasin. Lekin sxema o'zgarib
// klient qayta yaratilsa (`prisma generate`), modul yangi PrismaClient klassi bilan qayta yuklanadi:
// eski nusxada yangi modellar yo'q ("Cannot read properties of undefined (reading 'findMany')"),
// shuning uchun klass o'zgargan bo'lsa eski klient yopilib, yangisi yaratiladi
function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma && globalForPrisma.prismaClass === PrismaClient) return globalForPrisma.prisma;
  void globalForPrisma.prisma?.$disconnect?.().catch(() => {});
  const client = createPrismaClient();
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client;
    globalForPrisma.prismaClass = PrismaClient;
  }
  return client;
}

export const prisma: PrismaClient = getPrismaClient();
