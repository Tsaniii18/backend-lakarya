import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'password-lama' })
  currentPassword!: string;

  @ApiProperty({ example: 'password-baru', minLength: 6 })
  newPassword!: string;

  @ApiProperty({ example: 'password-baru', minLength: 6 })
  repeatNewPassword!: string;
}
