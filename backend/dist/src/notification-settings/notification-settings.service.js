"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationSettingsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
const crypto = __importStar(require("crypto"));
let NotificationSettingsService = class NotificationSettingsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    getKey() {
        const raw = process.env.SETTINGS_ENCRYPTION_KEY;
        if (!raw)
            return null;
        const trimmed = raw.trim();
        if (!trimmed)
            return null;
        try {
            const b64 = Buffer.from(trimmed, 'base64');
            if (b64.length === 32)
                return b64;
        }
        catch {
        }
        const utf8 = Buffer.from(trimmed, 'utf8');
        if (utf8.length === 32)
            return utf8;
        return null;
    }
    encryptSetting(value) {
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
    decryptSetting(payload) {
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
            emailClientSecret: undefined,
            twilioAuthToken: undefined,
        };
        if (row?.emailClientSecretEnc && this.getKey()) {
            config.emailClientSecret = this.decryptSetting(row.emailClientSecretEnc);
        }
        else {
            config.emailClientSecret = process.env.EMAIL_CLIENT_SECRET;
        }
        if (row?.twilioAuthTokenEnc && this.getKey()) {
            config.twilioAuthToken = this.decryptSetting(row.twilioAuthTokenEnc);
        }
        else {
            config.twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
        }
        return config;
    }
    async upsertNotificationSettings(input, updatedById) {
        const hasSecretUpdate = input.emailClientSecret !== undefined ||
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
                emailClientSecretEnc: input.emailClientSecret === undefined
                    ? undefined
                    : input.emailClientSecret
                        ? this.encryptSetting(input.emailClientSecret)
                        : null,
                emailFrom: input.emailFrom,
                twilioAccountSid: input.twilioAccountSid,
                twilioAuthTokenEnc: input.twilioAuthToken === undefined
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
};
exports.NotificationSettingsService = NotificationSettingsService;
exports.NotificationSettingsService = NotificationSettingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NotificationSettingsService);
//# sourceMappingURL=notification-settings.service.js.map