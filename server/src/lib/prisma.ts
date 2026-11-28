import { Prisma, PrismaClient } from '@prisma/client';

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

let sanitizedDbUrl = cleanUrl(process.env.DATABASE_URL);
const sanitizedDirectUrl = cleanUrl(process.env.DIRECT_URL);

if (sanitizedDbUrl && sanitizedDbUrl.startsWith('postgres') && !sanitizedDbUrl.includes('connection_limit=')) {
  sanitizedDbUrl += (sanitizedDbUrl.includes('?') ? '&' : '?') + 'connection_limit=5';
}

if (sanitizedDbUrl) {
  process.env.DATABASE_URL = sanitizedDbUrl;
}
if (sanitizedDirectUrl) {
  process.env.DIRECT_URL = sanitizedDirectUrl;
}

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
  prismaDirect?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: sanitizedDbUrl ? { db: { url: sanitizedDbUrl } } : undefined,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

// Dedicated direct connection (port 5432 / non-pooler) for interactive $transaction calls
export const prismaDirect =
  globalForPrisma.prismaDirect ||
  (sanitizedDirectUrl && sanitizedDirectUrl !== sanitizedDbUrl
    ? new PrismaClient({
        datasources: { db: { url: sanitizedDirectUrl } },
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      })
    : prisma);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaDirect = prismaDirect;
}

export const TX_OPTIONS = { maxWait: 10000, timeout: 30000 } as const;

export function runTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prismaDirect.$transaction(fn, TX_OPTIONS);
}
