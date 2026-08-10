import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  RequestStatus,
  RequestType,
} from '../../generated/prisma/client';

export class ListRequestsQueryDto {
  @ApiPropertyOptional({ example: 1 })
  page?: string;

  @ApiPropertyOptional({ example: 10 })
  limit?: string;

  @ApiPropertyOptional({ enum: RequestType })
  type?: string;

  @ApiPropertyOptional({ enum: RequestStatus })
  status?: string;

  @ApiPropertyOptional({ enum: ['createdAt'] })
  sort?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  order?: string;
}
