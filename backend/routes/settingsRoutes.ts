import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateJWT, requireSuperuser } from '../middleware/authMiddleware';
import { upsertNotificationSettings, getNotificationProviderConfig } from '../lib/notification-settings';
import { z } from 'zod';

const router = Router();

const notificationSettingsSchema = z.object({
  emailTenantId: z.string().nullable().optional(),
  emailClientId: z.string().nullable().optional(),
  emailClientSecret: z.string().nullable().optional(),
  emailFrom: z.string().nullable().optional(),
  twilioAccountSid: z.string().nullable().optional(),
  twilioAuthToken: z.string().nullable().optional(),
  twilioFromNumber: z.string().nullable().optional(),
  emailAlertsEnabled: z.boolean().optional(),
  smsAlertsEnabled: z.boolean().optional(),
  pushAlertsEnabled: z.boolean().optional(),
});

// GET /api/admin/settings/notifications - Get masked settings
router.get('/notifications', authenticateJWT, requireSuperuser, async (req, res) => {
  try {
    const config = await getNotificationProviderConfig();
    
    // Return masked secrets (never expose actual secrets)
    const maskedConfig = {
      emailTenantId: config.emailTenantId,
      emailClientId: config.emailClientId,
      emailClientSecret: config.emailClientSecret ? '••••••••' : null,
      emailFrom: config.emailFrom,
      twilioAccountSid: config.twilioAccountSid,
      twilioAuthToken: config.twilioAuthToken ? '••••••••' : null,
      twilioFromNumber: config.twilioFromNumber,
      hasEmailClientSecret: Boolean(config.emailClientSecret),
      hasTwilioAuthToken: Boolean(config.twilioAuthToken),
      emailAlertsEnabled: config.emailAlertsEnabled,
      smsAlertsEnabled: config.smsAlertsEnabled,
      pushAlertsEnabled: config.pushAlertsEnabled,
    };
    
    res.json(maskedConfig);
  } catch (error: any) {
    console.error('Get notification settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/settings/notifications - Update settings with encryption
router.put('/notifications', authenticateJWT, requireSuperuser, async (req, res) => {
  try {
    const userId = (req as any).session.user.id;
    const parsed = notificationSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    
    const settings = await upsertNotificationSettings(parsed.data, userId);
    
    // Return masked response
    const maskedResponse = {
      id: settings.id,
      emailTenantId: settings.emailTenantId,
      emailClientId: settings.emailClientId,
      emailClientSecretEnc: settings.emailClientSecretEnc ? '••••••••' : null,
      emailFrom: settings.emailFrom,
      twilioAccountSid: settings.twilioAccountSid,
      twilioAuthTokenEnc: settings.twilioAuthTokenEnc ? '••••••••' : null,
      twilioFromNumber: settings.twilioFromNumber,
      emailAlertsEnabled: settings.emailAlertsEnabled,
      smsAlertsEnabled: settings.smsAlertsEnabled,
      pushAlertsEnabled: settings.pushAlertsEnabled,
      updatedById: settings.updatedById,
      updatedBy: settings.updatedBy ? {
        id: settings.updatedBy.id,
        name: settings.updatedBy.name,
        email: settings.updatedBy.email,
      } : null,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
    
    res.json(maskedResponse);
  } catch (error: any) {
    console.error('Update notification settings error:', error);
    if (error.message.includes('SETTINGS_ENCRYPTION_KEY')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
