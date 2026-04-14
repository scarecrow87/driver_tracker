import React from 'react';
import { prisma } from '@/lib/prisma';

// See docs/twilio-sms-testing.md for Twilio sandbox/test credential usage and magic numbers reference.
// Official docs: https://www.twilio.com/docs/iam/test-credentials

// Placeholder for Superuser SMS settings page
export default async function SmsSettingsPage() {
  // Fetch current settings (in real app, use API call or server action)
  // const settings = await prisma.notificationSettings.findUnique({ where: { id: 'default' } });

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">SMS Integration Settings</h1>
      <form>
        {/* Inbound SMS toggle */}
        <div className="mb-4">
          <label className="font-semibold">Enable inbound SMS check-in/out</label>
          <input type="checkbox" name="inboundSmsEnabled" className="ml-2" />
        </div>
        {/* Twilio credentials (masked) */}
        <div className="mb-4">
          <label className="font-semibold">Twilio Account SID</label>
          <input type="text" name="twilioAccountSid" className="ml-2 border px-2" />
        </div>
        <div className="mb-4">
          <label className="font-semibold">Twilio From Number</label>
          <input type="text" name="twilioFromNumber" className="ml-2 border px-2" />
        </div>
        {/* Save button */}
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Save Settings</button>
      </form>
      {/* TODO: Add audit log viewer, feature flags, and rate limit controls */}
    </div>
  );
}
