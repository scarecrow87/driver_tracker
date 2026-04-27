import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import * as crypto from 'crypto';
import { User } from '@prisma/client';

@Injectable()
export class NotificationSettingsService {
  constructor(private prisma: PrismaService) {}

  private getKey(): Buffer | null {
    const raw = process.env.SETTINGS_ENCRYPTION_KEY;
    if (!raw) return null;

    const trimmed = raw.trim();
    if (!trimmed) return null;

    try {
      const b64 = Buffer.from(trimmed, 'base64');
      if (b64.length === 32) return b64;
    } catch {
      // Ignore and fall through to utf8 handling.
    }

    const utf8 = Buffer.from(trimmed, 'utf8');
    if (utf8.length === 32) return utf8;

    return null;
  }

  encryptSetting(value: string): string {
    const key = this.getKey();
    if (!key) {
      throw new Error('SETTINGS_ENCRYPTION_KEY must be set to a 32-byte value (base64 or raw).');
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  decryptSetting(payload: string): string {
    const key = this.getKey();
    if (!key) {
      throw new Error('SETTINGS_ENCRYPTION_KEY must be set to a 32-byte value (base64 or raw).');
    }

    const [ivRaw, tagRaw, encryptedRaw] = payload.split(':');
    if (!ivRaw || !tagRaw || !encryptedRaw) {
      throw new Error('Invalid encrypted setting payload.');
    }

    const iv = Buffer.from(ivRaw, 'base64');
    const tag = Buffer.from(tagRaw, 'base64');
    const encrypted = Buffer.from(encryptedRaw, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return decrypted.toString('utf8');
  }

  async getNotificationSettingsRow() {
    return this.prisma.notificationSettings.findUnique({ where: { id: 'default' } });
  }

  async getNotificationProviderConfig() {
    const row = await this.getNotificationSettingsRow();

    const config = {
      emailTenantId: row?.emailTenantId ?? process.env.EMAIL_TENANT_ID ?? '',
      emailClientId: row?.emailClientId ?? process.env.EMAIL_CLIENT_ID ?? '',
      emailFrom: row?.emailFrom ?? process.env.EMAIL_FROM ?? '',
      twilioAccountSid: row?.twilioAccountSid ?? process.env.TWILIO_ACCOUNT_SID ?? '',
      twilioFromNumber: row?.twilioFromNumber ?? process.env.TWILIO_FROM_NUMBER ?? '',
      emailClientSecret: undefined as string | undefined,
      twilioAuthToken: undefined as string | undefined,
    };

    if (row?.emailClientSecretEnc && this.getKey()) {
      config.emailClientSecret = this.decryptSetting(row.emailClientSecretEnc);
    } else {
      config.emailClientSecret = process.env.EMAIL_CLIENT_SECRET;
    }

    if (row?.twilioAuthTokenEnc && this.getKey()) {
      config.twilioAuthToken = this.decryptSetting(row.twilioAuthTokenEnc);
    } else {
      config.twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    }

    return config;
  }

  async upsertNotificationSettings(
    input: UpdateNotificationSettingsDto,
    updatedById: string
  ) {
    const hasSecretUpdate = 
      input.emailClientSecret !== undefined || 
      input.twilioAuthToken !== undefined;

    if (hasSecretUpdate && !this.getKey()) {
      throw new Error('SETTINGS_ENCRYPTION_KEY is required before saving encrypted settings.');
    }

    return this.prisma.notificationSettings.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        emailTenantId: input.emailTenantId ?? null,
        emailClientId: input.emailClientId ?? null,
        emailClientSecretEnc: input.emailClientSecret ? this.encryptSetting(input.emailClientSecret) : null,
        emailFrom: input.emailFrom ?? null,
        twilioAccountSid: input.twilioAccountSid ?? null,
        twilioAuthTokenEnc: input.twilioAuthToken ? this.encryptSetting(input.twilioAuthToken) : null,
        twilioFromNumber: input.twilioFromNumber ?? null,
        isTwilioEnabled: input.isTwilioEnabled ?? true,
        isEmailEnabled: input.isEmailEnabled ?? true,
        updatedById,
      },
      update: {
        emailTenantId: input.emailTenantId,
        emailClientId: input.emailClientId,
        emailClientSecretEnc:
          input.emailClientSecret === undefined
            ? undefined
            : input.emailClientSecret
              ? this.encryptSetting(input.emailClientSecret)
              : null,
        emailFrom: input.emailFrom,
        twilioAccountSid: input.twilioAccountSid,
        twilioAuthTokenEnc:
          input.twilioAuthToken === undefined
            ? undefined
            : input.twilioAuthToken
              ? this.encryptSetting(input.twilioAuthToken)
              : null,
        twilioFromNumber: input.twilioFromNumber,
        isTwilioEnabled: input.isTwilioEnabled,
        isEmailEnabled: input.isEmailEnabled,
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

  async getNotificationSettings() {
    const row = await this.prisma.notificationSettings.findUnique({
      where: { id: 'default' },
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
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      emailTenantId: row.emailTenantId ?? '',
      emailClientId: row.emailClientId ?? '',
      emailFrom: row.emailFrom ?? '',
      twilioAccountSid: row.twilioAccountSid ?? '',
      twilioFromNumber: row.twilioFromNumber ?? '',
      hasEmailClientSecret: Boolean(row.emailClientSecretEnc),
      hasTwilioAuthToken: Boolean(row.twilioAuthTokenEnc),
      isTwilioEnabled: row.isTwilioEnabled,
      isEmailEnabled: row.isEmailEnabled,
      updatedAt: row.updatedAt,
      updatedById: row.updatedById,
      updatedBy: row.updatedBy,
    };
  }
}