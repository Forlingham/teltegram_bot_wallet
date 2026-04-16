import { IsIn, IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class CoverCreateDto {
  @IsString()
  name!: string;

  @IsUrl()
  imageUrl!: string;

  @IsString()
  botPath!: string;

  @IsOptional()
  @IsString()
  @IsIn(['LIGHT', 'DARK'])
  textTone?: 'LIGHT' | 'DARK';

  @IsString()
  price!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}
