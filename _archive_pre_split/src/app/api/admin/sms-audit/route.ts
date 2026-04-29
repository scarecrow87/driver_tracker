// See docs/twilio-sms-testing.md for Twilio sandbox/test credential usage and magic numbers reference.
// Official docs: https://www.twilio.com/docs/iam/test-credentials

import { NextRequest, NextResponse } from 'next/server';
import { Twilio } from 'twilio';

const twilioClient = new Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const to = searchParams.get('to');
  const body = searchParams.get('body') || '';

  if (!to) {
    return NextResponse.json({ error: 'Missing required parameter: to' }, { status: 400 });
  }

  try {
    const result = await twilioClient.messages.create({
      body,
      from: 'whatsapp:+1415523888',
      to
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(error, { status: 500 });
  }
}
