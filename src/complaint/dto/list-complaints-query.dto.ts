import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListComplaintsQueryDto {
  @ApiPropertyOptional({ example: 1 })
  page?: string;

  @ApiPropertyOptional({ example: 10 })
  limit?: string;
}
