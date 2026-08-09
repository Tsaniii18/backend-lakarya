import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty()
  token!: string;

  @ApiProperty({ example: 'password-baru' })
  password!: string;

  @ApiProperty({ example: 'password-baru' })
  repeatPassword!: string;
}
