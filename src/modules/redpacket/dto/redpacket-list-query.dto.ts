import { IsIn, IsOptional } from 'class-validator';

export class RedpacketListQueryDto {
  @IsOptional()
  @IsIn(['sent', 'received'])
  type?: 'sent' | 'received';
}
