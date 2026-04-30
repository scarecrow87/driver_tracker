import { IsString, IsOptional, IsNumber, IsBoolean, MinLength } from 'class-validator';

export class CreateCheckinDto {
  @IsString()
  @MinLength(1)
  locationId: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsBoolean()
  extendedStay?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(1)
  extendedStayReason?: string;
}