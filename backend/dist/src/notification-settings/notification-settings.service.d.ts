import { PrismaService } from '../prisma.service';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
export declare class NotificationSettingsService {
    private prisma;
    constructor(prisma: PrismaService);
    private getKey;
    encryptSetting(value: string): string;
    decryptSetting(payload: string): string;
    getNotificationSettingsRow(): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        emailTenantId: string | null;
        emailClientId: string | null;
        emailFrom: string | null;
        twilioAccountSid: string | null;
        twilioFromNumber: string | null;
        isTwilioEnabled: boolean;
        isEmailEnabled: boolean;
        emailClientSecretEnc: string | null;
        twilioAuthTokenEnc: string | null;
        inboundSmsEnabled: boolean;
        updatedById: string | null;
    } | null>;
    getNotificationProviderConfig(): Promise<{
        emailTenantId: string;
        emailClientId: string;
        emailFrom: string;
        twilioAccountSid: string;
        twilioFromNumber: string;
        emailClientSecret: string | undefined;
        twilioAuthToken: string | undefined;
    }>;
    upsertNotificationSettings(input: UpdateNotificationSettingsDto, updatedById: string): Promise<{
        updatedBy: {
            id: string;
            email: string;
            name: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        emailTenantId: string | null;
        emailClientId: string | null;
        emailFrom: string | null;
        twilioAccountSid: string | null;
        twilioFromNumber: string | null;
        isTwilioEnabled: boolean;
        isEmailEnabled: boolean;
        emailClientSecretEnc: string | null;
        twilioAuthTokenEnc: string | null;
        inboundSmsEnabled: boolean;
        updatedById: string | null;
    }>;
    getNotificationSettings(): Promise<{
        id: string;
        emailTenantId: string;
        emailClientId: string;
        emailFrom: string;
        twilioAccountSid: string;
        twilioFromNumber: string;
        hasEmailClientSecret: boolean;
        hasTwilioAuthToken: boolean;
        isTwilioEnabled: boolean;
        isEmailEnabled: boolean;
        updatedAt: Date;
        updatedById: string | null;
        updatedBy: {
            id: string;
            email: string;
            name: string;
        } | null;
    } | null>;
}
