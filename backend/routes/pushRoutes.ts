import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticateJWT } from '../middleware/authMiddleware';
import { sendPushAlert } from '../lib/notifications';

const router = Router();

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

router.get('/public-key', (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null });
});

router.use(authenticateJWT);

router.get('/subscriptions/current', async (req, res) => {
  const userId = req.session.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { endpoint: true },
  });

  res.json({ count: subscriptions.length });
});

router.post('/subscriptions', async (req, res) => {
  const userId = req.session.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const parsed = subscriptionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const subscription = await prisma.pushSubscription.upsert({
    where: { endpoint: parsed.data.endpoint },
    create: {
      userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent: req.get('user-agent') ?? null,
    },
    update: {
      userId,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent: req.get('user-agent') ?? null,
    },
  });

  res.status(201).json({ id: subscription.id });
});

router.delete('/subscriptions', async (req, res) => {
  const userId = req.session.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const parsed = z.object({ endpoint: z.string().url() }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  await prisma.pushSubscription.deleteMany({
    where: { userId, endpoint: parsed.data.endpoint },
  });

  res.json({ ok: true });
});

router.post('/test', async (req, res) => {
  const userId = req.session.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { endpoint: true, p256dh: true, auth: true },
  });

  let sent = 0;
  for (const subscription of subscriptions) {
    const keepSubscription = await sendPushAlert(
      subscription,
      'Driver Tracker test notification',
      'Browser push notifications are working.',
      '/admin/dashboard'
    );
    if (keepSubscription) {
      sent += 1;
    } else {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint: subscription.endpoint },
      });
    }
  }

  res.json({ sent });
});

export default router;
