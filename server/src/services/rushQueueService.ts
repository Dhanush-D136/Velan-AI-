import { Server } from 'socket.io';
import { prisma } from '../lib/prisma';
import { metricsCollector } from './metricsCollector';

export interface ThirukkuralItem {
  id: string;
  number?: string;
  kural: string;
  porul: string;
}

export interface RushQueueConfig {
  enabled: boolean; // DEFAULT OFF
  triggerThreshold: number; // default 30
  maxPerSecond: number; // default 25
  maxWaitSeconds: number; // default 60
  maxQueueLength: number; // default 5000
  showQuotes: boolean; // default true
  showPosition: boolean; // default true
  playSound: boolean; // default false
  quoteIntervalSeconds: number; // default 9s for reading Tamil Kural + Porul
  headline: string;
  subline: string;
  quotes: ThirukkuralItem[];
}

export const DEFAULT_THIRUKKURAL_LIST: ThirukkuralItem[] = [
  {
    id: 'k611',
    number: 'குறள் 611',
    kural: 'அருமை உடைத்தென் றசாவாமை வேண்டும் / பெருமை முயற்சி தரும்.',
    porul: 'செய்வதற்கு அரிய செயல் என்று சோர்வு கொள்ளாமல் முயற்சி செய்தால் அது பெருமையைத் தரும்.',
  },
  {
    id: 'k619',
    number: 'குறள் 619',
    kural: 'தெய்வத்தான் ஆகா தெனினும் முயற்சிதன் / மெய்வருத்தக் கூலி தரும்.',
    porul: 'விதியால் முடியாவிட்டாலும், முயற்சி தன் உடல் உழைப்புக்கு ஏற்ற பலனைத் தவறாமல் தரும்.',
  },
  {
    id: 'k595',
    number: 'குறள் 595',
    kural: 'வெள்ளத் தனைய மலர்நீட்டம் மாந்தர்தம் / உள்ளத் தனைய துயர்வு.',
    porul: 'நீரின் அளவுக்குத் தக்கபடி தாமரை உயரும்; அதுபோல மக்களின் ஊக்கத்தின் அளவுக்குத் தக்கபடி உயர்வு உண்டாகும்.',
  },
  {
    id: 'k620',
    number: 'குறள் 620',
    kural: 'ஊழையும் உப்பக்கம் காண்பர் உலைவின்றித் / தாழாது உஞற்று பவர்.',
    porul: 'சோர்வு இல்லாமல் தொடர்ந்து முயற்சி செய்கிறவர்கள் விதியையும் வென்று வெற்றி காண்பார்கள்.',
  },
  {
    id: 'k483',
    number: 'குறள் 483',
    kural: 'அருவினை யென்ப உளவோ கருவியான் / காலம் அறிந்து செயின்.',
    porul: 'ஏற்ற கருவிகளுடன் தக்க காலத்தை அறிந்து செய்தால் முடியாத செயல் எதுவும் இல்லை.',
  },
];

export const DEFAULT_RUSH_CONFIG: RushQueueConfig = {
  enabled: false,
  triggerThreshold: 30,
  maxPerSecond: 25,
  maxWaitSeconds: 60,
  maxQueueLength: 5000,
  showQuotes: true,
  showPosition: true,
  playSound: false,
  quoteIntervalSeconds: 9,
  headline: 'Please wait, we are verifying your attendance.',
  subline: 'Many students are checking in at the same moment. Your spot is saved, so there is no need to tap again.',
  quotes: DEFAULT_THIRUKKURAL_LIST,
};

interface QueuedTicket {
  ticketId: string;
  sessionId: string;
  studentId: string;
  userId: string;
  studentName: string;
  rollNo: string;
  pressedAt: Date;
  latitude: number;
  longitude: number;
  accuracy: number;
  deviceId: string;
  distanceMeters: number;
  flags: string | null;
  retries: number;
  enqueuedAt: number;
}

class RushQueueService {
  private config: RushQueueConfig = { ...DEFAULT_RUSH_CONFIG };
  private queue: QueuedTicket[] = [];
  private activeTicketMap = new Map<string, QueuedTicket>(); // key: `${sessionId}_${studentId}`
  private arrivalTimestamps: number[] = [];
  private waitSamplesSec: number[] = [];
  private io: Server | null = null;
  private batchTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  private savedCount = 0;
  private rejectedCount = 0;
  private failedCount = 0;
  private peakQueueLength = 0;
  private lastBatchSaved = 0;
  private lastBatchAt = Date.now();

  setIO(io: Server) {
    this.io = io;
  }

  async loadConfigFromDB() {
    try {
      const row = await prisma.setting.findUnique({ where: { key: 'RUSH_HOUR_QUEUE_CONFIG' } });
      if (row?.value) {
        const parsed = JSON.parse(row.value);
        this.config = { ...DEFAULT_RUSH_CONFIG, ...parsed };
      }
    } catch {
      // keep default OFF
    }
    return this.getConfig();
  }

  getConfig(): RushQueueConfig {
    return { ...this.config, quotes: [...this.config.quotes] };
  }

  async updateConfig(partial: Partial<RushQueueConfig>, adminUserId?: string) {
    const prevEnabled = this.config.enabled;
    this.config = {
      ...this.config,
      ...partial,
      triggerThreshold: Math.max(1, Number(partial.triggerThreshold ?? this.config.triggerThreshold)),
      maxPerSecond: Math.max(1, Number(partial.maxPerSecond ?? this.config.maxPerSecond)),
      maxWaitSeconds: Math.max(5, Number(partial.maxWaitSeconds ?? this.config.maxWaitSeconds)),
      maxQueueLength: Math.max(50, Number(partial.maxQueueLength ?? this.config.maxQueueLength)),
      quoteIntervalSeconds: Math.max(4, Number(partial.quoteIntervalSeconds ?? this.config.quoteIntervalSeconds)),
    };

    await prisma.setting.upsert({
      where: { key: 'RUSH_HOUR_QUEUE_CONFIG' },
      update: { value: JSON.stringify(this.config) },
      create: {
        key: 'RUSH_HOUR_QUEUE_CONFIG',
        value: JSON.stringify(this.config),
        description: 'Rush-hour attendance check-in queue configuration',
      },
    });

    if (adminUserId && prevEnabled !== this.config.enabled) {
      await prisma.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'RUSH_QUEUE_TOGGLED',
          details: JSON.stringify({ enabled: this.config.enabled }),
        },
      }).catch(() => {});
    }

    if (this.io) {
      this.io.emit('data:updated', { resource: 'rush_queue_config', config: this.config });
    }
    return this.getConfig();
  }

  startWorker() {
    if (this.batchTimer) return;
    this.batchTimer = setInterval(() => {
      void this.processBatch();
    }, 250);
    if (this.batchTimer.unref) this.batchTimer.unref();
  }

  recordArrivalAndCheckShouldQueue(): { shouldQueue: boolean; arrivalsPerSec: number } {
    const now = Date.now();
    this.arrivalTimestamps.push(now);
    const cutoff = now - 1000;
    while (this.arrivalTimestamps.length > 0 && this.arrivalTimestamps[0] < cutoff) {
      this.arrivalTimestamps.shift();
    }
    const arrivalsPerSec = this.arrivalTimestamps.length;
    const shouldQueue =
      this.config.enabled &&
      (this.queue.length >= this.config.triggerThreshold || arrivalsPerSec > this.config.triggerThreshold);

    return { shouldQueue, arrivalsPerSec };
  }

  isQueueFull() {
    return this.queue.length >= this.config.maxQueueLength;
  }

  getExistingTicket(sessionId: string, studentId: string) {
    return this.activeTicketMap.get(`${sessionId}_${studentId}`);
  }

  async enqueueTicket(input: Omit<QueuedTicket, 'ticketId' | 'retries' | 'enqueuedAt'>) {
    const key = `${input.sessionId}_${input.studentId}`;
    const existingMem = this.activeTicketMap.get(key);
    if (existingMem) {
      const pos = this.queue.findIndex((q) => q.ticketId === existingMem.ticketId);
      const position = pos >= 0 ? pos + 1 : 1;
      const estimatedSeconds = Math.max(1, Math.ceil(position / Math.max(1, this.config.maxPerSecond)));
      return {
        ticketId: existingMem.ticketId,
        position,
        estimatedSeconds,
        state: 'queued',
        totalInQueue: this.queue.length,
        reused: true,
      };
    }

    // Check DB for idempotency (even across restarts)
    const existingDb = await prisma.checkinTicket.findUnique({
      where: { sessionId_studentId: { sessionId: input.sessionId, studentId: input.studentId } },
    });
    if (existingDb) {
      return {
        ticketId: existingDb.id,
        position: existingDb.position,
        estimatedSeconds: existingDb.estimatedSeconds,
        state: existingDb.state,
        totalInQueue: Math.max(1, this.queue.length),
        reused: true,
      };
    }

    const position = this.queue.length + 1;
    const estimatedSeconds = Math.max(1, Math.ceil(position / Math.max(1, this.config.maxPerSecond)));

    const created = await prisma.checkinTicket.create({
      data: {
        sessionId: input.sessionId,
        studentId: input.studentId,
        userId: input.userId,
        state: 'queued',
        position,
        estimatedSeconds,
        pressedAt: input.pressedAt,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy: input.accuracy,
        deviceId: input.deviceId,
        flags: input.flags,
        distanceMeters: input.distanceMeters,
      },
    });

    const item: QueuedTicket = {
      ...input,
      ticketId: created.id,
      retries: 0,
      enqueuedAt: Date.now(),
    };
    this.queue.push(item);
    this.activeTicketMap.set(key, item);
    if (this.queue.length > this.peakQueueLength) {
      this.peakQueueLength = this.queue.length;
    }

    if (this.io) {
      this.io.to(`session_${input.sessionId}`).emit('attendance:verifying', {
        studentId: input.studentId,
        studentName: input.studentName,
        rollNo: input.rollNo,
        status: 'VERIFYING',
      });
    }

    this.startWorker();

    return {
      ticketId: created.id,
      position,
      estimatedSeconds,
      state: 'queued',
      totalInQueue: this.queue.length,
      reused: false,
    };
  }

  getVerifyingStudentIds(sessionId: string): Set<string> {
    const set = new Set<string>();
    for (const item of this.queue) {
      if (item.sessionId === sessionId) set.add(item.studentId);
    }
    return set;
  }

  async processBatch() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    const batchSize = Math.max(1, Math.ceil(this.config.maxPerSecond / 4));
    const batch = this.queue.splice(0, batchSize);

    try {
      // Mark verifying
      for (const item of batch) {
        if (this.io) {
          this.io.to(`user_${item.userId}`).emit('checkin:ticket_update', {
            ticketId: item.ticketId,
            state: 'verifying',
            position: 0,
            estimatedSeconds: 1,
          });
        }
      }

      await prisma.$transaction(async (tx) => {
        for (const item of batch) {
          await tx.attendanceRecord.upsert({
            where: { sessionId_studentId: { sessionId: item.sessionId, studentId: item.studentId } },
            update: {},
            create: {
              sessionId: item.sessionId,
              studentId: item.studentId,
              status: 'PRESENT',
              method: 'GPS',
              distanceMeters: item.distanceMeters,
              accuracy: item.accuracy,
              deviceId: item.deviceId,
              flags: item.flags,
              markedAt: item.pressedAt,
            },
          });

          await tx.checkinTicket.update({
            where: { id: item.ticketId },
            data: { state: 'saved', position: 0, estimatedSeconds: 0 },
          });
        }
      });

      const now = Date.now();
      this.lastBatchSaved = batch.length;
      this.lastBatchAt = now;

      for (const item of batch) {
        this.savedCount++;
        const waitSec = Math.max(0, (now - item.enqueuedAt) / 1000);
        this.waitSamplesSec.push(waitSec);
        if (this.waitSamplesSec.length > 500) this.waitSamplesSec.shift();
        metricsCollector.recordCheckin(waitSec * 1000, true);

        this.activeTicketMap.delete(`${item.sessionId}_${item.studentId}`);

        if (this.io) {
          this.io.to(`user_${item.userId}`).emit('checkin:ticket_update', {
            ticketId: item.ticketId,
            state: 'saved',
            position: 0,
            estimatedSeconds: 0,
            distanceMeters: item.distanceMeters,
            markedAt: item.pressedAt,
          });
          this.io.to(`session_${item.sessionId}`).emit('attendance:marked', {
            studentId: item.studentId,
            studentName: item.studentName,
            rollNo: item.rollNo,
            status: 'PRESENT',
            distanceMeters: item.distanceMeters,
            markedAt: item.pressedAt,
          });
        }
      }

      // Push updated positions to remaining queued students
      if (this.io && this.queue.length > 0) {
        const total = this.queue.length;
        this.queue.forEach((item, idx) => {
          const pos = idx + 1;
          const est = Math.max(1, Math.ceil(pos / Math.max(1, this.config.maxPerSecond)));
          this.io!.to(`user_${item.userId}`).emit('checkin:ticket_update', {
            ticketId: item.ticketId,
            state: 'queued',
            position: pos,
            totalInQueue: total,
            estimatedSeconds: est,
          });
        });
      }
    } catch (err: any) {
      // Retry up to 3 times before marking failed
      for (const item of batch) {
        if (item.retries < 3) {
          item.retries += 1;
          this.queue.unshift(item);
        } else {
          this.failedCount++;
          metricsCollector.recordCheckin(0, false);
          this.activeTicketMap.delete(`${item.sessionId}_${item.studentId}`);
          await prisma.checkinTicket
            .update({
              where: { id: item.ticketId },
              data: { state: 'failed', errorReason: 'Could not save attendance. Please tap again.' },
            })
            .catch(() => {});
          if (this.io) {
            this.io.to(`user_${item.userId}`).emit('checkin:ticket_update', {
              ticketId: item.ticketId,
              state: 'failed',
              errorReason: 'Could not save attendance. Please tap again.',
            });
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  async drainSessionQueue(sessionId: string, maxWaitMs = 60_000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const hasPending = this.queue.some((q) => q.sessionId === sessionId);
      if (!hasPending && !this.isProcessing) break;
      if (!this.isProcessing && hasPending) {
        await this.processBatch();
      } else {
        await new Promise((r) => setTimeout(r, 50));
      }
    }
  }

  recordRejection() {
    this.rejectedCount++;
  }

  getStats() {
    const sorted = [...this.waitSamplesSec].sort((a, b) => a - b);
    const avgWaitSec =
      sorted.length > 0 ? Math.round((sorted.reduce((a, b) => a + b, 0) / sorted.length) * 100) / 100 : 0;
    const p95WaitSec =
      sorted.length > 0
        ? Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)] * 100) / 100
        : 0;
    const now = Date.now();
    const throughputPerSec =
      now - this.lastBatchAt < 5000 ? Math.round((this.lastBatchSaved / 0.25) * 10) / 10 : 0;

    return {
      enabled: this.config.enabled,
      statusText: this.config.enabled
        ? `Queue is ON, ${this.queue.length > 0 ? 'active' : 'idle'}, ${this.queue.length} waiting`
        : 'Queue is OFF',
      queueLength: this.queue.length,
      avgWaitSec,
      p95WaitSec,
      throughputPerSec,
      savedCount: this.savedCount,
      rejectedCount: this.rejectedCount,
      failedCount: this.failedCount,
      peakQueueLength: this.peakQueueLength,
      config: this.getConfig(),
    };
  }
}

export const rushQueueService = new RushQueueService();
