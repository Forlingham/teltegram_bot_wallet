import { IsString } from 'class-validator';

export class RedpacketDapOutputsDto {
  @IsString()
  message!: string;
}
