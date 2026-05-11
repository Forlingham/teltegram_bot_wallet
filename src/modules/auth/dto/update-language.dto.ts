import { IsIn, IsString } from 'class-validator';

export class UpdateLanguageDto {
  @IsString()
  @IsIn(['zh-CN', 'en', 'ru'])
  language!: string;
}
