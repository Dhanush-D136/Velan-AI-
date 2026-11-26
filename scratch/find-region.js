const { PrismaClient } = require('@prisma/client');

const regions = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'ca-central-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-central-1',
  'eu-central-2',
  'eu-north-1',
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ap-northeast-2',
  'sa-east-1'
];

async function checkRegion(region) {
  // Test port 6543 (transaction) and port 5432 (session)
  for (const port of [6543, 5432]) {
    const url = `postgresql://postgres.sgtxkosdgwnfjigioeon:Vel%40veleliteminds@aws-0-${region}.pooler.supabase.com:${port}/postgres?sslmode=require&connect_timeout=5`;
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
      const res = await prisma.$queryRaw`SELECT 1 as ok`;
      console.log(`\n🎉 MATCH FOUND! Region: ${region}, Port: ${port}`);
      console.log('WORKING URL:', url);
      await prisma.$disconnect();
      return true;
    } catch (err) {
      if (err.message.includes('tenant/user') && err.message.includes('not found')) {
        // Not this region
      } else if (err.message.includes('password authentication failed')) {
        console.log(`\n🔑 REGION MATCH (Wrong Password): ${region}, Port: ${port}`);
        await prisma.$disconnect();
        return true;
      } else {
        console.log(`Region ${region}:${port} -> ${err.message.substring(0, 80)}`);
      }
      await prisma.$disconnect().catch(() => {});
    }
  }
  return false;
}

async function run() {
  console.log('Scanning all Supabase pooler regions in parallel...');
  await Promise.all(regions.map(r => checkRegion(r)));
  console.log('Scan completed.');
}

run();
