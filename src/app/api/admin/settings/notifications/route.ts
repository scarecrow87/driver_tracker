// See docs/twilio-sms-testing.md for Twilio sandbox/test credential usage and magic numbers reference.
// Official docs: https://www.twilio.com/docs/iam/test-credentials

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions, isSuperuser } from '@/lib/auth';
import {
  getNotificationSettingsRow,
  upsertNotificationSettings,
} from '@/lib/notification-settings';

const updateSettingsSchema = z.object({
  emailTenantId: z.string().optional(),
  emailClientId: z.string().optional(),
  emailClientSecret: z.string().optional(),
  emailFrom: z.string().email().optional(),
  twilioAccountSid: z.string().optional(),
  twilioAuthToken: z.string().optional(),
  twilioFromNumber: z.string().optional(),
});

function toMaskedResponse(row: Awaited<ReturnType<typeof getNotificationSettingsRow>>) {
  return {
    id: row?.id ?? 'default',
    emailTenantId: row?.emailTenantId ?? '',
    emailClientId: row?.emailClientId ?? '',
    emailFrom: row?.emailFrom ?? '',
    twilioAccountSid: row?.twilioAccountSid ?? '',
    twilioFromNumber: row?.twilioFromNumber ?? '',
    hasEmailClientSecret: Boolean(row?.emailClientSecretEnc),
    hasTwilioAuthToken: Boolean(row?.twilioAuthTokenEnc),
    updatedAt: row?.updatedAt ?? null,
    updatedById: row?.updatedById ?? null,
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isSuperuser(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const row = await getNotificationSettingsRow();
  return NextResponse.json(toMaskedResponse(row));
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isSuperuser(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const parsed = updateSettingsSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const row = await upsertNotificationSettings(parsed.data, session!.user.id);
    return NextResponse.json({
      id: row.id,
      emailTenantId: row.emailTenantId ?? '',
      emailClientId: row.emailClientId ?? '',
      emailFrom: row.emailFrom ?? '',
      twilioAccountSid: row.twilioAccountSid ?? '',
      twilioFromNumber: row.twilioFromNumber ?? '',
      hasEmailClientSecret: Boolean(row.emailClientSecretEnc),
      hasTwilioAuthToken: Boolean(row.twilioAuthTokenEnc),
      updatedAt: row.updatedAt,
      updatedById: row.updatedById,
      updatedBy: row.updatedBy,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update settings';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
