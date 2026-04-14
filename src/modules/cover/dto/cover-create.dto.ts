import { IsInt, IsString, IsUrl, Min } from 'class-validator';

export class CoverCreateDto {
  @IsString()
  name!: string;

  @IsUrl()
  imageUrl!: string;

  @IsString()
  botPath!: string;

  @IsString()
  price!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}
