// See docs/twilio-sms-testing.md for Twilio sandbox/test credential usage and magic numbers reference.
// Official docs: https://www.twilio.com/docs/iam/test-credentials

import cron from 'node-cron';
import { prisma } from './prisma';
import { sendEmailAlert, sendSmsAlert } from './notifications';
import { getNotificationProviderConfig } from './notification-settings';

let cronStarted = false;

/**
 * Escalation tiers. Each tier describes the current alertLevel that must be
 * matched, the minimum check-in age in hours before this alert fires, and the
 * email/SMS messaging to use.
 */
const ESCALATION_TIERS = [
  {
    currentLevel: 0,
    hoursThreshold: 2,
    emailSubject: 'Driver Check-In Alert',
    buildMessage: (name: string, location: string, minutes: number) =>
      `ALERT: Driver ${name} has been checked in at ${location} for ${minutes} minutes without checking out.`,
  },
  {
    currentLevel: 1,
    hoursThreshold: 4,
    emailSubject: 'Escalation: Driver Still Checked In',
    buildMessage: (name: string, location: string, minutes: number) =>
      `ESCALATION: Driver ${name} is still checked in at ${location} — now ${minutes} minutes. Please follow up immediately.`,
  },
  {
    currentLevel: 2,
    hoursThreshold: 8,
    emailSubject: 'URGENT: Driver Not Checked Out',
    buildMessage: (name: string, location: string, minutes: number) =>
      `URGENT: Driver ${name} has been checked in at ${location} for ${minutes} minutes with no response. Immediate action required.`,
  },
] as const;

/**
 * Extended stay escalation tiers – 3x the normal thresholds.
 * A driver who declared extended stay gets more time before alerts fire.
 */
const EXTENDED_ESCALATION_TIERS = ESCALATION_TIERS.map((tier) => ({
  ...tier,
  hoursThreshold: tier.hoursThreshold * 3,
}));

/**
 * Start the background cron job that checks for overdue check-ins.
 * Runs every 15 minutes. Safe to call multiple times (only starts once).
 */
export function startCronJob(): void {
  if (cronStarted) return;
  cronStarted = true;

  console.log('[Cron] Starting check-in alert cron job...');

  // Run every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    console.log('[Cron] Checking for overdue check-ins...');

    try {
      const providerConfig = await getNotificationProviderConfig();

      // Fetch all admins and superusers once per run
      const recipients = await prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'SUPERUSER'] }, isActive: true },
        select: { adminEmail: true, adminPhone: true },
      });

      // Process each escalation tier in order (lowest to highest)
      // Normal check-ins use standard tiers, extended stays use 3x thresholds
      for (const tier of ESCALATION_TIERS) {
        const threshold = new Date(Date.now() - tier.hoursThreshold * 60 * 60 * 1000);

        const overdueCheckIns = await prisma.checkIn.findMany({
          where: {
            checkOutTime: null,
            checkInTime: { lt: threshold },
            alertLevel: tier.currentLevel,
            isExtendedStay: false,
          },
          include: {
            driver: true,
            location: true,
          },
        });

        if (overdueCheckIns.length === 0) {
          console.log(`[Cron] Tier ${tier.currentLevel}: no check-ins to escalate.`);
        } else {
          console.log(`[Cron] Tier ${tier.currentLevel}: ${overdueCheckIns.length} check-in(s) to escalate.`);
          for (const checkIn of overdueCheckIns) {
            const minutes = Math.floor(
              (Date.now() - checkIn.checkInTime.getTime()) / 1000 / 60
            );
            const message = tier.buildMessage(
              checkIn.driver.name,
              checkIn.location.name,
              minutes
            );

            console.log(`[Cron] ${tier.emailSubject}: ${message}`);

            for (const recipient of recipients) {
              if (recipient.adminEmail) {
                await sendEmailAlert(
                  recipient.adminEmail,
                  tier.emailSubject,
                  message,
                  providerConfig
                );
              }
              if (recipient.adminPhone) {
                await sendSmsAlert(recipient.adminPhone, message, providerConfig);
              }
            }

            // Advance the alert level for this check-in
            await prisma.checkIn.update({
              where: { id: checkIn.id },
              data: { alertLevel: tier.currentLevel + 1 },
            });
          }
        }
      }

      // Extended stay check-ins use 3x thresholds
      for (const tier of EXTENDED_ESCALATION_TIERS) {
        const threshold = new Date(Date.now() - tier.hoursThreshold * 60 * 60 * 1000);

        const overdueCheckIns = await prisma.checkIn.findMany({
          where: {
            checkOutTime: null,
            checkInTime: { lt: threshold },
            alertLevel: tier.currentLevel,
            isExtendedStay: true,
          },
          include: {
            driver: true,
            location: true,
          },
        });

        if (overdueCheckIns.length === 0) {
          console.log(`[Cron] Extended Tier ${tier.currentLevel}: no check-ins to escalate.`);
        } else {
          console.log(`[Cron] Extended Tier ${tier.currentLevel}: ${overdueCheckIns.length} check-in(s) to escalate.`);
          for (const checkIn of overdueCheckIns) {
            const minutes = Math.floor(
              (Date.now() - checkIn.checkInTime.getTime()) / 1000 / 60
            );
            const message = tier.buildMessage(
              checkIn.driver.name,
              checkIn.location.name,
              minutes
            );

            console.log(`[Cron] ${tier.emailSubject}: ${message}`);

            for (const recipient of recipients) {
              if (recipient.adminEmail) {
                await sendEmailAlert(
                  recipient.adminEmail,
                  tier.emailSubject,
                  message,
                  providerConfig
                );
              }
              if (recipient.adminPhone) {
                await sendSmsAlert(recipient.adminPhone, message, providerConfig);
              }
            }

            // Advance the alert level for this check-in
            await prisma.checkIn.update({
              where: { id: checkIn.id },
              data: { alertLevel: tier.currentLevel + 1 },
            });
          }
        }
      }
    } catch (err) {
      console.error('[Cron] Error during check-in scan:', err);
    }
  });

  console.log('[Cron] Cron job scheduled (every 15 minutes).');
}
