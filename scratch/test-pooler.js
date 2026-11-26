const { PrismaClient } = require('@prisma/client');

async function testRegion(region) {
  const host = 'aws-0-' + region + '.pooler.supabase.com';
  for (const port of [6543, 5432]) {
    const url = 'postgresql://postgres.sgtxkosdgwnfjigioeon:Vel%40veleliteminds@' + host + ':' + port + '/postgres?sslmode=require';
    const prisma = new PrismaClient({
      datasources: { db: { url } }
    });
    try {
      const res = await prisma.$queryRaw`SELECT 1 as connected`;
      console.log('>>> SUCCESS! Region: ' + region + ' Port: ' + port, res);
      await prisma.$disconnect();
      return true;
    } catch (err) {
      console.log('Region ' + region + ' Port ' + port + ' failed: ' + err.message);
      await prisma.$disconnect().catch(() => {});
    }
  }
  return false;
}

async function run() {
  const regions = [
    'ap-south-1',
    'ap-southeast-1',
    'us-east-1',
    'us-west-1',
    'eu-central-1',
    'eu-west-1',
    'eu-west-2',
    'ap-northeast-1',
    'ap-northeast-2',
    'sa-east-1',
    'ca-central-1'
  ];
  for (const r of regions) {
    const ok = await testRegion(r);
    if (ok) return;
  }
}

run();
