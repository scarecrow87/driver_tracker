import { IsOptional, IsString } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsString()
  emailTenantId?: string;

  @IsOptional()
  @IsString()
  emailClientId?: string;

  @IsOptional()
  @IsString()
  emailClientSecret?: string;

  @IsOptional()
  @IsString()
  emailFrom?: string;

  @IsOptional()
  @IsString()
  twilioAccountSid?: string;

  @IsOptional()
  @IsString()
  twilioAuthToken?: string;

  @IsOptional()
  @IsString()
  twilioFromNumber?: string;

  @IsOptional()
  isTwilioEnabled?: boolean;

  @IsOptional()
  isEmailEnabled?: boolean;
}