import { prisma } from './prisma';
import { decryptSetting, encryptSetting } from './settings-crypto';

export type NotificationProviderConfig = {
  emailTenantId?: string;
  emailClientId?: string;
  emailClientSecret?: string;
  emailFrom?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromNumber?: string;
};

export type NotificationSettingsInput = {
  emailTenantId?: string | null;
  emailClientId?: string | null;
  emailClientSecret?: string | null;
  emailFrom?: string | null;
  twilioAccountSid?: string | null;
  twilioAuthToken?: string | null;
  twilioFromNumber?: string | null;
};

function hasEncryptionKey(): boolean {
  return Boolean(process.env.SETTINGS_ENCRYPTION_KEY?.trim());
}

function normalizeOptional(value?: string | null): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function getNotificationSettingsRow() {
  return prisma.notificationSettings.findUnique({ where: { id: 'default' } });
}

export async function getNotificationProviderConfig(): Promise<NotificationProviderConfig> {
  const row = await getNotificationSettingsRow();

  const config: NotificationProviderConfig = {
    emailTenantId: row?.emailTenantId ?? process.env.EMAIL_TENANT_ID,
    emailClientId: row?.emailClientId ?? process.env.EMAIL_CLIENT_ID,
    emailFrom: row?.emailFrom ?? process.env.EMAIL_FROM,
    twilioAccountSid: row?.twilioAccountSid ?? process.env.TWILIO_ACCOUNT_SID,
    twilioFromNumber: row?.twilioFromNumber ?? process.env.TWILIO_FROM_NUMBER,
  };

  if (row?.emailClientSecretEnc && hasEncryptionKey()) {
    config.emailClientSecret = decryptSetting(row.emailClientSecretEnc);
  } else {
    config.emailClientSecret = process.env.EMAIL_CLIENT_SECRET;
  }

  if (row?.twilioAuthTokenEnc && hasEncryptionKey()) {
    config.twilioAuthToken = decryptSetting(row.twilioAuthTokenEnc);
  } else {
    config.twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  }

  return config;
}

export async function upsertNotificationSettings(
  input: NotificationSettingsInput,
  updatedById: string
) {
  const emailTenantId = normalizeOptional(input.emailTenantId);
  const emailClientId = normalizeOptional(input.emailClientId);
  const emailClientSecret = normalizeOptional(input.emailClientSecret);
  const emailFrom = normalizeOptional(input.emailFrom);
  const twilioAccountSid = normalizeOptional(input.twilioAccountSid);
  const twilioAuthToken = normalizeOptional(input.twilioAuthToken);
  const twilioFromNumber = normalizeOptional(input.twilioFromNumber);

  const hasSecretUpdate = emailClientSecret !== undefined || twilioAuthToken !== undefined;
  if (hasSecretUpdate && !hasEncryptionKey()) {
    throw new Error('SETTINGS_ENCRYPTION_KEY is required before saving encrypted settings.');
  }

  return prisma.notificationSettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      emailTenantId: emailTenantId ?? null,
      emailClientId: emailClientId ?? null,
      emailClientSecretEnc: emailClientSecret ? encryptSetting(emailClientSecret) : null,
      emailFrom: emailFrom ?? null,
      twilioAccountSid: twilioAccountSid ?? null,
      twilioAuthTokenEnc: twilioAuthToken ? encryptSetting(twilioAuthToken) : null,
      twilioFromNumber: twilioFromNumber ?? null,
      updatedById,
    },
    update: {
      emailTenantId,
      emailClientId,
      emailClientSecretEnc:
        emailClientSecret === undefined
          ? undefined
          : emailClientSecret
            ? encryptSetting(emailClientSecret)
            : null,
      emailFrom,
      twilioAccountSid,
      twilioAuthTokenEnc:
        twilioAuthToken === undefined
          ? undefined
          : twilioAuthToken
            ? encryptSetting(twilioAuthToken)
            : null,
      twilioFromNumber,
      updatedById,
    },
    include: {
      updatedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}
