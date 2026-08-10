import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApprovalStatus } from '../../generated/prisma/client';

export class ListApprovalsQueryDto {
  @ApiPropertyOptional({ example: 1 })
  page?: string;

  @ApiPropertyOptional({ example: 10 })
  limit?: string;

  @ApiPropertyOptional({ enum: ApprovalStatus })
  status?: string;
}
