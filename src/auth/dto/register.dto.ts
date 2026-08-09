import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'EMP-001' })
  employeeNumber!: string;

  @ApiProperty({ example: 'Tsani' })
  name!: string;

  @ApiProperty({ example: 'tsani@example.com' })
  email!: string;

  @ApiProperty({ example: 'Information Technology' })
  department!: string;

  @ApiProperty({ example: 'password-rahasia' })
  password!: string;

  @ApiProperty({ example: 'password-rahasia' })
  repeatPassword!: string;
}
