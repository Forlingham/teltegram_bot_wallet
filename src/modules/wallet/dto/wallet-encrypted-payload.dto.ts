import { IsString, Length } from 'class-validator';

export class WalletEncryptedPayloadDto {
  @IsString()
  @Length(8, 128)
  address!: string;

  @IsString()
  @Length(16, 8192)
  encryptedMnemonic!: string;

  @IsString()
  @Length(16, 256)
  salt!: string;

  @IsString()
  @Length(16, 256)
  iv!: string;

  @IsString()
  @Length(16, 256)
  authTag!: string;
}
