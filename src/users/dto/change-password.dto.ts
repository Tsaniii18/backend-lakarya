import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'password-lama' })
  currentPassword!: string;

  @ApiProperty({ example: 'password-baru' })
  newPassword!: string;

  @ApiProperty({ example: 'password-baru' })
  repeatNewPassword!: string;
}
