import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ComplaintCategory,
  ComplaintStatus,
} from '../../generated/prisma/client';

export class ManageComplaintsQueryDto {
  @ApiPropertyOptional({ example: 1 })
  page?: string;

  @ApiPropertyOptional({ example: 10 })
  limit?: string;

  @ApiPropertyOptional({ enum: ComplaintCategory })
  category?: string;

  @ApiPropertyOptional({ enum: ComplaintStatus })
  status?: string;

  @ApiPropertyOptional({ example: 'fasilitas' })
  search?: string;

  @ApiPropertyOptional({ enum: ['createdAt'] })
  sort?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  order?: string;
}
