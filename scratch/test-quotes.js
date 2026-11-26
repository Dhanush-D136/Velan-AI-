const { PrismaClient } = require('@prisma/client');
try {
  const p = new PrismaClient({ datasources: { db: { url: '"postgresql://postgres:password@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"' } } });
  p.user.findFirst().catch(e => console.log('CAUGHT PRISMA ERROR:\n', e.message));
} catch(e) {
  console.log('SYNC ERROR:', e.message);
}
