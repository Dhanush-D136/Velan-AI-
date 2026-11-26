import dotenv from 'dotenv';
dotenv.config();

import { rushQueueService } from '../services/rushQueueService';
import { prisma } from '../lib/prisma';

async function runLoadSimulation() {
  console.log('🚀 Starting 300-student Rush-Hour Check-In Queue Simulation...');
  await rushQueueService.updateConfig({ enabled: true, triggerThreshold: 30, maxPerSecond: 100 });

  const totalStudents = 300;
  const start = Date.now();
  const waitTimes: number[] = [];

  // Simulate 300 concurrent valid check-ins hitting the queue at once
  const sampleSessionId = `load_sim_${Date.now()}`;
  const tickets = await Promise.all(
    Array.from({ length: totalStudents }).map(async (_, idx) => {
      const t0 = Date.now();
      // Test in-memory fast-path + ticket queuing (no fake records left in AttendanceRecord)
      const { shouldQueue } = rushQueueService.recordArrivalAndCheckShouldQueue();
      waitTimes.push(Date.now() - t0);
      return { idx, shouldQueue };
    })
  );

  const queuedCount = tickets.filter((t) => t.shouldQueue).length;
  const elapsedMs = Date.now() - start;
  const sorted = [...waitTimes].sort((a, b) => a - b);
  const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)] || 0;

  console.log(`✅ Simulated ${totalStudents} concurrent arrivals in ${elapsedMs}ms`);
  console.log(`   Trigger Threshold (30) crossed: ${queuedCount}/${totalStudents} routed to waiting queue`);
  console.log(`   Fast-path p95 admission latency: ${p95}ms`);
  console.log(`   Throughput capability: ${Math.round((totalStudents / Math.max(1, elapsedMs)) * 1000)} req/s`);

  await rushQueueService.updateConfig({ enabled: false, triggerThreshold: 30, maxPerSecond: 25 });
  await prisma.$disconnect();
  console.log(`Session tag ${sampleSessionId} complete.`);
}

runLoadSimulation().catch((err) => {
  console.error('Load simulation failed:', err);
  process.exit(1);
});
