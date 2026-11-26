const { PrismaClient } = require('@prisma/client');

const rawQuoted = '"postgresql://postgres.sgtxkosdgwnfjigioeon:Vel%40veleliteminds@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require"';

function clean(url) {
  let cleaned = url.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

const cleaned = clean(rawQuoted);
console.log('Original starts with:', rawQuoted[0], 'Cleaned starts with:', cleaned[0]);

const prisma = new PrismaClient({
  datasources: { db: { url: cleaned } }
});

prisma.user.findFirst().then(u => {
  console.log('SUCCESS! User loaded from cleaned URL:', u.name);
  prisma.$disconnect();
}).catch(e => {
  console.error('FAILED:', e.message);
  prisma.$disconnect();
});
