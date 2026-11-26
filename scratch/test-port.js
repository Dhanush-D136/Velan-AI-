const net = require('net');

const hosts = [
  'aws-0-ap-southeast-1.pooler.supabase.com',
  'aws-1-ap-southeast-1.pooler.supabase.com',
  'aws-0-ap-south-1.pooler.supabase.com',
  'db.sgtxkosdgwnfjigioeon.supabase.co'
];

async function checkPort(host, port) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(3000);
    s.on('connect', () => {
      console.log('CONNECTED:', host, port);
      s.destroy();
      resolve(true);
    });
    s.on('timeout', () => {
      console.log('TIMEOUT:', host, port);
      s.destroy();
      resolve(false);
    });
    s.on('error', (e) => {
      console.log('ERROR:', host, port, e.message);
      s.destroy();
      resolve(false);
    });
    s.connect(port, host);
  });
}

async function run() {
  for (const h of hosts) {
    for (const p of [5432, 6543]) {
      await checkPort(h, p);
    }
  }
}

run();
