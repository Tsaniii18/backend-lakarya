import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty()
  token!: string;

  @ApiProperty({ example: 'password-baru', minLength: 6 })
  password!: string;

  @ApiProperty({ example: 'password-baru', minLength: 6 })
  repeatPassword!: string;
}
