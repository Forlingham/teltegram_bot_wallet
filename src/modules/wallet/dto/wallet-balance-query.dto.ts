import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class WalletBalanceQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeUnconfirmed?: boolean;
}
