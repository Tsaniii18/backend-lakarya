import { ApiPropertyOptional } from '@nestjs/swagger';
import { ComplaintStatus } from '../../generated/prisma/client';

export class UpdateComplaintDto {
  @ApiPropertyOptional({ enum: ComplaintStatus })
  status?: string;

  @ApiPropertyOptional({ example: 'Keluhan mulai ditangani oleh HR.' })
  activityNote?: string;
}
