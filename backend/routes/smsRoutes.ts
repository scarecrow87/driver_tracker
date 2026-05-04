import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateJWT, requireAdminOrSuperuser } from '../middleware/authMiddleware';
import { Twilio } from 'twilio';

const router = Router();

// Initialize Twilio client
const twilioClient = new Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// POST /api/admin/sms/trigger - Manual SMS send via Twilio
router.post('/sms/trigger', authenticateJWT, requireAdminOrSuperuser, async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    try {
      const result = await twilioClient.messages.create({
        body: 'Hello, this is an admin test message.',
        from: process.env.TWILIO_FROM_NUMBER,
        to: phoneNumber,
      });

      // Log the SMS audit
      await prisma.smsAuditLog.create({
        data: {
          recipientPhone: phoneNumber,
          messageBody: 'Hello, this is an admin test message.',
          triggerType: 'manual-trigger',
          twilioSid: result.sid,
          twilioStatus: result.status,
          direction: 'outbound',
        },
      });

      res.json({ message: 'Message sent successfully', data: result });
    } catch (error: any) {
      // Log failed SMS
      await prisma.smsAuditLog.create({
        data: {
          recipientPhone: phoneNumber,
          messageBody: 'Hello, this is an admin test message.',
          triggerType: 'manual-trigger',
          error: error.message,
          direction: 'outbound',
        },
      });

      res.status(500).json({ error: 'Error sending message' });
    }
  } catch (error: any) {
    console.error('Send SMS error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/sms-audit - Fetch SMS audit log
router.get('/sms-audit', authenticateJWT, requireAdminOrSuperuser, async (req, res) => {
  try {
    const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
    
    // Pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    
    // Filters
    const recipientPhone = searchParams.get('recipientPhone');
    const triggerType = searchParams.get('triggerType');
    const direction = searchParams.get('direction');
    
    // Build where clause
    const where: any = {};
    
    if (recipientPhone) {
      where.recipientPhone = recipientPhone;
    }
    
    if (triggerType) {
      where.triggerType = triggerType;
    }
    
    if (direction) {
      where.direction = direction;
    }
    
    // Get SMS audit logs with pagination
    const [logs, total] = await Promise.all([
      prisma.smsAuditLog.findMany({
        where,
        select: {
          id: true,
          recipientPhone: true,
          messageBody: true,
          triggerType: true,
          checkInId: true,
          initiatedByUserId: true,
          twilioSid: true,
          twilioStatus: true,
          error: true,
          direction: true,
          createdAt: true,
          updatedAt: true,
          initiatedBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          checkIn: {
            select: {
              id: true,
              driver: {
                select: {
                  name: true
                }
              },
              location: {
                select: {
                  name: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.smsAuditLog.count({ where }),
    ]);
    
    res.json({
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('Get SMS audit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;