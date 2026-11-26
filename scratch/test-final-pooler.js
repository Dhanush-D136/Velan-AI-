const { PrismaClient } = require('@prisma/client');
const url = 'postgresql://postgres.sgtxkosdgwnfjigioeon:Vel%40veleliteminds@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require';
const prisma = new PrismaClient({ datasources: { db: { url } } });

async function test() {
  try {
    const res = await prisma.user.findFirst();
    console.log('SUCCESS! CONNECTED TO SUPABASE VIA POOLER!');
    console.log('User found:', res.name, '| Username:', res.username, '| Role:', res.role);
  } catch (err) {
    console.error('ERROR CONNECTING:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
