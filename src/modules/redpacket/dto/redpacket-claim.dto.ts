import { IsOptional, IsString } from 'class-validator';

export class RedpacketClaimDto {
  @IsOptional()
  @IsString()
  address?: string;
}
