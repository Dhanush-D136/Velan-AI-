import { monitorEventLoopDelay } from 'perf_hooks';
import os from 'os';
import { Request, Response, NextFunction } from 'express';
import { Server } from 'socket.io';
import { prisma } from '../lib/prisma';
import { presenceService } from './presenceService';
import { notifyUsers } from '../controllers/notificationController';

export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'STRUGGLING';

export interface HealthThresholds {
  degradedLagP99Ms: number;
  degradedHttpP95Ms: number;
  degraded5xxRate: number;
  degradedMemoryPercent: number;
  degradedCpuPercent: number;
  strugglingLagP99Ms: number;
  strugglingHttpP95Ms: number;
  struggling5xxRate: number;
  strugglingMemoryPercent: number;
  strugglingCpuPercent: number;
}

const DEFAULT_THRESHOLDS: HealthThresholds = {
  degradedLagP99Ms: 100,
  degradedHttpP95Ms: 500,
  degraded5xxRate: 1,
  degradedMemoryPercent: 75,
  degradedCpuPercent: 70,
  strugglingLagP99Ms: 300,
  strugglingHttpP95Ms: 2000,
  struggling5xxRate: 5,
  strugglingMemoryPercent: 90,
  strugglingCpuPercent: 90,
};

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Math.round(sorted[idx] * 100) / 100;
}

class MetricsCollector {
  private histogram = monitorEventLoopDelay({ resolution: 20 });
  private io: Server | null = null;
  private thresholds: HealthThresholds = { ...DEFAULT_THRESHOLDS };

  private lastCpuUsage = process.cpuUsage();
  private lastCpuTime = Date.now();
  private lastCpuPercent = 0;

  // Bounded 24h in-memory samples (every 5s -> up to 17280; keep 2000 for fast ops)
  private timeline: Array<any> = [];

  // Per-window HTTP counters
  private inFlightRequests = 0;
  private httpLatencies: number[] = [];
  private httpTotal = 0;
  private http4xx = 0;
  private http5xx = 0;
  private endpointStats = new Map<string, { count: number; totalMs: number; maxMs: number; errors: number }>();

  // Socket counters
  private socketConnectsMin = 0;
  private socketDisconnectsMin = 0;
  private socketMessagesMin = 0;

  // DB query metrics
  private dbLatencies: number[] = [];
  private dbFailedCount = 0;
  private slowQueries: Array<{ query: string; durationMs: number; at: string }> = [];

  // Attendance check-in metrics
  private checkinDurations: number[] = [];
  private checkinFailures = 0;
  private checkinCountMin = 0;

  // Health state tracking
  private currentStatus: HealthStatus = 'HEALTHY';
  private currentReason = 'All systems operating normally.';
  private degradedSince: number | null = null;
  private strugglingSince: number | null = null;
  private activeIncidentId: string | null = null;

  private sampleTimer: NodeJS.Timeout | null = null;
  private minuteTimer: NodeJS.Timeout | null = null;

  start(io?: Server) {
    if (io) this.io = io;
    if (this.sampleTimer) return;
    try {
      this.histogram.enable();
    } catch {
      // already enabled
    }

    this.sampleTimer = setInterval(() => {
      this.collect5sSample();
    }, 5000);
    if (this.sampleTimer.unref) this.sampleTimer.unref();

    this.minuteTimer = setInterval(() => {
      void this.flushMinuteAggregate();
    }, 60000);
    if (this.minuteTimer.unref) this.minuteTimer.unref();
  }

  setIO(io: Server) {
    this.io = io;
  }

  getThresholds() {
    return { ...this.thresholds };
  }

  updateThresholds(partial: Partial<HealthThresholds>) {
    this.thresholds = { ...this.thresholds, ...partial };
  }

  httpMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const path = req.path || '';
      const isExcluded =
        path.startsWith('/socket.io') ||
        path === '/health' ||
        path === '/api/health' ||
        path.startsWith('/api/admin/monitor') ||
        path.startsWith('/api/admin/health') ||
        /\.(js|css|png|jpg|jpeg|svg|ico|woff2?|map)$/i.test(path);

      if (isExcluded) {
        return next();
      }

      const start = process.hrtime.bigint();
      this.inFlightRequests++;
      let finished = false;

      const onDone = () => {
        if (finished) return;
        finished = true;
        this.inFlightRequests = Math.max(0, this.inFlightRequests - 1);
        const ms = Number(process.hrtime.bigint() - start) / 1e6;
        this.recordHttpRequest(`${req.method} ${req.route?.path || path}`, res.statusCode, ms);
      };

      res.on('finish', onDone);
      res.on('close', onDone);
      next();
    };
  }

  private httpSamples: { ts: number; ms: number; status: number }[] = [];
  private endpointDurations = new Map<string, number[]>();

  private pruneWindow(now = Date.now()) {
    const cutoff = now - 5 * 60 * 1000;
    while (this.httpSamples.length > 0 && this.httpSamples[0].ts < cutoff) {
      this.httpSamples.shift();
    }
  }

  recordHttpRequest(endpoint: string, statusCode: number, durationMs: number) {
    const now = Date.now();
    this.httpTotal++;
    if (statusCode >= 400 && statusCode < 500) this.http4xx++;
    if (statusCode >= 500) this.http5xx++;

    this.httpSamples.push({ ts: now, ms: durationMs, status: statusCode });
    this.pruneWindow(now);

    this.httpLatencies.push(durationMs);
    if (this.httpLatencies.length > 2000) this.httpLatencies.shift();

    const prev = this.endpointStats.get(endpoint) || { count: 0, totalMs: 0, maxMs: 0, errors: 0 };
    prev.count++;
    prev.totalMs += durationMs;
    if (durationMs > prev.maxMs) prev.maxMs = durationMs;
    if (statusCode >= 500) prev.errors++;
    this.endpointStats.set(endpoint, prev);

    const durs = this.endpointDurations.get(endpoint) || [];
    durs.push(durationMs);
    if (durs.length > 200) durs.shift();
    this.endpointDurations.set(endpoint, durs);
  }

  recordSocketConnect() {
    this.socketConnectsMin++;
  }
  recordSocketDisconnect() {
    this.socketDisconnectsMin++;
  }
  recordSocketMessage() {
    this.socketMessagesMin++;
  }

  recordDbQuery(query: string, durationMs: number, failed = false) {
    this.dbLatencies.push(durationMs);
    if (this.dbLatencies.length > 1000) this.dbLatencies.shift();
    if (failed) this.dbFailedCount++;
    if (durationMs > 300) {
      this.slowQueries.unshift({ query: query.slice(0, 120), durationMs: Math.round(durationMs), at: new Date().toISOString() });
      if (this.slowQueries.length > 30) this.slowQueries.pop();
    }
  }

  recordCheckin(durationMs: number, success: boolean) {
    this.checkinCountMin++;
    this.checkinDurations.push(durationMs);
    if (this.checkinDurations.length > 500) this.checkinDurations.shift();
    if (!success) this.checkinFailures++;
  }

  /**
   * Evaluates health rules immediately (used by 5s sampler and unit tests).
   */
  evaluateHealth(metrics: {
    lagP99Ms: number;
    httpP95Ms: number;
    error5xxRate: number;
    memoryPercent: number;
    cpuPercent: number;
    sampleCount?: number;
    nowMs?: number;
    bypassDuration?: boolean;
  }): { status: HealthStatus; reason: string } {
    const now = metrics.nowMs ?? Date.now();
    const th = this.thresholds;
    const hasEnoughTraffic = metrics.sampleCount === undefined || metrics.sampleCount >= 30;

    const strugglingReasons: string[] = [];
    if (metrics.lagP99Ms > th.strugglingLagP99Ms) strugglingReasons.push(`event-loop lag ${Math.round(metrics.lagP99Ms)}ms`);
    if (hasEnoughTraffic && metrics.httpP95Ms > th.strugglingHttpP95Ms) strugglingReasons.push(`response time p95 ${(metrics.httpP95Ms / 1000).toFixed(2)}s`);
    if (hasEnoughTraffic && metrics.error5xxRate > th.struggling5xxRate) strugglingReasons.push(`5xx error rate ${metrics.error5xxRate.toFixed(1)}%`);
    if (metrics.memoryPercent > th.strugglingMemoryPercent) strugglingReasons.push(`memory usage ${metrics.memoryPercent.toFixed(1)}%`);
    if (metrics.cpuPercent > th.strugglingCpuPercent) strugglingReasons.push(`CPU usage ${metrics.cpuPercent.toFixed(1)}%`);

    const degradedReasons: string[] = [];
    if (metrics.lagP99Ms > th.degradedLagP99Ms) degradedReasons.push(`event-loop lag ${Math.round(metrics.lagP99Ms)}ms`);
    if (hasEnoughTraffic && metrics.httpP95Ms > th.degradedHttpP95Ms) degradedReasons.push(`response time p95 ${Math.round(metrics.httpP95Ms)}ms`);
    if (hasEnoughTraffic && metrics.error5xxRate > th.degraded5xxRate) degradedReasons.push(`5xx error rate ${metrics.error5xxRate.toFixed(1)}%`);
    if (metrics.memoryPercent > th.degradedMemoryPercent) degradedReasons.push(`memory usage ${metrics.memoryPercent.toFixed(1)}%`);
    if (metrics.cpuPercent > th.degradedCpuPercent) degradedReasons.push(`CPU usage ${metrics.cpuPercent.toFixed(1)}%`);

    let nextStatus: HealthStatus = 'HEALTHY';
    let nextReason = hasEnoughTraffic
      ? 'All systems operating normally.'
      : 'Not enough traffic to judge, server looks fine.';

    if (strugglingReasons.length > 0) {
      if (!this.strugglingSince) this.strugglingSince = now;
      if (!this.degradedSince) this.degradedSince = now;
      if (metrics.bypassDuration || now - this.strugglingSince >= 60_000) {
        nextStatus = 'STRUGGLING';
        nextReason = `Struggling: ${strugglingReasons.join(', ')}${this.checkinCountMin > 10 ? ` while ${this.checkinCountMin} check-ins/min are active` : ''}.`;
      } else if (now - this.degradedSince >= 120_000) {
        nextStatus = 'DEGRADED';
        nextReason = `Degraded: ${degradedReasons.join(', ')}.`;
      }
    } else if (degradedReasons.length > 0) {
      this.strugglingSince = null;
      if (!this.degradedSince) this.degradedSince = now;
      if (metrics.bypassDuration || now - this.degradedSince >= 120_000) {
        nextStatus = 'DEGRADED';
        nextReason = `Degraded: ${degradedReasons.join(', ')}.`;
      }
    } else {
      this.strugglingSince = null;
      this.degradedSince = null;
      nextStatus = 'HEALTHY';
      nextReason = 'All systems operating normally.';
    }

    if (nextStatus !== this.currentStatus) {
      void this.handleStatusTransition(nextStatus, nextReason, metrics);
    }

    this.currentStatus = nextStatus;
    this.currentReason = nextReason;
    return { status: nextStatus, reason: nextReason };
  }

  private async handleStatusTransition(
    nextStatus: HealthStatus,
    reason: string,
    metrics: { lagP99Ms: number; httpP95Ms: number; error5xxRate: number; memoryPercent: number; cpuPercent: number }
  ) {
    try {
      if (nextStatus === 'HEALTHY' && this.activeIncidentId) {
        await prisma.serverIncident.update({
          where: { id: this.activeIncidentId },
          data: { endedAt: new Date() },
        });
        this.activeIncidentId = null;
      } else if (nextStatus === 'DEGRADED' || nextStatus === 'STRUGGLING') {
        const inc = await prisma.serverIncident.create({
          data: {
            status: nextStatus,
            cause: reason,
            peakLagMs: metrics.lagP99Ms,
            peakP95Ms: metrics.httpP95Ms,
            peak5xxRate: metrics.error5xxRate,
            peakCpuPercent: metrics.cpuPercent,
            peakMemoryPercent: metrics.memoryPercent,
          },
        });
        this.activeIncidentId = inc.id;

        if (this.io) {
          this.io.to('admin').emit('admin:health_alert', { status: nextStatus, reason, incident: inc });
        }
        const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
        await notifyUsers(this.io, admins.map((a) => a.id), {
          title: `Server Health: ${nextStatus}`,
          message: reason,
          type: 'HEALTH_ALERT',
          link: '/admin/live-monitor',
        });
      }
    } catch {
      // non-fatal during tests or DB hiccup
    }
  }

  private collect5sSample() {
    const now = Date.now();
    const cpuDiff = process.cpuUsage(this.lastCpuUsage);
    const elapsedMs = Math.max(1, now - this.lastCpuTime);
    this.lastCpuUsage = process.cpuUsage();
    this.lastCpuTime = now;
    const cpuCount = Math.max(1, os.cpus().length);
    this.lastCpuPercent = Math.min(100, Math.round((((cpuDiff.user + cpuDiff.system) / 1000) / (elapsedMs * cpuCount)) * 1000) / 10);

    const mem = process.memoryUsage();
    const totalMem = os.totalmem() || 1;
    const memoryPercent = Math.round((mem.rss / totalMem) * 1000) / 10;
    const lagP99Ms = Math.round((this.histogram.percentile(99) / 1e6) * 100) / 100;
    this.histogram.reset();

    const httpP95Ms = percentile(this.httpLatencies, 95);
    const error5xxRate = this.httpTotal > 0 ? Math.round((this.http5xx / this.httpTotal) * 1000) / 10 : 0;

    const evalRes = this.evaluateHealth({
      lagP99Ms,
      httpP95Ms,
      error5xxRate,
      memoryPercent,
      cpuPercent: this.lastCpuPercent,
      nowMs: now,
    });

    const sample = {
      at: new Date(now).toISOString(),
      cpuPercent: this.lastCpuPercent,
      memoryRssMb: Math.round((mem.rss / 1048576) * 10) / 10,
      memoryHeapMb: Math.round((mem.heapUsed / 1048576) * 10) / 10,
      memoryPercent,
      lagP99Ms,
      httpP95Ms,
      error5xxRate,
      inFlightRequests: this.inFlightRequests,
      status: evalRes.status,
    };

    this.timeline.push(sample);
    if (this.timeline.length > 2000) this.timeline.shift();

    if (this.io) {
      this.io.to('admin').emit('admin:health_update', this.getSnapshot());
    }
  }

  private async flushMinuteAggregate() {
    try {
      const snap = this.getSnapshot();
      const bucket = new Date();
      bucket.setSeconds(0, 0);

      await prisma.serverMetricMinute.upsert({
        where: { bucketStart: bucket },
        update: {
          uptimeSec: snap.process.uptimeSec,
          cpuPercent: snap.process.cpuPercent,
          memoryRssMb: snap.process.memoryRssMb,
          memoryHeapMb: snap.process.memoryHeapMb,
          eventLoopLagP99Ms: snap.process.eventLoopLagP99Ms,
          httpRps: snap.http.rps,
          httpP50Ms: snap.http.p50Ms,
          httpP95Ms: snap.http.p95Ms,
          httpP99Ms: snap.http.p99Ms,
          error4xxRate: snap.http.error4xxRate,
          error5xxRate: snap.http.error5xxRate,
          connectedSockets: snap.realtime.connectedSockets,
          dbAvgMs: snap.database.avgMs,
          dbP95Ms: snap.database.p95Ms,
          concurrentUsers: snap.concurrentUsers,
          healthStatus: snap.status,
        },
        create: {
          bucketStart: bucket,
          uptimeSec: snap.process.uptimeSec,
          cpuPercent: snap.process.cpuPercent,
          memoryRssMb: snap.process.memoryRssMb,
          memoryHeapMb: snap.process.memoryHeapMb,
          eventLoopLagP99Ms: snap.process.eventLoopLagP99Ms,
          httpRps: snap.http.rps,
          httpP50Ms: snap.http.p50Ms,
          httpP95Ms: snap.http.p95Ms,
          httpP99Ms: snap.http.p99Ms,
          error4xxRate: snap.http.error4xxRate,
          error5xxRate: snap.http.error5xxRate,
          connectedSockets: snap.realtime.connectedSockets,
          dbAvgMs: snap.database.avgMs,
          dbP95Ms: snap.database.p95Ms,
          concurrentUsers: snap.concurrentUsers,
          healthStatus: snap.status,
        },
      });

      // Reset per-minute socket & checkin counters
      this.socketConnectsMin = 0;
      this.socketDisconnectsMin = 0;
      this.socketMessagesMin = 0;
      this.checkinCountMin = 0;

      // Retention cleanup (90d auth_events, 30d server metrics)
      const authCutoff = new Date(Date.now() - 90 * 86400000);
      const metricCutoff = new Date(Date.now() - 30 * 86400000);
      await Promise.all([
        prisma.authEvent.deleteMany({ where: { timestamp: { lt: authCutoff } } }).catch(() => {}),
        prisma.serverMetricMinute.deleteMany({ where: { bucketStart: { lt: metricCutoff } } }).catch(() => {}),
      ]);
    } catch {
      // non-fatal
    }
  }

  getSnapshot() {
    const mem = process.memoryUsage();
    const totalHostMem = os.totalmem() || 1;
    const freeHostMem = os.freemem() || 0;
    const lagP99Ms = this.timeline[this.timeline.length - 1]?.lagP99Ms ?? Math.round((this.histogram.percentile(99) / 1e6) * 100) / 100;
    const uptimeSec = Math.round(process.uptime());

    this.pruneWindow();
    const windowLatencies = this.httpSamples.map((s) => s.ms);
    const window5xx = this.httpSamples.filter((s) => s.status >= 500).length;
    const windowError5xxRate =
      this.httpSamples.length > 0 ? Math.round((window5xx / this.httpSamples.length) * 1000) / 10 : 0;

    const httpAvgMs =
      windowLatencies.length > 0
        ? Math.round((windowLatencies.reduce((a, b) => a + b, 0) / windowLatencies.length) * 100) / 100
        : 0;
    const httpP50Ms = percentile(windowLatencies, 50);
    const httpP95Ms = percentile(windowLatencies, 95);
    const httpP99Ms = percentile(windowLatencies, 99);
    const rps = Math.round((this.httpTotal / Math.max(1, uptimeSec)) * 100) / 100;
    const error4xxRate = this.httpTotal > 0 ? Math.round((this.http4xx / this.httpTotal) * 1000) / 10 : 0;
    const error5xxRate = this.httpSamples.length >= 30 ? windowError5xxRate : 0;

    const slowestEndpoints = Array.from(this.endpointStats.entries())
      .map(([endpoint, s]) => ({
        endpoint,
        count: s.count,
        avgMs: Math.round((s.totalMs / s.count) * 100) / 100,
        p95Ms: percentile(this.endpointDurations.get(endpoint) || [s.maxMs], 95),
        maxMs: Math.round(s.maxMs * 100) / 100,
        errors: s.errors,
      }))
      .sort((a, b) => b.p95Ms - a.p95Ms)
      .slice(0, 5);

    const dbAvgMs =
      this.dbLatencies.length > 0
        ? Math.round((this.dbLatencies.reduce((a, b) => a + b, 0) / this.dbLatencies.length) * 100) / 100
        : 0;
    const dbP95Ms = percentile(this.dbLatencies, 95);

    const avgCheckinMs =
      this.checkinDurations.length > 0
        ? Math.round((this.checkinDurations.reduce((a, b) => a + b, 0) / this.checkinDurations.length) * 100) / 100
        : 0;

    const presence = presenceService.getSnapshot();

    return {
      status: this.currentStatus,
      reason: this.currentReason,
      concurrentUsers: presence.totalOnline,
      peakConcurrentToday: presence.peakConcurrentToday,
      capacityInsight:
        this.httpSamples.length < 30
          ? `Peak ${presence.peakConcurrentToday || presence.totalOnline} concurrent user(s) — low traffic (${this.httpSamples.length} requests in 5m)`
          : `Peak ${presence.peakConcurrentToday || presence.totalOnline} concurrent user(s) • 5m p95 response ${httpP95Ms} ms`,
      process: {
        uptimeSec,
        cpuPercent: this.lastCpuPercent,
        memoryRssMb: Math.round((mem.rss / 1048576) * 10) / 10,
        memoryHeapMb: Math.round((mem.heapUsed / 1048576) * 10) / 10,
        memoryHeapLimitMb: Math.round((mem.heapTotal / 1048576) * 10) / 10,
        memoryPercent: Math.round((mem.rss / totalHostMem) * 1000) / 10,
        eventLoopLagP99Ms: lagP99Ms,
      },
      host: {
        totalMemoryMb: Math.round(totalHostMem / 1048576),
        freeMemoryMb: Math.round(freeHostMem / 1048576),
        loadAverage: os.loadavg(),
      },
      http: {
        totalRequests: this.httpTotal,
        rps,
        avgMs: httpAvgMs,
        p50Ms: httpP50Ms,
        p95Ms: httpP95Ms,
        p99Ms: httpP99Ms,
        error4xxRate,
        error5xxRate,
        inFlightRequests: this.inFlightRequests,
        slowestEndpoints,
      },
      realtime: {
        connectedSockets: this.io ? this.io.sockets.sockets.size : 0,
        connectsPerMin: this.socketConnectsMin,
        disconnectsPerMin: this.socketDisconnectsMin,
        messagesPerMin: this.socketMessagesMin,
      },
      database: {
        avgMs: dbAvgMs,
        p95Ms: dbP95Ms,
        failedQueries: this.dbFailedCount,
        slowQueries: this.slowQueries,
      },
      domain: {
        checkinsPerMin: this.checkinCountMin,
        checkinFailures: this.checkinFailures,
        avgCheckinMs,
      },
      thresholds: this.thresholds,
      timeline: this.timeline.slice(-120),
    };
  }
}

export const metricsCollector = new MetricsCollector();
