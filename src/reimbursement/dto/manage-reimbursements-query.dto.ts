import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ExpenseType,
  RequestStatus,
} from '../../generated/prisma/client';

export class ManageReimbursementsQueryDto {
  @ApiPropertyOptional({ example: 1 })
  page?: string;

  @ApiPropertyOptional({ example: 10 })
  limit?: string;

  @ApiPropertyOptional({ enum: RequestStatus })
  status?: string;

  @ApiPropertyOptional({ enum: ExpenseType })
  expenseType?: string;

  @ApiPropertyOptional({ enum: ['createdAt'] })
  sort?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  order?: string;
}
