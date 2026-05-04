import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { MAX_SMS_ACTIONS_PER_DAY } from '../lib/sms-failsafe';

const router = Router();

// Helper: parse SMS body for command and location code
function parseSmsBody(body: string) {
  // Example: "CHECKIN 1234" or "CHECKOUT 5678"
  const match = body.trim().match(/^(CHECKIN|CHECKOUT)\s+(\w+)/i);
  if (!match) return null;
  return { command: match[1].toUpperCase(), locationCode: match[2] };
}

// POST /api/webhooks/twilio/inbound-sms - Handle inbound SMS from Twilio
router.post('/webhooks/twilio/inbound-sms', async (req, res) => {
  try {
    const formData = req.body;
    const from = formData.From; // E.164
    const body = formData.Body;

    if (!from || !body) {
      return res.status(400).send('<Response><Message>Missing required parameters</Message></Response>');
    }

    // Failsafe: limit number of inbound SMS check-ins/check-outs per driver per day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const smsCount = await prisma.smsAuditLog.count({
      where: {
        recipientPhone: from,
        direction: 'inbound',
        createdAt: { gte: today },
        triggerType: { in: ['inbound-checkin', 'inbound-checkout'] },
      },
    });
    if (smsCount >= MAX_SMS_ACTIONS_PER_DAY) {
      return res.status(200).send('<Response><Message>Daily SMS check-in/out limit reached. Please contact your admin if this is an error.</Message></Response>');
    }

    // Parse command and location
    const parsed = parseSmsBody(body);
    if (!parsed) {
      return res.status(200).send('<Response><Message>Invalid format. Use CHECKIN <location_code> or CHECKOUT <location_code>.</Message></Response>');
    }

    // Find driver by phone
    const driver = await prisma.user.findFirst({ where: { driverPhone: from, isActive: true } });
    if (!driver) {
      return res.status(200).send('<Response><Message>Phone not recognized. Contact your admin.</Message></Response>');
    }

    // Find location by code (location id in our schema)
    const location = await prisma.location.findFirst({ where: { id: parsed.locationCode } });
    if (!location) {
      return res.status(200).send('<Response><Message>Location code not found. Contact your admin.</Message></Response>');
    }

    // Record check-in or check-out
    let message = '';
    if (parsed.command === 'CHECKIN') {
      await prisma.checkIn.create({
        data: {
          driverId: driver.id,
          locationId: location.id,
          checkInTime: new Date(),
        },
      });
      message = `Check-in recorded at ${location.name}.`;
    } else if (parsed.command === 'CHECKOUT') {
      const openCheckIn = await prisma.checkIn.findFirst({
        where: {
          driverId: driver.id,
          locationId: location.id,
          checkOutTime: null,
        },
        orderBy: { checkInTime: 'desc' },
      });
      if (openCheckIn) {
        await prisma.checkIn.update({
          where: { id: openCheckIn.id },
          data: { checkOutTime: new Date() },
        });
        message = `Check-out recorded at ${location.name}.`;
      } else {
        message = 'No open check-in found for this location.';
      }
    }

    // Log inbound SMS
    await prisma.smsAuditLog.create({
      data: {
        recipientPhone: from,
        messageBody: body,
        triggerType: parsed.command === 'CHECKIN' ? 'inbound-checkin' : 'inbound-checkout',
        direction: 'inbound',
      },
    });

    return res.status(200).send(`<Response><Message>${message}</Message></Response>`);
  } catch (error) {
    console.error('Inbound SMS webhook error:', error);
    return res.status(200).send('<Response><Message>Internal server error. Please try again later.</Message></Response>');
  }
});

// POST /api/webhooks/twilio/sms-status - Handle SMS status callbacks from Twilio
router.post('/webhooks/twilio/sms-status', async (req, res) => {
  try {
    const formData = req.body;
    const { MessageSid, MessageStatus, To, From } = formData;

    // Update SMS audit log with status
    if (MessageSid) {
      await prisma.smsAuditLog.updateMany({
        where: { twilioSid: MessageSid },
        data: { twilioStatus: MessageStatus },
      });
    }

    // Twilio expects a 200 OK response
    res.status(200).send('OK');
  } catch (error) {
    console.error('SMS status webhook error:', error);
    res.status(200).send('OK'); // Still return 200 to avoid Twilio retries
  }
});

export default router;