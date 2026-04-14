// See docs/twilio-sms-testing.md for Twilio sandbox/test credential usage and magic numbers reference.
// Official docs: https://www.twilio.com/docs/iam/test-credentials

import { Request, Response } from "express";
import { Twilio } from "twilio";

const twilio = new Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export const adminSMSHandler = (req: Request, res: Response) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ message: "Phone number is required" });
  }

  twilio.messages.create({
    body: "Hello, this is an admin test message.",
    from: process.env.TWILIO_PHONE_NUMBER,
    to: phoneNumber,
  }).then((result) => {
    res.json({ message: "Message sent successfully", data: result });
  }).catch((error) => {
    res.status(500).json({ message: "Error sending message", error });
  });
};