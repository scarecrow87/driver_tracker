// See docs/twilio-sms-testing.md for Twilio sandbox/test credential usage and magic numbers reference.
// Official docs: https://www.twilio.com/docs/iam/test-credentials

import { NextRequest, NextResponse } from 'next/server';
import { Twilio } from 'twilio';

const twilioClient = new Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function POST(req: NextRequest) {
  const { phoneNumber } = await req.json();

  if (!phoneNumber) {
    return NextResponse.json({ message: 'Phone number is required' }, { status: 400 });
  }

  try {
    const result = await twilioClient.messages.create({
      body: 'Hello, this is an admin test message.',
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });
    return NextResponse.json({ message: 'Message sent successfully', data: result });
  } catch (error) {
    return NextResponse.json({ message: 'Error sending message', error }, { status: 500 });
  }
}
