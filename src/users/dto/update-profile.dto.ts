import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Tsani' })
  name?: string;

  @ApiPropertyOptional({ example: 'tsani@example.com' })
  email?: string;
}
