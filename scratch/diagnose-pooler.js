const { PrismaClient } = require('@prisma/client');

async function testUrl(url, label) {
  console.log(`\n--- Testing ${label} ---`);
  console.log('URL:', url.replace(/:[^:]+@/, ':***@'));
  const prisma = new PrismaClient({
    datasources: { db: { url } },
    log: ['error', 'warn']
  });
  try {
    const result = await prisma.$queryRaw`SELECT 1 as connected`;
    console.log(`SUCCESS [${label}]:`, result);
    await prisma.$disconnect();
    return true;
  } catch (err) {
    console.log(`FAILED [${label}]:`, err.message);
    await prisma.$disconnect().catch(() => {});
    return false;
  }
}

async function run() {
  // Let's test various host formats
  const candidates = [
    {
      label: 'Pooler Session Mode (5432) - ap-southeast-1',
      url: 'postgresql://postgres.sgtxkosdgwnfjigioeon:Vel%40veleliteminds@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
    },
    {
      label: 'Pooler Transaction Mode (6543) with pgbouncer=true - ap-southeast-1',
      url: 'postgresql://postgres.sgtxkosdgwnfjigioeon:Vel%40veleliteminds@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true'
    },
    {
      label: 'Pooler Transaction Mode (6543) without pgbouncer param - ap-southeast-1',
      url: 'postgresql://postgres.sgtxkosdgwnfjigioeon:Vel%40veleliteminds@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require'
    },
    {
      label: 'Pooler Session Mode (5432) - ap-south-1',
      url: 'postgresql://postgres.sgtxkosdgwnfjigioeon:Vel%40veleliteminds@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require'
    },
    {
      label: 'Pooler Transaction Mode (6543) with pgbouncer=true - ap-south-1',
      url: 'postgresql://postgres.sgtxkosdgwnfjigioeon:Vel%40veleliteminds@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true'
    }
  ];

  for (const c of candidates) {
    if (await testUrl(c.url, c.label)) {
      console.log(`\n🎉 WORKING URL FOUND: ${c.label}`);
      break;
    }
  }
}

run();
