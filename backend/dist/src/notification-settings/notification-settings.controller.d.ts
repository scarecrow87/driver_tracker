import { NotificationSettingsService } from './notification-settings.service';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import type { Request } from 'express';
export declare class NotificationSettingsController {
    private notificationSettingsService;
    constructor(notificationSettingsService: NotificationSettingsService);
    getSettings(): Promise<{
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
    updateSettings(req: Request, dto: UpdateNotificationSettingsDto): Promise<{
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
}
