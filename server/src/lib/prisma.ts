import { PrismaClient } from '@prisma/client';

// Sanitize database URLs: strip surrounding quotes and whitespace if pasted with quotes
const cleanUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  let cleaned = url.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
};

const sanitizedDbUrl = cleanUrl(process.env.DATABASE_URL);
const sanitizedDirectUrl = cleanUrl(process.env.DIRECT_URL);

if (sanitizedDbUrl) {
  process.env.DATABASE_URL = sanitizedDbUrl;
}
if (sanitizedDirectUrl) {
  process.env.DIRECT_URL = sanitizedDirectUrl;
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: sanitizedDbUrl ? { db: { url: sanitizedDbUrl } } : undefined,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
