import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  LeaveType,
  PermissionType,
  RequestStatus,
  RequestType,
} from '../../generated/prisma/client';

export class ManageRequestsQueryDto {
  @ApiPropertyOptional({ example: 1 })
  page?: string;

  @ApiPropertyOptional({ example: 10 })
  limit?: string;

  @ApiPropertyOptional({ enum: [RequestType.CUTI, RequestType.IZIN] })
  type?: string;

  @ApiPropertyOptional({
    enum: [...Object.values(LeaveType), ...Object.values(PermissionType)],
  })
  subtype?: string;

  @ApiPropertyOptional({ enum: RequestStatus })
  status?: string;

  @ApiPropertyOptional({ example: 'Information Technology' })
  department?: string;

  @ApiPropertyOptional({ enum: ['createdAt'] })
  sort?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  order?: string;
}
