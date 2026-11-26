import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { rushQueueService } from '../services/rushQueueService';

export const getRushQueueConfig = async (_req: Request, res: Response) => {
  try {
    const config = await rushQueueService.loadConfigFromDB();
    return res.json({ config, stats: rushQueueService.getStats() });
  } catch {
    return res.status(500).json({ error: 'Failed to load rush-hour queue config' });
  }
};

export const updateRushQueueConfig = async (req: Request, res: Response) => {
  try {
    const config = await rushQueueService.updateConfig(req.body, req.user?.id);
    return res.json({ message: 'Rush-hour queue settings updated', config, stats: rushQueueService.getStats() });
  } catch {
    return res.status(500).json({ error: 'Failed to update rush-hour queue settings' });
  }
};

export const getRushQueueStats = async (_req: Request, res: Response) => {
  try {
    return res.json(rushQueueService.getStats());
  } catch {
    return res.status(500).json({ error: 'Failed to fetch queue stats' });
  }
};

export const getCheckinTicket = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ticket = await prisma.checkinTicket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: 'Check-in ticket not found' });
    if (req.user?.role === 'STUDENT' && ticket.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const mem = rushQueueService.getExistingTicket(ticket.sessionId, ticket.studentId);
    const stats = rushQueueService.getStats();

    return res.json({
      ticket: {
        ...ticket,
        position: mem ? stats.queueLength : ticket.position,
        totalInQueue: stats.queueLength,
      },
    });
  } catch {
    return res.status(500).json({ error: 'Failed to load ticket status' });
  }
};
