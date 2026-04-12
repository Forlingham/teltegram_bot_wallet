import { IsString, Length } from 'class-validator';

export class TelegramLoginDto {
  @IsString()
  @Length(1, 8192)
  initData!: string;
}
