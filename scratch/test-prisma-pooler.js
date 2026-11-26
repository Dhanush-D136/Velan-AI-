const { PrismaClient } = require('@prisma/client');

async function test(port, pgbouncer) {
  const url = `postgresql://postgres.sgtxkosdgwnfjigioeon:Vel%40veleliteminds@aws-0-ap-southeast-1.pooler.supabase.com:${port}/postgres?sslmode=require${pgbouncer ? '&pgbouncer=true' : ''}`;
  console.log('Testing url on port:', port, 'pgbouncer:', pgbouncer);
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const user = await prisma.user.findFirst();
    console.log('SUCCESS! User found:', user?.name, user?.username, user?.role);
    await prisma.$disconnect();
    return true;
  } catch (err) {
    console.log('FAILED on port ' + port + ' pgbouncer ' + pgbouncer + ':', err.message);
    await prisma.$disconnect().catch(() => {});
    return false;
  }
}

async function run() {
  await test(5432, false);
  await test(6543, true);
}

run();
