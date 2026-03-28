import cron from 'node-cron';
import { prisma } from './prisma';
import { sendEmailAlert, sendSmsAlert } from './notifications';

let cronStarted = false;

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
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    try {
      // Find open check-ins older than 2 hours that haven't been alerted
      const overdueCheckIns = await prisma.checkIn.findMany({
        where: {
          checkOutTime: null,
          checkInTime: { lt: twoHoursAgo },
          alertSent: false,
        },
        include: {
          driver: true,
          location: true,
        },
      });

      if (overdueCheckIns.length === 0) {
        console.log('[Cron] No overdue check-ins found.');
        return;
      }

      // Fetch all admins for notifications
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN' },
      });

      for (const checkIn of overdueCheckIns) {
        const duration = Math.floor(
          (Date.now() - checkIn.checkInTime.getTime()) / 1000 / 60
        );
        const message =
          `ALERT: Driver ${checkIn.driver.name} has been checked in at ` +
          `${checkIn.location.name} for ${duration} minutes without checking out.`;

        console.log(`[Cron] Overdue check-in: ${message}`);

        // Notify all admins
        for (const admin of admins) {
          if (admin.adminEmail) {
            await sendEmailAlert(
              admin.adminEmail,
              'Driver Check-In Alert',
              message
            );
          }
          if (admin.adminPhone) {
            await sendSmsAlert(admin.adminPhone, message);
          }
        }

        // Mark alert as sent
        await prisma.checkIn.update({
          where: { id: checkIn.id },
          data: { alertSent: true },
        });
      }
    } catch (err) {
      console.error('[Cron] Error during check-in scan:', err);
    }
  });

  console.log('[Cron] Cron job scheduled (every 15 minutes).');
}
