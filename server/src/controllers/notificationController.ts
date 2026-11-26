import { Request, Response } from 'express';
import webpush from 'web-push';
import { prisma } from '../lib/prisma';
import { notificationPrefSchema } from '@velan/shared';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@velan.ai';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      VAPID_EMAIL.startsWith('mailto:') ? VAPID_EMAIL : `mailto:${VAPID_EMAIL}`,
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );
  } catch (err) {
    console.warn('VAPID configuration warning:', err);
  }
}

export type PrefField =
  | 'attendanceAlerts'
  | 'chatAlerts'
  | 'assignmentAlerts'
  | 'materialAlerts'
  | 'timetableAlerts'
  | 'thresholdAlert';

export const notifyUsers = async (
  io: any,
  userIds: string[],
  payload: { title: string; message: string; type?: string; link?: string; force?: boolean },
  prefField?: PrefField
) => {
  if (!userIds || userIds.length === 0) return;

  try {
    const uniqueIds = Array.from(new Set(userIds));
    let targetIds = uniqueIds;

    if (prefField && !payload.force) {
      const prefs = await prisma.notificationPref.findMany({
        where: { userId: { in: uniqueIds } },
      });
      const disabledSet = new Set(
        prefs.filter((p) => (p as any)[prefField] === false).map((p) => p.userId)
      );
      targetIds = uniqueIds.filter((id) => !disabledSet.has(id));
    }

    if (targetIds.length === 0) return;

    const notifRows = targetIds.map((userId) => ({
      userId,
      title: payload.title,
      message: payload.message,
      type: payload.type || 'INFO',
      link: payload.link || null,
      isRead: false,
    }));

    await prisma.notification.createMany({ data: notifRows });

    if (io) {
      targetIds.forEach((uid) => {
        io.to(`user_${uid}`).emit('notification:new', {
          title: payload.title,
          message: payload.message,
          type: payload.type || 'INFO',
          link: payload.link || null,
          createdAt: new Date().toISOString(),
        });
      });
    }

    if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
      const subs = await prisma.pushSubscription.findMany({
        where: { userId: { in: targetIds } },
      });

      const pushPayload = JSON.stringify({
        title: payload.title,
        message: payload.message,
        url: payload.link || '/',
      });

      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            pushPayload
          );
        } catch (err: any) {
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          }
        }
      }
    }
  } catch (error) {
    console.error('notifyUsers error:', error);
  }
};

export const getVapidPublicKey = (_req: Request, res: Response) => {
  return res.json({ publicKey: VAPID_PUBLIC_KEY || null });
};

export const subscribePush = async (req: Request, res: Response) => {
  try {
    const { subscription, deviceId } = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'Valid push subscription object is required' });
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        userId: req.user!.id,
        deviceId: deviceId || null,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      create: {
        userId: req.user!.id,
        deviceId: deviceId || null,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });

    return res.json({ message: 'Push subscription saved' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to save push subscription' });
  }
};

export const getMyNotifications = async (req: Request, res: Response) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.notification.count({
        where: { userId: req.user!.id, isRead: false },
      }),
    ]);

    return res.json({ notifications, unreadCount });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

export const markNotificationsRead = async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.body;
    if (notificationId) {
      await prisma.notification.updateMany({
        where: { id: String(notificationId), userId: req.user!.id },
        data: { isRead: true },
      });
    } else {
      await prisma.notification.updateMany({
        where: { userId: req.user!.id, isRead: false },
        data: { isRead: true },
      });
    }
    return res.json({ message: 'Notifications marked as read' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to update notifications' });
  }
};

export const getMyPreferences = async (req: Request, res: Response) => {
  try {
    let pref = await prisma.notificationPref.findUnique({
      where: { userId: req.user!.id },
    });
    if (!pref) {
      pref = await prisma.notificationPref.create({
        data: { userId: req.user!.id },
      });
    }
    return res.json({ preferences: pref });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to load preferences' });
  }
};

export const updateMyPreferences = async (req: Request, res: Response) => {
  try {
    const parse = notificationPrefSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.errors[0].message });
    }

    const pref = await prisma.notificationPref.upsert({
      where: { userId: req.user!.id },
      update: parse.data,
      create: { userId: req.user!.id, ...parse.data },
    });

    return res.json({ message: 'Preferences updated successfully', preferences: pref });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to update preferences' });
  }
};
