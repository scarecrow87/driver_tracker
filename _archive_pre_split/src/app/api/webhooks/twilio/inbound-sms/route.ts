import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Helper: parse SMS body for command and location code
function parseSmsBody(body: string) {
  // Example: "CHECKIN 1234" or "CHECKOUT 5678"
  const match = body.trim().match(/^(CHECKIN|CHECKOUT)\s+(\w+)/i);
  if (!match) return null;
  return { command: match[1].toUpperCase(), locationCode: match[2] };
}

// See docs/twilio-sms-testing.md for Twilio sandbox/test credential usage and magic numbers reference.
// Official docs: https://www.twilio.com/docs/iam/test-credentials

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const from = formData.get('From') as string; // E.164
  const body = formData.get('Body') as string;

  // Failsafe: limit number of inbound SMS check-ins/check-outs per driver per day
  const MAX_SMS_ACTIONS_PER_DAY = 4;
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
    return new NextResponse('<Response><Message>Daily SMS check-in/out limit reached. Please contact your admin if this is an error.</Message></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  // Parse command and location
  const parsed = parseSmsBody(body);
  if (!parsed) {
    return new NextResponse('<Response><Message>Invalid format. Use CHECKIN <location_code> or CHECKOUT <location_code>.</Message></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  // Find driver by phone
  const driver = await prisma.user.findFirst({ where: { driverPhone: from, isActive: true } });
  if (!driver) {
    return new NextResponse('<Response><Message>Phone not recognized. Contact your admin.</Message></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  // Find location by code
  const location = await prisma.location.findFirst({ where: { id: parsed.locationCode } });
  if (!location) {
    return new NextResponse('<Response><Message>Location code not found. Contact your admin.</Message></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
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
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return new NextResponse(`<Response><Message>${message}</Message></Response>`, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}
