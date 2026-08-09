import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'tsani@example.com' })
  email!: string;

  @ApiProperty({ example: 'password-rahasia' })
  password!: string;
}
