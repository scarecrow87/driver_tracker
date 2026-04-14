// See docs/twilio-sms-testing.md for Twilio sandbox/test credential usage and magic numbers reference.
// Official docs: https://www.twilio.com/docs/iam/test-credentials

import { Request, Response } from 'express';
import { Twilio } from 'twilio';

export const twilioSmsStatusWebhookHandler = async (req: Request, res: Response) => {
  const { SID, MessageSid, Body } = req.body;

  if (!SID || !MessageSid || !Body) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const client = new Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  try {
    const result = await client.messages(MessageSid).read();
    res.json(result);
  } catch (error) {
    console.error('Error fetching message:', error);
    res.status(500).json({ error: 'Failed to fetch message' });
  }
};